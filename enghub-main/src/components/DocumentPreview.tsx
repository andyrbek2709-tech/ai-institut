import { useEffect, useState } from 'react';
import { signProjectFileUrl } from '../api/supabase';
import { Modal } from './ui';

type Props = { C: any; doc: { name: string; storage_path: string; mime_type?: string | null }; onClose: () => void; };

const isPdf = (m?: string | null, n?: string) => (m || '').includes('pdf') || /\.pdf$/i.test(n || '');
const isOfficeDoc = (n: string) => /\.(docx?|xlsx?)$/i.test(n);

export function DocumentPreview({ C, doc, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const u = await signProjectFileUrl(doc.storage_path, 60 * 60);
      if (!active) return;
      if (!u) setErr('Не удалось получить ссылку. Проверьте настройки Storage.');
      else setUrl(u);
    })();
    return () => { active = false; };
  }, [doc.storage_path]);

  const renderBody = () => {
    if (err) return <div style={{ color: C.red, padding: 20 }}>⚠️ {err}</div>;
    if (!url) return <div style={{ padding: 20, color: C.textMuted }}>Подготовка…</div>;

    if (isPdf(doc.mime_type, doc.name)) {
      return (
        <iframe
          title={doc.name}
          src={url}
          style={{ width: '100%', height: '70vh', border: 'none', borderRadius: 8, background: '#fff' }}
        />
      );
    }
    if (isOfficeDoc(doc.name)) {
      const viewer = `https://docs.google.com/viewer?embedded=1&url=${encodeURIComponent(url)}`;
      return (
        <>
          <iframe
            title={doc.name}
            src={viewer}
            style={{ width: '100%', height: '70vh', border: 'none', borderRadius: 8, background: '#fff' }}
          />
          <div style={{ marginTop: 8, fontSize: 11, color: C.textMuted }}>
            Word/Excel показываем через Google Docs Viewer. Если не открывается —
            <a href={url} target="_blank" rel="noreferrer" style={{ marginLeft: 4, color: C.accent }}>откройте в новой вкладке</a> или <a href={url} download={doc.name} style={{ marginLeft: 4, color: C.accent }}>скачайте</a>.
          </div>
        </>
      );
    }
    return (
      <div style={{ padding: 20, color: C.textMuted, textAlign: 'center' }}>
        Этот тип файла не поддерживает предпросмотр.
        <div style={{ marginTop: 12 }}>
          <a href={url} download={doc.name} style={{ color: C.accent, textDecoration: 'none', fontWeight: 600 }}>
            ⬇️ Скачать файл
          </a>
        </div>
      </div>
    );
  };

  return (
    <Modal title={`📄 ${doc.name}`} onClose={onClose} C={C}>
      {renderBody()}
      {url && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <a href={url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            ↗ В новой вкладке
          </a>
          <a href={url} download={doc.name} className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
            ⬇️ Скачать
          </a>
        </div>
      )}
    </Modal>
  );
}
