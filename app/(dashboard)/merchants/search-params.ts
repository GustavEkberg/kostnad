import { createLoader, parseAsString, parseAsStringLiteral } from 'nuqs/server';

export const timeframeValues = ['week', 'month', 'year'] as const;
export type Timeframe = (typeof timeframeValues)[number];

/**
 * URL state for /merchants page:
 * - timeframe: week, month, or year
 * - period: ISO period string (e.g., "2026-01" for month, null = current)
 * - search: filter merchants by name
 */
export const searchParams = {
  timeframe: parseAsStringLiteral(timeframeValues).withDefault('month'),
  period: parseAsString,
  search: parseAsString
};

export const loadSearchParams = createLoader(searchParams);

export type MerchantsSearchParams = {
  timeframe: Timeframe;
  period: string | null;
  search: string | null;
};
