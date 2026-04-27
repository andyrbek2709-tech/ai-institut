import React, { useState, useEffect } from 'react';
import { listTimeEntries, createTimeEntry as apiCreateTimeEntry } from '../api/supabase';
import { Field, getInp, RuDateInput } from './ui';

interface TimelogPanelProps {
  projectId: number;
  tasks: any[];
  allTasks: any[];
  isGip: boolean;
  isLead: boolean;
  userId: string;
  getUserById: (id: any) => any;
  C: any;
  token: string;
  addNotification: (msg: string, type: any) => void;
}

const TimelogPanel: React.FC<TimelogPanelProps> = ({ 
  projectId, 
  tasks, 
  allTasks, 
  isGip, 
  isLead, 
  userId, 
  getUserById, 
  C, 
  token,
  addNotification
}) => {
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [showNewTimeEntry, setShowNewTimeEntry] = useState(false);
  const [newTimeEntry, setNewTimeEntry] = useState({ 
    task_id: '', 
    hours: '', 
    date: new Date().toISOString().split('T')[0], 
    note: '' 
  });
  const [saving, setSaving] = useState(false);

  const loadTimeEntries = async () => {
    const data = await listTimeEntries(projectId, token);
    if (Array.isArray(data)) setTimeEntries(data);
  };

  useEffect(() => {
    loadTimeEntries();
  }, [projectId]);

  const handleCreateTimeEntry = async () => {
    if (!newTimeEntry.hours) return;
    setSaving(true);
    try {
      await apiCreateTimeEntry({ 
        ...newTimeEntry, 
        project_id: projectId, 
        user_id: userId, 
        hours: Number(newTimeEntry.hours) 
      }, token);
      setNewTimeEntry({ 
        task_id: '', 
        hours: '', 
        date: new Date().toISOString().split('T')[0], 
        note: '' 
      });
      setShowNewTimeEntry(false);
      await loadTimeEntries();
      addNotification('Время записано', 'success');
    } catch (err: any) {
      addNotification(`Ошибка: ${err.message || 'не удалось сохранить время'}`, 'warning');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Учёт рабочего времени</div>
        <button className="btn btn-primary" onClick={() => setShowNewTimeEntry(true)}>+ Записать время</button>
      </div>

      {(isGip || isLead) && timeEntries.length > 0 && (() => {
        const byUser: Record<string, number> = {};
        for (const e of timeEntries) { 
          const u = getUserById(e.user_id); 
          const n = u?.full_name || 'Неизвестный'; 
          byUser[n] = (byUser[n] || 0) + Number(e.hours); 
        }
        return (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            {Object.entries(byUser).sort((a, b) => b[1] - a[1]).map(([name, hours]) => (
              <div key={name} style={{ background: C.surface, borderRadius: 10, padding: '10px 16px', border: `1px solid ${C.border}`, boxShadow: 'var(--card-shadow)' }}>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>{name}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.accent }}>{hours} ч</div>
              </div>
            ))}
          </div>
        );
      })()}

      {timeEntries.length === 0 && !showNewTimeEntry && <div className="empty-state" style={{ padding: 40 }}>Записей пока нет</div>}
      
      {timeEntries.length > 0 && (
        <div style={{ overflowX: 'auto', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: 'var(--card-shadow)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['Дата', 'Сотрудник', 'Задача', 'Часов', 'Примечание'].map(h => (
                <th key={h} style={{ textAlign: 'left' as const, padding: '8px 10px', color: C.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' as const }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {timeEntries.map(e => {
                const u = getUserById(e.user_id);
                const task = allTasks.find(t => String(t.id) === String(e.task_id));
                return (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}20` }}>
                    <td style={{ padding: '9px 10px', color: C.textMuted }}>{e.date}</td>
                    <td style={{ padding: '9px 10px', color: C.text }}>{u?.full_name || '—'}</td>
                    <td style={{ padding: '9px 10px', color: C.text, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task?.name || '—'}</td>
                    <td style={{ padding: '9px 10px', color: C.accent, fontWeight: 700 }}>{e.hours} ч</td>
                    <td style={{ padding: '9px 10px', color: C.textMuted }}>{e.note || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNewTimeEntry && (
        <div style={{ background: C.surface, borderRadius: 14, padding: 20, border: `1px solid ${C.accent}40`, marginTop: 12, boxShadow: 'var(--card-shadow)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 12 }}>Записать время</div>
          <div className="form-stack">
            <Field label="ДАТА * (ДД.ММ.ГГГГ)" C={C}><RuDateInput value={newTimeEntry.date} onChange={(v) => setNewTimeEntry({...newTimeEntry, date: v})} C={C} /></Field>
            <Field label="ЗАДАЧА" C={C}>
              <select value={newTimeEntry.task_id} onChange={e => setNewTimeEntry({...newTimeEntry, task_id: e.target.value})} style={getInp(C)}>
                <option value="">— выберите задачу (необязательно) —</option>
                {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="ЧАСОВ *" C={C}><input type="number" min="0.5" max="24" step="0.5" value={newTimeEntry.hours} onChange={e => setNewTimeEntry({...newTimeEntry, hours: e.target.value})} placeholder="8" style={getInp(C)} /></Field>
            <Field label="ПРИМЕЧАНИЕ" C={C}><input value={newTimeEntry.note} onChange={e => setNewTimeEntry({...newTimeEntry, note: e.target.value})} placeholder="Разработка принципиальной схемы" style={getInp(C)} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" onClick={handleCreateTimeEntry} disabled={saving || !newTimeEntry.hours}>Сохранить</button>
            <button className="btn" onClick={() => setShowNewTimeEntry(false)} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: '8px 18px', cursor: 'pointer' }}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelogPanel;
