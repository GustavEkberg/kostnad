import { Effect } from 'effect';
import { Db } from '@/lib/services/db/live-layer';
import * as schema from '@/lib/services/db/schema';
import { eq, and, isNull, gte, lt, sql, desc, asc, ilike, count } from 'drizzle-orm';

type DateRange = {
  startDate: Date;
  endDate: Date;
};

type CategorySummary = {
  categoryId: string | null;
  categoryName: string | null;
  total: number;
  count: number;
};

/**
 * Get transaction totals grouped by category within a date range.
 * Returns sum of amounts and transaction count per category.
 */
export const getTransactionSummary = (range: DateRange) =>
  Effect.gen(function* () {
    const db = yield* Db;

    const results = yield* db
      .select({
        categoryId: schema.transaction.categoryId,
        categoryName: schema.category.name,
        total: sql<string>`sum(${schema.transaction.amount})`.as('total'),
        count: sql<number>`count(*)::int`.as('count')
      })
      .from(schema.transaction)
      .leftJoin(schema.category, eq(schema.transaction.categoryId, schema.category.id))
      .where(
        and(
          gte(schema.transaction.date, range.startDate),
          lt(schema.transaction.date, range.endDate)
        )
      )
      .groupBy(schema.transaction.categoryId, schema.category.name);

    return results.map(
      (row): CategorySummary => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        total: parseFloat(row.total ?? '0'),
        count: row.count
      })
    );
  }).pipe(Effect.withSpan('Transaction.getSummary'));

/**
 * Get total income (sum of positive amounts) within a date range.
 */
export const getTotalIncome = (range: DateRange) =>
  Effect.gen(function* () {
    const db = yield* Db;

    const [result] = yield* db
      .select({
        total: sql<string>`coalesce(sum(${schema.transaction.amount}), 0)`.as('total')
      })
      .from(schema.transaction)
      .where(
        and(
          gte(schema.transaction.date, range.startDate),
          lt(schema.transaction.date, range.endDate),
          sql`${schema.transaction.amount} > 0`
        )
      );

    return parseFloat(result?.total ?? '0');
  }).pipe(Effect.withSpan('Transaction.getTotalIncome'));

/**
 * Get total expenses (sum of negative amounts) within a date range.
 * Returns a positive number representing the absolute expense total.
 */
export const getTotalExpenses = (range: DateRange) =>
  Effect.gen(function* () {
    const db = yield* Db;

    const [result] = yield* db
      .select({
        total: sql<string>`coalesce(sum(${schema.transaction.amount}), 0)`.as('total')
      })
      .from(schema.transaction)
      .where(
        and(
          gte(schema.transaction.date, range.startDate),
          lt(schema.transaction.date, range.endDate),
          sql`${schema.transaction.amount} < 0`
        )
      );

    // Return absolute value (expenses are stored as negative)
    return Math.abs(parseFloat(result?.total ?? '0'));
  }).pipe(Effect.withSpan('Transaction.getTotalExpenses'));

/**
 * Get count of uncategorized transactions.
 */
export const getUncategorizedCount = () =>
  Effect.gen(function* () {
    const db = yield* Db;

    const [result] = yield* db
      .select({ count: count() })
      .from(schema.transaction)
      .where(isNull(schema.transaction.categoryId));

    return result?.count ?? 0;
  }).pipe(Effect.withSpan('Transaction.getUncategorizedCount'));

/**
 * Get all transactions that have no category assigned.
 * Ordered by date descending (newest first).
 */
export const getUncategorizedTransactions = () =>
  Effect.gen(function* () {
    const db = yield* Db;

    const transactions = yield* db
      .select({
        id: schema.transaction.id,
        date: schema.transaction.date,
        merchant: schema.transaction.merchant,
        amount: schema.transaction.amount,
        balance: schema.transaction.balance
      })
      .from(schema.transaction)
      .where(isNull(schema.transaction.categoryId))
      .orderBy(desc(schema.transaction.date));

    return transactions.map(tx => ({
      ...tx,
      amount: parseFloat(tx.amount),
      balance: tx.balance ? parseFloat(tx.balance) : null
    }));
  }).pipe(Effect.withSpan('Transaction.getUncategorized'));

/**
 * Get all categories ordered by name.
 */
export const getAllCategories = () =>
  Effect.gen(function* () {
    const db = yield* Db;

    const categories = yield* db
      .select({
        id: schema.category.id,
        name: schema.category.name,
        description: schema.category.description,
        icon: schema.category.icon,
        isDefault: schema.category.isDefault
      })
      .from(schema.category)
      .orderBy(asc(schema.category.name));

    return categories;
  }).pipe(Effect.withSpan('Category.getAll'));

/**
 * Get all multi-merchant patterns.
 * These are umbrella merchants that always require manual review.
 */
export const getMultiMerchantPatterns = () =>
  Effect.gen(function* () {
    const db = yield* Db;

    const mappings = yield* db
      .select({
        merchantPattern: schema.merchantMapping.merchantPattern
      })
      .from(schema.merchantMapping)
      .where(eq(schema.merchantMapping.isMultiMerchant, true));

    return mappings.map(m => m.merchantPattern);
  }).pipe(Effect.withSpan('MerchantMapping.getMultiPatterns'));

export type CategoryWithDetails = {
  id: string;
  name: string;
  icon: string | null;
  isDefault: boolean;
  transactionCount: number;
  merchantMappings: Array<{ id: string; merchantPattern: string }>;
};

/**
 * Get all categories with transaction counts and merchant mappings.
 * Ordered by name ascending.
 */
