'use client';

import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useMemo } from 'react';
import type { MerchantPeriodTrend } from '@/lib/core/transaction/queries';
import { formatAxisCurrency, formatTooltipCurrency } from '@/lib/utils';

type Props = {
  data: MerchantPeriodTrend[];
  height?: number;
};

export function MerchantExpenseChart({ data, height = 300 }: Props) {
  const option = useMemo((): EChartsOption => {
    if (data.length === 0) return {};

    const periods = data.map(d => d.period);
    const expenses = data.map(d => d.expenses);
    const counts = data.map(d => d.transactionCount);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: params => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const p = params[0];
          const periodName = String(p.name ?? '');
          const value = typeof p.value === 'number' ? p.value : 0;
          const countData = counts[data.findIndex(d => d.period === periodName)] ?? 0;
          return `
            <div style="padding: 4px 8px;">
              <div style="font-weight: 500; margin-bottom: 4px;">${periodName}</div>
              <div style="color: #ef4444;">${formatTooltipCurrency(value)}</div>
              <div style="color: #888; font-size: 12px;">${countData} transaction${countData !== 1 ? 's' : ''}</div>
            </div>
          `;
        }
      },
      grid: {
        top: 20,
        bottom: 30,
        left: 60,
        right: 20,
        containLabel: false
      },
      xAxis: {
        type: 'category',
        data: periods,
        axisLabel: {
          fontSize: 12
        },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 12,
          formatter: formatAxisCurrency
        },
        splitLine: { lineStyle: { color: 'rgba(128, 128, 128, 0.15)' } }
      },
      series: [
        {
          name: 'Expenses',
          type: 'line',
          data: expenses,
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
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
        No spending data
      </div>
    );
  }

  return <ReactECharts option={option} style={{ height, width: '100%' }} />;
}
