import { describe, expect, it } from '@effect/vitest';
import { Effect } from 'effect';
import * as path from 'node:path';
import ExcelJS from 'exceljs';

/**
 * Verifies exceljs library can parse Handelsbanken Excel format.
 * PRD task setup-1: xlsx package installed and usable in server action.
 */
describe('exceljs parsing', () => {
  it.live('parses Handelsbanken Excel file', () =>
    Effect.gen(function* () {
      const filePath = path.join(
        process.cwd(),
        'bank-data/Handelsbanken_Account_Transactions_2026-01-25.xlsx'
      );

      // Load workbook
      const workbook = new ExcelJS.Workbook();
      yield* Effect.promise(() => workbook.xlsx.readFile(filePath));

      // Should have at least one worksheet
      expect(workbook.worksheets.length).toBeGreaterThan(0);

      // Get the first worksheet
      const worksheet = workbook.worksheets[0];
      expect(worksheet).toBeDefined();
      expect(worksheet.rowCount).toBeGreaterThan(0);

      // Log first 15 rows to understand Handelsbanken format
      console.log('Sheet structure (first 15 rows):');
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= 15) {
          const values = row.values;
          console.log(`Row ${rowNumber}:`, values);
        }
      });
    })
  );
});
