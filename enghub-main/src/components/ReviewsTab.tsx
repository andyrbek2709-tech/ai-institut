import React from 'react';
import { getInp } from './ui';

type Props = {
  C: any;
  isLead: boolean;
  isGip: boolean;
  newReview: { title: string; severity: string; drawing_id: string };
  setNewReview: React.Dispatch<React.SetStateAction<{ title: string; severity: string; drawing_id: string }>>;
  drawings: any[];
  reviews: any[];
  submitReview: () => void;
  changeReviewStatus: (reviewId: string, status: string) => void;
};

export function ReviewsTab({
  C,
  isLead,
  isGip,
  newReview,
  setNewReview,
  drawings,
  reviews,
  submitReview,
  changeReviewStatus,
}: Props) {
  return (
    <div>
      {(isGip || isLead) && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8 }}>
            <input value={newReview.title} onChange={(e) => setNewReview({ ...newReview, title: e.target.value })} placeholder="Текст замечания" style={getInp(C)} />
            <select value={newReview.severity} onChange={(e) => setNewReview({ ...newReview, severity: e.target.value })} style={getInp(C)}>
              <option value="minor">minor</option>
              <option value="major">major</option>
              <option value="critical">critical</option>
            </select>
            <select value={newReview.drawing_id} onChange={(e) => setNewReview({ ...newReview, drawing_id: e.target.value })} style={getInp(C)}>
              <option value="">Без привязки</option>
              {drawings.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
            </select>
            <button className="btn btn-primary" onClick={submitReview}>+ Замечание</button>
          </div>
        </div>
      )}
      <div className="task-list">
        {reviews.length === 0 && <div className="empty-state">Замечаний пока нет</div>}
        {reviews.map((r) => {
          const d = drawings.find((dr) => String(dr.id) === String(r.drawing_id));
          return (
            <div key={r.id} className="task-row" style={{ borderLeft: `4px solid ${r.severity === 'critical' ? C.red : r.severity === 'major' ? C.orange : C.blue}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: C.text }}>{r.title}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{d ? `${d.code} — ${d.title}` : 'Без чертежа'}</div>
              </div>
              <span className="badge">{r.severity}</span>
              <span style={{ fontSize: 12, color: C.textMuted }}>{r.status || 'open'}</span>
              {(isLead || isGip) && (
                <select
                  value={r.status || 'open'}
                  onChange={(e) => changeReviewStatus(r.id, e.target.value)}
                  style={{ ...getInp(C), height: 30, fontSize: 12, width: 130 }}
                >
                  <option value="open">open</option>
                  <option value="in_progress">in_progress</option>
                  <option value="resolved">resolved</option>
                  <option value="rejected">rejected</option>
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
