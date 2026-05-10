// DD-15: LeadDashboard — специализированный дашборд для Lead'а отдела
// Виджеты: KPI, нагрузка инженеров отдела, очередь «На проверке у меня»

import { useState, useEffect } from 'react';

interface LeadDashboardProps {
  C: any;
  currentUser: any;
  appUsers: any[];
  allTasks: any[];
  setSelectedTask: (t: any) => void;
  setShowTaskDetail: (b: boolean) => void;
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
}

export default function LeadDashboard({ C, currentUser, appUsers, allTasks, setSelectedTask, setShowTaskDetail }: LeadDashboardProps) {
  const [go, setGo] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setGo(true), 120);
    return () => clearTimeout(t);
  }, []);

  if (!currentUser?.dept_id) {
    return <div style={{ color: C.textMuted, padding: 20 }}>Дашборд Lead'а недоступен — у вас не назначен отдел.</div>;
  }

  const myDeptEngineers = appUsers.filter((u) => u.dept_id === currentUser.dept_id && u.role === 'engineer');
  const myReviewQueue = allTasks.filter((t) => t.status === 'review_lead' && myDeptEngineers.some((e) => String(e.id) === String(t.assigned_to)));
  const now = new Date();

  // KPI вычисления
  const inProgress = allTasks.filter((t) => myDeptEngineers.some((e) => String(e.id) === String(t.assigned_to)) && ['todo', 'inprogress', 'awaiting_input', 'revision'].includes(t.status));
  const overdue = allTasks.filter((t) => myDeptEngineers.some((e) => String(e.id) === String(t.assigned_to)) && t.deadline && new Date(t.deadline) < now && t.status !== 'done');

  const kpiCards = [
    { label: 'Инженеров в отделе', value: myDeptEngineers.length },
    { label: 'Задач в работе', value: inProgress.length },
    { label: 'На проверке у меня', value: myReviewQueue.length },
    { label: 'Просрочено', value: overdue.length },
  ];

  // Нагрузка по инженерам — активные задачи
  const loadByEng = myDeptEngineers.map((e) => {
    const engTasks = allTasks.filter((t) => String(t.assigned_to) === String(e.id) && ['todo', 'inprogress', 'awaiting_input', 'revision'].includes(t.status));
    const engOverdueTasks = allTasks.filter((t) => String(t.assigned_to) === String(e.id) && t.deadline && new Date(t.deadline) < now && t.status !== 'done').length;
    return { ...e, engTasks, count: engTasks.length, engOverdueTasks };
  }).sort((a, b) => b.count - a.count);

  // Название отдела
  const deptName = currentUser.dept_name || currentUser.department || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Заголовок */}
      <div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Рабочий стол · Нач. отдела</div>
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

      {/* Нагрузка по инженерам */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Нагрузка по инженерам</div>
        {loadByEng.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>В вашем отделе нет инженеров.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loadByEng.map((e) => {
              const pct = Math.min(Math.round((e.engTasks.length / 5) * 100), 100);
              const barColor = e.engOverdueTasks > 0 ? C.red : C.accent;
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Аватар-инициалы */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: e.engOverdueTasks > 0 ? `${C.red}22` : `${C.accent}22`,
                    border: `2px solid ${e.engOverdueTasks > 0 ? C.red : C.accent}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: e.engOverdueTasks > 0 ? C.red : C.accent,
                  }}>
                    {getInitials(e.full_name)}
                  </div>
                  {/* Имя */}
                  <div style={{ minWidth: 140, maxWidth: 180, flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.full_name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{e.count} задач{e.engOverdueTasks > 0 ? `, ${e.engOverdueTasks} просроч.` : ''}</div>
                  </div>
                  {/* Прогресс-бар */}
                  <div style={{ flex: 1, background: C.border, height: 8, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: go ? `${pct}%` : '0%',
                      height: '100%',
                      background: barColor,
                      borderRadius: 4,
                      transition: 'width 0.85s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: e.engOverdueTasks > 0 ? C.red : C.text, width: 28, textAlign: 'right' }}>
                    {e.count}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* На проверке у меня */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>На проверке у меня ({myReviewQueue.length})</div>
        {myReviewQueue.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>Очередь пуста. Все задачи отдела движутся.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {myReviewQueue.map((t) => {
              const eng = appUsers.find((u) => String(u.id) === String(t.assigned_to));
              return (
                <div
                  key={t.id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10 }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      {eng?.full_name || `#${t.assigned_to}`}
                      {t.deadline && ` · до ${new Date(t.deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 12, flexShrink: 0 }}>
                    <button
                      onClick={() => { setSelectedTask(t); setShowTaskDetail(true); }}
                      style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                      title="Одобрить"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => { setSelectedTask(t); setShowTaskDetail(true); }}
                      style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                      title="Отклонить"
                    >
                      ✗
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
