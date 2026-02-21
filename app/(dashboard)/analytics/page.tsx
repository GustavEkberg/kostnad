import { Suspense } from 'react';
import type { SearchParams } from 'nuqs/server';
import { Effect } from 'effect';
import { cookies } from 'next/headers';
import { NextEffect } from '@/lib/next-effect';
import { AppLayer } from '@/lib/layers';
import {
  getTransactionSummary,
  getPeriodTrends,
  getCategoryPeriodTrends,
  getTransactionsWithCategory,
  findMerchantMappingId,
  getTopMerchants
} from '@/lib/core/transaction/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryPieChart } from '@/components/charts/category-pie-chart';
import { CategoryLineChart } from '@/components/charts/category-line-chart';
import { TrendLineChart } from '@/components/charts/trend-line-chart';
import { PeriodBarChart } from '@/components/charts/period-bar-chart';
import { TopMerchantsChart } from '@/components/charts/top-merchants-chart';
import { loadSearchParams, getDateRange } from '../search-params';
import { TimeframeSelector } from '../timeframe-selector';
import { ExpenseHighlights } from '@/components/expense-highlights';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<SearchParams>;
};

async function Content({ searchParams }: Props) {
  await cookies();
  const { timeframe, period } = await loadSearchParams(searchParams);

  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const dateRange = getDateRange(timeframe, period);

      // Fetch all analytics data in parallel
      const [categorySummary, periodTrends, categoryTrends, transactions, topMerchants] =
        yield* Effect.all([
          getTransactionSummary(dateRange),
          getPeriodTrends(timeframe, 12, period), // Last 12 periods ending at selected
          getCategoryPeriodTrends(timeframe, 6, period), // Last 6 periods ending at selected
          getTransactionsWithCategory(dateRange),
          getTopMerchants(dateRange, 10) // Top 10 merchants
        ]);

      // Dynamic labels based on timeframe
      const periodLabel =
        timeframe === 'week' ? 'Weekly' : timeframe === 'month' ? 'Monthly' : 'Yearly';

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

      return (
        <main className="min-h-screen p-4 sm:p-8">
          <div className="mx-auto max-w-6xl space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
                <p className="text-muted-foreground mt-1">{dateRange.label}</p>
              </div>
              <TimeframeSelector timeframe={timeframe} period={period} />
            </div>

            {/* Income vs Expenses Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Income vs Expenses Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendLineChart data={periodTrends} height={350} showNet={true} />
              </CardContent>
            </Card>

            {/* Two-column grid for category charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Category Breakdown Pie */}
              <Card>
                <CardHeader>
                  <CardTitle>Expense Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <CategoryPieChart data={categorySummary} height={350} title="" />
                </CardContent>
              </Card>

              {/* Period Comparison Bar + Expense Highlights */}
              <div className="flex flex-col gap-6">
                <ExpenseHighlights transactions={transactions} merchantId={highestMerchantId} />
                <Card className="flex-1">
                  <CardHeader>
                    <CardTitle>{periodLabel} Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PeriodBarChart data={periodTrends} height={220} />
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Category Trends Line */}
            <Card>
              <CardHeader>
                <CardTitle>Spending by Category Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryLineChart data={categoryTrends} height={400} />
              </CardContent>
            </Card>

            {/* Top Merchants */}
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Merchants</CardTitle>
              </CardHeader>
              <CardContent>
                <TopMerchantsChart data={topMerchants} height={400} />
              </CardContent>
            </Card>
          </div>
        </main>
      );
    }).pipe(Effect.provide(AppLayer), Effect.scoped)
  );
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const { timeframe, period } = await loadSearchParams(searchParams);
  return (
    <Suspense
      key={`analytics-${timeframe}-${period ?? 'current'}`}
      fallback={
        <div className="min-h-screen p-4 sm:p-8">
          <div className="mx-auto max-w-6xl">
            <div className="animate-pulse space-y-8">
              <div className="bg-muted h-8 w-48 rounded" />
              <div className="bg-muted h-96 rounded-xl" />
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="bg-muted h-80 rounded-xl" />
                <div className="bg-muted h-80 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