export const getCategoriesWithDetails = () =>
  Effect.gen(function* () {
    const db = yield* Db;

    // Get categories with transaction counts
    const categoriesWithCounts = yield* db
      .select({
        id: schema.category.id,
        name: schema.category.name,
        icon: schema.category.icon,
        isDefault: schema.category.isDefault,
        transactionCount: sql<number>`count(${schema.transaction.id})::int`.as('transactionCount')
      })
      .from(schema.category)
      .leftJoin(schema.transaction, eq(schema.category.id, schema.transaction.categoryId))
      .groupBy(
        schema.category.id,
        schema.category.name,
        schema.category.icon,
        schema.category.isDefault
      )
      .orderBy(asc(schema.category.name));

    // Get all merchant mappings (excluding multi-merchant entries)
    const mappings = yield* db
      .select({
        id: schema.merchantMapping.id,
        merchantPattern: schema.merchantMapping.merchantPattern,
        categoryId: schema.merchantMapping.categoryId
      })
      .from(schema.merchantMapping)
      .where(eq(schema.merchantMapping.isMultiMerchant, false))
      .orderBy(asc(schema.merchantMapping.merchantPattern));

    // Group mappings by category
    const mappingsByCategory = new Map<string, Array<{ id: string; merchantPattern: string }>>();
    for (const mapping of mappings) {
      // Skip mappings without category (shouldn't happen with the filter, but type-safe)
      if (mapping.categoryId === null) continue;
      const existing = mappingsByCategory.get(mapping.categoryId) ?? [];
      existing.push({ id: mapping.id, merchantPattern: mapping.merchantPattern });
      mappingsByCategory.set(mapping.categoryId, existing);
    }

    return categoriesWithCounts.map(
      (cat): CategoryWithDetails => ({
        ...cat,
        merchantMappings: mappingsByCategory.get(cat.id) ?? []
      })
    );
  }).pipe(Effect.withSpan('Category.getWithDetails'));

export type TransactionsFilter = {
  categoryId: string | null; // null = all, 'uncategorized' = only null categoryId
  search: string | null;
  startDate: Date | null;
  endDate: Date | null;
};

