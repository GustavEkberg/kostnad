'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Transaction, Category } from '@/lib/services/db/schema';

type TransactionWithCategory = Transaction & {
  category?: Category | null;
};

type Props = {
  transactions: ReadonlyArray<TransactionWithCategory>;
  merchantId?: string | null;
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
    day: 'numeric',
    month: 'short'
  }).format(date);
}

export function ExpenseHighlights({ transactions, merchantId }: Props) {
  const expenses = transactions.filter(t => Number(t.amount) < 0);

  if (expenses.length === 0) {
    return <p className="text-muted-foreground text-sm">No expenses found</p>;
  }

  // Find highest single expense
  const highestExpense = expenses.reduce((max, t) =>
    Number(t.amount) < Number(max.amount) ? t : max
  );

  // Group by merchant and find top merchant
  const merchantTotals = new Map<string, { total: number; count: number }>();
  for (const t of expenses) {
    const amount = Math.abs(Number(t.amount));
    const existing = merchantTotals.get(t.merchant);
    if (existing) {
      existing.total += amount;
      existing.count += 1;
    } else {
      merchantTotals.set(t.merchant, { total: amount, count: 1 });
    }
  }

  let topMerchant = '';
  let topMerchantData = { total: 0, count: 0 };
  for (const [merchant, data] of merchantTotals) {
    if (data.total > topMerchantData.total) {
      topMerchant = merchant;
      topMerchantData = data;
    }
  }

  const expenseAmount = Math.abs(Number(highestExpense.amount));

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {/* Highest Expense */}
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">Highest Expense</p>
        <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
          {formatCurrency(expenseAmount)}
        </p>
        <p className="truncate font-medium" title={highestExpense.merchant}>
          {highestExpense.merchant}
        </p>
        <p className="text-muted-foreground text-sm">
          <span>{formatDate(highestExpense.date)}</span>
          {highestExpense.category && (
            <>
              <span className="mx-1.5">·</span>
              <span className={cn(!highestExpense.category.name && 'italic')}>
                {highestExpense.category.icon && `${highestExpense.category.icon} `}
                {highestExpense.category.name ?? 'Uncategorized'}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Top Merchant */}
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">Top Merchant</p>
        {merchantId ? (
          <Link
            href={`/merchant/${merchantId}`}
            className="group block transition-opacity hover:opacity-80"
          >
            <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
              {formatCurrency(topMerchantData.total)}
            </p>
            <p className="truncate font-medium" title={topMerchant}>
              {topMerchant}
            </p>
            <p className="text-muted-foreground text-sm">
              {topMerchantData.count} transaction{topMerchantData.count !== 1 ? 's' : ''}
              <span className="ml-2 inline-flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <ExternalLink className="size-3" />
              </span>
            </p>
          </Link>
        ) : (
          <>
            <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
              {formatCurrency(topMerchantData.total)}
            </p>
            <p className="truncate font-medium" title={topMerchant}>
              {topMerchant}
            </p>
            <p className="text-muted-foreground text-sm">
              {topMerchantData.count} transaction{topMerchantData.count !== 1 ? 's' : ''}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
