'use client';

import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatAxisCurrency, formatTooltipCurrency } from '@/lib/utils';

type PeriodData = {
  period: string;
  periodKey: string;
  income: number;
  expenses: number;
  net: number;
};

type Props = {
  data: PeriodData[];
  title?: string;
  height?: number;
  compact?: boolean;
};

export function PeriodBarChart({ data, title, height = 300, compact = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChartClick = useCallback(
    (params: { dataIndex?: number }) => {
      if (params.dataIndex !== undefined) {
        const periodKey = data[params.dataIndex]?.periodKey;
        if (periodKey) {
          const newParams = new URLSearchParams(searchParams.toString());
          newParams.set('period', periodKey);
          router.push(`?${newParams.toString()}`);
        }
      }
    },
    [data, router, searchParams]
  );

  const option = useMemo((): EChartsOption => {
    if (data.length === 0) return {};

    const periods = data.map(d => d.period);

    return {
      title: title
        ? {
            text: title,
            left: 'center',
            textStyle: { fontSize: compact ? 14 : 16, fontWeight: 'normal' }
          }
        : undefined,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: value => formatTooltipCurrency(Number(value))
      },
      legend: compact
        ? undefined
        : {
            bottom: 0,
            data: ['Income', 'Expenses']
          },
      grid: {
        top: title ? (compact ? 30 : 50) : compact ? 10 : 20,
        bottom: compact ? 30 : 50,
        left: compact ? 50 : 60,
        right: compact ? 10 : 20,
        containLabel: false
      },
      xAxis: {
        type: 'category',
        data: periods,
        triggerEvent: true,
        axisLabel: {
          rotate: compact ? 45 : 0,
          fontSize: compact ? 10 : 12
        },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: compact ? 10 : 12,
          formatter: formatAxisCurrency
        },
        splitLine: { lineStyle: { color: 'rgba(128, 128, 128, 0.15)' } }
      },
      series: [
        {
          name: 'Income',
          type: 'bar',
          data: data.map(d => d.income),
          itemStyle: { color: '#22c55e' },
          barGap: '30%'
        },
        {
          name: 'Expenses',
          type: 'bar',
          data: data.map(d => d.expenses),
          itemStyle: { color: '#ef4444' }
        }
      ]
    };
  }, [data, title, compact]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
        No data
      </div>
    );
  }

  return (
    <div style={{ cursor: 'pointer' }}>
      <ReactECharts
        option={option}
        style={{ height, width: '100%' }}
        onEvents={{ click: handleChartClick }}
      />
    </div>
  );
}
