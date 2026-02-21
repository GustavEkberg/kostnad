import { Suspense } from 'react';
import type { SearchParams } from 'nuqs/server';
import { Effect } from 'effect';
import { cookies } from 'next/headers';
import { NextEffect } from '@/lib/next-effect';
import { AppLayer } from '@/lib/layers';
import { getMerchantsWithTotals, getAllCategories } from '@/lib/core/transaction/queries';
import { getDateRange } from '../search-params';
import { loadSearchParams } from './search-params';
import { MerchantList } from './merchant-list';
import { LoadingFallback } from '../loading-fallback';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<SearchParams>;
};

async function Content({ searchParams }: Props) {
  await cookies();
  const params = await loadSearchParams(searchParams);
  const { startDate, endDate, label } = getDateRange(params.timeframe, params.period);

  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const [merchants, categories] = yield* Effect.all([
        getMerchantsWithTotals({ startDate, endDate }),
        getAllCategories()
      ]);

      // Filter by search if provided
      const filtered = params.search
        ? merchants.filter(m =>
            m.merchantPattern.toLowerCase().includes(params.search!.toLowerCase())
          )
        : merchants;

      const totalExpenses = filtered.reduce((sum, m) => sum + m.totalExpenses, 0);

      return (
        <main className="min-h-screen p-4 sm:p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Merchants</h1>
              <p className="text-muted-foreground mt-1">
                {filtered.length} merchant{filtered.length !== 1 ? 's' : ''} in {label}
                {params.search && ` matching "${params.search}"`}
              </p>
            </div>

            <MerchantList
              merchants={filtered}
              categories={categories}
              totalExpenses={totalExpenses}
              periodLabel={label}
              currentParams={{
                timeframe: params.timeframe,
                period: params.period,
                search: params.search
              }}
            />
          </div>
        </main>
      );
    }).pipe(Effect.provide(AppLayer), Effect.scoped)
  );
}

export default async function MerchantsPage({ searchParams }: Props) {
  const params = await loadSearchParams(searchParams);
  const key = `${params.timeframe}-${params.period}-${params.search}`;

  return (
    <Suspense key={key} fallback={<LoadingFallback />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
