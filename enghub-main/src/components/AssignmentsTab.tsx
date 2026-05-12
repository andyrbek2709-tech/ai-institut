import React, { useEffect, useState } from 'react';

type Props = {
  C: any;
  isLead: boolean;
  isGip: boolean;
  activeProject: any;
  currentUserData: any;
  tasks: any[];
  taskDeps: Record<number, any>;
  loadTaskDeps: (taskIds: number[]) => Promise<void>;
  setShowNewAssignment: React.Dispatch<React.SetStateAction<boolean>>;
  getDeptNameById: (deptId: number | string | undefined | null) => string;
  getDeptName: (deptId: number | string | undefined | null) => string;
  handleAssignmentResponse: (taskId: number | string, accepted: boolean, comment?: string) => Promise<void> | void;
  apiPost: (path: string, body?: any) => Promise<any>;
  projectId?: number | string;
};

// C2: SLA elapsed hours indicator
function SlaIndicator({ awaitingSince, slaHours, C }: { awaitingSince?: string; slaHours?: number; C: any }) {
  const [elapsed, setElapsed] = useState(0);
  const sla = slaHours || 24;
  useEffect(() => {
    if (!awaitingSince) return;
    const tick = () => setElapsed(Math.round((Date.now() - new Date(awaitingSince).getTime()) / 360000) / 10);
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [awaitingSince]);
  if (!awaitingSince) return null;
  const pct = Math.min(elapsed / sla, 1);
  const color = elapsed >= sla ? '#ef4444' : pct >= 0.75 ? '#f59e0b' : '#22c55e';
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color }}>
        ⏱ {elapsed}ч без ответа{elapsed >= sla ? ` — SLA нарушен (норма ${sla}ч)` : ''}
      </div>
      <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,.08)', marginTop: 3 }}>
        <div style={{ height: 3, borderRadius: 2, background: color, width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

// C1: AI summary panel
function AiSummaryPanel({ dep, C }: { dep: any; C: any }) {
  if (!dep?.ai_summary) return null;
  return (
    <div style={{ marginTop: 8, background: 'rgba(167,139,250,.06)', border: '1px solid rgba(167,139,250,.2)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#a78bfa', marginBottom: 4 }}>💡 Краткое содержание от AI (ChatGPT 4.0)</div>
      <div style={{ fontSize: 12, color: '#c4b5fd', lineHeight: 1.6 }}>{dep.ai_summary}</div>
    </div>
  );
}

// C4: AI-check button + result
function AiCheckPanel({ dep, apiPost, projectId, C }: { dep: any; apiPost: any; projectId: any; C: any }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(dep?.ai_check || '');
  useEffect(() => { setResult(dep?.ai_check || ''); }, [dep?.ai_check]);
  const run = async () => {
    if (!dep?.id || !dep?.what_needed) return;
    setLoading(true);
    try {
      const r = await apiPost('/api/interdept-ai/assignment-check', {
        dependency_id: dep.id, what_needed: dep.what_needed, project_id: projectId,
      });
      setResult(r?.ai_check || '');
    } catch { /* ignore */ }
    setLoading(false);
  };
  if (!dep?.id) return null;
  if (result) return (
    <div style={{ marginTop: 8, background: 'rgba(34,197,94,.05)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#86efac', marginBottom: 4 }}>🔍 AI-сверка с ТЗ и нормативной базой</div>
      <div style={{ fontSize: 12, color: '#bbf7d0', lineHeight: 1.6 }}>{result}</div>
    </div>
  );
  return (
    <button onClick={run} disabled={loading} style={{ marginTop: 6, background: 'rgba(167,139,250,.1)', border: '1px solid rgba(167,139,250,.25)', color: '#a78bfa', borderRadius: 7, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
      {loading ? '⏳ Проверка...' : '🔍 Проверить по ТЗ и нормативке'}
    </button>
  );
}

export function AssignmentsTab({
  C, isLead, isGip, activeProject, currentUserData, tasks,
  taskDeps, loadTaskDeps, setShowNewAssignment,
  getDeptNameById, getDeptName, handleAssignmentResponse, apiPost, projectId,
}: Props) {
  useEffect(() => {
    const ids = tasks.filter(t => t.is_assignment).map(t => Number(t.id));
    if (ids.length) loadTaskDeps(ids);
  }, [tasks.length]); // eslint-disable-line

  const incomingTasks = tasks.filter(t => t.is_assignment && t.dept === getDeptName(currentUserData?.dept_id));
  const outgoingTasks = tasks.filter(t => t.is_assignment && String(t.source_dept) === String(currentUserData?.dept_id));

  return (
    <div>
      <div className="task-list-header">
        <div className="task-list-title">Межотдельские задания (Увязка)</div>
        {isLead && <button className="btn btn-primary" style={{ borderRadius: 20, padding: "10px 22px" }} onClick={() => setShowNewAssignment(true)}>+ Выдать задание</button>}
      </div>

      {isGip ? (
        <div style={{ background: C.surface, padding: 24, borderRadius: 12, border: `1px solid ${C.border}` }}>
          <div className="page-label" style={{ marginBottom: 16 }}>Матрица увязки проекта (GIP View)</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ padding: 10, borderBottom: `2px solid ${C.border}`, color: C.textMuted, textAlign: 'left' }}>Выдает \ Получает</th>
                  {activeProject.depts?.map((d: number) => <th key={d} style={{ padding: 10, borderBottom: `2px solid ${C.border}`, color: C.text }}>{getDeptNameById(d)}</th>)}
                </tr>
              </thead>
              <tbody>
                {activeProject.depts?.map((rD: number) => (
                  <tr key={`r${rD}`}>
                    <td style={{ padding: 10, borderBottom: `1px solid ${C.border}`, color: C.text, textAlign: 'left', fontWeight: 600 }}>{getDeptNameById(rD)}</td>
                    {activeProject.depts?.map((cD: number) => {
                      if (rD === cD) return <td key={cD} style={{ background: C.surface2, borderBottom: `1px solid ${C.border}` }}>—</td>;
                      const cellTasks = tasks.filter(t => t.is_assignment && String(t.source_dept) === String(rD) && t.dept === getDeptNameById(cD));
                      return (
                        <td key={cD} style={{ padding: 10, borderBottom: `1px solid ${C.border}` }}>
                          {cellTasks.length > 0
                            ? <div style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 12, background: C.accent + '20', color: C.accent, fontWeight: 700 }}>{cellTasks.length}</div>
                            : <span style={{ color: C.textMuted }}>0</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* C2: просроченные обмены для ГИП */}
          {(() => {
            const overdue = tasks.filter(t => t.is_assignment && t.awaiting_since && (Date.now() - new Date(t.awaiting_since).getTime()) / 3600000 >= (t.sla_hours || 24));
            if (!overdue.length) return null;
            return (
              <div style={{ marginTop: 20, background: 'rgba(239,68,68,.05)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>🔴 Просроченные обмены: {overdue.length}</div>
                {overdue.slice(0, 5).map(t => (
                  <div key={t.id} style={{ fontSize: 12, color: '#fca5a5', marginBottom: 4 }}>
                    ▸ {getDeptNameById(t.source_dept)} → {t.dept}: {t.name.slice(0, 60)} ({Math.round((Date.now() - new Date(t.awaiting_since).getTime()) / 3600000)}ч)
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div className="page-label" style={{ marginBottom: 16 }}>Входящие задания</div>
            <div className="task-list">
              {incomingTasks.length === 0 && <div className="empty-state">Нет входящих заданий</div>}
              {incomingTasks.map(t => {
                const dep = taskDeps[t.id];
                return (
                  <div key={t.id} className="task-row" style={{ flexDirection: 'column', alignItems: 'flex-start', borderLeft: `4px solid ${t.assignment_status === 'accepted' ? C.green : t.assignment_status === 'rejected' ? C.red : C.orange}` }}>
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{t.name}</div>
                      <span style={{ fontSize: 11, background: C.surface2, padding: '4px 8px', borderRadius: 6, color: C.textDim }}>От: {getDeptNameById(t.source_dept)}</span>
                    </div>
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 12, color: t.assignment_status === 'accepted' ? C.green : t.assignment_status === 'rejected' ? C.red : C.orange }}>
                        • {t.assignment_status === 'accepted' ? 'В работе' : t.assignment_status === 'rejected' ? 'Отклонено' : 'Ожидает решения'}
                      </div>
                      {isLead && t.assignment_status === 'pending_accept' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleAssignmentResponse(t.id, true)} style={{ background: C.green, color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>✓ Принять</button>
                          <button onClick={() => { const c = prompt('Причина отклонения?'); if (c) handleAssignmentResponse(t.id, false, c); }} style={{ background: 'transparent', color: C.red, border: `1px solid ${C.red}`, padding: '3px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>✗ Завернуть</button>
                        </div>
                      )}
                    </div>
                    <SlaIndicator awaitingSince={t.awaiting_since} slaHours={t.sla_hours} C={C} />
                    <AiSummaryPanel dep={dep} C={C} />
                    {dep && <AiCheckPanel dep={dep} apiPost={apiPost} projectId={projectId} C={C} />}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div className="page-label" style={{ marginBottom: 16 }}>Выданные задания (Смежникам)</div>
            <div className="task-list">
              {outgoingTasks.length === 0 && <div className="empty-state">Вы ничего не выдавали</div>}
              {outgoingTasks.map(t => (
                <div key={t.id} className="task-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{t.name}</div>
                    <span style={{ fontSize: 11, background: C.surface2, padding: '4px 8px', borderRadius: 6, color: C.textDim }}>Кому: {t.dept}</span>
                  </div>
                  <div style={{ fontSize: 12, color: t.assignment_status === 'accepted' ? C.green : t.assignment_status === 'rejected' ? C.red : C.orange }}>
                    • {t.assignment_status === 'accepted' ? 'Взято в работу' : t.assignment_status === 'rejected' ? 'Отклонено' : 'Ожидает рассмотрения'}
                  </div>
                  {t.comment && <div style={{ fontSize: 12, color: C.red, marginTop: 4 }}>Замечание: {t.comment}</div>}
                  <SlaIndicator awaitingSince={t.awaiting_since} slaHours={t.sla_hours} C={C} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
