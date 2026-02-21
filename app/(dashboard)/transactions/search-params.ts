import { createLoader, parseAsString, parseAsInteger, parseAsStringLiteral } from 'nuqs/server';

const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'] as const;
export const DEFAULT_PAGE_SIZE = 20;

/**
 * URL state for /transactions page:
 * - category: filter by category ID (null = all categories)
 * - search: merchant name search (case-insensitive)
 * - startDate: filter transactions on or after this date (YYYY-MM-DD)
 * - endDate: filter transactions before this date (YYYY-MM-DD)
 * - page: 1-indexed page number
 * - pageSize: items per page (10, 20, 50, 100)
 */
export const searchParams = {
  category: parseAsString, // null = all
  search: parseAsString, // null = no search
  startDate: parseAsString, // YYYY-MM-DD format
  endDate: parseAsString, // YYYY-MM-DD format
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsStringLiteral(PAGE_SIZE_OPTIONS).withDefault('20')
};

export const loadSearchParams = createLoader(searchParams);

export type TransactionsSearchParams = {
  category: string | null;
  search: string | null;
  startDate: string | null;
  endDate: string | null;
  page: number;
};

/**
 * Parse date string (YYYY-MM-DD) to Date object.
 * Returns null if invalid.
 */
export function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Format Date to YYYY-MM-DD string for URL params.
 */
export function formatDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
