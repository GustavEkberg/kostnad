import { createLoader, parseAsIsoDate } from 'nuqs/server';

/**
 * URL state for /categories/[id] page:
 * - from: start date for filtering stats
 * - to: end date for filtering stats
 */
export const searchParams = {
  from: parseAsIsoDate,
  to: parseAsIsoDate
};

export const loadSearchParams = createLoader(searchParams);

export type CategoryDetailSearchParams = {
  from: Date | null;
  to: Date | null;
};
