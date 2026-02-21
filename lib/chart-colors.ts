// Shared chart color constants for period comparisons
// Uses opacity to differentiate periods: yearAgo (lightest) -> prevMonth -> current (darkest)

export const CHART_COLORS = {
  // Period colors (neutral, using opacity for differentiation)
  current: {
    stroke: 'hsl(var(--foreground))',
    fill: 'hsl(var(--foreground))',
    fillOpacity: 1,
    strokeWidth: 2
  },
  prevMonth: {
    stroke: 'hsl(var(--foreground))',
    fill: 'hsl(var(--foreground))',
    fillOpacity: 0.5,
    strokeWidth: 1.5
  },
  yearAgo: {
    stroke: 'hsl(var(--foreground))',
    fill: 'hsl(var(--foreground))',
    fillOpacity: 0.25,
    strokeWidth: 1
  },

  // Semantic colors for income/expense
  income: 'hsl(142.1 76.2% 36.3%)', // green
  expense: 'hsl(0 84.2% 60.2%)' // red
} as const;

// Helper to get color based on value type
export function getValueColor(type: 'income' | 'expense' | 'net', value: number): string {
  if (type === 'income') return CHART_COLORS.income;
  if (type === 'expense') return CHART_COLORS.expense;
  return value >= 0 ? CHART_COLORS.income : CHART_COLORS.expense;
}
