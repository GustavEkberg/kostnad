'use client';

import Link from 'next/link';
import { ArrowLeft, Calendar, Store, TrendingDown, Hash, Receipt, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CategoryTrendChart } from '@/components/charts/category-trend-chart';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useDateRangeFilter } from '@/lib/hooks/use-date-range-filter';
import { cn } from '@/lib/utils';
import type {
  CategoryDetail as CategoryDetailType,
  CategoryStats,
  CategoryTopMerchant,
  SingleCategoryPeriodTrend
} from '@/lib/core/transaction/queries';

type Transaction = {
  id: string;
  date: Date;
  merchant: string;
  amount: number;
  balance: number | null;
};

type PaginatedTransactions = {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type MerchantMapping = {
  id: string;
  merchantPattern: string;
  isMultiMerchant: boolean;
};

type Props = {
  category: CategoryDetailType;
  stats: CategoryStats;
  topMerchants: CategoryTopMerchant[];
  trends: SingleCategoryPeriodTrend[];
  recentTransactions: PaginatedTransactions;
  merchantMappings: MerchantMapping[];
  currentParams: {
    from: Date | null;
    to: Date | null;
  };
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

export function CategoryDetail({
  category,
  stats,
  topMerchants,
  trends,
  recentTransactions,
  merchantMappings,
  currentParams
}: Props) {
  const { dateRange, setDateRange, clearDateRange, hasDateFilter } =
    useDateRangeFilter(currentParams);

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Link
              href="/categories"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
            >
              <ArrowLeft className="size-4" />
              Back to categories
            </Link>
            <div className="flex items-center gap-3">
              {category.icon && <span className="text-3xl">{category.icon}</span>}
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{category.name}</h1>
                {category.description && (
                  <p className="text-muted-foreground mt-0.5">{category.description}</p>
                )}
              </div>
              {category.isDefault && (
                <Badge variant="secondary" className="ml-2">
                  Default
                </Badge>
              )}
            </div>
          </div>

          {/* Date Range Picker */}
          <div className="flex items-center gap-2">
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              placeholder="Filter by date"
              className="w-[280px]"
            />
            {hasDateFilter && (
              <Button variant="ghost" size="icon-sm" onClick={clearDateRange} title="Clear filter">
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingDown className="size-4" />
                Monthly Avg
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
                {formatCurrency(
                  (() => {
                    const monthsWithData = trends.filter(t => t.expenses > 0);
                    if (monthsWithData.length === 0) return 0;
                    return (
                      monthsWithData.reduce((sum, t) => sum + t.expenses, 0) / monthsWithData.length
                    );
                  })()
                )}
              </p>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingDown className="size-4" />
                Total Expenses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
                {formatCurrency(stats.totalExpenses)}
              </p>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Hash className="size-4" />
                Transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{stats.transactionCount}</p>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Receipt className="size-4" />
                Avg Transaction
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatCurrency(stats.avgTransaction)}</p>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Store className="size-4" />
                Unique Merchants
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{stats.merchantCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        {stats.firstTransaction && stats.lastTransaction && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Calendar className="size-4" />
            <span>
              {formatDate(stats.firstTransaction)} - {formatDate(stats.lastTransaction)}
            </span>
          </div>
        )}

        {/* Spending Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Spending Trends</CardTitle>
            <CardDescription>
              {hasDateFilter
                ? `${trends.length} month${trends.length !== 1 ? 's' : ''}`
                : 'Last 12 months'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trends.every(t => t.expenses === 0) ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                No expense data available
              </p>
            ) : (
              <CategoryTrendChart data={trends} height={250} />
            )}
          </CardContent>
        </Card>

        {/* Two Column Layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Merchants */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="size-5" />
                Top Merchants
              </CardTitle>
              <CardDescription>By total spending</CardDescription>
            </CardHeader>
            <CardContent>
              {topMerchants.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  No merchant data available
                </p>
              ) : (
                <div className="space-y-3">
                  {topMerchants.map((merchant, index) => {
                    const maxTotal = topMerchants[0].total;
                    const widthPercent = merchant.total / maxTotal;

                    return (
                      <div key={merchant.merchant} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-5 text-right text-xs">
                              {index + 1}.
                            </span>
                            <span className="truncate">{merchant.merchant}</span>
                          </div>
                          <span className="shrink-0 font-medium">
                            {formatCurrency(merchant.total)}
                          </span>
                        </div>
                        <div className="ml-7">
                          <div className="bg-muted h-1.5 w-full rounded-full">
                            <div
                              className="h-1.5 rounded-full bg-red-500 transition-all dark:bg-red-400"
                              style={{ width: `${widthPercent * 100}%` }}
                            />
                          </div>
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {merchant.transactionCount} transaction
                            {merchant.transactionCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Merchant Mappings */}
          <Card>
            <CardHeader>
              <CardTitle>Merchant Mappings</CardTitle>
              <CardDescription>Patterns that auto-categorize to this category</CardDescription>
            </CardHeader>
            <CardContent>
              {merchantMappings.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  No merchant mappings configured
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {merchantMappings.map(mapping => (
                    <Badge
                      key={mapping.id}
                      variant={mapping.isMultiMerchant ? 'outline' : 'secondary'}
                      className="font-normal"
                    >
                      {mapping.merchantPattern}
                      {mapping.isMultiMerchant && (
                        <span className="text-muted-foreground ml-1 text-xs">(multi)</span>
                      )}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>
                  Showing {recentTransactions.items.length} of {recentTransactions.total}
                </CardDescription>
              </div>
              {recentTransactions.total > 10 && (
                <Link
                  href={`/transactions?category=${category.id}`}
                  className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
                >
                  View all
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {recentTransactions.items.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                No transactions in this category
              </p>
            ) : (
              <div className="space-y-2">
                {recentTransactions.items.map(tx => (
                  <div
                    key={tx.id}
                    className="border-border flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{tx.merchant}</p>
                      <p className="text-muted-foreground text-sm">{formatDate(tx.date)}</p>
                    </div>
                    <p
                      className={cn(
                        'shrink-0 font-semibold',
                        tx.amount < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      )}
                    >
                      {formatCurrency(Math.abs(tx.amount))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
