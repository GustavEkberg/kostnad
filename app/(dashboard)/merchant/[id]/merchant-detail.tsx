'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useQueryState, parseAsInteger, parseAsStringLiteral } from 'nuqs';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Calendar,
  TrendingDown,
  Hash,
  Receipt,
  Loader2,
  Layers,
  Store,
  X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Pagination, usePageSize } from '@/components/ui/pagination';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useDateRangeFilter } from '@/lib/hooks/use-date-range-filter';
import { updateMerchantCategoryAction } from '@/lib/core/merchant/update-merchant-category-action';
import { toggleMultiMerchantAction } from '@/lib/core/merchant/toggle-multi-merchant-action';
import { MerchantExpenseChart } from './merchant-expense-chart';
import type {
  MerchantDetail as MerchantDetailType,
  MerchantStats,
  MerchantPeriodTrend
} from '@/lib/core/transaction/queries';
import { timeframeValues, type Timeframe } from './search-params';

type Transaction = {
  id: string;
  date: Date;
  merchant: string;
  amount: number;
  categoryId: string | null;
  categoryName: string | null;
};

type PaginatedTransactions = {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type Category = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  isDefault: boolean;
};

type Props = {
  merchant: MerchantDetailType;
  stats: MerchantStats;
  transactions: PaginatedTransactions;
  trends: MerchantPeriodTrend[];
  categories: Category[];
  currentParams: {
    timeframe: Timeframe;
    page: number;
    from: Date | null;
    to: Date | null;
  };
};

