import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

interface ConferenceProps {
  project: any;
  currentUser: any;
  appUsers: any[];
  msgs: any[];
  C: any;
  token: string;
  onSendMsg: (text: string, type?: string) => Promise<boolean> | boolean;
  getUserById: (id: any) => any;
  conferenceParticipants: any[];
  onJoin: (micEnabled?: boolean, screenSharing?: boolean) => void;
  onLeave: () => Promise<void>;
  onPresenceUpdate: (updates: any) => Promise<void>;
}

const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const SURL_CONST = process.env.REACT_APP_SUPABASE_URL || '';

export function ConferenceRoom({
  project, currentUser, appUsers, msgs, C, token,
  onSendMsg, getUserById,
  conferenceParticipants, onJoin, onLeave, onPresenceUpdate
}: ConferenceProps) {
  const [chatInput, setChatInput] = useState("");
  const [isInRoom, setIsInRoom] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "participants">("chat");
  const [showInviteMenu, setShowInviteMenu] = useState(false);
  const [selectedInvitees, setSelectedInvitees] = useState<Set<number>>(new Set());
  // Remote screen share: base64 JPEG data URL received from another participant
  const [remoteScreenData, setRemoteScreenData] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const inviteMenuRef = useRef<HTMLDivElement>(null);
  const broadcastRef = useRef<any>(null); // { ch, supa } for screen share broadcast
  const SURL = process.env.REACT_APP_SUPABASE_URL || '';
  const SERVICE_KEY = process.env.REACT_APP_SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || '';

  // ── Attach local screen stream to video element ──
  useEffect(() => {
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenSharing && screenStreamRef.current
        ? screenStreamRef.current : null;
    }
  }, [screenSharing]);

  // ── Subscribe to remote screen share broadcasts when in room ──
  useEffect(() => {
    if (!isInRoom || !project?.id || !SURL_CONST || !SERVICE_KEY) return;
    const supa = createClient(SURL_CONST, SERVICE_KEY);
    const ch = supa.channel(`screen:${project.id}`, {
      config: { broadcast: { self: false, ack: false } }
    });
    ch.on('broadcast', { event: 'frame' }, ({ payload }: any) => {
      if (payload?.userId && String(payload.userId) !== String(currentUser?.id)) {
        setRemoteScreenData(payload.imageData || null);
      }
    }).on('broadcast', { event: 'stop' }, ({ payload }: any) => {
      if (payload?.userId && String(payload.userId) !== String(currentUser?.id)) {
        setRemoteScreenData(null);
      }
    }).subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        broadcastRef.current = { ch, supa };
      }
    });
    return () => {
      supa.removeChannel(ch);
      broadcastRef.current = null;
    };
  }, [isInRoom, project?.id]); // eslint-disable-line

  // ── Capture and broadcast screen frames at ~2fps ──
  useEffect(() => {
    if (!screenSharing) {
      // Notify others that sharing stopped
      broadcastRef.current?.ch?.send({
        type: 'broadcast', event: 'stop',
        payload: { userId: String(currentUser?.id) }
      });
      return;
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const interval = setInterval(() => {
      const video = screenVideoRef.current;
      if (!video || !ctx || video.videoWidth === 0) return;
      // Downsample to max 480x270 to fit in broadcast payload
      const scale = Math.min(480 / video.videoWidth, 270 / video.videoHeight, 1);
      canvas.width = Math.floor(video.videoWidth * scale);
      canvas.height = Math.floor(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/jpeg', 0.55);
      broadcastRef.current?.ch?.send({
        type: 'broadcast', event: 'frame',
        payload: { userId: String(currentUser?.id), imageData }
      });
    }, 500);
    return () => clearInterval(interval);
  }, [screenSharing]); // eslint-disable-line

  // ── Clear remote screen data when sharer leaves ──
  useEffect(() => {
    const sharingIds = conferenceParticipants
      .filter((p: any) => p.screenSharing)
      .map((p: any) => String(p.id));
    if (remoteScreenData && sharingIds.length === 0) {
      setRemoteScreenData(null);
    }
  }, [conferenceParticipants]); // eslint-disable-line

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  // Close invite menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inviteMenuRef.current && !inviteMenuRef.current.contains(e.target as Node)) {
        setShowInviteMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSend = async () => {
    if (!chatInput.trim()) return;
    const ok = await onSendMsg(chatInput, "text");
    if (ok !== false) setChatInput("");
  };

  const joinRoom = () => {
    setIsInRoom(true);
    onJoin(false, false);
    onSendMsg("📞 Начинается видеовстреча...", "call_start");
  };

  const leaveRoom = async () => {
    setIsInRoom(false);
    setMicEnabled(false);
    setScreenSharing(false);
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    await onLeave();
  };

  const toggleMic = async () => {
    try {
      if (!micEnabled) {
        if (!micStreamRef.current) {
          micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        }
        micStreamRef.current.getAudioTracks().forEach(t => { t.enabled = true; });
        setMicEnabled(true);
        await onPresenceUpdate({ micEnabled: true, screenSharing });
      } else {
        micStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });
        setMicEnabled(false);
        await onPresenceUpdate({ micEnabled: false, screenSharing });
      }
    } catch {
      onSendMsg("Не удалось получить доступ к микрофону. Проверьте разрешения браузера.", "text");
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!screenSharing) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = stream;
        setScreenSharing(true);
        await onPresenceUpdate({ micEnabled, screenSharing: true });
        stream.getVideoTracks()[0].onended = async () => {
          setScreenSharing(false);
          screenStreamRef.current?.getTracks().forEach(t => t.stop());
          screenStreamRef.current = null;
          await onPresenceUpdate({ micEnabled, screenSharing: false });
        };
      } else {
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        setScreenSharing(false);
        await onPresenceUpdate({ micEnabled, screenSharing: false });
      }
    } catch {
      onSendMsg("Демонстрация экрана не запущена. Разрешите доступ в браузере.", "text");
    }
  };

  const uploadConferenceFile = async (file: File): Promise<string | null> => {
    if (!SURL || !SERVICE_KEY || !project?.id) return null;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `conference/${project.id}/${Date.now()}_${safeName}`;
    const uploadRes = await fetch(`${SURL}/storage/v1/object/normative-docs/${filePath}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!uploadRes.ok) return null;
    const signRes = await fetch(`${SURL}/storage/v1/object/sign/normative-docs/${filePath}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 }),
    });
    if (!signRes.ok) return null;
    const signJson = await signRes.json();
    const signedPath = signJson?.signedURL || signJson?.signedUrl;
    if (!signedPath) return null;
    return signedPath.startsWith('http') ? signedPath : `${SURL}/storage/v1${signedPath}`;
  };

  const handleAttachFile = async (evt: any) => {
    const file = evt.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const link = await uploadConferenceFile(file);
      if (!link) { onSendMsg(`Не удалось загрузить файл "${file.name}".`, "text"); return; }
      onSendMsg(`📎 ${file.name}\n${link}`, "text");
    } catch {
      onSendMsg(`Ошибка при отправке файла "${file.name}".`, "text");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleInvitee = (userId: number) => {
    setSelectedInvitees(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const sendInvites = async () => {
    const toInvite = appUsers.filter(u => selectedInvitees.has(u.id));
    for (const user of toInvite) {
      await onSendMsg(
        JSON.stringify({ type: 'call_invite', target_user_id: String(user.id), project_name: project?.name }),
        'call_invite'
      );
    }
    setSelectedInvitees(new Set());
    setShowInviteMenu(false);
  };

  const getInitials = (name: string) => {
    const parts = name?.split(" ") || [];
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : (name || "?")[0].toUpperCase();
  };

  const roleColors: Record<string, string> = { gip: "#F59E0B", lead: "#8B5CF6", engineer: "#10B981" };

  const participantIds = new Set(conferenceParticipants.map((p: any) => String(p.id)));
  const invitableUsers = appUsers.filter(u => u.id !== currentUser?.id && !participantIds.has(String(u.id)));
  const sharingParticipant = conferenceParticipants.find(
    (p: any) => p.screenSharing && String(p.id) !== String(currentUser?.id)
  );
  const hasScreenContent = screenSharing || (remoteScreenData && sharingParticipant);

  if (!project) return <div className="empty-state" style={{ padding: 60 }}>Выберите проект</div>;

  return (
    <div
      className="conf-root screen-fade"
      style={{
        display: "flex", flexDirection: "column",
        height: "calc(100vh - 170px)", minHeight: 540,
        gap: 0, borderRadius: 16, overflow: "hidden",
        border: `1px solid ${C.border}`
      }}
    >
      {/* ===== HEADER ===== */}
      <div className="conf-header" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 20px", flexShrink: 0,
        background: `linear-gradient(135deg, ${C.sidebarBg} 0%, ${C.surface2} 100%)`,
        borderBottom: `1px solid ${C.border}`
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: `linear-gradient(135deg, ${C.accent}, #4f7fd8)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, color: "#fff"
          }}>🏗️</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Совещание проекта</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{project.name} · {project.code}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Статус: демонстрация экрана ИЛИ счётчик участников */}
          {isInRoom && (screenSharing || sharingParticipant) ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 20,
              background: "#3B82F620",
              border: "1px solid #3B82F650",
              fontSize: 12, color: "#3B82F6", fontWeight: 600
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3B82F6", display: "inline-block", animation: "pulse 1.5s infinite" }} />
              🖥️ Демонстрация экрана
            </div>
          ) : (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 20,
              background: isInRoom ? "#10B98120" : C.surface2,
              border: `1px solid ${isInRoom ? "#10B98150" : C.border}`,
              fontSize: 12, color: isInRoom ? "#10B981" : C.textMuted, fontWeight: 600
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: isInRoom ? "#10B981" : C.textMuted, display: "inline-block" }} />
              {conferenceParticipants.length} в зале
            </div>
          )}

          {isInRoom && (
            <>
              {/* Микрофон */}
              <button onClick={toggleMic} title={micEnabled ? "Выключить микрофон" : "Включить микрофон"} style={{
                width: 38, height: 38, borderRadius: 10, border: "none", cursor: "pointer",
                background: micEnabled ? "#10B98120" : "#EF444420",
                color: micEnabled ? "#10B981" : "#EF4444",
                fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center"
              }}>{micEnabled ? "🎤" : "🔇"}</button>

              {/* Демонстрация */}
              <button onClick={toggleScreenShare} title={screenSharing ? "Остановить демонстрацию" : "Демонстрация экрана"} style={{
                width: 38, height: 38, borderRadius: 10, border: "none", cursor: "pointer",
                background: screenSharing ? "#3B82F620" : C.surface2,
                color: screenSharing ? "#3B82F6" : C.textMuted,
                fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center"
              }}>🖥️</button>

              {/* ── Пригласить (мульти-выбор) ── */}
              <div style={{ position: "relative" }} ref={inviteMenuRef}>
                <button onClick={() => { setShowInviteMenu(v => !v); setSelectedInvitees(new Set()); }} style={{
                  height: 38, padding: "0 12px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: showInviteMenu ? `${C.accent}25` : C.surface2,
                  color: showInviteMenu ? C.accent : C.textMuted,
                  fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5
                }}>📲 Пригласить</button>

                {showInviteMenu && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 300,
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                    minWidth: 240, overflow: "hidden"
                  }}>
                    <div style={{
                      padding: "10px 16px", fontSize: 11, fontWeight: 700,
                      color: C.textMuted, textTransform: "uppercase", letterSpacing: 1,
                      borderBottom: `1px solid ${C.border}`, display: "flex",
                      justifyContent: "space-between", alignItems: "center"
                    }}>
                      <span>Не в зале ({invitableUsers.length})</span>
                      {selectedInvitees.size > 0 && (
                        <span style={{ color: C.accent }}>Выбрано: {selectedInvitees.size}</span>
                      )}
                    </div>

                    <div style={{ maxHeight: 220, overflowY: "auto" }}>
                      {invitableUsers.length === 0 ? (
                        <div style={{ padding: "16px", fontSize: 13, color: C.textMuted, textAlign: "center" }}>
                          Все участники уже в зале
                        </div>
                      ) : invitableUsers.map(u => {
                        const sel = selectedInvitees.has(u.id);
                        return (
                          <div
                            key={u.id}
                            onClick={() => toggleInvitee(u.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: 10,
                              padding: "10px 16px", cursor: "pointer",
                              background: sel ? `${C.accent}15` : "transparent",
                              transition: "background 0.15s"
                            }}
                            onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = C.surface2; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = sel ? `${C.accent}15` : "transparent"; }}
                          >
                            {/* Чекбокс */}
                            <div style={{
                              width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                              border: `2px solid ${sel ? C.accent : C.border}`,
                              background: sel ? C.accent : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center"
                            }}>
                              {sel && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
                            </div>
                            {/* Аватар */}
                            <div style={{
                              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                              background: `linear-gradient(135deg, ${roleColors[u.role] || C.accent}, ${roleColors[u.role] || C.accent}90)`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 11, fontWeight: 700, color: "#fff"
                            }}>{getInitials(u.full_name)}</div>
                            <div style={{ flex: 1, overflow: "hidden" }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {u.full_name?.split(" ").slice(0, 2).join(" ")}
                              </div>
                              <div style={{ fontSize: 11, color: C.textMuted }}>
                                {u.position || (u.role === "gip" ? "ГИП" : u.role === "lead" ? "Руководитель" : "Инженер")}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {invitableUsers.length > 0 && (
                      <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.border}` }}>
                        <button
                          onClick={sendInvites}
                          disabled={selectedInvitees.size === 0}
                          style={{
                            width: "100%", padding: "9px", borderRadius: 8, border: "none",
                            background: selectedInvitees.size > 0
                              ? `linear-gradient(135deg, ${C.accent}, #F59E0B)` : C.surface2,
                            color: selectedInvitees.size > 0 ? "#fff" : C.textMuted,
                            fontSize: 13, fontWeight: 700, cursor: selectedInvitees.size > 0 ? "pointer" : "not-allowed",
                            transition: "all 0.2s"
                          }}
                        >
                          {selectedInvitees.size === 0
                            ? "Выберите участников"
                            : `Пригласить ${selectedInvitees.size} чел.`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Войти / Выйти */}
          <button onClick={isInRoom ? leaveRoom : joinRoom} style={{
            padding: "8px 18px", borderRadius: 10, border: "none", cursor: "pointer",
            background: isInRoom
              ? "linear-gradient(135deg, #EF4444, #DC2626)"
              : "linear-gradient(135deg, #10B981, #059669)",
            color: "#fff", fontSize: 13, fontWeight: 700,
            boxShadow: isInRoom ? "0 4px 12px #EF444440" : "0 4px 12px #10B98140"
          }}>
            {isInRoom ? "📞 Выйти" : "☎️ Войти в зал"}
          </button>
        </div>
      </div>

      {/* ===== ТЕЛО ===== */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ===== УЧАСТНИКИ (боковая панель) ===== */}
        <div style={{
          width: 220, minWidth: 220, flexShrink: 0,
          background: C.bg, borderRight: `1px solid ${C.border}`,
          display: "flex", flexDirection: "column", overflow: "hidden"
        }}>
          <div style={{
            padding: "12px 16px", fontSize: 10, fontWeight: 700,
            letterSpacing: 1.2, color: C.textMuted, textTransform: "uppercase",
            borderBottom: `1px solid ${C.border}`
          }}>Участники ({conferenceParticipants.length})</div>
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
            {conferenceParticipants.length === 0 && (
              <div style={{ padding: "24px 16px", textAlign: "center", color: C.textMuted, fontSize: 12 }}>
                Зал пуст.<br />Нажмите «Войти в зал»
              </div>
            )}
            {conferenceParticipants.map((p: any) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 14px", borderRadius: 8, margin: "0 6px",
                cursor: "default"
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.surface2)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: `linear-gradient(135deg, ${roleColors[p.role] || C.accent}, ${roleColors[p.role] || C.accent}90)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: "#fff", position: "relative"
                }}>
                  {getInitials(p.full_name)}
                  <div style={{
                    position: "absolute", bottom: -1, right: -1,
                    width: 10, height: 10, borderRadius: "50%",
                    background: "#10B981", border: `2px solid ${C.bg}`
                  }} />
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.full_name?.split(" ").slice(0, 2).join(" ")}
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.position || (p.role === "gip" ? "ГИП" : p.role === "lead" ? "Рук. отдела" : "Инженер")}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 3, flexShrink: 0, fontSize: 13 }}>
                  <span>{p.micEnabled ? "🎤" : "🔇"}</span>
                  {p.screenSharing && <span>🖥️</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== ОСНОВНАЯ ОБЛАСТЬ ===== */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg }}>

          {/* ── ДЕМОНСТРАЦИЯ ЭКРАНА ── */}
          {hasScreenContent && (
            <div style={{
              flex: "0 0 60%", background: "#080808", position: "relative",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden"
            }}>
              {/* Локальный экран (тот кто делится) */}
              {screenSharing && (
                <>
                  <video
                    ref={screenVideoRef}
                    autoPlay muted
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                  />
                  <div style={{
                    position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
                    color: "#fff", fontSize: 12, background: "rgba(0,0,0,0.7)",
                    padding: "5px 16px", borderRadius: 20, whiteSpace: "nowrap",
                    display: "flex", alignItems: "center", gap: 8
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3B82F6", display: "inline-block", animation: "pulse 1.5s infinite" }} />
                    Вы демонстрируете экран · нажмите 🖥️ чтобы остановить
                  </div>
                </>
              )}
              {/* Удалённый экран (принятые фреймы) */}
              {!screenSharing && remoteScreenData && (
                <>
                  <img
                    src={remoteScreenData}
                    alt="screen share"
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                  />
                  {sharingParticipant && (
                    <div style={{
                      position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
                      color: "#fff", fontSize: 12, background: "rgba(0,0,0,0.7)",
                      padding: "5px 16px", borderRadius: 20, whiteSpace: "nowrap",
                      display: "flex", alignItems: "center", gap: 8
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
                      {sharingParticipant.full_name?.split(" ").slice(0,2).join(" ")} демонстрирует экран
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Если в зале кто-то делится, но фрейм ещё не пришёл ── */}
          {!screenSharing && sharingParticipant && !remoteScreenData && (
            <div style={{
              flex: "0 0 40%", background: "#080808",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12
            }}>
              <span style={{ fontSize: 48 }}>🖥️</span>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>
                {sharingParticipant.full_name?.split(" ").slice(0, 2).join(" ")} запускает демонстрацию...
              </div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Подождите пару секунд</div>
            </div>
          )}

          {/* Табы */}
          <div style={{
            display: "flex", flexShrink: 0,
            borderBottom: `1px solid ${C.border}`, padding: "0 16px"
          }}>
            {(["chat", "participants"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: "10px 18px", fontSize: 13, fontWeight: 600,
                color: activeTab === tab ? C.accent : C.textMuted,
                background: "none", border: "none", cursor: "pointer",
                borderBottom: activeTab === tab ? `2px solid ${C.accent}` : "2px solid transparent",
              }}>
                {tab === "chat" ? "💬 Обсуждение" : "👥 Участники"}
              </button>
            ))}
          </div>

          {/* ── ЧАТ ── */}
          {activeTab === "chat" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px" }}>
                {msgs.filter(m => m.type !== 'call_invite').length === 0 && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: C.textMuted, gap: 10 }}>
                    <span style={{ fontSize: 40 }}>💬</span>
                    <span style={{ fontSize: 13 }}>Начните совещание по проекту</span>
                  </div>
                )}
                {msgs.filter(m => m.type !== 'call_invite').map((m: any) => {
                  const mu = getUserById(m.user_id);
                  const isMe = mu?.id === currentUser?.id;
                  const time = m.created_at ? new Date(m.created_at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }) : "";
                  const rawText = String(m.text || "");
                  const textLines = rawText.split("\n");
                  const fileUrl = textLines.find((l: string) => l.startsWith("http")) || "";
                  const isFileMsg = textLines[0]?.startsWith("📎 ") && !!fileUrl;
                  const fileName = isFileMsg ? textLines[0].replace(/^📎\s*/, "") : "";
                  return (
                    <div key={m.id} style={{ display: "flex", gap: 10, marginBottom: 14, flexDirection: isMe ? "row-reverse" : "row" }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                        background: `linear-gradient(135deg, ${roleColors[mu?.role] || C.accent}, ${roleColors[mu?.role] || C.accent}90)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, color: "#fff"
                      }}>{mu ? getInitials(mu.full_name) : "?"}</div>
                      <div style={{
                        maxWidth: "72%",
                        background: isMe ? `linear-gradient(135deg, ${C.accent}, #F59E0B)` : C.surface2,
                        borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                        padding: "9px 14px"
                      }}>
                        <div style={{ display: "flex", gap: 7, marginBottom: 3, alignItems: "baseline" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: isMe ? "#fff" : C.text }}>
                            {mu?.full_name?.split(" ").slice(0, 2).join(" ") || "Пользователь"}
                          </span>
                          <span style={{ fontSize: 10, color: isMe ? "#ffffff90" : C.textMuted }}>{time}</span>
                        </div>
                        {isFileMsg ? (
                          <div>
                            <div style={{ fontSize: 13, color: isMe ? "#fff" : C.textDim, wordBreak: "break-word" }}>{fileName}</div>
                            <a href={fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: isMe ? "#fff" : C.accent, textDecoration: "underline" }}>Открыть файл</a>
                          </div>
                        ) : (
                          <div style={{ fontSize: 13, color: isMe ? "#fff" : C.textDim, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{rawText}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Поле ввода */}
              <div style={{
                padding: "10px 16px", borderTop: `1px solid ${C.border}`,
                display: "flex", gap: 8, alignItems: "center", background: C.surface, flexShrink: 0
              }}>
                <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleAttachFile} />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{
                  width: 36, height: 36, borderRadius: 9, background: C.surface2,
                  border: `1px solid ${C.border}`, color: C.textMuted, fontSize: 16, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }} title="Прикрепить файл">📎</button>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && void handleSend()}
                  placeholder="Написать сообщение..."
                  style={{
                    flex: 1, padding: "9px 14px", borderRadius: 10,
                    border: `1px solid ${C.border}`, background: C.bg,
                    color: C.text, fontSize: 13, outline: "none"
                  }}
                />
                <button onClick={() => void handleSend()} style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: `linear-gradient(135deg, ${C.accent}, #F59E0B)`,
                  border: "none", color: "#fff", fontSize: 16, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 4px 12px ${C.accent}40`
                }}>↑</button>
              </div>
            </div>
          )}

          {/* ── УЧАСТНИКИ (вкладка) ── */}
          {activeTab === "participants" && (
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {conferenceParticipants.length === 0 ? (
                <div style={{ textAlign: "center", padding: 48, color: C.textMuted }}>
                  <span style={{ fontSize: 42, display: "block", marginBottom: 10 }}>👥</span>
                  Никого нет в зале
                </div>
              ) : conferenceParticipants.map((p: any) => (
                <div key={p.id} className="card" style={{ padding: "14px 18px", marginBottom: 10, display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `linear-gradient(135deg, ${roleColors[p.role] || C.accent}, ${roleColors[p.role] || C.accent}90)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, fontWeight: 700, color: "#fff", position: "relative"
                  }}>
                    {getInitials(p.full_name)}
                    <div style={{ position: "absolute", bottom: -2, right: -2, width: 12, height: 12, borderRadius: "50%", background: "#10B981", border: `3px solid ${C.surface}` }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{p.full_name}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>
                      {p.position || (p.role === "gip" ? "Главный Инженер Проекта" : p.role === "lead" ? "Руководитель отдела" : "Инженер")}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, fontSize: 18 }}>
                    <span>{p.micEnabled ? "🎤" : "🔇"}</span>
                    {p.screenSharing && <span>🖥️</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
