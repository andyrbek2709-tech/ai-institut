import React, { useState, useEffect, useRef } from 'react';
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
  appUsers: any[];
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
  appUsers,
  addNotification
}) => {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [newMeeting, setNewMeeting] = useState({ title: '', meeting_date: '', participants: '', agenda: '', decisions: '' });
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [showParticipantDrop, setShowParticipantDrop] = useState(false);
  const participantRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (participantRef.current && !participantRef.current.contains(e.target as Node)) {
        setShowParticipantDrop(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
      const participantsStr = selectedParticipants.length > 0 ? selectedParticipants.join(', ') : newMeeting.participants;
      await apiCreateMeeting({ ...newMeeting, participants: participantsStr, project_id: projectId, created_by: userId }, token);
      setNewMeeting({ title: '', meeting_date: '', participants: '', agenda: '', decisions: '' });
      setSelectedParticipants([]);
      setShowNewMeeting(false);
      await loadMeetings();
      addNotification('Протокол создан', 'success');
    } catch (err) {
      addNotification('Ошибка при создании протокола', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = appUsers.filter(u =>
    u.full_name?.toLowerCase().includes(participantSearch.toLowerCase()) &&
    !selectedParticipants.includes(u.full_name)
  );

  const handleTranscribeAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const MAX_SIZE = 25 * 1024 * 1024; // 25 MB Whisper limit
    if (file.size > MAX_SIZE) { addNotification('Файл слишком большой (макс. 25 МБ)', 'warning'); return; }

    setTranscribing(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const apiUrl = window.location.hostname === 'localhost' ? 'https://enghub-three.vercel.app/api/transcribe' : '/api/transcribe';
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_base64: base64, media_type: file.type || 'audio/mpeg', filename: file.name }),
      });
      const data = await res.json();
      if (data.text) {
        setNewMeeting(prev => ({ ...prev, decisions: prev.decisions ? prev.decisions + '\n\n' + data.text : data.text }));
        addNotification('Транскрипция завершена', 'success');
      } else {
        addNotification('Не удалось транскрибировать аудио', 'warning');
      }
    } catch {
      addNotification('Ошибка транскрипции', 'error');
    } finally {
      setTranscribing(false);
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Новый протокол</div>
            <div>
              <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleTranscribeAudio} />
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                disabled={transcribing}
                title="Загрузить аудиозапись совещания — AI транскрибирует и вставит текст в поле Решения"
                style={{ background: '#4a9eff20', border: '1px solid #4a9eff40', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#4a9eff', fontFamily: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {transcribing ? '⏳ Транскрипция…' : '🎙 AI Транскрипция'}
              </button>
            </div>
          </div>
          <div className="form-stack">
            <Field label="ТЕМА *" C={C}><input value={newMeeting.title} onChange={e => setNewMeeting({...newMeeting, title: e.target.value})} placeholder="Совещание по проекту" style={getInp(C)} /></Field>
            <Field label="ДАТА" C={C}><input type="date" value={newMeeting.meeting_date} onChange={e => setNewMeeting({...newMeeting, meeting_date: e.target.value})} style={getInp(C)} /></Field>
            <Field label="УЧАСТНИКИ" C={C}>
              <div ref={participantRef} style={{ position: 'relative' }}>
                <div
                  style={{ ...getInp(C), minHeight: 38, display: 'flex', flexWrap: 'wrap', gap: 4, cursor: 'text', padding: '4px 8px' }}
                  onClick={() => setShowParticipantDrop(true)}
                >
                  {selectedParticipants.map(name => (
                    <span key={name} style={{ background: C.accent + '20', color: C.accent, borderRadius: 6, padding: '2px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {name}
                      <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={e => { e.stopPropagation(); setSelectedParticipants(prev => prev.filter(n => n !== name)); }}>×</span>
                    </span>
                  ))}
                  <input
                    value={participantSearch}
                    onChange={e => { setParticipantSearch(e.target.value); setShowParticipantDrop(true); }}
                    onFocus={() => setShowParticipantDrop(true)}
                    placeholder={selectedParticipants.length === 0 ? 'Выбрать участников...' : ''}
                    style={{ border: 'none', outline: 'none', background: 'transparent', color: C.text, fontSize: 13, flex: 1, minWidth: 80 }}
                  />
                </div>
                {showParticipantDrop && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, zIndex: 100, maxHeight: 180, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', marginTop: 4 }}>
                    {filteredUsers.length === 0
                      ? <div style={{ padding: '10px 14px', fontSize: 12, color: C.textMuted }}>Нет совпадений</div>
                      : filteredUsers.map(u => (
                        <div key={u.id} style={{ padding: '8px 14px', fontSize: 13, color: C.text, cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.surface2)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          onClick={() => { setSelectedParticipants(prev => [...prev, u.full_name]); setParticipantSearch(''); }}
                        >
                          {u.full_name} <span style={{ fontSize: 11, color: C.textMuted }}>· {u.position || u.role}</span>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </Field>
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
