'use client';

import { useQueryState, parseAsString, parseAsStringLiteral } from 'nuqs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  timeframeValues,
  type Timeframe,
  getPeriodOffset,
  isCurrentPeriod,
  convertPeriod
} from './search-params';

type Props = {
  timeframe: Timeframe;
  period: string | null;
};

export function TimeframeSelector({ timeframe: initialTimeframe, period: initialPeriod }: Props) {
  const [timeframe, setTimeframe] = useQueryState(
    'timeframe',
    parseAsStringLiteral(timeframeValues).withDefault('month').withOptions({
      shallow: false,
      history: 'push'
    })
  );

  const [period, setPeriod] = useQueryState(
    'period',
    parseAsString.withOptions({
      shallow: false,
      history: 'push'
    })
  );

  // Use URL state, falling back to server-provided initial values
  const currentTimeframe = timeframe ?? initialTimeframe;
  const currentPeriod = period ?? initialPeriod;

  const handleTimeframeChange = (newTimeframe: Timeframe) => {
    // Convert current period to new timeframe, preserving position
    const newPeriod = convertPeriod(currentTimeframe, newTimeframe, currentPeriod);
    setTimeframe(newTimeframe);
    setPeriod(newPeriod);
  };

  const handlePrev = () => {
    const newPeriod = getPeriodOffset(currentTimeframe, currentPeriod, -1);
    setPeriod(newPeriod);
  };

  const handleNext = () => {
    const newPeriod = getPeriodOffset(currentTimeframe, currentPeriod, 1);
    // Only set period if it would be in the past or current
    const isFuture = isCurrentPeriod(currentTimeframe, newPeriod) === false;
    if (!isFuture || isCurrentPeriod(currentTimeframe, currentPeriod)) {
      setPeriod(newPeriod);
    }
  };

  const handleToday = () => {
    setPeriod(null);
  };

  const isCurrent = isCurrentPeriod(currentTimeframe, currentPeriod);

  return (
    <div className="flex items-center gap-2">
      {/* Timeframe toggle */}
      <div className="bg-muted flex rounded-md p-0.5">
        {timeframeValues.map(tf => (
          <button
            key={tf}
            onClick={() => handleTimeframeChange(tf)}
            className={`rounded-[5px] px-2.5 py-1 text-sm font-medium transition-colors ${
              currentTimeframe === tf
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tf.charAt(0).toUpperCase() + tf.slice(1)}
          </button>
        ))}
      </div>

      {/* Period navigation */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={handlePrev} aria-label="Previous period">
          <ChevronLeft className="size-4" />
        </Button>

        {!isCurrent && (
          <Button variant="ghost" size="sm" onClick={handleToday} className="text-xs">
            Today
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleNext}
          disabled={isCurrent}
          aria-label="Next period"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
