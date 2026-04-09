const ExcelJS = require('exceljs');

const runtime = 'nodejs';

function getStampValue(stamp, keySnake, keyCamel) {
  return String(stamp?.[keySnake] ?? stamp?.[keyCamel] ?? '');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body =
      typeof req.body === 'string'
        ? (() => {
            try {
              return JSON.parse(req.body);
            } catch (_e) {
              return null;
            }
          })()
        : req.body;

    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const stamp = body.stamp || {};
    const items = Array.isArray(body.items) ? body.items : [];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Спецификация');

    sheet.columns = [
      { header: '№', key: 'num', width: 5 },
      { header: 'Наименование', key: 'name', width: 40 },
      { header: 'Тип/марка', key: 'type', width: 25 },
      { header: 'Код', key: 'code', width: 20 },
      { header: 'Завод', key: 'factory', width: 20 },
      { header: 'Ед.', key: 'unit', width: 8 },
      { header: 'Кол-во', key: 'qty', width: 10 },
      { header: 'Примечание', key: 'note', width: 20 },
    ];

    sheet.getRow(1).font = { bold: true };

    items.forEach((item, i) => {
      sheet.addRow({
        num: i + 1,
        name: item?.name || '',
        type: item?.type || '',
        code: item?.code || '',
        factory: item?.factory || '',
        unit: item?.unit || '',
        qty: item?.qty ?? item?.quantity ?? 0,
        note: item?.note || '',
      });
    });

    sheet.eachRow((row) => {
      row.alignment = { wrapText: true, vertical: 'middle' };
    });

    const startRow = items.length + 3;

    sheet.getCell(`A${startRow}`).value = 'Шифр проекта';
    sheet.getCell(`B${startRow}`).value = getStampValue(stamp, 'project_code', 'projectCode');

    sheet.getCell(`A${startRow + 1}`).value = 'Наименование объекта';
    sheet.getCell(`B${startRow + 1}`).value = getStampValue(stamp, 'object_name', 'objectName');

    sheet.getCell(`A${startRow + 2}`).value = 'Наименование системы';
    sheet.getCell(`B${startRow + 2}`).value = getStampValue(stamp, 'system_name', 'systemName');

    sheet.getCell(`A${startRow + 3}`).value = 'Стадия';
    sheet.getCell(`B${startRow + 3}`).value = getStampValue(stamp, 'stage', 'stage');

    sheet.getCell(`A${startRow + 4}`).value = 'Разработал';
    sheet.getCell(`B${startRow + 4}`).value = getStampValue(stamp, 'author', 'developer');

    sheet.getCell(`A${startRow + 5}`).value = 'Проверил';
    sheet.getCell(`B${startRow + 5}`).value = getStampValue(stamp, 'checker', 'checker');

    sheet.getCell(`A${startRow + 6}`).value = 'Н. контроль';
    sheet.getCell(`B${startRow + 6}`).value = getStampValue(stamp, 'control', 'control');

    sheet.getCell(`A${startRow + 7}`).value = 'Утвердил';
    sheet.getCell(`B${startRow + 7}`).value = getStampValue(stamp, 'approver', 'approver');

    sheet.getCell(`A${startRow + 8}`).value = 'Дата';
    sheet.getCell(`B${startRow + 8}`).value = getStampValue(stamp, 'date', 'date');

    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=specification.xlsx');
    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    return res.status(500).json({
      error: 'Excel generation failed',
      details: err?.message || 'unknown error',
    });
  }
};

module.exports.runtime = runtime;
module.exports.config = { runtime };
