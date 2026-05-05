import React from 'react';
import { getInp } from './ui';
import { ReviewThread } from './ReviewThread';

type Props = {
  C: any;
  isLead: boolean;
  isGip: boolean;
  newReview: { title: string; severity: string; drawing_id: string };
  setNewReview: React.Dispatch<React.SetStateAction<{ title: string; severity: string; drawing_id: string }>>;
  drawings: any[];
  reviews: any[];
  appUsers: any[];
  currentUser: any;
  token: string;
  submitReview: () => void;
  changeReviewStatus: (reviewId: string, status: string) => void;
  projectId?: string;
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
  currentUser,
  token,
  submitReview,
  changeReviewStatus,
  projectId,
}: Props) {
  return (
    <div className="screen-fade">
      {(isGip || isLead) && (
        <div className="panel-surface" style={{ padding: 14, marginBottom: 14 }}>
          {/* FIX: changed from 4-column grid (button was cut off) to flex-wrap so button always visible */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <input value={newReview.title} onChange={(e) => setNewReview({ ...newReview, title: e.target.value })} placeholder="Текст замечания" style={{ ...getInp(C), flex: '2 1 200px', minWidth: 0 }} />
            <select value={newReview.severity} onChange={(e) => setNewReview({ ...newReview, severity: e.target.value })} style={{ ...getInp(C), flex: '1 1 140px', minWidth: 0 }}>
              <option value="minor">Незначительное</option>
              <option value="major">Существенное</option>
              <option value="critical">Критическое</option>
            </select>
            <select value={newReview.drawing_id} onChange={(e) => setNewReview({ ...newReview, drawing_id: e.target.value })} style={{ ...getInp(C), flex: '1 1 140px', minWidth: 0 }}>
              <option value="">Без привязки</option>
              {drawings.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
            </select>
            <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={submitReview}>+ Замечание</button>
          </div>
        </div>
      )}
      <div className="task-list">
        {reviews.length === 0 && <div className="empty-state">Замечаний пока нет</div>}
        {reviews.map((r) => {
          const d = drawings.find((dr) => String(dr.id) === String(r.drawing_id));
          const author = appUsers.find((u: any) => u.id === r.author_id);
          const createdDate = r.created_at ? new Date(r.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
          return (
            <div key={r.id} className="task-row" style={{ borderLeft: `4px solid ${r.severity === 'critical' ? C.red : r.severity === 'major' ? C.orange : C.blue}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: C.text }}>{r.title}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{d ? `${d.code} — ${d.title}` : 'Без чертежа'}</div>
                {(author || createdDate) && (
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    {author && <span>{author.full_name}</span>}
                    {author && createdDate && <span> · </span>}
                    {createdDate && <span>{createdDate}</span>}
                  </div>
                )}
                <ReviewThread
                  reviewId={r.id}
                  projectId={projectId}
                  currentUser={currentUser}
                  token={token}
                  appUsers={appUsers}
                  C={C}
                />
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
