import React, { useRef } from 'react';

interface ReportData {
  project: any;
  tasks: any[];
  drawings: any[];
  reviews: any[];
  transmittals: any[];
  appUsers: any[];
}

export function ProjectReportPDF({ data, onClose }: { data: ReportData; onClose: () => void }) {
  const { project, tasks, drawings, reviews, transmittals, appUsers } = data;
  const printRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const doneTasks = tasks.filter(t => t.status === 'done');
  const overdueTasks = tasks.filter(t => t.deadline && new Date(t.deadline) < now && t.status !== 'done');
  const openReviews = reviews.filter(r => r.status === 'open');
  const issuedDrawings = drawings.filter(d => d.status === 'issued');
  const progress = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  // Group tasks by dept
  const deptStats: Record<string, { total: number; done: number }> = {};
  tasks.forEach(t => {
    const d = t.dept || 'Не указан';
    if (!deptStats[d]) deptStats[d] = { total: 0, done: 0 };
    deptStats[d].total++;
    if (t.status === 'done') deptStats[d].done++;
  });

  const daysLeft = project.deadline
    ? Math.ceil((new Date(project.deadline).getTime() - now.getTime()) / 86400000)
    : null;

  const handlePrint = () => {
    const style = document.createElement('style');
    style.id = 'pdf-print-style';
    style.innerHTML = `
      @media print {
        body > * { display: none !important; }
        #enghub-pdf-report { display: block !important; }
        @page { margin: 15mm; size: A4; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => { document.getElementById('pdf-print-style')?.remove(); }, 1000);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ background: '#fff', color: '#1a1a2e', width: '100%', maxWidth: 800, borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: '#1a1a2e', color: '#fff' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>📄 Предварительный просмотр отчёта</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handlePrint} style={{ background: '#4a9eff', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>🖨 Печать / PDF</button>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>✕ Закрыть</button>
          </div>
        </div>

        {/* Report content */}
        <div id="enghub-pdf-report" ref={printRef} style={{ padding: '32px 40px', fontFamily: 'Georgia, serif', fontSize: 11, color: '#1a1a2e', lineHeight: 1.6 }}>
          {/* Cover */}
          <div style={{ borderBottom: '3px solid #1a1a2e', marginBottom: 28, paddingBottom: 20 }}>
            <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Статус-отчёт проекта</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{project.name || 'Проект'}</div>
            <div style={{ fontSize: 10, color: '#444' }}>
              Код: {project.code || '—'} · Дата отчёта: {now.toLocaleDateString('ru-RU')}
              {project.deadline && ` · Плановый срок: ${new Date(project.deadline).toLocaleDateString('ru-RU')}`}
            </div>
            {daysLeft !== null && (
              <div style={{ marginTop: 6, fontSize: 11, color: daysLeft < 0 ? '#ef4444' : daysLeft < 30 ? '#f5a623' : '#2ac769', fontWeight: 600 }}>
                {daysLeft < 0 ? `⚠️ Просрочен на ${-daysLeft} дн.` : `До дедлайна: ${daysLeft} дн.`}
              </div>
            )}
          </div>

          {/* Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
            {[
              { label: 'Выполнено задач', value: `${doneTasks.length} / ${tasks.length}`, sub: `${progress}%`, color: '#2ac769' },
              { label: 'Чертежей выпущено', value: `${issuedDrawings.length} / ${drawings.length}`, sub: drawings.length > 0 ? `${Math.round(issuedDrawings.length / drawings.length * 100)}%` : '—', color: '#4a9eff' },
              { label: 'Открытые замечания', value: openReviews.length, sub: reviews.length > 0 ? `всего ${reviews.length}` : '—', color: openReviews.length > 0 ? '#f5a623' : '#2ac769' },
              { label: 'Просрочено', value: overdueTasks.length, sub: overdueTasks.length > 0 ? 'требуют внимания' : 'ОК', color: overdueTasks.length > 0 ? '#ef4444' : '#2ac769' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} style={{ border: '1px solid #ddd', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 9, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 10, color: '#888' }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Общий прогресс</div>
            <div style={{ height: 14, background: '#e8e8e8', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: progress >= 80 ? '#2ac769' : progress >= 50 ? '#4a9eff' : '#f5a623', borderRadius: 8, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>{progress}% задач выполнено</div>
          </div>

          {/* Tasks by department */}
          {Object.keys(deptStats).length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, borderBottom: '1px solid #ddd', paddingBottom: 4 }}>Прогресс по дисциплинам</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    {['Дисциплина', 'Задач', 'Выполнено', 'Прогресс', 'Статус'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#444', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(deptStats).map(([dept, s]) => {
                    const pct = Math.round((s.done / s.total) * 100);
                    return (
                      <tr key={dept}>
                        <td style={{ padding: '7px 10px', borderBottom: '1px solid #eee', fontWeight: 600 }}>{dept}</td>
                        <td style={{ padding: '7px 10px', borderBottom: '1px solid #eee' }}>{s.total}</td>
                        <td style={{ padding: '7px 10px', borderBottom: '1px solid #eee' }}>{s.done}</td>
                        <td style={{ padding: '7px 10px', borderBottom: '1px solid #eee' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 8, background: '#e8e8e8', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#2ac769' : pct >= 50 ? '#4a9eff' : '#f5a623' }} />
                            </div>
                            <span style={{ fontSize: 10, minWidth: 28 }}>{pct}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '7px 10px', borderBottom: '1px solid #eee', color: pct >= 80 ? '#2ac769' : pct >= 50 ? '#f5a623' : '#ef4444', fontWeight: 600 }}>
                          {pct >= 80 ? '✓ Норма' : pct >= 50 ? '⚠ Риск' : '✗ Отставание'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Issued drawings */}
          {drawings.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, borderBottom: '1px solid #ddd', paddingBottom: 4 }}>Реестр чертежей</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    {['Код', 'Наименование', 'Ревизия', 'Статус', 'Срок'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: '#444', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drawings.slice(0, 20).map(d => (
                    <tr key={d.id}>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #eee', fontWeight: 600, fontFamily: 'monospace' }}>{d.code}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #eee' }}>{d.title}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #eee' }}>{d.revision || 'R0'}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #eee', color: d.status === 'issued' ? '#2ac769' : d.status === 'approved' ? '#4a9eff' : '#888' }}>{d.status || 'draft'}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #eee', color: '#888' }}>{d.due_date || '—'}</td>
                    </tr>
                  ))}
                  {drawings.length > 20 && (
                    <tr><td colSpan={5} style={{ padding: '6px 10px', color: '#888', fontStyle: 'italic' }}>...и ещё {drawings.length - 20} чертежей</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Open reviews */}
          {openReviews.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, borderBottom: '1px solid #ddd', paddingBottom: 4 }}>Открытые замечания ({openReviews.length})</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    {['Замечание', 'Критичность', 'Чертёж'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: '#444', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {openReviews.slice(0, 15).map((r: any) => (
                    <tr key={r.id}>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #eee' }}>{r.title}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #eee', color: r.severity === 'critical' ? '#ef4444' : r.severity === 'major' ? '#f5a623' : '#888', fontWeight: 600 }}>{r.severity || '—'}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #eee', color: '#888' }}>{r.drawing_id ? `#${r.drawing_id}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Overdue tasks */}
          {overdueTasks.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, borderBottom: '1px solid #ddd', paddingBottom: 4, color: '#ef4444' }}>⚠ Просроченные задачи ({overdueTasks.length})</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ background: '#fff5f5' }}>
                    {['Задача', 'Дедлайн', 'Статус', 'Отдел'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: '#444', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overdueTasks.slice(0, 10).map((t: any) => (
                    <tr key={t.id}>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #fee' }}>{t.name}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #fee', color: '#ef4444', fontWeight: 600 }}>{t.deadline ? new Date(t.deadline).toLocaleDateString('ru-RU') : '—'}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #fee', color: '#888' }}>{t.status}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #fee', color: '#888' }}>{t.dept || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: '1px solid #ddd', paddingTop: 14, fontSize: 9, color: '#aaa', display: 'flex', justifyContent: 'space-between' }}>
            <span>EngHub — Система управления проектированием</span>
            <span>Сформировано: {now.toLocaleString('ru-RU')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
