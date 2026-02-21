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

const UpdateTransactionInput = S.Struct({
  id: S.String.pipe(S.minLength(1)),
  categoryId: S.NullOr(S.String.pipe(S.minLength(1)))
});

type UpdateTransactionInput = S.Schema.Type<typeof UpdateTransactionInput>;

/**
 * Server action to update a transaction's category directly.
 * Unlike categorizeTransactionAction, this does NOT create merchant mappings.
 * Use this for manual one-off corrections.
 */
export const updateTransactionAction = async (input: UpdateTransactionInput) => {
  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const parsed = yield* S.decodeUnknown(UpdateTransactionInput)(input).pipe(
        Effect.mapError(
          () =>
            new ValidationError({
              message: 'Transaction id is required',
              field: 'id'
            })
        )
      );

      yield* getSession();
      const db = yield* Db;

      yield* Effect.annotateCurrentSpan({
        'transaction.id': parsed.id,
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

      // Update the transaction
      yield* db
        .update(schema.transaction)
        .set({ categoryId: parsed.categoryId })
        .where(eq(schema.transaction.id, parsed.id));

      return { id: parsed.id, categoryId: parsed.categoryId };
    }).pipe(
      Effect.withSpan('action.transaction.update', {
        attributes: {
          'transaction.id': input.id,
          operation: 'transaction.update'
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
            revalidatePath('/review');
            revalidatePath('/transactions');
            return { _tag: 'Success' as const, ...result };
          })
      })
    )
  );
};
