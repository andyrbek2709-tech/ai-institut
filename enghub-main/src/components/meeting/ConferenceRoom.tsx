// ConferenceRoom.tsx — простой iframe с roomName из БД
import React from 'react';

interface ConferenceRoomProps {
  roomName: string;
  projectName: string;
  currentUser: { id: number | string; full_name?: string; email?: string };
  C: any;
}

const JITSI_DOMAIN = 'meet.jit.si';

const ConferenceRoom: React.FC<ConferenceRoomProps> = ({ roomName, projectName, currentUser, C }) => {
  const userName = (currentUser as any)?.full_name || (currentUser as any)?.email || 'Участник';

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
    ((currentUser as any)?.email ? `&userInfo.email=${encodeURIComponent((currentUser as any).email)}` : '');

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
