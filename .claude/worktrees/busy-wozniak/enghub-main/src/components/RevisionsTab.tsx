import React, { useState } from 'react';

type Props = {
  C: any;
  isLead: boolean;
  isGip: boolean;
  drawings: any[];
  revisions: any[];
  appUsers: any[];
  issueDrawingRevision: (drawing: any, comment?: string) => void;
};

export function RevisionsTab({
  C,
  isLead,
  isGip,
  drawings,
  revisions,
  appUsers,
  issueDrawingRevision,
}: Props) {
  const [confirm, setConfirm] = useState<{ drawing: any } | null>(null);
  const [comment, setComment] = useState('');

  const handleConfirm = () => {
    if (!confirm) return;
    issueDrawingRevision(confirm.drawing, comment);
    setConfirm(null);
    setComment('');
  };

  const nextRev = (d: any) => {
    const cur = d.revision || 'R0';
    const n = parseInt(cur.replace(/\D/g, '') || '0', 10);
    return `R${n + 1}`;
  };

  return (
    <div className="screen-fade">
      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, width: 420, boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Создать ревизию?</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
              {confirm.drawing.code}: {confirm.drawing.revision || 'R0'} → {nextRev(confirm.drawing)}
            </div>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Причина / комментарий (необязательно)"
              rows={3}
              style={{ width: '100%', background: C.surface2, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: '8px 10px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setConfirm(null); setComment(''); }}>Отмена</button>
              <button className="btn btn-primary" onClick={handleConfirm}>Создать</button>
            </div>
          </div>
        </div>
      )}
      <div className="task-list-header">
        <div className="task-list-title">История ревизий</div>
        <div style={{ fontSize: 12, color: C.textMuted }}>
          Всего записей: {revisions.length}
        </div>
      </div>
      <div className="task-list" style={{ marginBottom: 16 }}>
        {drawings.map((d) => (
          <div key={d.id} className="task-row">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{d.code} — {d.title}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>Текущая ревизия: {d.revision || 'R0'}</div>
            </div>
            {(isGip || isLead) && (
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirm({ drawing: d })}>+ Ревизия</button>
            )}
          </div>
        ))}
        {drawings.length === 0 && <div className="empty-state">Нет чертежей для ревизии</div>}
      </div>
      <div className="panel-surface" style={{ padding: 14 }}>
        <div className="page-label" style={{ marginBottom: 10 }}>Журнал</div>
        {revisions.length === 0 ? <div className="empty-state">Записей ревизий пока нет</div> : revisions.map((r) => {
          const d = drawings.find((dr) => String(dr.id) === String(r.drawing_id));
          const issuer = appUsers.find((u) => String(u.id) === String(r.issued_by));
          return (
            <div key={r.id} className="task-row">
              <span style={{ color: C.text }}>{d?.code || '—'}</span>
              <span style={{ color: C.textMuted }}>{r.from_revision} → {r.to_revision}</span>
              <span style={{ color: C.textMuted }}>{issuer?.full_name || 'Система'}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: C.textMuted }}>{new Date(r.created_at).toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
