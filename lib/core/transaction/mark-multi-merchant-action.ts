'use server';

import { Effect, Match, Schema as S } from 'effect';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { AppLayer } from '@/lib/layers';
import { NextEffect } from '@/lib/next-effect';
import { getSession } from '@/lib/services/auth/get-session';
import { Db } from '@/lib/services/db/live-layer';
import * as schema from '@/lib/services/db/schema';
import { NotFoundError, ValidationError } from '@/lib/core/errors';

const MarkMultiMerchantInput = S.Struct({
  transactionId: S.String.pipe(S.minLength(1))
});

type MarkMultiMerchantInput = S.Schema.Type<typeof MarkMultiMerchantInput>;

/**
 * Marks a merchant as multi-merchant (umbrella merchant).
 *
 * Multi-merchants are merchants that sell different types of products
 * and cannot be reliably auto-categorized. Future transactions from
 * this merchant will always require manual review.
 *
 * This action:
 * 1. Fetches the transaction to get the merchant name
 * 2. Deletes any existing mapping for this merchant
 * 3. Creates a new mapping with isMultiMerchant=true and no categoryId
 */
export const markMultiMerchantAction = async (input: MarkMultiMerchantInput) => {
  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const parsed = yield* S.decodeUnknown(MarkMultiMerchantInput)(input).pipe(
        Effect.mapError(
          () =>
            new ValidationError({
              message: 'Invalid input: transactionId is required',
              field: 'input'
            })
        )
      );

      yield* getSession();
      const db = yield* Db;

      yield* Effect.annotateCurrentSpan({
        'transaction.id': parsed.transactionId
      });

      // Fetch transaction to get merchant name
      const [existingTransaction] = yield* db
        .select({
          id: schema.transaction.id,
          merchant: schema.transaction.merchant
        })
        .from(schema.transaction)
        .where(eq(schema.transaction.id, parsed.transactionId))
        .limit(1);

      if (!existingTransaction) {
        return yield* new NotFoundError({
          message: 'Transaction not found',
          entity: 'transaction',
          id: parsed.transactionId
        });
      }

      const merchant = existingTransaction.merchant;

      // Delete any existing mapping for this merchant
      yield* db
        .delete(schema.merchantMapping)
        .where(eq(schema.merchantMapping.merchantPattern, merchant));

      // Create multi-merchant mapping (no categoryId)
      yield* db.insert(schema.merchantMapping).values({
        merchantPattern: merchant,
        categoryId: null,
        isMultiMerchant: true
      });

      yield* Effect.annotateCurrentSpan({
        'merchant.pattern': merchant,
        'merchant.isMultiMerchant': true
      });

      return { merchant };
    }).pipe(
      Effect.withSpan('action.merchant.markMulti', {
        attributes: {
          'transaction.id': input.transactionId,
          operation: 'merchant.markMulti'
        }
      }),
      Effect.provide(AppLayer),
      Effect.scoped,
      Effect.matchEffect({
        onFailure: error =>
          Match.value(error._tag).pipe(
            Match.when('UnauthenticatedError', () => NextEffect.redirect('/login')),
            Match.when('NotFoundError', () =>
              Effect.succeed({
                _tag: 'Error' as const,
                message: error.message
              })
            ),
            Match.when('ValidationError', () =>
              Effect.succeed({
                _tag: 'Error' as const,
                message: error.message
              })
            ),
            Match.orElse(() =>
              Effect.succeed({
                _tag: 'Error' as const,
                message: 'Failed to mark merchant as multi-merchant'
              })
            )
          ),
        onSuccess: result =>
          Effect.sync(() => {
            revalidatePath('/');
            revalidatePath('/review');
            return { _tag: 'Success' as const, ...result };
          })
      })
    )
  );
};
