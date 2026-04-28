// src/components/meeting/MeetingUI.tsx
// Внутренний UI комнаты LiveKit (рендерится только когда подключение установлено).
// Использует @livekit/components-react: useTracks/useParticipants для собственной
// сетки тайлов; контролы (микрофон, камера, демо экрана, рука, чат, выход)
// нарисованы вручную — без LiveKit ControlBar — чтобы стилистически совпадать
// с EngHub (inline styles + объект C темы).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useTracks,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
  useConnectionState,
  TrackRefContext,
  ParticipantTile as RawParticipantTile,
  AudioTrack as RawAudioTrack,
} from '@livekit/components-react';

// LiveKit 2.x возвращает ReactNode, а в проекте @types/react@18.2 ждёт ReactElement —
// каст к React.FC, чтобы JSX-узлы валидировались. На рантайм это не влияет.
const ParticipantTile = RawParticipantTile as unknown as React.FC<any>;
const AudioTrack = RawAudioTrack as unknown as React.FC<any>;
import {
  Track,
  ConnectionState,
  RoomEvent,
  DataPacket_Kind,
  type LocalParticipant,
  type Participant,
} from 'livekit-client';
import {
  Mic, MicOff, Video, VideoOff,
  ScreenShare, ScreenShareOff,
  Hand, MessageSquare, X, LogOut, Send, Users, Loader2,
} from 'lucide-react';

export interface MeetingChatMessage {
  id: string;
  user_id: string | number;
  user_name: string;
  message: string;
  created_at: string;
}

export interface MeetingUIProps {
  C: any;                                  // тема EngHub
  meetingTitle: string;
  currentUserId: string | number;
  currentUserName: string;
  // Чат подаётся снаружи (хранится в video_meeting_chat_messages),
  // плюс fallback через LiveKit data-channel (для оффлайн-сценариев).
  chatMessages: MeetingChatMessage[];
  onSendChat: (text: string) => Promise<void> | void;
  onLeave: () => void;
}

// ── helpers ──────────────────────────────────────────────────────────────

const RAISE_HAND_TOPIC = 'enghub.raise_hand';

function isLocal(p: Participant | null | undefined, localIdentity: string): boolean {
  return !!p && p.identity === localIdentity;
}

function getDisplayName(p: Participant): string {
  return p.name || p.identity || 'Участник';
}

// Пытается прочитать metadata.role («host» / «participant»).
function getRole(p: Participant): string {
  try {
    const m = p.metadata ? JSON.parse(p.metadata) : null;
    return (m && m.role) || 'participant';
  } catch {
    return 'participant';
  }
}

// ── Reconnect overlay ────────────────────────────────────────────────────

const ReconnectOverlay: React.FC<{ C: any }> = ({ C }) => {
  const conn = useConnectionState();
  if (conn !== ConnectionState.Reconnecting) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 12, color: '#fff',
    }}>
      <Loader2 size={36} className="lk-spin" style={{ animation: 'spin 1s linear infinite' }} />
      <div style={{ fontSize: 15, fontWeight: 600 }}>Переподключение к серверу…</div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>Соединение восстановится автоматически</div>
      <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
};

// ── Tile (видео или аватар-плейсхолдер) ──────────────────────────────────

interface TileProps {
  C: any;
  trackRef: any;     // TrackReference из useTracks
  isSpeaker: boolean;
  raised: boolean;
  isHost: boolean;
}

