import { useState, useEffect, useRef } from 'react';

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

export function ConferenceRoom({ project, currentUser, appUsers, msgs, C, token, onSendMsg, getUserById, conferenceParticipants, onJoin, onLeave, onPresenceUpdate }: ConferenceProps) {
  const [chatInput, setChatInput] = useState("");
  const [isInRoom, setIsInRoom] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "participants">("chat");
  const [showInviteMenu, setShowInviteMenu] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const inviteMenuRef = useRef<HTMLDivElement>(null);
  const SURL = process.env.REACT_APP_SUPABASE_URL || '';
  const SERVICE_KEY = process.env.REACT_APP_SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || '';

  // Attach screen stream to video element
  useEffect(() => {
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenSharing && screenStreamRef.current ? screenStreamRef.current : null;
    }
  }, [screenSharing]);

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
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    await onLeave();
  };

  const toggleMic = async () => {
    try {
      if (!micEnabled) {
        if (!micStreamRef.current) {
          micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        }
        micStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = true; });
        setMicEnabled(true);
        await onPresenceUpdate({ micEnabled: true, screenSharing });
      } else {
        micStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = false; });
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
        const [videoTrack] = stream.getVideoTracks();
        if (videoTrack) {
          videoTrack.onended = async () => {
            setScreenSharing(false);
            screenStreamRef.current?.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
            await onPresenceUpdate({ micEnabled, screenSharing: false });
          };
        }
      } else {
        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
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

  const sendInvite = async (user: any) => {
    await onSendMsg(
      JSON.stringify({ type: 'call_invite', target_user_id: String(user.id), project_name: project?.name }),
      'call_invite'
    );
    setShowInviteMenu(false);
  };

  const getInitials = (name: string) => {
    const parts = name?.split(" ") || [];
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : (name || "?")[0].toUpperCase();
  };

  const roleColors: Record<string, string> = { gip: "#F59E0B", lead: "#8B5CF6", engineer: "#10B981" };

  // Users in the room (by presence), not already in the room (for invite)
  const participantIds = new Set(conferenceParticipants.map((p: any) => String(p.id)));
  const invitableUsers = appUsers.filter(u => u.id !== currentUser?.id && !participantIds.has(String(u.id)));

  // Find a participant who is screen sharing (for "other user sharing" banner)
  const sharingParticipant = conferenceParticipants.find(
    (p: any) => p.screenSharing && String(p.id) !== String(currentUser?.id)
  );

  if (!project) return <div className="empty-state" style={{ padding: 60 }}>Выберите проект</div>;

  return (
    <div className="conf-root screen-fade" style={{ display: "flex", flexDirection: "column", height: 600, gap: 0 }}>

      {/* ===== HEADER ===== */}
      <div className="conf-header" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 24px",
        background: `linear-gradient(135deg, ${C.sidebarBg} 0%, ${C.surface2} 100%)`,
        borderRadius: "16px 16px 0 0",
        borderBottom: `1px solid ${C.border}`
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: `linear-gradient(135deg, ${C.accent}, #4f7fd8)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, color: "#fff", fontWeight: 700
          }}>🏗️</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#ffffff" }}>Совещание проекта</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.78)" }}>{project.name} · {project.code}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Счётчик участников */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 20,
            background: isInRoom ? "#10B98120" : C.surface2,
            border: `1px solid ${isInRoom ? "#10B98150" : C.border}`,
            fontSize: 13, color: isInRoom ? "#10B981" : C.textMuted, fontWeight: 600
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: isInRoom ? "#10B981" : C.textMuted }} />
            {conferenceParticipants.length} в зале
          </div>

          {/* Кнопки управления */}
          {isInRoom && (
            <>
              <button onClick={toggleMic} style={{
                width: 40, height: 40, borderRadius: 12, border: "none", cursor: "pointer",
                background: micEnabled ? "#10B98120" : "#EF444420",
                color: micEnabled ? "#10B981" : "#EF4444",
                fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s"
              }} title={micEnabled ? "Выключить микрофон" : "Включить микрофон"}>
                {micEnabled ? "🎤" : "🔇"}
              </button>

              <button onClick={toggleScreenShare} style={{
                width: 40, height: 40, borderRadius: 12, border: "none", cursor: "pointer",
                background: screenSharing ? "#3B82F620" : C.surface2,
                color: screenSharing ? "#3B82F6" : C.textMuted,
                fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s"
              }} title={screenSharing ? "Остановить демонстрацию" : "Демонстрация экрана"}>
                🖥️
              </button>

              {/* Кнопка приглашения */}
              <div style={{ position: "relative" }} ref={inviteMenuRef}>
                <button onClick={() => setShowInviteMenu(v => !v)} style={{
                  height: 40, padding: "0 14px", borderRadius: 12, border: "none", cursor: "pointer",
                  background: showInviteMenu ? `${C.accent}20` : C.surface2,
                  color: showInviteMenu ? C.accent : C.textMuted,
                  fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
                  transition: "all 0.2s"
                }} title="Пригласить участника">
                  📲 Пригласить
                </button>
                {showInviteMenu && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200,
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                    minWidth: 220, overflow: "hidden"
                  }}>
                    <div style={{ padding: "8px 14px", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, borderBottom: `1px solid ${C.border}` }}>
                      Не в зале
                    </div>
                    {invitableUsers.length === 0 ? (
                      <div style={{ padding: "12px 16px", fontSize: 13, color: C.textMuted }}>Все участники уже в зале</div>
                    ) : invitableUsers.map(u => (
                      <button key={u.id} onClick={() => sendInvite(u)} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        width: "100%", padding: "10px 16px", background: "none",
                        border: "none", cursor: "pointer", textAlign: "left",
                        transition: "background 0.15s"
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.surface2)}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}
                      >
                        <div style={{
                          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                          background: `linear-gradient(135deg, ${roleColors[u.role] || C.accent}, ${roleColors[u.role] || C.accent}90)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, color: "#fff"
                        }}>
                          {getInitials(u.full_name)}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{u.full_name?.split(" ").slice(0, 2).join(" ")}</div>
                          <div style={{ fontSize: 11, color: C.textMuted }}>{u.position || (u.role === "gip" ? "ГИП" : u.role === "lead" ? "Руководитель" : "Инженер")}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Войти/Выйти */}
          <button onClick={isInRoom ? leaveRoom : joinRoom} style={{
            padding: "8px 20px", borderRadius: 12, border: "none", cursor: "pointer",
            background: isInRoom ? "linear-gradient(135deg, #EF4444, #DC2626)" : "linear-gradient(135deg, #10B981, #059669)",
            color: "#fff", fontSize: 13, fontWeight: 700,
            boxShadow: isInRoom ? "0 4px 12px #EF444440" : "0 4px 12px #10B98140",
            transition: "all 0.3s"
          }}>
            {isInRoom ? "📞 Выйти" : "☎️ Войти в зал"}
          </button>
        </div>
      </div>

      {/* ===== ДЕМОНСТРАЦИЯ ЭКРАНА ===== */}
      {/* Локальная демонстрация — видит тот, кто демонстрирует */}
      {screenSharing && (
        <div style={{ position: "relative", background: "#0a0a0a", flexShrink: 0 }}>
          <video
            ref={screenVideoRef}
            autoPlay
            muted
            style={{ width: "100%", maxHeight: 380, display: "block", objectFit: "contain" }}
          />
          <div style={{
            position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
            color: "#fff", fontSize: 12, background: "rgba(0,0,0,0.65)",
            padding: "4px 14px", borderRadius: 20, whiteSpace: "nowrap"
          }}>
            Демонстрация экрана · нажмите 🖥️ чтобы остановить
          </div>
        </div>
      )}
      {/* Удалённая демонстрация — видит другой участник */}
      {!screenSharing && sharingParticipant && (
        <div style={{
          background: "#0a0a0a", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          height: 120, gap: 14
        }}>
          <span style={{ fontSize: 32 }}>🖥️</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
              {sharingParticipant.full_name?.split(" ").slice(0, 2).join(" ")} демонстрирует экран
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
              Трансляция экрана недоступна в браузере без WebRTC-звонка
            </div>
          </div>
        </div>
      )}

      {/* ===== BODY ===== */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", borderRadius: "0 0 16px 16px" }}>

        {/* ===== УЧАСТНИКИ (боковая панель) ===== */}
        <div className="conf-participants" style={{
          width: 240, minWidth: 240,
          background: C.bg,
          borderRight: `1px solid ${C.border}`,
          display: "flex", flexDirection: "column",
          overflow: "hidden"
        }}>
          <div style={{
            padding: "14px 18px",
            fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
            color: C.textMuted, textTransform: "uppercase",
            borderBottom: `1px solid ${C.border}`
          }}>
            Участники ({conferenceParticipants.length})
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {conferenceParticipants.length === 0 && (
              <div style={{ padding: "30px 18px", textAlign: "center", color: C.textMuted, fontSize: 13 }}>
                Зал пуст.<br />Нажмите «Войти в зал»
              </div>
            )}
            {conferenceParticipants.map((p: any) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 18px", transition: "background 0.15s",
                borderRadius: 8, margin: "0 8px", cursor: "default",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.surface2)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: `linear-gradient(135deg, ${roleColors[p.role] || C.accent}, ${roleColors[p.role] || C.accent}90)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: "#fff",
                  position: "relative", flexShrink: 0
                }}>
                  {getInitials(p.full_name)}
                  <div style={{
                    position: "absolute", bottom: -1, right: -1,
                    width: 12, height: 12, borderRadius: "50%",
                    background: "#10B981", border: `2px solid ${C.bg}`
                  }} />
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.full_name?.split(" ").slice(0, 2).join(" ")}
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.position || (p.role === "gip" ? "ГИП" : p.role === "lead" ? "Руководитель" : "Инженер")}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 14 }}>{p.micEnabled ? "🎤" : "🔇"}</span>
                  {p.screenSharing && <span style={{ fontSize: 14 }}>🖥️</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== ОСНОВНАЯ ОБЛАСТЬ ===== */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>

          {/* Табы */}
          <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, padding: "0 20px" }}>
            {(["chat", "participants"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: "12px 20px", fontSize: 13, fontWeight: 600,
                color: activeTab === tab ? C.accent : C.textMuted,
                background: "none", border: "none", cursor: "pointer",
                borderBottom: activeTab === tab ? `2px solid ${C.accent}` : "2px solid transparent",
                transition: "all 0.2s"
              }}>
                {tab === "chat" ? "💬 Обсуждение" : "👥 Участники"}
              </button>
            ))}
          </div>

          {/* ===== ЧАТ ===== */}
          {activeTab === "chat" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
                {msgs.filter(m => m.type !== 'call_invite').length === 0 && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: C.textMuted, gap: 12 }}>
                    <span style={{ fontSize: 48 }}>💬</span>
                    <span style={{ fontSize: 14 }}>Начните совещание по проекту</span>
                  </div>
                )}
                {msgs.filter(m => m.type !== 'call_invite').map((m: any) => {
                  const mu = getUserById(m.user_id);
                  const isMe = mu?.id === currentUser?.id;
                  const time = m.created_at ? new Date(m.created_at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }) : "";
                  const rawText = String(m.text || "");
                  const textLines = rawText.split("\n");
                  const fileUrl = textLines.find((line: string) => line.startsWith("http")) || "";
                  const isFileMsg = textLines[0]?.startsWith("📎 ") && !!fileUrl;
                  const fileName = isFileMsg ? textLines[0].replace(/^📎\s*/, "") : "";
                  return (
                    <div key={m.id} style={{ display: "flex", gap: 12, marginBottom: 16, flexDirection: isMe ? "row-reverse" : "row" }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                        background: `linear-gradient(135deg, ${roleColors[mu?.role] || C.accent}, ${roleColors[mu?.role] || C.accent}90)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, color: "#fff"
                      }}>
                        {mu ? getInitials(mu.full_name) : "?"}
                      </div>
                      <div style={{
                        maxWidth: "70%",
                        background: isMe ? `linear-gradient(135deg, ${C.accent}, #F59E0B)` : C.surface2,
                        borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        padding: "10px 16px",
                      }}>
                        <div style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "baseline" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: isMe ? "#fff" : C.text }}>
                            {mu?.full_name?.split(" ").slice(0, 2).join(" ") || "Пользователь"}
                          </span>
                          <span style={{ fontSize: 10, color: isMe ? "#ffffff90" : C.textMuted }}>{time}</span>
                        </div>
                        {isFileMsg ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div style={{ fontSize: 13, color: isMe ? "#fff" : C.textDim, lineHeight: 1.5, wordBreak: "break-word" }}>{fileName}</div>
                            <a href={fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: isMe ? "#fff" : C.accent, textDecoration: "underline" }}>Открыть файл</a>
                          </div>
                        ) : (
                          <div style={{ fontSize: 13, color: isMe ? "#fff" : C.textDim, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                            {rawText}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Ввод сообщения */}
              <div style={{
                padding: "12px 24px", borderTop: `1px solid ${C.border}`,
                display: "flex", gap: 10, alignItems: "center", background: C.surface
              }}>
                <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleAttachFile} />
                <button onClick={() => fileInputRef.current?.click()} style={{
                  width: 38, height: 38, borderRadius: 10, background: C.surface2,
                  border: `1px solid ${C.border}`, color: C.textMuted, fontSize: 16, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }} title={uploading ? "Загрузка файла..." : "Прикрепить файл"} disabled={uploading}>📎</button>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && void handleSend()}
                  placeholder="Написать сообщение..."
                  style={{
                    flex: 1, padding: "10px 16px", borderRadius: 12,
                    border: `1px solid ${C.border}`, background: C.bg,
                    color: C.text, fontSize: 13, outline: "none", transition: "border-color 0.2s"
                  }}
                />
                <button onClick={() => void handleSend()} style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: `linear-gradient(135deg, ${C.accent}, #F59E0B)`,
                  border: "none", color: "#fff", fontSize: 16, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 4px 12px ${C.accent}40`, transition: "transform 0.15s"
                }}>↑</button>
              </div>
            </div>
          )}

          {/* ===== УЧАСТНИКИ (вкладка) ===== */}
          {activeTab === "participants" && (
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {conferenceParticipants.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: C.textMuted }}>
                  <span style={{ fontSize: 48, display: "block", marginBottom: 12 }}>👥</span>
                  Никого нет в зале
                </div>
              ) : (
                conferenceParticipants.map((p: any) => (
                  <div key={p.id} className="card" style={{ padding: "16px 20px", marginBottom: 12, display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 14,
                      background: `linear-gradient(135deg, ${roleColors[p.role] || C.accent}, ${roleColors[p.role] || C.accent}90)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, fontWeight: 700, color: "#fff", position: "relative"
                    }}>
                      {getInitials(p.full_name)}
                      <div style={{ position: "absolute", bottom: -2, right: -2, width: 14, height: 14, borderRadius: "50%", background: "#10B981", border: `3px solid ${C.surface}` }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{p.full_name}</div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>
                        {p.position || (p.role === "gip" ? "Главный Инженер Проекта" : p.role === "lead" ? "Руководитель отдела" : "Инженер")}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 18 }}>{p.micEnabled ? "🎤" : "🔇"}</span>
                      {p.screenSharing && <span style={{ fontSize: 18 }}>🖥️</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
