import { useRef, useState } from 'react';
import type { DocType } from '../api/supabase';
import { FILE_SIZE_LIMIT, uploadProjectDocument } from '../api/supabase';
import { Modal, Field, getInp } from './ui';

const ACCEPT_DOCS = '.pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type Props = {
  C: any;
  projectId: number;
  uploadedBy: number;
  token: string;
  onClose: () => void;
  onUploaded: () => void;
  initialType?: DocType;
};

export function DocumentUploader({ C, projectId, uploadedBy, token, onClose, onUploaded, initialType = 'tz' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocType>(initialType);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFile = (f: File | null) => {
    setError(null);
    if (!f) { setFile(null); return; }
    if (f.size > FILE_SIZE_LIMIT) {
      setError(`Файл слишком большой (${(f.size / 1024 / 1024).toFixed(1)} МБ). Лимит — 50 МБ.`);
      return;
    }
    setFile(f);
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress(15);
    try {
      // визуальная имитация прогресса (fetch без onprogress)
      const tick = setInterval(() => setProgress(p => (p < 85 ? p + 7 : p)), 250);
      await uploadProjectDocument(projectId, docType, file, uploadedBy, token);
      clearInterval(tick);
      setProgress(100);
      onUploaded();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки');
      setProgress(0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="📥 Загрузка документа" onClose={onClose} C={C}>
      <div className="form-stack">
        <Field label="ТИП ДОКУМЕНТА *" C={C}>
          <select value={docType} onChange={e => setDocType(e.target.value as DocType)} style={getInp(C)} disabled={busy}>
            <option value="tz">📄 Техническое задание (ТЗ)</option>
            <option value="addendum">📑 Дополнение / приложение</option>
            <option value="other">📎 Прочий документ</option>
          </select>
        </Field>

        <Field label="ФАЙЛ * (PDF, Word, Excel — до 50 МБ)" C={C}>
          <div
            onDragOver={e => { e.preventDefault(); }}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) pickFile(f); }}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${C.border}`,
              borderRadius: 10,
              padding: 18,
              textAlign: 'center',
              cursor: busy ? 'wait' : 'pointer',
              background: C.surface2,
              color: C.textMuted,
              fontSize: 13,
              transition: 'border-color 0.15s',
            }}
          >
            {file ? (
              <>
                <div style={{ color: C.text, fontWeight: 600 }}>{file.name}</div>
                <div style={{ marginTop: 4, fontSize: 12 }}>{(file.size / 1024 / 1024).toFixed(2)} МБ</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 6 }}>⬆️</div>
                <div>Кликните или перетащите файл сюда</div>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_DOCS}
              style={{ display: 'none' }}
              onChange={e => pickFile(e.target.files?.[0] || null)}
              disabled={busy}
            />
          </div>
        </Field>

        {progress > 0 && (
          <div style={{ height: 6, background: C.surface2, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: C.accent, transition: 'width 0.2s' }} />
          </div>
        )}

        {error && (
          <div style={{ background: C.red + '12', border: `1px solid ${C.red}30`, borderRadius: 8, padding: 10, color: C.red, fontSize: 12 }}>
            ⚠️ {error}
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={submit}
          disabled={!file || busy}
          style={{ width: '100%', opacity: !file || busy ? 0.5 : 1 }}
        >
          {busy ? 'Загрузка…' : '📤 Загрузить'}
        </button>
      </div>
    </Modal>
  );
}
