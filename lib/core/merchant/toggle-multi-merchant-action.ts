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

const ToggleMultiMerchantInput = S.Struct({
  merchantPattern: S.String.pipe(S.minLength(1)),
  isMultiMerchant: S.Boolean
});

type ToggleMultiMerchantInput = S.Schema.Type<typeof ToggleMultiMerchantInput>;

/**
 * Toggle the multi-merchant flag for a merchant mapping.
 *
 * When marking as multi-merchant:
 * - Sets isMultiMerchant=true and clears categoryId
 * - Future transactions require manual review
 *
 * When unmarking:
 * - Sets isMultiMerchant=false
 * - Allows normal auto-categorization
 */
export const toggleMultiMerchantAction = async (input: ToggleMultiMerchantInput) => {
  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const parsed = yield* S.decodeUnknown(ToggleMultiMerchantInput)(input).pipe(
        Effect.mapError(
          () =>
            new ValidationError({
              message: 'Invalid input',
              field: 'input'
            })
        )
      );

      yield* getSession();
      const db = yield* Db;

      yield* Effect.annotateCurrentSpan({
        'merchant.pattern': parsed.merchantPattern,
        'merchant.isMultiMerchant': parsed.isMultiMerchant
      });

      // Check if mapping exists
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

      // Update the mapping
      if (parsed.isMultiMerchant) {
        // Mark as multi: clear category and set flag
        yield* db
          .update(schema.merchantMapping)
          .set({ isMultiMerchant: true, categoryId: null })
          .where(eq(schema.merchantMapping.merchantPattern, parsed.merchantPattern));
      } else {
        // Unmark: just clear the flag
        yield* db
          .update(schema.merchantMapping)
          .set({ isMultiMerchant: false })
          .where(eq(schema.merchantMapping.merchantPattern, parsed.merchantPattern));
      }

      return {
        merchantPattern: parsed.merchantPattern,
        isMultiMerchant: parsed.isMultiMerchant
      };
    }).pipe(
      Effect.withSpan('action.merchant.toggleMulti', {
        attributes: {
          'merchant.pattern': input.merchantPattern,
          'merchant.isMultiMerchant': input.isMultiMerchant,
          operation: 'merchant.toggleMulti'
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
                message: 'Failed to toggle multi-merchant status'
              })
            )
          ),
        onSuccess: result =>
          Effect.sync(() => {
            revalidatePath('/merchants');
            revalidatePath('/review');
            return { _tag: 'Success' as const, ...result };
          })
      })
    )
  );
};
