import { cn } from '@/lib/utils';
import type { Timeframe } from './search-params';

type Props = {
  change: number;
  yearOverYear: number;
  previousValue: number;
  yearAgoValue: number;
  timeframe: Timeframe;
  higherIsBetter: boolean;
};

function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${Math.round(value)}%`;
}

function getPeriodLabel(timeframe: Timeframe): string {
  switch (timeframe) {
    case 'week':
      return 'vs last week';
    case 'month':
      return 'vs last month';
    case 'year':
      return 'vs last year';
  }
}

export function TrendIndicator({
  change,
  yearOverYear,
  previousValue,
  yearAgoValue,
  timeframe,
  higherIsBetter
}: Props) {
  // Calculate percentages (avoid division by zero)
  const periodPercent = previousValue !== 0 ? (change / previousValue) * 100 : null;
  const yoyPercent = yearAgoValue !== 0 ? (yearOverYear / yearAgoValue) * 100 : null;

  // Determine if change is positive (good or bad depends on context)
  const isPositiveChange = change > 0;
  const isGoodChange = higherIsBetter ? isPositiveChange : !isPositiveChange;

  // Don't render if no meaningful comparison data
  if (periodPercent === null && yoyPercent === null) {
    return null;
  }

  // For year timeframe, YoY is redundant (same as period change)
  const showYoY = timeframe !== 'year';

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {periodPercent !== null && (
        <span
          className={cn(
            'flex items-center gap-0.5',
            isGoodChange ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          )}
        >
          {isPositiveChange ? (
            <ArrowUpIcon className="h-3 w-3" />
          ) : change < 0 ? (
            <ArrowDownIcon className="h-3 w-3" />
          ) : null}
          <span>{formatPercent(periodPercent)}</span>
          <span className="text-muted-foreground ml-0.5">{getPeriodLabel(timeframe)}</span>
        </span>
      )}
      {showYoY && yoyPercent !== null && (
        <span className="text-muted-foreground flex items-center gap-0.5">
          <span className={cn(yearOverYear > 0 ? 'text-foreground' : 'text-foreground')}>
            {formatPercent(yoyPercent)}
          </span>
          <span>YoY</span>
        </span>
      )}
    </div>
  );
}

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ArrowDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
        clipRule="evenodd"
      />
    </svg>
  );
}

type CategoryTrendBadgeProps = {
  percentChange: number;
  isExpense: boolean;
};

/**
 * Small badge showing category trend percentage.
 * For expenses: down is good (green), up is bad (red)
 * For income: up is good (green), down is bad (red)
 */
export function CategoryTrendBadge({ percentChange, isExpense }: CategoryTrendBadgeProps) {
  const isUp = percentChange > 0;
  const isGood = isExpense ? !isUp : isUp;

  // Don't show if change is very small
  if (Math.abs(percentChange) < 1) {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium',
        isGood
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      )}
    >
      {isUp ? <ArrowUpIcon className="h-2.5 w-2.5" /> : <ArrowDownIcon className="h-2.5 w-2.5" />}
      {Math.abs(Math.round(percentChange))}%
    </span>
  );
}
