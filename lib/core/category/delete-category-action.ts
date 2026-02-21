'use server';

import { Effect, Match, Schema as S } from 'effect';
import { revalidatePath } from 'next/cache';
import { eq, count } from 'drizzle-orm';
import { AppLayer } from '@/lib/layers';
import { NextEffect } from '@/lib/next-effect';
import { getSession } from '@/lib/services/auth/get-session';
import { Db } from '@/lib/services/db/live-layer';
import * as schema from '@/lib/services/db/schema';
import { NotFoundError, ValidationError, ConstraintError } from '@/lib/core/errors';

const DeleteCategoryInput = S.Struct({
  id: S.String.pipe(S.minLength(1))
});

type DeleteCategoryInput = S.Schema.Type<typeof DeleteCategoryInput>;

/**
 * Server action to delete a category.
 *
 * Fails if:
 * - Category doesn't exist
 * - Category is a default category
 * - Category has transactions linked to it
 */
export const deleteCategoryAction = async (input: DeleteCategoryInput) => {
  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const parsed = yield* S.decodeUnknown(DeleteCategoryInput)(input).pipe(
        Effect.mapError(
          () =>
            new ValidationError({
              message: 'Category id is required',
              field: 'id'
            })
        )
      );

      yield* getSession();
      const db = yield* Db;

      yield* Effect.annotateCurrentSpan({
        'category.id': parsed.id
      });

      // Verify category exists and check if it's a default
      const [existing] = yield* db
        .select({
          id: schema.category.id,
          name: schema.category.name,
          isDefault: schema.category.isDefault
        })
        .from(schema.category)
        .where(eq(schema.category.id, parsed.id))
        .limit(1);

      if (!existing) {
        return yield* new NotFoundError({
          message: 'Category not found',
          entity: 'category',
          id: parsed.id
        });
      }

      if (existing.isDefault) {
        return yield* new ConstraintError({
          message: 'Cannot delete default categories',
          constraint: 'isDefault'
        });
      }

      // Check if category has transactions
      const [txCount] = yield* db
        .select({ count: count() })
        .from(schema.transaction)
        .where(eq(schema.transaction.categoryId, parsed.id));

      if (txCount && txCount.count > 0) {
        return yield* new ConstraintError({
          message: `Cannot delete category with ${txCount.count} transaction(s). Reassign them first.`,
          constraint: 'hasTransactions'
        });
      }

      // Delete any merchant mappings for this category first
      yield* db
        .delete(schema.merchantMapping)
        .where(eq(schema.merchantMapping.categoryId, parsed.id));

      // Delete the category
      yield* db.delete(schema.category).where(eq(schema.category.id, parsed.id));

      return { id: parsed.id, name: existing.name };
    }).pipe(
      Effect.withSpan('action.category.delete', {
        attributes: {
          'category.id': input.id,
          operation: 'category.delete'
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
            Match.when('ConstraintError', () =>
              Effect.succeed({
                _tag: 'Error' as const,
                message: error.message
              })
            ),
            Match.orElse(() =>
              Effect.succeed({
                _tag: 'Error' as const,
                message: 'Failed to delete category'
              })
            )
          ),
        onSuccess: result =>
          Effect.sync(() => {
            revalidatePath('/categories');
            return { _tag: 'Success' as const, ...result };
          })
      })
    )
  );
};