export type PaginatedTransactions = {
  items: Array<{
    id: string;
    date: Date;
    merchant: string;
    amount: number;
    balance: number | null;
    categoryId: string | null;
    categoryName: string | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Get transactions with filters and pagination.
 * - Ordered by date descending (newest first)
 * - Supports category filter, merchant search, date range
 */
export const getTransactions = (filter: TransactionsFilter, page: number, pageSize: number) =>
  Effect.gen(function* () {
    const db = yield* Db;

    // Build where conditions
    const conditions = [];

    // Category filter
    if (filter.categoryId === 'uncategorized') {
      conditions.push(isNull(schema.transaction.categoryId));
    } else if (filter.categoryId !== null) {
      conditions.push(eq(schema.transaction.categoryId, filter.categoryId));
    }

    // Merchant search (case-insensitive)
    if (filter.search) {
      conditions.push(ilike(schema.transaction.merchant, `%${filter.search}%`));
    }

    // Date range
    if (filter.startDate) {
      conditions.push(gte(schema.transaction.date, filter.startDate));
    }
    if (filter.endDate) {
      conditions.push(lt(schema.transaction.date, filter.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = yield* db
      .select({ total: count() })
      .from(schema.transaction)
      .where(whereClause);

    const total = countResult?.total ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    // Get paginated items
    const offset = (page - 1) * pageSize;
    const items = yield* db
      .select({
        id: schema.transaction.id,
        date: schema.transaction.date,
        merchant: schema.transaction.merchant,
        amount: schema.transaction.amount,
        balance: schema.transaction.balance,
        categoryId: schema.transaction.categoryId,
        categoryName: schema.category.name
      })
      .from(schema.transaction)
      .leftJoin(schema.category, eq(schema.transaction.categoryId, schema.category.id))
      .where(whereClause)
      .orderBy(desc(schema.transaction.date))
      .limit(pageSize)
      .offset(offset);

    return {
      items: items.map(tx => ({
        ...tx,
        amount: parseFloat(tx.amount),
        balance: tx.balance ? parseFloat(tx.balance) : null
      })),
      total,
      page,
      pageSize,
      totalPages
    };
  }).pipe(Effect.withSpan('Transaction.getTransactions'));

type UpcomingExpense = {
  merchant: string;
  expectedAmount: number;
  expectedDate: Date;
  daysUntil: number;
  categoryId: string | null;
  categoryName: string | null;
};

/**
 * Detect upcoming expenses based on yearly recurring patterns.
 * Looks for same merchant with similar amount (±20%) occurring ~12 months apart.
 * Returns expenses expected in next 60 days.
 */
export const getUpcomingExpenses = () =>
  Effect.gen(function* () {
    const db = yield* Db;
    const now = new Date();
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    // Get all expenses (negative amounts) with their dates
    const expenses = yield* db
      .select({
        merchant: schema.transaction.merchant,
        amount: schema.transaction.amount,
        date: schema.transaction.date,
        categoryId: schema.transaction.categoryId,
        categoryName: schema.category.name
      })
      .from(schema.transaction)
      .leftJoin(schema.category, eq(schema.transaction.categoryId, schema.category.id))
      .where(sql`${schema.transaction.amount} < 0`)
      .orderBy(schema.transaction.merchant, desc(schema.transaction.date));

    // Group transactions by merchant
    const byMerchant = new Map<
      string,
      Array<{ amount: number; date: Date; categoryId: string | null; categoryName: string | null }>
    >();
    for (const tx of expenses) {
      const key = tx.merchant.toLowerCase().trim();
      const existing = byMerchant.get(key) ?? [];
      existing.push({
        amount: parseFloat(tx.amount),
        date: tx.date,
        categoryId: tx.categoryId,
        categoryName: tx.categoryName
      });
      byMerchant.set(key, existing);
    }

    const upcomingExpenses: UpcomingExpense[] = [];
    const tolerancePercent = 0.2; // ±20%
    const yearInMs = 365 * 24 * 60 * 60 * 1000;
    const monthInMs = 30 * 24 * 60 * 60 * 1000;

    for (const [merchant, txs] of byMerchant) {
      // Need at least 2 transactions to detect a pattern
      if (txs.length < 2) continue;

      // Sort by date descending (most recent first)
      txs.sort((a, b) => b.date.getTime() - a.date.getTime());

      const mostRecent = txs[0];

      // Look for a yearly pattern by checking if there's a transaction ~12 months before
      for (let i = 1; i < txs.length; i++) {
        const older = txs[i];
        const timeDiff = mostRecent.date.getTime() - older.date.getTime();

        // Check if ~12 months apart (10-14 months window)
        if (timeDiff >= 10 * monthInMs && timeDiff <= 14 * monthInMs) {
          // Check if amounts are similar (±20%)
          const avgAmount = (Math.abs(mostRecent.amount) + Math.abs(older.amount)) / 2;
          const diff = Math.abs(Math.abs(mostRecent.amount) - Math.abs(older.amount));

          if (diff / avgAmount <= tolerancePercent) {
            // Found yearly recurring pattern - predict next occurrence
            const expectedDate = new Date(mostRecent.date.getTime() + yearInMs);
            const daysUntil = Math.ceil(
              (expectedDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
            );

            // Only include if expected in next 60 days and not in the past
            if (daysUntil > 0 && expectedDate <= sixtyDaysFromNow) {
              // Find original merchant name (preserve casing from most recent)
              const originalMerchant =
                expenses.find(e => e.merchant.toLowerCase().trim() === merchant)?.merchant ??
                merchant;

              upcomingExpenses.push({
                merchant: originalMerchant,
                expectedAmount: Math.abs(avgAmount),
                expectedDate,
                daysUntil,
                categoryId: mostRecent.categoryId,
                categoryName: mostRecent.categoryName
              });
            }
            break; // Found pattern for this merchant
          }
        }
      }
    }

    // Sort by days until (soonest first)
    return upcomingExpenses.sort((a, b) => a.daysUntil - b.daysUntil);
  }).pipe(Effect.withSpan('Transaction.getUpcomingExpenses'));

/**
 * Get all transactions within a date range with their categories.
 * Ordered by date descending (newest first).
 */
export const getTransactionsWithCategory = (range: DateRange) =>
  Effect.gen(function* () {
    const db = yield* Db;

    const results = yield* db
      .select({
        id: schema.transaction.id,
        date: schema.transaction.date,
        merchant: schema.transaction.merchant,
        amount: schema.transaction.amount,
        balance: schema.transaction.balance,
        categoryId: schema.transaction.categoryId,
        uploadId: schema.transaction.uploadId,
        originalHash: schema.transaction.originalHash,
        createdAt: schema.transaction.createdAt,
        updatedAt: schema.transaction.updatedAt,
        category: schema.category
      })
      .from(schema.transaction)
      .leftJoin(schema.category, eq(schema.transaction.categoryId, schema.category.id))
      .where(
        and(
          gte(schema.transaction.date, range.startDate),
          lt(schema.transaction.date, range.endDate)
        )
      )
      .orderBy(desc(schema.transaction.date));

    return results;
  }).pipe(Effect.withSpan('Transaction.getTransactionsWithCategory'));

export type Timeframe = 'week' | 'month' | 'year';

export type PeriodTrend = {
  period: string; // "W04", "Jan", or "2026"
  periodKey: string; // "2026-W04", "2026-01", or "2026" (for URL navigation)
  income: number;
  expenses: number; // Positive number
  net: number;
};

/**
 * Get income/expense trends for the last N periods based on timeframe.
 * - week: last N weeks (ISO week format "YYYY-Www")
 * - month: last N months ("YYYY-MM")
 * - year: last N years ("YYYY")
 *
 * @param endPeriod - Optional period to end at (e.g., "2025-03" for month).
 *                    If null, uses current period.
 *
 * Returns all periods including those with no transactions (zeroed).
 */
export const getPeriodTrends = (
  timeframe: Timeframe,
  count: number,
  endPeriod: string | null = null
) =>
  Effect.gen(function* () {
    const db = yield* Db;

    // Determine the end period reference date
    const endRef = getEndReferenceDate(timeframe, endPeriod);

    // Generate all periods we want to show
    const periods: Array<{ key: string; label: string; start: Date; end: Date }> = [];

    if (timeframe === 'week') {
      const endWeekStart = getWeekStart(endRef);
      for (let i = count - 1; i >= 0; i--) {
        const weekStart = new Date(endWeekStart);
        weekStart.setDate(weekStart.getDate() - i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weekNum = getISOWeekNumber(weekStart);
        periods.push({
          key: `${weekStart.getFullYear()}-W${String(weekNum).padStart(2, '0')}`,
          label: `W${weekNum}`,
          start: weekStart,
          end: weekEnd
        });
      }
    } else if (timeframe === 'month') {
      for (let i = count - 1; i >= 0; i--) {
        const monthStart = new Date(endRef.getFullYear(), endRef.getMonth() - i, 1);
        const monthEnd = new Date(endRef.getFullYear(), endRef.getMonth() - i + 1, 1);
        const monthLabel = monthStart.toLocaleString('en-US', { month: 'short' });
        periods.push({
          key: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
          label: monthLabel,
          start: monthStart,
          end: monthEnd
        });
      }
    } else {
      // year
      for (let i = count - 1; i >= 0; i--) {
        const yearStart = new Date(endRef.getFullYear() - i, 0, 1);
        const yearEnd = new Date(endRef.getFullYear() - i + 1, 0, 1);
        periods.push({
          key: String(yearStart.getFullYear()),
          label: String(yearStart.getFullYear()),
          start: yearStart,
          end: yearEnd
        });
      }
    }

    // Query all data in range
    const startDate = periods[0].start;
    const endDate = periods[periods.length - 1].end;

    const results = yield* db
      .select({
        date: schema.transaction.date,
        amount: schema.transaction.amount
      })
      .from(schema.transaction)
      .where(and(gte(schema.transaction.date, startDate), lt(schema.transaction.date, endDate)));

    // Aggregate into periods
    const periodMap = new Map<string, { income: number; expenses: number }>();
    for (const p of periods) {
      periodMap.set(p.key, { income: 0, expenses: 0 });
    }

    for (const row of results) {
      const txDate = row.date;
      // Find which period this transaction belongs to
      for (const p of periods) {
        if (txDate >= p.start && txDate < p.end) {
          const entry = periodMap.get(p.key);
          if (entry) {
            const amount = parseFloat(row.amount);
            if (amount > 0) {
              entry.income += amount;
            } else {
              entry.expenses += Math.abs(amount);
            }
          }
          break;
        }
      }
    }

    return periods.map((p): PeriodTrend => {
      const data = periodMap.get(p.key) ?? { income: 0, expenses: 0 };
      return {
        period: p.label,
        periodKey: p.key,
        income: data.income,
        expenses: data.expenses,
        net: data.income - data.expenses
      };
    });
  }).pipe(Effect.withSpan('Transaction.getPeriodTrends'));

/**
 * Parse a period string and return a reference date for that period.
 * Returns current date if period is null or invalid.
 */
function getEndReferenceDate(timeframe: Timeframe, period: string | null): Date {
  const now = new Date();
  if (!period) return now;

  if (timeframe === 'month') {
    const match = period.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, 1);
    }
  } else if (timeframe === 'week') {
    const match = period.match(/^(\d{4})-W(\d{2})$/);
    if (match) {
      return getWeekStartFromISO(parseInt(match[1], 10), parseInt(match[2], 10));
    }
  } else {
    const match = period.match(/^(\d{4})$/);
    if (match) {
      return new Date(parseInt(match[1], 10), 0, 1);
    }
  }

  return now;
}

/**
 * Get Monday of the given ISO week number.
 */
function getWeekStartFromISO(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1);
  const result = new Date(week1Monday);
  result.setDate(result.getDate() + (week - 1) * 7);
  return result;
}

/**
 * Get Monday of the week containing the given date (ISO week).
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get ISO week number (1-53) for a given date.
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export type MerchantWithTotal = {
  id: string;
  merchantPattern: string;
  categoryId: string | null;
  categoryName: string | null;
  isMultiMerchant: boolean;
  totalExpenses: number;
  transactionCount: number;
};

/**
 * Get all merchant mappings with their expense totals within a date range.
 * Aggregates transactions by matching merchant to merchantPattern.
 */
export const getMerchantsWithTotals = (range: DateRange) =>
  Effect.gen(function* () {
    const db = yield* Db;

    // Get all merchant mappings with category info
    const mappings = yield* db
      .select({
        id: schema.merchantMapping.id,
        merchantPattern: schema.merchantMapping.merchantPattern,
        categoryId: schema.merchantMapping.categoryId,
        categoryName: schema.category.name,
        isMultiMerchant: schema.merchantMapping.isMultiMerchant
      })
      .from(schema.merchantMapping)
      .leftJoin(schema.category, eq(schema.merchantMapping.categoryId, schema.category.id))
      .orderBy(asc(schema.merchantMapping.merchantPattern));

    // Get expense transactions in date range
    const transactions = yield* db
      .select({
        merchant: schema.transaction.merchant,
        amount: schema.transaction.amount
      })
      .from(schema.transaction)
      .where(
        and(
          gte(schema.transaction.date, range.startDate),
          lt(schema.transaction.date, range.endDate),
          sql`${schema.transaction.amount} < 0`
        )
      );

    // Aggregate by merchant pattern (case-insensitive substring match like upload)
    const result: MerchantWithTotal[] = mappings.map(mapping => {
      const patternLower = mapping.merchantPattern.toLowerCase();
      let totalExpenses = 0;
      let transactionCount = 0;

      for (const tx of transactions) {
        if (tx.merchant.toLowerCase().includes(patternLower)) {
          totalExpenses += Math.abs(parseFloat(tx.amount));
          transactionCount++;
        }
      }

      return {
        id: mapping.id,
        merchantPattern: mapping.merchantPattern,
        categoryId: mapping.categoryId,
        categoryName: mapping.categoryName,
        isMultiMerchant: mapping.isMultiMerchant,
        totalExpenses,
        transactionCount
      };
    });

    // Sort by total expenses descending
    return result.sort((a, b) => b.totalExpenses - a.totalExpenses);
  }).pipe(Effect.withSpan('Merchant.getMerchantsWithTotals'));

export type CategoryTrend = {
  categoryId: string | null;
  categoryName: string | null;
  data: Array<{ period: string; total: number }>;
};

/**
 * Get expense trends by category for the last N periods based on timeframe.
 * Returns each category's period totals (as positive numbers).
 *
 * @param endPeriod - Optional period to end at. If null, uses current period.
 */
export const getCategoryPeriodTrends = (
  timeframe: Timeframe,
  count: number,
  endPeriod: string | null = null
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const endRef = getEndReferenceDate(timeframe, endPeriod);

    // Calculate start and end date based on timeframe
    let startDate: Date;
    let endDate: Date;
    let periodFormat: ReturnType<typeof sql.raw>;

    if (timeframe === 'week') {
      const endWeekStart = getWeekStart(endRef);
      endDate = new Date(endWeekStart);
      endDate.setDate(endDate.getDate() + 7); // End of selected week
      startDate = new Date(endWeekStart);
      startDate.setDate(startDate.getDate() - (count - 1) * 7);
      periodFormat = sql.raw(`'"W"IW'`); // "W04", "W05", etc.
    } else if (timeframe === 'month') {
      startDate = new Date(endRef.getFullYear(), endRef.getMonth() - count + 1, 1);
      endDate = new Date(endRef.getFullYear(), endRef.getMonth() + 1, 1); // End of selected month
      periodFormat = sql.raw(`'Mon'`); // "Jan", "Feb", etc.
    } else {
      startDate = new Date(endRef.getFullYear() - count + 1, 0, 1);
      endDate = new Date(endRef.getFullYear() + 1, 0, 1); // End of selected year
      periodFormat = sql.raw(`'YYYY'`); // "2026"
    }

    const results = yield* db
      .select({
        period: sql<string>`to_char(${schema.transaction.date}, ${periodFormat})`.as('period'),
        categoryId: schema.transaction.categoryId,
        categoryName: schema.category.name,
        total: sql<string>`abs(sum(${schema.transaction.amount}))`.as('total')
      })
      .from(schema.transaction)
      .leftJoin(schema.category, eq(schema.transaction.categoryId, schema.category.id))
      .where(
        and(
          gte(schema.transaction.date, startDate),
          lt(schema.transaction.date, endDate),
          sql`${schema.transaction.amount} < 0`
        )
      )
      .groupBy(
        sql`to_char(${schema.transaction.date}, ${periodFormat})`,
        schema.transaction.categoryId,
        schema.category.name
      )
      .orderBy(sql`to_char(${schema.transaction.date}, ${periodFormat})`);

    // Group by category
    const byCategory = new Map<
      string,
      { categoryId: string | null; categoryName: string | null; data: Map<string, number> }
    >();

    for (const row of results) {
      const key = row.categoryId ?? '__uncategorized__';
      let entry = byCategory.get(key);
      if (!entry) {
        entry = {
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          data: new Map()
        };
        byCategory.set(key, entry);
      }
      entry.data.set(row.period, parseFloat(row.total ?? '0'));
    }

    return Array.from(byCategory.values()).map(
      (entry): CategoryTrend => ({
        categoryId: entry.categoryId,
        categoryName: entry.categoryName,
        data: Array.from(entry.data.entries())
          .map(([period, total]) => ({ period, total }))
          .sort((a, b) => a.period.localeCompare(b.period))
      })
    );
  }).pipe(Effect.withSpan('Transaction.getCategoryPeriodTrends'));

export type TopMerchant = {
  merchant: string;
  total: number;
};

/**
 * Get top merchants by expense total within a date range.
 * Groups by merchant name (case-insensitive) and returns top N.
 */
export const getTopMerchants = (range: DateRange, limit: number = 10) =>
  Effect.gen(function* () {
    const db = yield* Db;

    const results = yield* db
      .select({
        merchant: sql<string>`lower(${schema.transaction.merchant})`.as('merchant'),
        total: sql<string>`abs(sum(${schema.transaction.amount}))`.as('total')
      })
      .from(schema.transaction)
      .where(
        and(
          gte(schema.transaction.date, range.startDate),
          lt(schema.transaction.date, range.endDate),
          sql`${schema.transaction.amount} < 0`
        )
      )
      .groupBy(sql`lower(${schema.transaction.merchant})`)
      .orderBy(desc(sql`abs(sum(${schema.transaction.amount}))`))
      .limit(limit);

    // Get original merchant names (preserving case from first occurrence)
    const merchantNames = yield* db
      .selectDistinctOn([sql`lower(${schema.transaction.merchant})`], {
        merchant: schema.transaction.merchant,
        merchantLower: sql<string>`lower(${schema.transaction.merchant})`.as('merchant_lower')
      })
      .from(schema.transaction)
      .where(
        and(
          gte(schema.transaction.date, range.startDate),
          lt(schema.transaction.date, range.endDate),
          sql`${schema.transaction.amount} < 0`
        )
      );

    const nameMap = new Map(merchantNames.map(m => [m.merchantLower, m.merchant]));

    return results.map(
      (row): TopMerchant => ({
        merchant: nameMap.get(row.merchant) ?? row.merchant,
        total: parseFloat(row.total ?? '0')
      })
    );
  }).pipe(Effect.withSpan('Transaction.getTopMerchants'));

////////////////////////////////////////////////////////////////////////
// MERCHANT DETAIL QUERIES
////////////////////////////////////////////////////////////////////////

export type MerchantDetail = {
  id: string;
  merchantPattern: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  isMultiMerchant: boolean;
};

/**
 * Find merchant mapping ID by matching a merchant name.
 * Uses the same case-insensitive substring match as upload.
 * Returns the first matching mapping ID, or null if none found.
 */
export const findMerchantMappingId = (merchantName: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const merchantLower = merchantName.toLowerCase();

    const mappings = yield* db
      .select({
        id: schema.merchantMapping.id,
        merchantPattern: schema.merchantMapping.merchantPattern
      })
      .from(schema.merchantMapping);

    // Find matching mapping using same logic as upload
    for (const mapping of mappings) {
      if (merchantLower.includes(mapping.merchantPattern.toLowerCase())) {
        return mapping.id;
      }
    }

    return null;
  }).pipe(Effect.withSpan('Merchant.findMappingId'));

/**
 * Get merchant mapping by ID.
 * Returns null if not found.
 */
export const getMerchantById = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;

    const [result] = yield* db
      .select({
        id: schema.merchantMapping.id,
        merchantPattern: schema.merchantMapping.merchantPattern,
        categoryId: schema.merchantMapping.categoryId,
        categoryName: schema.category.name,
        categoryIcon: schema.category.icon,
        isMultiMerchant: schema.merchantMapping.isMultiMerchant
      })
      .from(schema.merchantMapping)
      .leftJoin(schema.category, eq(schema.merchantMapping.categoryId, schema.category.id))
      .where(eq(schema.merchantMapping.id, id))
      .limit(1);

    return result ?? null;
  }).pipe(Effect.withSpan('Merchant.getById'));

