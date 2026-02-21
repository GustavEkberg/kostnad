'use client';

import Link from 'next/link';
import { ArrowUp, ArrowDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { MonthPicker } from './month-picker';
import { CategoryFilter, type Category } from './category-filter';

import { ExpenseHighlights } from '@/components/expense-highlights';
import { useCategoryFilter, filterByCategory } from '@/lib/hooks/use-category-filter';
import {
  useSortedTransactions,
  type SortField,
  type SortDirection
} from '@/lib/hooks/use-transaction-sort';
import { ComparisonChart } from '@/components/comparison-chart';
import { CategoryHorizontalBarChart } from '@/components/category-horizontal-bar-chart';
import { IncomeExpenseRadialChart } from '@/components/income-expense-radial-chart';

type MonthData = {
  period: string;
  year: number;
  month: number;
  net: number;
};

type CategorySummaryItem = {
  categoryId: string | null;
  categoryName: string | null;
  total: number;
  count: number;
};

type Transaction = {
  id: string;
  date: Date;
  merchant: string;
  amount: string;
  balance: string | null;
  categoryId: string | null;
  uploadId: string | null;
  originalHash: string;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

type CategoryTrendItem = {
  categoryId: string | null;
  change: number;
  percentChange: number | null;
};

type PeriodTotals = {
  income: number;
  expenses: number;
};

type Props = {
  period: string | null;
  dateRangeLabel: string;
  currentLabel: string;
  availableMonths: MonthData[];
  progress: {
    daysElapsed: number;
    daysTotal: number;
    percentComplete: number;
  };
  prevMonthLabel: string;
  yearAgoLabel: string;
  categorySummary: CategorySummaryItem[];
  prevCategorySummary: CategorySummaryItem[];
  yearAgoCategorySummary: CategorySummaryItem[];
  categoryTrends: CategoryTrendItem[];
  transactions: Transaction[];
  highestMerchantId: string | null;
  categories: Category[];
  totals: {
    current: PeriodTotals;
    prev: PeriodTotals;
    yearAgo: PeriodTotals;
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

// Helper to compute totals from transactions
function computeTotalsFromTransactions(transactions: Transaction[]) {
  let income = 0;
  let expenses = 0;
  for (const t of transactions) {
    const amount = Number(t.amount);
    if (amount > 0) {
      income += amount;
    } else {
      expenses += Math.abs(amount);
    }
  }
  return { income, expenses, net: income - expenses };
}

export function DashboardContent({
  period,
  dateRangeLabel,
  currentLabel,
  availableMonths,
  progress: _progress,
  prevMonthLabel,
  yearAgoLabel,
  categorySummary,
  prevCategorySummary,
  yearAgoCategorySummary,
  categoryTrends: _categoryTrends,
  transactions,
  highestMerchantId,
  categories,
  totals
}: Props) {
  const [selectedIds, setSelectedIds] = useCategoryFilter();
  const [sortedTransactions, sortState, setSortState] = useSortedTransactions(transactions);

  // Filter category summaries for all periods
  const filteredCategorySummary = filterByCategory(
    categorySummary.map(c => ({ ...c, categoryId: c.categoryId })),
    selectedIds
  );
  const filteredPrevCategorySummary = filterByCategory(
    prevCategorySummary.map(c => ({ ...c, categoryId: c.categoryId })),
    selectedIds
  );
  const filteredYearAgoCategorySummary = filterByCategory(
    yearAgoCategorySummary.map(c => ({ ...c, categoryId: c.categoryId })),
    selectedIds
  );

  // Filter then sort transactions
  const filteredTransactions = filterByCategory(sortedTransactions, selectedIds);

  const handleSort = (field: SortField) => {
    if (sortState.field === field) {
      // Toggle direction
      const newDirection: SortDirection = sortState.direction === 'asc' ? 'desc' : 'asc';
      setSortState({ field, direction: newDirection });
    } else {
      // New field: default to desc for date/amount, asc for merchant/category
      const defaultDirection: SortDirection =
        field === 'merchant' || field === 'category' ? 'asc' : 'desc';
      setSortState({ field, direction: defaultDirection });
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortState.field !== field) return null;
    return sortState.direction === 'asc' ? (
      <ArrowUp className="size-3" />
    ) : (
      <ArrowDown className="size-3" />
    );
  };

  const headerClass = (field: SortField) =>
    cn(
      'flex cursor-pointer select-none items-center gap-1 transition-colors hover:text-foreground',
      sortState.field === field ? 'text-foreground' : 'text-muted-foreground'
    );

  // Compute totals: use server-computed totals when no filter, else compute from filtered transactions
  const hasFilter = selectedIds !== null && selectedIds.length > 0;

  const current = hasFilter
    ? computeTotalsFromTransactions(filteredTransactions)
    : {
        income: totals.current.income,
        expenses: totals.current.expenses,
        net: totals.current.income - totals.current.expenses
      };

  // For comparison periods, use category-based computation when filtered (we don't have their transactions)
  // This is approximate but consistent with the category filter's purpose
  const computeTotalsFromCategorySummary = (summary: CategorySummaryItem[]) => {
    const income = summary.filter(c => c.total > 0).reduce((sum, c) => sum + c.total, 0);
    const expenses = summary
      .filter(c => c.total < 0)
      .reduce((sum, c) => sum + Math.abs(c.total), 0);
    return { income, expenses, net: income - expenses };
  };

  const prev = hasFilter
    ? computeTotalsFromCategorySummary(filteredPrevCategorySummary)
    : {
        income: totals.prev.income,
        expenses: totals.prev.expenses,
        net: totals.prev.income - totals.prev.expenses
      };

  const yearAgo = hasFilter
    ? computeTotalsFromCategorySummary(filteredYearAgoCategorySummary)
    : {
        income: totals.yearAgo.income,
        expenses: totals.yearAgo.expenses,
        net: totals.yearAgo.income - totals.yearAgo.expenses
      };

  // Destructure for convenience
  const { income, expenses } = current;

  // Find highest merchant from filtered transactions
  const expenseTransactions = filteredTransactions.filter(t => Number(t.amount) < 0);
  const merchantTotals = new Map<string, number>();
  for (const t of expenseTransactions) {
    const current = merchantTotals.get(t.merchant) ?? 0;
    merchantTotals.set(t.merchant, current + Math.abs(Number(t.amount)));
  }

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Month Header with Category Filter */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex w-full items-center justify-between gap-4">
            <div className="w-24" /> {/* Spacer for centering */}
            <MonthPicker period={period} label={dateRangeLabel} availableMonths={availableMonths} />
            <div className="flex w-24 justify-end">
              <CategoryFilter
                categories={categories}
                selectedIds={selectedIds}
                onChange={setSelectedIds}
              />
            </div>
          </div>
        </div>

        {/* Main Summary - Radial Chart + Comparison */}
        <div className="grid gap-4 lg:grid-cols-2">
          <IncomeExpenseRadialChart income={income} expenses={expenses} />
          <ComparisonChart
            currentLabel={currentLabel}
            prevMonthLabel={prevMonthLabel}
            yearAgoLabel={yearAgoLabel}
            income={{
              current: current.income,
              prevMonth: prev.income,
              yearAgo: yearAgo.income
            }}
            expenses={{
              current: current.expenses,
              prevMonth: prev.expenses,
              yearAgo: yearAgo.expenses
            }}
            net={{
              current: current.net,
              prevMonth: prev.net,
              yearAgo: yearAgo.net
            }}
          />
        </div>

        {/* Category Chart */}
        <CategoryHorizontalBarChart
          currentLabel={currentLabel}
          categorySummary={filteredCategorySummary}
          categories={categories}
        />

        {/* Expense Highlights */}
        <ExpenseHighlights transactions={filteredTransactions} merchantId={highestMerchantId} />

        {/* Transactions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Transactions</h2>
            <span className="text-muted-foreground text-sm">
              {filteredTransactions.length} transaction
              {filteredTransactions.length !== 1 ? 's' : ''}
            </span>
          </div>

          {filteredTransactions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {selectedIds !== null && selectedIds.length === 0
                ? 'No categories selected.'
                : 'No transactions this month.'}
            </p>
          ) : (
            (() => {
              const expenseAmounts = filteredTransactions
                .map(tx => Number(tx.amount))
                .filter(a => a < 0)
                .map(Math.abs);
              const incomeAmounts = filteredTransactions
                .map(tx => Number(tx.amount))
                .filter(a => a > 0);
              const maxExpense = expenseAmounts.length > 0 ? Math.max(...expenseAmounts) : 0;
              const maxIncome = incomeAmounts.length > 0 ? Math.max(...incomeAmounts) : 0;
              return (
                <div className="rounded-lg border">
                  {/* Desktop table header */}
                  <div className="hidden items-center gap-4 border-b px-4 py-2 sm:flex">
                    <button
                      type="button"
                      onClick={() => handleSort('date')}
                      className={cn(headerClass('date'), 'w-24 shrink-0 text-sm')}
                    >
                      Date
                      <SortIcon field="date" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSort('category')}
                      className={cn(headerClass('category'), 'w-36 shrink-0 text-sm')}
                    >
                      Category
                      <SortIcon field="category" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSort('merchant')}
                      className={cn(headerClass('merchant'), 'min-w-0 flex-1 text-sm')}
                    >
                      Merchant
                      <SortIcon field="merchant" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSort('amount')}
                      className={cn(
                        headerClass('amount'),
                        'w-28 shrink-0 justify-end text-right text-sm'
                      )}
                    >
                      <SortIcon field="amount" />
                      Amount
                    </button>
                  </div>

                  {/* Mobile sort controls */}
                  <div className="flex gap-2 border-b px-4 py-2 text-xs sm:hidden">
                    <span className="text-muted-foreground">Sort:</span>
                    <button
                      type="button"
                      onClick={() => handleSort('date')}
                      className={headerClass('date')}
                    >
                      Date
                      <SortIcon field="date" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSort('category')}
                      className={headerClass('category')}
                    >
                      Category
                      <SortIcon field="category" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSort('merchant')}
                      className={headerClass('merchant')}
                    >
                      Merchant
                      <SortIcon field="merchant" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSort('amount')}
                      className={headerClass('amount')}
                    >
                      Amount
                      <SortIcon field="amount" />
                    </button>
                  </div>

                  <div className="divide-border divide-y">
                    {filteredTransactions.map(tx => {
                      const amount = Number(tx.amount);
                      const categoryDisplay = tx.category?.icon
                        ? `${tx.category.icon} ${tx.category.name}`
                        : (tx.category?.name ?? 'Uncategorized');
                      const isExpense = amount < 0;
                      const maxForType = isExpense ? maxExpense : maxIncome;
                      const widthPercent =
                        maxForType > 0 ? (Math.abs(amount) / maxForType) * 100 : 0;

                      return (
                        <div
                          key={tx.id}
                          className="relative p-4"
                          style={{
                            background: `linear-gradient(to right, ${
                              isExpense ? 'rgb(239 68 68 / 0.1)' : 'rgb(34 197 94 / 0.1)'
                            } ${widthPercent}%, transparent ${widthPercent}%)`
                          }}
                        >
                          {/* Desktop layout */}
                          <div className="hidden items-center gap-4 sm:flex">
                            <div className="text-muted-foreground w-24 shrink-0 text-sm">
                              {new Date(tx.date).toLocaleDateString('sv-SE')}
                            </div>
                            <div
                              className={cn(
                                'w-36 shrink-0 truncate text-sm',
                                !tx.category && 'text-muted-foreground'
                              )}
                            >
                              {categoryDisplay}
                            </div>
                            <div className="min-w-0 flex-1 truncate">
                              <Link
                                href={`/merchants?search=${encodeURIComponent(tx.merchant)}`}
                                className="font-medium hover:underline"
                              >
                                {tx.merchant}
                              </Link>
                            </div>
                            <Link
                              href={`/transactions/${tx.id}`}
                              className={cn(
                                'w-28 shrink-0 text-right font-mono text-sm hover:underline',
                                isExpense
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-green-600 dark:text-green-400'
                              )}
                            >
                              {formatCurrency(amount)}
                            </Link>
                          </div>

                          {/* Mobile layout */}
                          <div className="sm:hidden">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <Link
                                  href={`/merchants?search=${encodeURIComponent(tx.merchant)}`}
                                  className="truncate font-medium hover:underline"
                                >
                                  {tx.merchant}
                                </Link>
                                <p className="text-muted-foreground text-xs">
                                  {new Date(tx.date).toLocaleDateString('sv-SE')}
                                  {' · '}
                                  <span className={cn(!tx.category && 'text-muted-foreground')}>
                                    {categoryDisplay}
                                  </span>
                                </p>
                              </div>
                              <Link
                                href={`/transactions/${tx.id}`}
                                className={cn(
                                  'shrink-0 font-mono text-sm hover:underline',
                                  isExpense
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-green-600 dark:text-green-400'
                                )}
                              >
                                {formatCurrency(amount)}
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>
    </main>
  );
}
