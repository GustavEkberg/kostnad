'use client';

import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useMemo } from 'react';
import { createAxisCurrencyFormatter, formatTooltipCurrency } from '@/lib/utils';

type PeriodData = {
  period: string;
  periodKey: string;
  expenses: number;
  income: number;
  transactionCount: number;
};

type Props = {
  data: PeriodData[];
  height?: number;
  compact?: boolean;
  currency?: 'SEK' | 'EUR';
};

export function CategoryTrendChart({
  data,
  height = 250,
  compact = false,
  currency = 'SEK'
}: Props) {
  const axisFormatter = createAxisCurrencyFormatter(currency);

  const option = useMemo((): EChartsOption => {
    if (data.length === 0) return {};

    const periods = data.map(d => d.period);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: value => formatTooltipCurrency(Number(value), currency)
      },
      grid: {
        top: compact ? 10 : 20,
        bottom: compact ? 30 : 40,
        left: compact ? 50 : 60,
        right: compact ? 10 : 20,
        containLabel: false
      },
      xAxis: {
        type: 'category',
        data: periods,
        axisLabel: {
          fontSize: compact ? 10 : 12
        },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: compact ? 10 : 12,
          formatter: axisFormatter
        },
        splitLine: { lineStyle: { color: 'rgba(128, 128, 128, 0.15)' } }
      },
      series: [
        {
          name: 'Expenses',
          type: 'line',
          data: data.map(d => d.expenses),
          lineStyle: { color: '#ef4444', width: 2 },
          itemStyle: { color: '#ef4444' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(239, 68, 68, 0.3)' },
                { offset: 1, color: 'rgba(239, 68, 68, 0.05)' }
              ]
            }
          },
          symbol: 'circle',
          symbolSize: 6,
          smooth: true
        }
      ]
    };
  }, [data, compact, currency, axisFormatter]);

  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex items-center justify-center" style={{ height }}>
        No data
      </div>
    );
  }

  return <ReactECharts option={option} style={{ height, width: '100%' }} />;
}
