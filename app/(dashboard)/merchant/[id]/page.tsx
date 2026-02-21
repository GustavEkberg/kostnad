import { Suspense } from 'react';
import type { SearchParams } from 'nuqs/server';
import { Effect } from 'effect';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { NextEffect } from '@/lib/next-effect';
import { AppLayer } from '@/lib/layers';
import {
  getMerchantById,
  getMerchantStats,
  getMerchantTransactions,
  getMerchantPeriodTrends,
  getAllCategories
} from '@/lib/core/transaction/queries';
import { loadSearchParams } from './search-params';
import { MerchantDetail } from './merchant-detail';

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
      const merchant = yield* getMerchantById(id);

      if (!merchant) {
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

      const [stats, transactions, trends, categories] = yield* Effect.all([
        getMerchantStats(merchant.merchantPattern, dateRange),
        getMerchantTransactions(merchant.merchantPattern, dateRange ?? null, urlParams.page, 20),
        getMerchantPeriodTrends(merchant.merchantPattern, urlParams.timeframe, 12, null, dateRange),
        getAllCategories()
      ]);

      return { merchant, stats, transactions, trends, categories };
    }).pipe(Effect.provide(AppLayer), Effect.scoped)
  );

  if (!result) {
    notFound();
  }

  return (
    <MerchantDetail
      merchant={result.merchant}
      stats={result.stats}
      transactions={result.transactions}
      trends={result.trends}
      categories={result.categories}
      currentParams={urlParams}
    />
  );
}

export default async function MerchantPage({ params, searchParams }: Props) {
  const urlParams = await loadSearchParams(searchParams);
  const { id } = await params;
  const key = `${id}-${urlParams.timeframe}-${urlParams.page}-${urlParams.from?.toISOString()}-${urlParams.to?.toISOString()}`;

  return (
    <Suspense
      key={key}
      fallback={
        <div className="min-h-screen p-4 sm:p-8">
          <div className="mx-auto max-w-6xl">Loading merchant...</div>
        </div>
      }
    >
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}
