import React, { useState } from 'react';
import { CALCULATION_CATEGORIES, DEMO_CALCULATIONS } from '../data/demonstrations';
import { CalculationCard } from '../components/CalculationCard';

interface CalculationsHomeProps {
  onSelectCalculation: (calculationId: string) => void;
}

export const CalculationsHome: React.FC<CalculationsHomeProps> = ({ onSelectCalculation }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCalcs = DEMO_CALCULATIONS.filter((calc) => {
    const matchesCategory = !selectedCategory || calc.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      calc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      calc.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              ⚙️ Платформа инженерных расчётов
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Универсальный набор расчётов для проектно-сметного отдела
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Поиск расчёта по названию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Category Navigation */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Категории расчётов
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* "All Calculations" button */}
            <button
              onClick={() => setSelectedCategory(null)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                selectedCategory === null
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 dark:border-blue-400'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300'
              }`}
            >
              <div className="font-semibold text-gray-900 dark:text-white mb-1">
                📋 Все расчёты
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {DEMO_CALCULATIONS.length} расчётов доступно
              </div>
            </button>

            {/* Category buttons */}
            {CALCULATION_CATEGORIES.map((category) => {
              const categoryCalcs = DEMO_CALCULATIONS.filter((c) => c.category === category.id);
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedCategory === category.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 dark:border-blue-400'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-white mb-1">
                    {category.name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {categoryCalcs.length} расчётов
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Results Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {selectedCategory
                ? CALCULATION_CATEGORIES.find((c) => c.id === selectedCategory)?.name ||
                  'Расчёты'
                : '📋 Все расчёты'}
            </h2>
            <span className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
              Результаты: {filteredCalcs.length}
            </span>
          </div>

          {filteredCalcs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCalcs.map((calc) => (
                <CalculationCard
                  key={calc.id}
                  {...calc}
                  onClick={() => onSelectCalculation(calc.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
                😴 Расчётов не найдено
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Попробуйте изменить критерии поиска или выберите другую категорию
              </p>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {DEMO_CALCULATIONS.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Всего расчётов</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {CALCULATION_CATEGORIES.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Категорий</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">100%</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Верифицированы</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {CALCULATION_CATEGORIES.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Отраслей</div>
          </div>
        </div>
      </div>
    </div>
  );
};
