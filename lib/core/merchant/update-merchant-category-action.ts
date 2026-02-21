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

const UpdateMerchantCategoryInput = S.Struct({
  merchantPattern: S.String.pipe(S.minLength(1)),
  categoryId: S.NullOr(S.String.pipe(S.minLength(1)))
});

type UpdateMerchantCategoryInput = S.Schema.Type<typeof UpdateMerchantCategoryInput>;

/**
 * Update the category for a merchant mapping.
 * Setting categoryId to null removes the category assignment.
 */
export const updateMerchantCategoryAction = async (input: UpdateMerchantCategoryInput) => {
  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const parsed = yield* S.decodeUnknown(UpdateMerchantCategoryInput)(input).pipe(
        Effect.mapError(
          () =>
            new ValidationError({
              message: 'Invalid input: merchantPattern is required',
              field: 'input'
            })
        )
      );

      yield* getSession();
      const db = yield* Db;

      yield* Effect.annotateCurrentSpan({
        'merchant.pattern': parsed.merchantPattern,
        'category.id': parsed.categoryId ?? 'null'
      });

      // Verify merchant mapping exists
      const [existing] = yield* db
        .select({ id: schema.merchantMapping.id })
        .from(schema.merchantMapping)
        .where(eq(schema.merchantMapping.merchantPattern, parsed.merchantPattern))
        .limit(1);

      if (!existing) {
        return yield* new NotFoundError({
          message: 'Merchant mapping not found',
          entity: 'merchantMapping',
          id: parsed.merchantPattern
        });
      }

      // Verify category exists if provided
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

      // Update merchant mapping
      yield* db
        .update(schema.merchantMapping)
        .set({ categoryId: parsed.categoryId })
        .where(eq(schema.merchantMapping.merchantPattern, parsed.merchantPattern));

      return {
        merchantPattern: parsed.merchantPattern,
        categoryId: parsed.categoryId
      };
    }).pipe(
      Effect.withSpan('action.merchant.updateCategory', {
        attributes: {
          'merchant.pattern': input.merchantPattern,
          'category.id': input.categoryId ?? 'null',
          operation: 'merchant.updateCategory'
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
                message: 'Failed to update merchant category'
              })
            )
          ),
        onSuccess: result =>
          Effect.sync(() => {
            revalidatePath('/merchants');
            revalidatePath('/categories');
            return { _tag: 'Success' as const, ...result };
          })
      })
    )
  );
};
