import React from 'react';

type Props = {
  C: any;
  isLead: boolean;
  isGip: boolean;
  activeProject: any;
  currentUserData: any;
  tasks: any[];
  setShowNewAssignment: React.Dispatch<React.SetStateAction<boolean>>;
  getDeptNameById: (deptId: number | string | undefined | null) => string;
  getDeptName: (deptId: number | string | undefined | null) => string;
  handleAssignmentResponse: (taskId: number | string, accepted: boolean, comment?: string) => Promise<void> | void;
};

export function AssignmentsTab({
  C,
  isLead,
  isGip,
  activeProject,
  currentUserData,
  tasks,
  setShowNewAssignment,
  getDeptNameById,
  getDeptName,
  handleAssignmentResponse,
}: Props) {
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
                      const cellTasks = tasks.filter((t) => t.is_assignment && String(t.source_dept) === String(rD) && t.dept === getDeptNameById(cD));
                      return (
                        <td key={cD} style={{ padding: 10, borderBottom: `1px solid ${C.border}` }}>
                          {cellTasks.length > 0 ? (
                            <div style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: 12, background: C.accent + '20', color: C.accent, fontWeight: 700 }}>
                              {cellTasks.length}
                            </div>
                          ) : <span style={{ color: C.textMuted }}>0</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div className="page-label" style={{ marginBottom: 16 }}>Входящие задания</div>
            <div className="task-list">
              {tasks.filter((t) => t.is_assignment && t.dept === getDeptName(currentUserData?.dept_id)).length === 0 && <div className="empty-state">Нет входящих заданий</div>}
              {tasks.filter((t) => t.is_assignment && t.dept === getDeptName(currentUserData?.dept_id)).map((t) => (
                <div key={t.id} className="task-row" style={{ flexDirection: 'column', alignItems: 'flex-start', borderLeft: `4px solid ${t.assignment_status === 'accepted' ? C.green : t.assignment_status === 'rejected' ? C.red : C.orange}` }}>
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{t.name}</div>
                    <span style={{ fontSize: 11, background: C.surface2, padding: '4px 8px', borderRadius: 6, color: C.textDim }}>От: {getDeptNameById(t.source_dept)}</span>
                  </div>
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: C.textMuted }}>Статус: {t.assignment_status === 'accepted' ? 'В работе' : t.assignment_status === 'rejected' ? 'Отклонено' : 'Ожидает решения'}</div>
                    {isLead && t.assignment_status === 'pending_accept' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleAssignmentResponse(t.id, true)} style={{ background: C.green, color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>✓ Принять</button>
                        <button onClick={() => { const c = prompt('Причина отклонения?'); if (c) handleAssignmentResponse(t.id, false, c); }} style={{ background: 'transparent', color: C.red, border: `1px solid ${C.red}`, padding: '3px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>✗ Завернуть</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div className="page-label" style={{ marginBottom: 16 }}>Выданные задания (Смежникам)</div>
            <div className="task-list">
              {tasks.filter((t) => t.is_assignment && String(t.source_dept) === String(currentUserData?.dept_id)).length === 0 && <div className="empty-state">Вы ничего не выдавали</div>}
              {tasks.filter((t) => t.is_assignment && String(t.source_dept) === String(currentUserData?.dept_id)).map((t) => (
                <div key={t.id} className="task-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{t.name}</div>
                    <span style={{ fontSize: 11, background: C.surface2, padding: '4px 8px', borderRadius: 6, color: C.textDim }}>Кому: {t.dept}</span>
                  </div>
                  <div style={{ fontSize: 12, color: t.assignment_status === 'accepted' ? C.green : t.assignment_status === 'rejected' ? C.red : C.orange }}>
                    • {t.assignment_status === 'accepted' ? 'Взято в работу' : t.assignment_status === 'rejected' ? 'Отклонено' : 'Ожидает рассмотрения'}
                  </div>
                  {t.comment && <div style={{ fontSize: 12, color: C.red, marginTop: 4 }}>Замечание: {t.comment}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
