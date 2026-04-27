import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, '../server/templates/AGSK3_spec_template.xlsx');

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(p);
const ws = wb.getWorksheet('Лист 1') || wb.worksheets[0];

for (let r = 38; r <= 45; r++) {
  const row = ws.getRow(r);
  for (let c = 1; c <= 25; c++) {
    const v = row.getCell(c).value;
    if (v && String(v).toLowerCase().includes('дата')) console.log('R' + r + 'C' + c, v);
  }
}
