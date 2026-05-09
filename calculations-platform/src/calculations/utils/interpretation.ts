import { CalculationOutput, Severity } from '../types';

export interface OutputInterpretation {
  value: number;
  severity: Severity;
  message?: string;
}

export const computeOutput = (
  output: CalculationOutput,
  inputs: Record<string, number>,
): OutputInterpretation => {
  let value: number;
  try {
    value = output.formula(inputs);
  } catch {
    return { value: NaN, severity: 'critical', message: 'Ошибка в формуле' };
  }

  if (!Number.isFinite(value)) {
    return { value, severity: 'warning', message: 'Результат не определён' };
  }

  if (output.threshold) {
    const evaluated = output.threshold.evaluate(value, inputs);
    if (evaluated) {
      return { value, severity: evaluated.severity, message: evaluated.message };
    }
  }
  return { value, severity: 'safe' };
};

export const computeAll = (
  outputs: CalculationOutput[],
  inputs: Record<string, number>,
): Record<string, OutputInterpretation> => {
  const result: Record<string, OutputInterpretation> = {};
  for (const out of outputs) {
    result[out.key] = computeOutput(out, inputs);
  }
  return result;
};

export const formatNumber = (value: number, precision: number = 2): string => {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1e6 || (Math.abs(value) > 0 && Math.abs(value) < 1e-3)) {
    return value.toExponential(precision);
  }
  return value.toFixed(precision);
};

export const severityColors: Record<
  Severity,
  { text: string; bg: string; border: string; ring: string }
> = {
  safe: {
    text: 'text-green-900 dark:text-green-100',
    bg: 'bg-green-50 dark:bg-green-900/40',
    border: 'border-green-300 dark:border-green-700',
    ring: 'ring-green-500',
  },
  warning: {
    text: 'text-amber-900 dark:text-amber-100',
    bg: 'bg-amber-50 dark:bg-amber-900/40',
    border: 'border-amber-300 dark:border-amber-700',
    ring: 'ring-amber-500',
  },
  critical: {
    text: 'text-red-900 dark:text-red-100',
    bg: 'bg-red-50 dark:bg-red-900/40',
    border: 'border-red-300 dark:border-red-700',
    ring: 'ring-red-500',
  },
};
