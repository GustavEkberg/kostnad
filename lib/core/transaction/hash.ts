import { createHash } from 'node:crypto';

/**
 * Format date as postgres timestamp text: "YYYY-MM-DD HH:MM:SS"
 * Must match: date::text in SQL migration
 */
const formatDateForHash = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day} 00:00:00`;
};

/**
 * Format amount as postgres numeric text: "-65.00"
 * Must match: amount::text in SQL migration
 */
const formatAmountForHash = (amount: number): string => {
  return amount.toFixed(2);
};

/**
 * Compute transaction hash for duplicate detection.
 * Hash is computed from original values: date|amount|merchant
 * Format must match SQL: (date::text || '|' || amount::text || '|' || merchant)
 */
export const computeTransactionHash = (date: Date, amount: number, merchant: string): string => {
  const input = `${formatDateForHash(date)}|${formatAmountForHash(amount)}|${merchant}`;
  return createHash('sha256').update(input).digest('hex');
};
