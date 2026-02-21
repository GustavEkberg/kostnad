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

const DeleteTransactionInput = S.Struct({
  id: S.String.pipe(S.minLength(1))
});

type DeleteTransactionInput = S.Schema.Type<typeof DeleteTransactionInput>;

/**
 * Server action to delete a transaction.
 */
export const deleteTransactionAction = async (input: DeleteTransactionInput) => {
  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const parsed = yield* S.decodeUnknown(DeleteTransactionInput)(input).pipe(
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
        'transaction.id': parsed.id
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

      // Delete the transaction
      yield* db.delete(schema.transaction).where(eq(schema.transaction.id, parsed.id));

      return { id: parsed.id };
    }).pipe(
      Effect.withSpan('action.transaction.delete', {
        attributes: {
          'transaction.id': input.id,
          operation: 'transaction.delete'
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
                message: 'Failed to delete transaction'
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
