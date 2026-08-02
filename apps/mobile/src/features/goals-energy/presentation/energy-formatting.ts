import type { BmiCategory, Energy } from '@fitness/domain';

const bmiCategoryLabels: Readonly<Record<BmiCategory, string>> = {
  'healthy-weight': 'Healthy weight',
  obesity: 'Obesity',
  overweight: 'Overweight',
  underweight: 'Underweight',
};

export function formatBmi(value: number): string {
  return value.toFixed(1);
}

export function formatBmiCategory(category: BmiCategory): string {
  return bmiCategoryLabels[category];
}

export function formatDailyEnergy(energy: Energy): string {
  return `${Math.round(energy.in('kilocalorie')).toLocaleString('en-US')} kcal/day`;
}
