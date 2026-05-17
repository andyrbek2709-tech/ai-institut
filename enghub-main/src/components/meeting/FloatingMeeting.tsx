// FloatingMeeting.tsx
// Плавающее окно совещания — живёт поверх всего приложения,
// не прерывается при навигации по разделам.
// Использует Jitsi External API вместо iframe — без рекламных оверлеев.

import React, { useEffect, useRef, useState } from 'react';

interface FloatingMeetingProps {
  roomName: string;
  projectName: string;
  currentUser: { id: number | string; full_name?: string; email?: string };
  C: any;
  onClose: () => void;
}

declare global {
  interface Window { JitsiMeetExternalAPI: any; }
}

const JITSI_DOMAIN = 'meet.jit.si';
const W = 520;
const H = 380;

const FloatingMeeting: React.FC<FloatingMeetingProps> = ({
  roomName, projectName, currentUser, C, onClose,
}) => {
  const userName = (currentUser as any)?.full_name || (currentUser as any)?.email || 'Участник';
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({
    x: Math.max(0, window.innerWidth - W - 24),
    y: Math.max(0, window.innerHeight - H - 80),
  });

  const dragging = useRef(false);
  const dragOrigin = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);

  useEffect(() => {
    const init = () => {
      if (!containerRef.current) return;
      if (apiRef.current) { try { apiRef.current.dispose(); } catch {} }
      apiRef.current = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName,
        parentNode: containerRef.current,
        width: W,
        height: H,
        configOverwrite: {
          prejoinPageEnabled: false,
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          disableDeepLinking: true,
          defaultLanguage: 'ru',
          subject: projectName,
          disableInviteFunctions: true,
          toolbarButtons: ['microphone', 'camera', 'desktop', 'chat', 'tileview', 'fullscreen', 'hangup'],
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
  }, [roomName]);

  // Drag handlers
  const onHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragging.current = true;
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const nx = dragOrigin.current.px + e.clientX - dragOrigin.current.mx;
      const ny = dragOrigin.current.py + e.clientY - dragOrigin.current.my;
      setPos({
        x: Math.max(0, Math.min(nx, window.innerWidth - W)),
        y: Math.max(0, Math.min(ny, window.innerHeight - 48)),
      });
    };
    const onUp = () => { dragging.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleClose = () => {
    if (window.confirm('Покинуть совещание?')) onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: W,
        zIndex: 9999,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
        border: '1px solid rgba(255,255,255,0.12)',
        background: '#0f172a',
        userSelect: 'none',
        transition: 'box-shadow 0.15s',
      }}
    >
      {/* ── Шапка — drag handle ── */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 14px',
          background: 'linear-gradient(90deg, #1e293b 0%, #0f172a 100%)',
          cursor: 'grab',
          borderBottom: minimized ? 'none' : '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span style={{
          width: 9, height: 9, borderRadius: '50%',
          background: '#ef4444',
          boxShadow: '0 0 6px #ef4444',
          flexShrink: 0,
          animation: 'float-pulse 2s ease-in-out infinite',
        }} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Совещание: {projectName}
        </span>
        <button
          onClick={() => setMinimized(v => !v)}
          title={minimized ? 'Развернуть' : 'Свернуть'}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16, padding: '2px 6px', lineHeight: 1, borderRadius: 4 }}
        >
          {minimized ? '▲' : '▼'}
        </button>
        <button
          onClick={handleClose}
          title="Покинуть совещание"
          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 16, padding: '2px 6px', lineHeight: 1, borderRadius: 4 }}
        >
          ✕
        </button>
      </div>

      {/* ── Jitsi External API container ── */}
      {/* Высота 0 при сворачивании — API продолжает работать (аудио не прерывается) */}
      <div
        ref={containerRef}
        style={{ height: minimized ? 0 : H, overflow: 'hidden', transition: 'height 0.2s ease' }}
      />

      <style>{`
        @keyframes float-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};

export default FloatingMeeting;
