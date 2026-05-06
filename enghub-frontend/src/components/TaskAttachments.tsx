import { useEffect, useRef, useState } from 'react';
import {
  listTaskAttachments,
  uploadTaskAttachment,
  deleteTaskAttachment,
  signProjectFileUrl,
  FILE_SIZE_LIMIT,
} from '../api/supabase';
import { publishFileAttached } from '../lib/events/publisher';

const TASK_FILE_LIMIT_COUNT = 5;
const TASK_FILE_LIMIT_TOTAL = 50 * 1024 * 1024; // суммарно

type Attach = {
  id: string;
  task_id: number;
  name: string;
  storage_path: string;
  mime_type?: string | null;
  size_bytes: number;
  uploaded_by?: number | null;
  uploaded_at: string;
};

type Props = {
  C: any;
  projectId: number;
  taskId: number;
  currentUserId: number;
  token: string;
  canEdit: boolean;
};

const fileIcon = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return '📕';
  if (/\.(docx?)$/i.test(lower)) return '📘';
  if (/\.(xlsx?)$/i.test(lower)) return '📗';
  if (/\.(dwg|dxf)$/i.test(lower)) return '📐';
  if (/\.(png|jpe?g|gif|webp)$/i.test(lower)) return '🖼';
  return '📎';
};

const formatBytes = (b: number) => {
  if (b < 1024) return `${b} Б`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} КБ`;
  return `${(b / 1024 / 1024).toFixed(2)} МБ`;
};

export function TaskAttachments({ C, projectId, taskId, currentUserId, token, canEdit }: Props) {
  const [list, setList] = useState<Attach[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const rows = await listTaskAttachments(taskId, token);
      setList(Array.isArray(rows) ? rows : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [taskId]);

  const totalBytes = list.reduce((s, a) => s + (a.size_bytes || 0), 0);

  const onPick = async (file: File | null) => {
    if (!file) return;
    setError(null);
    if (list.length >= TASK_FILE_LIMIT_COUNT) {
      setError(`Лимит — ${TASK_FILE_LIMIT_COUNT} файлов на задачу.`);
      return;
    }
    if (file.size > FILE_SIZE_LIMIT) {
      setError(`Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ). Лимит — 50 МБ.`);
      return;
    }
    if (totalBytes + file.size > TASK_FILE_LIMIT_TOTAL) {
      setError(`Превышен суммарный лимит ${formatBytes(TASK_FILE_LIMIT_TOTAL)} на задачу.`);
      return;
    }
    setBusy(true);
    try {
      await uploadTaskAttachment(projectId, taskId, file, currentUserId, token);
      await reload();
      // Publish file.attached event to Redis
      publishFileAttached(String(taskId), String(projectId), String(currentUserId), { fileName: file.name, fileSize: file.size }).catch((err) => {
        console.warn('[Events] Failed to publish file.attached:', err);
      });
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const open = async (a: Attach) => {
    const url = await signProjectFileUrl(a.storage_path, 60 * 60);
    if (url) window.open(url, '_blank');
  };

  const remove = async (a: Attach) => {
    if (!window.confirm(`Удалить «${a.name}»?`)) return;
    try {
      await deleteTaskAttachment(a.id, a.storage_path, token);
      reload();
    } catch (e: any) {
      alert(`Не удалось удалить: ${e?.message || 'ошибка'}`);
    }
  };

  return (
    <div style={{ background: C.surface2, borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          📎 Прикреплённые файлы
          {list.length > 0 && <span style={{ color: C.textDim, marginLeft: 6, fontWeight: 600 }}>· {list.length}/{TASK_FILE_LIMIT_COUNT} · {formatBytes(totalBytes)}</span>}
        </div>
        {canEdit && (
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => inputRef.current?.click()}
              disabled={busy || list.length >= TASK_FILE_LIMIT_COUNT}
              style={{ padding: '4px 10px', fontSize: 11 }}
            >
              {busy ? 'Загрузка…' : '➕ Прикрепить'}
            </button>
            <input
              ref={inputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={e => onPick(e.target.files?.[0] || null)}
            />
          </>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: C.textMuted }}>Загрузка…</div>
      ) : list.length === 0 ? (
        <div style={{ fontSize: 12, color: C.textMuted, fontStyle: 'italic' }}>Файлов нет</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {list.map(a => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                background: C.surface,
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                fontSize: 12,
              }}
            >
              <span style={{ fontSize: 16 }}>{fileIcon(a.name)}</span>
              <span
                onClick={() => open(a)}
                style={{ flex: 1, cursor: 'pointer', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={a.name}
              >
                {a.name}
              </span>
              <span style={{ color: C.textMuted, fontSize: 11 }}>{formatBytes(a.size_bytes)}</span>
              {(canEdit && (Number(a.uploaded_by) === Number(currentUserId))) && (
                <button
                  type="button"
                  onClick={() => remove(a)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 13 }}
                  title="Удалить"
                >🗑</button>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 8, fontSize: 11, color: C.red }}>⚠️ {error}</div>
      )}
    </div>
  );
}
