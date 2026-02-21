'use server';

import { Effect, Match } from 'effect';
import { revalidatePath } from 'next/cache';
import ExcelJS from 'exceljs';
import { eq } from 'drizzle-orm';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { AppLayer } from '@/lib/layers';
import { NextEffect } from '@/lib/next-effect';
import { getSession } from '@/lib/services/auth/get-session';
import { Db } from '@/lib/services/db/live-layer';
import * as schema from '@/lib/services/db/schema';
import { ValidationError } from '@/lib/core/errors';
import { computeTransactionHash } from './hash';

// Handelsbanken Excel row structure (row 10+, 1-indexed values array)
// Index 2: Reskontradatum (booking date)
// Index 3: Transaktionsdatum (transaction date)
// Index 4: Text (merchant)
// Index 5: Belopp (amount)
// Index 6: Saldo (balance)
type RawRow = {
  date: Date;
  merchant: string;
  amount: number;
  balance: number | null;
};

const DATA_START_ROW = 10;

/**
 * Parse a date string from Handelsbanken format (YYYY-MM-DD)
 */
const parseDate = (value: ExcelJS.CellValue): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date;
  }
  return null;
};

/**
 * Parse a numeric value (amount or balance)
 */
const parseNumber = (value: ExcelJS.CellValue): number | null => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value.replace(',', '.'));
    if (!isNaN(num)) return num;
  }
  return null;
};

/**
 * Parse Handelsbanken Excel file and extract transaction rows.
 * Handelsbanken format: Row 9 = headers, Row 10+ = data
 * Columns: Reskontradatum, Transaktionsdatum, Text, Belopp, Saldo
 *
 * Uses temp file to work around exceljs Buffer type incompatibility.
 */
const parseHandelsbankenExcel = (buffer: Buffer<ArrayBufferLike>) =>
  Effect.gen(function* () {
    // Write to temp file to work around exceljs Buffer type incompatibility
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `kostnad-upload-${Date.now()}.xlsx`);
    yield* Effect.tryPromise({
      try: () => fs.writeFile(tempFile, buffer),
      catch: () => new ValidationError({ message: 'Failed to write temp file', field: 'file' })
    });

    const workbook = new ExcelJS.Workbook();
    yield* Effect.tryPromise({
      try: () => workbook.xlsx.readFile(tempFile),
      catch: () => new ValidationError({ message: 'Failed to parse Excel file', field: 'file' })
    });

    // Cleanup temp file (ignore errors)
    yield* Effect.tryPromise(() => fs.unlink(tempFile)).pipe(Effect.ignore);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return yield* new ValidationError({
        message: 'Excel file has no worksheets',
        field: 'file'
      });
    }

    const rows: RawRow[] = [];
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
  }).pipe(Effect.withSpan('parseHandelsbankenExcel'));

/**
 * Server action to upload and process a Handelsbanken Excel file.
 *
 * 1. Receives file directly via FormData
 * 2. Parses Excel to extract transactions
 * 3. Creates an upload record
 * 4. Inserts transactions, deduplicating by (date, merchant, amount)
 * 5. Returns count of new vs skipped transactions
 */
