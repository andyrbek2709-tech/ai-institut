import React, { useState, useEffect } from 'react';
import { listMeetings, createMeeting as apiCreateMeeting } from '../api/supabase';
import { Modal, Field, getInp } from './ui';
import { exportMeetingPdf } from '../utils/export';

interface MeetingsPanelProps {
  projectId: number;
  projectName: string;
  isGip: boolean;
  isLead: boolean;
  C: any;
  token: string;
  userId: string;
  addNotification: (msg: string, type: any) => void;
}

const MeetingsPanel: React.FC<MeetingsPanelProps> = ({ 
  projectId, 
  projectName,
  isGip, 
  isLead, 
  C, 
  token, 
  userId,
  addNotification 
}) => {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [newMeeting, setNewMeeting] = useState({ title: '', meeting_date: '', participants: '', agenda: '', decisions: '' });
  const [saving, setSaving] = useState(false);

  const loadMeetings = async () => {
    const data = await listMeetings(projectId, token);
    if (Array.isArray(data)) setMeetings(data);
  };

  useEffect(() => {
    loadMeetings();
  }, [projectId]);

  const handleCreateMeeting = async () => {
    if (!newMeeting.title) return;
    setSaving(true);
    try {
      await apiCreateMeeting({ ...newMeeting, project_id: projectId, created_by: userId }, token);
      setNewMeeting({ title: '', meeting_date: '', participants: '', agenda: '', decisions: '' });
      setShowNewMeeting(false);
      await loadMeetings();
      addNotification('Протокол создан', 'success');
    } catch (err) {
      addNotification('Ошибка при создании протокола', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Протоколы совещаний</div>
        {(isGip || isLead) && <button className="btn btn-primary" onClick={() => setShowNewMeeting(true)}>+ Новый протокол</button>}
      </div>
      
      {meetings.length === 0 && !showNewMeeting && <div className="empty-state" style={{ padding: 40 }}>Протоколов пока нет</div>}
      
      {meetings.map(m => (
        <div key={m.id} style={{ background: C.surface, borderRadius: 14, padding: 16, marginBottom: 10, border: `1px solid ${C.border}`, boxShadow: 'var(--card-shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{m.title}</div>
            <button onClick={() => exportMeetingPdf(m, projectName)} title="Экспорт в PDF" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.textMuted, padding: '0 4px' }}>🖨</button>
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
            {m.meeting_date ? `📅 ${new Date(m.meeting_date + 'T00:00:00').toLocaleDateString('ru-RU')}` : ''}
            {m.participants ? ` · 👥 ${m.participants}` : ''}
          </div>
          {m.agenda && <div style={{ fontSize: 13, color: C.text, marginBottom: 6 }}><span style={{ color: C.textMuted, fontWeight: 600 }}>Повестка:</span> {m.agenda}</div>}
          {m.decisions && <div style={{ fontSize: 13, color: C.text }}><span style={{ color: C.textMuted, fontWeight: 600 }}>Решения:</span> {m.decisions}</div>}
        </div>
      ))}

      {showNewMeeting && (
        <div style={{ background: C.surface, borderRadius: 14, padding: 20, border: `1px solid ${C.accent}40`, marginTop: 8, boxShadow: 'var(--card-shadow)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 12 }}>Новый протокол</div>
          <div className="form-stack">
            <Field label="ТЕМА *" C={C}><input value={newMeeting.title} onChange={e => setNewMeeting({...newMeeting, title: e.target.value})} placeholder="Совещание по проекту" style={getInp(C)} /></Field>
            <Field label="ДАТА" C={C}><input type="date" value={newMeeting.meeting_date} onChange={e => setNewMeeting({...newMeeting, meeting_date: e.target.value})} style={getInp(C)} /></Field>
            <Field label="УЧАСТНИКИ" C={C}><input value={newMeeting.participants} onChange={e => setNewMeeting({...newMeeting, participants: e.target.value})} placeholder="Иванов, Петров, Сидоров" style={getInp(C)} /></Field>
            <Field label="ПОВЕСТКА" C={C}><textarea value={newMeeting.agenda} onChange={e => setNewMeeting({...newMeeting, agenda: e.target.value})} rows={2} placeholder="Рассмотрение хода проекта..." style={{...getInp(C), resize: 'vertical' as const}} /></Field>
            <Field label="РЕШЕНИЯ / ПОРУЧЕНИЯ" C={C}><textarea value={newMeeting.decisions} onChange={e => setNewMeeting({...newMeeting, decisions: e.target.value})} rows={3} placeholder="Инженеру Иванову — выпустить ОВ-001 до 01.05..." style={{...getInp(C), resize: 'vertical' as const}} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" onClick={handleCreateMeeting} disabled={saving || !newMeeting.title}>Сохранить</button>
            <button className="btn" onClick={() => setShowNewMeeting(false)} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: '8px 18px', cursor: 'pointer' }}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingsPanel;
