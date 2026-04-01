import React from 'react';
import { getInp } from './ui';

type Props = {
  C: any;
  isLead: boolean;
  isGip: boolean;
  transmittals: any[];
  transmittalItems: Record<string, any[]>;
  drawings: any[];
  revisions: any[];
  transmittalDraftLinks: Record<string, { drawingId: string; revisionId: string }>;
  setTransmittalDraftLinks: React.Dispatch<React.SetStateAction<Record<string, { drawingId: string; revisionId: string }>>>;
  createProjectTransmittal: () => void;
  changeTransmittalStatus: (transmittalId: string, status: string) => void;
  addTransmittalItem: (transmittalId: string, drawingId?: string, revisionId?: string) => void;
  onExportPdf: (transmittal: any) => void;
};

export function TransmittalsTab({
  C,
  isLead,
  isGip,
  transmittals,
  transmittalItems,
  drawings,
  revisions,
  transmittalDraftLinks,
  setTransmittalDraftLinks,
  createProjectTransmittal,
  changeTransmittalStatus,
  addTransmittalItem,
  onExportPdf,
}: Props) {
  return (
    <div className="screen-fade">
      <div className="task-list-header">
        <div className="task-list-title">Реестр трансмитталов</div>
        {(isGip || isLead) && <button className="btn btn-primary" onClick={createProjectTransmittal}>+ Новый трансмиттал</button>}
      </div>
      <div className="task-list">
        {transmittals.length === 0 && <div className="empty-state">Трансмитталов пока нет</div>}
        {transmittals.map((t) => (
          <div key={t.id} className="task-row panel-surface" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{t.number}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{new Date(t.created_at).toLocaleString()}</div>
              </div>
              <button onClick={() => onExportPdf(t)} title="Экспорт в PDF" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.textMuted, padding: '0 4px' }}>🖨</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge">{t.status || 'draft'}</span>
              {(isLead || isGip) && (
                <select
                  value={t.status || 'draft'}
                  onChange={(e) => changeTransmittalStatus(t.id, e.target.value)}
                  style={{ ...getInp(C), height: 30, fontSize: 12, width: 150 }}
                >
                  <option value="draft">draft</option>
                  <option value="issued">issued</option>
                  <option value="delivered">delivered</option>
                  <option value="cancelled">cancelled</option>
                </select>
              )}
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              Позиции: {(transmittalItems[t.id] || []).length}
            </div>
            {(transmittalItems[t.id] || []).length > 0 && (
              <div style={{ background: C.surface2, borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(transmittalItems[t.id] || []).map((it: any) => {
                  const d = drawings.find((dr) => String(dr.id) === String(it.drawing_id));
                  const r = revisions.find((rv) => String(rv.id) === String(it.revision_id));
                  return (
                    <div key={it.id} style={{ fontSize: 12, color: C.text }}>
                      • {d ? `${d.code}` : '—'} {r ? `(${r.from_revision}→${r.to_revision})` : ''} {it.note ? `— ${it.note}` : ''}
                    </div>
                  );
                })}
              </div>
            )}
            {(isLead || isGip) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select
                  value={transmittalDraftLinks[t.id]?.drawingId || ''}
                  onChange={(e) => {
                    const nextDrawingId = e.target.value;
                    setTransmittalDraftLinks((prev) => ({
                      ...prev,
                      [t.id]: { drawingId: nextDrawingId, revisionId: prev[t.id]?.revisionId || '' },
                    }));
                  }}
                  style={{ ...getInp(C), height: 30, fontSize: 12, width: 200 }}
                >
                  <option value="">Выбрать чертеж</option>
                  {drawings.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
                </select>
                <select
                  value={transmittalDraftLinks[t.id]?.revisionId || ''}
                  onChange={(e) => {
                    const nextRevisionId = e.target.value;
                    setTransmittalDraftLinks((prev) => ({
                      ...prev,
                      [t.id]: { drawingId: prev[t.id]?.drawingId || '', revisionId: nextRevisionId },
                    }));
                  }}
                  style={{ ...getInp(C), height: 30, fontSize: 12, width: 220 }}
                >
                  <option value="">Выбрать ревизию</option>
                  {revisions.map((r) => <option key={r.id} value={r.id}>{r.from_revision}→{r.to_revision}</option>)}
                </select>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const dSel = transmittalDraftLinks[t.id]?.drawingId || '';
                    const rSel = transmittalDraftLinks[t.id]?.revisionId || '';
                    addTransmittalItem(t.id, dSel || undefined, rSel || undefined);
                  }}
                >
                  + Позиция
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