export type MerchantStats = {
  totalExpenses: number;
  transactionCount: number;
  avgTransaction: number;
  firstTransaction: Date | null;
  lastTransaction: Date | null;
};

/**
 * Get aggregate stats for a merchant pattern.
 */
export const getMerchantStats = (merchantPattern: string, range?: DateRange) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const patternLower = merchantPattern.toLowerCase();

    // Build conditions
    const conditions = [sql`lower(${schema.transaction.merchant}) like ${`%${patternLower}%`}`];
    if (range) {
      conditions.push(gte(schema.transaction.date, range.startDate));
      conditions.push(lt(schema.transaction.date, range.endDate));
    }

    // Get all transactions matching this merchant
    const transactions = yield* db
      .select({
        amount: schema.transaction.amount,
        date: schema.transaction.date
      })
      .from(schema.transaction)
      .where(and(...conditions))
      .orderBy(asc(schema.transaction.date));

    if (transactions.length === 0) {
      return {
        totalExpenses: 0,
        transactionCount: 0,
        avgTransaction: 0,
        firstTransaction: null,
        lastTransaction: null
      } satisfies MerchantStats;
    }

    let totalExpenses = 0;
    let expenseCount = 0;

    for (const tx of transactions) {
      const amount = parseFloat(tx.amount);
      if (amount < 0) {
        totalExpenses += Math.abs(amount);
        expenseCount++;
      }
    }

    return {
      totalExpenses,
      transactionCount: transactions.length,
      avgTransaction: expenseCount > 0 ? totalExpenses / expenseCount : 0,
      firstTransaction: transactions[0].date,
      lastTransaction: transactions[transactions.length - 1].date
    } satisfies MerchantStats;
  }).pipe(Effect.withSpan('Merchant.getStats'));

