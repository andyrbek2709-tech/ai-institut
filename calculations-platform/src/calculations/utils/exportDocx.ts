import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';
import { FullCalculation } from '../types';
import { OutputInterpretation, formatNumber } from './interpretation';
import { getCalculationState } from './calculationState';

const cell = (text: string, bold = false): TableCell =>
  new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold })],
      }),
    ],
  });

const tableFromRows = (rows: string[][], header = false): Table => {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((cols, idx) => {
      const isHeader = header && idx === 0;
      return new TableRow({
        children: cols.map((c) => cell(c, isHeader)),
      });
    }),
  });
};

export const exportDocx = async (
  calc: FullCalculation,
  inputs: Record<string, number>,
  outputs: Record<string, OutputInterpretation>,
): Promise<void> => {
  const calcState = getCalculationState(calc);
  const calcInputs = calcState.inputs;
  const calcOutputs = calcState.outputs;
  const calcMethodology = calcState.currentMethodology;

  const inputRows: string[][] = [
    ['Параметр', 'Значение', 'Единица'],
    ...calcInputs.map((inp) => [
      inp.label,
      formatNumber(inputs[inp.key] ?? NaN, 3),
      inp.unit,
    ]),
  ];

  const outputRows: string[][] = [
    ['Величина', 'Значение', 'Единица', 'Статус'],
    ...calcOutputs.map((out) => {
      const interp = outputs[out.key];
      const severity =
        interp.severity === 'safe'
          ? 'В норме'
          : interp.severity === 'warning'
            ? 'Внимание'
            : 'Критично';
      return [
        out.label,
        formatNumber(interp.value, out.precision ?? 2),
        out.unit,
        severity + (interp.message ? ` — ${interp.message}` : ''),
      ];
    }),
  ];

  const doc = new Document({
    creator: 'EngHub Calculations Platform',
    title: calc.name,
    sections: [
      {
        children: [
          new Paragraph({
            text: calc.name,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: calc.description,
            spacing: { after: 300 },
            alignment: AlignmentType.JUSTIFIED,
          }),
          new Paragraph({
            text: '1. Исходные данные',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 200 },
          }),
          tableFromRows(inputRows, true),
          ...(calcMethodology
            ? [
                new Paragraph({
                  text: '2. Расчётная формула',
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 300, after: 200 },
                }),
                new Paragraph({
                  children: [new TextRun({ text: calcMethodology.asciiFormula, italics: true })],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 200 },
                }),
                new Paragraph({
                  text: '3. Методология',
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 300, after: 200 },
                }),
                new Paragraph({
                  text: calcMethodology.methodology,
                  alignment: AlignmentType.JUSTIFIED,
                  spacing: { after: 200 },
                }),
              ]
            : []),
          new Paragraph({
            text: '4. Результаты',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 },
          }),
          tableFromRows(outputRows, true),
          new Paragraph({
            text: '5. Нормативные ссылки',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 },
          }),
          ...calcState.normativeRefs.flatMap((ref) => [
            new Paragraph({
              children: [
                new TextRun({ text: `${ref.code} — `, bold: true }),
                new TextRun({ text: ref.title }),
                ...(ref.clause
                  ? [new TextRun({ text: ` (${ref.clause})`, italics: true })]
                  : []),
              ],
              spacing: { after: 100 },
            }),
            ...(ref.quote
              ? [
                  new Paragraph({
                    children: [
                      new TextRun({ text: `«${ref.quote}»`, italics: true }),
                    ],
                    spacing: { after: 200 },
                    indent: { left: 400 },
                  }),
                ]
              : []),
          ]),
          ...(calc.warnings && calc.warnings.length > 0
            ? [
                new Paragraph({
                  text: '6. Ограничения и предупреждения',
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 300, after: 200 },
                }),
                ...calc.warnings.map(
                  (w) =>
                    new Paragraph({
                      text: `• ${w}`,
                      spacing: { after: 100 },
                    }),
                ),
              ]
            : []),
          new Paragraph({
            text: `Отчёт сгенерирован: ${new Date().toLocaleString('ru-RU')}`,
            alignment: AlignmentType.RIGHT,
            spacing: { before: 400 },
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = calc.name.replace(/[^а-яА-Яa-zA-Z0-9]+/g, '_');
  saveAs(blob, `${safeName}_${new Date().toISOString().slice(0, 10)}.docx`);
};
