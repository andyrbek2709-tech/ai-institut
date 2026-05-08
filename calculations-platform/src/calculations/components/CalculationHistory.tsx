import React, { useState, useMemo } from 'react';

interface HistoryEntry {
  id: string;
  calculationId: string;
  calculationName: string;
  timestamp: Date;
  inputs: Record<string, number>;
  outputs: Record<string, number | null>;
}

interface CalculationHistoryProps {
  onSelectCalculation: (calculationId: string) => void;
}

export const CalculationHistory: React.FC<CalculationHistoryProps> = ({
  onSelectCalculation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent');

  const mockHistory: HistoryEntry[] = [
    {
      id: 'hist1',
      calculationId: 'thermal-load',
      calculationName: 'Тепловая нагрузка здания',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      inputs: { площадь: 1500, этажность: 3 },
      outputs: { нагрузка: 45000 },
    },
    {
      id: 'hist2',
      calculationId: 'structural-beam',
      calculationName: 'Прогиб балки',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      inputs: { длина: 6, нагрузка: 5000 },
      outputs: { прогиб: 12.5 },
    },
    {
      id: 'hist3',
      calculationId: 'electrical-cable',
      calculationName: 'Расчёт сечения кабеля',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      inputs: { мощность: 10000, напряжение: 380 },
      outputs: { сечение: 16 },
    },
  ];

  const filteredHistory = useMemo(() => {
    let result = mockHistory.filter((entry) =>
      entry.calculationName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (sortBy === 'recent') {
      result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.calculationName.localeCompare(b.calculationName));
    }

    return result;
  }, [searchQuery, sortBy]);

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          📜 История расчётов
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Все ваши выполненные расчёты сохраняются здесь
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <input
              type="text"
              placeholder="🔍 Поиск по названию расчёта..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'recent' | 'name')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="recent">📅 Новые сверху</option>
              <option value="name">🔤 По названию (А-Я)</option>
            </select>
          </div>
        </div>
      </div>

      {filteredHistory.length > 0 ? (
        <div className="space-y-4">
          {filteredHistory.map((entry) => (
            <div
              key={entry.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {entry.calculationName}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {entry.timestamp.toLocaleString('ru-RU')}
                  </p>
                </div>
                <button
                  onClick={() => onSelectCalculation(entry.calculationId)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm whitespace-nowrap"
                >
                  ↗ Открыть
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    📥 Входные данные
                  </p>
                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    {Object.entries(entry.inputs).map(([key, value]) => (
                      <div key={key}>
                        <span className="font-medium">{key}:</span> {value}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    📊 Результаты
                  </p>
                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    {Object.entries(entry.outputs).map(([key, value]) => (
                      <div key={key}>
                        <span className="font-medium">{key}:</span>{' '}
                        {typeof value === 'number' ? value.toFixed(3) : 'N/A'}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
            😴 История пуста
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Выполните расчёты, чтобы они сохранились в истории
          </p>
        </div>
      )}
    </div>
  );
};
