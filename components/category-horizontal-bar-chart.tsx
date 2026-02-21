'use client';

import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import { CHART_COLORS } from '@/lib/chart-colors';
import { formatCurrency, formatCurrencyValue } from '@/lib/utils';

type CategorySummaryItem = {
  categoryId: string | null;
  categoryName: string | null;
  total: number;
  count: number;
};

type Category = {
  id: string;
  name: string;
  icon: string | null;
};

type Props = {
  currentLabel: string;
  categorySummary: CategorySummaryItem[];
  categories: Category[];
  currency?: 'SEK' | 'EUR';
};

type CustomLabelProps = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: string | number | null;
  icon?: string | null;
  category?: string;
};

function CustomLabel({ x = 0, y = 0, height = 0, icon, category }: CustomLabelProps) {
  const numX = Number(x);
  const numY = Number(y);
  const numHeight = Number(height);
  const centerY = numY + numHeight / 2 + 1;

  return (
    <text x={numX + 8} y={centerY} fill="var(--background)" fontSize={12} dominantBaseline="middle">
      {icon ? `${icon} ${category}` : category}
    </text>
  );
}

export function CategoryHorizontalBarChart({
  currentLabel: _currentLabel,
  categorySummary,
  categories,
  currency = 'SEK'
}: Props) {
  const fmt = (amount: number) => formatCurrency(amount, currency);
  const fmtValue = (value: string | number) => formatCurrencyValue(Number(value), currency);

  // Build icon lookup map
  const iconMap = new Map(categories.map(c => [c.id, c.icon]));

  // Filter to expenses only and sort by absolute amount
  const chartData = categorySummary
    .filter(c => c.total < 0)
    .map(c => ({
      category: c.categoryName ?? 'Uncategorized',
      icon: c.categoryId ? (iconMap.get(c.categoryId) ?? null) : null,
      amount: Math.abs(c.total)
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const chartConfig = {
    amount: {
      label: 'Amount',
      color: CHART_COLORS.expense
    },
    label: {
      color: 'var(--background)'
    }
  } satisfies ChartConfig;

  if (chartData.length === 0) {
    return <p className="text-muted-foreground text-sm">No expense data to display.</p>;
  }

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart
        accessibilityLayer
        data={chartData}
        layout="vertical"
        margin={{ left: 0, right: 50 }}
        barCategoryGap="12%"
      >
        <YAxis
          dataKey="category"
          type="category"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          hide
        />
        <XAxis dataKey="amount" type="number" hide />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, _name, item) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="size-2.5 rounded-sm"
                      style={{ backgroundColor: CHART_COLORS.expense }}
                    />
                    <span className="text-muted-foreground">
                      {item.payload.icon && `${item.payload.icon} `}
                      {item.payload.category}
                    </span>
                  </div>
                  <span className="font-mono font-medium">{fmt(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="amount" layout="vertical" fill="var(--color-amount)" radius={4}>
          <LabelList
            dataKey="category"
            content={props => (
              <CustomLabel
                {...props}
                icon={chartData.find(d => d.category === props.value)?.icon}
                category={props.value?.toString()}
              />
            )}
          />
          <LabelList
            dataKey="amount"
            position="right"
            offset={8}
            className="fill-foreground"
            fontSize={12}
            formatter={fmtValue}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
