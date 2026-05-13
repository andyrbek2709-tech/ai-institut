import React, { useState, useEffect, useRef, useCallback } from 'react';
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

interface Citation {
  document: string;
  standard: string;
  section: string;
  page: number;
  text?: string;
}

interface ChatMsg {
  role: 'user' | 'ai';
  text: string;
  citations?: Citation[];
  ts?: number;
  error?: boolean;
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

const fmtTime = (ts?: number) => {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const roleTitleMap: Record<string, string> = {
  gip: 'ГИП',
  lead: 'Рук. отдела',
  engineer: 'Инженер',
};

const rolePlaceholderMap: Record<string, string> = {
  gip: "Спросите про риски, нормативы, сроки, коллизии...",
  lead: "Спросите про отчёт, задачи, нормативы...",
  engineer: "Спросите про ГОСТ, СНиП, задачи, расчёты...",
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

const WELCOME_TEXT = 'Привет! Я ChatGPT 4.0 — помощник по нормативной базе и проектной работе.\n\nМогу найти ГОСТы, СНиПы, СП и EN, дать рекомендации по задачам и расчётам, прочитать ваше ТЗ.\n\nСпрашивайте — отвечу по существу.';

export function CopilotPanel({
  projectId,
  userId,
  userRole,
  C,
  onClose,
  onTaskCreated,
  onDataChanged
}: any) {
  const storageKey = `enghub_chat_${projectId}`;

  const mkWelcome = (): ChatMsg => ({ role: 'ai', text: WELCOME_TEXT, ts: Date.now() });

  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: ChatMsg[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [mkWelcome()];
  });

  const [input, setInput] = useState('');
  const [actions, setActions] = useState<AIAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [useKB, setUseKB] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);
  const applyInFlightRef = useRef<Set<string>>(new Set());

  // Persist chat to localStorage (last 60 messages)
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages.slice(-60))); } catch {}
  }, [messages, storageKey]);

  // Smart auto-scroll: only scroll if user didn't scroll up
  useEffect(() => {
    if (!userScrolledUp.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setNewMsgCount(0);
    } else if (userScrolledUp.current) {
      // User is scrolled up and new message arrived — increment badge
      setNewMsgCount(n => n + 1);
    }
  }, [messages]);

  // Also scroll when actions appear
  useEffect(() => {
    if (!userScrolledUp.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [actions]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    userScrolledUp.current = !atBottom;
    setShowScrollBtn(!atBottom);
    if (atBottom) setNewMsgCount(0);
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
    userScrolledUp.current = false;
    setShowScrollBtn(false);
    setNewMsgCount(0);
  };

  const clearChat = () => {
    try { localStorage.removeItem(storageKey); } catch {}
    setMessages([mkWelcome()]);
    userScrolledUp.current = false;
    setShowScrollBtn(false);
    setNewMsgCount(0);
  };

  const copyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  };

  // Polling ai_actions
  const fetchActions = async () => {
    try {
      const data = await get(`ai_actions?project_id=eq.${projectId}&order=created_at.desc`);
      if (Array.isArray(data)) setActions(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchActions();
    const iv = setInterval(fetchActions, 3000);
    return () => clearInterval(iv);
  }, [projectId]);

  // Build history for AI: skip the initial welcome message, last 10 exchanges
  const buildHistory = (msgs: ChatMsg[]) => {
    return msgs
      .filter((m, i) => !(i === 0 && m.role === 'ai' && m.text === WELCOME_TEXT))
      .filter(m => !m.error)
      .slice(-10)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text.slice(0, 2000) }));
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userText = input.trim();

    userScrolledUp.current = false;
    setShowScrollBtn(false);
    setNewMsgCount(0);

    const newUserMsg: ChatMsg = { role: 'user', text: userText, ts: Date.now() };
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setLoading(true);

    try {
      const sb = getSupabaseAnonClient();
      const { data } = await sb.auth.getSession();
      const token = data?.session?.access_token || '';
      const apiUrl = `${process.env.REACT_APP_RAILWAY_API_URL || ''}/api/orchestrator`;

      // Capture current messages before state update for history
      const currentMessages = [...messages, newUserMsg];
      const history = buildHistory(currentMessages.slice(0, -1)); // exclude the just-added user msg

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
          role: userRole || 'engineer',
          history,
        })
      });

      const responseData = await res.json();

      if (responseData.blocked) {
        const nextStepText = responseData.next_step ? `\n➡ ${responseData.next_step}` : '';
        setMessages(prev => [...prev, { role: 'ai', text: `⛔ ${responseData.message || 'Действие заблокировано правилами.'}${nextStepText}`, ts: Date.now() }]);
      } else if (responseData.message) {
        setMessages(prev => [...prev, { role: 'ai', text: responseData.message, citations: responseData.citations || [], ts: Date.now() }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: 'Запрос обработан.', ts: Date.now() }]);
      }

      if (responseData.action_id || responseData.action_count || ['task_manager', 'drawing_agent', 'review_agent', 'register_agent', 'smart_decompose_agent', 'smart_decompose_v2_agent', 'compliance_agent'].includes(responseData.agent)) {
        fetchActions();
      }
    } catch (e) {
      console.error('ChatGPT 4.0 error:', e);
      setMessages(prev => [...prev, { role: 'ai', text: 'Ошибка соединения. Проверьте сеть и попробуйте снова.', ts: Date.now(), error: true }]);
    } finally {
      setLoading(false);
    }
  };

  const applyAction = async (action: AIAction, approved: boolean) => {
    const payload = (action.payload && typeof action.payload === 'object' ? action.payload : {}) as Record<string, unknown>;

    if (approved && applyInFlightRef.current.has(action.id)) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Это действие уже выполняется — дождитесь завершения.', ts: Date.now() }]);
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
      setMessages(prev => [...prev, { role: 'ai', text: validation.error, ts: Date.now() }]);
      return;
    }

    if (approved) applyInFlightRef.current.add(action.id);

    try {
      if (approved) {
        const latestRows = await get(`ai_actions?id=eq.${action.id}&select=id,status`);
        const latest = Array.isArray(latestRows) ? latestRows[0] : null;
        if (!latest) {
          setMessages(prev => [...prev, { role: 'ai', text: 'Действие не найдено: возможно, уже обработано другим пользователем.', ts: Date.now() }]);
          fetchActions();
          return;
        }
        if (latest.status !== 'pending') {
          setMessages(prev => [...prev, { role: 'ai', text: `Действие уже обработано (статус: ${latest.status}).`, ts: Date.now() }]);
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

      await patch(`ai_actions?id=eq.${action.id}`, { status: approved ? 'approved' : 'rejected' });
      fetchActions();
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'ai', text: 'Ошибка при применении действия. Проверьте консоль.', ts: Date.now() }]);
    } finally {
      if (approved) applyInFlightRef.current.delete(action.id);
    }
  };

  const pendingActions = actions.filter(a => a.status === 'pending');

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(420px, 100vw)',
      background: C.surface, borderLeft: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', zIndex: 1000,
      boxShadow: '-6px 0 24px rgba(0,0,0,0.08)'
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '14px 16px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: C.surface2, flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: `linear-gradient(135deg, ${C.accent}, #4f7fd8)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: -0.5
          }}>AI</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>ChatGPT 4.0</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>GPT-4o · {roleTitleMap[userRole || 'engineer'] || 'Инженер'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Clear chat */}
          <button
            onClick={clearChat}
            title="Новый чат"
            style={{
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.textMuted, cursor: 'pointer', fontSize: 12,
              padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4
            }}
          >
            ✦ Новый чат
          </button>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}
          >✕</button>
        </div>
      </div>

      {/* ── KB Toggle ── */}
      <div style={{
        padding: '8px 16px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: useKB ? C.accent + '12' : 'transparent', flexShrink: 0,
        transition: 'background 0.2s'
      }}>
        <div style={{ fontSize: 12, color: useKB ? C.accent : C.textDim, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{useKB ? '🔍' : '🌐'}</span>
          <span>{useKB ? 'База знаний организации включена' : 'Обычный режим'}</span>
        </div>
        <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 20, flexShrink: 0 }}>
          <input type="checkbox" checked={useKB} onChange={() => setUseKB(!useKB)} style={{ opacity: 0, width: 0, height: 0 }} />
          <span style={{
            position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: useKB ? C.accent : C.border, transition: '.3s', borderRadius: 20
          }}>
            <span style={{
              position: 'absolute', height: 14, width: 14,
              left: useKB ? 23 : 3, bottom: 3,
              backgroundColor: 'white', transition: '.3s', borderRadius: '50%'
            }} />
          </span>
        </label>
      </div>

      {/* ── Chat area ── */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{ height: '100%', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ position: 'relative', maxWidth: '88%' }}>
                <div style={{
                  background: m.role === 'user' ? C.accent : (m.error ? '#ff4d4f18' : C.surface2),
                  color: m.role === 'user' ? '#fff' : (m.error ? '#ff4d4f' : C.text),
                  padding: '10px 13px', borderRadius: 12, fontSize: 14, lineHeight: 1.5,
                  borderBottomRightRadius: m.role === 'user' ? 3 : 12,
                  borderBottomLeftRadius: m.role === 'ai' ? 3 : 12,
                  border: m.error ? '1px solid #ff4d4f40' : 'none',
                }}
                  dangerouslySetInnerHTML={{
                    __html: m.role === 'ai'
                      ? renderMd(m.text)
                      : m.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  }}
                />
                {/* Copy button for AI messages */}
                {m.role === 'ai' && !m.error && (
                  <button
                    onClick={() => copyText(m.text, i)}
                    title="Копировать"
                    style={{
                      position: 'absolute', bottom: -18, left: 0,
                      background: 'transparent', border: 'none',
                      fontSize: 10, color: C.textMuted, cursor: 'pointer',
                      padding: '2px 4px', borderRadius: 4,
                      opacity: copiedIdx === i ? 1 : 0.5,
                      transition: 'opacity 0.2s'
                    }}
                  >
                    {copiedIdx === i ? '✓ скопировано' : '⎘ копировать'}
                  </button>
                )}
              </div>
              {/* Timestamp */}
              {m.ts && (
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: m.role === 'ai' ? 22 : 4, opacity: 0.6 }}>
                  {fmtTime(m.ts)}
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                background: C.surface2, color: C.textMuted, padding: '10px 14px',
                borderRadius: 12, borderBottomLeftRadius: 3, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                <span className="jumping-dots"><span>.</span><span>.</span><span>.</span></span>
                <span>ChatGPT 4.0 думает...</span>
              </div>
            </div>
          )}

          {/* Pending actions feed */}
          {pendingActions.map(action => (
            <div key={action.id} style={{
              background: C.surface, border: `1px solid ${C.accent}40`, borderRadius: 12, padding: 14,
              boxShadow: `0 2px 12px ${C.accent}10`, position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 3, bottom: 0, background: C.accent, borderRadius: '3px 0 0 3px' }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>
                ⚡ {agentLabelMap[action.agent_type] || action.agent_type}
              </div>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 10 }}>
                {action.action_type === 'create_tasks' ? 'Создание пакета задач' :
                 action.action_type === 'create_review' ? 'Создание замечания' :
                 action.action_type === 'create_drawing' ? 'Создание чертежа' :
                 action.action_type}
              </div>

              {action.action_type === 'create_tasks' && (
                <div style={{ background: C.surface2, borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                  {action.payload.tasks?.map((t: any, idx: number) => (
                    <div key={idx} style={{ fontSize: 12, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: C.accent }}>•</span> {t.title}
                      <span style={{ fontSize: 10, padding: '1px 5px', background: C.surface, borderRadius: 4, color: C.textMuted, marginLeft: 'auto' }}>{t.priority}</span>
                    </div>
                  ))}
                </div>
              )}

              {action.action_type === 'create_drawing' && (
                <div style={{ background: C.surface2, borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 12, color: C.text }}>
                  <div><b>Код:</b> {action.payload?.code || '—'}</div>
                  <div><b>Название:</b> {action.payload?.title || '—'}</div>
                  <div><b>Дисциплина:</b> {action.payload?.discipline || '—'}</div>
                </div>
              )}

              {action.action_type === 'update_drawing' && (
                <div style={{ background: C.surface2, borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 12, color: C.text }}>
                  <div><b>Drawing ID:</b> {action.payload?.drawing_id || '—'}</div>
                  <div><b>Изменения:</b> {JSON.stringify(action.payload?.updates || {})}</div>
                </div>
              )}

              {(action.action_type === 'create_drawing_revision' || action.action_type === 'create_revision') && (
                <div style={{ background: C.surface2, borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 12, color: C.text }}>
                  <div><b>Drawing ID:</b> {action.payload?.drawing_id || '—'}</div>
                  <div><b>Комментарий:</b> {action.payload?.note || '—'}</div>
                </div>
              )}

              {action.action_type === 'create_review' && (
                <div style={{ background: C.surface2, borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 12, color: C.text }}>
                  <div><b>Текст:</b> {action.payload?.title || '—'}</div>
                  <div><b>Severity:</b> {action.payload?.severity || 'major'}</div>
                </div>
              )}

              {action.action_type === 'update_review_status' && (
                <div style={{ background: C.surface2, borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 12, color: C.text }}>
                  <div><b>Review ID:</b> {action.payload?.review_id || '—'}</div>
                  <div><b>Статус:</b> {action.payload?.status || '—'}</div>
                </div>
              )}

              {action.action_type === 'create_transmittal' && (
                <div style={{ background: C.surface2, borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 12, color: C.text }}>
                  <div><b>Номер:</b> {action.payload?.number || '(авто)'}</div>
                  <div><b>Получатель:</b> {action.payload?.recipient || '—'}</div>
                  <div><b>Позиции:</b> {Array.isArray(action.payload?.items) ? action.payload.items.length : 0}</div>
                </div>
              )}

              {action.action_type === 'update_transmittal_status' && (
                <div style={{ background: C.surface2, borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 12, color: C.text }}>
                  <div><b>Transmittal ID:</b> {action.payload?.transmittal_id || '—'}</div>
                  <div><b>Новый статус:</b> {action.payload?.status || '—'}</div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => applyAction(action, true)}
                  style={{ flex: 1, padding: '7px 0', background: C.accent, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                >✅ Подтвердить</button>
                <button
                  onClick={() => applyAction(action, false)}
                  style={{ flex: 1, padding: '7px 0', background: 'transparent', color: C.text, border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                >❌ Отклонить</button>
              </div>
            </div>
          ))}
        </div>

        {/* Floating scroll-to-bottom button */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            style={{
              position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
              background: C.accent, color: '#fff', border: 'none', borderRadius: 20,
              padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: `0 4px 12px ${C.accent}60`, zIndex: 10,
              transition: 'opacity 0.2s'
            }}
          >
            {newMsgCount > 0 ? `${newMsgCount} новых ↓` : '↓ вниз'}
          </button>
        )}
      </div>

      {/* ── Input ── */}
      <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
        <form onSubmit={e => { e.preventDefault(); handleSend(); }} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={rolePlaceholderMap[userRole || 'engineer'] || 'Задайте вопрос...'}
            rows={1}
            style={{
              flex: 1, background: C.surface2, border: `1px solid ${C.border}`,
              color: C.text, padding: '9px 13px', borderRadius: 16, fontSize: 14,
              outline: 'none', resize: 'none', overflow: 'hidden', lineHeight: 1.4,
              fontFamily: 'inherit', maxHeight: 120, overflowY: 'auto'
            }}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 120) + 'px';
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            style={{
              width: 38, height: 38, borderRadius: 19, flexShrink: 0,
              background: input.trim() && !loading ? C.accent : C.surface2,
              color: '#fff', border: 'none',
              cursor: input.trim() && !loading ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s'
            }}
          >
            <span style={{ transform: 'translateX(-1px) translateY(1px)', fontSize: 16 }}>➤</span>
          </button>
        </form>
        <div style={{ fontSize: 10, color: C.textMuted, marginTop: 5, textAlign: 'center', opacity: 0.6 }}>
          Enter — отправить · Shift+Enter — перенос строки
        </div>
      </div>

      <style>{`
        .jumping-dots span { animation: jump 1s infinite alternate; display: inline-block; font-weight: bold; font-size: 18px; }
        .jumping-dots span:nth-child(2) { animation-delay: 0.2s; }
        .jumping-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes jump { 0% { transform: translateY(0); } 100% { transform: translateY(-5px); } }
      `}</style>
    </div>
  );
}
