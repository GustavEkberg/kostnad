'use client';

import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import { CHART_COLORS } from '@/lib/chart-colors';

type CategorySummaryItem = {
  categoryId: string | null;
  categoryName: string | null;
  total: number;
  count: number;
};

type Props = {
  currentLabel: string;
  prevMonthLabel: string;
  yearAgoLabel: string;
  categorySummary: CategorySummaryItem[];
  prevCategorySummary: CategorySummaryItem[];
  yearAgoCategorySummary: CategorySummaryItem[];
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export function CategoryRadarChart({
  currentLabel,
  prevMonthLabel,
  yearAgoLabel,
  categorySummary,
  prevCategorySummary,
  yearAgoCategorySummary
}: Props) {
  // Get all unique category names across all periods (expenses only)
  const allCategories = new Set<string>();
  const addExpenseCategories = (summary: CategorySummaryItem[]) => {
    summary
      .filter(c => c.total < 0)
      .forEach(c => allCategories.add(c.categoryName ?? 'Uncategorized'));
  };
  addExpenseCategories(categorySummary);
  addExpenseCategories(prevCategorySummary);
  addExpenseCategories(yearAgoCategorySummary);

  // Build lookup maps for each period
  const buildLookup = (summary: CategorySummaryItem[]) => {
    const map = new Map<string, number>();
    summary
      .filter(c => c.total < 0)
      .forEach(c => map.set(c.categoryName ?? 'Uncategorized', Math.abs(c.total)));
    return map;
  };

  const currentLookup = buildLookup(categorySummary);
  const prevLookup = buildLookup(prevCategorySummary);
  const yearAgoLookup = buildLookup(yearAgoCategorySummary);

  // Build chart data - sort by current period total descending
  const chartData = Array.from(allCategories)
    .map(category => ({
      category,
      current: currentLookup.get(category) ?? 0,
      prevMonth: prevLookup.get(category) ?? 0,
      yearAgo: yearAgoLookup.get(category) ?? 0
    }))
    .sort((a, b) => b.current - a.current)
    .slice(0, 8); // Limit to top 8 categories for readability

  const chartConfig = {
    current: { label: currentLabel, color: 'hsl(var(--chart-1))' },
    prevMonth: { label: prevMonthLabel, color: 'hsl(var(--chart-2))' },
    yearAgo: { label: yearAgoLabel, color: 'hsl(var(--chart-3))' }
  } satisfies ChartConfig;

  if (chartData.length === 0) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-muted-foreground text-sm font-normal">By Category</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No expense data to display.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-normal">
          Expenses by Category
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
          <RadarChart data={chartData}>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    const label =
                      name === 'current'
                        ? currentLabel
                        : name === 'prevMonth'
                          ? prevMonthLabel
                          : yearAgoLabel;
                    const opacity =
                      name === 'current'
                        ? CHART_COLORS.current.fillOpacity * 0.4
                        : name === 'prevMonth'
                          ? CHART_COLORS.prevMonth.fillOpacity * 0.4
                          : CHART_COLORS.yearAgo.fillOpacity * 0.4;
                    return (
                      <div className="flex w-full items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="size-2.5 rounded-sm"
                            style={{
                              backgroundColor: CHART_COLORS.expense,
                              opacity
                            }}
                          />
                          <span className="text-muted-foreground">{label}</span>
                        </div>
                        <span className="font-mono font-medium">
                          {formatCurrency(Number(value))}
                        </span>
                      </div>
                    );
                  }}
                />
              }
            />
            <PolarAngleAxis
              dataKey="category"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            />
            <PolarGrid strokeDasharray="3 3" />
            <Radar
              name="yearAgo"
              dataKey="yearAgo"
              stroke={CHART_COLORS.expense}
              fill={CHART_COLORS.expense}
              fillOpacity={CHART_COLORS.yearAgo.fillOpacity * 0.4}
              strokeWidth={CHART_COLORS.yearAgo.strokeWidth}
            />
            <Radar
              name="prevMonth"
              dataKey="prevMonth"
              stroke={CHART_COLORS.expense}
              fill={CHART_COLORS.expense}
              fillOpacity={CHART_COLORS.prevMonth.fillOpacity * 0.4}
              strokeWidth={CHART_COLORS.prevMonth.strokeWidth}
            />
            <Radar
              name="current"
              dataKey="current"
              stroke={CHART_COLORS.expense}
              fill={CHART_COLORS.expense}
              fillOpacity={CHART_COLORS.current.fillOpacity * 0.4}
              strokeWidth={CHART_COLORS.current.strokeWidth}
            />
          </RadarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
