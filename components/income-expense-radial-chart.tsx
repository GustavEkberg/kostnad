'use client';

import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart';
import { cn, formatCurrency } from '@/lib/utils';

type Props = {
  income: number;
  expenses: number;
  currency?: 'SEK' | 'EUR';
};

const chartConfig = {
  income: {
    label: 'Income',
    color: 'var(--color-green-500)'
  },
  expenses: {
    label: 'Expenses',
    color: 'var(--color-red-500)'
  }
} satisfies ChartConfig;

export function IncomeExpenseRadialChart({ income, expenses, currency = 'SEK' }: Props) {
  const net = income - expenses;
  const chartData = [{ income, expenses }];

  return (
    <div className="flex flex-col items-center overflow-hidden">
      <ChartContainer config={chartConfig} className="mx-auto aspect-square w-full max-w-[280px]">
        <RadialBarChart data={chartData} endAngle={180} innerRadius={80} outerRadius={140}>
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, name) => (
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'size-2.5 rounded-full',
                        name === 'income' ? 'bg-green-500' : 'bg-red-500'
                      )}
                    />
                    <span className="text-muted-foreground">
                      {name === 'income' ? 'Income' : 'Expenses'}
                    </span>
                    <span className="font-medium">{formatCurrency(Number(value), currency)}</span>
                  </div>
                )}
              />
            }
          />
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
            <Label
              content={({ viewBox }) => {
                if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                  return (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) - 16}
                        className={cn(
                          'fill-current text-2xl font-bold',
                          net >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        )}
                      >
                        {net >= 0 ? '+' : ''}
                        {formatCurrency(net, currency)}
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) + 4}
                        className="fill-muted-foreground"
                      >
                        Net
                      </tspan>
                    </text>
                  );
                }
              }}
            />
          </PolarRadiusAxis>
          <RadialBar
            dataKey="income"
            stackId="a"
            cornerRadius={5}
            fill="var(--color-green-500)"
            className="stroke-transparent stroke-2"
          />
          <RadialBar
            dataKey="expenses"
            stackId="a"
            cornerRadius={5}
            fill="var(--color-red-500)"
            className="stroke-transparent stroke-2"
          />
        </RadialBarChart>
      </ChartContainer>

      {/* Legend below chart */}
      <div className="-mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 px-2">
        <div className="flex items-center gap-2">
          <div className="size-3 shrink-0 rounded-full bg-green-500" />
          <span className="text-sm text-muted-foreground">Income</span>
          <span className="font-medium text-green-600 dark:text-green-400">
            {formatCurrency(income, currency)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-3 shrink-0 rounded-full bg-red-500" />
          <span className="text-sm text-muted-foreground">Expenses</span>
          <span className="font-medium text-red-600 dark:text-red-400">
            {formatCurrency(expenses, currency)}
          </span>
        </div>
      </div>
    </div>
  );
}
