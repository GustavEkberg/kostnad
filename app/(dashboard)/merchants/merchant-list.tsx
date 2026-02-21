'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useQueryState, parseAsString, parseAsStringLiteral } from 'nuqs';
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Store,
  X,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Pagination, usePageSize } from '@/components/ui/pagination';
import { updateMerchantCategoryAction } from '@/lib/core/merchant/update-merchant-category-action';
import { toggleMultiMerchantAction } from '@/lib/core/merchant/toggle-multi-merchant-action';
import { timeframeValues, type Timeframe } from './search-params';
import { getPeriodOffset, isCurrentPeriod } from '@/app/(dashboard)/search-params';
import type { MerchantWithTotal } from '@/lib/core/transaction/queries';

type Category = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  isDefault: boolean;
};

type Props = {
  merchants: MerchantWithTotal[];
  categories: Category[];
  totalExpenses: number;
  periodLabel: string;
  currentParams: {
    timeframe: Timeframe;
    period: string | null;
    search: string | null;
  };
};

type SortKey = 'name' | 'total' | 'count';
type SortDir = 'asc' | 'desc';

export function MerchantList({
  merchants: initialMerchants,
  categories,
  totalExpenses,
  periodLabel,
  currentParams
}: Props) {
  const [merchants, setMerchants] = useState(initialMerchants);
  const [pendingPattern, setPendingPattern] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Pagination state
  const [pageSizeHydrated, pageSize, setPageSize] = usePageSize('merchants');
  const [currentPage, setCurrentPage] = useState(1);

  // Local search state (only syncs to URL on submit)
  const [localSearch, setLocalSearch] = useState(currentParams.search ?? '');

  const [timeframe, setTimeframe] = useQueryState(
    'timeframe',
    parseAsStringLiteral(timeframeValues).withDefault('month').withOptions({
      shallow: false,
      history: 'push'
    })
  );

  const [period, setPeriod] = useQueryState(
    'period',
    parseAsString.withOptions({
      shallow: false,
      history: 'push'
    })
  );

  const [search, setSearch] = useQueryState(
    'search',
    parseAsString.withOptions({
      shallow: false,
      history: 'push'
    })
  );

  const currentTimeframe = timeframe ?? currentParams.timeframe;
  const currentPeriod = period ?? currentParams.period;

  const handleCategoryChange = (merchantPattern: string, categoryId: string | null) => {
    setPendingPattern(merchantPattern);

    startTransition(async () => {
      const result = await updateMerchantCategoryAction({
        merchantPattern,
        categoryId: categoryId === '__none__' ? null : categoryId
      });

      if (result._tag === 'Error') {
        toast.error(result.message);
        setPendingPattern(null);
        return;
      }

      // Update local state
      setMerchants(prev =>
        prev.map(m =>
          m.merchantPattern === merchantPattern
            ? {
                ...m,
                categoryId: result.categoryId,
                categoryName: result.categoryId
                  ? (categories.find(c => c.id === result.categoryId)?.name ?? null)
                  : null
              }
            : m
        )
      );

      setPendingPattern(null);
      const categoryName = result.categoryId
        ? (categories.find(c => c.id === result.categoryId)?.name ?? 'category')
        : 'none';
      toast.success(`Updated ${merchantPattern} to ${categoryName}`);
    });
  };

  const handleToggleMulti = (merchantPattern: string, isMultiMerchant: boolean) => {
    setPendingPattern(merchantPattern);

    startTransition(async () => {
      const result = await toggleMultiMerchantAction({ merchantPattern, isMultiMerchant });

      if (result._tag === 'Error') {
        toast.error(result.message);
        setPendingPattern(null);
        return;
      }

      // Update local state
      setMerchants(prev =>
        prev.map(m =>
          m.merchantPattern === merchantPattern
            ? {
                ...m,
                isMultiMerchant: result.isMultiMerchant,
                categoryId: result.isMultiMerchant ? null : m.categoryId,
                categoryName: result.isMultiMerchant ? null : m.categoryName
              }
            : m
        )
      );

      setPendingPattern(null);
      toast.success(
        result.isMultiMerchant
          ? `Marked ${merchantPattern} as multi-merchant`
          : `Removed multi-merchant from ${merchantPattern}`
      );
    });
  };

  const handleTimeframeChange = (newTimeframe: Timeframe) => {
    setTimeframe(newTimeframe);
    setPeriod(null);
  };

  const handlePeriodNav = (offset: number) => {
    const newPeriod = getPeriodOffset(currentTimeframe, currentPeriod, offset);
    setPeriod(newPeriod);
  };

  const handleSearchSubmit = () => {
    setSearch(localSearch || null);
  };

  const handleSearchClear = () => {
    setLocalSearch('');
    setSearch(null);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const sortedMerchants = useMemo(
    () =>
      [...merchants].sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'name') {
          cmp = a.merchantPattern.localeCompare(b.merchantPattern);
        } else if (sortKey === 'total') {
          cmp = a.totalExpenses - b.totalExpenses;
        } else {
          cmp = a.transactionCount - b.transactionCount;
        }
        return sortDir === 'asc' ? cmp : -cmp;
      }),
    [merchants, sortKey, sortDir]
  );

  const totalPages = Math.ceil(sortedMerchants.length / pageSize);

  const paginatedMerchants = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedMerchants.slice(start, start + pageSize);
  }, [sortedMerchants, currentPage, pageSize]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handlePageSizeChange = (newSize: typeof pageSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getSortIcon = (column: SortKey) => {
    if (sortKey !== column) return <ArrowUpDown className="size-3 opacity-50" />;
    return sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
  };

  const isCurrent = isCurrentPeriod(currentTimeframe, currentPeriod);

  // Don't render list until page size is hydrated from localStorage
  if (pageSizeHydrated === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Timeframe toggle + period nav */}
          <div className="flex items-center gap-2">
            {/* Timeframe toggle - same style as TimeframeSelector */}
            <div className="bg-muted flex rounded-md p-0.5">
              {timeframeValues.map(tf => (
                <button
                  key={tf}
                  onClick={() => handleTimeframeChange(tf)}
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

            {/* Period navigation */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handlePeriodNav(-1)}
                aria-label="Previous period"
              >
                <ChevronLeft className="size-4" />
              </Button>

              <span className="text-muted-foreground min-w-24 text-center text-sm">
                {periodLabel}
              </span>

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handlePeriodNav(1)}
                disabled={isCurrent}
                aria-label="Next period"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* Search - only submits on enter or blur */}
          <div className="relative w-full sm:w-64">
            <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
            <Input
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSearchSubmit();
              }}
              onBlur={handleSearchSubmit}
              placeholder="Search merchants..."
              className="pl-8"
            />
            {localSearch && (
              <button
                type="button"
                onClick={handleSearchClear}
                className="text-muted-foreground hover:text-foreground absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="text-muted-foreground flex items-center justify-between text-sm">
        <span>
          {merchants.length} merchant{merchants.length !== 1 ? 's' : ''}
        </span>
        <span className="font-medium text-foreground">{formatCurrency(totalExpenses)} total</span>
      </div>

      {/* Merchant list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Merchants</CardTitle>
          <CardDescription>Click a column header to sort</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Header row - desktop */}
          <div className="text-muted-foreground hidden border-b px-4 py-2 text-xs font-medium uppercase tracking-wide sm:flex">
            <button
              type="button"
              className="flex flex-1 items-center gap-1 text-left hover:text-foreground"
              onClick={() => handleSort('name')}
            >
              Merchant {getSortIcon('name')}
            </button>
            <button
              type="button"
              className="flex w-32 items-center justify-end gap-1 hover:text-foreground"
              onClick={() => handleSort('count')}
            >
              {getSortIcon('count')} Transactions
            </button>
            <button
              type="button"
              className="flex w-28 items-center justify-end gap-1 hover:text-foreground"
              onClick={() => handleSort('total')}
            >
              {getSortIcon('total')} Total
            </button>
            <div className="w-48 pl-4">Category</div>
          </div>

          {/* Merchant rows */}
          <div className="divide-y">
            {paginatedMerchants.map(merchant => {
              const isProcessing = pendingPattern === merchant.merchantPattern && isPending;

              return (
                <div key={merchant.id} className="p-4">
                  {/* Desktop layout */}
                  <div className="hidden items-center gap-4 sm:flex">
                    {/* Multi-merchant toggle */}
                    {merchant.isMultiMerchant ? (
                      <button
                        type="button"
                        onClick={() => handleToggleMulti(merchant.merchantPattern, false)}
                        disabled={isProcessing}
                        className="text-amber-600 hover:text-muted-foreground shrink-0 transition-colors disabled:opacity-50"
                        title="Remove multi-merchant flag"
                      >
                        <Layers className="size-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleMulti(merchant.merchantPattern, true)}
                        disabled={isProcessing}
                        className="text-muted-foreground hover:text-amber-600 shrink-0 transition-colors disabled:opacity-50"
                        title="Mark as multi-merchant (always requires review)"
                      >
                        <Store className="size-4" />
                      </button>
                    )}

                    {/* Merchant name */}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/merchant/${merchant.id}`}
                        className="group flex items-center gap-1.5 truncate font-medium hover:text-primary"
                      >
                        {merchant.merchantPattern}
                        <ExternalLink className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
                      </Link>
                    </div>

                    {/* Transaction count */}
                    <div className="text-muted-foreground w-32 text-right text-sm">
                      {merchant.transactionCount} tx{merchant.transactionCount !== 1 ? 's' : ''}
                    </div>

                    {/* Total */}
                    <div className="w-28 text-right font-mono text-sm text-red-600 dark:text-red-400">
                      {formatCurrency(merchant.totalExpenses)}
                    </div>

                    {/* Category selector - hidden for multi-merchants */}
                    <div className="w-48">
                      {merchant.isMultiMerchant ? (
                        <span className="text-muted-foreground text-sm italic">
                          Requires manual review
                        </span>
                      ) : isProcessing ? (
                        <div className="flex h-9 items-center justify-center">
                          <Loader2 className="size-4 animate-spin" />
                        </div>
                      ) : (
                        <Select
                          value={merchant.categoryId ?? '__none__'}
                          onValueChange={value =>
                            handleCategoryChange(merchant.merchantPattern, value)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue>
                              {merchant.categoryId
                                ? categories.find(c => c.id === merchant.categoryId)?.icon
                                  ? `${categories.find(c => c.id === merchant.categoryId)?.icon} ${merchant.categoryName}`
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

                  {/* Mobile layout */}
                  <div className="space-y-3 sm:hidden">
                    {/* Row 1: toggle + name */}
                    <div className="flex items-center gap-2">
                      {merchant.isMultiMerchant ? (
                        <button
                          type="button"
                          onClick={() => handleToggleMulti(merchant.merchantPattern, false)}
                          disabled={isProcessing}
                          className="text-amber-600 hover:text-muted-foreground shrink-0 transition-colors disabled:opacity-50"
                          title="Remove multi-merchant flag"
                        >
                          <Layers className="size-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleMulti(merchant.merchantPattern, true)}
                          disabled={isProcessing}
                          className="text-muted-foreground hover:text-amber-600 shrink-0 transition-colors disabled:opacity-50"
                          title="Mark as multi-merchant"
                        >
                          <Store className="size-4" />
                        </button>
                      )}
                      <Link
                        href={`/merchant/${merchant.id}`}
                        className="min-w-0 flex-1 truncate font-medium hover:text-primary"
                      >
                        {merchant.merchantPattern}
                      </Link>
                    </div>

                    {/* Row 2: stats + category */}
                    <div className="flex items-center gap-3">
                      <div className="text-muted-foreground text-sm">
                        {merchant.transactionCount} tx{merchant.transactionCount !== 1 ? 's' : ''}
                      </div>
                      <div className="font-mono text-sm text-red-600 dark:text-red-400">
                        {formatCurrency(merchant.totalExpenses)}
                      </div>
                      <div className="flex-1">
                        {merchant.isMultiMerchant ? (
                          <span className="text-muted-foreground text-xs italic">
                            Manual review
                          </span>
                        ) : isProcessing ? (
                          <div className="flex h-10 items-center justify-center">
                            <Loader2 className="size-4 animate-spin" />
                          </div>
                        ) : (
                          <Select
                            value={merchant.categoryId ?? '__none__'}
                            onValueChange={value =>
                              handleCategoryChange(merchant.merchantPattern, value)
                            }
                          >
                            <SelectTrigger className="h-10 w-full">
                              <SelectValue>
                                {merchant.categoryId
                                  ? categories.find(c => c.id === merchant.categoryId)?.icon
                                    ? `${categories.find(c => c.id === merchant.categoryId)?.icon} ${merchant.categoryName}`
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
                  </div>
                </div>
              );
            })}

            {sortedMerchants.length === 0 && (
              <div className="text-muted-foreground py-12 text-center text-sm">
                No merchants found
                {search && ` matching "${search}"`}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={sortedMerchants.length}
        pageSize={pageSize}
        hydrated={pageSizeHydrated !== null}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  );
}
