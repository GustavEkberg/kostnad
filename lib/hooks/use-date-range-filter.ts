'use client';

import { useEffect, useCallback } from 'react';
import { useQueryState, parseAsIsoDate } from 'nuqs';
import type { DateRange } from 'react-day-picker';

const STORAGE_KEY = 'detail-date-range-filter';

type StoredDateRange = {
  from: string | null;
  to: string | null;
};

function getStoredRange(): { from: Date | null; to: Date | null } {
  if (typeof window === 'undefined') return { from: null, to: null };

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { from: null, to: null };

    const parsed: StoredDateRange = JSON.parse(stored);
    return {
      from: parsed.from ? new Date(parsed.from) : null,
      to: parsed.to ? new Date(parsed.to) : null
    };
  } catch {
    return { from: null, to: null };
  }
}

function setStoredRange(from: Date | null, to: Date | null): void {
  if (typeof window === 'undefined') return;

  if (!from && !to) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    const value: StoredDateRange = {
      from: from?.toISOString() ?? null,
      to: to?.toISOString() ?? null
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }
}

type UseDateRangeFilterResult = {
  from: Date | null;
  to: Date | null;
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  clearDateRange: () => void;
  hasDateFilter: boolean;
  hydrated: boolean;
};

/**
 * Hook for date range filter with localStorage persistence and URL sync.
 * - On mount, loads from localStorage if URL has no params
 * - Only saves to localStorage on explicit user actions (set/clear)
 */
export function useDateRangeFilter(currentParams: {
  from: Date | null;
  to: Date | null;
}): UseDateRangeFilterResult {
  const [from, setFrom] = useQueryState(
    'from',
    parseAsIsoDate.withOptions({ shallow: false, history: 'push' })
  );
  const [to, setTo] = useQueryState(
    'to',
    parseAsIsoDate.withOptions({ shallow: false, history: 'push' })
  );

  // Hydrate from localStorage on mount if URL has no params
  useEffect(() => {
    if (from === null && to === null && currentParams.from === null && currentParams.to === null) {
      const stored = getStoredRange();
      if (stored.from && stored.to) {
        setFrom(stored.from);
        setTo(stored.to);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
  }, []);

  const currentFrom = from ?? currentParams.from;
  const currentTo = to ?? currentParams.to;

  const dateRange: DateRange | undefined =
    currentFrom && currentTo ? { from: currentFrom, to: currentTo } : undefined;

  const setDateRange = useCallback(
    (range: DateRange | undefined) => {
      if (range?.from && range?.to) {
        setStoredRange(range.from, range.to);
        setFrom(range.from);
        setTo(range.to);
      }
    },
    [setFrom, setTo]
  );

  const clearDateRange = useCallback(() => {
    setStoredRange(null, null);
    setFrom(null);
    setTo(null);
  }, [setFrom, setTo]);

  const hasDateFilter = Boolean(currentFrom && currentTo);

  // Consider hydrated if we have URL params or we're on the client
  const hydrated = typeof window !== 'undefined';

  return {
    from: currentFrom,
    to: currentTo,
    dateRange,
    setDateRange,
    clearDateRange,
    hasDateFilter,
    hydrated
  };
}