/**
 * Get transactions for a merchant pattern with pagination.
 * Matches case-insensitive substring like upload matching.
 */
export const getMerchantTransactions = (
  merchantPattern: string,
  range: DateRange | null,
  page: number,
  pageSize: number
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const patternLower = merchantPattern.toLowerCase();

    // Build where conditions
    const conditions = [sql`lower(${schema.transaction.merchant}) like ${`%${patternLower}%`}`];

    if (range) {
      conditions.push(gte(schema.transaction.date, range.startDate));
      conditions.push(lt(schema.transaction.date, range.endDate));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = yield* db
      .select({ total: count() })
      .from(schema.transaction)
      .where(whereClause);

    const total = countResult?.total ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    // Get paginated items
    const offset = (page - 1) * pageSize;
    const items = yield* db
      .select({
        id: schema.transaction.id,
        date: schema.transaction.date,
        merchant: schema.transaction.merchant,
        amount: schema.transaction.amount,
        balance: schema.transaction.balance,
        categoryId: schema.transaction.categoryId,
        categoryName: schema.category.name
      })
      .from(schema.transaction)
      .leftJoin(schema.category, eq(schema.transaction.categoryId, schema.category.id))
      .where(whereClause)
      .orderBy(desc(schema.transaction.date))
      .limit(pageSize)
      .offset(offset);

    return {
      items: items.map(tx => ({
        ...tx,
        amount: parseFloat(tx.amount),
        balance: tx.balance ? parseFloat(tx.balance) : null
      })),
      total,
      page,
      pageSize,
      totalPages
    };
  }).pipe(Effect.withSpan('Merchant.getTransactions'));

