import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEmail(email: string): string {
  return email.toLowerCase().trim();
}

type CurrencyCode = 'SEK' | 'EUR';

const CURRENCY_CONFIG: Record<CurrencyCode, { locale: string; symbol: string }> = {
  SEK: { locale: 'sv-SE', symbol: 'kr' },
  EUR: { locale: 'de-DE', symbol: '€' }
};

/**
 * Format amount as currency
 */
export function formatCurrency(amount: number, currency: CurrencyCode = 'SEK'): string {
  const { locale } = CURRENCY_CONFIG[currency];
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Format currency for chart axis labels (compact form)
 * Returns a formatter function when currency is provided
 */
export function formatAxisCurrency(value: number): string {
  return `${(value / 1000).toFixed(0)} tkr`;
}

/**
 * Create axis currency formatter for specific currency
 */
export function createAxisCurrencyFormatter(
  currency: CurrencyCode = 'SEK'
): (value: number) => string {
  const { symbol, locale } = CURRENCY_CONFIG[currency];
  return (value: number) => `${Math.round(value).toLocaleString(locale)} ${symbol}`;
}

/**
 * Format currency value with symbol (for labels)
 */
export function formatCurrencyValue(value: number, currency: CurrencyCode = 'SEK'): string {
  const { locale, symbol } = CURRENCY_CONFIG[currency];
  return `${Math.round(value).toLocaleString(locale)} ${symbol}`;
}

/**
 * Format currency for tooltips (full form)
 */
export function formatTooltipCurrency(value: number, currency: CurrencyCode = 'SEK'): string {
  const { locale, symbol } = CURRENCY_CONFIG[currency];
  return `${value.toLocaleString(locale)} ${symbol}`;
}
