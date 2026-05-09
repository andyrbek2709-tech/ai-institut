import React, { useEffect, useMemo, useState } from 'react';
import { HistoryEntry, Severity } from '../types';
import { clearHistory, deleteHistoryEntry, getHistory } from '../storage/history';
import { DEMO_CALCULATIONS } from '../data/demonstrations';
import { formatNumber } from '../utils/interpretation';

interface CalculationHistoryProps {
  onOpenEntry: (entry: HistoryEntry) => void;
}

const severityDot: Record<Severity, string> = {
  safe: 'bg-green-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
};

const formatDateTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('ru-RU');
  } catch {
    return iso;
  }
};

export const CalculationHistory: React.FC<CalculationHistoryProps> = ({ onOpenEntry }) => {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => getHistory());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent');

  useEffect(() => {
    setEntries(getHistory());
  }, []);

  const refresh = () => setEntries(getHistory());

  const filtered = useMemo(() => {
    let r = entries.filter((e) =>
      e.calculationName.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    if (sortBy === 'name') {
      r.sort((a, b) => a.calculationName.localeCompare(b.calculationName));
    }
    return r;
  }, [entries, searchQuery, sortBy]);

  const onDelete = (id: string) => {
    deleteHistoryEntry(id);
    refresh();
  };

  const onClearAll = () => {
    if (window.confirm(`Удалить все ${entries.length} записей истории?`)) {
      clearHistory();
      refresh();
    }
  };

  const findCalc = (id: string) => DEMO_CALCULATIONS.find((c) => c.id === id);

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
            📜 История расчётов
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {entries.length === 0
              ? 'Сохранённых расчётов пока нет'
              : `Всего записей: ${entries.length}`}
          </p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={onClearAll}
            className="px-4 py-2 text-sm bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-lg transition-colors"
          >
            🗑 Очистить всё
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="🔍 Поиск по названию расчёта..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'recent' | 'name')}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="recent">📅 Сначала новые</option>
          <option value="name">🔤 По названию (А-Я)</option>
        </select>
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((entry) => {
            const calc = findCalc(entry.calculationId);
            return (
              <div
                key={entry.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                      {entry.calculationName}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDateTime(entry.timestampISO)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => onOpenEntry(entry)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium"
                    >
                      ↗ Открыть
                    </button>
                    <button
                      onClick={() => onDelete(entry.id)}
                      className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-700 dark:hover:text-red-300 transition-colors text-xs"
                      aria-label="Удалить"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      📥 Входы
                    </div>
                    <div className="space-y-0.5 text-gray-600 dark:text-gray-400">
                      {calc
                        ? (() => {
                            const inputs = calc.inputs || (calc.methodologies && calc.methodologies[0]?.inputs) || [];
                            return inputs.length > 0 ? (
                              inputs.map((inp) => (
                                <div key={inp.key} className="truncate">
                                  <span className="font-medium">{inp.label}:</span>{' '}
                                  {formatNumber(entry.inputs[inp.key] ?? NaN, 3)} {inp.unit}
                                </div>
                              ))
                            ) : (
                              <div className="text-gray-500">—</div>
                            );
                          })()
                        : Object.entries(entry.inputs).map(([k, v]) => (
                            <div key={k}>
                              {k}: {formatNumber(v, 3)}
                            </div>
                          ))}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      📊 Результаты
                    </div>
                    <div className="space-y-0.5 text-gray-600 dark:text-gray-400">
                      {calc
                        ? (() => {
                            const outputs = calc.outputs || (calc.methodologies && calc.methodologies[0]?.outputs) || [];
                            return outputs.length > 0 ? (
                              outputs.map((out) => {
                                const sev = entry.severities[out.key] ?? 'safe';
                                return (
                                  <div key={out.key} className="flex items-center gap-2 truncate">
                                    <span
                                      className={`inline-block w-2 h-2 rounded-full ${severityDot[sev]}`}
                                    />
                                    <span className="font-medium">{out.label}:</span>{' '}
                                    {formatNumber(
                                      entry.outputs[out.key] ?? NaN,
                                      out.precision ?? 2,
                                    )}{' '}
                                    {out.unit}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-gray-500">—</div>
                            );
                          })()
                        : Object.entries(entry.outputs).map(([k, v]) => (
                            <div key={k}>
                              {k}: {formatNumber(v, 3)}
                            </div>
                          ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-base text-gray-700 dark:text-gray-300 mb-1">
            {entries.length === 0 ? 'История пуста' : 'Ничего не найдено'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {entries.length === 0
              ? 'Откройте любой расчёт, заполните параметры и нажмите «Сохранить в историю»'
              : 'Попробуйте изменить поисковый запрос'}
          </p>
        </div>
      )}
    </div>
  );
};