export const uploadTransactionsAction = async (formData: FormData) => {
  return await NextEffect.runPromise(
    Effect.gen(function* () {
      // Extract file from FormData
      const file = formData.get('file');
      if (!file || !(file instanceof File)) {
        return yield* new ValidationError({
          message: 'No file provided',
          field: 'file'
        });
      }

      if (!file.name.endsWith('.xlsx')) {
        return yield* new ValidationError({
          message: 'Please select an Excel file (.xlsx)',
          field: 'file'
        });
      }

      const session = yield* getSession();
      const db = yield* Db;

      yield* Effect.annotateCurrentSpan({
        'user.id': session.user.id,
        'file.name': file.name,
        'file.size': file.size
      });

      // Read file buffer
      const arrayBuffer = yield* Effect.tryPromise({
        try: () => file.arrayBuffer(),
        catch: () => new ValidationError({ message: 'Failed to read file', field: 'file' })
      });
      const buffer = Buffer.from(arrayBuffer);

      // Parse Excel
      const { rows, minDate, maxDate } = yield* parseHandelsbankenExcel(buffer);

      if (rows.length === 0) {
        return yield* new ValidationError({
          message: 'No valid transactions found in Excel file',
          field: 'file'
        });
      }

      // Create upload record
      const [uploadRecord] = yield* db
        .insert(schema.upload)
        .values({
          fileName: file.name,
          uploadedBy: session.user.id,
          transactionCount: 0, // Updated after deduplication
          dateRangeStart: minDate,
          dateRangeEnd: maxDate
        })
        .returning();

      // Fetch all merchant mappings for auto-categorization
      const mappings = yield* db.select().from(schema.merchantMapping);

      /**
       * Find matching category for a merchant using case-insensitive substring match.
       * Returns the categoryId if found, null if no match or if merchant is multi-merchant.
       * Multi-merchants (umbrella merchants) always require manual review.
       */
      const findCategoryForMerchant = (merchant: string): string | null => {
        const merchantLower = merchant.toLowerCase();
        for (const mapping of mappings) {
          if (merchantLower.includes(mapping.merchantPattern.toLowerCase())) {
            // Skip multi-merchants - they require manual categorization
            if (mapping.isMultiMerchant) {
              return null;
            }
            return mapping.categoryId;
          }
        }
        return null;
      };

      // Check for duplicates and insert new transactions
      // A transaction is a duplicate if originalHash already exists
      let newCount = 0;
      let skippedCount = 0;
      let categorizedCount = 0;

      for (const row of rows) {
        // Compute hash for duplicate detection
        const originalHash = computeTransactionHash(row.date, row.amount, row.merchant);

        // Check for existing transaction with same hash
        const existing = yield* db
          .select({ id: schema.transaction.id })
          .from(schema.transaction)
          .where(eq(schema.transaction.originalHash, originalHash))
          .limit(1);

        if (existing.length > 0) {
          skippedCount++;
          continue;
        }

        // Auto-categorize using merchant mappings
        const categoryId = findCategoryForMerchant(row.merchant);
        if (categoryId) {
          categorizedCount++;
        }

        // Insert new transaction
        yield* db.insert(schema.transaction).values({
          date: row.date,
          merchant: row.merchant,
          amount: String(row.amount),
          balance: row.balance !== null ? String(row.balance) : null,
          uploadId: uploadRecord.id,
          categoryId,
          originalHash
        });

        newCount++;
      }

      // Update upload record with actual transaction count
      yield* db
        .update(schema.upload)
        .set({ transactionCount: newCount })
        .where(eq(schema.upload.id, uploadRecord.id));

      yield* Effect.annotateCurrentSpan({
        'transaction.new': newCount,
        'transaction.skipped': skippedCount,
        'transaction.categorized': categorizedCount,
        'upload.id': uploadRecord.id
      });

      return {
        uploadId: uploadRecord.id,
        fileName: file.name,
        newCount,
        skippedCount,
        categorizedCount,
        dateRangeStart: minDate,
        dateRangeEnd: maxDate
      };
    }).pipe(
      Effect.withSpan('action.transaction.upload', {
        attributes: {
          operation: 'transaction.upload'
        }
      }),
      Effect.provide(AppLayer),
      Effect.scoped,
      Effect.matchEffect({
        onFailure: error =>
          Match.value(error._tag).pipe(
            Match.when('UnauthenticatedError', () => NextEffect.redirect('/login')),
            Match.when('ValidationError', () =>
              Effect.succeed({
                _tag: 'Error' as const,
                message: error.message
              })
            ),
            Match.orElse(() =>
              Effect.succeed({
                _tag: 'Error' as const,
                message: 'Failed to upload transactions'
              })
            )
          ),
        onSuccess: result =>
          Effect.sync(() => {
            revalidatePath('/');
            return { _tag: 'Success' as const, ...result };
          })
      })
    )
  );
};
