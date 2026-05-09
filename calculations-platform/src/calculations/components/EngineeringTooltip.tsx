import React, { useState } from 'react';
import { InputRange } from '../types';

interface EngineeringTooltipProps {
  range: InputRange;
  unit: string;
}

export const EngineeringTooltip: React.FC<EngineeringTooltipProps> = ({
  range,
  unit,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        aria-label="Подсказка"
        className="text-blue-500 hover:text-blue-600 dark:text-blue-300 cursor-help text-sm"
      >
        ⓘ
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 w-64 p-3 bg-blue-50 dark:bg-blue-900/95 border border-blue-200 dark:border-blue-700 rounded-lg shadow-lg text-xs text-blue-900 dark:text-blue-100">
          <div className="mb-2">{range.hint}</div>
          <div className="text-blue-700 dark:text-blue-300">
            Диапазон: {range.min} – {range.max} {unit}
          </div>
          {range.typical !== undefined && (
            <div className="text-blue-700 dark:text-blue-300">
              Типичное: {range.typical} {unit}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
