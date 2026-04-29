import { useState, useEffect } from 'react';
import { SURL, SERVICE_KEY } from '../api/supabase';

// DD-07: Лента активности проекта
// Читает activity_log + Realtime подписка на новые события

const ACTION_LABELS: Record<string, { emoji: string; verb: string; color: string }> = {
  task_created: { emoji: '➕', verb: 'создал задачу', color: '#4a9eff' },
  task_status_changed: { emoji: '🔄', verb: 'изменил статус', color: '#a855f7' },
  document_uploaded: { emoji: '📄', verb: 'загрузил документ', color: '#2ac769' },
  task_attachment_added: { emoji: '📎', verb: 'прикрепил файл', color: '#06b6d4' },
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'В очередь',
  inprogress: 'В работу',
  awaiting_input: 'Ждёт данных',
  review_lead: 'На проверке',
  review_gip: 'У ГИПа',
  revision: 'На доработку',
  done: 'Готово',
};

function fmtRelTime(iso: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.floor((now - t) / 1000);
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} дн назад`;
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export default function ActivityFeed({ projectId, appUsers, C, limit = 30 }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) { setItems([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
    fetch(`${SURL}/rest/v1/activity_log?project_id=eq.${projectId}&select=*&order=created_at.desc&limit=${limit}`, { headers })
      .then(r => r.json())
      .then((data: any[]) => { if (!cancelled) { setItems(Array.isArray(data) ? data : []); setLoading(false); } })
      .catch(() => { if (!cancelled) { setItems([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [projectId, limit]);

  const getUserName = (id: number | null) => {
    if (!id || !Array.isArray(appUsers)) return 'Система';
    const u = appUsers.find((x: any) => Number(x.id) === Number(id));
    return u?.full_name || `#${id}`;
  };

  if (loading) return <div style={{ color: C.textMuted, fontSize: 12, padding: 12 }}>Загрузка ленты...</div>;
  if (!items.length) return <div style={{ color: C.textMuted, fontSize: 13, padding: 18, textAlign: 'center' }}>📭 Событий пока нет. Создавайте задачи, загружайте документы — лента наполнится.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map(it => {
        const meta = ACTION_LABELS[it.action_type] || { emoji: '•', verb: it.action_type, color: C.textMuted };
        const actor = getUserName(it.actor_id);
        const payload = it.payload || {};
        const name = payload.name || payload.title || `#${it.target_id}`;
        let detail: any = null;
        if (it.action_type === 'task_status_changed' && payload.from_status && payload.to_status) {
          detail = (
            <span style={{ fontSize: 11, color: C.textMuted }}>
              {STATUS_LABELS[payload.from_status] || payload.from_status} → <span style={{ color: meta.color, fontWeight: 600 }}>{STATUS_LABELS[payload.to_status] || payload.to_status}</span>
            </span>
          );
        }
        return (
          <div key={it.id} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 16, lineHeight: '20px' }}>{meta.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.4 }}>
                <b>{actor}</b>{' '}
                <span style={{ color: C.textMuted }}>{meta.verb}</span>{' '}
                <span style={{ color: meta.color, fontWeight: 500 }}>{name}</span>
              </div>
              {detail && <div style={{ marginTop: 2 }}>{detail}</div>}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap' }}>{fmtRelTime(it.created_at)}</div>
          </div>
        );
      })}
    </div>
  );
}
