import React from 'react';

type Props = {
  C: any;
  isLead: boolean;
  isGip: boolean;
  drawings: any[];
  revisions: any[];
  appUsers: any[];
  issueDrawingRevision: (drawing: any) => void;
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
  return (
    <div className="screen-fade">
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
              <button className="btn btn-ghost btn-sm" onClick={() => issueDrawingRevision(d)}>+ Ревизия</button>
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
