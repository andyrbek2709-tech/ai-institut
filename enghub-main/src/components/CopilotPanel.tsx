import React, { useState, useEffect, useRef } from 'react';
import { get, post, patch } from '../api/supabase';

interface AIAction {
  id: string;
  action_type: string;
  agent_type: string;
  payload: any;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface ChatMsg {
  role: 'user' | 'ai';
  text: string;
}

export function CopilotPanel({ 
  projectId, 
  userId, 
  userRole,
  C, 
  onClose,
  onTaskCreated, // Callback to refresh Kanban when AI creates tasks
  onDataChanged // Callback to refresh drawings/reviews/revisions/transmittals
}: any) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'ai', text: 'Привет! Я AI-Оркестратор. Могу проанализировать проект, распределить задачи или проверить сроки. Чем могу помочь?' }
  ]);
  const [input, setInput] = useState('');
  const [actions, setActions] = useState<AIAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [useKB, setUseKB] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Polling ai_actions
  const fetchActions = async () => {
    try {
      const token = localStorage.getItem('enghub_token');
      const data = await get(`ai_actions?project_id=eq.${projectId}&order=created_at.desc`, token || '');
      if (Array.isArray(data)) {
        setActions(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchActions();
    const iv = setInterval(fetchActions, 3000);
    return () => clearInterval(iv);
  }, [projectId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, actions]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userText = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInput('');
    setLoading(true);

    // Real Orchestrator Backend API call
    try {
      const res = await fetch('/api/orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          project_id: projectId,
          message: userText,
          use_rag: useKB,
          role: userRole || 'engineer'
        })
      });

      const data = await res.json();
      
      if (data.blocked) {
        setMessages(prev => [...prev, { role: 'ai', text: `⛔ ${data.message || 'Действие заблокировано правилами.'}` }]);
      } else if (data.message) {
        setMessages(prev => [...prev, { role: 'ai', text: data.message }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: 'Запрос обработан.' }]);
      }
      
      if (data.action_id || data.agent === 'task_manager' || data.agent === 'drawing_agent' || data.agent === 'review_agent' || data.agent === 'register_agent') {
          // Refresh feed to show the newly inserted pending action
          fetchActions();
      }
    } catch (e) {
      console.error("Orchestrator error:", e);
      setMessages(prev => [...prev, { role: 'ai', text: 'Ошибка соединения с Оркестратором. Пожалуйста, попробуйте позже.' }]);
    } finally {
      setLoading(false);
    }
  };

  const applyAction = async (action: AIAction, approved: boolean) => {
    try {
      const token = localStorage.getItem('enghub_token');
      const payload = action.payload || {};
      if (approved && action.action_type === 'update_drawing' && !action.payload?.drawing_id) {
        setMessages(prev => [...prev, { role: 'ai', text: 'Невозможно применить update_drawing: отсутствует drawing_id.' }]);
        return;
      }
      if (approved && (action.action_type === 'create_drawing_revision' || action.action_type === 'create_revision') && !action.payload?.drawing_id) {
        setMessages(prev => [...prev, { role: 'ai', text: 'Невозможно применить ревизию: отсутствует drawing_id.' }]);
        return;
      }
      if (approved && action.action_type === 'create_tasks' && !Array.isArray(payload.tasks)) {
        setMessages(prev => [...prev, { role: 'ai', text: 'Невозможно применить create_tasks: payload.tasks отсутствует.' }]);
        return;
      }
      if (approved && action.action_type === 'create_drawing' && (!payload.code || !payload.title)) {
        setMessages(prev => [...prev, { role: 'ai', text: 'Невозможно применить create_drawing: отсутствует code или title.' }]);
        return;
      }
      if (approved && action.action_type === 'create_review' && !payload.title) {
        setMessages(prev => [...prev, { role: 'ai', text: 'Невозможно применить create_review: отсутствует title.' }]);
        return;
      }
      
      if (approved && action.action_type === 'create_tasks') {
        for (const t of payload.tasks) {
          await post('tasks', {
            project_id: projectId,
            name: t.title,
            priority: t.priority,
            status: 'todo',
            assigned_to: null
          }, token || '');
        }
        onTaskCreated();
      }

      if (approved && action.action_type === 'create_drawing') {
        await post('drawings', {
          project_id: projectId,
          code: payload.code,
          title: payload.title,
          discipline: payload.discipline || null,
          status: 'draft',
          revision: 'R0',
          created_by: userId
        }, token || '');
        onDataChanged?.();
      }

      if (approved && action.action_type === 'update_drawing' && payload?.drawing_id) {
        await patch(`drawings?id=eq.${payload.drawing_id}`, payload.updates || {}, token || '');
        onDataChanged?.();
      }

      if (approved && (action.action_type === 'create_drawing_revision' || action.action_type === 'create_revision') && payload?.drawing_id) {
        const drawingRows = await get(`drawings?id=eq.${payload.drawing_id}&select=id,revision,project_id`, token || '');
        const drawing = Array.isArray(drawingRows) ? drawingRows[0] : null;
        const revNum = Number(String(drawing?.revision || 'R0').replace('R', '')) + 1;
        const nextRev = `R${Number.isFinite(revNum) ? revNum : 1}`;
        await post('revisions', {
          project_id: drawing?.project_id || projectId,
          drawing_id: payload.drawing_id,
          from_revision: drawing?.revision || 'R0',
          to_revision: nextRev,
          issued_by: userId
        }, token || '');
        await patch(`drawings?id=eq.${payload.drawing_id}`, { revision: nextRev, status: 'in_work' }, token || '');
        onDataChanged?.();
      }

      if (approved && action.action_type === 'create_review') {
        await post('reviews', {
          project_id: projectId,
          drawing_id: payload?.drawing_id || null,
          title: payload?.title || 'Замечание',
          severity: payload?.severity || 'major',
          status: 'open',
          author_id: userId
        }, token || '');
        onDataChanged?.();
      }

      if (approved && action.action_type === 'create_transmittal') {
        await post('transmittals', {
          project_id: projectId,
          number: payload?.number || `TR-${projectId}-${Date.now()}`,
          recipient: payload?.recipient || null,
          note: payload?.note || null,
          status: 'draft',
          issued_by: userId
        }, token || '');
        onDataChanged?.();
      }

      // Update action status
      await patch(`ai_actions?id=eq.${action.id}`, {
        status: approved ? 'approved' : 'rejected'
      }, token || '');
      
      fetchActions();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 400,
      background: C.surface, borderLeft: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', zIndex: 1000,
      boxShadow: '-4px 0 15px rgba(0,0,0,0.05)'
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.surface2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #FF3366, #FF9933)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>AI</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>AI Copilot</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>Orchestrator v1.0</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 20 }}>✕</button>
      </div>

      {/* RAG Toggle */}
      <div style={{ padding: '10px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: useKB ? C.accent + '10' : 'transparent' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: useKB ? C.accent : C.textDim }}>
          <span>{useKB ? '🔍 Поиск по базе знаний ВКЛ' : '🌐 Обычный режим'}</span>
        </div>
        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: 44, height: 22 }}>
            <input type="checkbox" checked={useKB} onChange={() => setUseKB(!useKB)} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{ 
                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                backgroundColor: useKB ? C.accent : C.border, transition: '.4s', borderRadius: 34 
            }}>
                <span style={{ 
                    position: 'absolute', content: '""', height: 16, width: 16, left: useKB ? 25 : 3, bottom: 3, 
                    backgroundColor: 'white', transition: '.4s', borderRadius: '50%' 
                }}></span>
            </span>
        </label>
      </div>

      {/* Action Feed & Chat Area */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              background: m.role === 'user' ? C.accent : C.surface2,
              color: m.role === 'user' ? '#fff' : C.text,
              padding: '10px 14px', borderRadius: 12, maxWidth: '85%',
              fontSize: 14, lineHeight: 1.4,
              borderBottomRightRadius: m.role === 'user' ? 2 : 12,
              borderBottomLeftRadius: m.role === 'ai' ? 2 : 12,
            }}>
              {m.text}
            </div>
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: C.surface2, color: C.text, padding: '10px 14px', borderRadius: 12, borderBottomLeftRadius: 2, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="jumping-dots"><span>.</span><span>.</span><span>.</span></span>
              <span>Оркестратор работает</span>
            </div>
          </div>
        )}

        {/* Action Feed (Pending Actions) */}
        {actions.filter(a => a.status === 'pending').map(action => (
          <div key={action.id} style={{ 
            background: C.surface, border: `1px solid ${C.accent}40`, borderRadius: 12, padding: 16,
            boxShadow: `0 4px 12px ${C.accent}10`, position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 4, bottom: 0, background: C.accent }}></div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: 'uppercase', marginBottom: 8 }}>⚡ {action.agent_type}</div>
            <div style={{ fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 12 }}>Предложенное действие: {action.action_type === 'create_tasks' ? 'Создание пакета задач' : action.action_type}</div>
            
            {action.action_type === 'create_tasks' && (
              <div style={{ background: C.surface2, borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {action.payload.tasks?.map((t: any, idx: number) => (
                  <div key={idx} style={{ fontSize: 13, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: C.textMuted }}>•</span> {t.title} <span style={{ fontSize: 10, padding: '2px 6px', background: C.surface, borderRadius: 4, color: C.textMuted }}>{t.priority}</span>
                  </div>
                ))}
              </div>
            )}

            {action.action_type === 'create_drawing' && (
              <div style={{ background: C.surface2, borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13, color: C.text }}>
                <div><b>Код:</b> {action.payload?.code || '—'}</div>
                <div><b>Название:</b> {action.payload?.title || '—'}</div>
                <div><b>Дисциплина:</b> {action.payload?.discipline || '—'}</div>
              </div>
            )}

            {action.action_type === 'update_drawing' && (
              <div style={{ background: C.surface2, borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13, color: C.text }}>
                <div><b>Drawing ID:</b> {action.payload?.drawing_id || '—'}</div>
                <div><b>Изменения:</b> {JSON.stringify(action.payload?.updates || {})}</div>
              </div>
            )}

            {(action.action_type === 'create_drawing_revision' || action.action_type === 'create_revision') && (
              <div style={{ background: C.surface2, borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13, color: C.text }}>
                <div><b>Drawing ID:</b> {action.payload?.drawing_id || '—'}</div>
                <div><b>Комментарий:</b> {action.payload?.note || '—'}</div>
              </div>
            )}

            {action.action_type === 'create_review' && (
              <div style={{ background: C.surface2, borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13, color: C.text }}>
                <div><b>Текст:</b> {action.payload?.title || '—'}</div>
                <div><b>Severity:</b> {action.payload?.severity || 'major'}</div>
                <div><b>Drawing ID:</b> {action.payload?.drawing_id || '—'}</div>
              </div>
            )}

            {action.action_type === 'create_transmittal' && (
              <div style={{ background: C.surface2, borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13, color: C.text }}>
                <div><b>Номер:</b> {action.payload?.number || '(авто)'}</div>
                <div><b>Получатель:</b> {action.payload?.recipient || '—'}</div>
                <div><b>Примечание:</b> {action.payload?.note || '—'}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={() => applyAction(action, true)}
                style={{ flex: 1, padding: '8px 0', background: C.accent, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                ✅ Подтвердить
              </button>
              <button 
                onClick={() => applyAction(action, false)}
                style={{ flex: 1, padding: '8px 0', background: 'transparent', color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                ❌ Отклонить
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: 16, borderTop: `1px solid ${C.border}`, background: C.surface }}>
        <form onSubmit={e => { e.preventDefault(); handleSend(); }} style={{ display: 'flex', gap: 8 }}>
          <input 
            value={input} onChange={e => setInput(e.target.value)}
            placeholder="Опишите задачу (напр. 'Создай задачи на проверку')"
            style={{ flex: 1, background: C.surface2, border: `1px solid ${C.border}`, color: C.text, padding: '10px 14px', borderRadius: 20, fontSize: 14, outline: 'none' }}
          />
          <button type="submit" disabled={!input.trim() || loading} style={{ width: 40, height: 40, borderRadius: 20, background: input.trim() ? C.accent : C.surface2, color: '#fff', border: 'none', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ transform: 'translateX(-1px) translateY(1px)' }}>➤</span>
          </button>
        </form>
      </div>

      <style>{`
        .jumping-dots span { animation: jump 1s infinite alternate; display: inline-block; font-weight: bold; font-size: 16px; }
        .jumping-dots span:nth-child(2) { animation-delay: 0.2s; }
        .jumping-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes jump { 0% { transform: translateY(0); } 100% { transform: translateY(-4px); } }
      `}</style>
    </div>
  );
}
