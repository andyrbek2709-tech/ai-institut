import { saveAs } from 'file-saver';

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

