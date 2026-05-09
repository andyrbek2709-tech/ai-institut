import { FullCalculation, CalculationInput, CalculationOutput, NormativeRef, Methodology } from '../types';
import { getCurrentMethodology, supportsMethodologySelection } from './methodologyHelper';

/**
 * Управление состоянием расчёта (текущая методика + соответствующие входы/выходы)
 */

export interface CalculationState {
  calculation: FullCalculation;
  selectedMethodologyId: string;
  currentMethodology: Methodology | null;
  inputs: CalculationInput[];
  outputs: CalculationOutput[];
  normativeRefs: NormativeRef[];
  supportsMethodologySelection: boolean;
}

/**
 * Получить состояние расчёта с текущей методикой
 */
export function getCalculationState(
  calculation: FullCalculation,
  selectedMethodologyId?: string,
): CalculationState {
  const supportsSelection = supportsMethodologySelection(calculation);

  // Если методики есть, использовать выбранную или по умолчанию
  if (calculation.methodologies && calculation.methodologies.length > 0) {
    const methodologyId = selectedMethodologyId || calculation.defaultMethodologyId;
    const currentMethodology = calculation.methodologies.find((m) => m.id === methodologyId);
    const methodology = currentMethodology || calculation.methodologies[0];

    return {
      calculation,
      selectedMethodologyId: methodology.id,
      currentMethodology: methodology,
      inputs: methodology.inputs,
      outputs: methodology.outputs,
      normativeRefs: methodology.normativeRefs,
      supportsMethodologySelection: supportsSelection,
    };
  }

  // Legacy: старые расчёты с одной методикой
  const currentMethodology = getCurrentMethodology(calculation);
  return {
    calculation,
    selectedMethodologyId: currentMethodology?.id || '',
    currentMethodology,
    inputs: calculation.inputs || [],
    outputs: calculation.outputs || [],
    normativeRefs: calculation.normativeRefs || [],
    supportsMethodologySelection: supportsSelection,
  };
}

/**
 * Получить методику по ID для данного расчёта
 */
export function selectMethodology(
  calculation: FullCalculation,
  methodologyId: string,
): Methodology | null {
  if (!calculation.methodologies) return null;
  return calculation.methodologies.find((m) => m.id === methodologyId) || null;
}

/**
 * Получить список доступных методик для выбора (с именами и ID)
 */
export function getMethodologyOptions(calculation: FullCalculation): Array<{
  id: string;
  name: string;
}> {
  if (!calculation.methodologies) return [];
  return calculation.methodologies.map((m) => ({
    id: m.id,
    name: m.name,
  }));
}
