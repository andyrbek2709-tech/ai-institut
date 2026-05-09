export interface NormativeRef {
  code: string;
  title: string;
  clause?: string;
  quote?: string;
}

export interface InputRange {
  min: number;
  max: number;
  typical?: number;
  hint?: string;
  warningBelow?: number;
  warningAbove?: number;
}

export interface CalculationInput {
  key: string;
  label: string;
  unit: string;
  defaultValue: number;
  range: InputRange;
}

export type Severity = 'safe' | 'warning' | 'critical';

export interface OutputThreshold {
  evaluate: (
    value: number,
    inputs: Record<string, number>,
  ) => { severity: Severity; message: string } | null;
}

export interface CalculationOutput {
  key: string;
  label: string;
  unit: string;
  precision?: number;
  formula: (inputs: Record<string, number>) => number;
  threshold?: OutputThreshold;
  description?: string;
  chartable?: boolean;
}

export interface Methodology {
  id: string;
  name: string; // e.g. "ГОСТ 32569-2022", "СП 60.13330.2020", "DIN EN 12098-14"
  description: string;
  asciiFormula: string;
  latexFormula: string;
  methodology: string; // Подробное описание методики
  inputs: CalculationInput[];
  outputs: CalculationOutput[];
  normativeRefs: NormativeRef[];
}

export interface FullCalculation {
  id: string;
  name: string;
  description: string;
  category: string;
  methodologies?: Methodology[]; // Массив методик для выбора
  defaultMethodologyId?: string; // ID методики по умолчанию
  warnings?: string[];
  keywords?: string[];
  // Legacy support (если есть старые расчёты с одной методикой)
  asciiFormula?: string;
  latexFormula?: string;
  methodology?: string;
  inputs?: CalculationInput[];
  outputs?: CalculationOutput[];
  normativeRefs?: NormativeRef[];
}

export interface HistoryEntry {
  id: string;
  calculationId: string;
  calculationName: string;
  timestampISO: string;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  severities: Record<string, Severity>;
}

export const HISTORY_STORAGE_KEY = 'enghub_calc_history_v1';
export const HISTORY_SCHEMA_VERSION = 1;
