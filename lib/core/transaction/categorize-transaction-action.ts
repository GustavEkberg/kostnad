'use server';

import { Effect, Match, Schema as S } from 'effect';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { AppLayer } from '@/lib/layers';
import { NextEffect } from '@/lib/next-effect';
import { getSession } from '@/lib/services/auth/get-session';
import { Db } from '@/lib/services/db/live-layer';
import * as schema from '@/lib/services/db/schema';
import { NotFoundError, ValidationError } from '@/lib/core/errors';

// Input validation schema
const CategorizeTransactionInput = S.Struct({
  transactionId: S.String.pipe(S.minLength(1)),
  categoryId: S.String.pipe(S.minLength(1))
});

type CategorizeTransactionInput = S.Schema.Type<typeof CategorizeTransactionInput>;

/**
 * Server action to categorize a transaction and create a merchant mapping.
 *
 * 1. Updates the transaction's categoryId
 * 2. Creates or updates a merchant_mapping for the transaction's merchant
 *    (so future transactions with the same merchant get auto-categorized)
 */
export const categorizeTransactionAction = async (input: CategorizeTransactionInput) => {
  return await NextEffect.runPromise(
    Effect.gen(function* () {
      // Validate input
      const parsed = yield* S.decodeUnknown(CategorizeTransactionInput)(input).pipe(
        Effect.mapError(
          () =>
            new ValidationError({
              message: 'Invalid input: transactionId and categoryId are required',
              field: 'input'
            })
        )
      );

      yield* getSession();
      const db = yield* Db;

      yield* Effect.annotateCurrentSpan({
        'transaction.id': parsed.transactionId,
        'category.id': parsed.categoryId
      });

      // Verify category exists
      const [existingCategory] = yield* db
        .select({ id: schema.category.id })
        .from(schema.category)
        .where(eq(schema.category.id, parsed.categoryId))
        .limit(1);

      if (!existingCategory) {
        return yield* new NotFoundError({
          message: 'Category not found',
          entity: 'category',
          id: parsed.categoryId
        });
      }

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

      // Check if merchant is marked as multi-merchant (substring match like in upload)
      const multiMerchantMappings = yield* db
        .select({
          merchantPattern: schema.merchantMapping.merchantPattern
        })
        .from(schema.merchantMapping)
        .where(eq(schema.merchantMapping.isMultiMerchant, true));

      const merchantLower = existingTransaction.merchant.toLowerCase();
      const isMultiMerchant = multiMerchantMappings.some(m =>
        merchantLower.includes(m.merchantPattern.toLowerCase())
      );

      let updatedCount: number;

      if (isMultiMerchant) {
        // Multi-merchant: only update this single transaction, no mapping
        yield* db
          .update(schema.transaction)
          .set({ categoryId: parsed.categoryId })
          .where(eq(schema.transaction.id, parsed.transactionId));
        updatedCount = 1;
      } else {
        // Normal merchant: update all uncategorized with same merchant
        const updateResult = yield* db
          .update(schema.transaction)
          .set({ categoryId: parsed.categoryId })
          .where(
            and(
              eq(schema.transaction.merchant, existingTransaction.merchant),
              isNull(schema.transaction.categoryId)
            )
          )
          .returning({ id: schema.transaction.id });

        updatedCount = updateResult.length;

        // Create or update merchant mapping
        yield* db
          .insert(schema.merchantMapping)
          .values({
            merchantPattern: existingTransaction.merchant,
            categoryId: parsed.categoryId,
            isMultiMerchant: false
          })
          .onConflictDoUpdate({
            target: schema.merchantMapping.merchantPattern,
            set: { categoryId: parsed.categoryId, isMultiMerchant: false }
          });
      }

      yield* Effect.annotateCurrentSpan({
        'merchant.pattern': existingTransaction.merchant,
        'merchant.isMultiMerchant': isMultiMerchant,
        'transactions.updated': updatedCount
      });

      return {
        transactionId: parsed.transactionId,
        categoryId: parsed.categoryId,
        updatedCount
      };
    }).pipe(
      Effect.withSpan('action.transaction.categorize', {
        attributes: {
          'transaction.id': input.transactionId,
          'category.id': input.categoryId,
          operation: 'transaction.categorize'
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
                message: 'Failed to categorize transaction'
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
