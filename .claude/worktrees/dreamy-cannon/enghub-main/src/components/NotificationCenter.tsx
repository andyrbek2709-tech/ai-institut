import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../api/supabase';

const SURL = process.env.REACT_APP_SUPABASE_URL || '';
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

const TYPE_ICON: Record<string, string> = {
  task_status: '🔄',
  task_assigned: '👤',
  review_new: '📝',
  review_closed: '✅',
  transmittal_issued: '📦',
  comment_new: '💬',
  ai_digest: '🤖',
  system: 'ℹ️',
};

interface NotificationCenterProps {
  userId: number;
  token: string;
  C: any;
  onNavigate?: (entityType: string, entityId: string, projectId?: number) => void;
}

export function NotificationCenter({ userId, token, C, onNavigate }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const load = async () => {
    try {
      const data = await listNotifications(userId, token);
      if (Array.isArray(data)) setNotifications(data);
    } catch {}
  };

  useEffect(() => {
    load();
  }, [userId]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient(SURL, ANON_KEY);
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload: any) => {
        setNotifications(prev => [payload.new, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleRead = async (n: any) => {
    if (!n.is_read) {
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      await markNotificationRead(n.id, token).catch(() => {});
    }
    if (onNavigate && n.entity_type && n.entity_id) {
      onNavigate(n.entity_type, n.entity_id, n.project_id);
      setIsOpen(false);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await markAllNotificationsRead(userId, token).catch(() => {});
  };

  const formatTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'только что';
    if (m < 60) return `${m} мин назад`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ч назад`;
    return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(v => !v)}
        style={{
          position: 'relative',
          background: isOpen ? C.surface2 : 'transparent',
          border: `1px solid ${isOpen ? C.border : 'transparent'}`,
          borderRadius: 10,
          width: 38,
          height: 38,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          transition: 'background 0.15s',
        }}
        title="Уведомления"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 4,
            right: 4,
            background: '#ef4444',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 99,
            minWidth: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: 360,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          boxShadow: '0 12px 48px rgba(0,0,0,0.35)',
          zIndex: 2000,
          overflow: 'hidden',
          maxHeight: 480,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>
              Уведомления
              {unreadCount > 0 && (
                <span style={{ marginLeft: 8, background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '1px 6px' }}>
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{ background: 'none', border: 'none', color: C.accent, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Прочитать все
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
                Нет уведомлений
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleRead(n)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: `1px solid ${C.border}`,
                    cursor: onNavigate ? 'pointer' : 'default',
                    background: n.is_read ? 'transparent' : C.accent + '0d',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.surface2; }}
                  onMouseLeave={e => { e.currentTarget.style.background = n.is_read ? 'transparent' : C.accent + '0d'; }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{TYPE_ICON[n.type] || 'ℹ️'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600, color: C.text, marginBottom: 2 }}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div style={{ fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {n.body}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{formatTime(n.created_at)}</div>
                  </div>
                  {!n.is_read && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0, marginTop: 5 }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
