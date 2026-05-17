// MeetingsTabWrapper.tsx
// Одна сессия совещания на проект — хранится в video_meetings.
// Организатор создаёт, остальные присоединяются к той же комнате.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import MeetingsPanel from '../MeetingsPanel';
import ConferenceRoom from './ConferenceRoom';
import { createMeeting as apiCreateMeeting } from '../../api/supabase';

type RecordPhase = 'idle' | 'requesting' | 'recording' | 'transcribing' | 'generating' | 'done' | 'error';
type MeetPhase = 'loading' | 'lobby' | 'meeting';

export interface MeetingsTabWrapperProps {
  project: { id: number | string; name?: string } | null;
  currentUser: { id: number | string; full_name?: string; email?: string; role?: string };
  projectId: number;
  projectName: string;
  isGip: boolean;
  isLead: boolean;
  userId: string;
  appUsers: any[];
  C: any;
  token: string;
  addNotification: (msg: string, type?: any) => void;
  // Плавающее окно — вызывается при входе в совещание
  onJoinMeeting?: (roomName: string, projectName: string) => void;
  onEndMeeting?: () => void;
  floatingActive?: boolean; // совещание уже открыто в плавающем окне
}

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function apiBase(): string {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return process.env.REACT_APP_RAILWAY_API_URL || '';
  }
  return '';
}

