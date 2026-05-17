// ConferenceRoom.tsx
// Встроенная комната совещания через Jitsi External API.
// Участники, чат, файлы, демонстрация экрана — всё внутри приложения.

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface ConferenceRoomProps {
  projectId: number;
  projectName: string;
  currentUser: { id: number | string; full_name?: string; email?: string };
  C: any;
  onLeave?: () => void;
}

interface Participant {
  id: string;
  displayName: string;
  avatarURL?: string;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

const JITSI_DOMAIN = 'meet.jit.si';

const AVATAR_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#ec4899','#84cc16','#6366f1',
];

function getColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const ConferenceRoom: React.FC<ConferenceRoomProps> = ({
  projectId, projectName, currentUser, C, onLeave,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userName = (currentUser as any)?.full_name || (currentUser as any)?.email || 'Участник';
  // Ежедневная ротация комнаты — чтобы не попадать в старые rooms с lobby
  const dayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const roomName = `enghub${projectId}x${dayStr}`;

  const initJitsi = useCallback(() => {
    if (!containerRef.current || !window.JitsiMeetExternalAPI) return;
    if (apiRef.current) return; // already initialized

    try {
      const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName,
        parentNode: containerRef.current,
        width: '100%',
        height: '100%',
        configOverwrite: {
          prejoinPageEnabled: false,
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          disableDeepLinking: true,
          subject: projectName,
          defaultLanguage: 'ru',
          startWithTileView: true,
          desktopSharingEnabled: true,
          enableClosePage: false,
          // Скрываем лобби-кнопки чтобы никто не мог включить лобби
          hiddenPremeetingButtons: ['invite', 'startWithVideoMuted'],
          disableInviteFunctions: true,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          SHOW_POWERED_BY: false,
          GENERATE_ROOMNAMES_ON_WELCOME_PAGE: false,
          HIDE_INVITE_MORE_HEADER: true,
          // Только нужные кнопки
          TOOLBAR_BUTTONS: [
            'microphone',
            'camera',
            'desktop',        // демонстрация экрана
            'chat',           // чат (встроенный Jitsi)
            'participants-pane',
            'tileview',
            'fullscreen',
            'settings',
            'hangup',
          ],
          DEFAULT_BACKGROUND: C?.bg || '#0f172a',
          DEFAULT_LOCAL_DISPLAY_NAME: 'Я',
          DEFAULT_REMOTE_DISPLAY_NAME: 'Участник',
        },
        userInfo: {
          displayName: userName,
          email: (currentUser as any)?.email || '',
        },
      });

      apiRef.current = api;

      // Показываем iframe через 5 сек независимо от событий —
      // meet.jit.si может показать лобби внутри iframe, блокировать нельзя
      loadTimerRef.current = setTimeout(() => setLoaded(true), 5000);

      // Участники
      api.on('participantJoined', (e: any) => {
        setParticipants(prev => {
          if (prev.find(p => p.id === e.id)) return prev;
          return [...prev, { id: e.id, displayName: e.displayName || 'Участник' }];
        });
      });

      api.on('participantLeft', (e: any) => {
        setParticipants(prev => prev.filter(p => p.id !== e.id));
      });

      api.on('displayNameChange', (e: any) => {
        setParticipants(prev => prev.map(p =>
          p.id === e.id ? { ...p, displayName: e.displayname } : p
        ));
      });

      // Демонстрация экрана
      api.on('screenSharingStatusChanged', (e: any) => {
        setIsScreenSharing(e.on);
      });

      api.on('videoConferenceJoined', (e: any) => {
        if (loadTimerRef.current) { clearTimeout(loadTimerRef.current); loadTimerRef.current = null; }
        setLoaded(true);
        setParticipants([{ id: 'local', displayName: userName }]);
      });

      api.on('videoConferenceLeft', () => {
        onLeave?.();
      });

      api.on('errorOccurred', (e: any) => {
        console.error('Jitsi error:', e);
        if (e?.error?.name === 'conference.connectionError.membersOnly') {
          setError('Комната закрыта (режим лобби). Попробуйте другой проект или обновите страницу.');
        }
      });

    } catch (err: any) {
      setError(`Ошибка инициализации: ${err.message}`);
    }
  }, [roomName, projectName, userName, currentUser, C, onLeave]);

  useEffect(() => {
    // Загружаем Jitsi External API скриптом
    if (window.JitsiMeetExternalAPI) {
      initJitsi();
      return;
    }

    const existing = document.getElementById('jitsi-external-api');
    if (existing) {
      existing.addEventListener('load', initJitsi);
      return () => existing.removeEventListener('load', initJitsi);
    }

    const script = document.createElement('script');
    script.id = 'jitsi-external-api';
    script.src = `https://${JITSI_DOMAIN}/external_api.js`;
    script.async = true;
    script.onload = initJitsi;
    script.onerror = () => setError('Не удалось загрузить Jitsi. Проверьте интернет-соединение.');
    document.head.appendChild(script);

    return () => {
      if (loadTimerRef.current) { clearTimeout(loadTimerRef.current); loadTimerRef.current = null; }
      if (apiRef.current) {
        try { apiRef.current.dispose(); } catch {}
        apiRef.current = null;
      }
    };
  }, [initJitsi]);

  if (error) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: C.textMuted }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 14, color: '#e53935', marginBottom: 16 }}>{error}</div>
        <button className="btn btn-primary" onClick={() => { setError(''); window.location.reload(); }}>
          Обновить страницу
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '78vh', minHeight: 520, borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.border}` }}>

      {/* Полоска участников — компактная сверху */}
      {participants.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px',
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 11, color: C.textMuted, marginRight: 4 }}>В комнате:</span>
          {participants.map(p => (
            <div key={p.id} title={p.displayName} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: getColor(p.displayName),
                color: '#fff', fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {initials(p.displayName)}
              </div>
              <span style={{ fontSize: 11, color: C.textMuted, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.displayName}
              </span>
            </div>
          ))}
          {isScreenSharing && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>
              🖥 Демонстрация экрана
            </span>
          )}
        </div>
      )}

      {/* Jitsi контейнер — занимает всё пространство */}
      <div style={{ flex: 1, position: 'relative', background: '#000' }}>
        {!loaded && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: C.surface, zIndex: 10, gap: 12,
          }}>
            <div style={{ fontSize: 32 }}>🎥</div>
            <div style={{ fontSize: 14, color: C.textMuted }}>Подключаюсь к комнате совещания…</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>Комната: {roomName}</div>
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

export default ConferenceRoom;
