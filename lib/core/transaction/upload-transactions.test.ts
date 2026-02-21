import { describe, expect, it } from '@effect/vitest';
import { Effect } from 'effect';
import * as path from 'node:path';
import ExcelJS from 'exceljs';

/**
 * Tests for Handelsbanken Excel parsing logic.
 * These tests verify the parsing without needing S3 or database.
 */

const DATA_START_ROW = 10;

type ParsedRow = {
  date: Date;
  merchant: string;
  amount: number;
  balance: number | null;
};

const parseDate = (value: ExcelJS.CellValue): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date;
  }
  return null;
};

const parseNumber = (value: ExcelJS.CellValue): number | null => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value.replace(',', '.'));
    if (!isNaN(num)) return num;
  }
  return null;
};

const parseHandelsbankenExcel = (filePath: string) =>
  Effect.gen(function* () {
    const workbook = new ExcelJS.Workbook();
    yield* Effect.promise(() => workbook.xlsx.readFile(filePath));

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return { rows: [], minDate: null, maxDate: null };
    }

    const rows: ParsedRow[] = [];
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < DATA_START_ROW) return;

      const values = row.values;
      if (!Array.isArray(values) || values.length < 5) return;

      // Handelsbanken format (1-indexed column values):
      // Column B (index 1): Reskontradatum (booking date, empty for preliminary)
      // Column C (index 2): Transaktionsdatum - use this for date
      // Column D (index 3): Text (merchant)
      // Column E (index 4): Belopp (amount)
      // Column F (index 5): Saldo (balance)

      const merchant = typeof values[3] === 'string' ? values[3].trim() : null;
      if (!merchant) return;

      // Skip preliminary transactions (Prel prefix + no Reskontradatum)
      // These will be uploaded later when confirmed
      const reskontradatum = parseDate(values[1]);
      if (merchant.startsWith('Prel') && !reskontradatum) return;

      const date = parseDate(values[2]);
      if (!date) return;

      const amount = parseNumber(values[4]);
      if (amount === null) return;

      const balance = parseNumber(values[5]);

      rows.push({ date, merchant, amount, balance });

      // Track date range
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    });

    return { rows, minDate, maxDate };
  });

describe('Handelsbanken Excel parsing', () => {
  it.live('parses real Handelsbanken file', () =>
    Effect.gen(function* () {
      const filePath = path.join(
        process.cwd(),
        'bank-data/Handelsbanken_Account_Transactions_2026-01-25.xlsx'
      );

      const { rows, minDate, maxDate } = yield* parseHandelsbankenExcel(filePath);

      // Should parse some transactions
      expect(rows.length).toBeGreaterThan(0);

      // Check first row structure
      const firstRow = rows[0];
      expect(firstRow.date).toBeInstanceOf(Date);
      expect(typeof firstRow.merchant).toBe('string');
      expect(firstRow.merchant.length).toBeGreaterThan(0);
      expect(typeof firstRow.amount).toBe('number');

      // Date range should be set
      expect(minDate).toBeInstanceOf(Date);
      expect(maxDate).toBeInstanceOf(Date);
    })
  );

  it.live('extracts correct data from Handelsbanken format', () =>
    Effect.gen(function* () {
      const filePath = path.join(
        process.cwd(),
        'bank-data/Handelsbanken_Account_Transactions_2026-01-25.xlsx'
      );

      const { rows } = yield* parseHandelsbankenExcel(filePath);

      // Based on test output, first data row should be:
      // Row 10: 2026-01-24, 'G feb', 25000, 21800.96
      const firstRow = rows[0];
      expect(firstRow.merchant).toBe('G feb');
      expect(firstRow.amount).toBe(25000);
      expect(firstRow.balance).toBe(21800.96);
    })
  );

  it.live('handles negative amounts (expenses)', () =>
    Effect.gen(function* () {
      const filePath = path.join(
        process.cwd(),
        'bank-data/Handelsbanken_Account_Transactions_2026-01-25.xlsx'
      );

      const { rows } = yield* parseHandelsbankenExcel(filePath);

      // Should have some negative amounts (expenses)
      const expenses = rows.filter(r => r.amount < 0);
      expect(expenses.length).toBeGreaterThan(0);

      // Check a known expense from test output
      const olstugan = rows.find(r => r.merchant.includes('OLSTUGAN'));
      expect(olstugan).toBeDefined();
      expect(olstugan?.amount).toBeLessThan(0);
    })
  );

  it.live('excludes preliminary transactions (Prel with no Reskontradatum)', () =>
    Effect.gen(function* () {
      const filePath = path.join(
        process.cwd(),
        'bank-data/Handelsbanken_Account_Transactions_2026-01-25.xlsx'
      );

      const { rows } = yield* parseHandelsbankenExcel(filePath);

      // No rows should have Prel prefix (those without Reskontradatum are filtered)
      // Prel transactions that DO have Reskontradatum would be kept, but
      // typically Prel = preliminary = no booking date yet
      const prelWithoutBooking = rows.filter(r => r.merchant.startsWith('Prel'));

      // If any Prel transactions remain, they must have had a Reskontradatum
      // In the typical case, all Prel transactions lack Reskontradatum and are filtered
      // This test ensures no preliminary transactions sneak through
      expect(prelWithoutBooking.length).toBe(0);
    })
  );
});

