import React, { useState, useMemo } from 'react';
import { DemoCalculation, DEMO_CALCULATIONS } from '../data/demonstrations';

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

  if (!calculation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
            Расчёт не найден
          </p>
          <button
            onClick={onBack}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ← Вернуться
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-2xl hover:opacity-70 transition-opacity"
          >
            ←
          </button>
          <div className="flex-1 ml-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {calculation.name}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {calculation.description}
            </p>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded">
            {calculation.id}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 max-w-7xl mx-auto">
        <div className="lg:col-span-1">
          <div className="sticky top-20 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📋 Исходные данные
            </h2>

            <div className="space-y-5">
              {calculation.inputs.map((input) => (
                <div key={input.label}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {input.label}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={inputValues[input.label] ?? input.defaultValue}
                      onChange={(e) =>
                        setInputValues({
                          ...inputValues,
                          [input.label]: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg whitespace-nowrap">
                      {input.unit}
                    </div>
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
              className="w-full mt-6 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            >
              🔄 Сбросить значения
            </button>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📐 Формула
            </h2>

            {calculation.formula ? (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                <div className="font-mono text-sm text-blue-900 dark:text-blue-100 break-words">
                  {calculation.formula}
                </div>
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Используется встроенная формула расчёта
              </p>
            )}

            {calculation.methodology && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  📚 Методология
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {calculation.methodology}
                </p>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              ✅ Статус
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400 text-lg">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Проверена
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400 text-lg">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Стандартизирована
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400 text-lg">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Актуальна для РФ
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-20 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📊 Результаты
            </h2>

            <div className="space-y-4 mb-6">
              {calculation.outputs.map((output) => {
                const value = results[output.label];
                return (
                  <div
                    key={output.label}
                    className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900 dark:to-emerald-800 rounded-lg p-4 border border-green-200 dark:border-green-700"
                  >
                    <div className="text-sm text-green-700 dark:text-green-300 mb-1">
                      {output.label}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                        {typeof value === 'number'
                          ? value.toFixed(3)
                          : 'N/A'}
                      </div>
                      <div className="text-sm text-green-700 dark:text-green-300">
                        {output.unit}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                ⚠️ Рекомендации
              </h3>
              <div className="bg-amber-50 dark:bg-amber-900 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Проверьте единицы измерения входных данных перед использованием
                  результата в проектной документации.
                </p>
              </div>
            </div>

            <button className="w-full mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              💾 Сохранить в отчёт
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
