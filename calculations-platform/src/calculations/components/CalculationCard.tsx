import React from 'react';
import { CALCULATION_CATEGORIES } from '../data/demonstrations';
import { FullCalculation } from '../types';

interface CalculationCardProps {
  calculation: FullCalculation;
  onClick: () => void;
}

const pluralize = (count: number, forms: [string, string, string]): string => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
};

export const CalculationCard: React.FC<CalculationCardProps> = ({ calculation, onClick }) => {
  const categoryName =
    CALCULATION_CATEGORIES.find((c) => c.id === calculation.category)?.name ?? calculation.category;

  // Determine inputs/outputs/normativeRefs source (legacy vs methodology-based)
  const inputs = calculation.inputs || (calculation.methodologies && calculation.methodologies[0]?.inputs) || [];
  const outputs = calculation.outputs || (calculation.methodologies && calculation.methodologies[0]?.outputs) || [];
  const normativeRefs = calculation.normativeRefs || (calculation.methodologies && calculation.methodologies[0]?.normativeRefs) || [];

  // Show methodology count if available
  const methodologyInfo = calculation.methodologies && calculation.methodologies.length > 1
    ? `${calculation.methodologies.length} методики`
    : null;

  return (
    <button
      onClick={onClick}
      className="block w-full text-left p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all hover:border-blue-400 dark:hover:border-blue-500 group"
    >
      <span className="inline-block px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-semibold rounded-full mb-2">
        {categoryName}
      </span>

      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
        {calculation.name}
      </h3>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2 leading-snug">
        {calculation.description}
      </p>

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500 dark:text-gray-400">
        {methodologyInfo && (
          <>
            <span className="text-blue-600 dark:text-blue-400 font-medium">📋 {methodologyInfo}</span>
            <span>·</span>
          </>
        )}
        <span>
          {inputs.length}{' '}
          {pluralize(inputs.length, ['параметр', 'параметра', 'параметров'])}
        </span>
        <span>·</span>
        <span>
          {outputs.length}{' '}
          {pluralize(outputs.length, ['результат', 'результата', 'результатов'])}
        </span>
        <span>·</span>
        <span>
          {normativeRefs.length}{' '}
          {pluralize(normativeRefs.length, ['норматив', 'норматива', 'нормативов'])}
        </span>
      </div>
    </button>
  );
};
