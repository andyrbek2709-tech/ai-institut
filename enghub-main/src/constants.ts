// ===== ЦВЕТОВАЯ СХЕМА — STITCH-ALIGNED TOKENS =====

// Тёмная тема (сайдбар всегда тёмный, контент тёмный)
export const DARK = {
  // Сайдбар
  sidebarBg: "#0f1720",
  sidebarText: "#93a1b6",
  sidebarActive: "#2b5bb5",
  sidebarActiveBg: "rgba(43,91,181,0.2)",
  sidebarHover: "rgba(255,255,255,0.06)",
  // Контент
  bg: "#0c0f10",
  surface: "#141a1e",
  surface2: "#1b2429",
  border: "#2a343a",
  // Текст
  text: "#e3eaee",
  textDim: "#b8c4cc",
  textMuted: "#8e9aa3",
  // Акценты
  accent: "#2b5bb5",
  green: "#2f9e62",
  red: "#ef4444",
  blue: "#4f7fd8",
  purple: "#a855f7",
  orange: "#d08a38",
  // Карточки
  cardBg: "#141a1e",
  topbarBg: "#141a1e",
  navBg: "#0f1720",
};

// Светлая тема (сайдбар тёмный, контент белый)
export const LIGHT = {
  // Сайдбар
  sidebarBg: "#121a23",
  sidebarText: "#8fa0b1",
  sidebarActive: "#2b5bb5",
  sidebarActiveBg: "rgba(43,91,181,0.2)",
  sidebarHover: "rgba(255,255,255,0.06)",
  // Контент
  bg: "#f8f9fa",
  surface: "#ffffff",
  surface2: "#eef2f5",
  border: "#dbe4e7",
  // Текст
  text: "#2b3437",
  textDim: "#49585f",
  textMuted: "#748188",
  // Акценты
  accent: "#2b5bb5",
  green: "#2f9e62",
  red: "#ef4444",
  blue: "#4f7fd8",
  purple: "#a855f7",
  orange: "#d08a38",
  // Карточки
  cardBg: "#ffffff",
  topbarBg: "#ffffff",
  navBg: "#121a23",
};

// Статусы задач
export const statusMap: Record<string, { label: string; color: string; bg: string }> = {
  todo: { label: "Ожидает", color: "#8896a8", bg: "#8896a815" },
  inprogress: { label: "В работе", color: "#4a9eff", bg: "#4a9eff15" },
  review_lead: { label: "Проверка рук.", color: "#a855f7", bg: "#a855f715" },
  review_gip: { label: "Проверка ГИП", color: "#f5a623", bg: "#f5a62315" },
  revision: { label: "Доработка", color: "#ef4444", bg: "#ef444415" },
  done: { label: "Завершена", color: "#2ac769", bg: "#2ac76915" },
};

// Роли
export const roleLabels: Record<string, string> = {
  gip: "Главный инженер проекта",
  lead: "Руководитель отдела",
  engineer: "Инженер",
};

// Иконки навигации (Lucide-style unicode)
export const navIcons: Record<string, string> = {
  dashboard: "⬡",
  project: "◈",
  tasks: "≡",
  team: "◎",
};

// Статусы чертежей
export const drawingStatusMap: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Черновик", color: "#8896a8", bg: "#8896a815" },
  in_work: { label: "В работе", color: "#4a9eff", bg: "#4a9eff15" },
  review: { label: "На проверке", color: "#a855f7", bg: "#a855f715" },
  approved: { label: "Утвержден", color: "#2ac769", bg: "#2ac76915" },
  issued: { label: "Выдан", color: "#f5a623", bg: "#f5a62315" },
};

// Допустимые переходы workflow задач
export const taskWorkflowTransitions: Record<string, string[]> = {
  todo: ["inprogress"],
  inprogress: ["review_lead"],
  review_lead: ["review_gip", "revision"],
  review_gip: ["done", "revision"],
  revision: ["inprogress"],
  done: ["revision"],
};

// Ролевые системные инструкции для Copilot (Phase 8)
export const copilotRolePrompts: Record<string, string> = {
  gip: "Приоритизируй сроки, междисциплинарные коллизии и контроль выдачи документации.",
  lead: "Фокусируйся на загрузке инженеров, качестве проверок и возвратах на доработку.",
  engineer: "Фокусируйся на конкретных шагах выполнения, входных данных и критериях готовности.",
};

// Статусы трансмитталов (B10 fix: локализация в тостах)
export const transmittalStatusMap: Record<string, string> = {
  draft: 'Черновик',
  issued: 'Выпущен',
  cancelled: 'Отменён',
};
