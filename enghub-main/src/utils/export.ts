import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';

/**
 * Escapes characters for XML/HTML
 */
const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Exports project tasks, drawings, and reviews to an Excel (XML) file.
 */
export const exportProjectXls = (
  activeProject: any,
  allTasks: any[],
  drawings: any[],
  reviews: any[],
  getUserById: (id: any) => any,
  activeProjectProgress: number,
  addNotification: (msg: string, type: any) => void
) => {
  if (!activeProject) return;

  const statusLabels: Record<string, string> = { 
    todo: 'В очереди', 
    inprogress: 'В работе', 
    review_lead: 'Проверка руководителя', 
    review_gip: 'Проверка ГИПа', 
    revision: 'На доработку', 
    done: 'Завершено' 
  };
  const priorityLabels: Record<string, string> = { 
    low: 'Низкий', 
    medium: 'Средний', 
    high: 'Высокий', 
    critical: 'Критический' 
  };

  const cell = (v: string, bold = false) => `<Cell${bold ? ' ss:StyleID="h"' : ''}><Data ss:Type="String">${esc(v)}</Data></Cell>`;

  const rows = allTasks.filter(t => t.project_id === activeProject.id).map(t => {
    const u = getUserById(t.assigned_to);
    return `<Row>${cell(t.name)}${cell(statusLabels[t.status] || t.status)}${cell(priorityLabels[t.priority] || t.priority)}${cell(u ? u.full_name : '')}${cell(t.dept || '')}${cell(t.deadline || '')}${cell(t.revision_count > 0 ? String(t.revision_count) : '')}</Row>`;
  }).join('');

  const drawingStatusLabels: Record<string, string> = { 
    draft: 'Черновик', 
    in_work: 'В работе', 
    review: 'На проверке', 
    issued: 'Выпущен', 
    cancelled: 'Отменён' 
  };
  const drawingRows = drawings.map(d => `<Row>${cell(d.code)}${cell(d.title)}${cell(d.discipline || '')}${cell(drawingStatusLabels[d.status] || d.status)}${cell(d.revision || 'R0')}</Row>`).join('');

  const reviewSevLabels: Record<string, string> = { 
    critical: 'Критический', 
    major: 'Значительный', 
    minor: 'Незначительный' 
  };
  const reviewStatusLabels: Record<string, string> = { 
    open: 'Открыто', 
    in_progress: 'В работе', 
    resolved: 'Снято', 
    rejected: 'Отклонено' 
  };
  const reviewRows = reviews.map(r => `<Row>${cell(r.title)}${cell(reviewSevLabels[r.severity] || r.severity)}${cell(reviewStatusLabels[r.status] || r.status)}</Row>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="h"><Font ss:Bold="1"/></Style></Styles><Worksheet ss:Name="Задачи"><Table><Row>${cell('Название', true)}${cell('Статус', true)}${cell('Приоритет', true)}${cell('Исполнитель', true)}${cell('Отдел', true)}${cell('Дедлайн', true)}${cell('Ревизий', true)}</Row>${rows}</Table></Worksheet><Worksheet ss:Name="Чертежи"><Table><Row>${cell('Код', true)}${cell('Название', true)}${cell('Дисциплина', true)}${cell('Статус', true)}${cell('Ревизия', true)}</Row>${drawingRows}</Table></Worksheet><Worksheet ss:Name="Замечания"><Table><Row>${cell('Текст замечания', true)}${cell('Серьёзность', true)}${cell('Статус', true)}</Row>${reviewRows}</Table></Worksheet><Worksheet ss:Name="Проект"><Table><Row>${cell('Параметр', true)}${cell('Значение', true)}</Row><Row>${cell('Название')}${cell(activeProject.name)}</Row><Row>${cell('Код')}${cell(activeProject.code)}</Row><Row>${cell('Статус')}${cell(activeProject.status === 'active' ? 'В работе' : activeProject.status)}</Row><Row>${cell('Дедлайн')}${cell(activeProject.deadline || '—')}</Row><Row>${cell('Прогресс')}${cell(activeProjectProgress + '%')}</Row><Row>${cell('Всего задач')}${cell(String(allTasks.filter(t => t.project_id === activeProject.id).length))}</Row><Row>${cell('Чертежей')}${cell(String(drawings.length))}</Row><Row>${cell('Замечаний открыто')}${cell(String(reviews.filter(r => r.status === 'open').length))}</Row></Table></Worksheet></Workbook>`;
  
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  saveAs(blob, `${activeProject.code}_${activeProject.name}.xls`);
  addNotification(`Экспорт "${activeProject.name}" готов`, 'success');
};

/**
 * Exports a meeting protocol to a PDF (via window.print).
 */
export const exportMeetingPdf = (m: any, projectName: string) => {
  const dateStr = m.meeting_date ? new Date(m.meeting_date + 'T00:00:00').toLocaleDateString('ru-RU') : '—';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Протокол: ${esc(m.title)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 14px; color: #111; margin: 0; padding: 40px; }
  h1 { font-size: 20px; text-align: center; margin-bottom: 4px; }
  .subtitle { text-align: center; font-size: 13px; color: #555; margin-bottom: 24px; }
  .section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #888; margin: 20px 0 6px; letter-spacing: .05em; }
  .section-body { border-left: 3px solid #ddd; padding-left: 12px; font-size: 14px; white-space: pre-wrap; }
  .footer { margin-top: 48px; display: flex; justify-content: space-between; font-size: 12px; color: #555; }
  .sign-block { width: 40%; }
  .sign-line { border-top: 1px solid #000; margin-top: 32px; padding-top: 4px; font-size: 11px; }
  @media print { body { padding: 20mm 20mm 20mm 20mm; } }
</style></head><body>
<h1>ПРОТОКОЛ СОВЕЩАНИЯ</h1>
<div class="subtitle">${esc(projectName)} &nbsp;·&nbsp; ${dateStr}</div>
<div class="section-label">Тема</div>
<div class="section-body">${esc(m.title)}</div>
${m.participants ? `<div class="section-label">Участники</div><div class="section-body">${esc(m.participants)}</div>` : ''}
${m.agenda ? `<div class="section-label">Повестка</div><div class="section-body">${esc(m.agenda)}</div>` : ''}
${m.decisions ? `<div class="section-label">Решения / Поручения</div><div class="section-body">${esc(m.decisions)}</div>` : ''}
<div class="footer">
  <div class="sign-block"><div class="sign-line">Председатель</div></div>
  <div class="sign-block"><div class="sign-line">Секретарь</div></div>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};

/**
 * Exports a transmittal to a PDF (via window.print).
 */
export const exportTransmittalPdf = (tr: any, projectName: string, items: any[], drawings: any[], revisions: any[]) => {
  const dateStr = new Date(tr.created_at).toLocaleDateString('ru-RU');
  const rows = items.map((it: any) => {
    const d = drawings.find((dr: any) => String(dr.id) === String(it.drawing_id));
    const rev = revisions.find((rv: any) => String(rv.id) === String(it.revision_id));
    return `<tr>
      <td>${esc(d?.code || '—')}</td>
      <td>${esc(d?.title || '—')}</td>
      <td>${esc(d?.discipline || '—')}</td>
      <td>${rev ? `${esc(rev.from_revision)}→${esc(rev.to_revision)}` : '—'}</td>
      <td>${esc(it.note || '')}</td>
    </tr>`;
  }).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Трансмиттал ${esc(tr.number)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; margin: 0; padding: 40px; }
  h1 { font-size: 18px; text-align: center; margin-bottom: 4px; }
  .subtitle { text-align: center; font-size: 12px; color: #555; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
  th { background: #f0f0f0; font-size: 11px; text-transform: uppercase; padding: 8px 10px; text-align: left; border: 1px solid #ccc; }
  td { padding: 7px 10px; border: 1px solid #ddd; vertical-align: top; }
  .meta { display: flex; gap: 32px; margin-bottom: 12px; font-size: 13px; }
  .meta span { color: #555; }
  .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; }
  .sign-block { width: 40%; }
  .sign-line { border-top: 1px solid #000; margin-top: 28px; padding-top: 4px; font-size: 11px; }
  @media print { body { padding: 10mm 15mm; } @page { size: A4 landscape; } }
</style></head><body>
<h1>ТРАНСМИТТАЛ</h1>
<div class="subtitle">${esc(projectName)} &nbsp;·&nbsp; ${esc(tr.number)}</div>
<div class="meta">
  <div><span>Дата:</span> ${dateStr}</div>
  <div><span>Статус:</span> ${esc(tr.status || 'draft')}</div>
  <div><span>Позиций:</span> ${items.length}</div>
</div>
<table>
  <thead><tr><th>Код</th><th>Название</th><th>Дисциплина</th><th>Ревизия</th><th>Примечание</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="5">—</td></tr>'}</tbody>
</table>
<div class="footer">
  <div class="sign-block"><div class="sign-line">Выдал</div></div>
  <div class="sign-block"><div class="sign-line">Принял</div></div>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};

/**
 * Макет листа спецификации (для программиста / печати):
 * - A1:H1 — название
 * - A2:H2 — шапка таблицы
 * - Строка 3 — образец строки (границы, wrap, вертикаль по центру, увеличенная высота)
 * - Строки 3–32 — рабочая зона таблицы (30 позиций на лист)
 * - Строка 33+ — штамп; область печати A1:H43
 * - При >30 позиций — копируется лист, в штампе B38 = номер листа, D38 = всего листов
 */
export const SPEC_LAYOUT_DATA_FIRST_ROW = 3;
export const SPEC_LAYOUT_DATA_LAST_ROW = 32;
export const SPEC_LAYOUT_ROWS_PER_SHEET = 30;
export const SPEC_LAYOUT_STAMP_START_ROW = 33;
export const SPEC_LAYOUT_PRINT_AREA = 'A1:H43';

export type SpecificationExportRow = {
  line_no: number;
  name: string;
  type_mark?: string;
  code?: string;
  plant?: string;
  unit?: string;
  qty: number;
};

const edge: ExcelJS.Border = { style: 'thin', color: { argb: 'FF333333' } };
const box: Partial<ExcelJS.Borders> = {
  top: edge,
  left: edge,
  bottom: edge,
  right: edge,
};

function applyDataTemplateRowStyle(ws: ExcelJS.Worksheet, rowNum: number) {
  const r = ws.getRow(rowNum);
  r.height = 40;
  for (let col = 1; col <= 8; col++) {
    const c = r.getCell(col);
    c.border = box;
    const centerCols = [1, 6, 7];
    c.alignment = {
      wrapText: true,
      vertical: 'middle',
      horizontal: centerCols.includes(col) ? 'center' : 'left',
    };
  }
}

function fillInstructionSheet(ws: ExcelJS.Worksheet) {
  const lines = [
    'Инструкция для разработчика (макет спецификации)',
    '',
    '• Строка 3 — шаблон строки таблицы (стиль: границы, перенос текста, вертикаль по центру).',
    '• Строки 3–32 — рабочая зона таблицы (до 30 позиций на один лист).',
    '• Строка 33 и ниже — штамп; значения штампа — в B34–B43 (и D38 для «Листов» при необходимости).',
    '• При превышении 30 строк — копировать лист; на каждом листе обновлять B38 (текущий лист) и D38 (всего листов).',
    '• Область печати на листе данных: A1:H43.',
  ];
  lines.forEach((line, i) => {
    ws.getCell(i + 1, 1).value = line;
  });
  ws.getColumn(1).width = 92;
}

function buildSpecificationLayoutSheet(
  ws: ExcelJS.Worksheet,
  specificationName: string,
  stamp: Record<string, string>,
  pageItems: SpecificationExportRow[],
  pageIndex: number,
  totalPages: number,
  globalLineStart: number
) {
  ws.mergeCells('A1:H1');
  const titleCell = ws.getCell('A1');
  titleCell.value = specificationName || 'Спецификация оборудования';
  titleCell.font = { bold: true, size: 12 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  titleCell.border = box;
  ws.getRow(1).height = 28;

  const headers = [
    'Поз.',
    'Наименование и техническая характеристика',
    'Тип, марка',
    'Код',
    'Завод',
    'Ед.',
    'Кол-во',
    'Примечание',
  ];
  headers.forEach((h, i) => {
    const c = ws.getCell(2, i + 1);
    c.value = h;
    c.font = { bold: true };
    c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    c.border = box;
  });
  ws.getRow(2).height = 36;

  for (let rowNum = SPEC_LAYOUT_DATA_FIRST_ROW; rowNum <= SPEC_LAYOUT_DATA_LAST_ROW; rowNum++) {
    applyDataTemplateRowStyle(ws, rowNum);
  }

  for (let i = 0; i < pageItems.length; i++) {
    const rowNum = SPEC_LAYOUT_DATA_FIRST_ROW + i;
    const it = pageItems[i];
    const row = ws.getRow(rowNum);
    const pos = globalLineStart + i + 1;
    row.getCell(1).value = pos;
    row.getCell(2).value = it.name || '';
    row.getCell(3).value = it.type_mark || '';
    row.getCell(4).value = it.code || '';
    row.getCell(5).value = it.plant || '';
    row.getCell(6).value = it.unit || '';
    row.getCell(7).value = Number(it.qty) || 0;
    row.getCell(8).value = '';
  }

  const stampRow = SPEC_LAYOUT_STAMP_START_ROW;
  ws.mergeCells(`A${stampRow}:H${stampRow}`);
  const sh = ws.getCell(`A${stampRow}`);
  sh.value = 'ШТАМП';
  sh.font = { bold: true, size: 11 };
  sh.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  sh.border = box;

  const stampLabel = (r: number, a: string) => {
    const cell = ws.getCell(`A${r}`);
    cell.value = a;
    cell.font = { bold: true };
    cell.border = box;
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' };
  };
  const stampVal = (r: number, v: string | number, mergeBtoH = true) => {
    if (mergeBtoH) {
      ws.mergeCells(`B${r}:H${r}`);
    }
    const cell = ws.getCell(`B${r}`);
    cell.value = v;
    cell.border = box;
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' };
  };

  let r = stampRow + 1;
  stampLabel(r, 'Шифр проекта');
  stampVal(r, stamp.projectCode || '');
  r++;
  stampLabel(r, 'Наименование объекта');
  stampVal(r, stamp.objectName || '');
  r++;
  stampLabel(r, 'Наименование системы');
  stampVal(r, stamp.systemName || '');
  r++;
  stampLabel(r, 'Стадия');
  stampVal(r, stamp.stage || 'РП');
  r++;

  stampLabel(r, 'Лист');
  ws.getCell(`B${r}`).value = pageIndex;
  ws.getCell(`B${r}`).border = box;
  ws.getCell(`B${r}`).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  ws.getCell(`C${r}`).value = 'Листов';
  ws.getCell(`C${r}`).font = { bold: true };
  ws.getCell(`C${r}`).border = box;
  ws.getCell(`C${r}`).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  ws.getCell(`D${r}`).value = totalPages;
  ws.getCell(`D${r}`).border = box;
  ws.getCell(`D${r}`).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  for (let c = 5; c <= 8; c++) {
    const cell = ws.getRow(r).getCell(c);
    cell.border = box;
    cell.value = '';
  }
  r++;

  stampLabel(r, 'Разработал');
  stampVal(r, stamp.developedBy || '');
  r++;
  stampLabel(r, 'Проверил');
  stampVal(r, stamp.checkedBy || '');
  r++;
  stampLabel(r, 'Н. контроль');
  stampVal(r, stamp.normControlBy || '');
  r++;
  stampLabel(r, 'Утвердил');
  stampVal(r, stamp.approvedBy || '');
  r++;
  stampLabel(r, 'Дата');
  stampVal(r, stamp.date || '');

  for (let extra = r + 1; extra <= 43; extra++) {
    for (let c = 1; c <= 8; c++) {
      const cell = ws.getCell(extra, c);
      cell.border = box;
      cell.value = '';
    }
  }

  for (let c = 1; c <= 8; c++) {
    const widths = [8, 42, 18, 14, 14, 8, 10, 14];
    ws.getColumn(c).width = widths[c - 1];
  }

  (ws.pageSetup as { printArea?: string }).printArea = SPEC_LAYOUT_PRINT_AREA;
}

/**
 * Экспорт спецификации по фиксированному макету (см. константы SPEC_LAYOUT_*).
 */
export async function exportSpecificationLayoutXlsx(
  specificationName: string,
  stamp: Record<string, string>,
  items: SpecificationExportRow[]
): Promise<void> {
  const sorted = [...items].sort((a, b) => (a.line_no || 0) - (b.line_no || 0));
  const chunks: SpecificationExportRow[][] = [];
  for (let i = 0; i < sorted.length; i += SPEC_LAYOUT_ROWS_PER_SHEET) {
    chunks.push(sorted.slice(i, i + SPEC_LAYOUT_ROWS_PER_SHEET));
  }
  if (!chunks.length) chunks.push([]);

  const totalPages = Math.max(1, chunks.length);
  const wb = new ExcelJS.Workbook();

  chunks.forEach((chunk, pi) => {
    const name = `Лист ${pi + 1}`;
    const ws = wb.addWorksheet(name, { state: 'visible' });
    const globalStart = pi * SPEC_LAYOUT_ROWS_PER_SHEET;
    buildSpecificationLayoutSheet(
      ws,
      specificationName,
      stamp,
      chunk,
      pi + 1,
      totalPages,
      globalStart
    );
  });

  const instruction = wb.addWorksheet('Инструкция', { state: 'visible' });
  fillInstructionSheet(instruction);

  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const safe = (specificationName || 'specification').replace(/[^\w.-]+/g, '_');
  saveAs(blob, `${safe}.xlsx`);
}

/** @deprecated Используйте exportSpecificationLayoutXlsx — макет задаётся в коде, не из файла. */
export const exportSpecificationFromTemplateXlsx = exportSpecificationLayoutXlsx;

/** Синоним макетного экспорта. */
export const exportSpecificationSimpleXlsx = exportSpecificationLayoutXlsx;
