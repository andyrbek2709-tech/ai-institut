import { useState, useEffect } from 'react';
import { listReviewComments, createReviewComment } from '../api/supabase';
import { AvatarComp } from './ui';
import { publishReviewCommentAdded } from '../lib/events/publisher';

interface ReviewThreadProps {
  reviewId: number;
  projectId?: string;
  currentUser: any;
  token: string;
  appUsers: any[];
  C: any;
}

export function ReviewThread({ reviewId, currentUser, token, appUsers, C }: ReviewThreadProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = async () => {
    try {
      const data = await listReviewComments(reviewId, token);
      if (Array.isArray(data)) setComments(data);
    } catch {}
  };

  useEffect(() => {
    if (expanded) load();
  }, [expanded, reviewId]);

  const getUserById = (id: any) => appUsers.find(u => u.id === id);

  const formatTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'только что';
    if (m < 60) return `${m} мин`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ч`;
    return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const handleSend = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      const payload: any = {
        review_id: reviewId,
        author_id: currentUser?.id,
        text: text.trim(),
      };
      if (replyTo) payload.parent_id = replyTo.id;
      await createReviewComment(payload, token);
      setText('');
      setReplyTo(null);
      // Publish review.comment_added event (task_id is empty as reviews are on drawings)
      if (projectId && currentUser?.id) {
        publishReviewCommentAdded('', projectId, String(currentUser.id), String(reviewId), { comment: text.trim() }).catch((err) => {
          console.warn('[Events] Failed to publish review.comment_added:', err);
        });
      }
      await load();
    } catch {}
    setSaving(false);
  };

  // Build thread tree: top-level + nested replies
  const topLevel = comments.filter(c => !c.parent_id);
  const getReplies = (parentId: number) => comments.filter(c => c.parent_id === parentId);

  const rootCount = topLevel.length;

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 12, color: C.accent, display: 'flex', alignItems: 'center', gap: 4, padding: 0,
        }}
      >
        💬 {expanded ? 'Скрыть' : `Обсуждение${rootCount > 0 ? ` (${comments.length})` : ''}`}
      </button>

      {expanded && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Thread */}
          {topLevel.map(comment => {
            const author = getUserById(comment.author_id);
            const replies = getReplies(comment.id);
            return (
              <div key={comment.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Top-level comment */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <AvatarComp user={author} size={28} C={C} />
                  <div style={{
                    flex: 1, background: C.surface2, borderRadius: '0 10px 10px 10px',
                    padding: '8px 12px', border: `1px solid ${C.border}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{author?.full_name || 'Пользователь'}</span>
                      <span style={{ fontSize: 11, color: C.textMuted }}>{formatTime(comment.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{comment.text}</div>
                    <button
                      onClick={() => setReplyTo(replyTo?.id === comment.id ? null : comment)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: C.accent, marginTop: 4, padding: 0, fontFamily: 'inherit' }}
                    >
                      ↩ Ответить
                    </button>
                  </div>
                </div>

                {/* Replies */}
                {replies.map(reply => {
                  const replyAuthor = getUserById(reply.author_id);
                  return (
                    <div key={reply.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', paddingLeft: 36 }}>
                      <AvatarComp user={replyAuthor} size={24} C={C} />
                      <div style={{
                        flex: 1, background: C.surface2, borderRadius: '0 10px 10px 10px',
                        padding: '7px 11px', border: `1px solid ${C.border}`,
                        borderLeft: `3px solid ${C.accent}`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{replyAuthor?.full_name || 'Пользователь'}</span>
                          <span style={{ fontSize: 11, color: C.textMuted }}>{formatTime(reply.created_at)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.text }}>{reply.text}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Input */}
          {replyTo && (
            <div style={{ fontSize: 12, color: C.accent, background: C.accent + '10', padding: '4px 10px', borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span>↩ Ответ на: {getUserById(replyTo.author_id)?.full_name || 'сообщение'}</span>
              <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 13 }}>✕</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Написать комментарий..."
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13,
                border: `1px solid ${C.border}`, background: C.surface2,
                color: C.text, outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || saving}
              style={{
                padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600,
                opacity: !text.trim() ? 0.5 : 1, fontFamily: 'inherit',
              }}
            >
              {saving ? '...' : '↑'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
