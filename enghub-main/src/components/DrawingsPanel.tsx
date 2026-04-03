import { useMemo, useState } from 'react';
import { drawingStatusMap } from '../constants';
import { getInp } from './ui';

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
};

type Props = {
  C: any;
  canEdit: boolean;
  drawings: Drawing[];
  onCreate: (payload: Partial<Drawing>) => Promise<void>;
  onUpdate: (id: string, payload: Partial<Drawing>) => Promise<void>;
};

const emptyForm = {
  code: '',
  title: '',
  discipline: '',
  stage: 'P',
  due_date: '',
};

export function DrawingsPanel({ C, canEdit, drawings, onCreate, onUpdate }: Props) {
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return drawings;
    return drawings.filter((d) =>
      [d.code, d.title, d.discipline, d.stage, d.revision].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [drawings, search]);

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
      <div className="task-list-header">
        <div className="task-list-title">Реестр чертежей</div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по коду/названию"
          style={{ ...getInp(C), width: 260, borderRadius: 10, height: 38 }}
        />
      </div>

      {canEdit && (
        <div className="panel-surface" style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 0.6fr 1fr auto', gap: 8 }}>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Марка (АР-101)" style={getInp(C)} />
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Наименование" style={getInp(C)} />
            <input value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })} placeholder="Дисциплина" style={getInp(C)} />
            <input value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} placeholder="Стадия" style={getInp(C)} />
            <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} style={getInp(C)} />
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !form.code || !form.title}>
              {saving ? '...' : '+ Чертеж'}
            </button>
          </div>
        </div>
      )}

      <div className="panel-surface" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                    {!canEdit && <span className="badge" style={{ color: st.color, background: st.bg, border: `1px solid ${st.color}35` }}>{st.label}</span>}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, color: C.textDim }}>{d.due_date || '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}` }}>
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
