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

  // ── Приглашение участника ──
  const [showInvite, setShowInvite] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteSending, setInviteSending] = useState<string | null>(null); // user id being sent
  const inviteRef = useRef<HTMLDivElement>(null);

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

    setPhase('transcribing'); setStatusMsg('Сохраняю запись…');
    const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
    const filename = `${projectId}/${Date.now()}.${ext}`;
    let recordingUrl = '';
    try {
      const uploadRes = await fetch(`${SURL}/storage/v1/object/meeting-recordings/${filename}`, {
        method: 'POST',
        headers: {
          apikey: ANON,
          Authorization: `Bearer ${token}`,
          'Content-Type': mimeType,
          'x-upsert': 'true',
        },
        body: audioBlob,
      });
      if (uploadRes.ok) {
        // Подписанный URL на 1 год для скачивания
        const signRes = await fetch(`${SURL}/storage/v1/object/sign/meeting-recordings/${filename}`, {
          method: 'POST',
          headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ expiresIn: 31536000 }),
        });
        if (signRes.ok) {
          const signData = await signRes.json();
          recordingUrl = `${SURL}/storage/v1${signData.signedURL}`;
        }
      }
    } catch { /* не блокирует — запись необязательна */ }

    setStatusMsg('Транскрибирую (Whisper)…');
    let transcript = '';
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });
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
        transcript,
        ...(recordingUrl ? { recording_url: recordingUrl } : {}),
      }, token);
    } catch (err: any) { setPhase('error'); setErrorMsg(`Не сохранилось: ${err.message}`); return; }

    setPhase('done');
    addNotification('Протокол сохранён' + (recordingUrl ? ' · запись сохранена' : ''), 'success');
    setProtocolsKey(k => k + 1);
  }, [projectId, projectName, selectedParticipants, token, userId, addNotification, SURL, ANON]);

  const resetRecorder = () => {
    setPhase('idle'); setElapsed(0); setErrorMsg(''); setStatusMsg('');
    chunksRef.current = [];
    setShowRecord(false);
  };

  // ── Закрыть invite-dropdown при клике вне ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inviteRef.current && !inviteRef.current.contains(e.target as Node)) setShowInvite(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Отправить приглашение пользователю ──
  const sendInvite = async (targetUser: any) => {
    if (!SURL || !ANON) return;
    setInviteSending(String(targetUser.id));
    const fromName = (currentUser as any)?.full_name || 'Участник';
    try {
      await fetch(`${SURL}/rest/v1/notifications`, {
        method: 'POST',
        headers: { ...supaHeaders(token), Prefer: 'return=minimal' } as any,
        body: JSON.stringify([{
          user_id: Number(targetUser.id),
          project_id: projectId,
          type: 'meeting_invite',
          title: 'Приглашение на совещание',
          body: `${fromName} зовёт вас на совещание: «${projectName}»`,
          entity_type: 'meeting_invite',
          entity_id: String(projectId),
          is_read: false,
        }]),
      });
      addNotification(`Приглашение отправлено: ${targetUser.full_name}`, 'success');
    } catch {
      addNotification('Не удалось отправить приглашение', 'error');
    }
    setInviteSending(null);
    setShowInvite(false);
    setInviteSearch('');
  };

  const tabBtnStyle = (active: boolean) => ({
    padding: '7px 18px', borderRadius: 8,
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? C.accent + '20' : 'transparent',
    color: active ? C.accent : C.textMuted,
    fontWeight: active ? 700 : 400,
    cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
  });

  // Запись доступна в любой фазе (не только в активном Jitsi-совещании)
  const canRecord = subTab === 'meeting' && meetPhase !== 'loading';

  return (
    <div className="screen-fade">
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button style={tabBtnStyle(subTab === 'meeting')} onClick={() => setSubTab('meeting')}>
          🗣 Совещание
        </button>
        <button style={tabBtnStyle(subTab === 'protocols')} onClick={() => { setSubTab('protocols'); if (phase === 'done') resetRecorder(); }}>
          🗒 Протоколы
        </button>

        {/* Кнопка записи — доступна всегда (в т.ч. без Jitsi-сессии) */}
        {canRecord && phase === 'idle' && !showRecord && (
          <button onClick={() => setShowRecord(true)} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, border: `1px solid #e53935`, background: 'rgba(229,57,53,0.08)', color: '#e53935', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
            🎙 Записать протокол
          </button>
        )}
        {canRecord && phase === 'requesting' && (
          <div style={{ marginLeft: 'auto', fontSize: 12, color: C.textMuted }}>⏳ Запрос микрофона…</div>
        )}
        {canRecord && phase === 'recording' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#e53935', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e53935', display: 'inline-block', animation: 'float-pulse 1.2s ease-in-out infinite' }} />
              {formatTimer(elapsed)}
            </span>
            <button onClick={stopAndGenerate} style={{ padding: '6px 14px', borderRadius: 8, background: '#e53935', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
              ⬛ Стоп + Протокол
            </button>
          </div>
        )}
        {canRecord && (phase === 'transcribing' || phase === 'generating') && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textMuted }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid', borderColor: `${C.accent} transparent`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            {statusMsg}
          </div>
        )}
        {canRecord && phase === 'done' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#2ac769', fontWeight: 600 }}>✓ Протокол сохранён</span>
            <button onClick={() => { resetRecorder(); setSubTab('protocols'); }} style={{ fontSize: 11, padding: '3px 8px', background: C.accent + '20', border: `1px solid ${C.accent}`, color: C.accent, borderRadius: 6, cursor: 'pointer' }}>Смотреть</button>
            <button onClick={resetRecorder} style={{ fontSize: 11, color: C.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        )}
        {canRecord && phase === 'error' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#ef4444' }}>⚠ {errorMsg}</span>
            <button onClick={resetRecorder} style={{ fontSize: 11, color: C.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        )}
        {/* Завершить / Покинуть совещание */}
        {subTab === 'meeting' && meetPhase === 'meeting' && phase !== 'recording' && (
          <button
            onClick={isOrganizer ? endMeeting : () => { setMeetPhase('lobby'); }}
            style={{ marginLeft: (phase === 'idle' && !showRecord) ? 'auto' : 0, padding: '6px 14px', borderRadius: 8, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {isOrganizer ? '⏹ Завершить совещание' : '↩ Покинуть'}
          </button>
        )}
      </div>

      {/* Панель записи */}
      {canRecord && showRecord && phase === 'idle' && (
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
              {/* Dropdown вызова участника — общий для обоих состояний лобби */}
              {showInvite && (
                <div ref={inviteRef} style={{ position: 'absolute', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 300, minWidth: 280, padding: 12 }}>
                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, fontWeight: 600 }}>Позвать на совещание:</div>
                  <input
                    autoFocus
                    value={inviteSearch}
                    onChange={e => setInviteSearch(e.target.value)}
                    placeholder="Поиск по имени…"
                    style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }}
                  />
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {appUsers
                      .filter(u => String(u.id) !== String(currentUser.id) && (!inviteSearch || u.full_name?.toLowerCase().includes(inviteSearch.toLowerCase())))
                      .map(u => (
                        <div key={u.id}
                          onClick={() => inviteSending !== String(u.id) && sendInvite(u)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, cursor: inviteSending === String(u.id) ? 'default' : 'pointer', transition: 'background 0.12s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = C.surface2; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span style={{ fontSize: 13, flex: 1, color: C.text }}>{u.full_name}</span>
                          <span style={{ fontSize: 11, color: inviteSending === String(u.id) ? C.accent : '#4ade80' }}>
                            {inviteSending === String(u.id) ? 'Отправляю…' : '📞 Позвать'}
                          </span>
                        </div>
                      ))}
                    {appUsers.filter(u => String(u.id) !== String(currentUser.id) && (!inviteSearch || u.full_name?.toLowerCase().includes(inviteSearch.toLowerCase()))).length === 0 && (
                      <div style={{ fontSize: 12, color: C.textMuted, padding: '8px 4px' }}>Никого не найдено</div>
                    )}
                  </div>
                </div>
              )}

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
                      onClick={() => { setMeetPhase('meeting'); onJoinMeeting?.(jitsiRoomName, projectName); }}
                      style={{ padding: '12px 28px', fontSize: 15, fontWeight: 700 }}
                    >
                      {floatingActive ? '↗ Вернуться в окно совещания' : 'Присоединиться к совещанию'}
                    </button>
                    <button
                      onClick={() => setShowInvite(v => !v)}
                      style={{ padding: '12px 20px', fontSize: 14, borderRadius: 10, border: `1px solid ${C.border}`, background: showInvite ? C.surface2 : 'transparent', color: C.text, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      📞 Позвать участника
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
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', position: 'relative' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => onJoinMeeting?.(jitsiRoomName, projectName)}
                  style={{ padding: '10px 24px' }}
                >
                  Открыть окно совещания
                </button>
                <div ref={inviteRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowInvite(v => !v)}
                    style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${C.border}`, background: showInvite ? C.surface2 : 'transparent', color: C.text, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
                  >
                    📞 Позвать участника
                  </button>
                  {showInvite && (
                    <div style={{ position: 'absolute', bottom: '110%', left: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 300, minWidth: 280, padding: 12 }}>
                      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, fontWeight: 600 }}>Позвать на совещание:</div>
                      <input autoFocus value={inviteSearch} onChange={e => setInviteSearch(e.target.value)} placeholder="Поиск по имени…"
                        style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />
                      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {appUsers.filter(u => String(u.id) !== String(currentUser.id) && (!inviteSearch || u.full_name?.toLowerCase().includes(inviteSearch.toLowerCase()))).map(u => (
                          <div key={u.id} onClick={() => inviteSending !== String(u.id) && sendInvite(u)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.12s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = C.surface2; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                            <span style={{ fontSize: 13, flex: 1, color: C.text }}>{u.full_name}</span>
                            <span style={{ fontSize: 11, color: inviteSending === String(u.id) ? C.accent : '#4ade80' }}>{inviteSending === String(u.id) ? 'Отправляю…' : '📞 Позвать'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
