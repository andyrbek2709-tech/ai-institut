// ConferenceRoom.tsx
// Встроенная комната совещания через iframe Jitsi.
// Используем iframe (не External API) — это позволяет Jitsi самому обрабатывать
// lobby, ожидание, и прочие сервисные ситуации без хардкод-ошибки с нашей стороны.

import React, { useEffect, useState } from 'react';

interface ConferenceRoomProps {
  projectId: number;
  projectName: string;
  currentUser: { id: number | string; full_name?: string; email?: string };
  C: any;
  onLeave?: () => void;
}

const JITSI_DOMAIN = 'meet.jit.si';

function getRoomFromStorage(projectId: number): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const key = `enghub-room-${projectId}-${day}`;
  try {
    const saved = localStorage.getItem(key);
    if (saved) return saved;
    // Генерируем уникальный суффикс для этого проекта на сегодня
    const fresh = Math.random().toString(36).slice(2, 8);
    localStorage.setItem(key, fresh);
    return fresh;
  } catch {
    return Math.random().toString(36).slice(2, 8);
  }
}

function newRoom(projectId: number): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const key = `enghub-room-${projectId}-${day}`;
  const fresh = Math.random().toString(36).slice(2, 8);
  try { localStorage.setItem(key, fresh); } catch {}
  return fresh;
}

const ConferenceRoom: React.FC<ConferenceRoomProps> = ({
  projectId, projectName, currentUser, C,
}) => {
  const userName = (currentUser as any)?.full_name || (currentUser as any)?.email || 'Участник';

  const [roomSuffix, setRoomSuffix] = useState<string>(() => getRoomFromStorage(projectId));
  const [copied, setCopied] = useState(false);

  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const roomName = `enghub${projectId}x${day}x${roomSuffix}`;

  const jitsiUrl =
    `https://${JITSI_DOMAIN}/${encodeURIComponent(roomName)}` +
    `#config.prejoinPageEnabled=false` +
    `&config.startWithAudioMuted=false` +
    `&config.startWithVideoMuted=false` +
    `&config.disableDeepLinking=true` +
    `&config.defaultLanguage=ru` +
    `&config.subject=${encodeURIComponent(projectName)}` +
    `&config.disableInviteFunctions=true` +
    `&config.toolbarButtons=["microphone","camera","desktop","chat","participants-pane","tileview","fullscreen","hangup"]` +
    `&interfaceConfig.SHOW_JITSI_WATERMARK=false` +
    `&interfaceConfig.SHOW_POWERED_BY=false` +
    `&userInfo.displayName=${encodeURIComponent(userName)}` +
    (currentUser?.email ? `&userInfo.email=${encodeURIComponent((currentUser as any).email)}` : '');

  const handleNewRoom = () => {
    const s = newRoom(projectId);
    setRoomSuffix(s);
  };

  const handleCopy = () => {
    const url = `https://${JITSI_DOMAIN}/${encodeURIComponent(roomName)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '80vh', minHeight: 540, borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.border}` }}>

      {/* Тулбар над iframe */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', background: C.surface,
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace' }}>
          🔗 {roomName}
        </span>
        <button
          onClick={handleCopy}
          title="Скопировать ссылку для коллег"
          style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 6,
            border: `1px solid ${C.border}`, background: copied ? '#22c55e20' : 'transparent',
            color: copied ? '#22c55e' : C.textMuted, cursor: 'pointer', flexShrink: 0,
          }}
        >
          {copied ? '✓ Скопировано' : 'Скопировать ссылку'}
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleNewRoom}
          title="Создать новую комнату (если текущая недоступна)"
          style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 6,
            border: `1px solid ${C.border}`, background: 'transparent',
            color: C.textMuted, cursor: 'pointer', flexShrink: 0,
          }}
        >
          + Новая комната
        </button>
        <a
          href={`https://${JITSI_DOMAIN}/${encodeURIComponent(roomName)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 6,
            border: `1px solid ${C.border}`, background: 'transparent',
            color: C.textMuted, cursor: 'pointer', textDecoration: 'none', flexShrink: 0,
          }}
        >
          ↗ Новая вкладка
        </a>
      </div>

      {/* Jitsi iframe — занимает всё пространство */}
      <iframe
        key={roomName}
        src={jitsiUrl}
        allow="camera; microphone; display-capture; fullscreen; autoplay"
        style={{ flex: 1, border: 'none', width: '100%', minHeight: 0 }}
        title={`Совещание: ${projectName}`}
      />
    </div>
  );
};

export default ConferenceRoom;