const Tile: React.FC<TileProps> = ({ C, trackRef, isSpeaker, raised, isHost }) => {
  const p: Participant | undefined = trackRef && trackRef.participant;
  if (!p) return null;
  const name = getDisplayName(p);
  const isAudioOnly = !trackRef.publication || trackRef.source === Track.Source.Microphone;

  return (
    <div style={{
      position: 'relative',
      borderRadius: 14,
      overflow: 'hidden',
      background: '#101418',
      border: `2px solid ${isSpeaker ? (C.accent || '#3b82f6') : 'transparent'}`,
      boxShadow: isSpeaker ? `0 0 0 3px ${(C.accent || '#3b82f6')}33` : 'var(--card-shadow, 0 4px 12px rgba(0,0,0,0.15))',
      transition: 'border-color 120ms ease, box-shadow 120ms ease',
      aspectRatio: '16/9',
      minHeight: 140,
    }}>
      {/* Видео-тайл от LiveKit */}
      {!isAudioOnly ? (
        <TrackRefContext.Provider value={trackRef}>
          <ParticipantTile
            disableSpeakingIndicator
            style={{
              width: '100%', height: '100%', background: 'transparent', borderRadius: 0,
            }}
          />
        </TrackRefContext.Provider>
      ) : (
        // Камера выключена — показываем аватарку с инициалами
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: C.accent || '#3b82f6', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 700, letterSpacing: 1,
          }}>
            {name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
          </div>
        </div>
      )}

      {/* Имя + индикаторы (нижняя плашка) */}
      <div style={{
        position: 'absolute', left: 8, bottom: 8, right: 8,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 8px',
        background: 'rgba(0,0,0,0.55)',
        borderRadius: 8,
        color: '#fff', fontSize: 12, fontWeight: 600,
        backdropFilter: 'blur(6px)',
      }}>
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: 4,
          background: p.isMicrophoneEnabled ? '#22c55e' : '#64748b',
        }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>{name}</span>
        {isHost && (
          <span style={{
            background: '#f59e0b', color: '#000', fontSize: 10, padding: '1px 5px',
            borderRadius: 4, fontWeight: 700,
          }}>HOST</span>
        )}
        {!p.isMicrophoneEnabled && <MicOff size={14} />}
      </div>

      {/* Поднятая рука */}
      {raised && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: '#f59e0b', color: '#000',
          width: 32, height: 32, borderRadius: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}>
          <Hand size={18} />
          <style>{`@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }`}</style>
        </div>
      )}
    </div>
  );
};

// ── Сетка тайлов ─────────────────────────────────────────────────────────

interface GridProps {
  C: any;
  raisedHands: Set<string>;
  hostIdentity: string | null;
}

const VideoGrid: React.FC<GridProps> = ({ C, raisedHands, hostIdentity }) => {
  // Берём камеры + демонстрации экрана + микрофоны (микрофоны дают "пустые" tile-ссылки
  // для участников без камеры)
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  // Если кто-то демонстрирует экран — он становится spotlight (большой), остальные — маленькими справа.
  const screenShare = tracks.find((t) => t.source === Track.Source.ScreenShare);
  const cameraTracks = tracks.filter((t) => t.source === Track.Source.Camera);

  if (screenShare) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 240px',
        gap: 10, padding: 10, height: '100%',
      }}>
        <div style={{ minWidth: 0, minHeight: 0 }}>
          <Tile
            C={C}
            trackRef={screenShare}
            isSpeaker={false}
            raised={false}
            isHost={getRole(screenShare.participant) === 'host'}
          />
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          maxHeight: '100%', overflowY: 'auto',
        }}>
          {cameraTracks.map((t) => (
            <Tile
              key={t.participant.identity + ':' + (t.publication?.trackSid || 'cam')}
              C={C}
              trackRef={t}
              isSpeaker={t.participant.isSpeaking}
              raised={raisedHands.has(t.participant.identity)}
              isHost={t.participant.identity === hostIdentity || getRole(t.participant) === 'host'}
            />
          ))}
        </div>
      </div>
    );
  }

  // Авто-сетка под количество участников
  const n = Math.max(1, cameraTracks.length);
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 10, padding: 10, height: '100%',
      alignContent: 'center',
    }}>
      {cameraTracks.map((t) => (
        <Tile
          key={t.participant.identity + ':' + (t.publication?.trackSid || 'cam')}
          C={C}
          trackRef={t}
          isSpeaker={t.participant.isSpeaking}
          raised={raisedHands.has(t.participant.identity)}
          isHost={t.participant.identity === hostIdentity || getRole(t.participant) === 'host'}
        />
      ))}
    </div>
  );
};

// ── Скрытое аудио (LiveKit subscriptions для всех микрофонов) ────────────

