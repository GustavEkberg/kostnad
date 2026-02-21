'use client';

import { useQueryStates } from 'nuqs';
import { useState, useTransition } from 'react';
import { Search, X, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Pagination, type PageSize } from '@/components/ui/pagination';
import { searchParams, DEFAULT_PAGE_SIZE } from './search-params';
import { cn } from '@/lib/utils';
import { updateTransactionAction } from '@/lib/core/transaction/update-transaction-action';
import { deleteTransactionAction } from '@/lib/core/transaction/delete-transaction-action';

type PageSizeParam = '10' | '20' | '50' | '100';
const PAGE_SIZE_MAP: Record<PageSize, PageSizeParam> = {
  10: '10',
  20: '20',
  50: '50',
  100: '100'
};

type Transaction = {
  id: string;
  date: Date;
  merchant: string;
  amount: number;
  balance: number | null;
  categoryId: string | null;
  categoryName: string | null;
};

type Category = {
  id: string;
  name: string;
  icon: string | null;
  isDefault: boolean;
};

type FilterState = {
  category: string | null;
  search: string | null;
  startDate: string | null;
  endDate: string | null;
};

type Props = {
  transactions: Transaction[];
  categories: Category[];
  total: number;
  page: number;
  totalPages: number;
  currentFilter: FilterState;
};

