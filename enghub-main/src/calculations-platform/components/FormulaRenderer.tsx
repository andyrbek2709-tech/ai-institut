import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface FormulaRendererProps {
  formula: string;
  className?: string;
}

export const FormulaRenderer: React.FC<FormulaRendererProps> = ({
  formula,
  className = '',
}) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(formula, {
        throwOnError: false,
        displayMode: true,
      });
    } catch (e) {
      return `<span class="text-red-600">Error: ${formula}</span>`;
    }
  }, [formula]);

  return (
    <div
      className={`katex-render ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        display: 'flex',
        justifyContent: 'center',
        overflow: 'auto',
        padding: '1rem',
      }}
    />
  );
};
