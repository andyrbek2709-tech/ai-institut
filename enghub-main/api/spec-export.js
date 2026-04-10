const path = require('path');
const ExcelJS = require('exceljs');

const runtime = 'nodejs';
const TEMPLATE_PATH = path.join(__dirname, 'template.xlsx');
const ROWS_PER_PAGE = 30;
const START_ROW = 4;
const TEMPLATE_ROW = 4;
// Real table starts at column G (where "Поз." is located in row 2).
const COL_OFFSET = 7;
// Relative offsets from COL_OFFSET for concrete template groups.
const FIELD_COLS = {
  num: COL_OFFSET + 0, // G
  name: COL_OFFSET + 1, // H
  type: COL_OFFSET + 2, // I
  code: COL_OFFSET + 3, // J (group J:M)
  factory: COL_OFFSET + 7, // N (group N:Q)
  unit: COL_OFFSET + 11, // R
  qty: COL_OFFSET + 12, // S
  note: COL_OFFSET + 15, // V (group V:Y)
};
const TABLE_COLS = [
  FIELD_COLS.num,
  FIELD_COLS.name,
  FIELD_COLS.type,
  FIELD_COLS.code,
  FIELD_COLS.factory,
  FIELD_COLS.unit,
  FIELD_COLS.qty,
  FIELD_COLS.note,
];

function deepClone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function readBody(body) {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (_err) {
      return null;
    }
  }
  return body;
}

function getValue(obj, snake, camel) {
  return String(obj?.[snake] ?? obj?.[camel] ?? '');
}

function getQty(item) {
  const raw = item?.qty ?? item?.quantity ?? '';
  return raw === '' ? '' : Number(raw) || '';
}

function chunkItems(items) {
  const src = Array.isArray(items) ? items : [];
  const pages = [];
  for (let i = 0; i < src.length; i += ROWS_PER_PAGE) {
    pages.push(src.slice(i, i + ROWS_PER_PAGE));
  }
  return pages.length ? pages : [[]];
}

function cloneSheetFromTemplate(workbook, templateSheet, name) {
  const sheet = workbook.addWorksheet(name);

  sheet.properties = deepClone(templateSheet.properties || {});
  sheet.pageSetup = deepClone(templateSheet.pageSetup || {});
  sheet.headerFooter = deepClone(templateSheet.headerFooter || {});
  sheet.views = deepClone(templateSheet.views || []);
  sheet.state = templateSheet.state || 'visible';

  const maxColumns = Math.max(templateSheet.columnCount || 0, 40);
  for (let c = 1; c <= maxColumns; c += 1) {
    const srcCol = templateSheet.getColumn(c);
    const dstCol = sheet.getColumn(c);
    dstCol.width = srcCol.width;
    dstCol.hidden = srcCol.hidden;
    dstCol.outlineLevel = srcCol.outlineLevel;
    dstCol.style = deepClone(srcCol.style || {});
  }

  const maxRows = Math.max(templateSheet.rowCount || 0, 60);
  for (let r = 1; r <= maxRows; r += 1) {
    const srcRow = templateSheet.getRow(r);
    const dstRow = sheet.getRow(r);
    dstRow.height = srcRow.height;
    dstRow.hidden = srcRow.hidden;
    dstRow.outlineLevel = srcRow.outlineLevel;
    srcRow.eachCell({ includeEmpty: true }, (srcCell, colNumber) => {
      const dstCell = dstRow.getCell(colNumber);
      dstCell.value = deepClone(srcCell.value);
      dstCell.style = deepClone(srcCell.style || {});
      dstCell.numFmt = srcCell.numFmt;
    });
  }

  const merges = (templateSheet.model && templateSheet.model.merges) || [];
  for (const range of merges) sheet.mergeCells(range);

  return sheet;
}

function copyRowStyleFromTemplate(sheet, targetRowNumber) {
  for (const col of TABLE_COLS) {
    const src = sheet.getCell(TEMPLATE_ROW, col);
    const dst = sheet.getCell(targetRowNumber, col);
    dst.style = deepClone(src.style || {});
    dst.numFmt = src.numFmt;
  }
}

function applyTextWrap(cell) {
  cell.alignment = {
    ...(deepClone(cell.alignment || {})),
    wrapText: true,
    vertical: 'middle',
    horizontal: 'left',
  };
}

function setMergedAwareValue(sheet, row, col, value) {
  const cell = sheet.getCell(row, col);
  if (cell.isMerged && cell.master) {
    cell.master.value = value;
    return;
  }
  cell.value = value;
}

function calcRowHeight(name, type) {
  const totalLength = String(name || '').length + String(type || '').length;
  if (totalLength === 0) return 20;
  if (totalLength < 40) return 20;
  if (totalLength < 80) return 35;
  if (totalLength < 120) return 50;
  if (totalLength < 180) return 70;
  return 90;
}

