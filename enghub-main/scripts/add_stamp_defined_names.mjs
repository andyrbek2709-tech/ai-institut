// One-shot migration for api/template.xlsx:
// inserts workbook-level defined names for each stamp field so the server
// can resolve stamp coordinates by name instead of hardcoded cell addresses.
//
// Run with: `node scripts/add_stamp_defined_names.mjs` from enghub-main/.
// Idempotent — re-running will just overwrite the same names.
//
// Source of truth for the names ↔ coordinates mapping is api/spec-export.js
// (re-exported as STAMP_FIELDS). If the template editor later moves a cell,
// they only need to redefine the name in Excel itself; code stays untouched.

import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { STAMP_FIELDS } = require('../api/spec-export.js');

const TEMPLATE = path.join(__dirname, '..', 'api', 'template.xlsx');

function colIndexToLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(TEMPLATE);
const sheet = wb.worksheets[0];
if (!sheet) throw new Error('Template has no worksheet');

const sheetName = sheet.name || 'Sheet1';

for (const [name, def] of Object.entries(STAMP_FIELDS)) {
  const { row, col } = def.fallback;
  const addr = `'${sheetName}'!$${colIndexToLetter(col)}$${row}`;
  // Workbook-scoped defined name → resolves on any sheet, the server just
  // takes the cell address part and applies it to each sheet clone.
  try {
    wb.definedNames.add(addr, name);
  } catch {
    // ExcelJS API: removeName then add — there's no "set" method
    try { wb.definedNames.remove(name); } catch { /* ignore */ }
    wb.definedNames.add(addr, name);
  }
  console.log(`✓ ${name} → ${addr}`);
}

await wb.xlsx.writeFile(TEMPLATE);
console.log('Saved', TEMPLATE);
