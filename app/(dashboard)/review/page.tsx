import { Suspense } from 'react';
import { Effect } from 'effect';
import { cookies } from 'next/headers';
import { NextEffect } from '@/lib/next-effect';
import { AppLayer } from '@/lib/layers';
import {
  getUncategorizedTransactions,
  getAllCategories,
  getMultiMerchantPatterns
} from '@/lib/core/transaction/queries';
import { ReviewList } from './review-list';
import { LoadingFallback } from '../loading-fallback';

export const dynamic = 'force-dynamic';

async function Content() {
  await cookies();

  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const [transactions, categories, multiMerchantPatterns] = yield* Effect.all([
        getUncategorizedTransactions(),
        getAllCategories(),
        getMultiMerchantPatterns()
      ]);

      return (
        <main className="min-h-screen p-4 sm:p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Review Transactions</h1>
              <p className="text-muted-foreground mt-1">
                Assign categories to uncategorized transactions
              </p>
            </div>

            <ReviewList
              transactions={transactions}
              categories={categories}
              multiMerchantPatterns={multiMerchantPatterns}
            />
          </div>
        </main>
      );
    }).pipe(Effect.provide(AppLayer), Effect.scoped)
  );
}

export default async function ReviewPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Content />
    </Suspense>
  );
}
