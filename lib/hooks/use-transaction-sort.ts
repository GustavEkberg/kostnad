'use client';

import { useSyncExternalStore, useCallback, useMemo } from 'react';
import { Schema } from 'effect';

const STORAGE_KEY = 'dashboard-transaction-sort';

export const SortField = Schema.Literal('date', 'merchant', 'amount', 'category');
export type SortField = typeof SortField.Type;

export const SortDirection = Schema.Literal('asc', 'desc');
export type SortDirection = typeof SortDirection.Type;

const TransactionSortStateSchema = Schema.Struct({
  field: SortField,
  direction: SortDirection
});

export type TransactionSortState = typeof TransactionSortStateSchema.Type;

const DEFAULT_SORT: TransactionSortState = { field: 'date', direction: 'desc' };

// Cache for snapshot - must return same reference if data unchanged
let cachedSnapshot: TransactionSortState = DEFAULT_SORT;
let cachedStorageValue: string | null = null;

function getSnapshot(): TransactionSortState {
  if (typeof window === 'undefined') return DEFAULT_SORT;

  const stored = localStorage.getItem(STORAGE_KEY);

  // Return cached value if storage hasn't changed
  if (stored === cachedStorageValue) {
    return cachedSnapshot;
  }

  // Update cache
  cachedStorageValue = stored;

  if (!stored) {
    cachedSnapshot = DEFAULT_SORT;
    return DEFAULT_SORT;
  }

  try {
    const parsed = Schema.decodeUnknownOption(TransactionSortStateSchema)(JSON.parse(stored));
    if (parsed._tag === 'None') {
      cachedSnapshot = DEFAULT_SORT;
      return DEFAULT_SORT;
    }
    cachedSnapshot = parsed.value;
    return cachedSnapshot;
  } catch {
    cachedSnapshot = DEFAULT_SORT;
    return DEFAULT_SORT;
  }
}

function getServerSnapshot(): TransactionSortState {
  return DEFAULT_SORT;
}

let listeners: Array<() => void> = [];

function subscribe(callback: () => void): () => void {
  listeners.push(callback);

  // Listen for storage events (cross-tab sync)
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      // Invalidate cache on cross-tab changes
      cachedStorageValue = null;
      callback();
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    listeners = listeners.filter(l => l !== callback);
    window.removeEventListener('storage', handleStorage);
  };
}

function emitChange(): void {
  // Invalidate cache before notifying listeners
  cachedStorageValue = null;
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Hook for managing transaction sort state with localStorage persistence.
 * Returns [sortState, setSortState] where sortState has field and direction.
 */
export function useTransactionSort(): [
  TransactionSortState,
  (state: TransactionSortState) => void
] {
  const sortState = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const updateSortState = useCallback((state: TransactionSortState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    emitChange();
  }, []);

  return [sortState, updateSortState];
}

/**
 * Sort transactions by field and direction.
 */
export function sortTransactions<
  T extends {
    date: Date | string;
    merchant: string;
    amount: string | number;
    category: { name: string } | null;
  }
>(transactions: T[], sort: TransactionSortState): T[] {
  const sorted = [...transactions].sort((a, b) => {
    let comparison = 0;

    switch (sort.field) {
      case 'date': {
        const aTime = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
        const bTime = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
        comparison = aTime - bTime;
        break;
      }
      case 'merchant':
        comparison = a.merchant.localeCompare(b.merchant, 'sv-SE');
        break;
      case 'amount':
        comparison = Math.abs(Number(a.amount)) - Math.abs(Number(b.amount));
        break;
      case 'category': {
        const aName = a.category?.name ?? '';
        const bName = b.category?.name ?? '';
        // Put uncategorized (empty) at the end when ascending
        if (!aName && bName) comparison = 1;
        else if (aName && !bName) comparison = -1;
        else comparison = aName.localeCompare(bName, 'sv-SE');
        break;
      }
    }

    return sort.direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Hook that returns memoized sorted transactions.
 */
export function useSortedTransactions<
  T extends {
    date: Date | string;
    merchant: string;
    amount: string | number;
    category: { name: string } | null;
  }
>(transactions: T[]): [T[], TransactionSortState, (state: TransactionSortState) => void] {
  const [sortState, setSortState] = useTransactionSort();

  const sortedTransactions = useMemo(
    () => sortTransactions(transactions, sortState),
    [transactions, sortState]
  );

  return [sortedTransactions, sortState, setSortState];
}
