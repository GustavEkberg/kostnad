import { createLoader, parseAsString, parseAsStringLiteral } from 'nuqs/server';

// Timeframe type: week, month, year
export const timeframeValues = ['week', 'month', 'year'] as const;
export type Timeframe = (typeof timeframeValues)[number];

// Period offset: ISO date string representing the start of the period
// e.g., "2026-01" for month, "2026-W04" for week, "2026" for year
// null = current period
export const searchParams = {
  timeframe: parseAsStringLiteral(timeframeValues).withDefault('month'),
  period: parseAsString // null = current period
};

export const loadSearchParams = createLoader(searchParams);

/**
 * Calculate date range for a given timeframe and period.
 * Period format:
 * - month: "2026-01" (YYYY-MM)
 * - week: "2026-W04" (YYYY-Www)
 * - year: "2026" (YYYY)
 */
export function getDateRange(
  timeframe: Timeframe,
  period: string | null
): { startDate: Date; endDate: Date; label: string } {
  const now = new Date();

  if (timeframe === 'month') {
    let year: number;
    let month: number;

    if (period) {
      const match = period.match(/^(\d{4})-(\d{2})$/);
      if (match) {
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10) - 1; // JS months are 0-indexed
      } else {
        year = now.getFullYear();
        month = now.getMonth();
      }
    } else {
      year = now.getFullYear();
      month = now.getMonth();
    }

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 1);
    const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
      startDate
    );

    return { startDate, endDate, label };
  }

  if (timeframe === 'week') {
    let weekStart: Date;

    if (period) {
      const match = period.match(/^(\d{4})-W(\d{2})$/);
      if (match) {
        weekStart = getWeekStartFromISO(parseInt(match[1], 10), parseInt(match[2], 10));
      } else {
        weekStart = getWeekStart(now);
      }
    } else {
      weekStart = getWeekStart(now);
    }

    const endDate = new Date(weekStart);
    endDate.setDate(endDate.getDate() + 7);

    const weekEnd = new Date(endDate);
    weekEnd.setDate(weekEnd.getDate() - 1);

    const label = `${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}`;

    return { startDate: weekStart, endDate, label };
  }

  // year
  let year: number;

  if (period) {
    const match = period.match(/^(\d{4})$/);
    year = match ? parseInt(match[1], 10) : now.getFullYear();
  } else {
    year = now.getFullYear();
  }

  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);
  const label = year.toString();

  return { startDate, endDate, label };
}

/**
 * Get Monday of the week containing the given date (ISO week)
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get Monday of the given ISO week number
 */
function getWeekStartFromISO(year: number, week: number): Date {
  // Jan 4 is always in week 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // Convert Sunday (0) to 7
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1);

  const result = new Date(week1Monday);
  result.setDate(result.getDate() + (week - 1) * 7);
  return result;
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

/**
 * Get the period string for navigating to previous/next period
 */
export function getPeriodOffset(
  timeframe: Timeframe,
  period: string | null,
  offset: number
): string {
  const { startDate } = getDateRange(timeframe, period);

  if (timeframe === 'month') {
    const newDate = new Date(startDate);
    newDate.setMonth(newDate.getMonth() + offset);
    const year = newDate.getFullYear();
    const month = (newDate.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  if (timeframe === 'week') {
    const newDate = new Date(startDate);
    newDate.setDate(newDate.getDate() + offset * 7);
    return formatISOWeek(newDate);
  }

  // year
  const newYear = startDate.getFullYear() + offset;
  return newYear.toString();
}

/**
 * Format date as ISO week string (YYYY-Www)
 */
export function formatISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  // January 4 is always in week 1
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}

/**
 * Convert a period from one timeframe to another, preserving the end of the period.
 * E.g., March 2025 -> last week of March 2025
 */
export function convertPeriod(
  fromTimeframe: Timeframe,
  toTimeframe: Timeframe,
  period: string | null
): string | null {
  if (period === null) return null;
  if (fromTimeframe === toTimeframe) return period;

  // Get the end date of the current period (exclusive end - 1 day = last day of period)
  const { endDate } = getDateRange(fromTimeframe, period);
  const lastDayOfPeriod = new Date(endDate);
  lastDayOfPeriod.setDate(lastDayOfPeriod.getDate() - 1);

  // Convert to the target timeframe format
  if (toTimeframe === 'month') {
    const year = lastDayOfPeriod.getFullYear();
    const month = (lastDayOfPeriod.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  if (toTimeframe === 'week') {
    return formatISOWeek(lastDayOfPeriod);
  }

  // year
  return lastDayOfPeriod.getFullYear().toString();
}

/**
 * Check if period is current (null or matches current period)
 */
export function isCurrentPeriod(timeframe: Timeframe, period: string | null): boolean {
  if (period === null) return true;

  const now = new Date();

  if (timeframe === 'month') {
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return period === `${year}-${month}`;
  }

  if (timeframe === 'week') {
    return period === formatISOWeek(now);
  }

  return period === now.getFullYear().toString();
}

/**
 * Get the comparison date range for the previous period (MoM/WoW/YoY).
 */
export function getPreviousPeriodRange(
  timeframe: Timeframe,
  period: string | null
): { startDate: Date; endDate: Date } {
  const current = getDateRange(timeframe, period);

  if (timeframe === 'month') {
    const prevStart = new Date(current.startDate);
    prevStart.setMonth(prevStart.getMonth() - 1);
    const prevEnd = new Date(prevStart);
    prevEnd.setMonth(prevEnd.getMonth() + 1);
    return { startDate: prevStart, endDate: prevEnd };
  }

  if (timeframe === 'week') {
    const prevStart = new Date(current.startDate);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(prevStart);
    prevEnd.setDate(prevEnd.getDate() + 7);
    return { startDate: prevStart, endDate: prevEnd };
  }

  // year
  const prevStart = new Date(current.startDate);
  prevStart.setFullYear(prevStart.getFullYear() - 1);
  const prevEnd = new Date(current.endDate);
  prevEnd.setFullYear(prevEnd.getFullYear() - 1);
  return { startDate: prevStart, endDate: prevEnd };
}

/**
 * Get the same period from the previous year (YoY comparison).
 * For month: same month last year
 * For week: same ISO week last year
 * For year: the year before
 */
export function getYearAgoRange(
  timeframe: Timeframe,
  period: string | null
): { startDate: Date; endDate: Date } {
  const current = getDateRange(timeframe, period);

  const yearAgoStart = new Date(current.startDate);
  yearAgoStart.setFullYear(yearAgoStart.getFullYear() - 1);
  const yearAgoEnd = new Date(current.endDate);
  yearAgoEnd.setFullYear(yearAgoEnd.getFullYear() - 1);

  return { startDate: yearAgoStart, endDate: yearAgoEnd };
}
