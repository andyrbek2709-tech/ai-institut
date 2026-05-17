// ConferenceRoom.tsx — Jitsi External API (no iframe promo overlays)
import React, { useEffect, useRef } from 'react';

interface ConferenceRoomProps {
  roomName: string;
  projectName: string;
  currentUser: { id: number | string; full_name?: string; email?: string };
  C: any;
}

declare global {
  interface Window { JitsiMeetExternalAPI: any; }
}

const JITSI_DOMAIN = 'meet.jit.si';

const ConferenceRoom: React.FC<ConferenceRoomProps> = ({ roomName, projectName, currentUser, C }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const userName = (currentUser as any)?.full_name || (currentUser as any)?.email || 'Участник';

  useEffect(() => {
    const init = () => {
      if (!containerRef.current) return;
      if (apiRef.current) { try { apiRef.current.dispose(); } catch {} }
      apiRef.current = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName,
        parentNode: containerRef.current,
        width: '100%',
        height: '100%',
        configOverwrite: {
          prejoinPageEnabled: false,
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          disableDeepLinking: true,
          defaultLanguage: 'ru',
          subject: projectName,
          disableInviteFunctions: true,
          toolbarButtons: ['microphone', 'camera', 'desktop', 'chat', 'participants-pane', 'tileview', 'fullscreen', 'hangup'],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_POWERED_BY: false,
          HIDE_INVITE_MORE_HEADER: true,
        },
        userInfo: {
          displayName: userName,
          email: (currentUser as any)?.email || '',
        },
      });
    };

    if (window.JitsiMeetExternalAPI) {
      init();
    } else {
      const s = document.createElement('script');
      s.src = `https://${JITSI_DOMAIN}/external_api.js`;
      s.onload = init;
      document.head.appendChild(s);
    }

    return () => {
      if (apiRef.current) { try { apiRef.current.dispose(); } catch {} apiRef.current = null; }
    };
  }, [roomName, projectName, userName]);

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://${JITSI_DOMAIN}/${encodeURIComponent(roomName)}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '80vh', minHeight: 540, borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.border}` }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
        background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, color: C.textMuted }}>🔴 Совещание активно</span>
        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace', marginLeft: 4 }}>{roomName.slice(0, 20)}…</span>
        <div style={{ flex: 1 }} />
        <button onClick={handleCopy} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMuted, cursor: 'pointer' }}>
          Скопировать ссылку
        </button>
        <a href={`https://${JITSI_DOMAIN}/${encodeURIComponent(roomName)}`} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMuted, textDecoration: 'none' }}>
          ↗ Новая вкладка
        </a>
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
};

export default ConferenceRoom;
