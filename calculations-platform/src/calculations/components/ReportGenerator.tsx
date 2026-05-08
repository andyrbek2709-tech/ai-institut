import React, { useState } from 'react';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

interface ReportGeneratorProps {
  calculationName: string;
  calculationDescription: string;
  inputs: Record<string, { value: number; unit: string; label: string }>;
  outputs: Record<string, { value: number | null; unit: string; label: string }>;
  formula?: string;
  methodology?: string;
}

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({
  calculationName,
  calculationDescription,
  inputs,
  outputs,
  formula,
  methodology,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateDocxReport = async () => {
    setIsGenerating(true);
    try {
      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                text: calculationName,
                heading: 'Heading1',
                spacing: { after: 200 },
              }),
              new Paragraph({
                text: calculationDescription,
                spacing: { after: 400 },
              }),
              new Paragraph({
                text: 'Исходные данные',
                heading: 'Heading2',
                spacing: { after: 200 },
              }),
              ...Object.entries(inputs).map(
                ([key, { value, unit, label }]) =>
                  new Paragraph({
                    text: `${label}: ${value} ${unit}`,
                    spacing: { after: 100 },
                  })
              ),
              new Paragraph({
                text: 'Результаты',
                heading: 'Heading2',
                spacing: { before: 300, after: 200 },
              }),
              ...Object.entries(outputs).map(
                ([key, { value, unit, label }]) =>
                  new Paragraph({
                    text: `${label}: ${typeof value === 'number' ? value.toFixed(3) : 'N/A'} ${unit}`,
                    spacing: { after: 100 },
                  })
              ),
              ...(formula
                ? [
                    new Paragraph({
                      text: 'Формула',
                      heading: 'Heading2',
                      spacing: { before: 300, after: 200 },
                    }),
                    new Paragraph({
                      text: formula,
                      spacing: { after: 200 },
                    }),
                  ]
                : []),
              ...(methodology
                ? [
                    new Paragraph({
                      text: 'Методология',
                      heading: 'Heading2',
                      spacing: { before: 300, after: 200 },
                    }),
                    new Paragraph({
                      text: methodology,
                      spacing: { after: 200 },
                    }),
                  ]
                : []),
              new Paragraph({
                text: `Отчёт сгенерирован: ${new Date().toLocaleString('ru-RU')}`,
                spacing: { before: 300 },
              }),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${calculationName.replace(/\s+/g, '_')}_report.docx`);
    } catch (error) {
      alert('Ошибка при генерации отчёта');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={generateDocxReport}
      disabled={isGenerating}
      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
    >
      {isGenerating ? '⏳ Генерирую...' : '📄 Скачать отчёт (DOCX)'}
    </button>
  );
};
