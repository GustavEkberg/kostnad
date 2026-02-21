'use client';

import { useSyncExternalStore, useCallback } from 'react';
import { Schema } from 'effect';

const STORAGE_KEY = 'dashboard-category-filter';

const CategoryFilterStateSchema = Schema.Struct({
  selectedIds: Schema.NullOr(Schema.Array(Schema.String))
});

type CategoryFilterState = typeof CategoryFilterStateSchema.Type;

// Cache for snapshot - must return same reference if data unchanged
let cachedSnapshot: readonly string[] | null = null;
let cachedStorageValue: string | null = null;

function getSnapshot(): readonly string[] | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(STORAGE_KEY);

  // Return cached value if storage hasn't changed
  if (stored === cachedStorageValue) {
    return cachedSnapshot;
  }

  // Update cache
  cachedStorageValue = stored;

  if (!stored) {
    cachedSnapshot = null;
    return null;
  }

  try {
    const parsed = Schema.decodeUnknownOption(CategoryFilterStateSchema)(JSON.parse(stored));
    if (parsed._tag === 'None') {
      cachedSnapshot = null;
      return null;
    }
    cachedSnapshot = parsed.value.selectedIds;
    return cachedSnapshot;
  } catch {
    cachedSnapshot = null;
    return null;
  }
}

function getServerSnapshot(): readonly string[] | null {
  return null;
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
 * Hook for managing category filter state with localStorage persistence.
 * Returns [selectedIds, setSelectedIds] where:
 * - null = show all categories (no filter)
 * - string[] = show only these category IDs (empty = hide all)
 */
export function useCategoryFilter(): [readonly string[] | null, (ids: string[] | null) => void] {
  const selectedIds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const updateSelectedIds = useCallback((ids: string[] | null) => {
    const state: CategoryFilterState = { selectedIds: ids };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    emitChange();
  }, []);

  return [selectedIds, updateSelectedIds];
}

/**
 * Filter transactions by category IDs.
 * If selectedIds is null, returns all transactions.
 * Supports 'uncategorized' as a special value for null categoryId.
 */
export function filterByCategory<T extends { categoryId: string | null }>(
  items: T[],
  selectedIds: readonly string[] | null
): T[] {
  if (selectedIds === null) return items;

  const includeUncategorized = selectedIds.includes('uncategorized');
  const categoryIds = selectedIds.filter(id => id !== 'uncategorized');

  return items.filter(item => {
    if (item.categoryId === null) {
      return includeUncategorized;
    }
    return categoryIds.includes(item.categoryId);
  });
}
