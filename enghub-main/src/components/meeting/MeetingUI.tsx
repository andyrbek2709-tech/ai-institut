// src/components/meeting/MeetingUI.tsx
// Чат видеовстречи (Jitsi). Чистый React + Supabase чат.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageSquare, X, LogOut, Send, Users, Loader2,
} from 'lucide-react';

export interface MeetingChatMessage {
  id: string;
  user_id: string | number;
  user_name: string;
  message: string;
  created_at: string;
}

export interface MeetingUIProps {
  C: any;
  meetingTitle: string;
  currentUserId: string | number;
  currentUserName: string;
  chatMessages: MeetingChatMessage[];
  onSendChat: (text: string) => Promise<void> | void;
  onLeave: () => void;
}

export const MeetingUI: React.FC<MeetingUIProps> = ({
  C, meetingTitle, currentUserId, currentUserName,
  chatMessages, onSendChat, onLeave,
}) => {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sendMsg = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try { await onSendChat(text); setInput(''); } catch {}
    setSending(false);
  }, [input, sending, onSendChat]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  }, [sendMsg]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: C.surface || '#1e293b',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: `1px solid ${C.border || '#334155'}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <MessageSquare size={18} color={C.text || '#e2e8f0'} />
        <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: C.text || '#e2e8f0' }}>
          {meetingTitle}
        </div>
        <button
          onClick={onLeave}
          title="Покинуть встречу"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#ef4444', padding: 4, borderRadius: 6,
          }}
        >
          <LogOut size={18} />
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {chatMessages.length === 0 && (
          <div style={{ color: C.textMuted || '#94a3b8', fontSize: 12, textAlign: 'center', padding: 20 }}>
            Чат пока пуст. Напишите первое сообщение!
          </div>
        )}
        {chatMessages.map((m) => {
          const isMe = String(m.user_id) === String(currentUserId);
          return (
            <div key={m.id} style={{
              alignSelf: isMe ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
            }}>
              {!isMe && (
                <div style={{ fontSize: 11, color: C.accent || '#3b82f6', marginBottom: 2, fontWeight: 600 }}>
                  {m.user_name}
                </div>
              )}
              <div style={{
                padding: '8px 12px', borderRadius: 12,
                background: isMe ? (C.accent || '#3b82f6') : (C.cardBg || '#0f172a'),
                color: isMe ? '#fff' : (C.text || '#e2e8f0'),
                fontSize: 13, lineHeight: 1.4, wordBreak: 'break-word',
              }}>
                {m.message}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 12px', borderTop: `1px solid ${C.border || '#334155'}`,
        display: 'flex', gap: 8, alignItems: 'flex-end',
      }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Написать сообщение..."
          rows={1}
          style={{
            flex: 1, resize: 'none', borderRadius: 10,
            padding: '10px 12px', border: `1px solid ${C.border || '#334155'}`,
            background: C.cardBg || '#0f172a', color: C.text || '#e2e8f0',
            fontSize: 13, outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={sendMsg}
          disabled={!input.trim() || sending}
          style={{
            background: C.accent || '#3b82f6', border: 'none', borderRadius: 10,
            padding: '10px 12px', cursor: input.trim() ? 'pointer' : 'not-allowed',
            opacity: input.trim() ? 1 : 0.5, color: '#fff',
          }}
        >
          {sending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
};

export default MeetingUI;
