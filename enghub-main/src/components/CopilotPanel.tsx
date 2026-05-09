import React, { useState, useEffect, useRef } from 'react';
import { get, post, patch } from '../api/supabase';
import { getSupabaseAnonClient } from '../api/supabaseClient';
import { validateApplyAction } from '../copilot/validateApplyAction';
import type { Action } from '../copilot/validateApplyAction';

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

const renderMd = (text: string): string => {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.15);padding:1px 4px;border-radius:3px;font-family:monospace;font-size:12px">$1</code>')
    .replace(/^### (.+)$/gm, '<div style="font-weight:700;font-size:13px;margin:6px 0 2px">$1</div>')
    .replace(/^## (.+)$/gm, '<div style="font-weight:700;font-size:14px;margin:8px 0 4px">$1</div>')
    .replace(/^# (.+)$/gm, '<div style="font-weight:700;font-size:15px;margin:8px 0 4px">$1</div>')
    .replace(/^- (.+)$/gm, '<div style="padding-left:12px">• $1</div>')
    .replace(/\n/g, '<br/>');
};

const roleTitleMap: Record<string, string> = {
  gip: 'Роль: ГИП',
  lead: 'Роль: Руководитель отдела',
  engineer: 'Роль: Инженер',
};

const rolePlaceholderMap: Record<string, string> = {
  gip: "Напр.: 'Риски срыва проекта?' / 'Найди задачи КМ просроченные' / 'Разработай план задач'",
  lead: "Напр.: 'Сформируй еженедельный отчёт' / 'Найди задачи в доработке' / 'Риски проекта'",
  engineer: "Напр.: 'Нормоконтроль ОВ-001' / 'Найди мои задачи в очереди' / 'Анализ проекта'",
};

const agentLabelMap: Record<string, string> = {
  task_manager: 'Task Manager',
  drawing_agent: 'Drawing Agent',
  revision_agent: 'Revision Agent',
  review_agent: 'Review Agent',
  register_agent: 'Register Agent',
  workflow_agent: 'Workflow Agent',
  rag_assistant: 'RAG Ассистент',
  project_insights_agent: '📊 Аналитик проекта',
  smart_decompose_agent: '🧠 Планировщик задач',
  smart_decompose_v2_agent: '🧠 AI-планировщик v2',
  compliance_agent: '📋 Нормоконтроль',
  report_agent: '📄 Генератор отчётов',
  nl_search_agent: '🔍 NL-поиск',
  risk_forecast_agent: '⚠️ Риск-анализ',
  norm_control_agent: '📋 Нормоконтроль ПЗ',
  drawing_vision_agent: '🖼️ AI-анализ чертежа',
};

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
    { role: 'ai', text: 'Привет! Я ChatGPT 4.0 — помощник по нормативной базе и проектной работе. Спросите про ГОСТ, СНиП, EN или попросите помочь с задачами и расчётами.' }
  ]);
  const [input, setInput] = useState('');
  const [actions, setActions] = useState<AIAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [useKB, setUseKB] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const applyInFlightRef = useRef<Set<string>>(new Set());

  // Polling ai_actions
  const fetchActions = async () => {
    try {
      const data = await get(`ai_actions?project_id=eq.${projectId}&order=created_at.desc`);
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
      const sb = getSupabaseAnonClient();
      const { data } = await sb.auth.getSession();
      const token = data?.session?.access_token || '';
      const apiUrl = `${process.env.REACT_APP_RAILWAY_API_URL || ''}/api/orchestrator`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          user_id: userId,
          project_id: projectId,
          message: userText,
          use_rag: useKB,
          role: userRole || 'engineer'
        })
      });

      const responseData = await res.json();
      
      if (responseData.blocked) {
        const nextStepText = data.next_step ? `\n➡ ${responseData.next_step}` : '';
        setMessages(prev => [...prev, { role: 'ai', text: `⛔ ${responseData.message || 'Действие заблокировано правилами.'}${nextStepText}` }]);
      } else if (responseData.message) {
        setMessages(prev => [...prev, { role: 'ai', text: data.message }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: 'Запрос обработан.' }]);
      }
      
      if (responseData.action_id || responseData.action_count || ['task_manager', 'drawing_agent', 'review_agent', 'register_agent', 'smart_decompose_agent', 'smart_decompose_v2_agent', 'compliance_agent'].includes(responseData.agent)) {
          fetchActions();
      }
    } catch (e) {
      console.error("Orchestrator error:", e);
      setMessages(prev => [...prev, { role: 'ai', text: 'Ошибка соединения с ChatGPT 4.0. Пожалуйста, попробуйте позже.' }]);
    } finally {
      setLoading(false);
    }
  };

  const applyAction = async (action: AIAction, approved: boolean) => {
    const payload = (action.payload && typeof action.payload === 'object' ? action.payload : {}) as Record<string, unknown>;

    if (approved && applyInFlightRef.current.has(action.id)) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Это действие уже выполняется — дождитесь завершения.' }]);
      return;
    }

    const validation = approved
      ? validateApplyAction(action.action_type as Action, payload, {
          userId: String(userId || ''),
          role: (String(userRole || 'engineer').toLowerCase() as any),
          projectId: String(projectId || ''),
        })
      : { ok: true };
    if (validation.ok === false) {
      setMessages(prev => [...prev, { role: 'ai', text: validation.error }]);
      return;
    }

    if (approved) applyInFlightRef.current.add(action.id);

    try {
      if (approved) {
        const latestRows = await get(`ai_actions?id=eq.${action.id}&select=id,status`);
        const latest = Array.isArray(latestRows) ? latestRows[0] : null;
        if (!latest) {
          setMessages(prev => [...prev, { role: 'ai', text: 'Действие не найдено: возможно, уже обработано другим пользователем.' }]);
          fetchActions();
          return;
        }
        if (latest.status !== 'pending') {
          setMessages(prev => [...prev, { role: 'ai', text: `Действие уже обработано (статус: ${latest.status}). Повторное применение пропущено.` }]);
          fetchActions();
          return;
        }
      }

      if (approved && action.action_type === 'create_tasks') {
        for (const t of payload.tasks as Array<{ title?: string; priority?: string }>) {
          await post('tasks', {
            project_id: projectId,
            name: t.title,
            priority: t.priority,
            status: 'todo',
            assigned_to: null,
            dept: (t as any).dept || 'Общие'
          });
        }
        onTaskCreated();
      }

      if (approved && action.action_type === 'create_drawing') {
        await post('drawings', {
          project_id: projectId,
          code: payload.code as string,
          title: payload.title as string,
          discipline: payload.discipline || null,
          status: 'draft',
          revision: 'R0',
          created_by: userId
        });
        onDataChanged?.();
      }

      if (approved && action.action_type === 'update_drawing' && payload?.drawing_id) {
        await patch(`drawings?id=eq.${payload.drawing_id}`, (payload.updates || {}) as Record<string, unknown>);
        onDataChanged?.();
      }

      if (approved && (action.action_type === 'create_drawing_revision' || action.action_type === 'create_revision') && payload?.drawing_id) {
        const drawingRows = await get(`drawings?id=eq.${payload.drawing_id}&select=id,revision,project_id`);
        const drawing = Array.isArray(drawingRows) ? drawingRows[0] : null;
        const revNum = Number(String(drawing?.revision || 'R0').replace('R', '')) + 1;
        const nextRev = `R${Number.isFinite(revNum) ? revNum : 1}`;
        await post('revisions', {
          project_id: drawing?.project_id || projectId,
          drawing_id: payload.drawing_id as string,
          from_revision: drawing?.revision || 'R0',
          to_revision: nextRev,
          issued_by: userId
        });
        await patch(`drawings?id=eq.${payload.drawing_id}`, { revision: nextRev, status: 'in_work' });
        onDataChanged?.();
      }

      if (approved && action.action_type === 'create_review') {
        await post('reviews', {
          project_id: projectId,
          drawing_id: (payload?.drawing_id as string | null | undefined) || null,
          title: (payload?.title as string) || 'Замечание',
          severity: (payload?.severity as string) || 'major',
          status: 'open',
          author_id: userId
        });
        onDataChanged?.();
      }

      if (approved && action.action_type === 'update_review_status') {
        await patch(`reviews?id=eq.${payload.review_id}`, {
          status: payload.status as string,
          updated_at: new Date().toISOString(),
        });
        onDataChanged?.();
      }

      if (approved && action.action_type === 'create_transmittal') {
        const createdRows = await post('transmittals', {
          project_id: projectId,
          number: (payload?.number as string) || `TR-${projectId}-${Date.now()}`,
          recipient: payload?.recipient || null,
          note: payload?.note || null,
          status: 'draft',
          issued_by: userId
        });
        const created = Array.isArray(createdRows) ? createdRows[0] : null;
        if (created?.id && Array.isArray(payload?.items)) {
          for (const item of payload.items as Array<{ drawing_id?: string; revision_id?: string; note?: string }>) {
            await post('transmittal_items', {
              transmittal_id: created.id,
              drawing_id: item?.drawing_id || null,
              revision_id: item?.revision_id || null,
              note: item?.note || null,
            });
          }
        }
        onDataChanged?.();
      }

      if (approved && action.action_type === 'update_transmittal_status') {
        await patch(`transmittals?id=eq.${payload.transmittal_id}`, {
          status: payload.status as string,
          updated_at: new Date().toISOString(),
        });
        onDataChanged?.();
      }

      // Update action status
      await patch(`ai_actions?id=eq.${action.id}`, {
        status: approved ? 'approved' : 'rejected'
      });
      
      fetchActions();
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'ai', text: 'Ошибка при применении действия. Проверьте консоль и повторите попытку.' }]);
    } finally {
      if (approved) applyInFlightRef.current.delete(action.id);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(400px, 100vw)',
      background: C.surface, borderLeft: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', zIndex: 1000,
      boxShadow: '-4px 0 15px rgba(0,0,0,0.05)'
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.surface2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${C.accent}, #4f7fd8)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>AI</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>ChatGPT 4.0</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>GPT-4o · {roleTitleMap[userRole || 'engineer']}</div>
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
            }}
              dangerouslySetInnerHTML={{ __html: m.role === 'ai' ? renderMd(m.text) : m.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }}
            />
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
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: 'uppercase', marginBottom: 8 }}>⚡ {agentLabelMap[action.agent_type] || action.agent_type}</div>
            <div style={{ fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 12 }}>Предложенное действие: {action.action_type === 'create_tasks' ? 'Создание пакета задач' : action.action_type === 'create_review' ? 'Создание замечания' : action.action_type}</div>
            
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

            {action.action_type === 'update_review_status' && (
              <div style={{ background: C.surface2, borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13, color: C.text }}>
                <div><b>Review ID:</b> {action.payload?.review_id || '—'}</div>
                <div><b>Новый статус:</b> {action.payload?.status || '—'}</div>
                <div><b>Комментарий:</b> {action.payload?.note || '—'}</div>
              </div>
            )}

            {action.action_type === 'create_transmittal' && (
              <div style={{ background: C.surface2, borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13, color: C.text }}>
                <div><b>Номер:</b> {action.payload?.number || '(авто)'}</div>
                <div><b>Получатель:</b> {action.payload?.recipient || '—'}</div>
                <div><b>Примечание:</b> {action.payload?.note || '—'}</div>
                <div><b>Позиции:</b> {Array.isArray(action.payload?.items) ? action.payload.items.length : 0}</div>
              </div>
            )}

            {action.action_type === 'update_transmittal_status' && (
              <div style={{ background: C.surface2, borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13, color: C.text }}>
                <div><b>Transmittal ID:</b> {action.payload?.transmittal_id || '—'}</div>
                <div><b>Новый статус:</b> {action.payload?.status || '—'}</div>
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
            placeholder={rolePlaceholderMap[userRole || 'engineer'] || "Опишите задачу"}
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
