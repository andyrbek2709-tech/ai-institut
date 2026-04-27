// ===== ЦВЕТОВАЯ СХЕМА — АДАПТАЦИЯ ПОД НОВЫЙ ДИЗАЙН =====

// Тёмная тема (сайдбар всегда тёмный, контент тёмный)
export const DARK = {
  // Сайдбар
  sidebarBg: "#1a1f2e",
  sidebarText: "#8892a4",
  sidebarActive: "#f5a623",
  sidebarActiveBg: "rgba(245,166,35,0.15)",
  sidebarHover: "rgba(255,255,255,0.06)",
  // Контент
  bg: "#121621",
  surface: "#1e2235",
  surface2: "#262b3e",
  border: "#2d3348",
  // Текст
  text: "#e8ecf4",
  textDim: "#b0b8cc",
  textMuted: "#6b7590",
  // Акценты
  accent: "#f5a623",
  green: "#2ac769",
  red: "#ef4444",
  blue: "#4a9eff",
  purple: "#a855f7",
  orange: "#ff8c42",
  // Карточки
  cardBg: "#1e2235",
  topbarBg: "#1a1f2e",
  navBg: "#1a1f2e",
};

// Светлая тема (сайдбар тёмный, контент белый)
export const LIGHT = {
  // Сайдбар
  sidebarBg: "#1a1f2e",
  sidebarText: "#8892a4",
  sidebarActive: "#f5a623",
  sidebarActiveBg: "rgba(245,166,35,0.15)",
  sidebarHover: "rgba(255,255,255,0.06)",
  // Контент
  bg: "#f5f6fa",
  surface: "#ffffff",
  surface2: "#f0f1f5",
  border: "#e5e7ee",
  // Текст
  text: "#1a202c",
  textDim: "#4a5568",
  textMuted: "#8896a8",
  // Акценты
  accent: "#f5a623",
  green: "#2ac769",
  red: "#ef4444",
  blue: "#4a9eff",
  purple: "#a855f7",
  orange: "#ff8c42",
  // Карточки
  cardBg: "#ffffff",
  topbarBg: "#ffffff",
  navBg: "#1a1f2e",
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