export type MerchantPeriodTrend = {
  period: string;
  periodKey: string;
  expenses: number;
  transactionCount: number;
};

/**
 * Get expense trends for a specific merchant over periods.
 */
////////////////////////////////////////////////////////////////////////
// CATEGORY DETAIL QUERIES
////////////////////////////////////////////////////////////////////////

export type CategoryDetail = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  isDefault: boolean;
};

/**
 * Get category by ID.
 * Returns null if not found.
 */
export const getCategoryById = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;

    const [result] = yield* db
      .select({
        id: schema.category.id,
        name: schema.category.name,
        description: schema.category.description,
        icon: schema.category.icon,
        isDefault: schema.category.isDefault
      })
      .from(schema.category)
      .where(eq(schema.category.id, id))
      .limit(1);

    return result ?? null;
  }).pipe(Effect.withSpan('Category.getById'));

export type CategoryStats = {
  totalExpenses: number;
  totalIncome: number;
  transactionCount: number;
  avgTransaction: number;
  merchantCount: number;
  firstTransaction: Date | null;
  lastTransaction: Date | null;
};

/**
 * Get aggregate stats for a category.
 */
export const getCategoryStats = (categoryId: string, range?: DateRange) =>
  Effect.gen(function* () {
    const db = yield* Db;

    const conditions = [eq(schema.transaction.categoryId, categoryId)];
    if (range) {
      conditions.push(gte(schema.transaction.date, range.startDate));
      conditions.push(lt(schema.transaction.date, range.endDate));
    }

    const transactions = yield* db
      .select({
        amount: schema.transaction.amount,
        date: schema.transaction.date,
        merchant: schema.transaction.merchant
      })
      .from(schema.transaction)
      .where(and(...conditions))
      .orderBy(asc(schema.transaction.date));

    if (transactions.length === 0) {
      return {
        totalExpenses: 0,
        totalIncome: 0,
        transactionCount: 0,
        avgTransaction: 0,
        merchantCount: 0,
        firstTransaction: null,
        lastTransaction: null
      } satisfies CategoryStats;
    }

    let totalExpenses = 0;
    let totalIncome = 0;
    let expenseCount = 0;
    const merchants = new Set<string>();

    for (const tx of transactions) {
      const amount = parseFloat(tx.amount);
      merchants.add(tx.merchant.toLowerCase());
      if (amount < 0) {
        totalExpenses += Math.abs(amount);
        expenseCount++;
      } else {
        totalIncome += amount;
      }
    }

    return {
      totalExpenses,
      totalIncome,
      transactionCount: transactions.length,
      avgTransaction: expenseCount > 0 ? totalExpenses / expenseCount : 0,
      merchantCount: merchants.size,
      firstTransaction: transactions[0].date,
      lastTransaction: transactions[transactions.length - 1].date
    } satisfies CategoryStats;
  }).pipe(Effect.withSpan('Category.getStats'));

export type CategoryTopMerchant = {
  merchant: string;
  total: number;
  transactionCount: number;
};

/**
 * Get top merchants for a category by expense total.
 */
export const getCategoryTopMerchants = (
  categoryId: string,
  limit: number = 10,
  range?: DateRange
) =>
  Effect.gen(function* () {
    const db = yield* Db;

    const conditions = [
      eq(schema.transaction.categoryId, categoryId),
      sql`${schema.transaction.amount} < 0`
    ];
    if (range) {
      conditions.push(gte(schema.transaction.date, range.startDate));
      conditions.push(lt(schema.transaction.date, range.endDate));
    }

    const results = yield* db
      .select({
        merchant: sql<string>`lower(${schema.transaction.merchant})`.as('merchant'),
        total: sql<string>`abs(sum(${schema.transaction.amount}))`.as('total'),
        count: sql<number>`count(*)::int`.as('count')
      })
      .from(schema.transaction)
      .where(and(...conditions))
      .groupBy(sql`lower(${schema.transaction.merchant})`)
      .orderBy(desc(sql`abs(sum(${schema.transaction.amount}))`))
      .limit(limit);

    // Get original merchant names (preserving case)
    const nameConditions = [eq(schema.transaction.categoryId, categoryId)];
    if (range) {
      nameConditions.push(gte(schema.transaction.date, range.startDate));
      nameConditions.push(lt(schema.transaction.date, range.endDate));
    }

    const merchantNames = yield* db
      .selectDistinctOn([sql`lower(${schema.transaction.merchant})`], {
        merchant: schema.transaction.merchant,
        merchantLower: sql<string>`lower(${schema.transaction.merchant})`.as('merchant_lower')
      })
      .from(schema.transaction)
      .where(and(...nameConditions));

    const nameMap = new Map(merchantNames.map(m => [m.merchantLower, m.merchant]));

    return results.map(
      (row): CategoryTopMerchant => ({
        merchant: nameMap.get(row.merchant) ?? row.merchant,
        total: parseFloat(row.total ?? '0'),
        transactionCount: row.count
      })
    );
  }).pipe(Effect.withSpan('Category.getTopMerchants'));

export type SingleCategoryPeriodTrend = {
  period: string;
  periodKey: string;
  expenses: number;
  income: number;
  transactionCount: number;
};

/**
 * Get spending trends for a single category over periods.
 * If dateRange is provided, generates monthly periods within that range.
 */
