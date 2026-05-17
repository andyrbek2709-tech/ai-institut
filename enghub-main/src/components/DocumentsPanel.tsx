import { useEffect, useMemo, useState, useRef } from 'react';
import {
  listProjectDocuments,
  listProjectFolders,
  createProjectFolder,
  deleteProjectFolder,
  deleteProjectDocument,
  signProjectFileUrl,
} from '../api/supabase';
import { DocumentUploader } from './DocumentUploader';
import { DocumentPreview } from './DocumentPreview';

type Doc = {
  id: string;
  project_id: number;
  doc_type: 'tz' | 'addendum' | 'other';
  folder_id?: string | null;
  name: string;
  storage_path: string;
  mime_type?: string | null;
  size_bytes: number;
  uploaded_by?: number | null;
  uploaded_at: string;
};

type Folder = { id: string; name: string; position: number };

type Props = {
  C: any;
  projectId: number;
  currentUserId: number;
  token: string;
  appUsers: any[];
  canManage: boolean;
  isGip?: boolean;
};

const DOC_TYPE_LABEL: Record<string, string> = { tz: 'ТЗ', addendum: 'Доп.', other: 'Прочее' };
const DOC_TYPE_COLOR: Record<string, string> = { tz: '#4f8cff', addendum: '#8b5cf6', other: '#64748b' };

const fileIcon = (name: string, mime?: string | null) => {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf') || (mime || '').includes('pdf')) return '📕';
  if (/\.(docx?)$/i.test(lower)) return '📘';
  if (/\.(xlsx?)$/i.test(lower)) return '📗';
  if (/\.(dwg|dxf)$/i.test(lower)) return '📐';
  if (/\.txt$/i.test(lower)) return '📝';
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
  return `${(b / 1024 / 1024).toFixed(2)} МБ`;
};

const formatDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return iso; }
};

