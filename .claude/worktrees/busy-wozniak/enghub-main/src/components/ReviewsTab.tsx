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
  appUsers: any[];
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
  appUsers,
  submitReview,
  changeReviewStatus,
}: Props) {
  return (
    <div className="screen-fade">
      {(isGip || isLead) && (
        <div className="panel-surface" style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8 }}>
            <input value={newReview.title} onChange={(e) => setNewReview({ ...newReview, title: e.target.value })} placeholder="Текст замечания" style={getInp(C)} />
            <select value={newReview.severity} onChange={(e) => setNewReview({ ...newReview, severity: e.target.value })} style={getInp(C)}>
              <option value="minor">Незначительное</option>
              <option value="major">Существенное</option>
              <option value="critical">Критическое</option>
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
          const author = appUsers.find((u: any) => String(u.id) === String(r.author_id));
          const dateStr = r.created_at ? new Date(r.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
          return (
            <div key={r.id} className="task-row" style={{ borderLeft: `4px solid ${r.severity === 'critical' ? C.red : r.severity === 'major' ? C.orange : C.blue}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: C.text }}>{r.title}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{d ? `${d.code} — ${d.title}` : 'Без чертежа'}</div>
                {(author || dateStr) && (
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    {author && <span style={{ fontWeight: 500 }}>{author.full_name}</span>}
                    {author && dateStr && <span> · </span>}
                    {dateStr && <span>{dateStr}</span>}
                  </div>
                )}
              </div>
              <span className="badge">{{ minor: 'Незначительное', major: 'Существенное', critical: 'Критическое' }[r.severity] || r.severity}</span>
              <span style={{ fontSize: 12, color: C.textMuted }}>{{ open: 'Открыто', in_progress: 'В работе', resolved: 'Устранено', rejected: 'Отклонено' }[r.status || 'open'] || r.status}</span>
              {(isLead || isGip) && (
                <select
                  value={r.status || 'open'}
                  onChange={(e) => changeReviewStatus(r.id, e.target.value)}
                  style={{ ...getInp(C), height: 30, fontSize: 12, width: 140 }}
                >
                  <option value="open">Открыто</option>
                  <option value="in_progress">В работе</option>
                  <option value="resolved">Устранено</option>
                  <option value="rejected">Отклонено</option>
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
