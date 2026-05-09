import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Severity } from '../types';

interface BarPoint {
  name: string;
  value: number;
  unit: string;
  severity: Severity;
}

interface ResultsVisualizationProps {
  data: BarPoint[];
}

const severityFill: Record<Severity, string> = {
  safe: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
};

export const ResultsVisualization: React.FC<ResultsVisualizationProps> = ({ data }) => {
  if (data.length === 0) return null;
  const finiteData = data.filter((d) => Number.isFinite(d.value));
  if (finiteData.length === 0) return null;

  return (
    <div className="w-full h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={finiteData} margin={{ top: 6, right: 12, left: 0, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" opacity={0.3} />
          <XAxis
            dataKey="name"
            angle={-30}
            textAnchor="end"
            height={56}
            interval={0}
            tick={{ fontSize: 10 }}
          />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(value, _name, item) => {
              const point = (item as { payload: BarPoint }).payload;
              const num = typeof value === 'number' ? value : Number(value);
              return [
                `${Number.isFinite(num) ? num.toFixed(3) : '—'} ${point.unit}`,
                point.name,
              ];
            }}
            contentStyle={{
              backgroundColor: 'rgba(255,255,255,0.95)',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {finiteData.map((d, idx) => (
              <Cell key={idx} fill={severityFill[d.severity]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