export const getSingleCategoryPeriodTrends = (
  categoryId: string,
  timeframe: Timeframe,
  count: number,
  endPeriod: string | null = null,
  dateRange?: DateRange
) =>
  Effect.gen(function* () {
    const db = yield* Db;

    // Generate all periods
    const periods: Array<{ key: string; label: string; start: Date; end: Date }> = [];

    if (dateRange) {
      // When dateRange is provided, generate monthly periods within that range
      // Note: endDate is exclusive (start of next day), so we use it directly as the boundary
      let current = new Date(dateRange.startDate.getFullYear(), dateRange.startDate.getMonth(), 1);
      const endMonth = new Date(dateRange.endDate.getFullYear(), dateRange.endDate.getMonth(), 1);

      while (current < endMonth) {
        const monthStart = new Date(current);
        const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        const monthLabel = monthStart.toLocaleString('en-US', { month: 'short' });
        periods.push({
          key: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
          label: monthLabel,
          start: monthStart,
          end: monthEnd
        });
        current = monthEnd;
      }
    } else {
      const endRef = getEndReferenceDate(timeframe, endPeriod);

      if (timeframe === 'week') {
        const endWeekStart = getWeekStart(endRef);
        for (let i = count - 1; i >= 0; i--) {
          const weekStart = new Date(endWeekStart);
          weekStart.setDate(weekStart.getDate() - i * 7);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);
          const weekNum = getISOWeekNumber(weekStart);
          periods.push({
            key: `${weekStart.getFullYear()}-W${String(weekNum).padStart(2, '0')}`,
            label: `W${weekNum}`,
            start: weekStart,
            end: weekEnd
          });
        }
      } else if (timeframe === 'month') {
        for (let i = count - 1; i >= 0; i--) {
          const monthStart = new Date(endRef.getFullYear(), endRef.getMonth() - i, 1);
          const monthEnd = new Date(endRef.getFullYear(), endRef.getMonth() - i + 1, 1);
          const monthLabel = monthStart.toLocaleString('en-US', { month: 'short' });
          periods.push({
            key: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
            label: monthLabel,
            start: monthStart,
            end: monthEnd
          });
        }
      } else {
        for (let i = count - 1; i >= 0; i--) {
          const yearStart = new Date(endRef.getFullYear() - i, 0, 1);
          const yearEnd = new Date(endRef.getFullYear() - i + 1, 0, 1);
          periods.push({
            key: String(yearStart.getFullYear()),
            label: String(yearStart.getFullYear()),
            start: yearStart,
            end: yearEnd
          });
        }
      }
    }

    if (periods.length === 0) {
      return [];
    }

    // Query transactions in range
    const startDate = periods[0].start;
    const endDate = periods[periods.length - 1].end;

    const results = yield* db
      .select({
        date: schema.transaction.date,
        amount: schema.transaction.amount
      })
      .from(schema.transaction)
      .where(
        and(
          eq(schema.transaction.categoryId, categoryId),
          gte(schema.transaction.date, startDate),
          lt(schema.transaction.date, endDate)
        )
      );

    // Aggregate into periods
    const periodMap = new Map<string, { expenses: number; income: number; count: number }>();
    for (const p of periods) {
      periodMap.set(p.key, { expenses: 0, income: 0, count: 0 });
    }

    for (const row of results) {
      const txDate = row.date;
      for (const p of periods) {
        if (txDate >= p.start && txDate < p.end) {
          const entry = periodMap.get(p.key);
          if (entry) {
            const amount = parseFloat(row.amount);
            if (amount < 0) {
              entry.expenses += Math.abs(amount);
            } else {
              entry.income += amount;
            }
            entry.count++;
          }
          break;
        }
      }
    }

    return periods.map((p): SingleCategoryPeriodTrend => {
      const data = periodMap.get(p.key) ?? { expenses: 0, income: 0, count: 0 };
      return {
        period: p.label,
        periodKey: p.key,
        expenses: data.expenses,
        income: data.income,
        transactionCount: data.count
      };
    });
  }).pipe(Effect.withSpan('Category.getSinglePeriodTrends'));

/**
 * Get recent transactions for a category with pagination.
 */
export const getCategoryTransactions = (
  categoryId: string,
  page: number,
  pageSize: number,
  range?: DateRange
) =>
  Effect.gen(function* () {
    const db = yield* Db;

    const conditions = [eq(schema.transaction.categoryId, categoryId)];
    if (range) {
      conditions.push(gte(schema.transaction.date, range.startDate));
      conditions.push(lt(schema.transaction.date, range.endDate));
    }
    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = yield* db
      .select({ total: count() })
      .from(schema.transaction)
      .where(whereClause);

    const total = countResult?.total ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    // Get paginated items
    const offset = (page - 1) * pageSize;
    const items = yield* db
      .select({
        id: schema.transaction.id,
        date: schema.transaction.date,
        merchant: schema.transaction.merchant,
        amount: schema.transaction.amount,
        balance: schema.transaction.balance
      })
      .from(schema.transaction)
      .where(whereClause)
      .orderBy(desc(schema.transaction.date))
      .limit(pageSize)
      .offset(offset);

    return {
      items: items.map(tx => ({
        ...tx,
        amount: parseFloat(tx.amount),
        balance: tx.balance ? parseFloat(tx.balance) : null
      })),
      total,
      page,
      pageSize,
      totalPages
    };
  }).pipe(Effect.withSpan('Category.getTransactions'));

/**
 * Get merchant mappings for a category.
 */
export const getCategoryMerchantMappings = (categoryId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;

    const mappings = yield* db
      .select({
        id: schema.merchantMapping.id,
        merchantPattern: schema.merchantMapping.merchantPattern,
        isMultiMerchant: schema.merchantMapping.isMultiMerchant
      })
      .from(schema.merchantMapping)
      .where(eq(schema.merchantMapping.categoryId, categoryId))
      .orderBy(asc(schema.merchantMapping.merchantPattern));

    return mappings;
  }).pipe(Effect.withSpan('Category.getMerchantMappings'));

