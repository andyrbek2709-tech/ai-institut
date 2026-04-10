const path = require('path');
const ExcelJS = require('exceljs');

const runtime = 'nodejs';
const TEMPLATE_PATH = path.join(__dirname, 'template.xlsx');
const ROWS_PER_SHEET = 30;
const TABLE_START_ROW = 2;
const STYLE_TEMPLATE_ROW = 2;
const TABLE_COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

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
  for (let i = 0; i < src.length; i += ROWS_PER_SHEET) {
    pages.push(src.slice(i, i + ROWS_PER_SHEET));
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
    const src = sheet.getCell(`${col}${STYLE_TEMPLATE_ROW}`);
    const dst = sheet.getCell(`${col}${targetRowNumber}`);
    dst.style = deepClone(src.style || {});
    dst.numFmt = src.numFmt;
  }
}

function writeItems(sheet, pageItems) {
  for (let i = 0; i < ROWS_PER_SHEET; i += 1) {
    const row = TABLE_START_ROW + i;
    copyRowStyleFromTemplate(sheet, row);

    const item = pageItems[i];
    if (!item) {
      for (const col of TABLE_COLS) {
        sheet.getCell(`${col}${row}`).value = '';
      }
      continue;
    }

    sheet.getCell(`A${row}`).value = i + 1;
    sheet.getCell(`B${row}`).value = String(item?.name || '');
    sheet.getCell(`C${row}`).value = String(item?.type || '');
    sheet.getCell(`D${row}`).value = String(item?.code || '');
    sheet.getCell(`E${row}`).value = String(item?.factory || '');
    sheet.getCell(`F${row}`).value = String(item?.unit || '');
    sheet.getCell(`G${row}`).value = getQty(item);
    sheet.getCell(`H${row}`).value = String(item?.note || '');
  }
}

function writeStamp(sheet, stamp, pageIndex, totalPages) {
  sheet.getCell('B8').value = getValue(stamp, 'project_code', 'projectCode');
  sheet.getCell('B9').value = getValue(stamp, 'object_name', 'objectName');
  sheet.getCell('B10').value = getValue(stamp, 'system_name', 'systemName');
  sheet.getCell('B11').value = getValue(stamp, 'stage', 'stage');
  sheet.getCell('B12').value = getValue(stamp, 'developer', 'author');
  sheet.getCell('B13').value = getValue(stamp, 'checker', 'checker');
  sheet.getCell('B14').value = getValue(stamp, 'control', 'control');
  sheet.getCell('B15').value = getValue(stamp, 'approver', 'approver');
  sheet.getCell('B16').value = getValue(stamp, 'date', 'date');
  sheet.getCell('B17').value = `Лист: ${pageIndex + 1} / ${totalPages}`;
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
    const pages = chunkItems(body.items);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(TEMPLATE_PATH);
    const templateSheet = workbook.worksheets[0];
    if (!templateSheet) {
      throw new Error('Template worksheet not found');
    }

    templateSheet.name = '1';

    for (let i = 0; i < pages.length; i += 1) {
      const sheet = i === 0 ? templateSheet : cloneSheetFromTemplate(workbook, templateSheet, String(i + 1));
      writeItems(sheet, pages[i]);
      writeStamp(sheet, stamp, i, pages.length);
    }

    const out = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=\"specification.xlsx\"');
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
