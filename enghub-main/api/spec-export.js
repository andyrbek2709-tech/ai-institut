const path = require('path');
const fs = require('fs');

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

function resolveTemplatePath() {
  const candidates = [
    path.join(__dirname, '..', 'server', 'templates', 'AGSK3_spec_template.xlsx'),
    path.join(process.cwd(), 'server', 'templates', 'AGSK3_spec_template.xlsx'),
    path.join(process.cwd(), 'enghub-main', 'server', 'templates', 'AGSK3_spec_template.xlsx'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`Template file not found. Tried: ${candidates.join(' | ')}`);
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

function copyTemplateSheet(templateSheet, targetSheet) {
  targetSheet.properties = cloneModel(templateSheet.properties || {});
  targetSheet.pageSetup = cloneModel(templateSheet.pageSetup || {});
  targetSheet.headerFooter = cloneModel(templateSheet.headerFooter || {});
  targetSheet.views = cloneModel(templateSheet.views || []);
  targetSheet.state = templateSheet.state || 'visible';

  const colCount = Math.max(templateSheet.columnCount || 0, 60);
  for (let c = 1; c <= colCount; c += 1) {
    const srcCol = templateSheet.getColumn(c);
    const dstCol = targetSheet.getColumn(c);
    dstCol.width = srcCol.width;
    dstCol.hidden = srcCol.hidden;
    dstCol.outlineLevel = srcCol.outlineLevel;
    dstCol.style = cloneModel(srcCol.style || {});
  }

  const rowCount = Math.max(templateSheet.rowCount || 0, 60);
  for (let r = 1; r <= rowCount; r += 1) {
    const srcRow = templateSheet.getRow(r);
    const dstRow = targetSheet.getRow(r);
    dstRow.height = srcRow.height;
    dstRow.hidden = srcRow.hidden;
    dstRow.outlineLevel = srcRow.outlineLevel;
    srcRow.eachCell({ includeEmpty: true }, (srcCell, colNumber) => {
      const dstCell = dstRow.getCell(colNumber);
      dstCell.value = cloneModel(srcCell.value);
      cloneCellStyle(srcCell, dstCell);
    });
  }

  const merges = (templateSheet.model && templateSheet.model.merges) || [];
  for (const range of merges) {
    targetSheet.mergeCells(range);
  }
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

function reapplyTemplateStyles(templateSheet, sheet, addresses) {
  for (const addr of addresses) {
    cloneCellStyle(templateSheet.getCell(addr), sheet.getCell(addr));
  }
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
    let excelReady = true;
    let excelError = '';
    try {
      // Lazy-load to avoid crashing function during module init on runtime packaging issues.
      require('exceljs');
    } catch (e) {
      excelReady = false;
      excelError = String(e?.message || e);
    }
    return res.status(200).json({
      ok: true,
      route: 'spec-export',
      expected: { stamp: 'object', items: 'array' },
      exceljs_ready: excelReady,
      exceljs_error: excelError || undefined,
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    let ExcelJS;
    try {
      ExcelJS = require('exceljs');
    } catch (e) {
      return res.status(500).json({ error: `exceljs load failed: ${String(e?.message || e)}` });
    }

    const stamp = req.body?.stamp || {};
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const pages = splitPages(items);

    const templatePath = resolveTemplatePath();
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
        // ExcelJS has no direct copy_worksheet API; copy full worksheet structure from template.
        sheet = wb.addWorksheet(`tmp_${i + 1}`);
        copyTemplateSheet(templateSheet, sheet);
        sheet.name = String(i + 1);
      }
      writePageRows(sheet, pages[i]);
      fillStamp(sheet, stamp, i, pages.length);
      reapplyTemplateStyles(templateSheet, sheet, ['B34', 'B35', 'B36', 'B37', 'B38', 'D38', 'B39', 'B40', 'B41', 'B42', 'B43']);
    }

    const out = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="spec.xlsx"');
    return res.status(200).send(Buffer.from(out));
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
};