describe('deduplication logic', () => {
  it.effect('identifies duplicate transactions by date+merchant+amount', () =>
    Effect.gen(function* () {
      const tx1 = {
        date: new Date('2026-01-24'),
        merchant: 'Test Store',
        amount: -50.0,
        balance: 100.0
      };

      const tx2 = {
        date: new Date('2026-01-24'),
        merchant: 'Test Store',
        amount: -50.0,
        balance: 100.0
      };

      const tx3 = {
        date: new Date('2026-01-25'), // Different date
        merchant: 'Test Store',
        amount: -50.0,
        balance: 100.0
      };

      // Same date, merchant, amount = duplicate
      const key1 = `${tx1.date.toISOString()}-${tx1.merchant}-${tx1.amount}`;
      const key2 = `${tx2.date.toISOString()}-${tx2.merchant}-${tx2.amount}`;
      const key3 = `${tx3.date.toISOString()}-${tx3.merchant}-${tx3.amount}`;

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    })
  );
});

describe('auto-categorization logic', () => {
  /**
   * Case-insensitive substring matching for merchant patterns.
   * This mirrors the logic in uploadTransactionsAction.
   */
  const findCategoryForMerchant = (
    merchant: string,
    mappings: Array<{ merchantPattern: string; categoryId: string }>
  ): string | null => {
    const merchantLower = merchant.toLowerCase();
    for (const mapping of mappings) {
      if (merchantLower.includes(mapping.merchantPattern.toLowerCase())) {
        return mapping.categoryId;
      }
    }
    return null;
  };

  it.effect('matches merchant patterns case-insensitively', () =>
    Effect.gen(function* () {
      const mappings = [
        { merchantPattern: 'ICA', categoryId: 'groceries-id' },
        { merchantPattern: 'spotify', categoryId: 'entertainment-id' }
      ];

      // Exact match (different case)
      expect(findCategoryForMerchant('Maxi ICA Stormarknad', mappings)).toBe('groceries-id');
      expect(findCategoryForMerchant('SPOTIFY AB', mappings)).toBe('entertainment-id');

      // Substring match
      expect(findCategoryForMerchant('Prel ICA Kvantum', mappings)).toBe('groceries-id');

      // No match
      expect(findCategoryForMerchant('BAUHAUS', mappings)).toBeNull();
    })
  );

  it.effect('returns first matching pattern', () =>
    Effect.gen(function* () {
      const mappings = [
        { merchantPattern: 'STORE', categoryId: 'general-id' },
        { merchantPattern: 'ICA STORE', categoryId: 'specific-id' }
      ];

      // First match wins
      expect(findCategoryForMerchant('ICA STORE XYZ', mappings)).toBe('general-id');
    })
  );

  it.effect('returns null for unmatched merchants', () =>
    Effect.gen(function* () {
      const mappings = [{ merchantPattern: 'ICA', categoryId: 'groceries-id' }];

      expect(findCategoryForMerchant('COOP', mappings)).toBeNull();
      expect(findCategoryForMerchant('', mappings)).toBeNull();
    })
  );
});
