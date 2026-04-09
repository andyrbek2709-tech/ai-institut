const path = require('path');
const ExcelJS = require('exceljs');

const ROWS_PER_PAGE = 30;
const START_ROW = 3;
const TEMPLATE_ROW = 3;
const DATA_COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

function splitPages(items) {
  const src = Array.isArray(items) ? items : [];
  const pages = [];
  for (let i = 0; i < src.length; i += ROWS_PER_PAGE) {
    pages.push(src.slice(i, i + ROWS_PER_PAGE));
  }
  return pages.length ? pages : [[]];
}

function cloneModel(model) {
  if (typeof structuredClone === 'function') return structuredClone(model);
  return JSON.parse(JSON.stringify(model));
}

function cloneCellStyle(sourceCell, targetCell) {
  const src = sourceCell.style || {};
  targetCell.style = {
    font: cloneModel(src.font || {}),
    border: cloneModel(src.border || {}),
    fill: cloneModel(src.fill || {}),
    numFmt: src.numFmt || undefined,
    alignment: cloneModel(src.alignment || {}),
    protection: cloneModel(src.protection || {}),
  };
}

function applyRowStyleFromTemplate(sheet, rowNum) {
  for (const col of DATA_COLS) {
    const source = sheet.getCell(`${col}${TEMPLATE_ROW}`);
    const target = sheet.getCell(`${col}${rowNum}`);
    cloneCellStyle(source, target);
  }
}

function fillStamp(sheet, stamp, pageIndex, totalPages) {
  const safe = stamp || {};
  sheet.getCell('B34').value = String(safe.project_code || '');
  sheet.getCell('B35').value = String(safe.object_name || '');
  sheet.getCell('B36').value = String(safe.system_name || '');
  sheet.getCell('B37').value = String(safe.stage || '');
  sheet.getCell('B38').value = pageIndex + 1;
  sheet.getCell('D38').value = totalPages;
  sheet.getCell('B39').value = String(safe.author || '');
  sheet.getCell('B40').value = String(safe.checker || '');
  sheet.getCell('B41').value = String(safe.control || '');
  sheet.getCell('B42').value = String(safe.approver || '');
  sheet.getCell('B43').value = String(safe.date || '');
}

function writePageRows(sheet, pageItems) {
  for (let i = 0; i < ROWS_PER_PAGE; i += 1) {
    const row = START_ROW + i;
    applyRowStyleFromTemplate(sheet, row);
    const item = pageItems[i];
    if (!item) {
      for (const col of DATA_COLS) sheet.getCell(`${col}${row}`).value = '';
      continue;
    }
    sheet.getCell(`A${row}`).value = i + 1;
    sheet.getCell(`B${row}`).value = String(item.name || '');
    sheet.getCell(`C${row}`).value = String(item.type || '');
    sheet.getCell(`D${row}`).value = String(item.code || '');
    sheet.getCell(`E${row}`).value = String(item.factory || '');
    sheet.getCell(`F${row}`).value = String(item.unit || '');
    sheet.getCell(`G${row}`).value = Number(item.quantity || 0);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      route: 'spec-export',
      expected: { stamp: 'object', items: 'array' },
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const stamp = req.body?.stamp || {};
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const pages = splitPages(items);

    const templatePath = path.join(process.cwd(), 'server', 'templates', 'AGSK3_spec_template.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(templatePath);
    const templateSheet = wb.worksheets[0];
    if (!templateSheet) return res.status(500).json({ error: 'Template worksheet not found' });

    templateSheet.name = '1';

    for (let i = 0; i < pages.length; i += 1) {
      let sheet;
      if (i === 0) {
        sheet = templateSheet;
      } else {
        // ExcelJS has no direct copy_worksheet API; clone full template model as worksheet copy.
        sheet = wb.addWorksheet(String(i + 1));
        sheet.model = cloneModel(templateSheet.model);
        sheet.name = String(i + 1);
      }
      writePageRows(sheet, pages[i]);
      fillStamp(sheet, stamp, i, pages.length);
    }

    const out = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="spec.xlsx"');
    return res.status(200).send(Buffer.from(out));
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
};
