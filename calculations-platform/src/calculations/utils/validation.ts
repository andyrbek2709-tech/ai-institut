import { CalculationInput } from '../types';

export type FieldStatus = 'ok' | 'warning' | 'error';

export interface FieldValidation {
  status: FieldStatus;
  message?: string;
}

export const validateInput = (
  input: CalculationInput,
  rawValue: number | string,
): FieldValidation => {
  const value = typeof rawValue === 'string' ? parseFloat(rawValue) : rawValue;

  if (Number.isNaN(value)) {
    return { status: 'error', message: 'Введите число' };
  }
  if (!Number.isFinite(value)) {
    return { status: 'error', message: 'Значение должно быть конечным' };
  }
  if (value < input.range.min) {
    return {
      status: 'error',
      message: `Минимум: ${input.range.min} ${input.unit}`,
    };
  }
  if (value > input.range.max) {
    return {
      status: 'error',
      message: `Максимум: ${input.range.max} ${input.unit}`,
    };
  }
  if (input.range.warningBelow !== undefined && value < input.range.warningBelow) {
    return {
      status: 'warning',
      message: `Нетипично низкое (типично ${input.range.typical ?? '—'} ${input.unit})`,
    };
  }
  if (input.range.warningAbove !== undefined && value > input.range.warningAbove) {
    return {
      status: 'warning',
      message: `Нетипично высокое (типично ${input.range.typical ?? '—'} ${input.unit})`,
    };
  }
  return { status: 'ok' };
};

export const validateAll = (
  inputs: CalculationInput[],
  values: Record<string, number>,
): Record<string, FieldValidation> => {
  const result: Record<string, FieldValidation> = {};
  for (const inp of inputs) {
    result[inp.key] = validateInput(inp, values[inp.key] ?? NaN);
  }
  return result;
};

export const hasBlockingErrors = (
  validations: Record<string, FieldValidation>,
): boolean => Object.values(validations).some((v) => v.status === 'error');