export const getMerchantPeriodTrends = (
  merchantPattern: string,
  timeframe: Timeframe,
  count: number,
  endPeriod: string | null = null,
  dateRange?: DateRange
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const patternLower = merchantPattern.toLowerCase();

    // Generate all periods we want to show
    const periods: Array<{ key: string; label: string; start: Date; end: Date }> = [];

    if (dateRange) {
      // When dateRange is provided, generate monthly periods within that range
      // Note: endDate is exclusive (start of next day), so we use it directly as the boundary
      let current = new Date(dateRange.startDate.getFullYear(), dateRange.startDate.getMonth(), 1);
      const endMonth = new Date(dateRange.endDate.getFullYear(), dateRange.endDate.getMonth(), 1);

      while (current < endMonth) {
        const monthStart = new Date(current);
        const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        const monthLabel = monthStart.toLocaleString('en-US', { month: 'short' });
        periods.push({
          key: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
          label: monthLabel,
          start: monthStart,
          end: monthEnd
        });
        current = monthEnd;
      }
    } else {
      const endRef = getEndReferenceDate(timeframe, endPeriod);

      if (timeframe === 'week') {
        const endWeekStart = getWeekStart(endRef);
        for (let i = count - 1; i >= 0; i--) {
          const weekStart = new Date(endWeekStart);
          weekStart.setDate(weekStart.getDate() - i * 7);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);
          const weekNum = getISOWeekNumber(weekStart);
          periods.push({
            key: `${weekStart.getFullYear()}-W${String(weekNum).padStart(2, '0')}`,
            label: `W${weekNum}`,
            start: weekStart,
            end: weekEnd
          });
        }
      } else if (timeframe === 'month') {
        for (let i = count - 1; i >= 0; i--) {
          const monthStart = new Date(endRef.getFullYear(), endRef.getMonth() - i, 1);
          const monthEnd = new Date(endRef.getFullYear(), endRef.getMonth() - i + 1, 1);
          const monthLabel = monthStart.toLocaleString('en-US', { month: 'short' });
          periods.push({
            key: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
            label: monthLabel,
            start: monthStart,
            end: monthEnd
          });
        }
      } else {
        // year
        for (let i = count - 1; i >= 0; i--) {
          const yearStart = new Date(endRef.getFullYear() - i, 0, 1);
          const yearEnd = new Date(endRef.getFullYear() - i + 1, 0, 1);
          periods.push({
            key: String(yearStart.getFullYear()),
            label: String(yearStart.getFullYear()),
            start: yearStart,
            end: yearEnd
          });
        }
      }
    }

    if (periods.length === 0) {
      return [];
    }

    // Query all matching transactions in range
    const startDate = periods[0].start;
    const endDate = periods[periods.length - 1].end;

    const results = yield* db
      .select({
        date: schema.transaction.date,
        amount: schema.transaction.amount
      })
      .from(schema.transaction)
      .where(
        and(
          sql`lower(${schema.transaction.merchant}) like ${`%${patternLower}%`}`,
          gte(schema.transaction.date, startDate),
          lt(schema.transaction.date, endDate),
          sql`${schema.transaction.amount} < 0`
        )
      );

    // Aggregate into periods
    const periodMap = new Map<string, { expenses: number; count: number }>();
    for (const p of periods) {
      periodMap.set(p.key, { expenses: 0, count: 0 });
    }

    for (const row of results) {
      const txDate = row.date;
      for (const p of periods) {
        if (txDate >= p.start && txDate < p.end) {
          const entry = periodMap.get(p.key);
          if (entry) {
            entry.expenses += Math.abs(parseFloat(row.amount));
            entry.count++;
          }
          break;
        }
      }
    }

    return periods.map((p): MerchantPeriodTrend => {
      const data = periodMap.get(p.key) ?? { expenses: 0, count: 0 };
      return {
        period: p.label,
        periodKey: p.key,
        expenses: data.expenses,
        transactionCount: data.count
      };
    });
  }).pipe(Effect.withSpan('Merchant.getPeriodTrends'));

////////////////////////////////////////////////////////////////////////
// TRANSACTION DETAIL QUERIES
////////////////////////////////////////////////////////////////////////

export type TransactionDetail = {
  id: string;
  date: Date;
  merchant: string;
  amount: number;
  balance: number | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  uploadId: string | null;
  originalHash: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Get transaction by ID with category details.
 * Returns null if not found.
 */
export const getTransactionById = (id: string) =>
  Effect.gen(function* () {
    const db = yield* Db;

    const [result] = yield* db
      .select({
        id: schema.transaction.id,
        date: schema.transaction.date,
        merchant: schema.transaction.merchant,
        amount: schema.transaction.amount,
        balance: schema.transaction.balance,
        categoryId: schema.transaction.categoryId,
        categoryName: schema.category.name,
        categoryIcon: schema.category.icon,
        uploadId: schema.transaction.uploadId,
        originalHash: schema.transaction.originalHash,
        createdAt: schema.transaction.createdAt,
        updatedAt: schema.transaction.updatedAt
      })
      .from(schema.transaction)
      .leftJoin(schema.category, eq(schema.transaction.categoryId, schema.category.id))
      .where(eq(schema.transaction.id, id))
      .limit(1);

    if (!result) return null;

    return {
      ...result,
      amount: parseFloat(result.amount),
      balance: result.balance ? parseFloat(result.balance) : null
    } satisfies TransactionDetail;
  }).pipe(Effect.withSpan('Transaction.getById'));

type MonthSummary = {
  /** Format: YYYY-MM */
  period: string;
  year: number;
  month: number;
  net: number;
  transactionCount: number;
};

/**
 * Get all months that have transactions, with net amount for each.
 * Returns sorted by date descending (most recent first).
 */
export const getAvailableMonths = () =>
  Effect.gen(function* () {
    const db = yield* Db;

    const results = yield* db
      .select({
        year: sql<number>`extract(year from ${schema.transaction.date})::int`.as('year'),
        month: sql<number>`extract(month from ${schema.transaction.date})::int`.as('month'),
        net: sql<string>`sum(${schema.transaction.amount})`.as('net'),
        count: sql<number>`count(*)::int`.as('count')
      })
      .from(schema.transaction)
      .groupBy(
        sql`extract(year from ${schema.transaction.date})`,
        sql`extract(month from ${schema.transaction.date})`
      )
      .orderBy(
        desc(sql`extract(year from ${schema.transaction.date})`),
        desc(sql`extract(month from ${schema.transaction.date})`)
      );

    return results.map(
      (row): MonthSummary => ({
        period: `${row.year}-${String(row.month).padStart(2, '0')}`,
        year: row.year,
        month: row.month,
        net: parseFloat(row.net ?? '0'),
        transactionCount: row.count
      })
    );
  }).pipe(Effect.withSpan('Transaction.getAvailableMonths'));
