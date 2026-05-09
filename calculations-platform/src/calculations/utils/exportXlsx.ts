import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { FullCalculation } from '../types';
import { OutputInterpretation, formatNumber } from './interpretation';
import { getCalculationState } from './calculationState';

const setHeaderRow = (row: ExcelJS.Row): void => {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' },
  };
  row.alignment = { vertical: 'middle', horizontal: 'center' };
};

export const exportXlsx = async (
  calc: FullCalculation,
  inputs: Record<string, number>,
  outputs: Record<string, OutputInterpretation>,
): Promise<void> => {
  const calcState = getCalculationState(calc);
  const calcInputs = calcState.inputs;
  const calcOutputs = calcState.outputs;
  const calcMethodology = calcState.currentMethodology;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EngHub Calculations Platform';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Сводка');
  summary.columns = [
    { header: 'Поле', key: 'field', width: 32 },
    { header: 'Значение', key: 'value', width: 60 },
  ];
  setHeaderRow(summary.getRow(1));
  summary.addRow({ field: 'Название расчёта', value: calc.name });
  summary.addRow({ field: 'Описание', value: calc.description });
  summary.addRow({ field: 'Категория', value: calc.category });
  summary.addRow({ field: 'Формула', value: calcMethodology?.asciiFormula ?? '—' });
  summary.addRow({ field: 'Дата генерации', value: new Date().toLocaleString('ru-RU') });
  summary.addRow({ field: 'ID расчёта', value: calc.id });

  const inputsSheet = workbook.addWorksheet('Исходные данные');
  inputsSheet.columns = [
    { header: 'Параметр', key: 'label', width: 36 },
    { header: 'Значение', key: 'value', width: 14 },
    { header: 'Единица', key: 'unit', width: 16 },
    { header: 'Диапазон min–max', key: 'range', width: 22 },
    { header: 'Типичное', key: 'typical', width: 14 },
    { header: 'Подсказка', key: 'hint', width: 50 },
  ];
  setHeaderRow(inputsSheet.getRow(1));
  for (const inp of calcInputs) {
    inputsSheet.addRow({
      label: inp.label,
      value: inputs[inp.key] ?? '',
      unit: inp.unit,
      range: `${inp.range.min} – ${inp.range.max}`,
      typical: inp.range.typical ?? '',
      hint: inp.range.hint ?? '',
    });
  }

  const outputsSheet = workbook.addWorksheet('Результаты');
  outputsSheet.columns = [
    { header: 'Величина', key: 'label', width: 40 },
    { header: 'Значение', key: 'value', width: 16 },
    { header: 'Единица', key: 'unit', width: 16 },
    { header: 'Статус', key: 'severity', width: 14 },
    { header: 'Комментарий', key: 'message', width: 60 },
  ];
  setHeaderRow(outputsSheet.getRow(1));
  for (const out of calcOutputs) {
    const interp = outputs[out.key];
    const row = outputsSheet.addRow({
      label: out.label,
      value: formatNumber(interp.value, out.precision ?? 2),
      unit: out.unit,
      severity:
        interp.severity === 'safe'
          ? 'В норме'
          : interp.severity === 'warning'
            ? 'Внимание'
            : 'Критично',
      message: interp.message ?? '',
    });
    if (interp.severity === 'critical') {
      row.getCell('severity').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFCA5A5' },
      };
    } else if (interp.severity === 'warning') {
      row.getCell('severity').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFCD34D' },
      };
    } else {
      row.getCell('severity').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFBBF7D0' },
      };
    }
  }

  const refsSheet = workbook.addWorksheet('Нормативы');
  refsSheet.columns = [
    { header: 'Код', key: 'code', width: 24 },
    { header: 'Название', key: 'title', width: 60 },
    { header: 'Пункт', key: 'clause', width: 28 },
    { header: 'Цитата', key: 'quote', width: 60 },
  ];
  setHeaderRow(refsSheet.getRow(1));
  for (const ref of calcState.normativeRefs) {
    refsSheet.addRow({
      code: ref.code,
      title: ref.title,
      clause: ref.clause ?? '',
      quote: ref.quote ?? '',
    });
  }

  if (calc.warnings && calc.warnings.length > 0) {
    const warningsSheet = workbook.addWorksheet('Предупреждения');
    warningsSheet.columns = [{ header: 'Предупреждение', key: 'w', width: 100 }];
    setHeaderRow(warningsSheet.getRow(1));
    for (const w of calc.warnings) {
      warningsSheet.addRow({ w });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const safeName = calc.name.replace(/[^а-яА-Яa-zA-Z0-9]+/g, '_');
  saveAs(blob, `${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
