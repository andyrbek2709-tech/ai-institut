import { useEffect, useMemo, useState } from 'react';
import { getStorageStats } from '../api/supabase';

type Row = {
  project_id: number;
  project_name: string;
  project_code: string | null;
  files_count: number;
  total_bytes: number;
  documents_count: number;
  attachments_count: number;
  documents_bytes: number;
  attachments_bytes: number;
  last_upload_at: string | null;
};

const formatBytes = (b: number) => {
  if (!b) return '0 Б';
  if (b < 1024) return `${b} Б`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} КБ`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(2)} МБ`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
};

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (d.getFullYear() < 2000) return '—';
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso; }
};

type Props = { C: any; token: string };

export function StorageStats({ C, token }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = await getStorageStats(token);
        if (!active) return;
        setRows(Array.isArray(data) ? data : []);
        setError(null);
      } catch (e: any) {
        setError(e?.message || 'Ошибка загрузки');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => (r.project_name || '').toLowerCase().includes(q) || (r.project_code || '').toLowerCase().includes(q));
  }, [rows, search]);

  const totals = useMemo(() => {
    return rows.reduce((acc, r) => ({
      bytes: acc.bytes + Number(r.total_bytes || 0),
      files: acc.files + Number(r.files_count || 0),
      projects: rows.length,
    }), { bytes: 0, files: 0, projects: 0 });
  }, [rows]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-label">Хранилище</div>
          <div className="page-title">📊 Статистика по проектам</div>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
        <div className="card" style={{ padding: 14, background: C.surface }}>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Проектов</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.text, marginTop: 4 }}>{totals.projects}</div>
        </div>
        <div className="card" style={{ padding: 14, background: C.surface }}>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Файлов всего</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.text, marginTop: 4 }}>{totals.files}</div>
        </div>
        <div className="card" style={{ padding: 14, background: C.surface }}>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Объём хранилища</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.accent, marginTop: 4 }}>{formatBytes(totals.bytes)}</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Поиск по проекту или коду…"
          style={{
            width: '100%',
            padding: '8px 12px',
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.text,
            borderRadius: 8,
            fontSize: 13,
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Body */}
      {loading ? (
        <div style={{ padding: 30, color: C.textMuted, textAlign: 'center', fontSize: 13 }}>Загрузка…</div>
      ) : error ? (
        <div style={{ padding: 14, background: C.red + '12', border: `1px solid ${C.red}30`, borderRadius: 8, color: C.red, fontSize: 13 }}>
          ⚠️ {error}
          <div style={{ marginTop: 6, fontSize: 11, color: C.textMuted }}>
            Возможно, миграция БД ещё не применена. Примените файл <code>2026-04-29_t30_documents.sql</code> в Supabase SQL Editor.
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: 40, textAlign: 'center', background: C.surface2, borderRadius: 12 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
          <div style={{ color: C.textMuted, fontSize: 13 }}>Файлов в проектах ещё нет</div>
        </div>
      ) : (
        <div style={{ overflow: 'auto', borderRadius: 10, border: `1px solid ${C.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.surface2 }}>
                <th style={th(C)}>Проект</th>
                <th style={{ ...th(C), textAlign: 'right' }}>Размер</th>
                <th style={{ ...th(C), textAlign: 'right' }}>Файлов</th>
                <th style={{ ...th(C), textAlign: 'right' }}>Документы</th>
                <th style={{ ...th(C), textAlign: 'right' }}>В задачах</th>
                <th style={th(C)}>Последняя загрузка</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.project_id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={td(C)}>
                    <div style={{ fontWeight: 600, color: C.text }}>{r.project_name}</div>
                    {r.project_code && <div style={{ fontSize: 11, color: C.textMuted }}>{r.project_code}</div>}
                  </td>
                  <td style={{ ...td(C), textAlign: 'right', fontWeight: 600, color: C.accent }}>{formatBytes(Number(r.total_bytes))}</td>
                  <td style={{ ...td(C), textAlign: 'right' }}>{r.files_count}</td>
                  <td style={{ ...td(C), textAlign: 'right', color: C.textMuted }}>{r.documents_count} · {formatBytes(Number(r.documents_bytes))}</td>
                  <td style={{ ...td(C), textAlign: 'right', color: C.textMuted }}>{r.attachments_count} · {formatBytes(Number(r.attachments_bytes))}</td>
                  <td style={td(C)}>{formatDate(r.last_upload_at)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: C.surface2, borderTop: `2px solid ${C.border}` }}>
                <td style={{ ...td(C), fontWeight: 700 }}>ИТОГО ({filtered.length})</td>
                <td style={{ ...td(C), textAlign: 'right', fontWeight: 700, color: C.accent }}>
                  {formatBytes(filtered.reduce((s, r) => s + Number(r.total_bytes || 0), 0))}
                </td>
                <td style={{ ...td(C), textAlign: 'right', fontWeight: 700 }}>
                  {filtered.reduce((s, r) => s + Number(r.files_count || 0), 0)}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div style={{ marginTop: 14, fontSize: 11, color: C.textMuted, fontStyle: 'italic' }}>
        Данные считаются по таблицам project_documents и task_attachments.
        Реальный размер бакета Supabase Storage может отличаться при наличии «осиротевших» файлов.
      </div>
    </div>
  );
}

const th = (C: any): React.CSSProperties => ({
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 11,
  textTransform: 'uppercase',
  fontWeight: 700,
  color: C.textMuted,
  letterSpacing: 0.5,
});

const td = (C: any): React.CSSProperties => ({
  padding: '10px 14px',
  color: C.textDim,
  verticalAlign: 'middle',
});
