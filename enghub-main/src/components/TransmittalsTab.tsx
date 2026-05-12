import React, { useState } from 'react';
import { getInp } from './ui';

type Props = {
  C: any;
  isLead: boolean;
  isGip: boolean;
  transmittals: any[];
  transmittalItems: Record<string, any[]>;
  drawings: any[];
  revisions: any[];
  depts: any[];
  recipientDeptId: string;
  setRecipientDeptId: React.Dispatch<React.SetStateAction<string>>;
  transmittalDraftLinks: Record<string, { drawingId: string; revisionId: string }>;
  setTransmittalDraftLinks: React.Dispatch<React.SetStateAction<Record<string, { drawingId: string; revisionId: string }>>>;
  createProjectTransmittal: () => void;
  changeTransmittalStatus: (transmittalId: string, status: string) => void;
  addTransmittalItem: (transmittalId: string, drawingId?: string, revisionId?: string) => void;
  onExportPdf: (transmittal: any) => void;
};

const TRANSMITTAL_STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  issued: 'Выпущен',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};

export function TransmittalsTab({
  C, isLead, isGip,
  transmittals, transmittalItems, drawings, revisions,
  depts, recipientDeptId, setRecipientDeptId,
  transmittalDraftLinks, setTransmittalDraftLinks,
  createProjectTransmittal, changeTransmittalStatus, addTransmittalItem, onExportPdf,
}: Props) {
  const [expandedDiff, setExpandedDiff] = useState<Record<string, boolean>>({});

  return (
    <div className="screen-fade">
      <div className="task-list-header">
        <div className="task-list-title">Реестр трансмитталов</div>
      </div>

      {/* C6: recipient dept + create button */}
      {(isGip || isLead) && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <select
            value={recipientDeptId}
            onChange={e => setRecipientDeptId(e.target.value)}
            style={{ ...getInp(C), height: 34, fontSize: 12, flex: 1 }}
          >
            <option value="">Получатель (отдел, опционально)</option>
            {depts.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={createProjectTransmittal}>+ Новый трансмиттал</button>
        </div>
      )}

      <div className="task-list">
        {transmittals.length === 0 && <div className="empty-state">Трансмитталов пока нет</div>}
        {transmittals.map((t) => {
          const recipientDept = depts.find((d: any) => String(d.id) === String(t.recipient_dept_id));
          const showDiff = expandedDiff[t.id];
          return (
            <div key={t.id} className="task-row panel-surface" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{t.number}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>
                    {new Date(t.created_at).toLocaleString('ru-RU')}
                    {recipientDept && <span> · Получатель: <strong style={{ color: C.text }}>{recipientDept.name}</strong></span>}
                    {!recipientDept && t.recipient && <span> · {t.recipient}</span>}
                  </div>
                </div>
                <button onClick={() => onExportPdf(t)} title="Экспорт в PDF" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.textMuted, padding: '0 4px' }}>🖨</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge">{TRANSMITTAL_STATUS_LABELS[t.status || 'draft'] || t.status || 'Черновик'}</span>
                {(isLead || isGip) && (
                  <select
                    value={t.status || 'draft'}
                    onChange={(e) => changeTransmittalStatus(t.id, e.target.value)}
                    style={{ ...getInp(C), height: 30, fontSize: 12, width: 150 }}
                  >
                    <option value="draft">Черновик</option>
                    <option value="issued">Выпущен</option>
                    <option value="delivered">Доставлен</option>
                    <option value="cancelled">Отменён</option>
                  </select>
                )}
                {/* C3: AI diff toggle button */}
                {t.ai_diff && (
                  <button
                    onClick={() => setExpandedDiff(prev => ({ ...prev, [t.id]: !showDiff }))}
                    style={{ background: 'rgba(167,139,250,.1)', border: '1px solid rgba(167,139,250,.2)', color: '#a78bfa', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {showDiff ? '▲ Скрыть' : '🤖 Что изменилось'}
                  </button>
                )}
              </div>

              {/* C3: AI diff panel */}
              {showDiff && t.ai_diff && (
                <div style={{ background: 'rgba(167,139,250,.06)', border: '1px solid rgba(167,139,250,.2)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#a78bfa', marginBottom: 6 }}>🤖 AI-анализ изменений (ChatGPT 4.0)</div>
                  <div style={{ fontSize: 12, color: '#c4b5fd', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{t.ai_diff}</div>
                </div>
              )}

              <div style={{ fontSize: 12, color: C.textMuted }}>
                Позиции: {(transmittalItems[t.id] || []).length}
              </div>

              {(transmittalItems[t.id] || []).length > 0 && (
                <div style={{ background: C.surface2, borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(transmittalItems[t.id] || []).map((it: any) => {
                    const d = Array.isArray(drawings) ? drawings.find((dr) => String(dr.id) === String(it.drawing_id)) : null;
                    const r = Array.isArray(revisions) ? revisions.find((rv) => String(rv.id) === String(it.revision_id)) : null;
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
                      setTransmittalDraftLinks((prev) => ({ ...prev, [t.id]: { drawingId: nextDrawingId, revisionId: prev[t.id]?.revisionId || '' } }));
                    }}
                    style={{ ...getInp(C), height: 30, fontSize: 12, width: 200 }}
                  >
                    <option value="">Выбрать чертеж</option>
                    {Array.isArray(drawings) && drawings.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
                  </select>
                  <select
                    value={transmittalDraftLinks[t.id]?.revisionId || ''}
                    onChange={(e) => {
                      const nextRevisionId = e.target.value;
                      setTransmittalDraftLinks((prev) => ({ ...prev, [t.id]: { drawingId: prev[t.id]?.drawingId || '', revisionId: nextRevisionId } }));
                    }}
                    style={{ ...getInp(C), height: 30, fontSize: 12, width: 220 }}
                  >
                    <option value="">Выбрать ревизию</option>
                    {Array.isArray(revisions) && revisions.map((r) => <option key={r.id} value={r.id}>{r.from_revision}→{r.to_revision}</option>)}
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
          );
        })}
      </div>
    </div>
  );
}
