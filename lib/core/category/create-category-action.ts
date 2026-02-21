'use server';

import { Effect, Match, Schema as S } from 'effect';
import { revalidatePath } from 'next/cache';
import { AppLayer } from '@/lib/layers';
import { NextEffect } from '@/lib/next-effect';
import { getSession } from '@/lib/services/auth/get-session';
import { Db } from '@/lib/services/db/live-layer';
import * as schema from '@/lib/services/db/schema';
import { ValidationError } from '@/lib/core/errors';

const CreateCategoryInput = S.Struct({
  name: S.String.pipe(S.minLength(1), S.maxLength(100)),
  description: S.optional(S.String.pipe(S.maxLength(200))),
  icon: S.optional(S.String.pipe(S.maxLength(10)))
});

type CreateCategoryInput = S.Schema.Type<typeof CreateCategoryInput>;

/**
 * Server action to create a new category.
 */
export const createCategoryAction = async (input: CreateCategoryInput) => {
  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const parsed = yield* S.decodeUnknown(CreateCategoryInput)(input).pipe(
        Effect.mapError(
          () =>
            new ValidationError({
              message: 'Category name is required (1-100 chars)',
              field: 'name'
            })
        )
      );

      yield* getSession();
      const db = yield* Db;

      yield* Effect.annotateCurrentSpan({
        'category.name': parsed.name
      });

      const [category] = yield* db
        .insert(schema.category)
        .values({
          name: parsed.name,
          description: parsed.description,
          icon: parsed.icon,
          isDefault: false
        })
        .returning();

      return category;
    }).pipe(
      Effect.withSpan('action.category.create', {
        attributes: {
          'category.name': input.name,
          operation: 'category.create'
        }
      }),
      Effect.provide(AppLayer),
      Effect.scoped,
      Effect.matchEffect({
        onFailure: error =>
          Match.value(error._tag).pipe(
            Match.when('UnauthenticatedError', () => NextEffect.redirect('/login')),
            Match.when('ValidationError', () =>
              Effect.succeed({
                _tag: 'Error' as const,
                message: error.message
              })
            ),
            Match.orElse(() =>
              Effect.succeed({
                _tag: 'Error' as const,
                message: 'Failed to create category'
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
