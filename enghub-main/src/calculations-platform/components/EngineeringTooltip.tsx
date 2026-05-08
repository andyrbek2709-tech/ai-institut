import React, { useState } from 'react';

interface EngineeringTooltipProps {
  label: string;
  hint?: string;
  range?: { min: number; max: number };
  typical?: number;
}

export const EngineeringTooltip: React.FC<EngineeringTooltipProps> = ({
  label,
  hint,
  range,
  typical,
}) => {
  const [showHint, setShowHint] = useState(false);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        {hint && (
          <button
            type="button"
            onClick={() => setShowHint(!showHint)}
            className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 cursor-help"
            title="Show hint"
          >
            ⓘ
          </button>
        )}
      </div>

      {showHint && hint && (
        <div className="absolute left-0 top-full mt-2 z-10 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-200 w-48 shadow-lg">
          <p className="mb-2">{hint}</p>
          {range && (
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Range: {range.min} – {range.max}
            </p>
          )}
          {typical && (
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Typical: {typical}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
