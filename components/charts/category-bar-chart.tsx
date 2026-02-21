'use client';

import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useMemo } from 'react';
import { formatAxisCurrency, formatTooltipCurrency } from '@/lib/utils';

type CategoryTrend = {
  categoryId: string | null;
  categoryName: string | null;
  data: Array<{ period: string; total: number }>;
};

type Props = {
  data: CategoryTrend[];
  title?: string;
  height?: number;
  compact?: boolean;
};

const COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6' // blue
];

export function CategoryBarChart({ data, title, height = 350, compact = false }: Props) {
  const option = useMemo((): EChartsOption => {
    if (data.length === 0) return {};

    // Sort by total amount across all periods
    const sorted = [...data].sort((a, b) => {
      const totalA = a.data.reduce((sum, d) => sum + d.total, 0);
      const totalB = b.data.reduce((sum, d) => sum + d.total, 0);
      return totalB - totalA;
    });

    // Limit to top categories
    const top = sorted.slice(0, compact ? 5 : 8);

    // Get all unique periods
    const allPeriods = Array.from(new Set(top.flatMap(cat => cat.data.map(d => d.period)))).sort();

    const series = top.map((cat, i) => {
      const periodMap = new Map(cat.data.map(d => [d.period, d.total]));
      return {
        name: cat.categoryName ?? 'Uncategorized',
        type: 'bar' as const,
        stack: 'total',
        data: allPeriods.map(p => periodMap.get(p) ?? 0),
        itemStyle: { color: COLORS[i % COLORS.length] }
      };
    });

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
            type: 'scroll'
          },
      grid: {
        top: title ? (compact ? 30 : 50) : compact ? 10 : 20,
        bottom: compact ? 30 : 60,
        left: compact ? 50 : 60,
        right: compact ? 10 : 20,
        containLabel: false
      },
      xAxis: {
        type: 'category',
        data: allPeriods,
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
      series
    };
  }, [data, title, compact]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
        No category data
      </div>
    );
  }

  return <ReactECharts option={option} style={{ height, width: '100%' }} />;
}