export function TransactionList({
  transactions: initialTransactions,
  categories,
  total,
  page,
  totalPages,
  currentFilter
}: Props) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [params, setParams] = useQueryStates(searchParams, {
    shallow: false,
    history: 'push'
  });

  // Page size from URL (server-side pagination - URL is source of truth)
  const parsedPageSize = params.pageSize ? parseInt(params.pageSize, 10) : DEFAULT_PAGE_SIZE;
  const pageSize: PageSize =
    parsedPageSize === 10 ||
    parsedPageSize === 20 ||
    parsedPageSize === 50 ||
    parsedPageSize === 100
      ? parsedPageSize
      : DEFAULT_PAGE_SIZE;

  // Local state for search input (debounced submission)
  const [searchInput, setSearchInput] = useState(currentFilter.search ?? '');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      setParams({ search: searchInput || null, page: 1 });
    });
  };

  const handleCategoryFilterChange = (value: string | null) => {
    startTransition(() => {
      // Convert 'all' back to null
      const categoryValue = value === 'all' ? null : value;
      setParams({ category: categoryValue, page: 1 });
    });
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    startTransition(() => {
      setParams({ [field]: value || null, page: 1 });
    });
  };

  const clearFilters = () => {
    setSearchInput('');
    startTransition(() => {
      setParams({
        category: null,
        search: null,
        startDate: null,
        endDate: null,
        page: 1
      });
    });
  };

  const handlePageChange = (newPage: number) => {
    startTransition(() => {
      setParams({ page: newPage });
    });
  };

  const handlePageSizeChange = (newSize: PageSize) => {
    startTransition(() => {
      setParams({ pageSize: PAGE_SIZE_MAP[newSize], page: 1 });
    });
  };

  const handleCategoryChange = (transactionId: string, categoryId: string | null) => {
    setPendingId(transactionId);

    startTransition(async () => {
      const result = await updateTransactionAction({
        id: transactionId,
        categoryId: categoryId === '__none__' ? null : categoryId
      });

      if (result._tag === 'Error') {
        toast.error(result.message);
        setPendingId(null);
        return;
      }

      // Update local state
      setTransactions(prev =>
        prev.map(tx =>
          tx.id === transactionId
            ? {
                ...tx,
                categoryId: result.categoryId,
                categoryName: result.categoryId
                  ? (categories.find(c => c.id === result.categoryId)?.name ?? null)
                  : null
              }
            : tx
        )
      );

      setPendingId(null);
      toast.success('Transaction updated');
    });
  };

  const handleDelete = (transactionId: string, merchant: string) => {
    setPendingId(transactionId);

    startTransition(async () => {
      const result = await deleteTransactionAction({ id: transactionId });

      if (result._tag === 'Error') {
        toast.error(result.message);
        setPendingId(null);
        return;
      }

      // Remove from local state
      setTransactions(prev => prev.filter(tx => tx.id !== transactionId));
      setPendingId(null);
      toast.success(`Deleted ${merchant}`);
    });
  };

  const hasFilters =
    currentFilter.category !== null ||
    currentFilter.search !== null ||
    currentFilter.startDate !== null ||
    currentFilter.endDate !== null;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('sv-SE');
  };

  const formatAmount = (amount: number) => {
    const formatted = new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(amount));

    return amount < 0 ? `-${formatted}` : `+${formatted}`;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search by merchant..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>

          {/* Category + Date filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={params.category ?? 'all'} onValueChange={handleCategoryFilterChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="uncategorized">Uncategorized</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon ? `${cat.icon} ` : ''}
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={params.startDate ?? ''}
              onChange={e => handleDateChange('startDate', e.target.value)}
              className="w-[150px]"
              placeholder="Start date"
            />

            <Input
              type="date"
              value={params.endDate ?? ''}
              onChange={e => handleDateChange('endDate', e.target.value)}
              className="w-[150px]"
              placeholder="End date"
            />

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 size-3" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transaction List */}
      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No transactions found</p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-primary mt-2 text-sm underline underline-offset-4 hover:no-underline"
              >
                Clear filters
              </button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-border divide-y">
              {transactions.map(tx => {
                const isProcessing = pendingId === tx.id && isPending;

                return (
                  <div key={tx.id} className="p-4">
                    {/* Desktop layout */}
                    <div className="hidden items-center gap-4 sm:flex">
                      {/* Date */}
                      <div className="text-muted-foreground w-24 shrink-0 text-sm">
                        {formatDate(tx.date)}
                      </div>

                      {/* Merchant */}
                      <div className="min-w-0 flex-1">
                        <a
                          href={`/merchants?search=${encodeURIComponent(tx.merchant)}`}
                          className="truncate font-medium hover:underline"
                        >
                          {tx.merchant}
                        </a>
                      </div>

                      {/* Amount */}
                      <Link
                        href={`/transactions/${tx.id}`}
                        className={cn(
                          'w-28 shrink-0 text-right font-mono text-sm hover:underline',
                          tx.amount < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-green-600 dark:text-green-400'
                        )}
                      >
                        {formatAmount(tx.amount)}
                      </Link>

                      {/* Category selector */}
                      <div className="w-44">
                        {isProcessing ? (
                          <div className="flex h-9 items-center justify-center">
                            <Loader2 className="size-4 animate-spin" />
                          </div>
                        ) : (
                          <Select
                            value={tx.categoryId ?? '__none__'}
                            onValueChange={value => handleCategoryChange(tx.id, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue>
                                {tx.categoryId
                                  ? categories.find(c => c.id === tx.categoryId)?.icon
                                    ? `${categories.find(c => c.id === tx.categoryId)?.icon} ${tx.categoryName}`
                                    : tx.categoryName
                                  : 'Uncategorized'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" className="text-muted-foreground">
                                Uncategorized
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

                      {/* Delete button */}
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={isProcessing}
                              className="text-muted-foreground hover:text-destructive shrink-0"
                            />
                          }
                        >
                          <Trash2 className="size-4" />
                        </AlertDialogTrigger>
                        <AlertDialogContent size="sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Delete &quot;{tx.merchant}&quot;? This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => handleDelete(tx.id, tx.merchant)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    {/* Mobile layout */}
                    <div className="space-y-3 sm:hidden">
                      {/* Row 1: date + merchant + amount */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <a
                            href={`/merchants?search=${encodeURIComponent(tx.merchant)}`}
                            className="truncate font-medium hover:underline"
                          >
                            {tx.merchant}
                          </a>
                          <p className="text-muted-foreground text-xs">{formatDate(tx.date)}</p>
                        </div>
                        <Link
                          href={`/transactions/${tx.id}`}
                          className={cn(
                            'shrink-0 font-mono text-sm hover:underline',
                            tx.amount < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-green-600 dark:text-green-400'
                          )}
                        >
                          {formatAmount(tx.amount)}
                        </Link>
                      </div>

                      {/* Row 2: category + delete */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          {isProcessing ? (
                            <div className="flex h-10 items-center justify-center">
                              <Loader2 className="size-4 animate-spin" />
                            </div>
                          ) : (
                            <Select
                              value={tx.categoryId ?? '__none__'}
                              onValueChange={value => handleCategoryChange(tx.id, value)}
                            >
                              <SelectTrigger className="h-10 w-full">
                                <SelectValue>
                                  {tx.categoryId
                                    ? categories.find(c => c.id === tx.categoryId)?.icon
                                      ? `${categories.find(c => c.id === tx.categoryId)?.icon} ${tx.categoryName}`
                                      : tx.categoryName
                                    : 'Uncategorized'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__" className="text-muted-foreground">
                                  Uncategorized
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
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={isProcessing}
                                className="text-muted-foreground hover:text-destructive shrink-0"
                              />
                            }
                          >
                            <Trash2 className="size-4" />
                          </AlertDialogTrigger>
                          <AlertDialogContent size="sm">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Delete &quot;{tx.merchant}&quot;? This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                onClick={() => handleDelete(tx.id, tx.merchant)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  );
}
