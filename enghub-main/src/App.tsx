import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { DARK, LIGHT, statusMap, roleLabels, taskWorkflowTransitions } from './constants';
import { get, post, patch, del, SURL, SERVICE_KEY, AuthError, listDrawings, createDrawing, updateDrawing, listReviews, createReview, createRevisionRecord, createTransmittal, listProjectTasks, createProjectTask, updateTaskDrawingLink, listRevisions, updateReviewStatus, updateTransmittalStatus, listTransmittalItems, createTransmittalItem, createNotification, listTaskHistory } from './api/supabase';
import { ThemeToggle, Modal, Field, AvatarComp, BadgeComp, PriorityDot, getInp } from './components/ui';
import { LoginPage } from './pages/LoginPage';
import { AdminPanel } from './pages/AdminPanel';
import { useNotifications, ToastContainer } from './components/Notifications';
import { CalculationView } from './calculations/CalculationView';
import { calcRegistry } from './calculations/registry';
import { ConferenceRoom } from './pages/ConferenceRoom';
import { CopilotPanel } from './components/CopilotPanel';
import { DrawingsPanel } from './components/DrawingsPanel';
import { RevisionsTab } from './components/RevisionsTab';
import { ReviewsTab } from './components/ReviewsTab';
import { TransmittalsTab } from './components/TransmittalsTab';
import { AssignmentsTab } from './components/AssignmentsTab';
import GanttChart from './components/GanttChart';
import MeetingsPanel from './components/MeetingsPanel';
import TimelogPanel from './components/TimelogPanel';
import { exportProjectXls, exportTransmittalPdf } from './utils/export';
import { GlobalSearch } from './components/GlobalSearch';
import { KanbanBoard } from './components/KanbanBoard';
import { ProjectTimeline } from './components/ProjectTimeline';
import { NotificationCenter } from './components/NotificationCenter';
import { TaskTemplates } from './components/TaskTemplates';

