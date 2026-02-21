'use client';

import { useQueryState, parseAsString } from 'nuqs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type MonthData = {
  period: string;
  year: number;
  month: number;
  net: number;
};

type Props = {
  period: string | null;
  label: string;
  /** Available months with net amounts */
  availableMonths: MonthData[];
};

function getMonthLabel(month: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(2000, month - 1));
}

function formatNet(amount: number): string {
  const formatted = new Intl.NumberFormat('sv-SE', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.abs(amount));
  return amount >= 0 ? `+${formatted}` : `-${formatted}`;
}

export function MonthPicker({ period: _initialPeriod, label, availableMonths }: Props) {
  const [period, setPeriod] = useQueryState(
    'period',
    parseAsString.withOptions({
      shallow: false,
      history: 'push'
    })
  );

  // When period URL param is null, derive the current period from today's date
  // This handles the case where the current month has no transactions yet
  const derivedCurrentPeriod = (() => {
    if (period !== null) return period;
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  })();

  // Find current index in available months
  // Returns -1 if current period isn't in available months (e.g., no transactions this month)
  const currentIndex = availableMonths.findIndex(m => m.period === derivedCurrentPeriod);

  // When current month has no transactions (index = -1), can always go to the most recent available
  const canGoPrev =
    currentIndex === -1 ? availableMonths.length > 0 : currentIndex < availableMonths.length - 1;
  const canGoNext = currentIndex > 0;

  const handlePrev = () => {
    if (!canGoPrev) return;
    // If current month has no transactions, go to most recent available month
    if (currentIndex === -1) {
      setPeriod(availableMonths[0].period);
    } else {
      const prevMonth = availableMonths[currentIndex + 1];
      setPeriod(prevMonth.period);
    }
  };

  const handleNext = () => {
    if (!canGoNext) return;
    const nextMonth = availableMonths[currentIndex - 1];
    // If navigating to most recent available, check if it matches current month
    // to decide whether to clear the param
    if (currentIndex - 1 === 0) {
      // Check if most recent available month is the current month
      const now = new Date();
      const currentMonthPeriod = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      if (nextMonth.period === currentMonthPeriod) {
        setPeriod(null);
      } else {
        setPeriod(nextMonth.period);
      }
    } else {
      setPeriod(nextMonth.period);
    }
  };

  const handleSelect = (value: string | null) => {
    if (value === null) return;
    // If selecting most recent month, clear param
    if (availableMonths.length > 0 && value === availableMonths[0].period) {
      setPeriod(null);
    } else {
      setPeriod(value);
    }
  };

  // Group months by year
  const years = [...new Set(availableMonths.map(m => m.year))].sort((a, b) => b - a);

  if (availableMonths.length === 0) {
    return <div className="text-muted-foreground text-xl font-semibold">No transaction data</div>;
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handlePrev}
        disabled={!canGoPrev}
        aria-label="Previous month"
      >
        <ChevronLeft className="size-5" />
      </Button>

      <Select
        value={derivedCurrentPeriod ?? availableMonths[0].period}
        onValueChange={handleSelect}
      >
        <SelectTrigger className="min-w-[180px] border-none shadow-none text-xl font-semibold justify-center gap-0 [&>svg]:hidden hover:bg-accent">
          <SelectValue className="justify-center">{label}</SelectValue>
        </SelectTrigger>
        <SelectContent align="center" className="max-h-80">
          {years.map(year => (
            <SelectGroup key={year}>
              <SelectLabel>{year}</SelectLabel>
              {availableMonths
                .filter(m => m.year === year)
                .map(m => (
                  <SelectItem key={m.period} value={m.period}>
                    <span className="flex w-full items-center justify-between gap-4">
                      <span>{getMonthLabel(m.month)}</span>
                      <span
                        className={cn(
                          'text-xs font-mono',
                          m.net >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        )}
                      >
                        {formatNet(m.net)}
                      </span>
                    </span>
                  </SelectItem>
                ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {canGoNext ? (
        <Button variant="ghost" size="icon-sm" onClick={handleNext} aria-label="Next month">
          <ChevronRight className="size-5" />
        </Button>
      ) : (
        <div className="size-8" /> // Spacer to maintain layout
      )}
    </div>
  );
}
