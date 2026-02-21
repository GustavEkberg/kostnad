import { createLoader, parseAsInteger, parseAsStringLiteral, parseAsIsoDate } from 'nuqs/server';

export const timeframeValues = ['week', 'month', 'year'] as const;
export type Timeframe = (typeof timeframeValues)[number];

/**
 * URL state for /merchant/[id] page:
 * - timeframe: week, month, or year (for trends)
 * - page: transaction list pagination
 * - from/to: date range for stats filtering
 */
export const searchParams = {
  timeframe: parseAsStringLiteral(timeframeValues).withDefault('month'),
  page: parseAsInteger.withDefault(1),
  from: parseAsIsoDate,
  to: parseAsIsoDate
};

export const loadSearchParams = createLoader(searchParams);

export type MerchantDetailSearchParams = {
  timeframe: Timeframe;
  page: number;
  from: Date | null;
  to: Date | null;
};
