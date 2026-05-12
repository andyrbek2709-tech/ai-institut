import { useState, useEffect } from 'react';
import { apiGet } from '../api/http';

// DD-07: Лента активности проекта
// Читает activity_log + фильтры по типу события и участнику (2f)

const ACTION_LABELS: Record<string, { emoji: string; verb: string; color: string }> = {
  task_created: { emoji: '➕', verb: 'создал задачу', color: '#4a9eff' },
  task_status_changed: { emoji: '🔄', verb: 'изменил статус', color: '#a855f7' },
  document_uploaded: { emoji: '📄', verb: 'загрузил документ', color: '#2ac769' },
  task_attachment_added: { emoji: '📎', verb: 'прикрепил файл', color: '#06b6d4' },
  review_created: { emoji: '📝', verb: 'добавил замечание', color: '#f59e0b' },
  cross_dept_request: { emoji: '🔗', verb: 'запросил данные', color: '#8b5cf6' },
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

const FILTER_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'Все события' },
  { value: 'task_status_changed', label: '🔄 Статусы' },
  { value: 'task_created', label: '➕ Создание задач' },
  { value: 'document_uploaded', label: '📄 Файлы' },
  { value: 'task_attachment_added', label: '📎 Вложения' },
  { value: 'review_created', label: '📝 Замечания' },
  { value: 'cross_dept_request', label: '🔗 Смежники' },
];

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

export default function ActivityFeed({ projectId, appUsers, C, limit = 50 }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterActor, setFilterActor] = useState('');

  useEffect(() => {
    if (!projectId) { setItems([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    apiGet<any[]>(`/api/activity-log?project_id=${encodeURIComponent(String(projectId))}&limit=${limit}`)
      .then((data) => { if (!cancelled) { setItems(Array.isArray(data) ? data : []); setLoading(false); } })
      .catch(() => { if (!cancelled) { setItems([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [projectId, limit]);

  const getUserName = (id: number | null) => {
    if (!id || !Array.isArray(appUsers)) return 'Система';
    const u = appUsers.find((x: any) => Number(x.id) === Number(id));
    return u?.full_name || `#${id}`;
  };

  const uniqueActors = Array.isArray(appUsers)
    ? (appUsers as any[]).filter(u => items.some(it => Number(it.actor_id) === Number(u.id)))
    : [];

  const filtered = items.filter(it => {
    if (filterType && it.action_type !== filterType) return false;
    if (filterActor && String(it.actor_id) !== filterActor) return false;
    return true;
  });

  const selStyle: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
    color: C.text, fontSize: 11, padding: '4px 8px', cursor: 'pointer', outline: 'none',
  };

  if (loading) return <div style={{ color: C.textMuted, fontSize: 12, padding: 12 }}>Загрузка ленты...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 2f: Фильтры по типу события и участнику */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 6 }}>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selStyle}>
          {FILTER_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={filterActor} onChange={e => setFilterActor(e.target.value)} style={selStyle}>
          <option value="">Все участники</option>
          {uniqueActors.map((u: any) => (
            <option key={u.id} value={String(u.id)}>{u.full_name}</option>
          ))}
        </select>
        {(filterType || filterActor) && (
          <button
            onClick={() => { setFilterType(''); setFilterActor(''); }}
            style={{ background: 'transparent', border: 'none', color: C.textMuted, fontSize: 11, cursor: 'pointer' }}
          >✕ Сброс</button>
        )}
      </div>

      {!filtered.length && (
        <div style={{ color: C.textMuted, fontSize: 13, padding: 18, textAlign: 'center' }}>
          {items.length ? '🔍 Нет событий под выбранный фильтр' : '📭 Событий пока нет. Создавайте задачи, загружайте документы — лента наполнится.'}
        </div>
      )}

      {filtered.map(it => {
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
