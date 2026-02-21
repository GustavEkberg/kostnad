'use client';

import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useMemo } from 'react';
import { formatAxisCurrency, formatTooltipCurrency } from '@/lib/utils';

type MerchantTotal = {
  merchant: string;
  total: number;
};

type Props = {
  data: MerchantTotal[];
  title?: string;
  height?: number;
  limit?: number;
};

export function TopMerchantsChart({ data, title, height = 350, limit = 10 }: Props) {
  const option = useMemo((): EChartsOption => {
    if (data.length === 0) return {};

    // Sort and limit to top merchants
    const sorted = [...data].sort((a, b) => b.total - a.total).slice(0, limit);

    // Reverse for horizontal bar chart (so highest is at top)
    const display = [...sorted].reverse();

    return {
      title: title
        ? {
            text: title,
            left: 'center',
            textStyle: { fontSize: 16, fontWeight: 'normal' }
          }
        : undefined,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: value => formatTooltipCurrency(Number(value))
      },
      grid: {
        top: title ? 50 : 20,
        bottom: 20,
        left: 10,
        right: 40,
        containLabel: true
      },
      xAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 12,
          formatter: formatAxisCurrency
        },
        splitLine: { lineStyle: { color: 'rgba(128, 128, 128, 0.15)' } }
      },
      yAxis: {
        type: 'category',
        data: display.map(d => d.merchant),
        axisLabel: {
          fontSize: 11,
          width: 120,
          overflow: 'truncate',
          ellipsis: '...'
        },
        splitLine: { show: false }
      },
      series: [
        {
          type: 'bar',
          data: display.map(d => d.total),
          itemStyle: {
            color: '#6366f1', // indigo
            borderRadius: [0, 4, 4, 0]
          },
          barMaxWidth: 24,
          label: {
            show: true,
            position: 'right',
            fontSize: 10,
            formatter: '{c} kr'
          }
        }
      ]
    };
  }, [data, title, limit]);

  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex items-center justify-center" style={{ height }}>
        No merchant data
      </div>
    );
  }

  return <ReactECharts option={option} style={{ height, width: '100%' }} />;
}
