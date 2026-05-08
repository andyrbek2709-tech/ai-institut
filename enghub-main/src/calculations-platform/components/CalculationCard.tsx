import React from 'react';

interface CalculationCardProps {
  id: string;
  name: string;
  description: string;
  formula?: string;
  onClick: () => void;
  icon?: string;
}

export const CalculationCard: React.FC<CalculationCardProps> = ({
  id,
  name,
  description,
  formula,
  onClick,
  icon = '📐',
}) => {
  return (
    <button
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 text-left hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 group"
    >
      {/* Icon + Name */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          <span className="text-2xl mt-1">{icon}</span>
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {name}
          </h3>
        </div>
        <span className="text-lg opacity-0 group-hover:opacity-100 transition-opacity">→</span>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
        {description}
      </p>

      {/* Formula (if available) */}
      {formula && (
        <div className="bg-gray-100 dark:bg-gray-700 rounded px-3 py-2 text-xs font-mono text-gray-700 dark:text-gray-300 overflow-hidden">
          <span className="text-gray-500 dark:text-gray-400">f(x) = </span>
          {formula}
        </div>
      )}

      {/* ID badge */}
      <div className="mt-3">
        <span className="text-xs text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
          {id}
        </span>
      </div>
    </button>
  );
};
