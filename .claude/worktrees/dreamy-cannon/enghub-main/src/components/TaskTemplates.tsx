import { useState, useEffect } from 'react';
import { get } from '../api/supabase';

const PRIORITY_LABEL: Record<string, string> = { high: '🔴 Высокий', medium: '🟡 Средний', low: '⚪ Низкий' };
const DEPT_COLORS: Record<string, string> = {
  КМ: '#4a9eff', КЖ: '#2ac769', ОВ: '#a855f7', ВК: '#06b6d4',
  ЭО: '#f5a623', ТХ: '#ff8c42', ГП: '#ef4444', ГИП: '#8896a8',
};

interface TaskTemplatesProps {
  token: string;
  C: any;
  onApply: (template: any) => void;
  onClose: () => void;
}

export function TaskTemplates({ token, C, onApply, onClose }: TaskTemplatesProps) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeDept, setActiveDept] = useState('all');

  useEffect(() => {
    get('task_templates?order=dept.asc,name.asc', token)
      .then(data => { if (Array.isArray(data)) setTemplates(data); })
      .catch(() => {});
  }, [token]);

  const depts = ['all', ...Array.from(new Set(templates.map(t => t.dept))).sort()];

  const filtered = templates.filter(t => {
    if (activeDept !== 'all' && t.dept !== activeDept) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.dept.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: C.surface, borderRadius: 16, width: 560, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        border: `1px solid ${C.border}`,
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>📋 Шаблоны задач</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Выберите шаблон — поля формы заполнятся автоматически</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        {/* Search + dept filter */}
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Найти шаблон..."
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              border: `1px solid ${C.border}`, background: C.surface2,
              color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {depts.map(d => (
              <button
                key={d}
                onClick={() => setActiveDept(d)}
                style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${activeDept === d ? C.accent : C.border}`,
                  background: activeDept === d ? C.accent + '20' : 'transparent',
                  color: activeDept === d ? C.accent : C.textMuted,
                  fontWeight: activeDept === d ? 600 : 400,
                }}
              >
                {d === 'all' ? 'Все' : d}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 12px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Ничего не найдено</div>
          ) : filtered.map(t => (
            <div
              key={t.id}
              onClick={() => { onApply(t); onClose(); }}
              style={{
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid transparent`, marginBottom: 4,
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = C.surface2;
                e.currentTarget.style.borderColor = C.border;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: (DEPT_COLORS[t.dept] || '#8896a8') + '20',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: DEPT_COLORS[t.dept] || '#8896a8',
              }}>
                {t.dept}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>{t.name}</div>
                {t.description && (
                  <div style={{ fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.description}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: C.textMuted }}>{PRIORITY_LABEL[t.priority]}</span>
                {t.duration_days && (
                  <span style={{ fontSize: 11, color: C.textMuted }}>📅 {t.duration_days} дн</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.textMuted, textAlign: 'center' }}>
          {filtered.length} шаблон{filtered.length === 1 ? '' : filtered.length < 5 ? 'а' : 'ов'} • Кликните для применения
        </div>
      </div>
    </div>
  );
}
