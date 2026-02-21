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

const UnmarkMultiMerchantInput = S.Struct({
  transactionId: S.String.pipe(S.minLength(1))
});

type UnmarkMultiMerchantInput = S.Schema.Type<typeof UnmarkMultiMerchantInput>;

/**
 * Removes the multi-merchant flag from a merchant.
 *
 * This deletes the multi-merchant mapping, allowing future transactions
 * from this merchant to be auto-categorized normally.
 */
export const unmarkMultiMerchantAction = async (input: UnmarkMultiMerchantInput) => {
  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const parsed = yield* S.decodeUnknown(UnmarkMultiMerchantInput)(input).pipe(
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

      // Delete the multi-merchant mapping
      yield* db
        .delete(schema.merchantMapping)
        .where(eq(schema.merchantMapping.merchantPattern, merchant));

      yield* Effect.annotateCurrentSpan({
        'merchant.pattern': merchant,
        'merchant.isMultiMerchant': false
      });

      return { merchant };
    }).pipe(
      Effect.withSpan('action.merchant.unmarkMulti', {
        attributes: {
          'transaction.id': input.transactionId,
          operation: 'merchant.unmarkMulti'
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
                message: 'Failed to unmark multi-merchant'
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
