export interface CalcInput {
  id: string;
  name: string;
  unit?: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  hint?: string; // Hint to show if validation fails, e.g. "Обычно от 0.5 до 2.0"
}

export interface CalcResult {
  value: number | string;
  unit?: string;
  label?: string; // Optional label for the result, e.g. "Общие потери давления"
}

export interface CalcReportStep {
  title?: string;
  text?: string;
  formulaLatex?: string; // e.g. "\\Delta P = \\lambda \\frac{L}{D} \\frac{\\rho v^2}{2}"
  formulaSubstitutedLatex?: string; // e.g. "\\Delta P = 0.02 \\cdot \\frac{100}{0.1} \\cdot \\frac{1000 \\cdot 2^2}{2}"
}

export interface CalcTemplate {
  id: string;
  cat: string;
  name: string;
  desc: string;
  normativeReference: string; // e.g. "СНиП 2.04.05-91, СП 60.13330.2020"
  inputs: CalcInput[];
  calculate: (inputs: Record<string, number>) => {
    results: Record<string, CalcResult>;
    report: CalcReportStep[];
  };
}
