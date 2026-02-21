'use client';

import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useMemo } from 'react';

type CategoryData = {
  categoryId: string | null;
  categoryName: string | null;
  total: number;
  count: number;
};

type Props = {
  data: CategoryData[];
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

export function CategoryPieChart({ data, title, height = 300, compact = false }: Props) {
  const option = useMemo((): EChartsOption => {
    // Filter to expenses only (negative totals) and sort by absolute value
    const expenses = data
      .filter(d => d.total < 0)
      .sort((a, b) => a.total - b.total) // Most negative first
      .slice(0, compact ? 6 : 10);

    if (expenses.length === 0) return {};

    return {
      title: title
        ? {
            text: title,
            left: 'center',
            textStyle: { fontSize: compact ? 14 : 16, fontWeight: 'normal' }
          }
        : undefined,
      tooltip: {
        trigger: 'item',
        formatter: '{b}<br/>{c} kr ({d}%)'
      },
      legend: compact
        ? undefined
        : {
            bottom: 0,
            type: 'plain',
            orient: 'horizontal',
            left: 'center',
            width: '90%',
            itemGap: 12,
            itemWidth: 12,
            itemHeight: 12,
            textStyle: {
              fontSize: 12,
              overflow: 'truncate',
              width: 80
            }
          },
      series: [
        {
          type: 'pie',
          radius: compact ? ['40%', '70%'] : ['30%', '60%'],
          center: ['50%', compact ? '50%' : '45%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: !compact,
            formatter: '{b}: {d}%'
          },
          labelLine: {
            show: !compact
          },
          data: expenses.map((d, i) => ({
            name: d.categoryName ?? 'Uncategorized',
            value: Math.abs(d.total),
            itemStyle: { color: COLORS[i % COLORS.length] }
          }))
        }
      ]
    };
  }, [data, title, compact]);

  if (data.filter(d => d.total < 0).length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
        No expense data
      </div>
    );
  }

  return <ReactECharts option={option} style={{ height, width: '100%' }} />;
}
