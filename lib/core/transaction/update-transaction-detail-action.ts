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

// Date string in YYYY-MM-DD format, parsed as UTC midnight to avoid timezone shifts
const DateOnly = S.transform(S.String.pipe(S.pattern(/^\d{4}-\d{2}-\d{2}$/)), S.DateFromSelf, {
  decode: str => new Date(str + 'T00:00:00.000Z'),
  encode: date => date.toISOString().split('T')[0]
});

const UpdateTransactionDetailInput = S.Struct({
  id: S.String.pipe(S.minLength(1)),
  date: DateOnly,
  merchant: S.String.pipe(S.minLength(1)),
  amount: S.Number,
  categoryId: S.NullOr(S.String.pipe(S.minLength(1)))
});

type UpdateTransactionDetailInput = S.Schema.Encoded<typeof UpdateTransactionDetailInput>;

/**
 * Server action to update transaction details (date, merchant, amount, category).
 * Unlike the simple updateTransactionAction, this allows editing all fields.
 * The originalHash is preserved for duplicate detection.
 */
export const updateTransactionDetailAction = async (input: UpdateTransactionDetailInput) => {
  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const parsed = yield* S.decodeUnknown(UpdateTransactionDetailInput)(input).pipe(
        Effect.mapError(
          () =>
            new ValidationError({
              message: 'Invalid transaction data',
              field: 'input'
            })
        )
      );

      yield* getSession();
      const db = yield* Db;

      yield* Effect.annotateCurrentSpan({
        'transaction.id': parsed.id,
        'transaction.merchant': parsed.merchant,
        'transaction.amount': parsed.amount,
        'category.id': parsed.categoryId ?? 'null'
      });

      // Verify transaction exists
      const [existing] = yield* db
        .select({ id: schema.transaction.id })
        .from(schema.transaction)
        .where(eq(schema.transaction.id, parsed.id))
        .limit(1);

      if (!existing) {
        return yield* new NotFoundError({
          message: 'Transaction not found',
          entity: 'transaction',
          id: parsed.id
        });
      }

      // If categoryId provided, verify it exists
      if (parsed.categoryId !== null) {
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
      }

      // Update the transaction (originalHash stays the same)
      yield* db
        .update(schema.transaction)
        .set({
          date: parsed.date,
          merchant: parsed.merchant,
          amount: String(parsed.amount),
          categoryId: parsed.categoryId
        })
        .where(eq(schema.transaction.id, parsed.id));

      return {
        id: parsed.id,
        date: parsed.date,
        merchant: parsed.merchant,
        amount: parsed.amount,
        categoryId: parsed.categoryId
      };
    }).pipe(
      Effect.withSpan('action.transaction.updateDetail', {
        attributes: {
          'transaction.id': input.id,
          operation: 'transaction.updateDetail'
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
                message: 'Failed to update transaction'
              })
            )
          ),
        onSuccess: result =>
          Effect.sync(() => {
            revalidatePath('/');
            revalidatePath('/transactions');
            revalidatePath(`/transactions/${result.id}`);
            return { _tag: 'Success' as const, ...result };
          })
      })
    )
  );
};
