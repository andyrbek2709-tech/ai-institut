import React, { useState } from 'react';

interface HistoryItem {
  id: string;
  calculationName: string;
  timestamp: Date;
  status: 'completed' | 'in_progress' | 'failed';
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  reportDownloaded?: boolean;
}

interface CalculationHistoryProps {
  onSelectCalculation?: (calculationId: string) => void;
}

// Mock data
const MOCK_HISTORY: HistoryItem[] = [
  {
    id: 'hist-001',
    calculationName: 'Расчёт толщины стенки трубопровода',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
    status: 'completed',
    inputs: { 'Внутреннее давление': 2.5, 'Наружный диаметр': 219 },
    outputs: { 'Толщина стенки': 5.24 },
    reportDownloaded: true,
  },
  {
    id: 'hist-002',
    calculationName: 'Гидравлические потери в трубопроводе',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5h ago
    status: 'completed',
    inputs: { 'Коэффициент трения λ': 0.032, 'Длина трубопровода': 150 },
    outputs: { 'Падение давления': 12.5 },
    reportDownloaded: false,
  },
  {
    id: 'hist-003',
    calculationName: 'Выбор сечения кабеля',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1d ago
    status: 'completed',
    inputs: { 'Длина кабельной линии': 250, 'Ток нагрузки': 63 },
    outputs: { 'Минимальное сечение кабеля': 28.5 },
    reportDownloaded: true,
  },
  {
    id: 'hist-004',
    calculationName: 'Тепловой баланс теплообменника',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3d ago
    status: 'completed',
    inputs: { 'Массовый расход (горячая сторона)': 5.2, 'Температура входа': 85 },
    outputs: { 'Тепловой поток': 1054.8 },
    reportDownloaded: true,
  },
];

export const CalculationHistory: React.FC<CalculationHistoryProps> = ({
  onSelectCalculation,
}) => {
  const [history, setHistory] = useState<HistoryItem[]>(MOCK_HISTORY);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredHistory = history.filter((item) => {
    const matchesStatus = !filterStatus || item.status === filterStatus;
    const matchesSearch =
      !searchQuery ||
      item.calculationName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) {
      return `${diffInMinutes} мин назад`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} ч назад`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} дн назад`;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      completed: '✅ Завершено',
      in_progress: '⟳ В процессе',
      failed: '❌ Ошибка',
    };
    return labels[status] || status;
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          📜 История расчётов
        </h2>

        {/* Search + Filters */}
        <div className="flex gap-3 flex-col md:flex-row">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="🔍 Поиск по названию расчёта..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus(null)}
              className={`px-4 py-2 rounded-lg border transition-all text-sm font-medium ${
                filterStatus === null
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-4 py-2 rounded-lg border transition-all text-sm font-medium ${
                filterStatus === 'completed'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-green-400'
              }`}
            >
              ✅ Завершено
            </button>
            <button
              onClick={() => setFilterStatus('failed')}
              className={`px-4 py-2 rounded-lg border transition-all text-sm font-medium ${
                filterStatus === 'failed'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-red-400'
              }`}
            >
              ❌ Ошибки
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {filteredHistory.length > 0 ? (
        <div className="space-y-3">
          {filteredHistory.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left Section */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {item.calculationName}
                    </h3>
                    <span
                      className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                        item.status === 'completed'
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : item.status === 'in_progress'
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                      }`}
                    >
                      {getStatusLabel(item.status)}
                    </span>
                  </div>

                  {/* Metadata */}
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                    {formatDate(item.timestamp)} • {item.id}
                  </div>

                  {/* Input/Output Summary */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400 font-medium mb-1">
                        Входные данные:
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                        {Object.entries(item.inputs)
                          .slice(0, 2)
                          .map(([key, val]) => (
                            <div key={key} className="text-gray-700 dark:text-gray-300">
                              {key}: <strong>{val}</strong>
                            </div>
                          ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400 font-medium mb-1">
                        Результаты:
                      </div>
                      <div className="bg-green-50 dark:bg-green-900 rounded p-2">
                        {Object.entries(item.outputs)
                          .slice(0, 2)
                          .map(([key, val]) => (
                            <div
                              key={key}
                              className="text-green-800 dark:text-green-200"
                            >
                              {key}: <strong>{val.toFixed(2)}</strong>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Section - Actions */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => onSelectCalculation?.(item.id)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
                  >
                    Открыть
                  </button>
                  {item.reportDownloaded && (
                    <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium whitespace-nowrap">
                      ↓ Отчёт
                    </button>
                  )}
                  <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium">
                    ⋯
                  </button>
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
            Выполните расчёты, чтобы они появились в истории
          </p>
        </div>
      )}

      {/* Stats Footer */}
      <div className="grid grid-cols-3 gap-3 mt-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {history.length}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Всего расчётов</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {history.filter((h) => h.status === 'completed').length}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Завершено</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {history.filter((h) => h.reportDownloaded).length}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Отчётов скачано</div>
        </div>
      </div>
    </div>
  );
};
