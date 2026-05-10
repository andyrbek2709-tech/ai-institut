// DD-16: EngineerDashboard — специализированный дашборд для инженера
// Виджеты: KPI, список задач с приоритетом, список проектов с дедлайном

interface EngineerDashboardProps {
  C: any;
  currentUser: any;
  allTasks: any[];
  projects: any[];
  setSelectedTask: (t: any) => void;
  setShowTaskDetail: (b: boolean) => void;
  setActiveProject?: (p: any) => void;
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'В очереди',
  inprogress: 'В работе',
  awaiting_input: 'Ждёт данных',
  review_lead: 'Проверка',
  review_gip: 'У ГИПа',
  revision: 'Доработка',
  done: 'Готово',
};

function taskBorderColor(t: any, C: any): string {
  if (!t.priority && !t.deadline) return C.green;
  const p = t.priority;
  if (p === 'high') return C.red;
  if (p === 'medium') return C.orange;
  if (p === 'low') return C.green;
  // Fallback: by deadline proximity
  if (!t.deadline) return C.green;
  const days = (new Date(t.deadline).getTime() - Date.now()) / 86400000;
  if (days < 3) return C.red;
  if (days < 14) return C.orange;
  return C.green;
}

function deadlineColor(deadline: string | null, C: any): string {
  if (!deadline) return C.textMuted;
  const daysLeft = (new Date(deadline).getTime() - Date.now()) / 86400000;
  if (daysLeft < 30) return C.red;
  if (daysLeft < 90) return C.orange;
  return C.green;
}

function fmtDeadline(deadline: string): string {
  const dl = new Date(deadline);
  const days = Math.ceil((dl.getTime() - Date.now()) / 86400000);
  if (days < 0) return `просрочена ${-days} дн`;
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';
  if (days < 7) return `через ${days} дн`;
  return dl.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function EngineerDashboard({ C, currentUser, allTasks, projects, setSelectedTask, setShowTaskDetail, setActiveProject }: EngineerDashboardProps) {
  if (!currentUser?.id) {
    return <div style={{ color: C.textMuted, padding: 20 }}>Дашборд инженера недоступен.</div>;
  }

  const now = new Date();
  const myTasks = allTasks.filter((t) => String(t.assigned_to) === String(currentUser.id));
  const inProgress = myTasks.filter((t) => t.status === 'inprogress').length;
  const completed = myTasks.filter((t) => t.status === 'done').length;
  const overdue = myTasks.filter((t) => t.deadline && new Date(t.deadline) < now && t.status !== 'done').length;

  const kpiCards = [
    { label: 'Мои задачи', value: myTasks.length },
    { label: 'В работе', value: inProgress },
    { label: 'Завершено', value: completed },
    { label: 'Просрочено', value: overdue },
  ];

  const activeTasks = myTasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => {
      const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return ad - bd;
    });

  // Проекты с задачами
  const tasksByProject = new Map<number, number>();
  myTasks.forEach((t) => {
    if (t.status !== 'done' && t.project_id) {
      tasksByProject.set(t.project_id, (tasksByProject.get(t.project_id) || 0) + 1);
    }
  });
  const myProjects = Array.from(tasksByProject.entries())
    .map(([pid, count]) => {
      const p = projects.find((x) => Number(x.id) === Number(pid));
      return p ? { ...p, taskCount: count } : null;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.taskCount - a.taskCount);

  const deptName = currentUser.dept_name || currentUser.department || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Заголовок */}
      <div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Рабочий стол · Инженер</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: C.text, fontFamily: "'Manrope', sans-serif", lineHeight: 1.2 }}>{currentUser.full_name}</div>
        {deptName && <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>{deptName}</div>}
      </div>

      {/* 4 KPI карточки */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {kpiCards.map(({ label, value }) => (
          <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>{label}</div>
            <div style={{ fontSize: 38, fontWeight: 800, color: C.text, fontFamily: "'Manrope', sans-serif" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Список задач */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>Мои задачи ({activeTasks.length})</div>
        {activeTasks.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>Активных задач нет.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {activeTasks.slice(0, 15).map((t) => {
              const borderColor = taskBorderColor(t, C);
              const proj = projects.find((p) => Number(p.id) === Number(t.project_id));
              return (
                <div
                  key={t.id}
                  onClick={() => { setSelectedTask(t); setShowTaskDetail(true); }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderLeft: `4px solid ${borderColor}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.surface)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = C.bg)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      {proj?.name && `${proj.name} · `}
                      {STATUS_LABELS[t.status] || t.status}
                      {t.deadline && ` · ${fmtDeadline(t.deadline)}`}
                    </div>
                  </div>
                </div>
              );
            })}
            {activeTasks.length > 15 && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, textAlign: 'center' }}>...и ещё {activeTasks.length - 15}</div>}
          </div>
        )}
      </div>

      {/* Список проектов */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>Мои проекты ({myProjects.length})</div>
        {myProjects.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>Активных задач в проектах нет.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {myProjects.map((p: any) => {
              const dlColor = deadlineColor(p.deadline || null, C);
              return (
                <div
                  key={p.id}
                  onClick={() => { if (setActiveProject) setActiveProject(p); }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    cursor: setActiveProject ? 'pointer' : 'default',
                  }}
                  onMouseEnter={(e) => { if (setActiveProject) e.currentTarget.style.background = C.surface; }}
                  onMouseLeave={(e) => { if (setActiveProject) e.currentTarget.style.background = C.bg; }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      {p.code && `${p.code} · `}
                      <span style={{ color: C.accent, fontWeight: 600 }}>{p.taskCount} задач</span>
                    </div>
                  </div>
                  {p.deadline && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: dlColor, marginLeft: 12, flexShrink: 0 }}>
                      {fmtDeadline(p.deadline)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
