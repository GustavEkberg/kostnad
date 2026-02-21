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

const UpdateCategoryInput = S.Struct({
  id: S.String.pipe(S.minLength(1)),
  name: S.String.pipe(S.minLength(1), S.maxLength(100))
});

type UpdateCategoryInput = S.Schema.Type<typeof UpdateCategoryInput>;

/**
 * Server action to update a category's name.
 */
export const updateCategoryAction = async (input: UpdateCategoryInput) => {
  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const parsed = yield* S.decodeUnknown(UpdateCategoryInput)(input).pipe(
        Effect.mapError(
          () =>
            new ValidationError({
              message: 'Category id and name are required',
              field: 'input'
            })
        )
      );

      yield* getSession();
      const db = yield* Db;

      yield* Effect.annotateCurrentSpan({
        'category.id': parsed.id,
        'category.name': parsed.name
      });

      // Verify category exists
      const [existing] = yield* db
        .select({ id: schema.category.id })
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

      const [category] = yield* db
        .update(schema.category)
        .set({ name: parsed.name })
        .where(eq(schema.category.id, parsed.id))
        .returning();

      return category;
    }).pipe(
      Effect.withSpan('action.category.update', {
        attributes: {
          'category.id': input.id,
          'category.name': input.name,
          operation: 'category.update'
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
                message: 'Failed to update category'
              })
            )
          ),
        onSuccess: category =>
          Effect.sync(() => {
            revalidatePath('/categories');
            return { _tag: 'Success' as const, category };
          })
      })
    )
  );
};