export default function App() {
  const [dark, setDark] = useState(false); // Светлая тема по умолчанию
  const C = dark ? DARK : LIGHT;

  const [token, setToken] = useState<string | null>(localStorage.getItem('enghub_token'));
  const [userEmail, setUserEmail] = useState<string>(localStorage.getItem('enghub_email') || "");
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [screen, setScreen] = useState(localStorage.getItem('enghub_screen') || "dashboard");
  const [projects, setProjects] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [appUsers, setAppUsers] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [activeProject, setActiveProject] = useState<any>(null);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [transmittals, setTransmittals] = useState<any[]>([]);
  const [transmittalItems, setTransmittalItems] = useState<Record<string, any[]>>({});
  const [transmittalDraftLinks, setTransmittalDraftLinks] = useState<Record<string, { drawingId: string; revisionId: string }>>({});
  const [normativeDocs, setNormativeDocs] = useState<any[]>([]);
  const [normSearchQuery, setNormSearchQuery] = useState("");
  const [normSearchResults, setNormSearchResults] = useState<any[] | null>(null);
  const [normSearching, setNormSearching] = useState(false);
  const [showDupModal, setShowDupModal] = useState(false);
  const [dupConflicts, setDupConflicts] = useState<{file: File, existing: any}[]>([]);
  const [dupDecisions, setDupDecisions] = useState<Record<string, 'overwrite' | 'skip'>>({});
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [archivedProjects, setArchivedProjects] = useState<any[]>([]);
  const [sideTab, setSideTab] = useState(() => { const s = localStorage.getItem('enghub_sidetab'); return (s && s !== 'conference') ? s : 'tasks'; });
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [maxTasksPerEng, setMaxTasksPerEng] = useState(5);

  const [showNewProject, setShowNewProject] = useState(false);
  const [newProject, setNewProject] = useState<any>({ name: "", code: "", deadline: "", status: "active", depts: [] });
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showTaskTemplates, setShowTaskTemplates] = useState(false);
  const [taskHistory, setTaskHistory] = useState<any[]>([]);
  const [showTaskHistory, setShowTaskHistory] = useState(false);
  const [newTask, setNewTask] = useState({ name: "", dept_id: "", priority: "medium", deadline: "", assigned_to: "", drawing_id: "", description: "" });
  const [taskSuggest, setTaskSuggest] = useState<{ deadline: string | null; reason: string | null } | null>(null);
  const [taskSuggestLoading, setTaskSuggestLoading] = useState(false);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [taskComment, setTaskComment] = useState("");
  const [workflowBlockInfo, setWorkflowBlockInfo] = useState<string>("");

  const [showNewAssignment, setShowNewAssignment] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ name: "", target_dept: "", priority: "high", deadline: "" });
  const [newReview, setNewReview] = useState({ title: "", severity: "major", drawing_id: "" });

  // Поиск и фильтры
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterAssigned, setFilterAssigned] = useState("all");

  const isAdmin = userEmail === "admin@enghub.com";
  const role = currentUserData?.role?.toLowerCase() || "";
  const isGip = role.includes("gip") || role.includes("гип") || userEmail?.includes("gip_test");
  const isLead = role.includes("lead") || role.includes("руководитель");
  const isEng = role.includes("engineer") || role.includes("инженер");

  const getUserById = (id: any) => appUsers.find(u => String(u.id) === String(id));
  const getDeptName = (id: any) => depts.find(d => String(d.id) === String(id))?.name || "Общие";

  useEffect(() => {
    if (token && !isAdmin) {
      Promise.all([loadAppUsers(), loadDepts(), loadProjects(), loadNormativeDocs()])
        .catch((e: any) => {
          setLoading(false);
          if (e instanceof AuthError) handleLogout();
        });
    }
  }, [token]);
  useEffect(() => {
    if (activeProject && token) {
      loadAllTasks(activeProject.id);
      loadMessages(activeProject.id);
      loadDrawings(activeProject.id);
      loadRevisions(activeProject.id);
      loadReviews(activeProject.id);
      loadTransmittals(activeProject.id);
    }
  }, [activeProject]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => { localStorage.setItem('enghub_screen', screen); }, [screen]);
  useEffect(() => { localStorage.setItem('enghub_sidetab', sideTab); }, [sideTab]);
  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e: MouseEvent) => { if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showUserMenu]);

  // Calculation Module States
  const [calcFilter, setCalcFilter] = useState(""); // active category accordion
  const [activeCalc, setActiveCalc] = useState<string | null>(null);
  const [calcSearch, setCalcSearch] = useState("");

  // Copilot AI Module States
  const [showCopilot, setShowCopilot] = useState(false);

  const [incomingCall, setIncomingCall] = useState<any>(null); // { project_id, project_name, initiator_name }
  const [conferenceParticipants, setConferenceParticipants] = useState<any[]>([]);
  const presenceChannelRef = useRef<any>(null);

  // Перезагружаем задачи когда currentUserData загрузился
  useEffect(() => { if (activeProject && token && currentUserData) { loadAllTasks(activeProject.id); } }, [currentUserData?.id]);

  const loadAppUsers = async () => { 
    const data = await get("app_users?order=id", token!); 
    if (Array.isArray(data)) { 
      setAppUsers(data); 
      let me = data.find((u: any) => u.email === userEmail); 
      if (!me && userEmail && !isAdmin) {
         // Fallback: create public profile if missing for authed user
         const fallbackRole = userEmail.includes('gip') ? 'gip' : (userEmail.includes('lead') ? 'lead' : 'engineer');
         const newMeData = await post("app_users", { email: userEmail, full_name: userEmail.split('@')[0], role: fallbackRole, dept_id: 1 }, token!);
         me = Array.isArray(newMeData) ? newMeData[0] : newMeData;
      }
      if (me) setCurrentUserData(me); 
    } 
  };
  const loadDepts = async () => { const data = await get("departments?order=name", token!); if (Array.isArray(data)) setDepts(data); };
  const loadProjects = async () => { const data = await get("projects?archived=eq.false&order=id", token!); if (Array.isArray(data)) { setProjects(data); if (data.length > 0) setActiveProject(data[0]); } setLoading(false); };
  const loadArchived = async () => { const data = await get("projects?archived=eq.true&order=id", token!); if (Array.isArray(data)) setArchivedProjects(data); };
  const loadAllTasks = async (pid: number) => {
    const data = await listProjectTasks(pid, token!);
    if (Array.isArray(data)) {
      setAllTasks(data);
      // Фильтрация по роли
      const myRole = currentUserData?.role;
      const myId = String(currentUserData?.id || "");
      const myDeptId = currentUserData?.dept_id;
      if (myRole === "gip") {
        setTasks(data);
      } else if (myRole === "lead") {
        const myEngIds = appUsers.filter(u => u.dept_id === myDeptId && u.role?.toLowerCase() === "engineer").map(u => String(u.id));
        setTasks(data.filter((t: any) => String(t.assigned_to) === String(myId) || myEngIds.includes(String(t.assigned_to))));
      } else {
        setTasks(data.filter((t: any) => String(t.assigned_to) === String(myId)));
      }
    }
  };
  // Keep loadTasks as alias
  const loadTasks = loadAllTasks;
  const loadMessages = async (pid: number, taskId?: number) => {
    const query = taskId
      ? `messages?task_id=eq.${taskId}&order=created_at`
      : `messages?project_id=eq.${pid}&task_id=is.null&order=created_at`;
    const data = await get(query, token!);
    if (!Array.isArray(data)) return;
    if (taskId) {
      // Merge task messages into msgs without wiping project messages
      setMsgs(prev => {
        const withoutThisTask = prev.filter(m => String(m.task_id) !== String(taskId));
        return [...withoutThisTask, ...data];
      });
    } else {
      setMsgs(data);
    }
  };
  const loadDrawings = async (pid: number) => {
    const data = await listDrawings(pid, token!);
    if (Array.isArray(data)) setDrawings(data);
  };
  const loadRevisions = async (pid: number) => {
    const data = await listRevisions(pid, token!);
    if (Array.isArray(data)) setRevisions(data);
  };
  const loadReviews = async (pid: number) => {
    const data = await listReviews(pid, token!);
    if (Array.isArray(data)) setReviews(data);
  };
  const loadTransmittals = async (pid: number) => {
    const data = await get(`transmittals?project_id=eq.${pid}&order=created_at.desc`, token!);
    if (Array.isArray(data)) {
      setTransmittals(data);
      const itemMap: Record<string, any[]> = {};
      for (const tr of data) {
        const items = await listTransmittalItems(tr.id, token!);
        itemMap[tr.id] = Array.isArray(items) ? items : [];
      }
      setTransmittalItems(itemMap);
    }
  };

  const loadNormativeDocs = async () => {
    const data = await get("normative_docs?order=name.asc", token!);
    if (Array.isArray(data)) setNormativeDocs(data);
  };

  // Запасной текстовый поиск через ilike (когда нет эмбеддингов)
  const searchNormativeIlike = async (query: string): Promise<any[]> => {
    const enc = encodeURIComponent(`*${query.trim()}*`);
    const res = await fetch(`${SURL}/rest/v1/normative_chunks?content=ilike.${enc}&select=id,doc_id,doc_name,content&limit=100`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    });
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    const byDoc = new Map<string, any>();
    for (const c of data) {
      if (!byDoc.has(c.doc_id)) byDoc.set(c.doc_id, { ...c, similarity: null });
      else byDoc.get(c.doc_id).matchCount = (byDoc.get(c.doc_id).matchCount || 1) + 1;
    }
    return Array.from(byDoc.values());
  };

  const searchNormative = async (query: string) => {
    if (!query.trim()) { setNormSearchResults(null); return; }
    setNormSearching(true);
    try {
      // Пробуем семантический поиск
      let semanticResults: any[] = [];
      try {
        const res = await fetch('/api/orchestrator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'search_normative', query: query.trim(), match_count: 20 }),
        });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const byDoc = new Map<string, any>();
          for (const c of data) {
            const prev = byDoc.get(c.doc_id);
            if (!prev || c.similarity > prev.similarity) byDoc.set(c.doc_id, { ...c });
          }
          semanticResults = Array.from(byDoc.values()).sort((a, b) => b.similarity - a.similarity);
        }
      } catch { /* семантический поиск недоступен */ }

      if (semanticResults.length > 0) {
        setNormSearchResults(semanticResults);
      } else {
        // Запасной вариант: поиск по тексту
        const ilikeResults = await searchNormativeIlike(query);
        setNormSearchResults(ilikeResults);
      }
    } catch {
      setNormSearchResults([]);
    } finally { setNormSearching(false); }
  };

  const doUpload = async (files: File[], decisions: Record<string, 'overwrite' | 'skip'> = {}) => {
    let successCount = 0;
    for (const file of files) {
      if (decisions[file.name] === 'skip') continue;
      try {
        // Overwrite: удалить существующий документ
        if (decisions[file.name] === 'overwrite') {
          const existing = normativeDocs.find(d => d.name === file.name);
          if (existing) {
            await fetch(`${SURL}/rest/v1/normative_docs?id=eq.${existing.id}`, {
              method: 'DELETE',
              headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
            });
          }
        }
        const filePath = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const uploadRes = await fetch(`${SURL}/storage/v1/object/normative-docs/${filePath}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!uploadRes.ok) { addNotification(`Ошибка загрузки "${file.name}": Storage недоступен`, 'warning'); continue; }

        const docInsertRes = await fetch(`${SURL}/rest/v1/normative_docs`, {
          method: 'POST',
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify({ name: file.name, file_type: file.type || 'application/octet-stream', file_path: filePath, status: 'pending' }),
        });
        const docData = await docInsertRes.json();
        if (!docInsertRes.ok) { addNotification(`Ошибка записи "${file.name}": ${docData?.message || docInsertRes.status}`, 'warning'); continue; }

        const docId = Array.isArray(docData) ? docData[0]?.id : docData?.id;
        if (!docId) continue;

        fetch(`${SURL}/functions/v1/vectorize-doc`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc_id: docId }),
        }).catch(() => {});
        successCount++;
      } catch {
        addNotification(`Ошибка загрузки "${file.name}"`, 'warning');
      }
    }
    await loadNormativeDocs();
    if (successCount > 0) addNotification(`Загружено ${successCount} документов. Идёт векторизация...`, 'success');
  };

  const sendMsg = async (taskId?: number, type: string = "text", customText?: string) => { 
    const finalTxt = customText || chatInput;
    if (!finalTxt.trim() || !activeProject || !currentUserData?.id) return false;
    const normalizedType = ["call_start", "call_invite"].includes(type) ? type : "text";
    try {
      const created = await post("messages", {
        text: finalTxt,
        user_id: String(currentUserData?.id),
        project_id: activeProject.id,
        type: normalizedType,
        task_id: taskId || null
      }, token!);
      
      if (!customText) setChatInput(""); 
      await loadMessages(activeProject.id, taskId);
      return true;
    } catch (err: any) {
      addNotification(`Сообщение не отправлено: ${err.message || 'Ошибка сервера'}`, 'warning');
      return false;
    }
  };
  const { notifications, addNotification, removeNotification } = useNotifications();

  // ── Refs для Realtime callbacks (escape stale closures) ──
  const activeProjectRef = useRef<any>(null);
  const currentUserDataRef = useRef<any>(null);
  const appUsersRef = useRef<any[]>([]);
  const addNotifRef = useRef(addNotification);
  const loadTasksRef = useRef(loadAllTasks);
  const msgsRef = useRef<any[]>([]);
  const projectsRef = useRef<any[]>([]);
  const sideTabRef = useRef(sideTab);
  useEffect(() => { activeProjectRef.current = activeProject; }, [activeProject]);
  useEffect(() => { currentUserDataRef.current = currentUserData; }, [currentUserData]);
  useEffect(() => { appUsersRef.current = appUsers; }, [appUsers]);
  useEffect(() => { addNotifRef.current = addNotification; });
  useEffect(() => { loadTasksRef.current = loadAllTasks; });
  useEffect(() => { msgsRef.current = msgs; }, [msgs]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);
  useEffect(() => { sideTabRef.current = sideTab; }, [sideTab]);
  useEffect(() => { window.scrollTo(0, 0); }, [sideTab]);

  // ── Supabase Realtime: подписка на изменения задач ──
  useEffect(() => {
    if (!token || !currentUserData?.id) return;
    const supa = createClient(process.env.REACT_APP_SUPABASE_URL || '', SERVICE_KEY);
    const channel = supa.channel('tasks:live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, (payload: any) => {
        const t = payload.new;
        const me = currentUserDataRef.current;
        if (!me) return;
        if (String(t.assigned_to) === String(me.id)) {
          addNotifRef.current(`📋 Вам назначена задача: «${t.name}»`, 'info');
        }
        if (activeProjectRef.current?.id === t.project_id) loadTasksRef.current(t.project_id);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, (payload: any) => {
        const t = payload.new;
        const me = currentUserDataRef.current;
        if (!me) return;
        const uid = String(me.id);
        const myRole = me.role;
        if (String(t.assigned_to) === uid) {
          if (t.status === 'revision') addNotifRef.current(`⚡ Задача на доработку: «${t.name}»`, 'warning');
          if (t.status === 'done') addNotifRef.current(`✓ Задача завершена: «${t.name}»`, 'success');
        }
        if (myRole === 'lead' && t.status === 'review_lead') {
          const myEngIds = new Set(appUsersRef.current.filter((u: any) => u.dept_id === me.dept_id).map((u: any) => String(u.id)));
          if (myEngIds.has(String(t.assigned_to)) || String(t.assigned_to) === uid) {
            addNotifRef.current(`📋 Задача ожидает вашей проверки: «${t.name}»`, 'info');
          }
        }
        if (myRole === 'gip' && t.status === 'review_gip') {
          addNotifRef.current(`📋 Задача ожидает проверки ГИПа: «${t.name}»`, 'info');
        }
        if (activeProjectRef.current?.id === t.project_id) loadTasksRef.current(t.project_id);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews' }, (payload: any) => {
        const r = payload.new;
        const me = currentUserDataRef.current;
        if (!me || String(r.author_id) === String(me.id)) return;
        if (activeProjectRef.current?.id === r.project_id) {
          addNotifRef.current(`📋 Новое замечание: «${r.title}»`, 'warning');
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reviews' }, (payload: any) => {
        const r = payload.new;
        const me = currentUserDataRef.current;
        if (!me) return;
        if (activeProjectRef.current?.id === r.project_id) {
          if (r.status === 'resolved') addNotifRef.current(`✅ Замечание снято: «${r.title}»`, 'success');
          if (r.status === 'in_progress' && (me.role === 'gip' || me.role === 'lead')) addNotifRef.current(`🔧 Замечание взято в работу: «${r.title}»`, 'info');
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transmittals' }, (payload: any) => {
        const tr = payload.new;
        const me = currentUserDataRef.current;
        if (!me) return;
        if (activeProjectRef.current?.id === tr.project_id && tr.status === 'issued') {
          addNotifRef.current(`📬 Трансмиттал выпущен: №${tr.number}`, 'info');
        }
      })
      // ── Realtime: новые сообщения чата ──
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
        const m = payload.new;
        const me = currentUserDataRef.current;
        if (!me) return;
        // Не дублируем своё собственное сообщение (оно уже добавлено через loadMessages)
        if (String(m.user_id) === String(me.id)) return;
        const activeProj = activeProjectRef.current;
        if (activeProj?.id === m.project_id) {
          // Добавляем сообщение в текущий список если не дублируется
          setMsgs((prev: any[]) => prev.find(msg => msg.id === m.id) ? prev : [...prev, m]);
        } else {
          // Уведомление о сообщении в другом проекте
          const sender = appUsersRef.current.find((u: any) => String(u.id) === String(m.user_id));
          const proj = projectsRef.current.find((p: any) => p.id === m.project_id);
          if (proj && m.type !== 'call_invite') {
            addNotifRef.current(`💬 ${sender?.full_name || 'Участник'}: новое сообщение в "${proj.name}"`, 'info');
          }
        }
        // Обработка приглашения на совещание
        if (m.type === 'call_invite') {
          try {
            const data = JSON.parse(m.text || '{}');
            if (String(data.target_user_id) === String(me.id)) {
              const sender = appUsersRef.current.find((u: any) => String(u.id) === String(m.user_id));
              const proj = projectsRef.current.find((p: any) => p.id === m.project_id);
              setIncomingCall({
                project_id: m.project_id,
                project_name: proj?.name || data.project_name || 'Проект',
                initiator_name: sender?.full_name || 'Участник'
              });
            }
          } catch {}
        }
      })
      .subscribe();
    return () => { supa.removeChannel(channel); };
  }, [currentUserData?.id]); // eslint-disable-line

  // ── Supabase Realtime: подписка на новые сообщения чата ──
  useEffect(() => {
    if (!token || !currentUserData?.id) return;
    const supa = createClient(process.env.REACT_APP_SUPABASE_URL || '', SERVICE_KEY);
    const channel = supa.channel('messages:live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
        const m = payload.new;
        if (
          activeProjectRef.current &&
          m.project_id === activeProjectRef.current.id &&
          (m.task_id === null || m.task_id === undefined)
        ) {
          setMsgs(prev => prev.some((x: any) => x.id === m.id) ? prev : [...prev, m]);
        }
      })
      .subscribe();
    return () => { supa.removeChannel(channel); };
  }, [currentUserData?.id]); // eslint-disable-line

  // Polling — обновление сообщений чата при открытом совещании
  useEffect(() => {
    if (!activeProject || !token || sideTab !== 'conference') return;
    const interval = setInterval(() => {
      loadMessages(activeProject.id);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeProject?.id, token, sideTab]); // eslint-disable-line

  // Polling — только для уведомлений о звонках (задачи обновляются через Realtime)
  useEffect(() => {
    if (!activeProject || !token) return;
    const interval = setInterval(async () => {
      const msgData = await get(`messages?project_id=eq.${activeProject.id}&type=eq.call_start&order=created_at.desc&limit=1`, token);
      if (Array.isArray(msgData) && msgData.length > 0) {
        const call = msgData[0];
        const callTime = new Date(call.created_at).getTime();
        if (Date.now() - callTime < 30000 && sideTab !== 'conference') {
          const initiator = getUserById(call.user_id);
          setIncomingCall({ project_id: activeProject.id, project_name: activeProject.name, initiator_name: initiator?.full_name || "ГИП" });
        }
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [activeProject, token, sideTab]);

  // ── A6: AI task suggest — debounced call on task name change ──
  useEffect(() => {
    if (!showNewTask || !newTask.name.trim() || newTask.name.trim().length < 5 || !activeProject) {
      setTaskSuggest(null);
      return;
    }
    const timer = setTimeout(async () => {
      setTaskSuggestLoading(true);
      try {
        const apiUrl = window.location.hostname === 'localhost' ? 'https://enghub-three.vercel.app/api/orchestrator' : '/api/orchestrator';
        const lead = appUsers.find(u => String(u.id) === newTask.assigned_to);
        const deptName = lead ? depts.find(d => d.id === lead.dept_id)?.name || '' : '';
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: currentUserData?.id,
            project_id: activeProject.id,
            message: newTask.name,
            action: 'task_suggest',
            task_name: newTask.name,
            dept: deptName,
            role: currentUserData?.role || 'engineer',
          }),
        });
        const data = await res.json();
        if (data.deadline) setTaskSuggest({ deadline: data.deadline, reason: data.reason || null });
        else setTaskSuggest(null);
      } catch { setTaskSuggest(null); }
      finally { setTaskSuggestLoading(false); }
    }, 1200);
    return () => clearTimeout(timer);
  }, [newTask.name, showNewTask]); // eslint-disable-line

  // ── Presence: управление присутствием в зале совещания ──
  const joinConference = (initialMic = false, initialScreen = false) => {
    if (!activeProject?.id || !currentUserData) return;
    const supa = createClient(process.env.REACT_APP_SUPABASE_URL || '', SERVICE_KEY);
    const ch = supa.channel(`presence:${activeProject.id}`, {
      config: { presence: { key: String(currentUserData.id) } }
    });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<any>();
      const users = (Object.values(state) as any[][]).flat();
      setConferenceParticipants(users);
    })
    .on('presence', { event: 'join' }, ({ newPresences }: any) => {
      const u = newPresences?.[0];
      if (u && String(u.id) !== String(currentUserData.id)) {
        addNotification(`👤 ${u.full_name || 'Участник'} зашёл в совещание`, 'info');
      }
      // Refresh full participants list on any join event
      const state = ch.presenceState<any>();
      const users = (Object.values(state) as any[][]).flat();
      setConferenceParticipants(users);
    })
    .on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
      const u = leftPresences?.[0];
      if (u && String(u.id) !== String(currentUserData.id)) {
        addNotification(`👤 ${u.full_name || 'Участник'} вышел из совещания`, 'info');
      }
      // Refresh full participants list on any leave event
      const state = ch.presenceState<any>();
      const users = (Object.values(state) as any[][]).flat();
      setConferenceParticipants(users);
    })
    .subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({
          id: currentUserData.id,
          full_name: currentUserData.full_name,
          role: currentUserData.role,
          position: currentUserData.position,
          micEnabled: initialMic,
          screenSharing: initialScreen,
          joinedAt: new Date().toISOString()
        });
      }
    });
    presenceChannelRef.current = { ch, supa };
  };

  const leaveConference = async () => {
    if (presenceChannelRef.current) {
      const { ch, supa } = presenceChannelRef.current;
      await ch.untrack();
      supa.removeChannel(ch);
      presenceChannelRef.current = null;
    }
    setConferenceParticipants([]);
  };

  const updatePresence = async (updates: any) => {
    if (!presenceChannelRef.current || !currentUserData) return;
    const { ch } = presenceChannelRef.current;
    await ch.track({
      id: currentUserData.id,
      full_name: currentUserData.full_name,
      role: currentUserData.role,
      position: currentUserData.position,
      ...updates
    });
  };

  const createProject = async () => { if (!newProject.name || !newProject.code) return; setSaving(true); await post("projects", { ...newProject, progress: 0, archived: false }, token!); setNewProject({ name: "", code: "", deadline: "", status: "active", depts: [] }); setShowNewProject(false); setSaving(false); loadProjects(); addNotification(`Проект "${newProject.name}" создан`, 'success'); };
  
  const toggleProjectDept = (deptId: number) => {
    const current = newProject.depts || [];
    const next = current.includes(deptId) ? current.filter((id: number) => id !== deptId) : [...current, deptId];
    setNewProject({ ...newProject, depts: next });
  };

  const getDeptNameById = (id: number | string) => depts.find(d => String(d.id) === String(id))?.name || "";
  const archiveProject = async (id: number) => { await patch(`projects?id=eq.${id}`, { archived: true }, token!); loadProjects(); };
  const createTask = async () => {
    if (!newTask.name || !activeProject) return;
    setSaving(true);
    const leadUser = getUserById(newTask.assigned_to);
    await createProjectTask({ name: newTask.name, dept: getDeptName(newTask.dept_id), priority: newTask.priority, deadline: newTask.deadline || null, assigned_to: newTask.assigned_to || null, status: "todo", project_id: activeProject.id, description: newTask.description || null }, token!);
    addNotification(`Задача "${newTask.name}" создана${leadUser ? ` → ${leadUser.full_name}` : ''}`, 'success');
    if (newTask.assigned_to && String(newTask.assigned_to) !== String(currentUserData?.id)) {
      createNotification({
        user_id: Number(newTask.assigned_to),
        project_id: activeProject.id,
        type: 'task_assigned',
        title: `Вам назначена новая задача`,
        body: newTask.name,
        entity_type: 'task',
      }).catch(() => {});
    }
    setNewTask({ name: "", dept_id: "", priority: "medium", deadline: "", assigned_to: "", drawing_id: "", description: "" }); setShowNewTask(false); setSaving(false); loadTasks(activeProject.id);
  };
  
  const createAssignment = async () => {
    if (!newAssignment.name || !newAssignment.target_dept || !activeProject) return;
    setSaving(true);
    await post("tasks", { 
        name: newAssignment.name, 
        dept: getDeptNameById(newAssignment.target_dept), 
        priority: newAssignment.priority, 
        deadline: newAssignment.deadline, 
        status: "todo", 
        project_id: activeProject.id,
        is_assignment: true,
        source_dept: currentUserData?.dept_id,
        assignment_status: 'pending_accept'
    }, token!);
    addNotification(`Задание смежникам отправлено`, 'success');
    setNewAssignment({ name: "", target_dept: "", priority: "high", deadline: "" }); 
    setShowNewAssignment(false); 
    setSaving(false); 
    loadTasks(activeProject.id);
  };

  const handleAssignmentResponse = async (taskId: number, accept: boolean, comment?: string) => {
      setSaving(true);
      if (accept) {
          await patch(`tasks?id=eq.${taskId}`, { assignment_status: 'accepted' }, token!);
          addNotification('Задание принято в работу', 'success');
      } else {
          await patch(`tasks?id=eq.${taskId}`, { assignment_status: 'rejected', comment: comment || 'Отклонено без комментария' }, token!);
          addNotification('Задание возвращено', 'warning');
      }
      setSaving(false);
      if(activeProject) loadTasks(activeProject.id);
  };
  const updateTaskStatus = async (taskId: number, status: string, comment?: string) => {
    const targetTask = allTasks.find(t => t.id === taskId);
    const currentStatus = targetTask?.status;
    if (currentStatus && !((taskWorkflowTransitions[currentStatus] || []).includes(status))) {
      const localAllowed = taskWorkflowTransitions[currentStatus] || [];
      const localMessage = `Переход ${currentStatus} → ${status} запрещён workflow. Допустимо: ${localAllowed.join(', ') || 'нет переходов'}.`;
      setWorkflowBlockInfo(localMessage);
      addNotification(localMessage, 'warning');
      return;
    }
    if (currentStatus) {
      try {
        const wfRes = await fetch('/api/orchestrator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: currentUserData?.id,
            project_id: activeProject?.id,
            message: 'validate workflow transition',
            action: 'validate_workflow',
            payload: { from_status: currentStatus, to_status: status }
          }),
        });
        const wfData = await wfRes.json();
        if (wfData?.blocked) {
          const msg = wfData.message || `Переход ${currentStatus} → ${status} заблокирован`;
          setWorkflowBlockInfo(msg);
          addNotification(msg, 'warning');
          return;
        }
        setWorkflowBlockInfo("");
      } catch {
        addNotification('Проверка workflow недоступна, применяю локальные правила', 'info');
      }
    }
    setSaving(true);
    await patch(`tasks?id=eq.${taskId}`, { status, ...(comment ? { comment } : {}) }, token!);
    const statusLabel = statusMap[status]?.label || status;
    addNotification(`Статус задачи изменён → "${statusLabel}"`, status === 'done' ? 'success' : 'info');
    // Создаём уведомление в БД для исполнителя задачи
    if (targetTask?.assigned_to && targetTask.assigned_to !== currentUserData?.id) {
      createNotification({
        user_id: targetTask.assigned_to,
        project_id: activeProject?.id,
        type: 'task_status',
        title: `Статус задачи изменён → "${statusLabel}"`,
        body: targetTask.name,
        entity_type: 'task',
        entity_id: String(taskId),
      }).catch(() => {});
    }
    setWorkflowBlockInfo("");
    setSaving(false); setShowTaskDetail(false); setTaskComment(""); if (activeProject) loadTasks(activeProject.id);
  };
  const isTransitionAllowed = (task: any, nextStatus: string) => {
    const fromStatus = task?.status;
    if (!fromStatus) return false;
    return (taskWorkflowTransitions[fromStatus] || []).includes(nextStatus);
  };
  const createProjectDrawing = async (payload: any) => {
    if (!activeProject) return;
    await createDrawing({ ...payload, project_id: activeProject.id, created_by: currentUserData?.id }, token!);
    addNotification('Чертеж добавлен в реестр', 'success');
    loadDrawings(activeProject.id);
  };
  const updateProjectDrawing = async (id: string, payload: any) => {
    if (!activeProject) return;
    await updateDrawing(id, { ...payload, updated_at: new Date().toISOString() }, token!);
    addNotification('Карточка чертежа обновлена', 'info');
    loadDrawings(activeProject.id);
  };
  const submitReview = async () => {
    if (!activeProject || !newReview.title.trim()) return;
    await createReview({
      project_id: activeProject.id,
      drawing_id: newReview.drawing_id || null,
      title: newReview.title.trim(),
      severity: newReview.severity,
      status: 'open',
      author_id: currentUserData?.id
    }, token!);
    setNewReview({ title: "", severity: "major", drawing_id: "" });
    addNotification('Замечание добавлено', 'success');
    loadReviews(activeProject.id);
  };
  const changeReviewStatus = async (reviewId: string, status: string) => {
    if (!activeProject) return;
    await updateReviewStatus(reviewId, status, token!);
    addNotification(`Статус замечания изменён: ${status}`, 'info');
    loadReviews(activeProject.id);
  };
  const issueDrawingRevision = async (drawing: any) => {
    if (!activeProject || !drawing) return;
    const revNum = Number(String(drawing.revision || 'R0').replace('R', '')) + 1;
    const nextRevision = `R${Number.isFinite(revNum) ? revNum : 1}`;
    await createRevisionRecord({
      project_id: activeProject.id,
      drawing_id: drawing.id,
      from_revision: drawing.revision || 'R0',
      to_revision: nextRevision,
      issued_by: currentUserData?.id
    }, token!);
    await updateProjectDrawing(drawing.id, { revision: nextRevision, status: 'in_work' });
    loadRevisions(activeProject.id);
  };
  const createProjectTransmittal = async () => {
    if (!activeProject) return;
    const draftNo = `TR-${activeProject.code}-${String(transmittals.length + 1).padStart(3, '0')}`;
    await createTransmittal({
      project_id: activeProject.id,
      number: draftNo,
      status: 'draft',
      issued_by: currentUserData?.id
    }, token!);
    addNotification('Трансмиттал создан', 'success');
    loadTransmittals(activeProject.id);
  };
  const changeTransmittalStatus = async (transmittalId: string, status: string) => {
    if (!activeProject) return;
    await updateTransmittalStatus(transmittalId, status, token!);
    addNotification(`Статус трансмиттала изменён: ${status}`, 'info');
    loadTransmittals(activeProject.id);
  };
  const addTransmittalItem = async (transmittalId: string, drawingId?: string, revisionId?: string) => {
    if (!activeProject) return;
    if (!drawingId && !revisionId) {
      addNotification('Выберите чертёж и/или ревизию для позиции трансмиттала', 'warning');
      return;
    }
    await createTransmittalItem({
      transmittal_id: transmittalId,
      drawing_id: drawingId || null,
      revision_id: revisionId || null,
    }, token!);
    addNotification('Позиция добавлена в трансмиттал', 'success');
    setTransmittalDraftLinks((prev) => ({ ...prev, [transmittalId]: { drawingId: '', revisionId: '' } }));
    loadTransmittals(activeProject.id);
  };
  const assignTask = async (taskId: number, assignedTo: string) => {
    const eng = getUserById(assignedTo);
    await patch(`tasks?id=eq.${taskId}`, { assigned_to: assignedTo, status: "todo" }, token!);
    addNotification(`Задача назначена → ${eng?.full_name || 'инженер'}`, 'info');
    setShowTaskDetail(false); if (activeProject) loadTasks(activeProject.id);
  };
  const issueRevision = async (task: any) => {
    if (!task || !activeProject) return;
    setSaving(true);
    const newRevNum = (task.revision_num || 0) + 1;
    await post("tasks", {
      name: task.name,
      project_id: task.project_id,
      dept: task.dept,
      priority: task.priority,
      status: "todo",
      assigned_to: task.assigned_to,
      deadline: task.deadline,
      revision_num: newRevNum,
      parent_task_id: task.id,
      is_assignment: task.is_assignment || false,
      source_dept: task.source_dept || null,
      assignment_status: task.assignment_status || null
    }, token!);
    addNotification(`Выпущена ревизия R${newRevNum} для задачи "${task.name}"`, 'success');
    setSaving(false);
    setShowTaskDetail(false);
    loadTasks(activeProject.id);
  };
  const handleLogin = async (accessToken: string, email: string) => { setToken(accessToken); setUserEmail(email); setScreen('dashboard'); localStorage.setItem('enghub_token', accessToken); localStorage.setItem('enghub_email', email); if (email !== "admin@enghub.com") setLoading(true); else setLoading(false); };
  const handleLogout = () => { setToken(null); setUserEmail(""); setCurrentUserData(null); setProjects([]); setTasks([]); setMsgs([]); setChatInput(""); localStorage.removeItem('enghub_token'); localStorage.removeItem('enghub_email'); };

  const handleGlobalSearchSelect = (type: string, item: any) => {
    if (type === 'projects') {
      setActiveProject(item);
      setScreen('project');
      setSideTab('tasks');
    } else if (type === 'tasks') {
      const proj = projects.find(p => p.id === item.project_id);
      if (proj) {
        setActiveProject(proj);
        setScreen('project');
        setSideTab('tasks');
        setSelectedTask(item);
        setShowTaskDetail(true);
      }
    } else if (type === 'drawings') {
      const proj = projects.find(p => p.id === item.project_id);
      if (proj) {
        setActiveProject(proj);
        setScreen('project');
        setSideTab('drawings');
      }
    }
  };

  const parseDeadline = (d: string | null | undefined): Date | null => {
    if (!d) return null;
    const dmy = d.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (dmy) return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
  };

  const formatDateRu = (d: string | null | undefined): string => {
    if (!d) return '';
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(d)) return d;
    const iso = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
    return d;
  };

  const getAutoProgress = (pid: number): number => { const pt = allTasks.filter(t => t.project_id === pid); if (pt.length === 0) return 0; return Math.round((pt.filter(t => t.status === "done").length / pt.length) * 100); };
  const activeProjectProgress = activeProject ? getAutoProgress(activeProject.id) : 0;

  if (!token) return <LoginPage onLogin={handleLogin} dark={dark} setDark={setDark} />;
  if (isAdmin) return <AdminPanel token={token} onLogout={handleLogout} dark={dark} setDark={setDark} />;

  const myLeads = appUsers.filter(u => u.role === "lead");
  const myEngineers = currentUserData ? appUsers.filter(u => u.dept_id === currentUserData.dept_id && u.role === "engineer") : [];
  const getEngLoad = (engId: any) => { const n = allTasks.filter(t => String(t.assigned_to) === String(engId) && t.status !== "done").length; return Math.min(100, Math.round((n / maxTasksPerEng) * 100)); };

  const getTaskActions = (task: any) => {
    const actions: any[] = [];
    const myId = String(currentUserData?.id);
    const assigned = String(task.assigned_to);
    if (isEng && assigned === myId) {
      if (task.status === "todo") actions.push({ label: "▶ Взять в работу", status: "inprogress", color: C.blue });
      if (task.status === "inprogress") actions.push({ label: "↑ Отправить на проверку", status: "review_lead", color: C.accent });
      if (task.status === "revision") actions.push({ label: "▶ Снова в работу", status: "inprogress", color: C.blue });
    }
    if (isLead) {
      const myEngIds = appUsers.filter(u => u.dept_id === currentUserData?.dept_id && u.role === "engineer").map(u => String(u.id));
      if (myEngIds.includes(assigned) && task.status === "review_lead") { actions.push({ label: "✓ Утвердить → ГИПу", status: "review_gip", color: C.green }); actions.push({ label: "✗ На доработку", status: "revision", color: C.red }); }
    }
    if (isGip && task.status === "review_gip") { actions.push({ label: "✓ Завершить задачу", status: "done", color: C.green }); actions.push({ label: "✗ На доработку", status: "revision", color: C.red }); }
    return actions;
  };

  const navItems = [
    { id: "dashboard", icon: "⬡", label: "Обзор" },
    { id: "projects_list", icon: "◈", label: "Проекты" },
    { id: "tasks", icon: "≡", label: "Задачи" },
    { id: "calculations", icon: "⎍", label: "Расчёты" },
    { id: "normative", icon: "📄", label: "Нормативка" }
  ];

  const screenTitles: Record<string, string> = { dashboard: "Рабочий стол", project: "Карточка проекта", projects_list: "Реестр проектов", tasks: "Мои задачи", calculations: "Инженерные расчёты", normative: "База знаний (Нормативка)" };

  const calcTemplates = Object.values(calcRegistry);
  const calcCatLabels: Record<string, string> = { "ТХ": "ТХ — Технология", "ТТ": "ТТ — Теплотехника", "ЭО": "ЭО — Электрика", "ВК": "ВК — Водоснабжение", "ПБ": "ПБ — Пожарная безопасность", "Г": "Генплан", "КЖ / КМ": "КЖ / КМ — Конструктив", "КИПиА": "КИПиА", "ОВ": "ОВ — Отопление и вентиляция" };
  const calcAllCats = ["ТХ", "ТТ", "ЭО", "ВК", "ПБ", "Г", "КЖ / КМ", "КИПиА", "ОВ"];

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-logo">⬡</div>
      <div style={{ color: "#8892a4", fontSize: 14, fontWeight: 500 }}>Загрузка EngHub...</div>
    </div>
  );

  return (
    <div className="app-root">
      {/* ===== MODALS ===== */}
      {showNewProject && (
        <Modal title="Новый проект" onClose={() => setShowNewProject(false)} C={C}>
          <div className="form-stack">
            <Field label="НАЗВАНИЕ *" C={C}><input value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} placeholder="ТЭЦ-6 Строительство" style={getInp(C)} /></Field>
            <Field label="КОД ПРОЕКТА *" C={C}><input value={newProject.code} onChange={e => setNewProject({ ...newProject, code: e.target.value })} placeholder="ТЭЦ-2025-01" style={getInp(C)} /></Field>
            <Field label="ОТДЕЛЫ *" C={C}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                {depts.map(d => (
                  <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text, cursor: 'pointer' }}>
                    <input type="checkbox" checked={newProject.depts?.includes(d.id)} onChange={() => toggleProjectDept(d.id)} />
                    {d.name}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="ДЕДЛАЙН" C={C}><input type="date" value={newProject.deadline} onChange={e => setNewProject({ ...newProject, deadline: e.target.value })} style={getInp(C)} /></Field>
            <Field label="СТАТУС" C={C}><select value={newProject.status} onChange={e => setNewProject({ ...newProject, status: e.target.value })} style={getInp(C)}><option value="active">В работе</option><option value="review">На проверке</option></select></Field>
            <button className="btn btn-primary" onClick={createProject} disabled={saving || !newProject.name || !newProject.code} style={{ width: "100%", opacity: (!newProject.name || !newProject.code) ? 0.5 : 1 }}>{saving ? "Создаётся..." : "Создать проект"}</button>
          </div>
        </Modal>
      )}
      {showTaskTemplates && (
        <TaskTemplates
          token={token!}
          C={C}
          onClose={() => setShowTaskTemplates(false)}
          onApply={(tpl: any) => {
            const deadline = tpl.duration_days
              ? new Date(Date.now() + tpl.duration_days * 86400000).toISOString().slice(0, 10)
              : '';
            setNewTask(prev => ({
              ...prev,
              name: tpl.name,
              priority: tpl.priority || 'medium',
              description: tpl.description || '',
              deadline,
            }));
          }}
        />
      )}
      {showNewTask && (
        <Modal title="Новая задача" onClose={() => { setShowNewTask(false); setNewTask({ name: "", dept_id: "", priority: "medium", deadline: "", assigned_to: "", drawing_id: "", description: "" }); setTaskSuggest(null); }} C={C}>
          <div className="form-stack">
            <button
              type="button"
              onClick={() => setShowTaskTemplates(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: C.accent, fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
            >
              📋 Выбрать из шаблона
            </button>
            <Field label="НАЗВАНИЕ *" C={C}><input value={newTask.name} onChange={e => setNewTask({ ...newTask, name: e.target.value })} placeholder="Расчёт нагрузок" style={getInp(C)} /></Field>
            <Field label="ОПИСАНИЕ" C={C}><textarea value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} placeholder="Подробное описание задачи..." rows={3} style={{ ...getInp(C), resize: 'vertical', fontFamily: 'inherit' }} /></Field>
            <Field label="НАЗНАЧИТЬ РУКОВОДИТЕЛЮ" C={C}><select value={newTask.assigned_to} onChange={e => { const lead = appUsers.find(u => String(u.id) === e.target.value); setNewTask({ ...newTask, assigned_to: e.target.value, dept_id: lead?.dept_id || "" }); }} style={getInp(C)}><option value="">— Выбрать —</option>{myLeads.map(u => <option key={u.id} value={u.id}>{u.full_name} ({getDeptName(u.dept_id)})</option>)}</select></Field>
            <Field label="ЧЕРТЕЖ (ОПЦИОНАЛЬНО)" C={C}>
              <select value={newTask.drawing_id} onChange={e => setNewTask({ ...newTask, drawing_id: e.target.value })} style={getInp(C)}>
                <option value="">— Без привязки —</option>
                {drawings.map(d => <option key={d.id} value={d.id}>{d.code} — {d.title}</option>)}
              </select>
            </Field>
            <Field label="ПРИОРИТЕТ" C={C}><select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })} style={getInp(C)}><option value="high">🔴 Высокий</option><option value="medium">🟡 Средний</option><option value="low">⚪ Низкий</option></select></Field>
            <Field label="ДЕДЛАЙН" C={C}><input type="date" value={newTask.deadline} onChange={e => setNewTask({ ...newTask, deadline: e.target.value })} style={getInp(C)} /></Field>
            {taskSuggestLoading && (
              <div style={{ fontSize: 12, color: C.accent, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: `2px solid ${C.accent}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                AI подбирает дедлайн…
              </div>
            )}
            {taskSuggest && !taskSuggestLoading && (
              <div style={{ background: C.accent + '12', border: `1px solid ${C.accent}30`, borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>🤖</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.accent }}>AI предлагает дедлайн: {taskSuggest.deadline}</div>
                  {taskSuggest.reason && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{taskSuggest.reason}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => { setNewTask(prev => ({ ...prev, deadline: taskSuggest.deadline! })); setTaskSuggest(null); }}
                  style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                >
                  Применить
                </button>
              </div>
            )}
            <button className="btn btn-primary" onClick={createTask} disabled={saving || !newTask.name} style={{ width: "100%", opacity: !newTask.name ? 0.5 : 1 }}>{saving ? "Создаётся..." : "Создать задачу"}</button>
          </div>
        </Modal>
      )}
      {showNewAssignment && (
        <Modal title="Задание смежнику" onClose={() => setShowNewAssignment(false)} C={C}>
          <div className="form-stack">
            <Field label="СУТЬ ЗАДАНИЯ *" C={C}><input value={newAssignment.name} onChange={e => setNewAssignment({ ...newAssignment, name: e.target.value })} placeholder="Выдать нагрузки на фундамент..." style={getInp(C)} /></Field>
            <Field label="ОТДЕЛ-ПОЛУЧАТЕЛЬ *" C={C}>
              <select value={newAssignment.target_dept} onChange={e => setNewAssignment({ ...newAssignment, target_dept: e.target.value })} style={getInp(C)}>
                <option value="">— Выбрать отдел —</option>
                {activeProject?.depts?.filter((d:number) => String(d) !== String(currentUserData?.dept_id)).map((dId: number) => <option key={dId} value={dId}>{getDeptNameById(dId)}</option>)}
              </select>
            </Field>
            <Field label="ПРИОРИТЕТ" C={C}><select value={newAssignment.priority} onChange={e => setNewAssignment({ ...newAssignment, priority: e.target.value })} style={getInp(C)}><option value="high">🔴 Высокий</option><option value="medium">🟡 Средний</option><option value="low">⚪ Низкий</option></select></Field>
            <Field label="ТРЕБУЕМЫЙ ДЕДЛАЙН" C={C}><input type="date" value={newAssignment.deadline} onChange={e => setNewAssignment({ ...newAssignment, deadline: e.target.value })} style={getInp(C)} /></Field>
            <button className="btn btn-primary" onClick={createAssignment} disabled={saving || !newAssignment.name || !newAssignment.target_dept} style={{ width: "100%", opacity: (!newAssignment.name || !newAssignment.target_dept) ? 0.5 : 1 }}>{saving ? "Отправка..." : "Отправить задание"}</button>
          </div>
        </Modal>
      )}
      {showTaskDetail && selectedTask && (
        <Modal title="Задача" onClose={() => { setShowTaskDetail(false); setSelectedTask(null); setTaskComment(""); setWorkflowBlockInfo(""); setChatInput(""); loadMessages(activeProject.id); }} C={C}>
          <div className="form-stack">
            <div style={{ background: C.surface2, borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: C.text }}>{selectedTask.name}</div>
                <div title={`Ревизия ${selectedTask.revision_num || 0}`} style={{ background: C.accent + '20', color: C.accent, fontWeight: 700, fontSize: 12, padding: '3px 8px', borderRadius: 6, cursor: 'help' }}>R{selectedTask.revision_num || 0}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                <BadgeComp status={selectedTask.status} C={C} />
                <PriorityDot p={selectedTask.priority} C={C} />
                {selectedTask.dept && <span style={{ fontSize: 11, color: C.textMuted, background: C.surface, padding: "3px 8px", borderRadius: 6 }}>{selectedTask.dept}</span>}
                {selectedTask.drawing_id && (() => {
                  const d = drawings.find(dr => String(dr.id) === String(selectedTask.drawing_id));
                  return d ? <span style={{ fontSize: 11, color: C.textMuted, background: C.surface, padding: "3px 8px", borderRadius: 6 }}>📐 {d.code}</span> : null;
                })()}
                {selectedTask.deadline && <span style={{ fontSize: 11, color: (() => { const dl = parseDeadline(selectedTask.deadline); return dl && dl < new Date() ? C.red : C.textMuted; })() }}>до {formatDateRu(selectedTask.deadline)}</span>}
              </div>
            </div>
            {selectedTask.parent_task_id && (
              <div style={{ fontSize: 11, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                🔗 Предыдущая ревизия: <span style={{ color: C.accent, cursor: 'pointer' }} onClick={() => { const p = allTasks.find(t => t.id === selectedTask.parent_task_id); if (p) setSelectedTask(p); }}>#{String(selectedTask.parent_task_id).slice(0, 4)}</span>
              </div>
            )}
            {(() => {
              if (!selectedTask.assigned_to) return <div style={{ fontSize: 12, color: C.textMuted }}>👤 Исполнитель не назначен</div>;
              const u = getUserById(selectedTask.assigned_to);
              if (u) return (<div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><AvatarComp user={u} size={28} C={C} /><span style={{ color: C.textDim, fontWeight: 500 }}>{u.full_name}</span><span style={{ fontSize: 11, color: C.textMuted }}>{u.position || roleLabels[u.role]}</span></div>);
              return <div style={{ fontSize: 12, color: C.textMuted }}>👤 Исполнитель: ID {String(selectedTask.assigned_to).slice(0, 8)}…</div>;
            })()}
            {selectedTask.drawing_id && (() => {
              const d = drawings.find(dr => String(dr.id) === String(selectedTask.drawing_id));
              return d ? (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, fontSize: 12 }}>
                  <div style={{ color: C.textMuted, marginBottom: 4 }}>Связанный чертеж</div>
                  <div style={{ color: C.text, fontWeight: 600 }}>{d.code} — {d.title}</div>
                  <div style={{ color: C.textMuted, marginTop: 2 }}>Ревизия: {d.revision || 'R0'} · Статус: {d.status || 'draft'}</div>
                </div>
              ) : null;
            })()}
            {selectedTask.description && (<div style={{ background: C.surface2, borderRadius: 10, padding: 14 }}><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Описание</div><div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6 }}>{selectedTask.description}</div></div>)}
            {selectedTask.comment && (<div style={{ background: C.red + "10", border: `1px solid ${C.red}25`, borderRadius: 10, padding: 14 }}><div style={{ fontSize: 10, color: C.red, fontWeight: 600, marginBottom: 4 }}>КОММЕНТАРИЙ К ДОРАБОТКЕ</div><div style={{ fontSize: 13, color: C.textDim }}>{selectedTask.comment}</div></div>)}
            {workflowBlockInfo && (
              <div style={{ background: C.red + "12", border: `1px solid ${C.red}30`, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginBottom: 4 }}>БЛОКИРОВКА WORKFLOW</div>
                <div style={{ fontSize: 12, color: C.textDim }}>{workflowBlockInfo}</div>
              </div>
            )}
            {isLead && selectedTask.status === "todo" && String(selectedTask.assigned_to) === String(currentUserData?.id) && (
              <Field label="НАЗНАЧИТЬ ИНЖЕНЕРУ" C={C}><select onChange={e => { if (e.target.value) assignTask(selectedTask.id, e.target.value); }} defaultValue="" style={getInp(C)}><option value="">— Выбрать инженера —</option>{myEngineers.map(u => <option key={u.id} value={u.id}>{u.full_name} — {getEngLoad(u.id)}% загрузка</option>)}</select></Field>
            )}
            {isLead && (<Field label="ПРИОРИТЕТ" C={C}><select value={selectedTask.priority} onChange={async e => { await patch(`tasks?id=eq.${selectedTask.id}`, { priority: e.target.value }, token!); setSelectedTask({ ...selectedTask, priority: e.target.value }); if (activeProject) loadTasks(activeProject.id); }} style={getInp(C)}><option value="high">🔴 Высокий</option><option value="medium">🟡 Средний</option><option value="low">⚪ Низкий</option></select></Field>)}
            {(isLead || isGip) && (
              <Field label="СВЯЗАННЫЙ ЧЕРТЕЖ" C={C}>
                <select
                  value={selectedTask.drawing_id || ""}
                  onChange={async (e) => {
                    const value = e.target.value || null;
                    await updateTaskDrawingLink(selectedTask.id, value, token!);
                    setSelectedTask({ ...selectedTask, drawing_id: value });
                    if (activeProject) loadTasks(activeProject.id);
                  }}
                  style={getInp(C)}
                >
                  <option value="">— Без привязки —</option>
                  {drawings.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.title}</option>)}
                </select>
              </Field>
            )}
            {isGip && (
              <Field label="СТАТУС ЗАДАЧИ (ГИП)" C={C}>
                <select value={selectedTask.status} onChange={async e => {
                  const newStatus = e.target.value;
                  await patch(`tasks?id=eq.${selectedTask.id}`, { status: newStatus }, token!);
                  setSelectedTask({ ...selectedTask, status: newStatus });
                  if (activeProject) loadTasks(activeProject.id);
                  addNotification(`Статус задачи → "${statusMap[newStatus]?.label || newStatus}"`, 'info');
                }} style={getInp(C)}>
                  <option value="todo">В очереди</option>
                  <option value="inprogress">В работе</option>
                  <option value="review_lead">На проверке</option>
                  <option value="review_gip">Проверка ГИПа</option>
                  <option value="revision">Доработка</option>
                  <option value="done">Завершена</option>
                </select>
              </Field>
            )}
            {getTaskActions(selectedTask).length > 0 && (
              <div>
                <div className="field-label" style={{ marginBottom: 8 }}>ДЕЙСТВИЯ</div>
                {(selectedTask.status === "review_lead" || selectedTask.status === "review_gip") && (<div style={{ marginBottom: 10 }}><div className="field-label" style={{ marginBottom: 6 }}>КОММЕНТАРИЙ ПРИ ДОРАБОТКЕ</div><input value={taskComment} onChange={e => setTaskComment(e.target.value)} placeholder="Что нужно исправить..." style={getInp(C)} /></div>)}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {getTaskActions(selectedTask).map((action: any, i: number) => (
                    <button key={i} onClick={() => updateTaskStatus(selectedTask.id, action.status, taskComment)} disabled={saving}
                      style={{ background: action.color + "15", border: `1px solid ${action.color}30`, color: action.color, borderRadius: 10, padding: "11px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>{action.label}</button>
                  ))}
                  {getTaskActions(selectedTask).length > 0 && (
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      {getTaskActions(selectedTask).every((a: any) => isTransitionAllowed(selectedTask, a.status))
                        ? '✓ Все доступные кнопки соответствуют workflow.'
                        : '⚠ Есть действия вне workflow. Проверьте переходы.'}
                    </div>
                  )}
                  {isGip && selectedTask.status === "done" && (
                    <button onClick={() => issueRevision(selectedTask)} disabled={saving}
                      style={{ background: C.accent + "15", border: `1px dashed ${C.accent}`, color: C.accent, borderRadius: 10, padding: "11px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", marginTop: 8 }}>⚡ Выпустить новую ревизию (R{(selectedTask.revision_num || 0) + 1})</button>
                  )}
                </div>
              </div>
            )}
            
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Замечания и обсуждение</div>
              <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', height: 250 }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {msgs.filter(m => String(m.task_id) === String(selectedTask.id)).length === 0 && <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 12, marginTop: 40 }}>Пока нет замечаний</div>}
                  {msgs.filter(m => String(m.task_id) === String(selectedTask.id)).map(m => {
                    const mu = getUserById(m.user_id);
                    return (
                      <div key={m.id} style={{ alignSelf: mu?.id === currentUserData?.id ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2, justifyContent: mu?.id === currentUserData?.id ? 'flex-end' : 'flex-start' }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: C.textDim }}>{mu?.full_name?.split(' ')[0]}</span>
                          <span style={{ fontSize: 9, color: C.textMuted }}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ background: mu?.id === currentUserData?.id ? C.accent : C.surface2, color: mu?.id === currentUserData?.id ? '#fff' : C.text, padding: '8px 12px', borderRadius: 10, fontSize: 13 }}>{m.text}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: 10, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg(selectedTask.id)} placeholder="Написать замечание..." style={{ ...getInp(C), borderRadius: 8, height: 36, fontSize: 12 }} />
                  <button onClick={() => sendMsg(selectedTask.id)} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer' }}>↑</button>
                </div>
              </div>
              {/* Task History */}
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={async () => {
                    if (!showTaskHistory) {
                      const h = await listTaskHistory(selectedTask.id, token!).catch(() => []);
                      setTaskHistory(Array.isArray(h) ? h : []);
                    }
                    setShowTaskHistory(v => !v);
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}
                >
                  🕐 {showTaskHistory ? 'Скрыть историю' : 'История изменений'}
                </button>
                {showTaskHistory && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {taskHistory.length === 0
                      ? <div style={{ fontSize: 12, color: C.textMuted, padding: '6px 0' }}>Изменений пока нет</div>
                      : taskHistory.map(h => {
                          const FIELD_LABELS: Record<string, string> = { status: 'Статус', priority: 'Приоритет', assigned_to: 'Исполнитель', deadline: 'Дедлайн' };
                          const STATUS_RU: Record<string, string> = { todo: 'В очереди', inprogress: 'В работе', review_lead: 'Проверка', review_gip: 'Проверка ГИПа', revision: 'Доработка', done: 'Готово' };
                          const fmt = (v: string, field: string) => {
                            if (field === 'status') return STATUS_RU[v] || v;
                            if (field === 'assigned_to') return getUserById(Number(v))?.full_name || `#${v}`;
                            return v || '—';
                          };
                          return (
                            <div key={h.id} style={{ fontSize: 12, color: C.textMuted, display: 'flex', gap: 8, padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                              <span style={{ color: C.textMuted, minWidth: 110 }}>{new Date(h.changed_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                              <span style={{ color: C.text }}><b>{FIELD_LABELS[h.field_name] || h.field_name}</b>: <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{fmt(h.old_value, h.field_name)}</span> → <span style={{ color: C.accent }}>{fmt(h.new_value, h.field_name)}</span></span>
                            </div>
                          );
                        })
                    }
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
      
      {incomingCall && (
          <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10001, background: C.surface, border: `2px solid ${C.accent}`, borderRadius: 16, padding: '20px 30px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: 20, animation: 'slideDown 0.4s ease-out' }}>
              <div style={{ background: C.accent, color: '#fff', width: 50, height: 50, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, animation: 'pulse 1.5s infinite' }}>📞</div>
              <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>Входящий вызов</div>
                  <div style={{ fontSize: 13, color: C.textDim }}>{incomingCall.initiator_name} приглашает вас в проект "{incomingCall.project_name}"</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" onClick={() => { setScreen('project'); setSideTab('conference'); setIncomingCall(null); }}>Открыть совещание</button>
                  <button className="btn btn-ghost" onClick={() => setIncomingCall(null)}>Позже</button>
              </div>
          </div>
      )}

      {showArchive && (
        <Modal title="📦 Архив проектов" onClose={() => setShowArchive(false)} C={C}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {archivedProjects.length === 0 ? <div className="empty-state" style={{ padding: 30 }}>Архив пуст</div> : archivedProjects.map(p => (
              <div key={p.id} style={{ background: C.surface2, borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontWeight: 600, color: C.text }}>{p.name}</div><div style={{ fontSize: 11, color: C.textMuted }}>{p.code} · до {p.deadline}</div></div>
                <span style={{ fontSize: 11, color: C.textMuted }}>В архиве</span>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* ===== SIDEBAR ===== */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">⬡</div>
          <div className="sidebar-logo-text">EngHub</div>
        </div>
        <div className="sidebar-logo-sub">ENGINEERING PLATFORM</div>
        <div className="sidebar-nav">
          <div className="sidebar-section-label">Навигация</div>
          {navItems.map(n => (
            <button key={n.id} className={`sidebar-btn ${screen === n.id ? "active" : ""}`} onClick={() => setScreen(n.id)}>
              <span className="sidebar-btn-icon">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </div>

        {/* Проекты в сайдбаре (Figma-style) */}
        {projects.length > 0 && (
          <div style={{ padding: "0 12px", marginBottom: 16 }}>
            <div className="sidebar-section-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Проекты</span>
              <span style={{ color: C.accent, fontSize: 11, cursor: "pointer" }}>Все →</span>
            </div>
            {projects.map((p, i) => {
              const progress = getAutoProgress(p.id);
              const dotColors = [C.accent, C.blue, C.purple, C.green, C.orange];
              const isActive = activeProject?.id === p.id;
              return (
                <div key={p.id}>
                  <button className={`sidebar-project-item ${isActive ? "active" : ""}`}
                    onClick={() => { setActiveProject(p); setScreen("project"); setSideTab("tasks"); setSelectedDeptId(null); }}>
                    <div className="sidebar-project-dot" style={{ background: dotColors[i % dotColors.length] }} />
                    <div className="sidebar-project-info">
                      <div className="sidebar-project-name">{p.name || p.code}</div>
                      <div className="sidebar-project-progress" style={{ fontSize: 10 }}>{p.code} • {progress}%</div>
                    </div>
                  </button>
                  {isActive && p.depts && p.depts.length > 0 && (
                    <div className="sidebar-project-depts" style={{ paddingLeft: 24, marginTop: -4, marginBottom: 8 }}>
                      <button className={`sidebar-dept-item ${selectedDeptId === null ? "active" : ""}`} onClick={() => { setSelectedDeptId(null); setScreen("project"); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 13, background: selectedDeptId === null ? C.surface2 : 'transparent', color: selectedDeptId === null ? C.text : C.textMuted, border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                        ВЕСЬ ПРОЕКТ
                      </button>
                      {p.depts.map((dId: number) => {
                        const dept = depts.find(d => String(d.id) === String(dId));
                        if (!dept) return null;
                        const isDeptActive = selectedDeptId === dId;
                        return (
                          <button key={dId} className={`sidebar-dept-item ${isDeptActive ? "active" : ""}`} onClick={() => { setSelectedDeptId(dId); setScreen("project"); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 13, background: isDeptActive ? C.surface2 : 'transparent', color: isDeptActive ? C.text : C.textMuted, border: 'none', borderRadius: 6, cursor: 'pointer', marginTop: 2 }}>
                            ↳ {dept.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {isGip && <button className="sidebar-btn" onClick={() => setShowNewProject(true)} style={{ color: C.accent, marginTop: 4 }}>
              <span className="sidebar-btn-icon">+</span><span>Новый проект</span>
            </button>}
          </div>
        )}

        <div style={{ padding: "0 12px" }}>
          <div className="sidebar-section-label">Система</div>
          <button className="sidebar-btn" onClick={() => { loadArchived(); setShowArchive(true); }}>
            <span className="sidebar-btn-icon">📦</span><span>Архив</span>
          </button>
        </div>

        <div className="sidebar-bottom">
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px" }}>
            <AvatarComp user={currentUserData} size={34} C={C} />
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentUserData?.full_name?.split(" ").slice(0, 2).join(" ")}</div>
              <div style={{ fontSize: 10, color: C.sidebarText }}>{currentUserData?.position || roleLabels[currentUserData?.role] || ""}</div>
            </div>
            <button onClick={handleLogout} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, padding: 4 }} title="Выйти">⏻</button>
          </div>
        </div>
      </div>

      {/* ===== MAIN AREA ===== */}
      <div className="main-area">
        {/* TOPBAR (Figma-style breadcrumbs) */}
        <div className="topbar">
          <div className="topbar-left">
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="topbar-title">{screen === "project" ? "Карточка проекта" : screenTitles[screen] || "EngHub"}</span>
              <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 400 }}>/ EngHub</span>
            </div>
          </div>
          <div className="topbar-right">
            <GlobalSearch token={token!} C={C} onSelect={handleGlobalSearchSelect} projects={projects} />
            <ThemeToggle dark={dark} setDark={setDark} C={C} />
            {currentUserData && (
              <NotificationCenter
                userId={currentUserData.id}
                token={token!}
                C={C}
                onNavigate={(entityType, entityId, projectId) => {
                  if (entityType === 'task') { setScreen('tasks'); }
                  else if (entityType === 'drawing') { setScreen('drawings'); }
                  else if (entityType === 'review') { setScreen('drawings'); }
                }}
              />
            )}
            {currentUserData && (
              <div ref={userMenuRef} style={{ position: 'relative' }}>
                <div className="topbar-user" style={{ cursor: 'pointer' }} onClick={() => setShowUserMenu(v => !v)}>
                  <AvatarComp user={currentUserData} size={34} C={C} />
                  <div className="topbar-user-info">
                    <div className="topbar-user-name">{currentUserData.full_name}</div>
                    <div className="topbar-user-role">{currentUserData.position || roleLabels[role]}</div>
                  </div>
                </div>
                {showUserMenu && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', minWidth: 200, zIndex: 2000, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <AvatarComp user={currentUserData} size={36} C={C} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{currentUserData.full_name}</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>{roleLabels[role]}</div>
                      </div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: C.text, boxSizing: 'border-box' }}>
                      🖼 Загрузить фото
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !currentUserData) return;
                        const path = `${currentUserData.id}/${Date.now()}.${file.name.split('.').pop()}`;
                        try {
                          const uploadRes = await fetch(`${SURL}/storage/v1/object/avatars/${path}`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': file.type },
                            body: file,
                          });
                          if (!uploadRes.ok) throw new Error('Upload failed');
                          const publicUrl = `${SURL}/storage/v1/object/public/avatars/${path}`;
                          await patch(`app_users?id=eq.${currentUserData.id}`, { avatar_url: publicUrl }, token!);
                          setAppUsers(prev => prev.map(u => u.id === currentUserData.id ? { ...u, avatar_url: publicUrl } : u));
                          addNotification('Фото профиля обновлено', 'success');
                        } catch {
                          addNotification('Ошибка загрузки фото', 'warning');
                        }
                        setShowUserMenu(false);
                      }} />
                    </label>
                    <button onClick={() => { setShowUserMenu(false); handleLogout(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, fontWeight: 600 }}>
                      ⏻ Выйти из системы
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CONTENT */}
        <div className="content">
          {/* ===== DASHBOARD ===== */}
          {screen === "dashboard" && (
            <div className="screen-fade">
              <div className="page-header">
                <div>
                  <div className="page-label">Рабочий стол</div>
                  <div className="page-title">Добро пожаловать, {currentUserData?.full_name?.split(" ")[1] || currentUserData?.full_name?.split(" ")[0]} 👋</div>
                </div>
                {isGip && <button className="btn btn-primary" onClick={() => setShowNewProject(true)}>+ Новый проект</button>}
              </div>

              {/* Поиск */}
              <div className="search-wrap" style={{ marginBottom: 20 }}>
                <span className="search-icon">🔍</span>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по проектам и задачам..."
                  className="search-input" style={getInp(C, { paddingLeft: 40, borderRadius: 10, background: C.surface })} />
                {searchQuery && <button className="search-clear" onClick={() => setSearchQuery("")}>✕</button>}
              </div>

              {/* ── KPI карточки ── */}
              {(() => {
                const now = new Date();
                const baseTasks = (isGip || isAdmin) ? allTasks : tasks;
                const overdueProjects = projects.filter(p => { const dl = parseDeadline(p.deadline); return dl && dl < now && p.status !== 'done' && !p.archived; }).length;
                return (
                  <div className="stats-row">
                    {((isGip || isAdmin) ? [
                      { label: "Проектов", value: projects.length, color: C.accent, onClick: () => {} },
                      { label: "Активных задач", value: allTasks.filter(t => t.status !== "done").length, color: C.blue, onClick: () => setSideTab('tasks') },
                      { label: "На проверке ГИПа", value: allTasks.filter(t => t.status === "review_gip").length, color: C.purple, onClick: () => setSideTab('tasks') },
                      { label: "Просроченных проектов", value: overdueProjects, color: overdueProjects > 0 ? C.red : C.green, onClick: () => {} },
                    ] : isLead ? [
                      { label: "Задач в отделе", value: baseTasks.length, color: C.accent, onClick: () => setSideTab('tasks') },
                      { label: "В работе", value: baseTasks.filter(t => t.status === "inprogress").length, color: C.blue, onClick: () => setSideTab('tasks') },
                      { label: "На проверке", value: baseTasks.filter(t => t.status === "review_lead" || t.status === "review_gip").length, color: C.purple, onClick: () => setSideTab('tasks') },
                      { label: "Завершено", value: baseTasks.filter(t => t.status === "done").length, color: C.green, onClick: () => setSideTab('tasks') },
                    ] : [
                      { label: "Мои задачи", value: baseTasks.length, color: C.accent, onClick: () => setSideTab('tasks') },
                      { label: "В работе", value: baseTasks.filter(t => t.status === "inprogress").length, color: C.blue, onClick: () => setSideTab('tasks') },
                      { label: "На проверке", value: baseTasks.filter(t => t.status === "review_lead" || t.status === "review_gip").length, color: C.purple, onClick: () => setSideTab('tasks') },
                      { label: "Завершено", value: baseTasks.filter(t => t.status === "done").length, color: C.green, onClick: () => setSideTab('tasks') },
                    ]).map(s => (
                      <div key={s.label} className="stat-card" onClick={s.onClick} style={{ cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 4px 16px ${s.color}30`)}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}>
                        <div className="stat-card-header"><span className="stat-card-dot" style={{ background: s.color }} /><span className="stat-card-label">{s.label}</span></div>
                        <div className="stat-card-value" style={{ color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Результаты поиска */}
              {searchQuery && (() => {
                const sq = searchQuery.toLowerCase();
                const matchedTasks = tasks.filter(t => t.name.toLowerCase().includes(sq) || (t.dept || "").toLowerCase().includes(sq));
                if (matchedTasks.length > 0) return (
                  <div style={{ marginBottom: 20 }}>
                    <div className="page-label" style={{ marginBottom: 10 }}>Найдено задач: {matchedTasks.length}</div>
                    <div className="task-list">
                      {matchedTasks.map(t => { const u = getUserById(t.assigned_to); return (
                        <div key={t.id} className="task-row" onClick={() => { setSelectedTask(t); setShowTaskDetail(true); }}>
                          <PriorityDot p={t.priority} C={C} /><span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 500 }}>{t.name}</span>
                          {u && <span style={{ fontSize: 11, color: C.textMuted }}>{u.full_name.split(" ")[0]}</span>}<BadgeComp status={t.status} C={C} />
                        </div>
                      ); })}
                    </div>
                  </div>
                ); else return null;
              })()}

              {/* ── АНАЛИТИКА ДЛЯ ГИПа / АДМИНИСТРАТОРА ── */}
              {(isGip || isAdmin) && (
                <div className="analytics-grid-2">
                  {/* Загрузка отделов */}
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                    <div className="page-label" style={{ marginBottom: 14 }}>Загрузка отделов</div>
                    {(() => {
                      const deptLoad: Record<string, { total: number; done: number; review: number }> = {};
                      for (const t of allTasks) {
                        const dn = t.dept || 'Без отдела';
                        if (!deptLoad[dn]) deptLoad[dn] = { total: 0, done: 0, review: 0 };
                        deptLoad[dn].total++;
                        if (t.status === 'done') deptLoad[dn].done++;
                        if (t.status === 'review_gip' || t.status === 'review_lead') deptLoad[dn].review++;
                      }
                      const entries = Object.entries(deptLoad).sort((a, b) => b[1].total - a[1].total);
                      const maxVal = entries[0]?.[1].total || 1;
                      return entries.length > 0 ? entries.map(([name, d]) => (
                        <div key={name} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                            <span style={{ color: C.text, fontWeight: 500 }}>{name}</span>
                            <span style={{ color: C.textMuted }}>{d.total} задач · {d.done} готово</span>
                          </div>
                          <div style={{ height: 7, background: C.surface2, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                            <div style={{ height: '100%', width: `${(d.done / maxVal) * 100}%`, background: C.green, transition: 'width 0.4s' }} />
                            <div style={{ height: '100%', width: `${((d.total - d.done) / maxVal) * 100}%`, background: C.accent + '60', transition: 'width 0.4s' }} />
                          </div>
                        </div>
                      )) : <div style={{ fontSize: 13, color: C.textMuted }}>Нет данных</div>;
                    })()}
                  </div>

                  {/* Дедлайны проектов */}
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                    <div className="page-label" style={{ marginBottom: 14 }}>Дедлайны проектов</div>
                    {[...projects].sort((a, b) => (parseDeadline(a.deadline)?.getTime() ?? 99999999999999) - (parseDeadline(b.deadline)?.getTime() ?? 99999999999999)).map(p => {
                      const now = new Date();
                      const dl = parseDeadline(p.deadline);
                      const daysLeft = dl ? Math.ceil((dl.getTime() - now.getTime()) / 86400000) : null;
                      const isDoneOrArchived = p.status === 'done' || p.archived;
                      const color = daysLeft === null ? C.textMuted : (daysLeft < 0 && !isDoneOrArchived) ? C.red : daysLeft < 14 ? C.orange : C.green;
                      const label = daysLeft === null ? '—' : daysLeft < 0 ? `Просрочен ${-daysLeft} д.` : daysLeft === 0 ? 'Сегодня!' : `${daysLeft} дн.`;
                      const progress = getAutoProgress(p.id);
                      return (
                        <div key={p.id} onClick={() => { setActiveProject(p); setScreen('project'); setSideTab('tasks'); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: C.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                            <div style={{ fontSize: 10, color: C.textMuted }}>{p.code}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 11, color, fontWeight: 700 }}>{label}</div>
                            <div style={{ fontSize: 10, color: C.textMuted }}>{progress}%</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Очередь на проверку ГИПа */}
              {(isGip || isAdmin) && (() => {
                const reviewTasks = allTasks.filter(t => t.status === 'review_gip');
                if (reviewTasks.length === 0) return null;
                return (
                  <div style={{ background: C.surface, border: `1px solid ${C.purple}30`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div className="page-label" style={{ color: C.purple }}>Ожидают проверки ГИПа</div>
                      <span style={{ fontSize: 12, color: C.purple, background: C.purple + '20', padding: '2px 10px', borderRadius: 10, fontWeight: 700 }}>{reviewTasks.length}</span>
                    </div>
                    <div className="task-list">
                      {reviewTasks.map(t => {
                        const u = getUserById(t.assigned_to);
                        const proj = projects.find(p => p.id === t.project_id);
                        return (
                          <div key={t.id} className="task-row" onClick={() => { setSelectedTask(t); setShowTaskDetail(true); }}>
                            <PriorityDot p={t.priority} C={C} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{t.name}</div>
                              <div style={{ fontSize: 11, color: C.textMuted }}>{proj?.code} · {t.dept}</div>
                            </div>
                            {u && <span style={{ fontSize: 11, color: C.textMuted }}>{u.full_name.split(' ')[0]}</span>}
                            <BadgeComp status={t.status} C={C} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ── АНАЛИТИКА ДЛЯ РУКОВОДИТЕЛЯ ОТДЕЛА ── */}
              {isLead && (() => {
                const myDeptId = currentUserData?.dept_id;
                const myEngineers = appUsers.filter(u => u.dept_id === myDeptId && u.role === 'engineer');
                const myDeptTasks = tasks; // уже отфильтровано по отделу
                return (
                  <div style={{ marginBottom: 20 }}>
                    {/* Загрузка инженеров */}
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                      <div className="page-label" style={{ marginBottom: 14 }}>Загрузка инженеров отдела</div>
                      {myEngineers.length === 0 ? (
                        <div style={{ fontSize: 13, color: C.textMuted }}>Инженеры не назначены в отдел</div>
                      ) : myEngineers.map(eng => {
                        const engTasks = myDeptTasks.filter(t => String(t.assigned_to) === String(eng.id));
                        const done = engTasks.filter(t => t.status === 'done').length;
                        const inprog = engTasks.filter(t => t.status === 'inprogress').length;
                        const review = engTasks.filter(t => t.status === 'review_lead' || t.status === 'review_gip').length;
                        const todo = engTasks.filter(t => t.status === 'todo').length;
                        const total = engTasks.length;
                        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                        return (
                          <div key={eng.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                            <AvatarComp user={eng} size={32} C={C} />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                <span style={{ color: C.text, fontWeight: 600 }}>{eng.full_name}</span>
                                <span style={{ color: C.textMuted }}>{total} задач · {pct}% готово</span>
                              </div>
                              <div style={{ height: 7, background: C.surface2, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                                <div title="Завершено" style={{ width: `${total > 0 ? (done/total)*100 : 0}%`, background: C.green, height: '100%' }} />
                                <div title="На проверке" style={{ width: `${total > 0 ? (review/total)*100 : 0}%`, background: C.purple, height: '100%' }} />
                                <div title="В работе" style={{ width: `${total > 0 ? (inprog/total)*100 : 0}%`, background: C.blue, height: '100%' }} />
                                <div title="В очереди" style={{ width: `${total > 0 ? (todo/total)*100 : 0}%`, background: C.accent + '50', height: '100%' }} />
                              </div>
                              <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 10, color: C.textMuted }}>
                                {done > 0 && <span style={{ color: C.green }}>✓ {done} готово</span>}
                                {review > 0 && <span style={{ color: C.purple }}>◎ {review} проверка</span>}
                                {inprog > 0 && <span style={{ color: C.blue }}>▶ {inprog} в работе</span>}
                                {todo > 0 && <span>☐ {todo} в очереди</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Задачи ожидающие проверки руководителя */}
                    {(() => {
                      const waitReview = myDeptTasks.filter(t => t.status === 'review_lead');
                      if (waitReview.length === 0) return null;
                      return (
                        <div style={{ background: C.surface, border: `1px solid ${C.purple}30`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div className="page-label" style={{ color: C.purple }}>Ожидают вашей проверки</div>
                            <span style={{ fontSize: 12, color: C.purple, background: C.purple + '20', padding: '2px 10px', borderRadius: 10, fontWeight: 700 }}>{waitReview.length}</span>
                          </div>
                          <div className="task-list">
                            {waitReview.map(t => {
                              const u = getUserById(t.assigned_to);
                              return (
                                <div key={t.id} className="task-row" onClick={() => { setSelectedTask(t); setShowTaskDetail(true); }}>
                                  <PriorityDot p={t.priority} C={C} />
                                  <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 500 }}>{t.name}</span>
                                  {u && <span style={{ fontSize: 11, color: C.textMuted }}>{u.full_name.split(' ')[0]}</span>}
                                  <BadgeComp status={t.status} C={C} />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* ── Проекты ── */}
              <div className="page-label" style={{ marginBottom: 12 }}>Проекты</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {projects.filter(p => { if (!searchQuery) return true; const sq = searchQuery.toLowerCase(); return p.name.toLowerCase().includes(sq) || p.code.toLowerCase().includes(sq); }).map(p => {
                  const progress = getAutoProgress(p.id);
                  return (
                    <div key={p.id} className={`project-card ${activeProject?.id === p.id ? "active" : ""}`} onClick={() => { setActiveProject(p); setScreen("project"); setSideTab("tasks"); }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <span style={{ fontWeight: 600, fontSize: 15, color: C.text }}>{p.name}</span>
                          <span style={{ fontSize: 11, color: C.textMuted, background: C.surface2, padding: "3px 10px", borderRadius: 6 }}>{p.code}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: (() => { const dl = parseDeadline(p.deadline); return dl && dl < new Date() ? C.red : C.textMuted; })() }}>до {p.deadline}</span>
                          {isGip && <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); if (window.confirm(`Отправить "${p.name}" в архив?`)) archiveProject(p.id); }}>→ Архив</button>}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div className="progress-track" style={{ flex: 1 }}><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.accent, minWidth: 40, textAlign: "right" }}>{progress}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== PROJECT (Figma-style) ===== */}
          {screen === "project" && activeProject && (
            <div className="screen-fade">
              {/* Back + Meta Bar */}
              <div className="project-meta-bar">
                <button onClick={() => setScreen("dashboard")} className="btn btn-ghost">← Dashboard</button>
                <span className="project-meta-badge" style={{ color: C.accent, borderColor: C.accent + "40", background: C.accent + "10" }}>{activeProject.code}</span>
                <span className="project-meta-badge" style={{ color: C.green, borderColor: C.green + "40", background: C.green + "10" }}>{activeProject.status === "active" ? "В работе" : "На проверке"}</span>
                {activeProject.department && <span style={{ fontSize: 12, color: C.textMuted }}>{activeProject.department}</span>}
                <div style={{ flex: 1 }}></div>
                
                {/* EXPORT BUTTON */}
                <button
                  onClick={() => exportProjectXls(activeProject, allTasks, drawings, reviews, getUserById, activeProjectProgress, addNotification)}
                  title="Экспорт задач в Excel"
                  className="btn btn-secondary"
                >
                  <span style={{ fontSize: 14 }}>⬇</span> Excel
                </button>

                {/* COPILOT BUTTON */}
                <button
                  onClick={() => setShowCopilot(!showCopilot)}
                  className={`btn ${showCopilot ? "btn-primary" : "btn-secondary"}`}
                >
                  <span style={{ fontSize: 14 }}>✨</span> AI Copilot
                </button>

                <div className="project-stats-bar">
                  <div className="project-stat">
                    <div className="project-stat-value" style={{ color: C.accent }}>{activeProjectProgress}%</div>
                    <div className="project-stat-label">прогресс</div>
                  </div>
                  <div className="project-stat">
                    <div className="project-stat-value" style={{ color: C.text }}>{tasks.filter(t => t.status === "done").length}/{tasks.length}</div>
                    <div className="project-stat-label">задач</div>
                  </div>
                  {activeProject.deadline && <div className="project-stat">
                    <div className="project-stat-value" style={{ color: C.text, fontSize: 14 }}>{activeProject.deadline}</div>
                    <div className="project-stat-label">дедлайн</div>
                  </div>}
                </div>
              </div>

              {/* PROJECT COPILOT DRAWER */}
              {showCopilot && (
                <CopilotPanel 
                  userId={currentUserData?.id} 
                  userRole={currentUserData?.role}
                  projectId={activeProject.id} 
                  C={C} 
                  onClose={() => setShowCopilot(false)} 
                  onTaskCreated={() => loadTasks(activeProject.id)}
                  onDataChanged={() => {
                    loadDrawings(activeProject.id);
                    loadRevisions(activeProject.id);
                    loadReviews(activeProject.id);
                    loadTransmittals(activeProject.id);
                  }}
                />
              )}

              {/* Project Name + Progress (not shown in meeting mode to maximize chat area) */}
              {sideTab !== "conference" && (
                <>
                  <div className="page-title" style={{ marginBottom: 16, fontSize: 28 }}>{activeProject.name}</div>
                  <div className="progress-track" style={{ height: 6, marginBottom: 24 }}><div className="progress-bar" style={{ width: `${activeProjectProgress}%`, height: "100%" }} /></div>
                </>
              )}

              {/* Tabs */}
              <div className="tab-strip" style={{ flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                {["conference","tasks","drawings","revisions","reviews","transmittals","assignments","gantt","timeline","meetings","timelog"].map(t => (
                  <button key={t} className={`tab-btn ${sideTab === t ? "active" : ""}`} onClick={() => setSideTab(t)} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {t === "tasks" ? "⊙ Задачи" : t === "drawings" ? "📐 Чертежи" : t === "revisions" ? "🧾 Ревизии" : t === "reviews" ? "📝 Замечания" : t === "transmittals" ? "📦 Трансмитталы" : t === "assignments" ? "✉ Увязка" : t === "gantt" ? "📊 Диаграмма" : t === "timeline" ? "🗺 Timeline" : t === "meetings" ? "🗒 Протоколы" : t === "timelog" ? "⏱ Табель" : "🗣 Совещание"}
                  </button>
                ))}
              </div>

              {sideTab === "tasks" && (
                <div>
                  {/* Task List Header */}
                  <div className="task-list-header">
                    <div className="task-list-title">Список задач</div>
                    {isGip && <button className="btn btn-primary" style={{ borderRadius: 20, padding: "10px 22px" }} onClick={() => setShowNewTask(true)}>+ Новая задача</button>}
                  </div>
                  <div className="task-list">
                    {tasks.length === 0 && <div className="empty-state" style={{ padding: 40 }}>Задач пока нет</div>}
                    {tasks.filter(t => {
                      if (!selectedDeptId || String(selectedDeptId) === "null") return true;
                      const selectedDeptName = getDeptName(Number(selectedDeptId));
                      const u = getUserById(t.assigned_to);
                      const currentDeptName = t.dept || (u ? getDeptName(u.dept_id) : "");
                      return currentDeptName === selectedDeptName;
                    }).map(t => {
                      const u = getUserById(t.assigned_to);
                      const deptName = t.dept || (u ? getDeptName(u.dept_id) : "");
                      const st = statusMap[t.status] || statusMap.todo;
                      return (
                        <div key={t.id} className="task-row" data-priority={t.priority} onClick={() => { setSelectedTask(t); setShowTaskDetail(true); loadMessages(activeProject.id, t.id); }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{t.name}</div>
                                <div title={`Ревизия ${t.revision_num || 0}`} style={{ background: C.accent + '15', color: C.accent, fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, cursor: 'help' }}>R{t.revision_num || 0}</div>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              {deptName && <span style={{ fontSize: 11, color: C.textMuted, background: C.surface2, padding: "3px 10px", borderRadius: 6, fontWeight: 500 }}>{deptName}</span>}
                              {t.drawing_id && (() => {
                                const d = drawings.find(dr => String(dr.id) === String(t.drawing_id));
                                return d ? <span style={{ fontSize: 11, color: C.textMuted }}>📐 {d.code}</span> : null;
                              })()}
                              {t.deadline && <span style={{ fontSize: 11, color: (() => { const dl = parseDeadline(t.deadline); return dl && dl < new Date() ? C.red : C.textMuted; })() }}>📅 {formatDateRu(t.deadline)}</span>}
                              <span style={{ fontSize: 11, color: t.priority === "high" ? C.red : t.priority === "medium" ? C.orange : C.green, fontWeight: 600 }}>● {t.priority === "high" ? "Высокий" : t.priority === "medium" ? "Средний" : "Низкий"}</span>
                            </div>
                          </div>
                          <span className="badge" style={{ color: st.color, background: st.bg, border: `1px solid ${st.color}25` }}>⊙ {st.label}</span>
                          {u && <AvatarComp user={u} size={34} C={C} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {sideTab === "drawings" && (
                <DrawingsPanel
                  C={C}
                  canEdit={isGip || isLead}
                  drawings={drawings}
                  onCreate={createProjectDrawing}
                  onUpdate={updateProjectDrawing}
                />
              )}

              {sideTab === "revisions" && (
                <RevisionsTab
                  C={C}
                  isLead={isLead}
                  isGip={isGip}
                  drawings={drawings}
                  revisions={revisions}
                  appUsers={appUsers}
                  issueDrawingRevision={issueDrawingRevision}
                />
              )}

              {sideTab === "reviews" && (
                <ReviewsTab
                  C={C}
                  isLead={isLead}
                  isGip={isGip}
                  newReview={newReview}
                  setNewReview={setNewReview}
                  drawings={drawings}
                  reviews={reviews}
                  appUsers={appUsers}
                  currentUser={currentUserData}
                  token={token!}
                  submitReview={submitReview}
                  changeReviewStatus={changeReviewStatus}
                />
              )}

              {sideTab === "transmittals" && (
                <TransmittalsTab
                  C={C}
                  isLead={isLead}
                  isGip={isGip}
                  transmittals={transmittals}
                  transmittalItems={transmittalItems}
                  drawings={drawings}
                  revisions={revisions}
                  transmittalDraftLinks={transmittalDraftLinks}
                  setTransmittalDraftLinks={setTransmittalDraftLinks}
                  createProjectTransmittal={createProjectTransmittal}
                  changeTransmittalStatus={changeTransmittalStatus}
                  addTransmittalItem={addTransmittalItem}
                  onExportPdf={(tr) => exportTransmittalPdf(tr, activeProject.name, transmittalItems[tr.id] || [], drawings, revisions)}
                />
              )}

              {sideTab === "assignments" && (
                <AssignmentsTab
                  C={C}
                  isLead={isLead}
                  isGip={isGip}
                  activeProject={activeProject}
                  currentUserData={currentUserData}
                  tasks={tasks}
                  setShowNewAssignment={setShowNewAssignment}
                  getDeptNameById={getDeptNameById}
                  getDeptName={getDeptName}
                  handleAssignmentResponse={handleAssignmentResponse}
                />
              )}

              {/* ── GANTT ── */}
              {sideTab === "gantt" && <GanttChart tasks={allTasks} activeProject={activeProject} getUserById={getUserById} getDeptName={getDeptName} C={C} />}
              {sideTab === "timeline" && (
                <div style={{ padding: 20 }}>
                  <div className="page-header" style={{ marginBottom: 16 }}><div><div className="page-label">D5</div><div className="page-title">Timeline проекта</div></div></div>
                  <ProjectTimeline tasks={allTasks} project={activeProject} C={C} />
                </div>
              )}

              {/* ── MEETINGS ── */}
              {sideTab === "meetings" && (
                <MeetingsPanel
                  projectId={activeProject.id}
                  projectName={activeProject.name}
                  isGip={isGip}
                  isLead={isLead}
                  C={C}
                  token={token!}
                  userId={currentUserData?.id}
                  appUsers={appUsers}
                  addNotification={addNotification}
                />
              )}

              {/* ── TIMELOG ── */}
              {sideTab === "timelog" && (
                <TimelogPanel 
                  projectId={activeProject.id} 
                  tasks={tasks} 
                  allTasks={allTasks} 
                  isGip={isGip} 
                  isLead={isLead} 
                  userId={currentUserData?.id} 
                  getUserById={getUserById} 
                  C={C} 
                  token={token!} 
                  addNotification={addNotification}
                />
              )}

              {sideTab === "conference" && (
                <ConferenceRoom
                  project={activeProject}
                  currentUser={currentUserData}
                  appUsers={appUsers}
                  msgs={msgs}
                  C={C}
                  token={token!}
                  onSendMsg={(text: string, type: string = "text") => sendMsg(undefined, type, text)}
                  getUserById={getUserById}
                  conferenceParticipants={conferenceParticipants}
                  onJoin={joinConference}
                  onLeave={leaveConference}
                  onPresenceUpdate={updatePresence}
                />
              )}
            </div>
          )}

          {/* ===== PROJECTS REGISTRY ===== */}
          {screen === "projects_list" && (
            <div className="screen-fade">
              <div className="page-header">
                <div>
                  <div className="page-label">Реестр проектов</div>
                  <div className="page-title">Все доступные проекты</div>
                </div>
                {isGip && <button className="btn btn-primary" onClick={() => setShowNewProject(true)}>+ Новый проект</button>}
              </div>

              <div className="search-wrap" style={{ marginBottom: 20 }}>
                <span className="search-icon">🔍</span>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по названию или шифру..."
                  className="search-input" style={getInp(C, { paddingLeft: 40, borderRadius: 10, background: C.surface })} />
                {searchQuery && <button className="search-clear" onClick={() => setSearchQuery("")}>✕</button>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {projects.filter(p => { if (!searchQuery) return true; const sq = searchQuery.toLowerCase(); return p.name.toLowerCase().includes(sq) || p.code.toLowerCase().includes(sq); }).map(p => {
                  const progress = getAutoProgress(p.id);
                  return (
                    <div key={p.id} className={`project-card ${activeProject?.id === p.id ? "active" : ""}`} onClick={() => { setActiveProject(p); setScreen("project"); setSideTab("tasks"); }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <span style={{ fontWeight: 600, fontSize: 15, color: C.text }}>{p.name}</span>
                          <span style={{ fontSize: 11, color: C.textMuted, background: C.surface2, padding: "3px 10px", borderRadius: 6 }}>{p.code}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: (() => { const dl = parseDeadline(p.deadline); return dl && dl < new Date() ? C.red : C.textMuted; })() }}>до {p.deadline}</span>
                          {isGip && <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); if (window.confirm(`Отправить "${p.name}" в архив?`)) archiveProject(p.id); }}>→ Архив</button>}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div className="progress-track" style={{ flex: 1 }}><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.accent, minWidth: 40, textAlign: "right" }}>{progress}%</span>
                      </div>
                    </div>
                  );
                })}
                {projects.length === 0 && <div className="empty-state" style={{ padding: 40 }}>Доступных проектов нет</div>}
              </div>
            </div>
          )}

          {/* ===== TASKS KANBAN ===== */}
          {screen === "tasks" && (
            <div className="screen-fade">
              <div className="page-header"><div><div className="page-label">Мои задачи</div><div className="page-title">Задачи по статусу</div></div></div>

              {/* Фильтры */}
              <div className="filters-bar">
                <div className="search-wrap" style={{ flex: "1 1 200px" }}>
                  <span className="search-icon">🔍</span>
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск задач..."
                    className="search-input" style={getInp(C, { paddingLeft: 40, fontSize: 12, borderRadius: 10, background: C.surface })} />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="filter-chip" style={{ border: `1.5px solid ${C.border}`, background: C.surface, color: C.textDim, fontFamily: "inherit", cursor: "pointer", minWidth: 140 }}>
                  <option value="all">⊕ Все статусы</option>
                  {Object.entries(statusMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="filter-chip" style={{ border: `1.5px solid ${C.border}`, background: C.surface, color: C.textDim, fontFamily: "inherit", cursor: "pointer", minWidth: 140 }}>
                  <option value="all">⊕ Приоритет</option>
                  <option value="high">🔴 Высокий</option><option value="medium">🟡 Средний</option><option value="low">⚪ Низкий</option>
                </select>
                {(isGip || isLead) && (
                  <select value={filterAssigned} onChange={e => setFilterAssigned(e.target.value)} className="filter-chip" style={{ border: `1.5px solid ${C.border}`, background: C.surface, color: C.textDim, fontFamily: "inherit", cursor: "pointer", minWidth: 150 }}>
                    <option value="all">⊕ Исполнитель</option>
                    {appUsers.filter(u => u.role === "engineer" || u.role === "lead").map(u => <option key={u.id} value={String(u.id)}>{u.full_name}</option>)}
                  </select>
                )}
                {(searchQuery || filterStatus !== "all" || filterPriority !== "all" || filterAssigned !== "all") && (
                  <button className="btn btn-danger btn-sm" onClick={() => { setSearchQuery(""); setFilterStatus("all"); setFilterPriority("all"); setFilterAssigned("all"); }}>✕ Сбросить</button>
                )}
              </div>

              <KanbanBoard
                tasks={tasks}
                statusMap={statusMap}
                projects={projects}
                getUserById={getUserById}
                formatDateRu={formatDateRu}
                onCardClick={(t: any) => { setSelectedTask(t); setShowTaskDetail(true); loadMessages(activeProject.id, t.id); }}
                onStatusChange={(taskId: number, newStatus: string) => updateTaskStatus(taskId, newStatus)}
                C={C}
                searchQuery={searchQuery}
                filterStatus={filterStatus}
                filterPriority={filterPriority}
                filterAssigned={filterAssigned}
              />
            </div>
          )}

          {/* ===== CALCULATIONS ===== */}
          {screen === "calculations" && (
            <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
              {/* LEFT SIDEBAR: Accordion Tree */}
              <div style={{ width: 300, minWidth: 300, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", background: C.surface, overflowY: "auto" }}>
                <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 10 }}>Каталог расчётов <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 400 }}>({calcTemplates.length})</span></div>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: C.textMuted, pointerEvents: "none" }}>🔍</span>
                    <input
                      placeholder="Найти расчёт..."
                      value={calcSearch}
                      onChange={e => setCalcSearch(e.target.value)}
                      style={{ width: "100%", padding: "8px 28px 8px 30px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    />
                    {calcSearch && <button onClick={() => setCalcSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 13 }}>✕</button>}
                  </div>
                </div>
                <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                  {calcSearch.trim() ? (
                    // Плоский список при поиске
                    (() => {
                      const q = calcSearch.toLowerCase();
                      const filtered = calcTemplates.filter(t => t.name.toLowerCase().includes(q) || t.cat.toLowerCase().includes(q) || (t.desc || "").toLowerCase().includes(q));
                      return filtered.length > 0 ? filtered.map(t => (
                        <button key={t.id} onClick={() => { setActiveCalc(t.id); setCalcSearch(""); }}
                          style={{ width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 13, color: activeCalc === t.id ? C.accent : C.textDim, background: activeCalc === t.id ? C.accent + "15" : "transparent", border: "none", borderRadius: 6, cursor: "pointer", display: "flex", flexDirection: "column", gap: 3 }}>
                          <span style={{ fontWeight: 500 }}>{t.name}</span>
                          <span style={{ fontSize: 10, color: C.textMuted, background: C.surface2, padding: "1px 6px", borderRadius: 4, width: "fit-content" }}>{calcCatLabels[t.cat] || t.cat}</span>
                        </button>
                      )) : <div style={{ fontSize: 13, color: C.textMuted, padding: "24px 12px", textAlign: "center" }}>Ничего не найдено</div>;
                    })()
                  ) : (
                    // Аккордеон по категориям
                    calcAllCats.map(cat => {
                      const catCalcs = calcTemplates.filter(t => t.cat === cat);
                      const isExpanded = calcFilter === cat;
                      return (
                        <div key={cat} style={{ background: isExpanded ? C.surface2 : "transparent", borderRadius: 8, overflow: "hidden" }}>
                          <button
                            style={{ width: "100%", textAlign: "left", padding: "9px 12px", fontSize: 13, fontWeight: 600, color: catCalcs.length > 0 ? C.text : C.textMuted, border: "none", background: "transparent", cursor: catCalcs.length > 0 ? "pointer" : "default", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                            onClick={() => catCalcs.length > 0 && setCalcFilter(isExpanded ? "" : cat)}
                          >
                            <span>{calcCatLabels[cat] || cat}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                              {catCalcs.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: isExpanded ? C.accent : C.textMuted, background: isExpanded ? C.accent + "20" : C.surface2, padding: "1px 7px", borderRadius: 8 }}>{catCalcs.length}</span>}
                              <span style={{ fontSize: 9, color: C.textMuted }}>{catCalcs.length > 0 ? (isExpanded ? "▼" : "▶") : "—"}</span>
                            </div>
                          </button>
                          {isExpanded && (
                            <div style={{ padding: "2px 6px 6px 6px", display: "flex", flexDirection: "column", gap: 1 }}>
                              {catCalcs.map(t => (
                                <button key={t.id} onClick={() => setActiveCalc(t.id)}
                                  style={{ width: "100%", textAlign: "left", padding: "7px 12px", fontSize: 12, color: activeCalc === t.id ? C.accent : C.textDim, background: activeCalc === t.id ? C.accent + "15" : "transparent", border: "none", borderRadius: 6, cursor: "pointer" }}>
                                  {t.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              
              {/* RIGHT MAIN VIEW */}
              <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                {activeCalc ? (
                  <CalculationView calcId={activeCalc} C={C} />
                ) : (
                  <div style={{ padding: 40, color: C.textDim, textAlign: "center", display: "flex", flexDirection: "column", gap: 12, justifyContent: "center", height: "100%", alignItems: "center" }}>
                    <div style={{ fontSize: 48, opacity: 0.5 }}>⎍</div>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>Выберите расчет из каталога слева</div>
                    <div style={{ fontSize: 13, maxWidth: 300, color: C.textMuted }}>Система автоматически подгрузит формулы, нормативную базу и конвертер для выбранной дисциплины.</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== NORMATIVE KB (Phase 7) ===== */}
          {screen === "normative" && (
            <div style={{ padding: 40, display: "flex", flexDirection: "column", gap: 24, height: '100%', overflow: 'auto' }}>
              {/* Duplicate conflict modal */}
              {showDupModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ background: C.surface, borderRadius: 16, padding: 32, width: 520, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 6 }}>Обнаружены дубликаты</div>
                    <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>Следующие документы уже существуют в базе. Выберите действие для каждого:</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                      <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => {
                        const all: Record<string, 'overwrite' | 'skip'> = {};
                        dupConflicts.forEach(c => { all[c.file.name] = 'skip'; });
                        setDupDecisions(all);
                      }}>Пропустить все</button>
                      <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => {
                        const all: Record<string, 'overwrite' | 'skip'> = {};
                        dupConflicts.forEach(c => { all[c.file.name] = 'overwrite'; });
                        setDupDecisions(all);
                      }}>Перезаписать все</button>
                    </div>
                    {dupConflicts.map(({ file }) => (
                      <div key={file.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ flex: 1, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => setDupDecisions(d => ({ ...d, [file.name]: 'skip' }))}
                            style={{ padding: '4px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, cursor: 'pointer', background: dupDecisions[file.name] === 'skip' ? C.accent : C.surface2, color: dupDecisions[file.name] === 'skip' ? '#fff' : C.text }}>
                            Пропустить
                          </button>
                          <button onClick={() => setDupDecisions(d => ({ ...d, [file.name]: 'overwrite' }))}
                            style={{ padding: '4px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, cursor: 'pointer', background: dupDecisions[file.name] === 'overwrite' ? '#EF4444' : C.surface2, color: dupDecisions[file.name] === 'overwrite' ? '#fff' : C.text }}>
                            Перезаписать
                          </button>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary" onClick={() => { setShowDupModal(false); setPendingFiles([]); }}>Отмена</button>
                      <button className="btn btn-primary" onClick={async () => {
                        setShowDupModal(false);
                        const conflictFiles = dupConflicts.map(c => c.file);
                        addNotification(`Обрабатываю ${conflictFiles.length} файлов...`, 'info');
                        await doUpload(conflictFiles, dupDecisions);
                        setPendingFiles([]);
                      }}>Продолжить</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="page-header">
                <div>
                  <div className="page-label">Нормативная база (RAG)</div>
                  <div className="page-title">Локальные регламенты и ГОСТы</div>
                </div>
                {(isGip || isAdmin) && (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <input type="file" id="normative-upload" multiple accept=".pdf,.docx,.doc,.txt" style={{ display: 'none' }} onChange={async (e) => {
                      const fileList = e.target.files;
                      if (!fileList || fileList.length === 0) return;
                      const files = Array.from(fileList);
                      e.target.value = '';
                      const conflicts = files.filter(f => normativeDocs.some(d => d.name === f.name));
                      const noConflict = files.filter(f => !normativeDocs.some(d => d.name === f.name));
                      if (conflicts.length > 0) {
                        setPendingFiles(files);
                        setDupConflicts(conflicts.map(f => ({ file: f, existing: normativeDocs.find(d => d.name === f.name)! })));
                        const defaults: Record<string, 'overwrite' | 'skip'> = {};
                        conflicts.forEach(f => { defaults[f.name] = 'skip'; });
                        setDupDecisions(defaults);
                        setShowDupModal(true);
                        if (noConflict.length > 0) {
                          addNotification(`Загружаю ${noConflict.length} новых файлов...`, 'info');
                          await doUpload(noConflict, {});
                        }
                      } else {
                        addNotification(`Начинаю загрузку (${files.length} шт.)...`, 'info');
                        await doUpload(files, {});
                      }
                    }} />
                    <button className="btn btn-primary" onClick={() => document.getElementById('normative-upload')?.click()}>+ Загрузить PDF/DOCX</button>
                    <button className="btn btn-secondary" onClick={async () => {
                      const pending = normativeDocs.filter(d => d.status === 'pending' || d.status === 'processing' || d.status === 'error');
                      if (pending.length === 0) { addNotification('Все документы уже проиндексированы', 'info'); return; }
                                            addNotification(`Запускаю индексацию для ${pending.length} документов...`, 'info');
                      const BATCH = 2; // Reduced batch size for better stability
                      let done = 0;
                      let errors = 0;
                      for (let i = 0; i < pending.length; i += BATCH) {
                        const batch = pending.slice(i, i + BATCH);
                        const results = await Promise.all(batch.map(async (doc) => {
                          try {
                            const res = await fetch(`${SURL}/functions/v1/vectorize-doc`, {
                              method: 'POST',
                              headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
                              body: JSON.stringify({ doc_id: doc.id }),
                            });
                            if (!res.ok) throw new Error(await res.text());
                            return { success: true };
                          } catch (err) {
                            console.error(`Error indexing ${doc.name}:`, err);
                            return { success: false };
                          }
                        }));
                        
                        done += results.filter(r => r.success).length;
                        errors += results.filter(r => !r.success).length;
                        
                        addNotification(`Обновление: ${done} готово, ${errors} ошибок. Всего: ${pending.length}`, errors > 0 ? 'warning' : 'info');
                        await loadNormativeDocs();
                      }
                      addNotification(`Обновление завершено. Успешно: ${done}, Ошибок: ${errors}`, errors > 0 ? 'warning' : 'success');
                    }}>🔄 Обновить поиск по документам</button>
                  </div>
                )}
              </div>

              {/* Search bar */}
              <div style={{ display: 'flex', gap: 12, background: C.surface2, padding: 10, borderRadius: 12 }}>
                <input
                  placeholder="Поиск по тексту документов..."
                  value={normSearchQuery}
                  onChange={e => { setNormSearchQuery(e.target.value); if (!e.target.value.trim()) setNormSearchResults(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') searchNormative(normSearchQuery); }}
                  style={{ ...getInp(C), flex: 1, height: 40, fontSize: 14 }}
                />
                {normSearchResults !== null && (
                  <button className="btn btn-secondary" style={{ height: 40, fontSize: 13 }} onClick={() => { setNormSearchQuery(''); setNormSearchResults(null); }}>✕ Сбросить</button>
                )}
                <button className="btn btn-primary" style={{ height: 40, width: 40, padding: 0 }} onClick={() => searchNormative(normSearchQuery)} disabled={normSearching}>
                  {normSearching ? '…' : '🔍'}
                </button>
              </div>

              {/* Search results */}
              {normSearchResults !== null ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
                    {normSearchResults.length === 0 ? 'Ничего не найдено' : `Найдено в ${normSearchResults.length} документах:`}
                  </div>
                  {normSearchResults.map((r, i) => {
                    // Smart excerpt: centre on first match in text
                    const rawContent = r.content || '';
                    const q = normSearchQuery.trim();
                    const qWords = q.split(/\s+/).filter(w => w.length > 2);
                    const lower = rawContent.toLowerCase();
                    let excerptStart = 0;
                    const phraseIdx = lower.indexOf(q.toLowerCase());
                    if (phraseIdx !== -1) excerptStart = Math.max(0, phraseIdx - 60);
                    else if (qWords.length > 0) {
                      const wi = lower.indexOf(qWords[0].toLowerCase());
                      if (wi !== -1) excerptStart = Math.max(0, wi - 60);
                    }
                    const excerptText = rawContent.slice(excerptStart, excerptStart + 320);

                    // Build highlighted segments (phrase=green, word=yellow)
                    const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const patterns: string[] = [];
                    if (q.includes(' ')) patterns.push(escRe(q));
                    patterns.push(...qWords.map(escRe));
                    const hiRegex = patterns.length > 0 ? new RegExp(`(${patterns.join('|')})`, 'gi') : null;
                    const segs = hiRegex ? excerptText.split(hiRegex) : [excerptText];
                    const highlighted = segs.map((seg, si) => {
                      const sl = seg.toLowerCase();
                      if (hiRegex && q.includes(' ') && sl === q.toLowerCase())
                        return <mark key={si} style={{ background: 'rgba(63,185,80,0.22)', color: '#3fb950', borderRadius: 3, padding: '1px 3px', fontWeight: 700, fontStyle: 'normal' }}>{seg}</mark>;
                      if (hiRegex && qWords.some(w => sl === w.toLowerCase()))
                        return <mark key={si} style={{ background: 'rgba(240,180,41,0.22)', color: '#f0b429', borderRadius: 3, padding: '1px 3px', fontWeight: 600, fontStyle: 'normal' }}>{seg}</mark>;
                      return <span key={si}>{seg}</span>;
                    });

                    const pct = r.similarity != null ? Math.round(r.similarity * 100) : null;
                    const pctColor = pct != null && pct >= 80 ? C.green : pct != null && pct >= 60 ? C.accent : C.textMuted;
                    return (
                      <div key={r.id} style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.surface : C.surface2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <span style={{ fontSize: 15 }}>{r.doc_name?.toLowerCase().endsWith('.pdf') ? '📕' : '📘'}</span>
                          <span style={{ fontWeight: 600, fontSize: 13, color: C.text, flex: 1 }}>{r.doc_name}</span>
                          {pct != null && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: pctColor, background: pctColor + '18', padding: '2px 10px', borderRadius: 10 }}>
                              {pct}% релев.
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: C.textMuted, fontFamily: 'monospace', lineHeight: 1.8 }}>
                          {excerptStart > 0 ? '...' : ''}{highlighted}{'...'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* All docs list — compact rows */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                  {normativeDocs.length === 0 ? (
                    <div style={{ padding: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                      <div style={{ fontSize: 40 }}>📚</div>
                      <div style={{ fontWeight: 700, color: C.text }}>База знаний пуста</div>
                      <div style={{ fontSize: 13, color: C.textMuted }}>Загрузите PDF, DOCX или TXT. ИИ-агент сможет искать по ним и давать ответы с источниками.</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 120px 100px 130px', gap: 0, padding: '8px 16px', background: C.surface2, borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <div></div><div>Документ</div><div>Дата</div><div>Тип</div><div>Статус</div>
                      </div>
                      {normativeDocs.map((doc, i) => (
                        <div key={doc.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 120px 100px 130px', gap: 0, padding: '10px 16px', alignItems: 'center', background: i % 2 === 0 ? C.surface : C.surface2, borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 16 }}>{doc.file_type?.includes('pdf') ? '📕' : '📘'}</div>
                          <div
                            style={{ fontSize: 13, color: C.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12, cursor: 'pointer', textDecoration: 'underline' }}
                            title={doc.name}
                            onClick={async () => {
                              if (!doc.file_path) { addNotification('Путь к файлу не найден', 'warning'); return; }
                              const isPdf = doc.file_type?.includes('pdf') || doc.name?.toLowerCase().endsWith('.pdf');
                              if (isPdf) {
                                // Получить подписанный URL для PDF и открыть в новой вкладке
                                const signRes = await fetch(`${SURL}/storage/v1/object/sign/normative-docs/${doc.file_path}`, {
                                  method: 'POST',
                                  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ expiresIn: 3600 }),
                                });
                                const signData = await signRes.json();
                                const signedUrl = signData?.signedURL ? `${SURL}/storage/v1${signData.signedURL}` : signData?.signedUrl;
                                if (signedUrl) window.open(signedUrl, '_blank');
                                else addNotification('Не удалось получить ссылку на файл', 'warning');
                              } else {
                                // DOCX/DOC — скачать через подписанный URL
                                const signRes = await fetch(`${SURL}/storage/v1/object/sign/normative-docs/${doc.file_path}`, {
                                  method: 'POST',
                                  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ expiresIn: 3600 }),
                                });
                                const signData = await signRes.json();
                                const signedUrl = signData?.signedURL ? `${SURL}/storage/v1${signData.signedURL}` : signData?.signedUrl;
                                if (signedUrl) {
                                  const a = document.createElement('a');
                                  a.href = signedUrl;
                                  a.download = doc.name;
                                  a.click();
                                } else addNotification('Не удалось получить ссылку на файл', 'warning');
                              }
                            }}
                          >{doc.name}</div>
                          <div style={{ fontSize: 12, color: C.textMuted }}>{new Date(doc.created_at).toLocaleDateString('ru-RU')}</div>
                          <div style={{ fontSize: 11, color: C.textMuted }}>{doc.file_type?.includes('pdf') ? 'PDF' : doc.file_type?.includes('word') ? 'DOCX' : 'DOC'}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: C.textMuted }}>
                              {doc.status === 'ready' ? '✅ Готов' : doc.status === 'processing' ? '⚙️ Обрабатывается...' : doc.status === 'error' ? '❌ Не удалось обработать' : '🕐 В очереди'}
                            </span>
                            {(isGip || isAdmin) && (
                              <button style={{ marginLeft: 'auto', fontSize: 11, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                                onClick={() => {
                                  if (!window.confirm(`Удалить документ "${doc.name}"?`)) return;
                                  if (!window.confirm('Подтвердите ещё раз: документ и все его данные будут удалены безвозвратно.')) return;
                                  del(`normative_docs?id=eq.${doc.id}`, token!).then(loadNormativeDocs);
                                }}>✕</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
      <ToastContainer notifications={notifications} onRemove={removeNotification} />

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="mobile-nav">
        {navItems.map(n => (
          <button key={n.id} className={`mobile-nav-btn ${screen === n.id || (screen === 'project' && n.id === 'projects_list') ? 'active' : ''}`} onClick={() => setScreen(n.id)}>
            <span className="mnav-icon">{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
