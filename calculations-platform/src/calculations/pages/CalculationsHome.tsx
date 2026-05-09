import React, { useState } from 'react';
import { CALCULATION_CATEGORIES, DEMO_CALCULATIONS } from '../data/demonstrations';
import { CalculationCard } from '../components/CalculationCard';

interface CalculationsHomeProps {
  onSelectCalculation: (calculationId: string) => void;
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export const CalculationsHome: React.FC<CalculationsHomeProps> = ({
  onSelectCalculation,
  selectedCategory,
  onCategoryChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCalcs = DEMO_CALCULATIONS.filter((calc) => {
    const matchesCategory = !selectedCategory || calc.category === selectedCategory;
    if (!searchQuery) return matchesCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      calc.name.toLowerCase().includes(q) ||
      calc.description.toLowerCase().includes(q) ||
      (calc.keywords?.some((kw) => kw.includes(q)) ?? false);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ── Compact sticky header: title + search ── */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                ⚙️ Платформа инженерных расчётов
              </h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Проектно-сметный отдел · {DEMO_CALCULATIONS.length} расчётов
              </p>
            </div>
          </div>
          <input
            type="text"
            placeholder="🔍 Поиск по названию, описанию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* ── Category filter pills ── */}
        <div className="mb-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onCategoryChange(null)}
              className={`px-2 py-1 rounded border transition-all text-xs ${
                selectedCategory === null
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 dark:border-blue-500 font-semibold text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-blue-400'
              }`}
            >
              📋 Все <span className="opacity-60">({DEMO_CALCULATIONS.length})</span>
            </button>

            {CALCULATION_CATEGORIES.map((category) => {
              const count = DEMO_CALCULATIONS.filter((c) => c.category === category.id).length;
              return (
                <button
                  key={category.id}
                  onClick={() => onCategoryChange(category.id)}
                  className={`px-2 py-1 rounded border transition-all text-xs ${
                    selectedCategory === category.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50 dark:border-blue-500 font-semibold text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-blue-400'
                  }`}
                >
                  {category.name} <span className="opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Results header ── */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {selectedCategory
                ? CALCULATION_CATEGORIES.find((c) => c.id === selectedCategory)?.name ?? 'Расчёты'
                : 'Все расчёты'}
            </h2>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
              {filteredCalcs.length}
            </span>
          </div>

          {filteredCalcs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {filteredCalcs.map((calc) => (
                <CalculationCard
                  key={calc.id}
                  calculation={calc}
                  onClick={() => onSelectCalculation(calc.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                😴 Расчётов не найдено
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Попробуйте изменить критерии поиска или выберите другую категорию
              </p>
            </div>
          )}
        </div>

        {/* ── Footer stats ── */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-400 dark:text-gray-500">
          <span><strong className="text-gray-600 dark:text-gray-300">{DEMO_CALCULATIONS.length}</strong> расчётов</span>
          <span>·</span>
          <span><strong className="text-gray-600 dark:text-gray-300">{CALCULATION_CATEGORIES.length}</strong> категорий</span>
          <span>·</span>
          <span>ГОСТ / СП / ПУЭ</span>
          <span>·</span>
          <span>Экспорт DOCX + XLSX</span>
        </div>
      </div>
    </div>
  );
};