const AllAudio: React.FC = () => {
  const tracks = useTracks([Track.Source.Microphone], { onlySubscribed: true });
  return (
    <div style={{ display: 'none' }}>
      {tracks.map((t) =>
        t.participant.isLocal ? null : (
          <TrackRefContext.Provider key={t.participant.identity + ':' + (t.publication?.trackSid || 'mic')} value={t}>
            <AudioTrack trackRef={t} />
          </TrackRefContext.Provider>
        )
      )}
    </div>
  );
};

// ── Основной компонент ──────────────────────────────────────────────────

export const MeetingUI: React.FC<MeetingUIProps> = ({
  C, meetingTitle, currentUserId, currentUserName,
  chatMessages, onSendChat, onLeave,
}) => {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  const [micOn, setMicOn] = useState<boolean>(localParticipant?.isMicrophoneEnabled ?? false);
  const [camOn, setCamOn] = useState<boolean>(localParticipant?.isCameraEnabled ?? false);
  const [shareOn, setShareOn] = useState<boolean>(localParticipant?.isScreenShareEnabled ?? false);
  const [busy, setBusy] = useState<'mic' | 'cam' | 'share' | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const myHand = raisedHands.has(localParticipant?.identity || '');

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Синхронизируем состояние кнопок с реальным состоянием LocalParticipant
  // (на случай, если SDK сам что-то изменил — перепубликация при reconnect и т.п.)
  useEffect(() => {
    if (!localParticipant) return;
    const sync = () => {
      setMicOn(localParticipant.isMicrophoneEnabled);
      setCamOn(localParticipant.isCameraEnabled);
      setShareOn(localParticipant.isScreenShareEnabled);
    };
    sync();
    localParticipant.on('trackPublished', sync);
    localParticipant.on('trackUnpublished', sync);
    localParticipant.on('trackMuted', sync);
    localParticipant.on('trackUnmuted', sync);
    return () => {
      localParticipant.off('trackPublished', sync);
      localParticipant.off('trackUnpublished', sync);
      localParticipant.off('trackMuted', sync);
      localParticipant.off('trackUnmuted', sync);
    };
  }, [localParticipant]);

  // ── Поднятая рука по data-channel ──
  useEffect(() => {
    if (!room) return;
    const handler = (payload: Uint8Array, _participant?: Participant, _kind?: DataPacket_Kind, topic?: string) => {
      if (topic !== RAISE_HAND_TOPIC) return;
      try {
        const decoded = JSON.parse(new TextDecoder().decode(payload));
        if (!decoded || !decoded.identity) return;
        setRaisedHands((prev) => {
          const next = new Set(prev);
          if (decoded.raised) next.add(decoded.identity);
          else next.delete(decoded.identity);
          return next;
        });
      } catch { /* ignore */ }
    };
    room.on(RoomEvent.DataReceived, handler);
    return () => { room.off(RoomEvent.DataReceived, handler); };
  }, [room]);

  // Авто-сброс руки, когда участник вышел
  useEffect(() => {
    setRaisedHands((prev) => {
      const ids = new Set(participants.map((p) => p.identity));
      const next = new Set<string>();
      prev.forEach((id) => { if (ids.has(id)) next.add(id); });
      return next;
    });
  }, [participants]);

  // Автоскролл чата при новом сообщении
  useEffect(() => {
    if (chatOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatOpen]);

  // ── Действия ──
  const toggleMic = useCallback(async () => {
    if (!localParticipant) return;
    setBusy('mic');
    try { await localParticipant.setMicrophoneEnabled(!micOn); }
    finally { setBusy(null); }
  }, [localParticipant, micOn]);

  const toggleCam = useCallback(async () => {
    if (!localParticipant) return;
    setBusy('cam');
    try { await localParticipant.setCameraEnabled(!camOn); }
    finally { setBusy(null); }
  }, [localParticipant, camOn]);

  const toggleShare = useCallback(async () => {
    if (!localParticipant) return;
    setBusy('share');
    try { await localParticipant.setScreenShareEnabled(!shareOn); }
    catch (e) { /* отказ от диалога демонстрации — это норма */ }
    finally { setBusy(null); }
  }, [localParticipant, shareOn]);

  const toggleHand = useCallback(async () => {
    if (!localParticipant || !room) return;
    const newRaised = !myHand;
    const myId = localParticipant.identity;
    setRaisedHands((prev) => {
      const next = new Set(prev);
      if (newRaised) next.add(myId); else next.delete(myId);
      return next;
    });
    try {
      const payload = new TextEncoder().encode(JSON.stringify({
        identity: myId, raised: newRaised,
      }));
      await (localParticipant as LocalParticipant).publishData(payload, {
        reliable: true,
        topic: RAISE_HAND_TOPIC,
      } as any);
    } catch { /* ignore */ }
  }, [localParticipant, room, myHand]);

  const handleSendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput('');
    try { await onSendChat(text); }
    catch (e) { setChatInput(text); }
  }, [chatInput, onSendChat]);

  // ── Стили кнопок ──
  const ctlBtn = (active: boolean, danger = false): React.CSSProperties => ({
    width: 48, height: 48, borderRadius: 24,
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: danger
      ? '#dc2626'
      : active
        ? (C.accent || '#3b82f6')
        : '#374151',
    color: '#fff',
    transition: 'transform 120ms ease, background 120ms ease',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  });
  const ctlLabel: React.CSSProperties = {
    fontSize: 11, color: '#cbd5e1', marginTop: 4, textAlign: 'center',
  };

  const hostIdentity = useMemo(() => {
    const host = participants.find((p) => getRole(p) === 'host');
    return host ? host.identity : null;
  }, [participants]);

  // ── Render ──
  return (
    <div style={{
      position: 'relative',
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 120px)',
      minHeight: 480,
      background: '#0b0f14',
      borderRadius: 14,
      overflow: 'hidden',
      border: `1px solid ${C.border || '#334155'}`,
    }}>
      {/* Шапка */}
      <div style={{
        padding: '10px 14px',
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: '#fff',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{meetingTitle || 'Видеовстреча'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, opacity: 0.85 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Users size={14} /> {participants.length}
          </span>
        </div>
      </div>

      {/* Сетка */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <VideoGrid C={C} raisedHands={raisedHands} hostIdentity={hostIdentity} />
        <AllAudio />
        <ReconnectOverlay C={C} />
      </div>

      {/* Контролы */}
      <div style={{
        padding: '12px 14px',
        background: 'rgba(0,0,0,0.55)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button
            onClick={toggleMic}
            disabled={busy === 'mic'}
            title={micOn ? 'Выключить микрофон' : 'Включить микрофон'}
            style={ctlBtn(micOn)}
          >
            {micOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <div style={ctlLabel}>{micOn ? 'Микрофон' : 'Откл.'}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button
            onClick={toggleCam}
            disabled={busy === 'cam'}
            title={camOn ? 'Выключить камеру' : 'Включить камеру'}
            style={ctlBtn(camOn)}
          >
            {camOn ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
          <div style={ctlLabel}>{camOn ? 'Камера' : 'Откл.'}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button
            onClick={toggleShare}
            disabled={busy === 'share'}
            title={shareOn ? 'Прекратить демонстрацию' : 'Демонстрация экрана'}
            style={ctlBtn(shareOn)}
          >
            {shareOn ? <ScreenShareOff size={20} /> : <ScreenShare size={20} />}
          </button>
          <div style={ctlLabel}>Экран</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button
            onClick={toggleHand}
            title={myHand ? 'Опустить руку' : 'Поднять руку'}
            style={ctlBtn(myHand)}
          >
            <Hand size={20} />
          </button>
          <div style={ctlLabel}>Рука</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button
            onClick={() => setChatOpen((v) => !v)}
            title="Чат"
            style={{ ...ctlBtn(chatOpen), position: 'relative' }}
          >
            <MessageSquare size={20} />
            {chatMessages.length > 0 && !chatOpen && (
              <span style={{
                position: 'absolute', top: -2, right: -2,
                background: '#dc2626', color: '#fff',
                borderRadius: 10, fontSize: 10, fontWeight: 700,
                minWidth: 18, height: 18, padding: '0 4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {Math.min(chatMessages.length, 99)}
              </span>
            )}
          </button>
          <div style={ctlLabel}>Чат</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button
            onClick={() => setUsersOpen((v) => !v)}
            title="Участники"
            style={ctlBtn(usersOpen)}
          >
            <Users size={20} />
          </button>
          <div style={ctlLabel}>Люди</div>
        </div>

        <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.15)', margin: '0 6px' }} />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button
            onClick={onLeave}
            title="Покинуть встречу"
            style={ctlBtn(false, true)}
          >
            <LogOut size={20} />
          </button>
          <div style={{ ...ctlLabel, color: '#fca5a5' }}>Выйти</div>
        </div>
      </div>

      {/* Боковая панель: чат */}
      {chatOpen && (
        <SidePanel C={C} title="Чат" onClose={() => setChatOpen(false)}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chatMessages.length === 0 && (
              <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 20 }}>
                Сообщений пока нет
              </div>
            )}
            {chatMessages.map((m) => {
              const mine = String(m.user_id) === String(currentUserId);
              return (
                <div key={m.id} style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: mine ? (C.accent || '#3b82f6') : '#1f2937',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '6px 10px',
                  fontSize: 13,
                }}>
                  {!mine && (
                    <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 2, fontWeight: 600 }}>
                      {m.user_name}
                    </div>
                  )}
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.message}</div>
                  <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>
                    {new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: 8, display: 'flex', gap: 6 }}>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
              placeholder="Сообщение…"
              style={{
                flex: 1, background: '#0f172a', border: '1px solid #334155',
                color: '#e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none',
              }}
            />
            <button onClick={handleSendChat} title="Отправить" style={{
              background: C.accent || '#3b82f6', color: '#fff', border: 'none',
              borderRadius: 8, padding: '0 12px', cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}>
              <Send size={16} />
            </button>
          </div>
        </SidePanel>
      )}

      {/* Боковая панель: список людей */}
      {usersOpen && (
        <SidePanel C={C} title={`Участники · ${participants.length}`} onClose={() => setUsersOpen(false)}>
          <div style={{ overflowY: 'auto', padding: 10 }}>
            {participants.map((p) => {
              const handUp = raisedHands.has(p.identity);
              return (
                <div key={p.identity} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 8,
                  background: '#0f172a', marginBottom: 6,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 16,
                    background: C.accent || '#3b82f6', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                  }}>
                    {getDisplayName(p).split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div style={{ flex: 1, color: '#e2e8f0', fontSize: 13 }}>
                    {getDisplayName(p)}
                    {p.identity === localParticipant?.identity && <span style={{ opacity: 0.5 }}> (вы)</span>}
                  </div>
                  {getRole(p) === 'host' && (
                    <span style={{
                      background: '#f59e0b', color: '#000', fontSize: 10, padding: '1px 5px',
                      borderRadius: 4, fontWeight: 700,
                    }}>HOST</span>
                  )}
                  {handUp && <Hand size={14} color="#f59e0b" />}
                  {p.isMicrophoneEnabled
                    ? <Mic size={14} color="#22c55e" />
                    : <MicOff size={14} color="#64748b" />}
                </div>
              );
            })}
          </div>
        </SidePanel>
      )}
    </div>
  );
};

// ── Side panel (общий контейнер для чата/людей) ─────────────────────────

const SidePanel: React.FC<{ C: any; title: string; onClose: () => void; children: React.ReactNode }> = ({
  C, title, onClose, children,
}) => (
  <div style={{
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: 320, maxWidth: '80vw',
    background: '#1e293b',
    borderLeft: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', flexDirection: 'column',
    zIndex: 30, boxShadow: '-8px 0 24px rgba(0,0,0,0.3)',
  }}>
    <div style={{
      padding: '10px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      color: '#fff', fontWeight: 700, fontSize: 13,
    }}>
      <span>{title}</span>
      <button onClick={onClose} style={{
        background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer',
        display: 'flex', alignItems: 'center',
      }}>
        <X size={18} />
      </button>
    </div>
    {children}
  </div>
);

export default MeetingUI;
