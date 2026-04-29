// DD-15: LeadDashboard — специализированный дашборд для Lead'а отдела
// Виджеты: нагрузка инженеров отдела, очередь «На проверке у меня», задачи у ГИПа

interface LeadDashboardProps {
  C: any;
  currentUser: any;
  appUsers: any[];
  allTasks: any[];
  setSelectedTask: (t: any) => void;
  setShowTaskDetail: (b: boolean) => void;
}

export default function LeadDashboard({ C, currentUser, appUsers, allTasks, setSelectedTask, setShowTaskDetail }: LeadDashboardProps) {
  if (!currentUser?.dept_id) {
    return <div style={{ color: C.textMuted, padding: 20 }}>Дашборд Lead'а недоступен — у вас не назначен отдел.</div>;
  }

  const myDeptEngineers = appUsers.filter((u) => u.dept_id === currentUser.dept_id && u.role === 'engineer');
  const myReviewQueue = allTasks.filter((t) => t.status === 'review_lead' && myDeptEngineers.some((e) => String(e.id) === String(t.assigned_to)));
  const atGip = allTasks.filter((t) => t.status === 'review_gip' && myDeptEngineers.some((e) => String(e.id) === String(t.assigned_to)));

  // Нагрузка по инженерам — активные задачи
  const loadByEng = myDeptEngineers.map((e) => {
    const active = allTasks.filter((t) => String(t.assigned_to) === String(e.id) && ['todo', 'inprogress', 'awaiting_input', 'revision'].includes(t.status));
    return { ...e, count: active.length };
  }).sort((a, b) => b.count - a.count);

  const maxLoad = Math.max(10, ...loadByEng.map((e) => e.count));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>👨‍💼 Дашборд Lead'а</div>

      {/* Нагрузка отдела */}
      <div className="panel-surface" style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>
          📊 Нагрузка инженеров отдела ({loadByEng.length})
        </div>
        {loadByEng.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>В вашем отделе нет инженеров.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loadByEng.map((e) => {
              const overload = e.count >= 10;
              const pct = Math.min(100, (e.count / maxLoad) * 100);
              return (
                <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 60px', gap: 10, alignItems: 'center', fontSize: 13 }}>
                  <div style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.full_name}</div>
                  <div style={{ background: C.surface, height: 18, borderRadius: 9, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: overload ? '#ef4444' : '#4a9eff', transition: 'width .3s' }} />
                  </div>
                  <div style={{ color: overload ? '#ef4444' : C.text, fontWeight: 700, textAlign: 'right' }}>
                    {e.count}{overload ? ' ⚠' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* На проверке у меня */}
      <div className="panel-surface" style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>
          👁 На проверке у меня ({myReviewQueue.length})
        </div>
        {myReviewQueue.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>📭 Очередь пуста. Все задачи отдела движутся.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {myReviewQueue.map((t) => {
              const eng = appUsers.find((u) => String(u.id) === String(t.assigned_to));
              return (
                <div
                  key={t.id}
                  onClick={() => { setSelectedTask(t); setShowTaskDetail(true); }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.accent)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      {eng?.full_name || `#${t.assigned_to}`}
                      {t.deadline && ` · до ${new Date(t.deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#a855f7', fontWeight: 600, marginLeft: 10 }}>Открыть →</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* У ГИПа */}
      <div className="panel-surface" style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>
          ↑ У ГИПа на проверке ({atGip.length})
        </div>
        {atGip.length === 0 ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>Нет задач на проверке у ГИПа.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {atGip.slice(0, 8).map((t) => (
              <div key={t.id} onClick={() => { setSelectedTask(t); setShowTaskDetail(true); }}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: 12, color: C.text, cursor: 'pointer', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                <span style={{ color: '#f5a623', fontWeight: 600, marginLeft: 10 }}>📋</span>
              </div>
            ))}
            {atGip.length > 8 && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>...и ещё {atGip.length - 8}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
