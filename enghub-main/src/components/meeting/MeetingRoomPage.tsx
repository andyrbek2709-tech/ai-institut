// src/components/meeting/MeetingRoomPage.tsx
// Главная «страница» видеовстречи. Управляет фазами loading → lobby → meeting,
// сама подключается к LiveKit, оборачивает MeetingUI в LiveKitRoom.
//
// Интегрируется в App.tsx так: открыта вкладка conference у проекта →
// сначала компонент находит/создаёт активную video_meetings строку для проекта,
// потом запрашивает токен у /api/meeting-token и поднимает комнату.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LiveKitRoom as RawLiveKitRoom, RoomAudioRenderer as RawRoomAudioRenderer } from '@livekit/components-react';
const LiveKitRoom = RawLiveKitRoom as unknown as React.FC<any>;
const RoomAudioRenderer = RawRoomAudioRenderer as unknown as React.FC<any>;
import '@livekit/components-styles';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../api/supabaseClient';
import { Mic, MicOff, Video, VideoOff, Loader2 } from 'lucide-react';
import { MeetingUI, type MeetingChatMessage } from './MeetingUI';

// ── Props ────────────────────────────────────────────────────────────────

export interface MeetingRoomPageProps {
  C: any;                                    // тема EngHub
  project: { id: number | string; name?: string } | null;
  currentUser: { id: number | string; full_name?: string; email?: string; role?: string };
  token: string;                             // Supabase access_token (Bearer)
  addNotification?: (msg: string, type?: any) => void;
}

// ── Состояние компонента ────────────────────────────────────────────────

type Phase = 'loading' | 'error' | 'lobby' | 'meeting';

interface LoadedMeeting {
  meetingId: string;
  meetingTitle: string;
  startedAt: string | null;
  liveKitUrl: string;
  liveKitToken: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function apiBase(): string {
  // Локальный dev на CRA не имеет /api — переадресовываем на прод-функции,
  // как уже делает MeetingsPanel.tsx (см. вызов /api/transcribe).
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'https://enghub-three.vercel.app';
  }
  return '';
}

async function ensureMeeting(opts: {
  projectId: string | number | null;
  userId: string | number;
  authToken: string;
}): Promise<{ id: string; title: string } | null> {
  // Ищем активную (ended_at IS NULL) встречу проекта; если её нет — создаём.
  // Делаем это через прямой Supabase REST (анон-ключ + Bearer пользователя),
  // потому что сервер уже валидирует доступ через RLS.
  const SURL = process.env.REACT_APP_SUPABASE_URL || '';
  const ANON = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
  if (!SURL || !ANON) return null;

  const headers: any = {
    apikey: ANON,
    Authorization: `Bearer ${opts.authToken}`,
    'Content-Type': 'application/json',
  };

  // 1) Активная встреча для этого проекта (если projectId задан)
  if (opts.projectId !== null && opts.projectId !== undefined) {
    const q = `${SURL}/rest/v1/video_meetings?project_id=eq.${encodeURIComponent(String(opts.projectId))}` +
              `&ended_at=is.null&order=created_at.desc&limit=1`;
    const r = await fetch(q, { headers });
    if (r.ok) {
      const arr = await r.json().catch(() => []);
      if (Array.isArray(arr) && arr[0]) return { id: arr[0].id, title: arr[0].title };
    }
  }

  // 2) Создаём новую
  const ins = await fetch(`${SURL}/rest/v1/video_meetings?select=id,title`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify([{
      project_id: opts.projectId !== null && opts.projectId !== undefined ? Number(opts.projectId) || null : null,
      title: 'Видеовстреча',
      created_by: Number(opts.userId) || null,
      started_at: new Date().toISOString(),
    }]),
  });
  if (!ins.ok) return null;
  const arr = await ins.json().catch(() => []);
  return Array.isArray(arr) && arr[0] ? { id: arr[0].id, title: arr[0].title } : null;
}

