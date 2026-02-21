import { Suspense } from 'react';
import type { SearchParams } from 'nuqs/server';
import { Effect } from 'effect';
import { cookies } from 'next/headers';
import { NextEffect } from '@/lib/next-effect';
import { AppLayer } from '@/lib/layers';
import {
  getTransactionSummary,
  getTransactionsWithCategory,
  findMerchantMappingId,
  getAvailableMonths,
  getAllCategories,
  getTotalIncome,
  getTotalExpenses
} from '@/lib/core/transaction/queries';
import {
  loadSearchParams,
  getDateRange,
  getPreviousPeriodRange,
  getYearAgoRange
} from './search-params';
import { DashboardContent } from './dashboard-content';
import { LoadingFallback } from './loading-fallback';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<SearchParams>;
};

// Build category trends map from current vs previous period
function buildCategoryTrends(
  current: Array<{ categoryId: string | null; total: number }>,
  previous: Array<{ categoryId: string | null; total: number }>
): Map<string | null, { change: number; percentChange: number | null }> {
  const trends = new Map<string | null, { change: number; percentChange: number | null }>();
  const prevMap = new Map(previous.map(c => [c.categoryId, c.total]));

  for (const cat of current) {
    const prevTotal = prevMap.get(cat.categoryId) ?? 0;
    const change = Math.abs(cat.total) - Math.abs(prevTotal);
    const percentChange = prevTotal !== 0 ? (change / Math.abs(prevTotal)) * 100 : null;
    trends.set(cat.categoryId, { change, percentChange });
  }

  return trends;
}

function getMonthProgress(dateRange: { startDate: Date; endDate: Date }): {
  daysElapsed: number;
  daysTotal: number;
  percentComplete: number;
} {
  const now = new Date();
  const start = dateRange.startDate;
  const end = dateRange.endDate;

  // If viewing a past month, it's 100% complete
  if (now >= end) {
    const daysTotal = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return { daysElapsed: daysTotal, daysTotal, percentComplete: 100 };
  }

  // If viewing a future month, 0% complete
  if (now < start) {
    const daysTotal = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return { daysElapsed: 0, daysTotal, percentComplete: 0 };
  }

  const daysTotal = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const percentComplete = Math.round((daysElapsed / daysTotal) * 100);

  return { daysElapsed, daysTotal, percentComplete };
}

async function Content({ searchParams }: Props) {
  await cookies();
  const { period } = await loadSearchParams(searchParams);

  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const dateRange = getDateRange('month', period);
      const prevRange = getPreviousPeriodRange('month', period);
      const yearAgoRange = getYearAgoRange('month', period);

      // Fetch current + comparison data in parallel
      const [
        categorySummary,
        prevCategorySummary,
        yearAgoCategorySummary,
        transactions,
        availableMonths,
        categories,
        currentIncome,
        currentExpenses,
        prevIncome,
        prevExpenses,
        yearAgoIncome,
        yearAgoExpenses
      ] = yield* Effect.all([
        getTransactionSummary(dateRange),
        getTransactionSummary(prevRange),
        getTransactionSummary(yearAgoRange),
        getTransactionsWithCategory(dateRange),
        getAvailableMonths(),
        getAllCategories(),
        getTotalIncome(dateRange),
        getTotalExpenses(dateRange),
        getTotalIncome(prevRange),
        getTotalExpenses(prevRange),
        getTotalIncome(yearAgoRange),
        getTotalExpenses(yearAgoRange)
      ]);

      // Build category trends
      const categoryTrends = buildCategoryTrends(categorySummary, prevCategorySummary);

      // Find highest merchant and look up its mapping ID
      const expenseTransactions = transactions.filter(t => Number(t.amount) < 0);
      const merchantTotals = new Map<string, number>();
      for (const t of expenseTransactions) {
        const current = merchantTotals.get(t.merchant) ?? 0;
        merchantTotals.set(t.merchant, current + Math.abs(Number(t.amount)));
      }
      let highestMerchantName: string | null = null;
      let highestTotal = 0;
      for (const [merchant, total] of merchantTotals) {
        if (total > highestTotal) {
          highestMerchantName = merchant;
          highestTotal = total;
        }
      }
      const highestMerchantId = highestMerchantName
        ? yield* findMerchantMappingId(highestMerchantName)
        : null;

      // Month progress
      const progress = getMonthProgress(dateRange);

      // Format labels with year for clarity
      const currentYear = dateRange.startDate.getFullYear();
      const prevYear = prevRange.startDate.getFullYear();

      // Include year in prev month label if it's a different year
      const prevMonthLabel =
        prevYear !== currentYear
          ? new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(
              prevRange.startDate
            )
          : new Intl.DateTimeFormat('en-US', { month: 'short' }).format(prevRange.startDate);

      // Always include year for year-ago label
      const yearAgoLabel = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        year: '2-digit'
      }).format(yearAgoRange.startDate);

      // Current period short label for chart legend
      const currentLabel = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(
        dateRange.startDate
      );

      // Convert Map to array for serialization
      const categoryTrendsArray = Array.from(categoryTrends.entries()).map(([key, value]) => ({
        categoryId: key,
        ...value
      }));

      return (
        <DashboardContent
          period={period}
          dateRangeLabel={dateRange.label}
          currentLabel={currentLabel}
          availableMonths={availableMonths}
          progress={progress}
          prevMonthLabel={prevMonthLabel}
          yearAgoLabel={yearAgoLabel}
          categorySummary={categorySummary}
          prevCategorySummary={prevCategorySummary}
          yearAgoCategorySummary={yearAgoCategorySummary}
          categoryTrends={categoryTrendsArray}
          transactions={transactions}
          highestMerchantId={highestMerchantId}
          categories={categories.map(c => ({ id: c.id, name: c.name, icon: c.icon }))}
          totals={{
            current: { income: currentIncome, expenses: currentExpenses },
            prev: { income: prevIncome, expenses: prevExpenses },
            yearAgo: { income: yearAgoIncome, expenses: yearAgoExpenses }
          }}
        />
      );
    }).pipe(Effect.provide(AppLayer), Effect.scoped)
  );
}

export default async function DashboardPage({ searchParams }: Props) {
  const { period } = await loadSearchParams(searchParams);
  return (
    <Suspense key={`month-${period ?? 'current'}`} fallback={<LoadingFallback />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
