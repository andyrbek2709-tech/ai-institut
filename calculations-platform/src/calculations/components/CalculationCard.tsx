import React from 'react';

interface CalculationCardProps {
  id: string;
  name: string;
  description: string;
  category: string;
  inputs: Array<{ label: string; unit: string }>;
  outputs: Array<{ label: string; unit: string }>;
  onClick: () => void;
}

export const CalculationCard: React.FC<CalculationCardProps> = ({
  name,
  description,
  category,
  inputs,
  outputs,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className="block w-full text-left p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow hover:border-blue-500 dark:hover:border-blue-400 group"
    >
      <div className="mb-3">
        <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-full mb-2">
          {category}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {name}
      </h3>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
        {description}
      </p>

      <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-400">
        <div>
          <span className="font-medium">📥 </span>
          {inputs.length} параметр{inputs.length === 1 ? '' : inputs.length < 5 ? 'а' : 'ов'}
        </div>
        <div>
          <span className="font-medium">📊 </span>
          {outputs.length} результат{outputs.length === 1 ? '' : outputs.length < 5 ? 'а' : 'ов'}
        </div>
      </div>
    </button>
  );
};
