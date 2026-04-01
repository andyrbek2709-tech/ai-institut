import React from 'react';

interface Task {
  id: string;
  name: string;
  project_id: number;
  status: string;
  created_at: string;
  deadline: string;
  assigned_to: string;
  priority: string;
  dept?: string;
}

interface User {
  id: string;
  full_name: string;
  dept_id: any;
}

interface GanttChartProps {
  tasks: Task[];
  activeProject: any;
  getUserById: (id: string | number) => User | undefined;
  getDeptName: (id: any) => string;
  C: any;
}

const GanttChart: React.FC<GanttChartProps> = ({ tasks, activeProject, getUserById, getDeptName, C }) => {
  const pTasks = tasks.filter(t => t.project_id === activeProject.id);
  if (pTasks.length === 0) return <div className="empty-state" style={{ padding: 40 }}>Нет задач для диаграммы. Создайте задачи с дедлайнами.</div>;

  const now = Date.now();
  const stamps = pTasks.flatMap(t => [t.created_at ? new Date(t.created_at).getTime() : null, t.deadline ? new Date(t.deadline).getTime() : null]).filter(Boolean) as number[];
  if (activeProject.deadline) stamps.push(new Date(activeProject.deadline).getTime());
  stamps.push(now);
  
  const minT = Math.min(...stamps);
  const maxT = Math.max(...stamps);
  const range = Math.max(maxT - minT, 86400000 * 7);
  const pct = (t: number) => Math.max(0, Math.min(100, ((t - minT) / range) * 100));
  const todayPct = pct(now);

  const sColors: Record<string, string> = { done: '#2ac769', inprogress: '#4a9eff', review_lead: '#a78bfa', review_gip: '#7c3aed', revision: '#f5a623', todo: '#8896a4' };
  const sLabels: Record<string, string> = { todo: 'В очереди', inprogress: 'В работе', review_lead: 'Проверка', review_gip: 'Проверка ГИПа', revision: 'Доработка', done: 'Готово' };

  const grouped: Record<string, Task[]> = {};
  for (const t of pTasks) {
    const u = getUserById(t.assigned_to);
    const dept = t.dept || (u ? getDeptName(u.dept_id) : '') || 'Общие';
    if (!grouped[dept]) grouped[dept] = [];
    grouped[dept].push(t);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(sLabels).map(([s, l]) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.textMuted }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: sColors[s] }} />
            {l}
          </div>
        ))}
      </div>
      <div style={{ overflowX: 'auto', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, boxShadow: 'var(--card-shadow)' }}>
        <div style={{ minWidth: 520 }}>
          <div style={{ display: 'flex', marginLeft: 160, marginBottom: 6, position: 'relative', height: 18 }}>
            <div style={{ position: 'absolute', left: '0%', fontSize: 10, color: C.textMuted }}>{new Date(minT).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}</div>
            <div style={{ position: 'absolute', right: 0, fontSize: 10, color: C.textMuted }}>{new Date(maxT).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}</div>
            <div style={{ position: 'absolute', left: `${todayPct}%`, transform: 'translateX(-50%)', fontSize: 10, color: '#ef4444', fontWeight: 700 }}>↓</div>
          </div>
          {Object.entries(grouped).map(([dept, dTasks]) => (
            <div key={dept}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 14 }}>{dept}</div>
              {dTasks.map(task => {
                const startT = task.created_at ? new Date(task.created_at).getTime() : minT;
                const endT = task.deadline ? new Date(task.deadline).getTime() : startT + 7 * 86400000;
                const isOverdue = endT < now && task.status !== 'done';
                const barL = pct(startT), barW = Math.max(1, pct(endT) - barL);
                const color = isOverdue ? '#ef4444' : (sColors[task.status] || '#8896a4');
                return (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <div style={{ width: 150, flexShrink: 0, fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', paddingRight: 8 }} title={task.name}>{task.name}</div>
                    <div style={{ flex: 1, position: 'relative', height: 22, background: C.surface2, borderRadius: 4 }}>
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${todayPct}%`, width: 1.5, background: '#ef444460', zIndex: 3 }} />
                      <div style={{ position: 'absolute', top: 3, bottom: 3, left: `${barL}%`, width: `${barW}%`, background: color, borderRadius: 3, opacity: 0.85, minWidth: 4 }} title={`${task.name} · ${sLabels[task.status]} · ${task.deadline || '—'}`} />
                    </div>
                    <div style={{ width: 56, flexShrink: 0, fontSize: 11, color: isOverdue ? '#ef4444' : C.textMuted, textAlign: 'right' }}>{task.deadline ? new Date(task.deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) : '—'}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GanttChart;
