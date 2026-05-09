import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface FormulaRendererProps {
  formula: string;
  display?: boolean;
  className?: string;
}

export const FormulaRenderer: React.FC<FormulaRendererProps> = ({
  formula,
  display = true,
  className = '',
}) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(formula, {
        throwOnError: false,
        displayMode: display,
        output: 'html',
      });
    } catch {
      return `<span style="color: #b91c1c">Ошибка рендера: ${formula}</span>`;
    }
  }, [formula, display]);

  return (
    <div
      className={`katex-render ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        display: 'flex',
        justifyContent: 'center',
        overflowX: 'auto',
        padding: '0.5rem 0',
      }}
    />
  );
};
