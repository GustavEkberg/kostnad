import { Suspense } from 'react';
import type { SearchParams } from 'nuqs/server';
import { Effect } from 'effect';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { NextEffect } from '@/lib/next-effect';
import { AppLayer } from '@/lib/layers';
import {
  getCategoryById,
  getCategoryStats,
  getCategoryTopMerchants,
  getSingleCategoryPeriodTrends,
  getCategoryTransactions,
  getCategoryMerchantMappings
} from '@/lib/core/transaction/queries';
import { loadSearchParams } from './search-params';
import { CategoryDetail } from './category-detail';
import { LoadingFallback } from '../../loading-fallback';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};

async function Content({ params, searchParams }: Props) {
  await cookies();
  const { id } = await params;
  const urlParams = await loadSearchParams(searchParams);

  const result = await NextEffect.runPromise(
    Effect.gen(function* () {
      const category = yield* getCategoryById(id);

      if (!category) {
        return null;
      }

      // Build date range if provided
      // endDate is set to start of next day to include all transactions on the selected end date
      const dateRange =
        urlParams.from && urlParams.to
          ? {
              startDate: urlParams.from,
              endDate: new Date(
                urlParams.to.getFullYear(),
                urlParams.to.getMonth(),
                urlParams.to.getDate() + 1
              )
            }
          : undefined;

      // Fetch all data in parallel
      const [stats, topMerchants, trends, recentTransactions, merchantMappings] = yield* Effect.all(
        [
          getCategoryStats(id, dateRange),
          getCategoryTopMerchants(id, 10, dateRange),
          getSingleCategoryPeriodTrends(id, 'month', 12, null, dateRange),
          getCategoryTransactions(id, 1, 10, dateRange),
          getCategoryMerchantMappings(id)
        ]
      );

      return { category, stats, topMerchants, trends, recentTransactions, merchantMappings };
    }).pipe(Effect.provide(AppLayer), Effect.scoped)
  );

  if (!result) {
    notFound();
  }

  return (
    <CategoryDetail
      category={result.category}
      stats={result.stats}
      topMerchants={result.topMerchants}
      trends={result.trends}
      recentTransactions={result.recentTransactions}
      merchantMappings={result.merchantMappings}
      currentParams={{
        from: urlParams.from,
        to: urlParams.to
      }}
    />
  );
}

export default async function CategoryDetailPage({ params, searchParams }: Props) {
  const urlParams = await loadSearchParams(searchParams);
  const { id } = await params;
  const key = `${id}-${urlParams.from?.toISOString()}-${urlParams.to?.toISOString()}`;

  return (
    <Suspense key={key} fallback={<LoadingFallback />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}
