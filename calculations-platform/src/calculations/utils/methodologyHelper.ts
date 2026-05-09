import { FullCalculation, Methodology } from '../types';

/**
 * Получить текущую методику из расчёта
 * Поддерживает как новый формат (методики в массиве), так и старый (single methodology)
 */
export function getCurrentMethodology(calculation: FullCalculation): Methodology | null {
  if (calculation.methodologies && calculation.methodologies.length > 0) {
    const current = calculation.methodologies.find((m) => m.id === calculation.defaultMethodologyId);
    return current || calculation.methodologies[0];
  }

  // Legacy support: если это старый расчёт без методик
  if (calculation.asciiFormula && calculation.inputs && calculation.outputs) {
    return {
      id: `${calculation.id}_legacy`,
      name: 'Legacy (Single Method)',
      description: calculation.methodology || '',
      asciiFormula: calculation.asciiFormula,
      latexFormula: calculation.latexFormula || '',
      methodology: calculation.methodology || '',
      inputs: calculation.inputs,
      outputs: calculation.outputs,
      normativeRefs: calculation.normativeRefs || [],
    };
  }

  return null;
}

/**
 * Получить все доступные методики для выбора
 */
export function getAvailableMethodologies(calculation: FullCalculation): Array<{ id: string; name: string }> {
  if (calculation.methodologies && calculation.methodologies.length > 0) {
    return calculation.methodologies.map((m) => ({ id: m.id, name: m.name }));
  }
  return [];
}

/**
 * Проверить, поддерживает ли расчёт выбор методики
 */
export function supportsMethodologySelection(calculation: FullCalculation): boolean {
  return !!(calculation.methodologies && calculation.methodologies.length > 1);
}

/**
 * Получить методику по ID
 */
export function getMethodologyById(
  calculation: FullCalculation,
  methodologyId: string,
): Methodology | null {
  const method = calculation.methodologies?.find((m) => m.id === methodologyId);
  return method || null;
}
