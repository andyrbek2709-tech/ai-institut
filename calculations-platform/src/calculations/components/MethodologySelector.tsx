import React from 'react';
import { Methodology } from '../types';

interface MethodologySelectorProps {
  methodologies: Methodology[];
  selectedMethodologyId: string;
  onSelectMethodology: (methodologyId: string) => void;
}

/**
 * Компонент для выбора методики расчёта
 * Показывается если расчёт поддерживает несколько методик
 */
export const MethodologySelector: React.FC<MethodologySelectorProps> = ({
  methodologies,
  selectedMethodologyId,
  onSelectMethodology,
}) => {
  if (methodologies.length <= 1) {
    return null; // Не показываем селектор если только одна методика
  }

  const selectedMethodology = methodologies.find((m) => m.id === selectedMethodologyId);

  return (
    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
        📋 Методика расчёта
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {methodologies.map((methodology) => (
          <button
            key={methodology.id}
            onClick={() => onSelectMethodology(methodology.id)}
            className={`text-left p-3 rounded-lg border-2 transition-all ${
              selectedMethodologyId === methodology.id
                ? 'border-blue-500 bg-white dark:bg-gray-800 shadow-md'
                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
            }`}
          >
            <div className="font-medium text-sm text-gray-900 dark:text-white">
              {methodology.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {methodology.description}
            </div>
          </button>
        ))}
      </div>

      {selectedMethodology && (
        <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
          <details className="cursor-pointer">
            <summary className="text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline">
              📖 Развернуть описание методики
            </summary>
            <div className="mt-3 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-mono bg-white dark:bg-gray-900 p-3 rounded border border-blue-100 dark:border-blue-800 max-h-64 overflow-y-auto">
              {selectedMethodology.methodology}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};
