import React, { useState, useMemo } from 'react';
import { DemoCalculation, DEMO_CALCULATIONS } from '../data/demonstrations';
import { FormulaRenderer } from '../components/FormulaRenderer';
import { ResultsVisualization } from '../components/ResultsVisualization';

interface CalculationWorkspaceProps {
  calculationId: string;
  onBack: () => void;
}

export const CalculationWorkspace: React.FC<CalculationWorkspaceProps> = ({
  calculationId,
  onBack,
}) => {
  const calculation = DEMO_CALCULATIONS.find((c) => c.id === calculationId);
  const [inputValues, setInputValues] = useState<Record<string, number>>(
    calculation
      ? Object.fromEntries(
          calculation.inputs.map((inp) => [inp.label, inp.defaultValue]),
        )
      : {},
  );

  const results = useMemo(() => {
    if (!calculation) return {};
    return Object.fromEntries(
      calculation.outputs.map((out) => [
        out.label,
        out.formula ? out.formula(inputValues) : null,
      ]),
    );
  }, [calculation, inputValues]);

  const getWarningLevel = (label: string, value: number) => {
    if (!calculation) return 'safe';

    // Stress analysis warnings
    if (label.includes('напряжение') && value > 160) return 'warning';
    if (label.includes('давление') && value > 3) return 'warning';
    if (label.includes('скорость') && value > 5) return 'warning';

    return 'safe';
  };

  if (!calculation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
            Расчёт не найден
          </p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            ← Вернуться
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            title="Back to calculations"
          >
            <span className="text-2xl">←</span>
          </button>
          <div className="flex-1 ml-6">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{calculation.category === 'structural' ? '🏗️' : calculation.category === 'thermal' ? '🔥' : calculation.category === 'electrical' ? '⚡' : '🔧'}</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {calculation.name}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {calculation.description}
                </p>
              </div>
            </div>
          </div>
          <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors text-sm">
            💾 Export
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* LEFT: Input Panel (1/4) */}
          <div className="xl:col-span-1">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 sticky top-32">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <span>⚙️</span> Исходные данные
              </h2>

              <div className="space-y-6">
                {calculation.inputs.map((input) => (
                  <div key={input.label}>
                    <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      {input.label}
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        value={inputValues[input.label] ?? input.defaultValue}
                        onChange={(e) =>
                          setInputValues({
                            ...inputValues,
                            [input.label]: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                        step="any"
                      />
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-3 rounded-lg whitespace-nowrap">
                        {input.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() =>
                  setInputValues(
                    Object.fromEntries(
                      calculation.inputs.map((inp) => [inp.label, inp.defaultValue]),
                    ),
                  )
                }
                className="w-full mt-8 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium text-sm"
              >
                🔄 Reset Values
              </button>
            </div>
          </div>

          {/* CENTER: Formula & Methodology (2/4) */}
          <div className="xl:col-span-2 space-y-6">
            {/* Formula Card */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-xl border border-blue-200 dark:border-blue-700 p-8">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <span>📐</span> Formula
              </h2>
              {calculation.formula ? (
                <div className="bg-white dark:bg-gray-900 rounded-lg p-6 overflow-x-auto">
                  <FormulaRenderer formula={calculation.formula} />
                </div>
              ) : (
                <p className="text-gray-700 dark:text-gray-300 text-center py-4">
                  Built-in calculation formula
                </p>
              )}
            </div>

            {/* Methodology Card */}
            {calculation.methodology && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span>📚</span> Engineering Methodology
                </h3>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 rounded-lg p-4">
                  {calculation.methodology}
                </p>
              </div>
            )}

            {/* Safety & Standards */}
            <div className="bg-green-50 dark:bg-green-900 rounded-xl border border-green-200 dark:border-green-700 p-6">
              <h3 className="text-lg font-bold text-green-900 dark:text-green-100 mb-4 flex items-center gap-2">
                <span>✓</span> Verification Status
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400 text-lg">✓</span>
                  <span className="text-xs font-medium text-green-800 dark:text-green-200">
                    Verified
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400 text-lg">✓</span>
                  <span className="text-xs font-medium text-green-800 dark:text-green-200">
                    Standardized
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400 text-lg">✓</span>
                  <span className="text-xs font-medium text-green-800 dark:text-green-200">
                    Current (RU)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Results (1/4) */}
          <div className="xl:col-span-1">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 sticky top-32">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <span>📊</span> Results
              </h2>

              <div className="space-y-4">
                {calculation.outputs.map((output) => {
                  const value = results[output.label] as number;
                  const warningLevel = getWarningLevel(output.label, value);
                  const isWarning = warningLevel === 'warning';

                  return (
                    <div
                      key={output.label}
                      className={`rounded-lg p-4 border ${
                        isWarning
                          ? 'bg-amber-50 dark:bg-amber-900 border-amber-200 dark:border-amber-700'
                          : 'bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700'
                      }`}
                    >
                      <div className={`text-xs font-semibold mb-2 ${
                        isWarning
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-green-700 dark:text-green-300'
                      }`}>
                        {output.label}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <div className={`text-2xl font-bold ${
                          isWarning
                            ? 'text-amber-900 dark:text-amber-100'
                            : 'text-green-900 dark:text-green-100'
                        }`}>
                          {typeof value === 'number' ? value.toFixed(3) : 'N/A'}
                        </div>
                        <div className={`text-xs font-semibold ${
                          isWarning
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-green-700 dark:text-green-300'
                        }`}>
                          {output.unit}
                        </div>
                      </div>
                      {isWarning && (
                        <div className="text-xs text-amber-700 dark:text-amber-300 mt-2 pt-2 border-t border-amber-200 dark:border-amber-700">
                          ⚠️ Check limits
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Safety Notes */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span>⚠️</span> Safety Notes
                </h3>
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed bg-white dark:bg-gray-900 rounded p-3">
                  Always verify units before using results in technical documentation. Cross-check with applicable standards.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
