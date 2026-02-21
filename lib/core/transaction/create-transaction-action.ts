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
import { computeTransactionHash } from './hash';

// Date string in YYYY-MM-DD format, parsed as UTC midnight to avoid timezone shifts
const DateOnly = S.transform(S.String.pipe(S.pattern(/^\d{4}-\d{2}-\d{2}$/)), S.DateFromSelf, {
  decode: str => new Date(str + 'T00:00:00.000Z'),
  encode: date => date.toISOString().split('T')[0]
});

const CreateTransactionInput = S.Struct({
  date: DateOnly,
  merchant: S.String.pipe(S.minLength(1)),
  amount: S.Number,
  balance: S.NullOr(S.Number),
  categoryId: S.NullOr(S.String.pipe(S.minLength(1)))
});

type CreateTransactionInput = S.Schema.Encoded<typeof CreateTransactionInput>;

/**
 * Server action to create a manual transaction.
 * Manual transactions have null uploadId and a computed originalHash.
 */
export const createTransactionAction = async (input: CreateTransactionInput) => {
  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const parsed = yield* S.decodeUnknown(CreateTransactionInput)(input).pipe(
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
        'transaction.merchant': parsed.merchant,
        'transaction.amount': parsed.amount,
        'category.id': parsed.categoryId ?? 'null'
      });

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

      // Compute hash for duplicate detection
      const originalHash = computeTransactionHash(parsed.date, parsed.amount, parsed.merchant);

      // Check if duplicate exists
      const [existing] = yield* db
        .select({ id: schema.transaction.id })
        .from(schema.transaction)
        .where(eq(schema.transaction.originalHash, originalHash))
        .limit(1);

      if (existing) {
        return yield* new ValidationError({
          message: 'A transaction with these details already exists',
          field: 'duplicate'
        });
      }

      // Create the transaction (uploadId is null for manual entry)
      const [created] = yield* db
        .insert(schema.transaction)
        .values({
          date: parsed.date,
          merchant: parsed.merchant,
          amount: String(parsed.amount),
          balance: parsed.balance !== null ? String(parsed.balance) : null,
          categoryId: parsed.categoryId,
          uploadId: null,
          originalHash
        })
        .returning({ id: schema.transaction.id });

      yield* Effect.annotateCurrentSpan({
        'transaction.id': created.id
      });

      return {
        id: created.id,
        date: parsed.date,
        merchant: parsed.merchant,
        amount: parsed.amount,
        categoryId: parsed.categoryId
      };
    }).pipe(
      Effect.withSpan('action.transaction.create', {
        attributes: {
          operation: 'transaction.create'
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
                message: 'Failed to create transaction'
              })
            )
          ),
        onSuccess: result =>
          Effect.sync(() => {
            revalidatePath('/');
            revalidatePath('/transactions');
            return { _tag: 'Success' as const, ...result };
          })
      })
    )
  );
};
