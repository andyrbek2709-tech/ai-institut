import React, { useState, useEffect } from 'react';

export interface Notification {
  id: number;
  text: string;
  type: 'info' | 'success' | 'warning';
  timestamp: number;
}

let notifId = 0;

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = ++notifId;
    setNotifications(prev => [...prev, { id, text, type, timestamp: Date.now() }]);
    // Автоудаление через 8 секунд
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 8000);
  };

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return { notifications, addNotification, removeNotification };
}

export function ToastContainer({ notifications, onRemove }: { notifications: Notification[]; onRemove: (id: number) => void }) {
  if (notifications.length === 0) return null;

  const colors = {
    info: { bg: '#4a9eff', icon: '📋' },
    success: { bg: '#2ac769', icon: '✓' },
    warning: { bg: '#f5a623', icon: '⚡' },
  };

  return (
    <div style={{
      position: 'fixed', top: 72, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 380,
    }}>
      {notifications.map(n => {
        const c = colors[n.type];
        return (
          <div key={n.id} style={{
            background: '#fff', border: '1px solid #e5e7ee', borderLeft: `4px solid ${c.bg}`,
            borderRadius: 10, padding: '14px 18px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'flex-start', gap: 12, animation: 'slideInRight 0.3s ease',
            minWidth: 300,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{c.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: '#1a202c', fontWeight: 500, lineHeight: 1.5 }}>{n.text}</div>
              <div style={{ fontSize: 10, color: '#8896a8', marginTop: 4 }}>
                {new Date(n.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <button onClick={() => onRemove(n.id)} style={{
              background: 'transparent', border: 'none', color: '#8896a8', cursor: 'pointer',
              fontSize: 16, padding: '0 2px', lineHeight: 1, flexShrink: 0,
            }}>✕</button>
          </div>
        );
      })}
    </div>
  );
}
