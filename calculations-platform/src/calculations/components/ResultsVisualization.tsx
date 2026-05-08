import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface ResultValue {
  label: string;
  value: number;
  unit: string;
  warning?: boolean;
  safe?: boolean;
}

interface ResultsVisualizationProps {
  results: ResultValue[];
}

export const ResultsVisualization: React.FC<ResultsVisualizationProps> = ({
  results,
}) => {
  // Prepare data for chart
  const chartData = results.map((r) => ({
    name: r.label,
    value: r.value,
    safe: r.safe,
    warning: r.warning,
  }));

  if (results.length === 0) return null;

  if (results.length === 1) {
    // Single result: show large display
    const result = results[0];
    return (
      <div className="flex items-baseline gap-3 mb-6">
        <div
          className={`text-5xl font-bold ${
            result.warning
              ? 'text-amber-600 dark:text-amber-400'
              : result.safe
                ? 'text-green-600 dark:text-green-400'
                : 'text-blue-600 dark:text-blue-400'
          }`}
        >
          {typeof result.value === 'number' ? result.value.toFixed(2) : 'N/A'}
        </div>
        <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">
          {result.unit}
        </div>
      </div>
    );
  }

  // Multiple results: show chart
  return (
    <div className="w-full h-64 mb-6">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={80}
            interval={0}
            tick={{ fontSize: 12 }}
          />
          <YAxis />
          <Tooltip
            formatter={(value) => value.toFixed(2)}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
          <Bar
            dataKey="value"
            fill="#3b82f6"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
