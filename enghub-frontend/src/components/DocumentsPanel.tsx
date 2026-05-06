import { useEffect, useMemo, useState } from 'react';
import {
  listProjectDocuments,
  deleteProjectDocument,
  signProjectFileUrl,
} from '../api/supabase';
import { DocumentUploader } from './DocumentUploader';
import { DocumentPreview } from './DocumentPreview';

type Doc = {
  id: string;
  project_id: number;
  doc_type: 'tz' | 'addendum' | 'other';
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
  currentUserId: number;
  token: string;
  appUsers: any[];
  canManage: boolean;
};

const DOC_TYPE_LABEL: Record<string, string> = {
  tz: 'ТЗ',
  addendum: 'Дополнение',
  other: 'Прочее',
};

const DOC_TYPE_COLOR: Record<string, string> = {
  tz: '#4f8cff',
  addendum: '#8b5cf6',
  other: '#64748b',
};

const fileIcon = (name: string, mime?: string | null) => {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf') || (mime || '').includes('pdf')) return '📕';
  if (/\.(docx?)$/i.test(lower)) return '📘';
  if (/\.(xlsx?)$/i.test(lower)) return '📗';
  if (/\.(dwg|dxf)$/i.test(lower)) return '📐';
  return '📄';
};

const previewable = (name: string, mime?: string | null) => {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf') || (mime || '').includes('pdf')) return true;
  if (/\.(docx?|xlsx?)$/i.test(lower)) return true;
  return false;
};

const formatBytes = (b: number) => {
  if (b < 1024) return `${b} Б`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} КБ`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(2)} МБ`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} ГБ`;
};

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso; }
};

export function DocumentsPanel({ C, projectId, currentUserId, token, appUsers, canManage }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [filter, setFilter] = useState<'all' | 'tz' | 'addendum' | 'other'>('all');

  const reload = async () => {
    setLoading(true);
    try {
      const rows = await listProjectDocuments(projectId, token);
      setDocs(Array.isArray(rows) ? rows : []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [projectId]);

  const filtered = useMemo(() => {
    if (filter === 'all') return docs;
    return docs.filter(d => d.doc_type === filter);
  }, [docs, filter]);

  const totalBytes = docs.reduce((s, d) => s + (d.size_bytes || 0), 0);
  const userById = (id?: number | null) => appUsers.find(u => Number(u.id) === Number(id));

  const handleClick = async (doc: Doc) => {
    if (previewable(doc.name, doc.mime_type)) {
      setPreviewDoc(doc);
    } else {
      // CAD / прочее — скачивание
      const url = await signProjectFileUrl(doc.storage_path, 60 * 60);
      if (url) window.open(url, '_blank');
    }
  };

  const handleDelete = async (doc: Doc) => {
    if (!window.confirm(`Удалить файл «${doc.name}»?`)) return;
    try {
      await deleteProjectDocument(doc.id, doc.storage_path, token);
      reload();
    } catch (e: any) {
      alert(`Не удалось удалить: ${e?.message || 'ошибка'}`);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>📁 Документы проекта</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
            {docs.length === 0 ? 'Файлов пока нет' : `${docs.length} файлов · ${formatBytes(totalBytes)}`}
          </div>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowUploader(true)} style={{ borderRadius: 20, padding: '10px 18px' }}>
            + Загрузить документ
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {(['all', 'tz', 'addendum', 'other'] as const).map(k => {
          const count = k === 'all' ? docs.length : docs.filter(d => d.doc_type === k).length;
          const active = filter === k;
          return (
            <button
              key={k}
              onClick={() => setFilter(k)}
              style={{
                padding: '6px 12px',
                borderRadius: 16,
                border: `1px solid ${active ? C.accent : C.border}`,
                background: active ? C.accent + '15' : C.surface,
                color: active ? C.accent : C.textDim,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {k === 'all' ? 'Все' : DOC_TYPE_LABEL[k]} · {count}
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: 30, color: C.textMuted, textAlign: 'center', fontSize: 13 }}>Загрузка…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: 40, textAlign: 'center', background: C.surface2, borderRadius: 12 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📁</div>
          <div style={{ color: C.textMuted, fontSize: 13 }}>
            {docs.length === 0 ? 'Загрузите ТЗ, чтобы начать работу с проектом' : 'Нет документов в этой категории'}
          </div>
          {canManage && docs.length === 0 && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowUploader(true)} style={{ marginTop: 12 }}>
              📥 Загрузить ТЗ
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(d => {
            const user = userById(d.uploaded_by);
            return (
              <div
                key={d.id}
                className="card"
                onDoubleClick={() => handleClick(d)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 16px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  transition: 'border-color 0.15s, transform 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.accent; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
              >
                <div style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{fileIcon(d.name, d.mime_type)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }} title={d.name}>
                      {d.name}
                    </div>
                    <span style={{
                      fontSize: 10,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: DOC_TYPE_COLOR[d.doc_type] + '20',
                      color: DOC_TYPE_COLOR[d.doc_type],
                      fontWeight: 700,
                    }}>{DOC_TYPE_LABEL[d.doc_type]}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                    <span>{formatBytes(d.size_bytes)}</span>
                    <span>·</span>
                    <span>{formatDate(d.uploaded_at)}</span>
                    {user && (<><span>·</span><span>👤 {user.full_name?.split(' ')[0] || user.email}</span></>)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => { e.stopPropagation(); handleClick(d); }}
                    title={previewable(d.name, d.mime_type) ? 'Открыть превью' : 'Скачать'}
                    style={{ padding: '6px 10px', fontSize: 12 }}
                  >
                    {previewable(d.name, d.mime_type) ? '👁 Открыть' : '⬇ Скачать'}
                  </button>
                  {(canManage || Number(d.uploaded_by) === Number(currentUserId)) && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={(e) => { e.stopPropagation(); handleDelete(d); }}
                      title="Удалить"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showUploader && (
        <DocumentUploader
          C={C}
          projectId={projectId}
          uploadedBy={currentUserId}
          token={token}
          onClose={() => setShowUploader(false)}
          onUploaded={reload}
        />
      )}
      {previewDoc && (
        <DocumentPreview C={C} doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
    </div>
  );
}