export function MerchantDetail({
  merchant: initialMerchant,
  stats,
  transactions,
  trends,
  categories,
  currentParams
}: Props) {
  const [merchant, setMerchant] = useState(initialMerchant);
  const [isPending, startTransition] = useTransition();

  const [pageSizeHydrated, pageSize, setPageSize] = usePageSize('merchant-transactions');

  const [timeframe, setTimeframe] = useQueryState(
    'timeframe',
    parseAsStringLiteral(timeframeValues).withDefault('month').withOptions({
      shallow: false,
      history: 'push'
    })
  );

  const [page, setPage] = useQueryState(
    'page',
    parseAsInteger.withDefault(1).withOptions({
      shallow: false,
      history: 'push'
    })
  );

  const { dateRange, setDateRange, clearDateRange, hasDateFilter } = useDateRangeFilter({
    from: currentParams.from,
    to: currentParams.to
  });

  const currentTimeframe = timeframe ?? currentParams.timeframe;
  const currentPage = page ?? currentParams.page;

  const handleCategoryChange = (categoryId: string | null) => {
    startTransition(async () => {
      const result = await updateMerchantCategoryAction({
        merchantPattern: merchant.merchantPattern,
        categoryId: categoryId === '__none__' ? null : categoryId
      });

      if (result._tag === 'Error') {
        toast.error(result.message);
        return;
      }

      setMerchant(prev => ({
        ...prev,
        categoryId: result.categoryId,
        categoryName: result.categoryId
          ? (categories.find(c => c.id === result.categoryId)?.name ?? null)
          : null,
        categoryIcon: result.categoryId
          ? (categories.find(c => c.id === result.categoryId)?.icon ?? null)
          : null
      }));

      const categoryName = result.categoryId
        ? (categories.find(c => c.id === result.categoryId)?.name ?? 'category')
        : 'none';
      toast.success(`Updated category to ${categoryName}`);
    });
  };

  const handleToggleMulti = () => {
    startTransition(async () => {
      const result = await toggleMultiMerchantAction({
        merchantPattern: merchant.merchantPattern,
        isMultiMerchant: !merchant.isMultiMerchant
      });

      if (result._tag === 'Error') {
        toast.error(result.message);
        return;
      }

      setMerchant(prev => ({
        ...prev,
        isMultiMerchant: result.isMultiMerchant,
        categoryId: result.isMultiMerchant ? null : prev.categoryId,
        categoryName: result.isMultiMerchant ? null : prev.categoryName,
        categoryIcon: result.isMultiMerchant ? null : prev.categoryIcon
      }));

      toast.success(
        result.isMultiMerchant ? 'Marked as multi-merchant' : 'Removed multi-merchant flag'
      );
    });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newSize: typeof pageSize) => {
    setPageSize(newSize);
    setPage(1);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Link
              href="/merchants"
              className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{merchant.merchantPattern}</h1>
              <p className="text-muted-foreground mt-1">
                {stats.transactionCount} transaction{stats.transactionCount !== 1 ? 's' : ''} total
              </p>
            </div>
          </div>

          {/* Date Range + Multi-merchant toggle + Category */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Range Picker */}
            <div className="flex items-center gap-2">
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                placeholder="Filter by date"
                className="w-[280px]"
              />
              {hasDateFilter && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={clearDateRange}
                  title="Clear filter"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleMulti}
              disabled={isPending}
              title={
                merchant.isMultiMerchant
                  ? 'Remove multi-merchant flag'
                  : 'Mark as multi-merchant (always requires review)'
              }
            >
              {merchant.isMultiMerchant ? (
                <Layers className="size-5 text-amber-600" />
              ) : (
                <Store className="size-5 text-muted-foreground" />
              )}
            </Button>

            {merchant.isMultiMerchant ? (
              <span className="text-muted-foreground text-sm italic">Requires manual review</span>
            ) : isPending ? (
              <div className="flex h-10 w-48 items-center justify-center">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : (
              <Select
                value={merchant.categoryId ?? '__none__'}
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger className="w-48">
                  <SelectValue>
                    {merchant.categoryId
                      ? merchant.categoryIcon
                        ? `${merchant.categoryIcon} ${merchant.categoryName}`
                        : merchant.categoryName
                      : 'No category'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-muted-foreground">
                    No category
                  </SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon ? `${cat.icon} ` : ''}
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
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

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingDown className="size-4" />
                Total Spent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
                {formatCurrency(stats.totalExpenses)}
              </p>
            </CardContent>
          </Card>

          <Card>
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

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Receipt className="size-4" />
                Avg Transaction
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
                {formatCurrency(stats.avgTransaction)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Calendar className="size-4" />
                Date Range
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                {stats.firstTransaction && stats.lastTransaction ? (
                  <>
                    {formatDate(stats.firstTransaction)}
                    <br />
                    <span className="text-muted-foreground">to </span>
                    {formatDate(stats.lastTransaction)}
                  </>
                ) : (
                  <span className="text-muted-foreground">No transactions</span>
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Spending Trend Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Spending Trend</CardTitle>
              <div className="bg-muted flex rounded-md p-0.5">
                {timeframeValues.map(tf => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`rounded-[5px] px-2.5 py-1 text-sm font-medium transition-colors ${
                      currentTimeframe === tf
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tf.charAt(0).toUpperCase() + tf.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <MerchantExpenseChart data={trends} height={300} />
          </CardContent>
        </Card>

        {/* Transaction List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transactions</CardTitle>
            <CardDescription>
              Showing {transactions.items.length} of {transactions.total} transactions
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* Header row - desktop */}
            <div className="text-muted-foreground hidden border-b px-4 py-2 text-xs font-medium uppercase tracking-wide sm:flex">
              <div className="w-28">Date</div>
              <div className="flex-1">Merchant</div>
              <div className="w-32 text-right">Amount</div>
            </div>

            {/* Transaction rows */}
            <div className="divide-y">
              {transactions.items.map(tx => (
                <div key={tx.id} className="p-4">
                  {/* Desktop layout */}
                  <div className="hidden items-center sm:flex">
                    <div className="text-muted-foreground w-28 text-sm">{formatDate(tx.date)}</div>
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-sm">{tx.merchant}</span>
                    </div>
                    <div
                      className={`w-32 text-right font-mono text-sm ${
                        tx.amount < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {formatCurrency(tx.amount)}
                    </div>
                  </div>

                  {/* Mobile layout */}
                  <div className="space-y-1 sm:hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">{formatDate(tx.date)}</span>
                      <span
                        className={`font-mono text-sm ${
                          tx.amount < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-green-600 dark:text-green-400'
                        }`}
                      >
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                    <p className="truncate text-sm">{tx.merchant}</p>
                  </div>
                </div>
              ))}

              {transactions.items.length === 0 && (
                <div className="text-muted-foreground py-12 text-center text-sm">
                  No transactions found
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        {pageSizeHydrated !== null && (
          <Pagination
            currentPage={currentPage}
            totalPages={transactions.totalPages}
            totalItems={transactions.total}
            pageSize={pageSize}
            hydrated={pageSizeHydrated !== null}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>
    </main>
  );
}
