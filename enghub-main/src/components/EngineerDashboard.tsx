// DD-16: EngineerDashboard — специализированный дашборд для инженера
// Виджеты: мои задачи (с цветной полоской по приоритету срока), мои проекты, события по мне

interface EngineerDashboardProps {
  C: any;
  currentUser: any;
  allTasks: any[];
  projects: any[];
  setSelectedTask: (t: any) => void;
  setShowTaskDetail: (b: boolean) => void;
  setActiveProject?: (p: any) => void;
}

function priorityBorderColor(t: any): string {
  if (!t.deadline) return '#2ac769';
  const now = new Date();
  const dl = new Date(t.deadline);
  const days = (dl.getTime() - now.getTime()) / 86400000;
  if (t.status === 'done') return '#9ca3af';
  if (days < 3) return '#ef4444';
  if (days < 14) return '#f5a623';
  return '#2ac769';
}

function fmtDeadline(t: any): string {
  if (!t.deadline) return '';
  const dl = new Date(t.deadline);
  const now = new Date();
  const days = Math.ceil((dl.getTime() - now.getTime()) / 86400000);
  if (days < 0) return `просрочена ${-days} дн`;
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';
  if (days < 7) return `через ${days} дн`;
  return dl.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
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

export default function EngineerDashboard({ C, currentUser, allTasks, projects, setSelectedTask, setShowTaskDetail, setActiveProject }: EngineerDashboardProps) {
  if (!currentUser?.id) {
    return <div style={{ color: C.textMuted, padding: 20 }}>Дашборд инженера недоступен.</div>;
  }

  const myTasks = allTasks
    .filter((t) => String(t.assigned_to) === String(currentUser.id) && t.status !== 'done')
    .sort((a, b) => {
      const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return ad - bd;
    });

  // Группировка задач по проекту для секции «Мои проекты»
  const tasksByProject = new Map<number, number>();
  allTasks.forEach((t) => {
    if (String(t.assigned_to) === String(currentUser.id) && t.status !== 'done' && t.project_id) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>👨‍🔧 Мой рабочий стол</div>

      {/* Мои задачи */}
      <div className="panel-surface" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
            ≡ Мои задачи ({myTasks.length})
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, display: 'flex', gap: 10 }}>
            <span>🔴 &lt;3 дн</span>
            <span>🟡 &lt;14 дн</span>
            <span>🟢 &gt;14 дн</span>
          </div>
        </div>
        {myTasks.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>📭 Активных задач нет. Хорошо!</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {myTasks.slice(0, 12).map((t) => {
              const border = priorityBorderColor(t);
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
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderLeft: `4px solid ${border}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = C.surface)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      {proj?.name && `📁 ${proj.name} · `}
                      {STATUS_LABELS[t.status] || t.status}
                      {t.deadline && ` · ${fmtDeadline(t)}`}
                    </div>
                  </div>
                </div>
              );
            })}
            {myTasks.length > 12 && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, textAlign: 'center' }}>...и ещё {myTasks.length - 12}</div>}
          </div>
        )}
      </div>

      {/* Мои проекты */}
      <div className="panel-surface" style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>
          📁 Мои проекты ({myProjects.length})
        </div>
        {myProjects.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>Активных задач в проектах нет.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            {myProjects.map((p: any) => (
              <div
                key={p.id}
                onClick={() => { if (setActiveProject) setActiveProject(p); }}
                style={{
                  padding: '10px 12px',
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  cursor: setActiveProject ? 'pointer' : 'default',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.name}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                  {p.code} · <span style={{ color: C.accent, fontWeight: 600 }}>{p.taskCount} задач</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