function writeItems(sheet, pageItems, startIndex) {
  for (let i = 0; i < ROWS_PER_PAGE; i += 1) {
    const row = START_ROW + i;
    copyRowStyleFromTemplate(sheet, row);
    applyTextWrap(sheet.getCell(row, FIELD_COLS.name));
    applyTextWrap(sheet.getCell(row, FIELD_COLS.type));

    const item = pageItems[i];
    if (!item) {
      for (const col of TABLE_COLS) {
        sheet.getCell(row, col).value = '';
      }
      sheet.getRow(row).height = 20;
      continue;
    }

    const name = String(item?.name || '');
    const type = String(item?.type || '');

    setMergedAwareValue(sheet, row, FIELD_COLS.num, startIndex + i + 1);
    setMergedAwareValue(sheet, row, FIELD_COLS.name, name);
    setMergedAwareValue(sheet, row, FIELD_COLS.type, type);
    setMergedAwareValue(sheet, row, FIELD_COLS.code, String(item?.code || ''));
    setMergedAwareValue(sheet, row, FIELD_COLS.factory, String(item?.factory || ''));
    setMergedAwareValue(sheet, row, FIELD_COLS.unit, String(item?.unit || ''));
    setMergedAwareValue(sheet, row, FIELD_COLS.qty, getQty(item));
    setMergedAwareValue(sheet, row, FIELD_COLS.note, String(item?.note || ''));
    sheet.getRow(row).height = calcRowHeight(name, type);
  }
}

function writeStamp(sheet, stamp, pageIndex, totalPages) {
  const objectName = getValue(stamp, 'object_name', 'objectName') || String(stamp?.project_name || '');
  const systemName = getValue(stamp, 'system_name', 'systemName') || '-';
  const dateValue = getValue(stamp, 'date', 'date') || new Date().toISOString().slice(0, 10);

  // Fixed title-block coordinates (bottom-right area of current template).
  // Never calculate stamp position from table size.
  setMergedAwareValue(sheet, 34, 17, getValue(stamp, 'project_code', 'projectCode')); // Q34 (Q34:Y35 merge)
  setMergedAwareValue(sheet, 36, 17, objectName); // Q36 (Q36:Y38 merge)
  setMergedAwareValue(sheet, 34, 7, systemName); // G34 (G34:I44 merge)

  setMergedAwareValue(sheet, 40, 21, getValue(stamp, 'stage', 'stage')); // U40 (U40:V41 merge)
  setMergedAwareValue(sheet, 39, 12, getValue(stamp, 'developer', 'author')); // L39 (L39:N39 merge)
  setMergedAwareValue(sheet, 40, 12, getValue(stamp, 'checker', 'checker')); // L40 (L40:N40 merge)
  setMergedAwareValue(sheet, 43, 12, getValue(stamp, 'control', 'control')); // L43 (L43:N43 merge)
  setMergedAwareValue(sheet, 44, 12, getValue(stamp, 'approver', 'approver')); // L44 (L44:N44 merge)
  setMergedAwareValue(sheet, 44, 16, dateValue); // P44
  setMergedAwareValue(sheet, 42, 17, 'Спецификация оборудования, изделий и материалов'); // Q42 (Q42:T44 merge)

  setMergedAwareValue(sheet, 40, 23, pageIndex + 1); // W40 (W40:W41 merge)
  setMergedAwareValue(sheet, 40, 24, totalPages); // X40 (X40:Y41 merge)
}

function configurePrint(sheet) {
  sheet.pageSetup = {
    paperSize: 9, // A4
    orientation: 'landscape',
    scale: 100,
    fitToPage: false,
    printArea: `A1:Y45`,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.5,
      bottom: 0.5,
      header: 0.3,
      footer: 0.3,
    },
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = readBody(req.body);
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const stamp = body.stamp || {};
    const project = body.project || {};
    const pages = chunkItems(body.items);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(TEMPLATE_PATH);
    const templateSheet = workbook.worksheets[0];
    if (!templateSheet) {
      throw new Error('Template worksheet not found');
    }

    templateSheet.name = 'Лист 1';

    for (let i = 0; i < pages.length; i += 1) {
      const sheet = i === 0 ? templateSheet : cloneSheetFromTemplate(workbook, templateSheet, `Лист ${i + 1}`);
      writeItems(sheet, pages[i], i * ROWS_PER_PAGE);
      writeStamp(sheet, { ...stamp, project_name: project?.name || '' }, i, pages.length);
      configurePrint(sheet);
    }

    const out = await workbook.xlsx.writeBuffer();
    const fileDate = String(getValue(stamp, 'date', 'date') || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const code = String(getValue(stamp, 'project_code', 'projectCode') || project?.code || 'SPEC').trim() || 'SPEC';
    const safeCode = code.replace(/[^\wА-Яа-я.-]+/g, '_');
    const fileName = `${safeCode}_Спец_${fileDate}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=\"${fileName}\"`);
    return res.status(200).send(Buffer.from(out));
  } catch (err) {
    return res.status(500).json({
      error: 'Excel generation failed',
      details: err?.message || 'unknown error',
    });
  }
};

module.exports.runtime = runtime;
module.exports.config = { runtime };
