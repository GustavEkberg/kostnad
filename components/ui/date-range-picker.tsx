'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// UTC date helpers to avoid timezone issues when serializing to ISO date strings
function utcStartOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1));
}

function utcEndOfMonth(year: number, month: number): Date {
  // Day 0 of next month = last day of current month
  return new Date(Date.UTC(year, month + 1, 0));
}

function getMonthsAgo(monthsBack: number): { startYear: number; startMonth: number } {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const targetMonth = month - monthsBack;
  const startYear = year + Math.floor(targetMonth / 12);
  const startMonth = ((targetMonth % 12) + 12) % 12;
  return { startYear, startMonth };
}

type Preset = {
  label: string;
  getValue: () => DateRange;
};

const presets: Preset[] = [
  {
    label: 'Last 3 months',
    getValue: () => {
      const { startYear: endYear, startMonth: endMonth } = getMonthsAgo(1);
      const { startYear, startMonth } = getMonthsAgo(3);
      return { from: utcStartOfMonth(startYear, startMonth), to: utcEndOfMonth(endYear, endMonth) };
    }
  },
  {
    label: 'Last 6 months',
    getValue: () => {
      const { startYear: endYear, startMonth: endMonth } = getMonthsAgo(1);
      const { startYear, startMonth } = getMonthsAgo(6);
      return { from: utcStartOfMonth(startYear, startMonth), to: utcEndOfMonth(endYear, endMonth) };
    }
  },
  {
    label: 'Last year',
    getValue: () => {
      const { startYear: endYear, startMonth: endMonth } = getMonthsAgo(1);
      const { startYear, startMonth } = getMonthsAgo(12);
      return { from: utcStartOfMonth(startYear, startMonth), to: utcEndOfMonth(endYear, endMonth) };
    }
  }
];

type DateRangePickerProps = {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
  placeholder?: string;
};

export function DateRangePicker({
  value,
  onChange,
  className,
  placeholder = 'Select date range'
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>(value);

  // Sync draft with value when popover opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setDraft(value);
    }
    setOpen(isOpen);
  };

  const handlePresetClick = (preset: Preset) => {
    const range = preset.getValue();
    onChange(range);
    setOpen(false);
  };

  const handleApply = () => {
    if (draft?.from && draft?.to) {
      onChange(draft);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              'justify-start text-left font-normal',
              !value && 'text-muted-foreground',
              className
            )}
          />
        }
      >
        <CalendarIcon className="mr-2 size-4" />
        {value?.from ? (
          value.to ? (
            <>
              {format(value.from, 'LLL dd, y')} - {format(value.to, 'LLL dd, y')}
            </>
          ) : (
            format(value.from, 'LLL dd, y')
          )
        ) : (
          <span>{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="flex w-auto gap-2 p-2" align="start">
        <div className="flex flex-col gap-1">
          {presets.map(preset => (
            <Button
              key={preset.label}
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => handlePresetClick(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="border-border border-l pl-2">
          <Calendar
            mode="range"
            defaultMonth={draft?.from ?? value?.from}
            selected={draft}
            onSelect={setDraft}
            numberOfMonths={2}
          />
          <div className="border-border flex justify-end gap-2 border-t p-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!draft?.from || !draft?.to} onClick={handleApply}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