async function fetchToken(meetingId: string, authToken: string): Promise<{
  url: string; token: string; meetingTitle: string; startedAt: string | null;
}> {
  const r = await fetch(`${apiBase()}/api/meeting-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ meetingId }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error((data && data.error) || `HTTP ${r.status}`);
  }
  const data = await r.json();
  return {
    url: data.url,
    token: data.token,
    meetingTitle: data.meetingTitle || 'Видеовстреча',
    startedAt: data.startedAt || null,
  };
}

async function loadChat(meetingId: string, authToken: string): Promise<MeetingChatMessage[]> {
  const SURL = process.env.REACT_APP_SUPABASE_URL || '';
  const ANON = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
  if (!SURL || !ANON) return [];
  const r = await fetch(
    `${SURL}/rest/v1/video_meeting_chat_messages?meeting_id=eq.${encodeURIComponent(meetingId)}&order=created_at.asc&limit=200`,
    { headers: { apikey: ANON, Authorization: `Bearer ${authToken}` } as any }
  );
  if (!r.ok) return [];
  const arr = await r.json().catch(() => []);
  return Array.isArray(arr) ? arr : [];
}

// ── Компонент ────────────────────────────────────────────────────────────

const MeetingRoomPage: React.FC<MeetingRoomPageProps> = ({ C, project, currentUser, token, addNotification }) => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string>('');
  const [meeting, setMeeting] = useState<LoadedMeeting | null>(null);
  const [chat, setChat] = useState<MeetingChatMessage[]>([]);

  // Лобби: предварительный выбор устройств
  const [lobbyMic, setLobbyMic] = useState(true);
  const [lobbyCam, setLobbyCam] = useState(false);
  const [lobbyAudioOk, setLobbyAudioOk] = useState<boolean | null>(null);
  const lobbyVideoRef = useRef<HTMLVideoElement>(null);
  const lobbyStreamRef = useRef<MediaStream | null>(null);

  // Подгружаем встречу + токен
  const loadAll = useCallback(async () => {
    setPhase('loading'); setError('');
    try {
      if (!currentUser?.id) throw new Error('Не определён текущий пользователь');
      const ensured = await ensureMeeting({
        projectId: project?.id ?? null,
        userId: currentUser.id,
        authToken: token,
      });
      if (!ensured) throw new Error('Не удалось создать или найти встречу');
      const tk = await fetchToken(ensured.id, token);
      setMeeting({
        meetingId: ensured.id,
        meetingTitle: tk.meetingTitle || ensured.title || 'Видеовстреча',
        startedAt: tk.startedAt,
        liveKitUrl: tk.url,
        liveKitToken: tk.token,
      });
      setChat(await loadChat(ensured.id, token));
      setPhase('lobby');
    } catch (e: any) {
      setError(String(e && e.message || e));
      setPhase('error');
    }
  }, [project?.id, currentUser?.id, token]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Лобби: предпросмотр камеры
  useEffect(() => {
    if (phase !== 'lobby') return;
    let cancelled = false;
    (async () => {
      try {
        if (lobbyCam) {
          const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
          lobbyStreamRef.current = s;
          if (lobbyVideoRef.current) lobbyVideoRef.current.srcObject = s;
        } else {
          if (lobbyStreamRef.current) {
            lobbyStreamRef.current.getTracks().forEach((t) => t.stop());
            lobbyStreamRef.current = null;
          }
          if (lobbyVideoRef.current) lobbyVideoRef.current.srcObject = null;
        }
      } catch {
        setLobbyCam(false);
      }
    })();
    return () => { cancelled = true; };
  }, [phase, lobbyCam]);

  // Лобби: проверка микрофона
  useEffect(() => {
    if (phase !== 'lobby' || !lobbyMic) { setLobbyAudioOk(null); return; }
    let cancelled = false;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (!cancelled) setLobbyAudioOk(true);
      } catch {
        if (!cancelled) setLobbyAudioOk(false);
      }
    })();
    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [phase, lobbyMic]);

  // Чистим лобби-поток при уходе
  useEffect(() => () => {
    if (lobbyStreamRef.current) {
      lobbyStreamRef.current.getTracks().forEach((t) => t.stop());
      lobbyStreamRef.current = null;
    }
  }, []);

  // ── Real-time подписка на чат во время встречи ──
  useEffect(() => {
    if (phase !== 'meeting' || !meeting) return;
    const SURL = process.env.REACT_APP_SUPABASE_URL || '';
    const ANON = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
    if (!SURL || !ANON) return;
    const supa = createClient(SURL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const ch = supa
      .channel(`vmcm:${meeting.meetingId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'video_meeting_chat_messages', filter: `meeting_id=eq.${meeting.meetingId}` },
        (payload: any) => {
          const m = payload.new as MeetingChatMessage;
          setChat((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      )
      .subscribe();
    return () => { supa.removeChannel(ch); };
  }, [phase, meeting, token]);

  // ── Действия ──
  const enterMeeting = useCallback(() => {
    // Останавливаем лобби-камеру (LiveKit поднимет свою)
    if (lobbyStreamRef.current) {
      lobbyStreamRef.current.getTracks().forEach((t) => t.stop());
      lobbyStreamRef.current = null;
    }
    setPhase('meeting');
  }, []);

  const sendChat = useCallback(async (text: string) => {
    if (!meeting || !text.trim()) return;
    const SURL = process.env.REACT_APP_SUPABASE_URL || '';
    const ANON = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
    if (!SURL || !ANON) return;
    const headers: any = {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };
    const r = await fetch(`${SURL}/rest/v1/video_meeting_chat_messages?select=*`, {
      method: 'POST',
      headers,
      body: JSON.stringify([{
        meeting_id: meeting.meetingId,
        user_id: Number(currentUser.id),
        user_name: currentUser.full_name || currentUser.email || `user-${currentUser.id}`,
        message: text,
      }]),
    });
    if (r.ok) {
      const arr = await r.json().catch(() => []);
      if (Array.isArray(arr) && arr[0]) {
        const m = arr[0] as MeetingChatMessage;
        setChat((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      }
    }
  }, [meeting, token, currentUser]);

  const leaveMeeting = useCallback(() => {
    setPhase('lobby');
    if (addNotification) addNotification('Вы покинули встречу', 'info');
  }, [addNotification]);

  // ── Render ──
  const userName = currentUser.full_name || currentUser.email || `user-${currentUser.id}`;

  if (phase === 'loading') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 360, color: C.textMuted || '#94a3b8', flexDirection: 'column', gap: 10,
      }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        <div>Готовим комнату…</div>
        <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div style={{
        background: C.surface || '#1e293b',
        border: `1px solid ${C.border || '#334155'}`,
        borderRadius: 12, padding: 20, color: C.text || '#e2e8f0',
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Не удалось открыть встречу</div>
        <div style={{ fontSize: 13, color: C.textMuted || '#94a3b8', marginBottom: 12 }}>{error}</div>
        <button
          onClick={loadAll}
          style={{
            background: C.accent || '#3b82f6', color: '#fff', border: 'none',
            borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600,
          }}
        >
          Повторить
        </button>
      </div>
    );
  }

  if (phase === 'lobby' && meeting) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 1fr) 320px',
        gap: 16, alignItems: 'start',
      }}>
        <div style={{
          background: '#0b0f14', borderRadius: 14, overflow: 'hidden',
          aspectRatio: '16/9', position: 'relative',
          border: `1px solid ${C.border || '#334155'}`,
        }}>
          {lobbyCam ? (
            <video
              ref={lobbyVideoRef}
              autoPlay
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            />
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              color: '#94a3b8', fontSize: 14,
            }}>
              Камера выключена
            </div>
          )}
          <div style={{
            position: 'absolute', left: 12, bottom: 12,
            padding: '4px 10px', background: 'rgba(0,0,0,0.5)',
            borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600,
          }}>
            {userName}
          </div>
        </div>

        <div style={{
          background: C.surface || '#1e293b',
          border: `1px solid ${C.border || '#334155'}`,
          borderRadius: 14, padding: 18,
          display: 'flex', flexDirection: 'column', gap: 12,
          color: C.text || '#e2e8f0',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{meeting.meetingTitle}</div>
          <div style={{ fontSize: 12, color: C.textMuted || '#94a3b8' }}>
            Перед входом проверьте микрофон и камеру
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              onClick={() => setLobbyMic((v) => !v)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border || '#334155'}`,
                background: lobbyMic ? (C.accent || '#3b82f6') : 'transparent',
                color: lobbyMic ? '#fff' : (C.text || '#e2e8f0'), cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}
            >
              {lobbyMic ? <Mic size={16} /> : <MicOff size={16} />}
              {lobbyMic ? 'Микрофон вкл.' : 'Микрофон выкл.'}
            </button>
            <button
              onClick={() => setLobbyCam((v) => !v)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border || '#334155'}`,
                background: lobbyCam ? (C.accent || '#3b82f6') : 'transparent',
                color: lobbyCam ? '#fff' : (C.text || '#e2e8f0'), cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}
            >
              {lobbyCam ? <Video size={16} /> : <VideoOff size={16} />}
              {lobbyCam ? 'Камера вкл.' : 'Камера выкл.'}
            </button>
          </div>

          {lobbyMic && lobbyAudioOk === false && (
            <div style={{
              padding: '8px 10px', borderRadius: 8,
              background: 'rgba(220,38,38,0.15)', color: '#fca5a5',
              fontSize: 12,
            }}>
              Не удалось получить доступ к микрофону. Проверьте разрешения браузера.
            </div>
          )}

          <button
            onClick={enterMeeting}
            style={{
              marginTop: 6,
              background: C.accent || '#3b82f6', color: '#fff', border: 'none',
              borderRadius: 10, padding: '12px 16px', cursor: 'pointer',
              fontWeight: 700, fontSize: 14,
            }}
          >
            Войти на встречу
          </button>

          <div style={{ fontSize: 11, color: C.textMuted || '#94a3b8', textAlign: 'center', marginTop: 4 }}>
            Зайдя на встречу, вы соглашаетесь, что ваше аудио/видео может быть слышно/видно другим участникам.
          </div>
        </div>
      </div>
    );
  }

  // phase === 'meeting'
  if (!meeting) return null;
  return (
    <LiveKitRoom
      serverUrl={meeting.liveKitUrl}
      token={meeting.liveKitToken}
      connect
      audio={lobbyMic}
      video={lobbyCam}
      onDisconnected={leaveMeeting}
      onError={(err: any) => {
        if (addNotification) addNotification(`LiveKit: ${err?.message || 'connection error'}`, 'error');
      }}
      data-lk-theme="default"
      style={{ height: '100%' }}
    >
      <RoomAudioRenderer />
      <MeetingUI
        C={C}
        meetingTitle={meeting.meetingTitle}
        currentUserId={currentUser.id}
        currentUserName={userName}
        chatMessages={chat}
        onSendChat={sendChat}
        onLeave={leaveMeeting}
      />
    </LiveKitRoom>
  );
};

export default MeetingRoomPage;
