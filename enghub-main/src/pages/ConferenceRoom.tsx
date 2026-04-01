import { useState, useEffect, useRef } from 'react';

interface ConferenceProps {
  project: any;
  currentUser: any;
  appUsers: any[];
  msgs: any[];
  C: any;
  token: string;
  onSendMsg: (text: string, type?: string) => void;
  getUserById: (id: any) => any;
}

// Имитация Supabase Realtime Presence (будет заменена на настоящий после подключения)
const usePresence = (projectId: number, currentUser: any) => {
  const [participants, setParticipants] = useState<any[]>([]);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (!currentUser || !projectId) return;
    // Добавляем текущего пользователя
    setParticipants([{
      ...currentUser,
      isOnline: true,
      micEnabled: false,
      screenSharing: false,
      joinedAt: new Date().toISOString()
    }]);

    // В будущем: Supabase Realtime Presence Channel
    // const channel = supabase.channel(`room:${projectId}`)
    //   .on('presence', { event: 'sync' }, () => { ... })
    //   .subscribe(async (status) => { if (status === 'SUBSCRIBED') await channel.track({...}) });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [projectId, currentUser?.id]);

  return participants;
};

export function ConferenceRoom({ project, currentUser, appUsers, msgs, C, token, onSendMsg, getUserById }: ConferenceProps) {
  const [chatInput, setChatInput] = useState("");
  const [isInRoom, setIsInRoom] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "participants">("chat");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const participants = usePresence(project?.id, isInRoom ? currentUser : null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const handleSend = () => {
    if (!chatInput.trim()) return;
    onSendMsg(chatInput);
    setChatInput("");
  };

  const joinRoom = () => {
    setIsInRoom(true);
    // Trigger the incoming call notification for others
    onSendMsg("📞 Начинается видеовстреча...", "call_start"); 
  };
  const leaveRoom = () => { setIsInRoom(false); setMicEnabled(false); setScreenSharing(false); };

  const getInitials = (name: string) => {
    const parts = name?.split(" ") || [];
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : (name || "?")[0].toUpperCase();
  };

  const roleColors: Record<string, string> = {
    gip: "#F59E0B",
    lead: "#8B5CF6",
    engineer: "#10B981"
  };

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
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Совещание проекта</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>{project.name} · {project.code}</div>
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
            {participants.length} в зале
          </div>

          {/* Кнопки управления */}
          {isInRoom && (
            <>
              <button onClick={() => setMicEnabled(!micEnabled)} style={{
                width: 40, height: 40, borderRadius: 12, border: "none", cursor: "pointer",
                background: micEnabled ? "#10B98120" : "#EF444420",
                color: micEnabled ? "#10B981" : "#EF4444",
                fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s"
              }} title={micEnabled ? "Выключить микрофон" : "Включить микрофон"}>
                {micEnabled ? "🎤" : "🔇"}
              </button>

              <button onClick={() => setScreenSharing(!screenSharing)} style={{
                width: 40, height: 40, borderRadius: 12, border: "none", cursor: "pointer",
                background: screenSharing ? "#3B82F620" : C.surface2,
                color: screenSharing ? "#3B82F6" : C.textMuted,
                fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s"
              }} title={screenSharing ? "Остановить демонстрацию" : "Демонстрация экрана"}>
                🖥️
              </button>
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

      {/* ===== BODY ===== */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", borderRadius: "0 0 16px 16px" }}>

        {/* ===== УЧАСТНИКИ (боковая панель) ===== */}
        <div className="conf-participants" style={{
          width: 260, minWidth: 260,
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
            Участники ({participants.length})
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {participants.length === 0 && (
              <div style={{ padding: "30px 18px", textAlign: "center", color: C.textMuted, fontSize: 13 }}>
                Зал пуст.<br />Нажмите «Войти в зал»
              </div>
            )}
            {participants.map(p => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 18px",
                transition: "background 0.15s",
                borderRadius: 8, margin: "0 8px",
                cursor: "default",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.surface2)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {/* Аватар */}
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: `linear-gradient(135deg, ${roleColors[p.role] || C.accent}, ${roleColors[p.role] || C.accent}90)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: "#fff",
                  position: "relative", flexShrink: 0
                }}>
                  {getInitials(p.full_name)}
                  {/* Online indicator */}
                  <div style={{
                    position: "absolute", bottom: -1, right: -1,
                    width: 12, height: 12, borderRadius: "50%",
                    background: "#10B981",
                    border: `2px solid ${C.bg}`
                  }} />
                </div>
                {/* Info */}
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.full_name?.split(" ").slice(0, 2).join(" ")}
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.position || (p.role === "gip" ? "ГИП" : p.role === "lead" ? "Руководитель" : "Инженер")}
                  </div>
                </div>
                {/* Mic status */}
                <div style={{ fontSize: 14, flexShrink: 0 }}>
                  {p.micEnabled ? "🎤" : "🔇"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== ОСНОВНАЯ ОБЛАСТЬ ===== */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>

          {/* Табы: Обсуждение / Участники (мобильная) */}
          <div style={{
            display: "flex", borderBottom: `1px solid ${C.border}`,
            padding: "0 20px"
          }}>
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
              {/* Сообщения */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
                {msgs.length === 0 && (
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    height: "100%", color: C.textMuted, gap: 12
                  }}>
                    <span style={{ fontSize: 48 }}>💬</span>
                    <span style={{ fontSize: 14 }}>Начните совещание по проекту</span>
                  </div>
                )}
                {msgs.map((m: any) => {
                  const mu = getUserById(m.user_id);
                  const isMe = mu?.id === currentUser?.id;
                  const time = m.created_at ? new Date(m.created_at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }) : "";
                  return (
                    <div key={m.id} style={{
                      display: "flex", gap: 12, marginBottom: 16,
                      flexDirection: isMe ? "row-reverse" : "row"
                    }}>
                      {/* Аватар */}
                      <div style={{
                        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                        background: `linear-gradient(135deg, ${roleColors[mu?.role] || C.accent}, ${roleColors[mu?.role] || C.accent}90)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, color: "#fff"
                      }}>
                        {mu ? getInitials(mu.full_name) : "?"}
                      </div>
                      {/* Bubble */}
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
                        <div style={{ fontSize: 13, color: isMe ? "#fff" : C.textDim, lineHeight: 1.5 }}>{m.text}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Ввод сообщения */}
              <div style={{
                padding: "12px 24px",
                borderTop: `1px solid ${C.border}`,
                display: "flex", gap: 10, alignItems: "center",
                background: C.surface
              }}>
                {/* Кнопка файла (заглушка для Фазы 3) */}
                <button style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: C.surface2, border: `1px solid ${C.border}`,
                  color: C.textMuted, fontSize: 16, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }} title="Прикрепить файл (скоро)">📎</button>

                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSend()}
                  placeholder="Написать сообщение..."
                  style={{
                    flex: 1, padding: "10px 16px", borderRadius: 12,
                    border: `1px solid ${C.border}`, background: C.bg,
                    color: C.text, fontSize: 13, outline: "none",
                    transition: "border-color 0.2s"
                  }}
                />
                <button onClick={handleSend} style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: `linear-gradient(135deg, ${C.accent}, #F59E0B)`,
                  border: "none", color: "#fff", fontSize: 16, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 4px 12px ${C.accent}40`,
                  transition: "transform 0.15s"
                }}>↑</button>
              </div>
            </div>
          )}

          {/* ===== УЧАСТНИКИ (мобильная вкладка) ===== */}
          {activeTab === "participants" && (
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {participants.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: C.textMuted }}>
                  <span style={{ fontSize: 48, display: "block", marginBottom: 12 }}>👥</span>
                  Никого нет в зале
                </div>
              ) : (
                participants.map(p => (
                  <div key={p.id} className="card" style={{
                    padding: "16px 20px", marginBottom: 12,
                    display: "flex", alignItems: "center", gap: 16
                  }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 14,
                      background: `linear-gradient(135deg, ${roleColors[p.role] || C.accent}, ${roleColors[p.role] || C.accent}90)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, fontWeight: 700, color: "#fff", position: "relative"
                    }}>
                      {getInitials(p.full_name)}
                      <div style={{
                        position: "absolute", bottom: -2, right: -2,
                        width: 14, height: 14, borderRadius: "50%",
                        background: "#10B981",
                        border: `3px solid ${C.surface}`
                      }} />
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
