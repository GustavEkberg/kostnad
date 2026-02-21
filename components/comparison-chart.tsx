'use client';

import { Bar, BarChart, XAxis, YAxis, Cell, Legend } from 'recharts';

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import { CHART_COLORS, getValueColor } from '@/lib/chart-colors';
import { formatCurrency } from '@/lib/utils';

type LegendPayload = {
  value: string;
  dataKey: string;
};

function CustomLegend({
  payload,
  labels
}: {
  payload?: LegendPayload[];
  labels: { current: string; prevMonth: string; yearAgo: string };
}) {
  if (!payload) return null;

  const getLabel = (dataKey: string) => {
    if (dataKey === 'current') return labels.current;
    if (dataKey === 'prevMonth') return labels.prevMonth;
    if (dataKey === 'yearAgo') return labels.yearAgo;
    return dataKey;
  };

  const getOpacity = (dataKey: string) => {
    if (dataKey === 'current') return CHART_COLORS.current.fillOpacity;
    if (dataKey === 'prevMonth') return CHART_COLORS.prevMonth.fillOpacity;
    if (dataKey === 'yearAgo') return CHART_COLORS.yearAgo.fillOpacity;
    return 1;
  };

  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-2 pt-2 text-xs">
      {payload.map(entry => (
        <div key={entry.dataKey} className="flex items-center gap-1.5">
          <div
            className="size-2.5 shrink-0 rounded-sm"
            style={{
              backgroundColor: CHART_COLORS.income,
              opacity: getOpacity(entry.dataKey)
            }}
          />
          <span className="text-muted-foreground">{getLabel(entry.dataKey)}</span>
        </div>
      ))}
    </div>
  );
}

type Props = {
  currentLabel: string;
  prevMonthLabel: string;
  yearAgoLabel: string;
  income: { current: number; prevMonth: number; yearAgo: number };
  expenses: { current: number; prevMonth: number; yearAgo: number };
  net: { current: number; prevMonth: number; yearAgo: number };
  currency?: 'SEK' | 'EUR';
};

export function ComparisonChart({
  currentLabel,
  prevMonthLabel,
  yearAgoLabel,
  income,
  expenses,
  net,
  currency = 'SEK'
}: Props) {
  const fmt = (amount: number) => formatCurrency(amount, currency);

  const chartConfig = {
    current: { label: currentLabel, color: 'hsl(var(--chart-1))' },
    prevMonth: { label: prevMonthLabel, color: 'hsl(var(--chart-2))' },
    yearAgo: { label: yearAgoLabel, color: 'hsl(var(--chart-3))' }
  } satisfies ChartConfig;

  // Expenses are negated so they extend left, income extends right
  const data = [
    {
      category: 'Income',
      current: income.current,
      prevMonth: income.prevMonth,
      yearAgo: income.yearAgo,
      type: 'income' as const
    },
    {
      category: 'Expenses',
      current: -expenses.current,
      prevMonth: -expenses.prevMonth,
      yearAgo: -expenses.yearAgo,
      type: 'expense' as const
    },
    {
      category: 'Net',
      current: net.current,
      prevMonth: net.prevMonth,
      yearAgo: net.yearAgo,
      type: 'net' as const
    }
  ];

  // Find the max absolute value for symmetric axis
  const allValues = data.flatMap(d => [d.current, d.prevMonth, d.yearAgo]);
  const maxAbsValue = Math.max(...allValues.map(Math.abs));
  const domainPadding = maxAbsValue * 0.1;

  // Generate symmetric ticks including 0
  const tickStep = Math.ceil(maxAbsValue / 2 / 10000) * 10000;
  const ticks = tickStep > 0 ? [-tickStep, 0, tickStep] : [0];

  return (
    <ChartContainer config={chartConfig} className="h-[250px] w-full overflow-hidden">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
        barGap={2}
        barCategoryGap={16}
      >
        <XAxis
          type="number"
          domain={[-(maxAbsValue + domainPadding), maxAbsValue + domainPadding]}
          ticks={ticks}
          tickFormatter={v => fmt(v)}
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis type="category" dataKey="category" hide />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const item = payload[0]?.payload;
                return item?.category ?? '';
              }}
              formatter={(value, name, item) => {
                const label =
                  name === 'current'
                    ? currentLabel
                    : name === 'prevMonth'
                      ? prevMonthLabel
                      : yearAgoLabel;
                const numValue = Number(value);
                // For expenses row, values are negated in data, so show absolute
                // For income/net, show actual value (net can be negative)
                const payload = item.payload;
                const isExpenseRow =
                  typeof payload === 'object' &&
                  payload !== null &&
                  'type' in payload &&
                  payload.type === 'expense';
                const displayValue = isExpenseRow ? Math.abs(numValue) : numValue;
                const opacity =
                  name === 'current'
                    ? CHART_COLORS.current.fillOpacity
                    : name === 'prevMonth'
                      ? CHART_COLORS.prevMonth.fillOpacity
                      : CHART_COLORS.yearAgo.fillOpacity;
                return (
                  <div className="flex w-full items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="size-2.5 rounded-sm"
                        style={{
                          backgroundColor: getValueColor(
                            isExpenseRow ? 'expense' : numValue >= 0 ? 'income' : 'expense',
                            numValue
                          ),
                          opacity
                        }}
                      />
                      <span className="text-muted-foreground">{label}</span>
                    </div>
                    <span className="font-mono font-medium">{fmt(displayValue)}</span>
                  </div>
                );
              }}
            />
          }
        />
        <Bar dataKey="yearAgo" radius={[4, 4, 4, 4]} maxBarSize={16}>
          {data.map((entry, index) => (
            <Cell
              key={`ya-${index}`}
              fill={getValueColor(entry.type, entry.yearAgo)}
              fillOpacity={CHART_COLORS.yearAgo.fillOpacity}
            />
          ))}
        </Bar>
        <Bar dataKey="prevMonth" radius={[4, 4, 4, 4]} maxBarSize={16}>
          {data.map((entry, index) => (
            <Cell
              key={`pm-${index}`}
              fill={getValueColor(entry.type, entry.prevMonth)}
              fillOpacity={CHART_COLORS.prevMonth.fillOpacity}
            />
          ))}
        </Bar>
        <Bar dataKey="current" radius={[4, 4, 4, 4]} maxBarSize={16}>
          {data.map((entry, index) => (
            <Cell
              key={`curr-${index}`}
              fill={getValueColor(entry.type, entry.current)}
              fillOpacity={CHART_COLORS.current.fillOpacity}
            />
          ))}
        </Bar>
        <Legend
          content={
            <CustomLegend
              labels={{
                current: currentLabel,
                prevMonth: prevMonthLabel,
                yearAgo: yearAgoLabel
              }}
            />
          }
          verticalAlign="bottom"
        />
      </BarChart>
    </ChartContainer>
  );
}
