'use server';

import { Effect, Match } from 'effect';
import { AppLayer } from '@/lib/layers';
import { NextEffect } from '@/lib/next-effect';
import { getSession } from '@/lib/services/auth/get-session';
import { suggestCategories, type CategorySuggestion } from './suggest-categories';

type Transaction = {
  id: string;
  merchant: string;
  amount: number;
};

type Category = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
};

type SuggestCategoriesResult =
  | { _tag: 'Success'; suggestions: CategorySuggestion[] }
  | { _tag: 'Error'; message: string };

/**
 * Server action to get AI-suggested categories for transactions.
 */
export const suggestCategoriesAction = async (
  transactions: Transaction[],
  categories: Category[]
): Promise<SuggestCategoriesResult> => {
  return await NextEffect.runPromise(
    Effect.gen(function* () {
      yield* getSession();

      const suggestions = yield* suggestCategories(transactions, categories);

      return { _tag: 'Success' as const, suggestions };
    }).pipe(
      Effect.withSpan('action.transaction.suggestCategories'),
      Effect.provide(AppLayer),
      Effect.scoped,
      Effect.matchEffect({
        onFailure: error =>
          Match.value(error._tag).pipe(
            Match.when('UnauthenticatedError', () => NextEffect.redirect('/login')),
            Match.orElse(() =>
              Effect.succeed({
                _tag: 'Error' as const,
                message: 'Failed to get category suggestions'
              })
            )
          ),
        onSuccess: Effect.succeed
      })
    )
  );
};
