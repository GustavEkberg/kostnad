import { Suspense } from 'react';
import type { SearchParams } from 'nuqs/server';
import { Effect } from 'effect';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { NextEffect } from '@/lib/next-effect';
import { AppLayer } from '@/lib/layers';
import { getTransactions, getAllCategories } from '@/lib/core/transaction/queries';
import { loadSearchParams, parseDate } from './search-params';
import { TransactionList } from './transaction-list';
import { LoadingFallback } from '../loading-fallback';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<SearchParams>;
};

async function Content({ searchParams }: Props) {
  await cookies();
  const params = await loadSearchParams(searchParams);

  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const filter = {
        categoryId: params.category,
        search: params.search,
        startDate: parseDate(params.startDate),
        endDate: parseDate(params.endDate)
      };

      const pageSize = parseInt(params.pageSize, 10);
      const [transactionsResult, categories] = yield* Effect.all([
        getTransactions(filter, params.page, pageSize),
        getAllCategories()
      ]);

      return (
        <main className="min-h-screen p-4 sm:p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
                <p className="text-muted-foreground mt-1">
                  {transactionsResult.total} transaction
                  {transactionsResult.total !== 1 ? 's' : ''}
                  {filter.search && ` matching "${filter.search}"`}
                </p>
              </div>
              <Link href="/transactions/new">
                <Button>
                  <Plus className="size-4" />
                  New
                </Button>
              </Link>
            </div>

            <TransactionList
              transactions={transactionsResult.items}
              categories={categories}
              total={transactionsResult.total}
              page={transactionsResult.page}
              totalPages={transactionsResult.totalPages}
              currentFilter={{
                category: params.category,
                search: params.search,
                startDate: params.startDate,
                endDate: params.endDate
              }}
            />
          </div>
        </main>
      );
    }).pipe(Effect.provide(AppLayer), Effect.scoped)
  );
}

export default async function TransactionsPage({ searchParams }: Props) {
  const params = await loadSearchParams(searchParams);
  const key = `${params.category}-${params.search}-${params.startDate}-${params.endDate}-${params.page}-${params.pageSize}`;

  return (
    <Suspense key={key} fallback={<LoadingFallback />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
