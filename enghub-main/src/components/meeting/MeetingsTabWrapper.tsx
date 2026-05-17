import React, { useCallback, useEffect, useRef, useState } from 'react';
import MeetingsPanel from '../MeetingsPanel';
import { createMeeting as apiCreateMeeting } from '../../api/supabase';

type RecordPhase = 'idle' | 'requesting' | 'recording' | 'transcribing' | 'generating' | 'done' | 'error';

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

// Открывает Jitsi в новой вкладке с отключённым лобби
function openJitsi(projectId: number, projectName: string, userName: string) {
  const roomName = `enghub-project-${projectId}`;
  const displayName = encodeURIComponent(userName || 'Участник');
  const subject = encodeURIComponent(projectName || 'Совещание');
  const url = [
    `https://meet.jit.si/${roomName}`,
    `#config.prejoinPageEnabled=false`,
    `&config.lobby.enabled=false`,
    `&config.startWithAudioMuted=false`,
    `&config.startWithVideoMuted=false`,
    `&config.disableModeratorIndicator=false`,
    `&config.subject="${subject}"`,
    `&userInfo.displayName="${displayName}"`,
  ].join('');
  window.open(url, '_blank', 'noopener');
}

const MeetingsTabWrapper: React.FC<MeetingsTabWrapperProps> = ({
  project,
  currentUser,
  projectId,
  projectName,
  isGip,
  isLead,
  userId,
  appUsers,
  C,
  token,
  addNotification,
}) => {
  const [subTab, setSubTab] = useState<'meeting' | 'protocols'>('meeting');
  const [phase, setPhase] = useState<RecordPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [showParticipantDrop, setShowParticipantDrop] = useState(false);
  const [protocolsKey, setProtocolsKey] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const participantRef = useRef<HTMLDivElement>(null);

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
    setPhase('requesting');
    setErrorMsg('');
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      setPhase('error');
      setErrorMsg('Нет доступа к микрофону. Разрешите доступ в браузере и попробуйте снова.');
      return;
    }

    streamRef.current = stream;
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
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

    if (audioBlob.size < 1000) {
      setPhase('error');
      setErrorMsg('Запись слишком короткая или пустая. Попробуйте снова.');
      return;
    }

    setPhase('transcribing');
    setStatusMsg('Транскрибирую запись (Whisper)…');

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
      if (!data.text) throw new Error(data.error || 'Транскрипция не вернула текст');
      transcript = data.text;
    } catch (err: any) {
      setPhase('error');
      setErrorMsg(`Ошибка транскрипции: ${err.message}`);
      return;
    }

    setPhase('generating');
    setStatusMsg('Генерирую протокол (AI)…');

    let protocol: any;
    try {
      const res = await fetch(`${apiBase()}/api/generate-protocol`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ transcript, projectName, participants: selectedParticipants, date: new Date().toLocaleDateString('ru-RU') }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Ошибка генерации');
      protocol = data;
    } catch (err: any) {
      setPhase('error');
      setErrorMsg(`Ошибка генерации протокола: ${err.message}`);
      return;
    }

    try {
      await apiCreateMeeting({
        project_id: projectId,
        created_by: userId,
        title: protocol.title || 'Совещание',
        meeting_date: new Date().toISOString().split('T')[0],
        participants: protocol.participants_str || selectedParticipants.join(', '),
        agenda: protocol.agenda || '',
        decisions: protocol.decisions || '',
      }, token);
    } catch (err: any) {
      setPhase('error');
      setErrorMsg(`Протокол сгенерирован, но не сохранён: ${err.message}`);
      return;
    }

    setPhase('done');
    setStatusMsg('');
    addNotification('Протокол совещания сохранён', 'success');
    setProtocolsKey(k => k + 1);
  }, [projectId, projectName, selectedParticipants, token, userId, addNotification]);

  const resetRecorder = () => {
    setPhase('idle');
    setElapsed(0);
    setErrorMsg('');
    setStatusMsg('');
    chunksRef.current = [];
  };

  const tabBtnStyle = (active: boolean) => ({
    padding: '7px 18px',
    borderRadius: 8,
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? C.accent + '20' : 'transparent',
    color: active ? C.accent : C.textMuted,
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  });

  const userName = (currentUser as any)?.full_name || (currentUser as any)?.email || 'Участник';

  return (
    <div className="screen-fade">
      {/* Sub-tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button style={tabBtnStyle(subTab === 'meeting')} onClick={() => setSubTab('meeting')}>
          🗣 Совещание
        </button>
        <button style={tabBtnStyle(subTab === 'protocols')} onClick={() => { setSubTab('protocols'); if (phase === 'done') resetRecorder(); }}>
          🗒 Протоколы
        </button>
      </div>

      {subTab === 'meeting' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── БЛОК 1: Видеозвонок ── */}
          <div style={{ background: C.surface, borderRadius: 14, padding: 20, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Видеозвонок
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={() => openJitsi(projectId, projectName, userName)}
                style={{ fontSize: 14, padding: '10px 22px', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                📹 Начать видеозвонок
              </button>
              <div style={{ fontSize: 12, color: C.textMuted, flex: 1 }}>
                Откроется в новой вкладке. Комната привязана к проекту — все участники заходят по той же кнопке.
              </div>
            </div>
          </div>

          {/* ── БЛОК 2: Запись + AI протокол ── */}
          <div style={{ background: C.surface, borderRadius: 14, padding: 20, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Запись → AI протокол
            </div>

            {/* Участники */}
            {phase === 'idle' && (
              <div style={{ marginBottom: 14 }}>
                <div ref={participantRef} style={{ position: 'relative' }}>
                  <div
                    style={{ background: C.input || C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, minHeight: 38, display: 'flex', flexWrap: 'wrap', gap: 4, cursor: 'text', padding: '4px 8px' }}
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
                      placeholder={selectedParticipants.length === 0 ? 'Участники совещания (необязательно)…' : ''}
                      style={{ border: 'none', outline: 'none', background: 'transparent', color: C.text, fontSize: 13, flex: 1, minWidth: 120 }}
                    />
                  </div>
                  {showParticipantDrop && filteredUsers.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, zIndex: 100, maxHeight: 180, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', marginTop: 4 }}>
                      {filteredUsers.map(u => (
                        <div key={u.id}
                          style={{ padding: '8px 14px', fontSize: 13, color: C.text, cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.surface2)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          onClick={() => { setSelectedParticipants(prev => [...prev, u.full_name]); setParticipantSearch(''); setShowParticipantDrop(false); }}
                        >
                          {u.full_name} <span style={{ fontSize: 11, color: C.textMuted }}>· {u.position || u.role}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Состояния записи */}
            <div style={{ textAlign: 'center', padding: '16px 0' }}>

              {phase === 'idle' && (
                <button className="btn btn-primary" onClick={startRecording} style={{ fontSize: 14, padding: '10px 24px' }}>
                  🔴 Начать запись
                </button>
              )}

              {phase === 'requesting' && (
                <div style={{ color: C.textMuted, fontSize: 14 }}>🎤 Запрашиваю доступ к микрофону…</div>
              )}

              {phase === 'recording' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e53935', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                    <span style={{ fontSize: 13, color: '#e53935', fontWeight: 600 }}>ИДЁТ ЗАПИСЬ</span>
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: C.text, fontFamily: 'monospace', marginBottom: 16 }}>
                    {formatTimer(elapsed)}
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button className="btn btn-primary" onClick={stopAndGenerate} style={{ fontSize: 13, background: '#e53935', border: 'none' }}>
                      ⬛ Стоп — создать протокол
                    </button>
                    <button onClick={() => {
                      if (timerRef.current) clearInterval(timerRef.current);
                      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
                      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
                      resetRecorder();
                    }} style={{ fontSize: 13, padding: '8px 16px', color: C.textMuted, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer' }}>
                      Отмена
                    </button>
                  </div>
                </div>
              )}

              {(phase === 'transcribing' || phase === 'generating') && (
                <div>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>{phase === 'transcribing' ? '🔄' : '🤖'}</div>
                  <div style={{ fontSize: 14, color: C.textMuted }}>{statusMsg}</div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>10–30 секунд…</div>
                </div>
              )}

              {phase === 'done' && (
                <div>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Протокол сохранён!</div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
                    <button className="btn btn-primary" onClick={() => { setSubTab('protocols'); resetRecorder(); }}>Открыть протоколы →</button>
                    <button onClick={resetRecorder} style={{ fontSize: 13, padding: '8px 16px', color: C.textMuted, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer' }}>Новая запись</button>
                  </div>
                </div>
              )}

              {phase === 'error' && (
                <div>
                  <div style={{ fontSize: 13, color: '#e53935', marginBottom: 12, maxWidth: 360, margin: '0 auto 12px' }}>{errorMsg}</div>
                  <button className="btn btn-primary" onClick={resetRecorder}>Попробовать снова</button>
                </div>
              )}
            </div>
          </div>

          {/* Подсказка */}
          <div style={{ padding: '10px 14px', background: C.accent + '10', borderRadius: 10, fontSize: 12, color: C.textMuted, display: 'flex', gap: 8 }}>
            <span>💡</span>
            <span>Нажмите «📹 Начать видеозвонок» — все участники проекта подключаются к одной комнате. Параллельно можно включить запись для автоматического протокола.</span>
          </div>
        </div>
      )}

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