function supaHeaders(token: string) {
  const ANON = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
  return { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const MeetingsTabWrapper: React.FC<MeetingsTabWrapperProps> = ({
  project, currentUser, projectId, projectName, isGip, isLead,
  userId, appUsers, C, token, addNotification,
  onJoinMeeting, onEndMeeting, floatingActive,
}) => {
  const [subTab, setSubTab] = useState<'meeting' | 'protocols'>('meeting');
  const [meetPhase, setMeetPhase] = useState<MeetPhase>('loading');
  const [activeMeeting, setActiveMeeting] = useState<any>(null);

  // ── Запись совещания ──
  const [phase, setPhase] = useState<RecordPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [showParticipantDrop, setShowParticipantDrop] = useState(false);
  const [protocolsKey, setProtocolsKey] = useState(0);
  const [showRecord, setShowRecord] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const participantRef = useRef<HTMLDivElement>(null);

  const SURL = process.env.REACT_APP_SUPABASE_URL || '';
  const ANON = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

  // ── Загрузить активное совещание для проекта ──
  const loadActiveMeeting = useCallback(async () => {
    if (!SURL || !ANON) { setMeetPhase('lobby'); return; }
    try {
      const r = await fetch(
        `${SURL}/rest/v1/video_meetings?project_id=eq.${projectId}&ended_at=is.null&order=created_at.desc&limit=1`,
        { headers: { apikey: ANON, Authorization: `Bearer ${token}` } as any }
      );
      const arr = await r.json().catch(() => []);
      setActiveMeeting(Array.isArray(arr) && arr[0] ? arr[0] : null);
    } catch {
      setActiveMeeting(null);
    }
    setMeetPhase('lobby');
  }, [projectId, token, SURL, ANON]);

  useEffect(() => { loadActiveMeeting(); }, [loadActiveMeeting]);

  // ── Real-time: следим за изменениями video_meetings для этого проекта ──
  useEffect(() => {
    if (!SURL || !ANON) return;
    const supa = createClient(SURL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, storageKey: `enghub-vm-rt-${projectId}` },
    });
    const ch = supa
      .channel(`vm-project-${projectId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'video_meetings',
        filter: `project_id=eq.${projectId}`,
      }, () => { loadActiveMeeting(); })
      .subscribe();
    return () => { supa.removeChannel(ch); };
  }, [projectId, token, SURL, ANON, loadActiveMeeting]);

  // ── Начать новое совещание ──
  const startMeeting = async () => {
    if (!SURL || !ANON) return;
    try {
      const r = await fetch(`${SURL}/rest/v1/video_meetings?select=id,title,created_by,started_at,created_at`, {
        method: 'POST',
        headers: { ...supaHeaders(token), Prefer: 'return=representation' } as any,
        body: JSON.stringify([{
          project_id: projectId,
          title: `Совещание: ${projectName}`,
          created_by: Number(userId),
          started_at: new Date().toISOString(),
        }]),
      });
      const arr = await r.json().catch(() => []);
      if (Array.isArray(arr) && arr[0]) {
        setActiveMeeting(arr[0]);
        setMeetPhase('meeting');
        const rn = `eh${arr[0].id.replace(/-/g, '')}`;
        onJoinMeeting?.(rn, projectName);
      } else {
        addNotification('Не удалось создать совещание', 'error');
      }
    } catch (e: any) {
      addNotification(e.message || 'Ошибка', 'error');
    }
  };

  // ── Завершить совещание (только организатор) ──
  const endMeeting = async () => {
    if (!activeMeeting || !SURL || !ANON) return;
    if (!window.confirm('Завершить совещание для всех участников?')) return;
    try {
      await fetch(`${SURL}/rest/v1/video_meetings?id=eq.${activeMeeting.id}`, {
        method: 'PATCH',
        headers: supaHeaders(token) as any,
        body: JSON.stringify({ ended_at: new Date().toISOString() }),
      });
      setActiveMeeting(null);
      setMeetPhase('lobby');
      addNotification('Совещание завершено', 'info');
      onEndMeeting?.();
    } catch (e: any) {
      addNotification(e.message || 'Ошибка', 'error');
    }
  };

  // Имя комнаты Jitsi из UUID совещания — одинаково для всех
  const jitsiRoomName = activeMeeting
    ? `eh${activeMeeting.id.replace(/-/g, '')}`
    : '';

  const isOrganizer = activeMeeting && String(activeMeeting.created_by) === String(userId);

  // ── Запись ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (participantRef.current && !participantRef.current.contains(e.target as Node)) {
        setShowParticipantDrop(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const filteredUsers = appUsers.filter(u =>
    u.full_name?.toLowerCase().includes(participantSearch.toLowerCase()) &&
    !selectedParticipants.includes(u.full_name)
  );

  const startRecording = useCallback(async () => {
    setPhase('requesting'); setErrorMsg('');
    chunksRef.current = [];
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      setPhase('error');
      setErrorMsg('Нет доступа к микрофону. Разрешите доступ в браузере.');
      return;
    }
    streamRef.current = stream;
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.start(1000);
    setPhase('recording');
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
  }, []);

  const stopAndGenerate = useCallback(async () => {
    if (!mediaRecorderRef.current) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    await new Promise<void>(resolve => {
      if (!mediaRecorderRef.current) { resolve(); return; }
      mediaRecorderRef.current.onstop = () => resolve();
      mediaRecorderRef.current.stop();
    });
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    const mimeType = chunksRef.current[0]?.type || 'audio/webm';
    const audioBlob = new Blob(chunksRef.current, { type: mimeType });
    if (audioBlob.size < 1000) { setPhase('error'); setErrorMsg('Запись пустая. Попробуйте снова.'); return; }
    setPhase('transcribing'); setStatusMsg('Транскрибирую (Whisper)…');
    let transcript = '';
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const res = await fetch(`${apiBase()}/api/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ audio_base64: base64, media_type: mimeType, filename: `meeting-${Date.now()}.${ext}` }),
      });
      const data = await res.json();
      if (!data.text) throw new Error(data.error || 'Пустой результат');
      transcript = data.text;
    } catch (err: any) { setPhase('error'); setErrorMsg(`Ошибка транскрипции: ${err.message}`); return; }
    setPhase('generating'); setStatusMsg('Генерирую протокол (AI)…');
    let protocol: any;
    try {
      const res = await fetch(`${apiBase()}/api/generate-protocol`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ transcript, projectName, participants: selectedParticipants, date: new Date().toLocaleDateString('ru-RU') }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Ошибка');
      protocol = data;
    } catch (err: any) { setPhase('error'); setErrorMsg(`Ошибка генерации: ${err.message}`); return; }
    try {
      await apiCreateMeeting({
        project_id: projectId, created_by: userId,
        title: protocol.title || 'Совещание',
        meeting_date: new Date().toISOString().split('T')[0],
        participants: protocol.participants_str || selectedParticipants.join(', '),
        agenda: protocol.agenda || '',
        decisions: protocol.decisions || '',
      }, token);
    } catch (err: any) { setPhase('error'); setErrorMsg(`Не сохранилось: ${err.message}`); return; }
    setPhase('done');
    addNotification('Протокол сохранён', 'success');
    setProtocolsKey(k => k + 1);
  }, [projectId, projectName, selectedParticipants, token, userId, addNotification]);

  const resetRecorder = () => {
    setPhase('idle'); setElapsed(0); setErrorMsg(''); setStatusMsg('');
    chunksRef.current = [];
    setShowRecord(false);
  };

  const tabBtnStyle = (active: boolean) => ({
    padding: '7px 18px', borderRadius: 8,
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? C.accent + '20' : 'transparent',
    color: active ? C.accent : C.textMuted,
    fontWeight: active ? 700 : 400,
    cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
  });

  return (
    <div className="screen-fade">
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <button style={tabBtnStyle(subTab === 'meeting')} onClick={() => setSubTab('meeting')}>
          🗣 Совещание
        </button>
        <button style={tabBtnStyle(subTab === 'protocols')} onClick={() => { setSubTab('protocols'); if (phase === 'done') resetRecorder(); }}>
          🗒 Протоколы
        </button>

        {/* Кнопка записи */}
        {subTab === 'meeting' && meetPhase === 'meeting' && phase === 'idle' && !showRecord && (
          <button onClick={() => setShowRecord(true)} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMuted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            🔴 Записать совещание
          </button>
        )}
        {subTab === 'meeting' && meetPhase === 'meeting' && phase === 'recording' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#e53935', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e53935', display: 'inline-block' }} />
              {formatTimer(elapsed)}
            </span>
            <button onClick={stopAndGenerate} style={{ padding: '6px 12px', borderRadius: 8, background: '#e53935', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              ⬛ Стоп + Протокол
            </button>
          </div>
        )}
        {subTab === 'meeting' && meetPhase === 'meeting' && (phase === 'transcribing' || phase === 'generating') && (
          <div style={{ marginLeft: 'auto', fontSize: 12, color: C.textMuted }}>{statusMsg}</div>
        )}
        {subTab === 'meeting' && meetPhase === 'meeting' && phase === 'done' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#2ac769' }}>✓ Протокол сохранён</span>
            <button onClick={resetRecorder} style={{ fontSize: 11, color: C.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        )}
        {/* Завершить / Покинуть совещание */}
        {subTab === 'meeting' && meetPhase === 'meeting' && (
          <button
            onClick={isOrganizer ? endMeeting : () => { setMeetPhase('lobby'); }}
            style={{ marginLeft: phase === 'idle' && !showRecord ? 'auto' : 0, padding: '6px 14px', borderRadius: 8, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {isOrganizer ? '⏹ Завершить совещание' : '↩ Покинуть'}
          </button>
        )}
      </div>

      {/* Панель записи */}
      {subTab === 'meeting' && meetPhase === 'meeting' && showRecord && phase === 'idle' && (
        <div style={{ background: C.surface, borderRadius: 12, padding: '14px 16px', marginBottom: 12, border: `1px solid ${C.accent}30`, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div ref={participantRef} style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <div style={{ background: C.input || C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, minHeight: 34, display: 'flex', flexWrap: 'wrap', gap: 4, cursor: 'text', padding: '3px 8px', alignItems: 'center' }}
              onClick={() => setShowParticipantDrop(true)}>
              {selectedParticipants.map(name => (
                <span key={name} style={{ background: C.accent + '20', color: C.accent, borderRadius: 6, padding: '1px 6px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                  {name}
                  <span style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setSelectedParticipants(prev => prev.filter(n => n !== name)); }}>×</span>
                </span>
              ))}
              <input value={participantSearch} onChange={e => { setParticipantSearch(e.target.value); setShowParticipantDrop(true); }} onFocus={() => setShowParticipantDrop(true)}
                placeholder={selectedParticipants.length === 0 ? 'Участники (необязательно)…' : ''}
                style={{ border: 'none', outline: 'none', background: 'transparent', color: C.text, fontSize: 12, flex: 1, minWidth: 80 }} />
            </div>
            {showParticipantDrop && filteredUsers.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, zIndex: 200, maxHeight: 160, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', marginTop: 4 }}>
                {filteredUsers.map(u => (
                  <div key={u.id} style={{ padding: '7px 12px', fontSize: 12, color: C.text, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.surface2)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => { setSelectedParticipants(prev => [...prev, u.full_name]); setParticipantSearch(''); setShowParticipantDrop(false); }}>
                    {u.full_name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={startRecording} style={{ fontSize: 13, padding: '7px 16px', whiteSpace: 'nowrap' }}>
            🔴 Начать запись
          </button>
          <button onClick={() => setShowRecord(false)} style={{ fontSize: 12, color: C.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>✕</button>
        </div>
      )}

      {/* ── Совещание ── */}
      {subTab === 'meeting' && (
        <>
          {/* Загрузка */}
          {meetPhase === 'loading' && (
            <div style={{ padding: 60, textAlign: 'center', color: C.textMuted }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
              <div>Проверяю активные совещания…</div>
            </div>
          )}

          {/* Лобби */}
          {meetPhase === 'lobby' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: 400, gap: 20, padding: 32,
            }}>
              {activeMeeting ? (
                /* Совещание уже идёт */
                <div style={{ textAlign: 'center', maxWidth: 420 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🎥</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: C.text, marginBottom: 6 }}>
                    Совещание уже идёт
                  </div>
                  <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 24 }}>
                    Начато {new Date(activeMeeting.started_at || activeMeeting.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setMeetPhase('meeting');
                        onJoinMeeting?.(jitsiRoomName, projectName);
                      }}
                      style={{ padding: '12px 28px', fontSize: 15, fontWeight: 700 }}
                    >
                      {floatingActive ? '↗ Вернуться в окно совещания' : 'Присоединиться к совещанию'}
                    </button>
                    {isOrganizer && (
                      <button
                        onClick={endMeeting}
                        style={{ padding: '12px 20px', fontSize: 14, borderRadius: 10, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        ⏹ Завершить
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Совещаний нет */
                <div style={{ textAlign: 'center', maxWidth: 380 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: C.text, marginBottom: 6 }}>
                    Нет активных совещаний
                  </div>
                  <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 24 }}>
                    Нажмите кнопку — остальные участники проекта смогут присоединиться
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={startMeeting}
                    style={{ padding: '12px 32px', fontSize: 15, fontWeight: 700 }}
                  >
                    Начать совещание
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Активная комната — открыта в плавающем окне */}
          {meetPhase === 'meeting' && activeMeeting && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', minHeight: 320, gap: 16, padding: 32,
              background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444', flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 16, color: C.text }}>Совещание идёт в плавающем окне</span>
              </div>
              <div style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', maxWidth: 360 }}>
                Окно совещания работает поверх всего приложения.<br/>
                Вы можете переходить по разделам — звонок не прервётся.
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => onJoinMeeting?.(jitsiRoomName, projectName)}
                  style={{ padding: '10px 24px' }}
                >
                  Открыть окно совещания
                </button>
                {isOrganizer && (
                  <button onClick={endMeeting} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                    ⏹ Завершить совещание
                  </button>
                )}
                <button onClick={() => { setMeetPhase('lobby'); }} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMuted, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                  ↩ Покинуть
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Протоколы */}
      {subTab === 'protocols' && (
        <MeetingsPanel
          key={protocolsKey}
          projectId={projectId}
          projectName={projectName}
          isGip={isGip}
          isLead={isLead}
          C={C}
          token={token}
          userId={userId}
          appUsers={appUsers}
          addNotification={addNotification}
        />
      )}
    </div>
  );
};

export default MeetingsTabWrapper;