export function DocumentsPanel({ C, projectId, currentUserId, token, appUsers, canManage, isGip }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null); // null = Все
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderSaving, setFolderSaving] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [docsRaw, foldersRaw] = await Promise.all([
        listProjectDocuments(projectId, token),
        listProjectFolders(projectId, token),
      ]);
      setDocs(Array.isArray(docsRaw) ? docsRaw : []);
      setFolders(Array.isArray(foldersRaw) ? foldersRaw : []);
    } catch {
      setDocs([]); setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [projectId]);

  useEffect(() => {
    if (creatingFolder) setTimeout(() => folderInputRef.current?.focus(), 50);
  }, [creatingFolder]);

  const filtered = useMemo(() => {
    if (!selectedFolder) return docs;
    return docs.filter(d => d.folder_id === selectedFolder);
  }, [docs, selectedFolder]);

  const totalBytes = docs.reduce((s, d) => s + (d.size_bytes || 0), 0);
  const userById = (id?: number | null) => appUsers.find(u => Number(u.id) === Number(id));
  const folderDocCount = (fid: string) => docs.filter(d => d.folder_id === fid).length;

  const handleClick = async (doc: Doc) => {
    if (previewable(doc.name, doc.mime_type)) {
      setPreviewDoc(doc);
    } else {
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

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setFolderSaving(true);
    try {
      await createProjectFolder(projectId, name, currentUserId, token);
      setNewFolderName('');
      setCreatingFolder(false);
      await reload();
    } catch (e: any) {
      alert(e?.message || 'Не удалось создать папку');
    } finally {
      setFolderSaving(false);
    }
  };

  const handleDeleteFolder = async (folder: Folder) => {
    const count = folderDocCount(folder.id);
    const msg = count > 0
      ? `Удалить папку «${folder.name}»? ${count} файлов станут без папки.`
      : `Удалить папку «${folder.name}»?`;
    if (!window.confirm(msg)) return;
    await deleteProjectFolder(folder.id, token);
    if (selectedFolder === folder.id) setSelectedFolder(null);
    reload();
  };

  const chipStyle = (active: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '6px 12px', borderRadius: 16, flexShrink: 0,
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? C.accent + '15' : C.surface,
    color: active ? C.accent : C.textDim,
    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.15s',
  } as React.CSSProperties);

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

      {/* Folder chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {/* Все */}
        <button style={chipStyle(!selectedFolder)} onClick={() => setSelectedFolder(null)}>
          Все · {docs.length}
        </button>

        {/* Папки из БД */}
        {folders.map(f => (
          <button key={f.id} style={chipStyle(selectedFolder === f.id)} onClick={() => setSelectedFolder(f.id)}>
            📂 {f.name} · {folderDocCount(f.id)}
            {isGip && (
              <span
                title="Удалить папку"
                onClick={e => { e.stopPropagation(); handleDeleteFolder(f); }}
                style={{ marginLeft: 2, opacity: 0.5, fontSize: 10, cursor: 'pointer' }}
              >✕</span>
            )}
          </button>
        ))}

        {/* + Новая папка — только ГИП */}
        {isGip && !creatingFolder && (
          <button style={{ ...chipStyle(false), borderStyle: 'dashed', color: C.accent, borderColor: C.accent + '60' }} onClick={() => setCreatingFolder(true)}>
            + Папка
          </button>
        )}
        {isGip && creatingFolder && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <input
              ref={folderInputRef}
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); } }}
              placeholder="Название папки…"
              style={{ background: C.surface2, border: `1px solid ${C.accent}`, borderRadius: 8, padding: '5px 10px', color: C.text, fontSize: 12, outline: 'none', width: 160 }}
              disabled={folderSaving}
            />
            <button onClick={handleCreateFolder} disabled={!newFolderName.trim() || folderSaving}
              style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>
              {folderSaving ? '…' : '✓'}
            </button>
            <button onClick={() => { setCreatingFolder(false); setNewFolderName(''); }}
              style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: 30, color: C.textMuted, textAlign: 'center', fontSize: 13 }}>Загрузка…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: 40, textAlign: 'center', background: C.surface2, borderRadius: 12 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📁</div>
          <div style={{ color: C.textMuted, fontSize: 13 }}>
            {docs.length === 0 ? 'Загрузите ТЗ, чтобы начать работу с проектом' : 'В этой папке пока нет файлов'}
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
            const folder = d.folder_id ? folders.find(f => f.id === d.folder_id) : null;
            return (
              <div
                key={d.id}
                className="card"
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 10, cursor: 'pointer', background: C.surface, border: `1px solid ${C.border}`, transition: 'border-color 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.accent; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
              >
                <div style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{fileIcon(d.name, d.mime_type)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }} title={d.name}>
                      {d.name}
                    </div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: DOC_TYPE_COLOR[d.doc_type] + '20', color: DOC_TYPE_COLOR[d.doc_type], fontWeight: 700 }}>
                      {DOC_TYPE_LABEL[d.doc_type]}
                    </span>
                    {folder && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: C.surface2, color: C.textMuted, border: `1px solid ${C.border}` }}>
                        📂 {folder.name}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                    <span>{formatBytes(d.size_bytes)}</span>
                    <span>·</span>
                    <span>{formatDate(d.uploaded_at)}</span>
                    {user && (<><span>·</span><span>👤 {user.full_name?.split(' ')[0] || user.email}</span></>)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleClick(d); }}
                    title={previewable(d.name, d.mime_type) ? 'Открыть превью' : 'Скачать'} style={{ padding: '6px 10px', fontSize: 12 }}>
                    {previewable(d.name, d.mime_type) ? '👁 Открыть' : '⬇ Скачать'}
                  </button>
                  {(canManage || Number(d.uploaded_by) === Number(currentUserId)) && (
                    <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(d); }}
                      title="Удалить" style={{ padding: '6px 10px', fontSize: 12 }}>🗑</button>
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
          folders={folders}
          defaultFolderId={selectedFolder}
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
