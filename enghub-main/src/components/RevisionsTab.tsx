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
  const [pendingDrawing, setPendingDrawing] = useState<any>(null);
  const [revComment, setRevComment] = useState('');

  const confirmRevision = () => {
    if (!pendingDrawing) return;
    issueDrawingRevision(pendingDrawing, revComment);
    setPendingDrawing(null);
    setRevComment('');
  };

  return (
    <div className="screen-fade">
      {pendingDrawing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.surface, borderRadius: 16, padding: 28, width: 420, maxWidth: '90vw', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 12 }}>Создать ревизию?</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
              {pendingDrawing.revision || 'R0'} → R{(parseInt((pendingDrawing.revision || 'R0').replace('R', '')) + 1)} для чертежа <b style={{ color: C.text }}>{pendingDrawing.code}</b>
            </div>
            <textarea
              value={revComment}
              onChange={e => setRevComment(e.target.value)}
              placeholder="Причина/комментарий (необязательно)"
              rows={3}
              style={{ width: '100%', resize: 'vertical', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setPendingDrawing(null); setRevComment(''); }}>Отмена</button>
              <button className="btn btn-primary" onClick={confirmRevision}>Создать</button>
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
              <button className="btn btn-ghost btn-sm" onClick={() => setPendingDrawing(d)}>+ Ревизия</button>
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
