import React, { useMemo, useState } from 'react';
import { DEMO_CALCULATIONS } from '../data/demonstrations';
import { FormulaRenderer } from '../components/FormulaRenderer';
import { EngineeringTooltip } from '../components/EngineeringTooltip';
import { ResultsVisualization } from '../components/ResultsVisualization';
import { computeAll, formatNumber, severityColors } from '../utils/interpretation';
import { hasBlockingErrors, validateAll } from '../utils/validation';
import { exportDocx } from '../utils/exportDocx';
import { exportXlsx } from '../utils/exportXlsx';
import { saveToHistory } from '../storage/history';
import { HistoryEntry, Severity } from '../types';
import { getCalculationState } from '../utils/calculationState';

interface CalculationWorkspaceProps {
  calculationId: string;
  onBack: () => void;
  presetInputs?: Record<string, number>;
}

const Toast: React.FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;
  return (
    <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 border border-green-400 dark:border-green-600 shadow-xl rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-200">
      <span className="text-green-500">✓</span>
      {message}
    </div>
  );
};

export const CalculationWorkspace: React.FC<CalculationWorkspaceProps> = ({
  calculationId,
  onBack,
  presetInputs,
}) => {
  const calculation = DEMO_CALCULATIONS.find((c) => c.id === calculationId);
  const calcState = calculation ? getCalculationState(calculation) : null;
  const inputs = calcState?.inputs || [];
  const outputs = calcState?.outputs || [];
  const normativeRefs = calcState?.normativeRefs || [];
  const currentMethodology = calcState?.currentMethodology;

  const [inputValues, setInputValues] = useState<Record<string, number>>(() => {
    if (!calculation) return {};
    const base: Record<string, number> = {};
    for (const inp of inputs) {
      base[inp.key] =
        presetInputs && Object.prototype.hasOwnProperty.call(presetInputs, inp.key)
          ? presetInputs[inp.key]
          : inp.defaultValue;
    }
    return base;
  });
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'none' | 'docx' | 'xlsx'>('none');

  const validations = useMemo(() => {
    if (!calculation) return {};
    return validateAll(inputs, inputValues);
  }, [calculation, inputs, inputValues]);

  const blocked = hasBlockingErrors(validations);

  const interpretations = useMemo(() => {
    if (!calculation || blocked) return {};
    return computeAll(outputs, inputValues);
  }, [calculation, outputs, inputValues, blocked]);

  if (!calculation) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Расчёт не найден</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            ← Вернуться
          </button>
        </div>
      </div>
    );
  }

  const updateInput = (key: string, raw: string) => {
    const value = parseFloat(raw);
    setInputValues((prev) => ({ ...prev, [key]: Number.isNaN(value) ? NaN : value }));
  };

  const resetInputs = () => {
    const base: Record<string, number> = {};
    for (const inp of inputs) base[inp.key] = inp.defaultValue;
    setInputValues(base);
  };

  const onSaveHistory = () => {
    if (blocked || !calculation) return;
    const outputsRecord: Record<string, number> = {};
    const severities: Record<string, Severity> = {};
    for (const out of outputs) {
      const interp = interpretations[out.key];
      if (interp) {
        outputsRecord[out.key] = interp.value;
        severities[out.key] = interp.severity;
      }
    }
    const entry: Omit<HistoryEntry, 'id' | 'timestampISO'> = {
      calculationId: calculation.id,
      calculationName: calculation.name,
      inputs: { ...inputValues },
      outputs: outputsRecord,
      severities,
    };
    saveToHistory(entry);
    setSavedFlash('Сохранено в историю');
    window.setTimeout(() => setSavedFlash(null), 2500);
  };

  const onExport = async (kind: 'docx' | 'xlsx') => {
    if (blocked) return;
    setExporting(kind);
    try {
      if (kind === 'docx') {
        await exportDocx(calculation, inputValues, interpretations);
      } else {
        await exportXlsx(calculation, inputValues, interpretations);
      }
    } catch (e) {
      window.alert(
        `Не удалось экспортировать ${kind.toUpperCase()}: ${
          e instanceof Error ? e.message : 'неизвестная ошибка'
        }`,
      );
    } finally {
      setExporting('none');
    }
  };

  const chartData = outputs
    .filter((out) => out.chartable !== false)
    .map((out) => {
      const interp = interpretations[out.key];
      return {
        name: out.label,
        value: interp ? interp.value : NaN,
        unit: out.unit,
        severity: (interp ? interp.severity : 'safe') as Severity,
      };
    });
  const numericChartPoints = chartData.filter(
    (d) => Number.isFinite(d.value) && Math.abs(d.value) < 1e9,
  );
  const showChart = numericChartPoints.length >= 2;

  return (
    /* Занимает всю высоту, выданную родителем (flex-1 min-h-0 в CalculationsApp) */
    <div className="h-full flex flex-col p-3 gap-3 min-h-0">
      <Toast message={savedFlash} />

      {/* ── HEADER — shrink-0, не скроллируется ── */}
      <div className="shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 flex items-center gap-2">
        <button
          onClick={onBack}
          className="shrink-0 px-2.5 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors text-xs"
        >
          ← Каталог
        </button>
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">
            {calculation.name}
          </h1>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
            {calculation.description}
          </p>
        </div>
        <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded hidden md:block">
          {calculation.id}
        </span>
      </div>

      {/*
        ── CONTENT GRID — flex-1 min-h-0 ──
        mobile: стек, overflow-y-auto на контейнере
        xl: 3 колонки, каждая скроллится сама
      */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-3 gap-3 overflow-y-auto xl:overflow-hidden">

        {/* ── COL 1: Исходные данные ── */}
        <div className="xl:h-full xl:overflow-y-auto xl:min-h-0 order-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <h2 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
              📋 Исходные данные
            </h2>
            <div className="space-y-2">
              {inputs.map((input) => {
                const v = validations[input.key];
                const ringClass =
                  v?.status === 'error'
                    ? 'ring-2 ring-red-500 border-red-400'
                    : v?.status === 'warning'
                      ? 'ring-2 ring-amber-400 border-amber-400'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500';
                return (
                  <div key={input.key}>
                    <div className="flex items-center gap-1 mb-0.5">
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-tight">
                        {input.label}
                      </label>
                      <EngineeringTooltip range={input.range} unit={input.unit} />
                    </div>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={Number.isNaN(inputValues[input.key]) ? '' : inputValues[input.key]}
                        step="any"
                        onChange={(e) => updateInput(input.key, e.target.value)}
                        className={`flex-1 px-2.5 py-1 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-xs border focus:outline-none ${ringClass}`}
                      />
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md whitespace-nowrap">
                        {input.unit}
                      </span>
                    </div>
                    {v?.message && (
                      <p
                        className={`mt-0.5 text-[11px] flex items-center gap-1 ${
                          v.status === 'error'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        <span>{v.status === 'error' ? '✕' : '⚠'}</span>
                        {v.message}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={resetInputs}
              className="w-full mt-3 px-2.5 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs font-medium"
            >
              🔄 Сбросить к типичным значениям
            </button>
          </div>
        </div>

        {/* ── COL 2 (xl): Формула + Методология + Нормативы ── */}
        <div className="xl:h-full xl:overflow-y-auto xl:min-h-0 order-3 xl:order-2">
          <div className="space-y-3">
            {currentMethodology && (
              <>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <h2 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                    📐 Формула
                  </h2>
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-md p-2.5 border border-blue-200 dark:border-blue-700">
                    <FormulaRenderer formula={currentMethodology.latexFormula} />
                  </div>
                  <div className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500 font-mono break-all">
                    {currentMethodology.asciiFormula}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <h2 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                    📚 Методология
                  </h2>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                    {currentMethodology.methodology}
                  </p>
                </div>
              </>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <h2 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                📜 Нормативы
              </h2>
              <ul className="space-y-2">
                {normativeRefs.map((ref) => (
                  <li key={ref.code} className="text-xs">
                    <div className="font-semibold text-gray-900 dark:text-white">{ref.code}</div>
                    <div className="text-gray-600 dark:text-gray-400">{ref.title}</div>
                    {ref.clause && (
                      <div className="text-gray-500 dark:text-gray-500 italic">{ref.clause}</div>
                    )}
                    {ref.quote && (
                      <div className="mt-1 pl-2 border-l-2 border-blue-400 text-gray-500 dark:text-gray-400 italic">
                        «{ref.quote}»
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {calculation.warnings && calculation.warnings.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-2.5">
                <h2 className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 mb-1 uppercase tracking-wide">
                  ⚠️ Ограничения
                </h2>
                <ul className="space-y-0.5">
                  {calculation.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-800 dark:text-amber-300">
                      • {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* ── COL 3 (xl): Результаты + Экспорт ── */}
        <div className="xl:h-full xl:overflow-y-auto xl:min-h-0 order-2 xl:order-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <h2 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
              📊 Результаты
            </h2>

            {blocked ? (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-2.5 text-xs text-red-800 dark:text-red-200">
                ✕ Исправьте ошибки в исходных данных для расчёта.
              </div>
            ) : (
              <div className="space-y-1.5 mb-3">
                {outputs.map((output) => {
                  const interp = interpretations[output.key];
                  if (!interp) return null;
                  const colors = severityColors[interp.severity];
                  return (
                    <div
                      key={output.key}
                      className={`rounded-md px-3 py-2 border ${colors.bg} ${colors.border}`}
                    >
                      <div className={`text-[10px] font-medium mb-0.5 ${colors.text} opacity-75`}>
                        {output.label}
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-lg font-bold ${colors.text}`}>
                          {formatNumber(interp.value, output.precision ?? 2)}
                        </span>
                        <span className={`text-[11px] ${colors.text} opacity-70`}>
                          {output.unit}
                        </span>
                      </div>
                      {interp.message && (
                        <div className={`mt-0.5 text-[10px] leading-tight ${colors.text} opacity-85`}>
                          {interp.message}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!blocked && showChart && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mb-3">
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Сравнение
                </p>
                <ResultsVisualization data={numericChartPoints} />
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 space-y-1.5">
              <button
                onClick={onSaveHistory}
                disabled={blocked}
                className="w-full px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-semibold"
              >
                💾 Сохранить в историю
              </button>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => onExport('docx')}
                  disabled={blocked || exporting !== 'none'}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                >
                  {exporting === 'docx' ? '⏳ DOCX…' : '📄 DOCX'}
                </button>
                <button
                  onClick={() => onExport('xlsx')}
                  disabled={blocked || exporting !== 'none'}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                >
                  {exporting === 'xlsx' ? '⏳ XLSX…' : '📊 XLSX'}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
