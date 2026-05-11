import { useMemo, useState, useRef } from 'react';
import { uploadDrawingFile, deleteDrawingFile, signProjectFileUrl } from '../api/supabase';
import { drawingStatusMap } from '../constants';
import { getInp, RuDateInput } from './ui';

const STATUS_ORDER = ['draft', 'in_work', 'review', 'approved', 'issued'];

function DrawingStatusPipeline({ drawings, C, activeFilter, onFilter }: { drawings: any[]; C: any; activeFilter: string; onFilter: (s: string) => void }) {
  const total = drawings.length;
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'stretch', marginBottom: 14, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}` }}>
      {STATUS_ORDER.map((key, idx) => {
        const st = drawingStatusMap[key];
        const count = drawings.filter(d => (d.status || 'draft') === key).length;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const isActive = activeFilter === key;
        return (
          <button
            key={key}
            onClick={() => onFilter(isActive ? 'all' : key)}
            title={`${st.label}: ${count} чертежей (${pct}%)`}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '10px 8px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: isActive ? st.color + '25' : C.surface2,
              borderRight: idx < STATUS_ORDER.length - 1 ? `1px solid ${C.border}` : 'none',
              transition: 'background 0.15s',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: st.color }}>{count}</div>
            <div style={{ fontSize: 10, color: isActive ? st.color : C.textMuted, fontWeight: isActive ? 700 : 400, whiteSpace: 'nowrap' }}>{st.label}</div>
            <div style={{ width: '100%', height: 3, borderRadius: 2, background: C.border, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: st.color, transition: 'width 0.3s' }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DrawingStatusStepper({ status, C }: { status: string; C: any }) {
  const idx = STATUS_ORDER.indexOf(status || 'draft');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {STATUS_ORDER.map((key, i) => {
        const st = drawingStatusMap[key];
        const done = i < idx;
        const current = i === idx;
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <div title={st.label} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: current ? st.color : done ? st.color + '80' : C.border,
              border: current ? `2px solid ${st.color}` : 'none',
              transition: 'background 0.2s',
            }} />
            {i < STATUS_ORDER.length - 1 && (
              <div style={{ width: 10, height: 1, background: done ? C.accent + '60' : C.border }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

type Drawing = {
  id: string;
  project_id: number;
  code: string;
  title: string;
  discipline?: string;
  stage?: string;
  status?: string;
  revision?: string;
  due_date?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
};

type Props = {
  C: any;
  canEdit: boolean;
  drawings: Drawing[];
  onCreate: (payload: Partial<Drawing>) => Promise<void>;
  onUpdate: (id: string, payload: Partial<Drawing>) => Promise<void>;
  userRole?: string;
  token?: string;
};

const emptyForm = {
  code: '',
  title: '',
  discipline: '',
  stage: 'P',
  due_date: '',
};

export function DrawingsPanel({ C, canEdit, drawings, onCreate, onUpdate, userRole = 'engineer', token = '' }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState<string | null>(null); // drawing id being analyzed
  const [aiResult, setAiResult] = useState<{ drawingCode: string; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analyzeDrawingRef = useRef<Drawing | null>(null);
  const [fileUploading, setFileUploading] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadDrawingRef = useRef<Drawing | null>(null);

  const handleAnalyzeClick = (d: Drawing) => {
    analyzeDrawingRef.current = d;
    fileInputRef.current?.click();
  };

  const handleUploadClick = (d: Drawing) => {
    uploadDrawingRef.current = d;
    uploadInputRef.current?.click();
  };

  const handleUploadFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const drawing = uploadDrawingRef.current;
    if (!file || !drawing) return;
    e.target.value = '';
    setFileUploading(drawing.id);
    try {
      await uploadDrawingFile(drawing.id, drawing.project_id, file, token);
      await onUpdate(drawing.id, {});
    } catch (err: any) {
      alert(err.message || 'Ошибка загрузки файла');
    } finally {
      setFileUploading(null);
    }
  };

  const handleDownloadDrawing = async (d: Drawing) => {
    if (!d.file_url) return;
    const url = await signProjectFileUrl(d.file_url, 3600);
    if (url) window.open(url, '_blank');
  };

  const handleDeleteDrawingFile = async (d: Drawing) => {
    if (!d.file_url) return;
    if (!confirm(`Удалить файл "\${d.file_name || d.file_url}"?`)) return;
    try {
      await deleteDrawingFile(d.id, d.file_url, token);
      await onUpdate(d.id, {});
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления файла');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const drawing = analyzeDrawingRef.current;
    if (!file || !drawing) return;
    e.target.value = '';

    const MAX_SIZE = 4 * 1024 * 1024; // 4 MB
    if (file.size > MAX_SIZE) { alert('Файл слишком большой. Максимум 4 МБ.'); return; }

    setAiAnalyzing(drawing.id);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // strip data:image/...;base64,
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const mediaType = file.type || 'image/png';
      const apiUrl = `${process.env.REACT_APP_RAILWAY_API_URL || ''}/api/orchestrator`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          action: 'analyze_drawing',
          image_base64: base64,
          media_type: mediaType,
          drawing_code: drawing.code,
          drawing_title: drawing.title,
          discipline: drawing.discipline,
          role: userRole,
        }),
      });
      const data = await res.json();
      setAiResult({ drawingCode: drawing.code, message: data.message || 'Анализ недоступен.' });
    } catch (err) {
      setAiResult({ drawingCode: drawing.code, message: 'Ошибка при анализе чертежа.' });
    } finally {
      setAiAnalyzing(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drawings.filter((d) => {
      if (statusFilter !== 'all' && (d.status || 'draft') !== statusFilter) return false;
      if (q && ![d.code, d.title, d.discipline, d.stage, d.revision].filter(Boolean).join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [drawings, search, statusFilter]);

  const handleCreate = async () => {
    if (!form.code.trim() || !form.title.trim() || !canEdit) return;
    setSaving(true);
    try {
      await onCreate({
        code: form.code.trim(),
        title: form.title.trim(),
        discipline: form.discipline.trim() || null,
        stage: form.stage || 'P',
        due_date: form.due_date || null,
        status: 'draft',
        revision: 'R0',
      });
      setForm(emptyForm);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen-fade">
      {/* Hidden file input for AI drawing analysis */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
        style={{ display: 'none' }}
        onChange={handleUploadFileChange}
      />

      {/* AI Analysis result modal */}
      {aiResult && (
        <div className="modal-overlay" onClick={() => setAiResult(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div className="modal-title">🤖 AI-нормоконтроль: {aiResult.drawingCode}</div>
              <button className="modal-close" onClick={() => setAiResult(null)}>✕</button>
            </div>
            <div style={{ padding: '16px 20px', fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {aiResult.message}
            </div>
          </div>
        </div>
      )}

      <div className="task-list-header">
        <div className="task-list-title">Реестр чертежей</div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по коду/названию"
          style={{ ...getInp(C), width: 260, borderRadius: 10, height: 38 }}
        />
      </div>

      {drawings.length > 0 && (
        <DrawingStatusPipeline drawings={drawings} C={C} activeFilter={statusFilter} onFilter={setStatusFilter} />
      )}

      {canEdit && (
        <div className="panel-surface" style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 0.6fr 1fr auto', gap: 8 }}>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Марка (АР-101)" style={getInp(C)} />
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Наименование" style={getInp(C)} />
            <input value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })} placeholder="Дисциплина" style={getInp(C)} />
            <input value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} placeholder="Стадия" style={getInp(C)} />
            <RuDateInput value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} C={C} />
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !form.code || !form.title}>
              {saving ? '...' : '+ Чертеж'}
            </button>
          </div>
        </div>
      )}

      <div className="panel-surface" style={{ overflowX: 'auto' }}>{/* FIX: auto scroll instead of hidden — prevents sidebar expansion on horizontal scroll */}
        <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.surface2 }}>
              {['Код', 'Наименование', 'Дисциплина', 'Стадия', 'Ревизия', 'Статус', 'Срок', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.textMuted }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 22, textAlign: 'center', color: C.textMuted }}>Чертежей пока нет</td>
              </tr>
            )}
            {filtered.map((d) => {
              const st = drawingStatusMap[d.status || 'draft'] || drawingStatusMap.draft;
              return (
                <tr key={d.id}>
                  <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, color: C.text, fontWeight: 600 }}>{d.code}</td>
                  <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, color: C.text }}>{d.title}</td>
                  <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, color: C.textDim }}>{d.discipline || '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, color: C.textDim }}>{d.stage || '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, color: C.accent, fontWeight: 700 }}>{d.revision || 'R0'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <span className="badge" style={{ color: st.color, background: st.bg, border: `1px solid ${st.color}35`, width: 'fit-content' }}>{st.label}</span>
                      <DrawingStatusStepper status={d.status || 'draft'} C={C} />
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, color: C.textDim }}>{d.due_date || '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {canEdit && (
                        <select
                          value={d.status || 'draft'}
                          onChange={(e) => onUpdate(d.id, { status: e.target.value })}
                          style={{ ...getInp(C), height: 32, fontSize: 12, minWidth: 120 }}
                        >
                          {Object.entries(drawingStatusMap).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      )}
                      <button
                        title="AI-нормоконтроль (загрузить скриншот чертежа)"
                        onClick={() => handleAnalyzeClick(d)}
                        disabled={aiAnalyzing === d.id}
                        style={{
                          background: '#a855f720', border: '1px solid #a855f740', borderRadius: 6,
                          padding: '4px 8px', cursor: 'pointer', fontSize: 13, color: '#a855f7',
                          fontFamily: 'inherit', whiteSpace: 'nowrap',
                        }}
                      >
                        {aiAnalyzing === d.id ? '⏳' : '🤖 AI'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
