import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import { CalcTemplate, CalcReportStep, CalcResult } from "./types";

export const exportToDocx = async (
  template: CalcTemplate, 
  inputs: Record<string, number>, 
  results: Record<string, CalcResult>, 
  report: CalcReportStep[]
) => {
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Times New Roman", size: 24 } } // 12pt by default
      }
    },
    sections: [{
      properties: {},
      children: [
        // --- TITLE PAGE OR HEADER ---
        new Paragraph({
          text: `ИНЖЕНЕРНЫЙ РАСЧЁТ`,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        }),
        new Paragraph({
          text: template.name.toUpperCase(),
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Нормативная база: `, bold: true }),
            new TextRun({ text: template.normativeReference })
          ],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 400 }
        }),
        
        // --- ИСХОДНЫЕ ДАННЫЕ (Table format) ---
        new Paragraph({ text: "1. Исходные данные:", heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: "Наименование параметра", alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: "Значение", alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: "Ед. изм.", alignment: AlignmentType.CENTER })] }),
              ]
            }),
            ...template.inputs.map(inp => new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: inp.name })] }),
                new TableCell({ children: [new Paragraph({ text: String(inputs[inp.id]), alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ text: inp.unit || "-", alignment: AlignmentType.CENTER })] }),
              ]
            }))
          ]
        }),
        
        // --- МЕТОДИКА ---
        new Paragraph({ text: "2. Методика и ход расчета:", heading: HeadingLevel.HEADING_3, spacing: { before: 400, after: 100 } }),
        ...report.flatMap(step => {
           let arr = [];
           if (step.title) arr.push(new Paragraph({ children: [new TextRun({ text: step.title, bold: true, italics: true })], spacing: { before: 200 } }));
           if (step.text) arr.push(new Paragraph({ text: step.text }));
           if (step.formulaLatex) arr.push(new Paragraph({ text: `Расчетная формула: ${step.formulaLatex}`, alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 } }));
           if (step.formulaSubstitutedLatex) arr.push(new Paragraph({ text: `Подстановка: ${step.formulaSubstitutedLatex}`, alignment: AlignmentType.CENTER, spacing: { before: 100, after: 200 } }));
           return arr;
        }),
        
        // --- РЕЗУЛЬТАТЫ ---
        new Paragraph({ text: "3. Результаты расчета:", heading: HeadingLevel.HEADING_3, spacing: { before: 400, after: 200 } }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.DOUBLE, size: 4 },
            bottom: { style: BorderStyle.DOUBLE, size: 4 },
            left: { style: BorderStyle.DOUBLE, size: 4 },
            right: { style: BorderStyle.DOUBLE, size: 4 },
          },
          rows: Object.values(results).map((r, i) => new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: r.label || `Результат ${i+1}`, alignment: AlignmentType.LEFT })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${r.value} ${r.unit || ""}`, bold: true })], alignment: AlignmentType.RIGHT })] }),
            ]
          }))
        }),
        
        new Paragraph({ text: "Расчет выполнен в автоматизированной среде EngHub.", spacing: { before: 600 }, alignment: AlignmentType.RIGHT }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `EngHub_Расчет_${template.id}.docx`);
}
