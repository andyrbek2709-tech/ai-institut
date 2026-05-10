import React, { useState, useEffect, useRef } from 'react';
import { DARK, LIGHT, statusMap, roleLabels, taskWorkflowTransitions, transmittalStatusMap } from './constants';
import { NavIcon, IconFolder, IconCheckSquare, IconActivity, IconArchive } from './components/icons';
import { get, post, patch, del, SURL, AuthError, listDrawings, createDrawing, updateDrawing, listReviews, createReview, createRevisionRecord, createTransmittal, listProjectTasks, createProjectTask, updateTaskDrawingLink, listRevisions, updateReviewStatus, updateTransmittalStatus, listTransmittalItems, createTransmittalItem, createNotification, listTaskHistory, listTaskAttachmentsByTaskIds } from './api/supabase';
import { apiPost, apiGet } from './api/http';
import { publishTaskCreated, publishTaskSubmittedForReview, publishTaskApproved, publishTaskReturned, publishReviewCommentAdded } from './lib/events/publisher';
import { getSupabaseAnonClient } from './api/supabaseClient';
import { ThemeToggle, Modal, Field, AvatarComp, BadgeComp, PriorityDot, getInp, RuDateInput, useCountUp } from './components/ui';
import { LoginPage } from './pages/LoginPage';
import { AdminPanel } from './pages/AdminPanel';
import { useNotifications, ToastContainer } from './components/Notifications';
import { CalculationView } from './calculations/CalculationView';
import { calcRegistry } from './calculations/registry';

// #05 design diff: animated KPI numbers via useCountUp
const StatNumber: React.FC<{ value: number; color: string }> = ({ value, color }) => {
  const v = useCountUp(value);
  // Wrapped in big-number container by parent; this just renders the animated value
  return <span style={{ color }}>{v}</span>;
};

// ConferenceRoom legacy Ð¸Ð¼Ð¿Ð¾ÑÑ ÑÐ´Ð°Ð»ÑÐ½ 2026-04-27 â Ð·Ð°Ð¼ÐµÐ½ÐµÐ½Ð¾ Ð½Ð° MeetingRoomPage.
// Ð¡ÑÐ°ÑÐ°Ñ ÑÐµÐ°Ð»Ð¸Ð·Ð°ÑÐ¸Ñ Ð»ÐµÐ¶Ð¸Ñ ÑÑÐ´Ð¾Ð¼ ÐºÐ°Ðº ConferenceRoom.legacy.tsx (DEPRECATED).
import MeetingRoomPage from './components/meeting/MeetingRoomPage';
import { CopilotPanel } from './components/CopilotPanel';
import { DrawingsPanel } from './components/DrawingsPanel';
import { RevisionsTab } from './components/RevisionsTab';
import { ReviewsTab } from './components/ReviewsTab';
import { TransmittalsTab } from './components/TransmittalsTab';
import { AssignmentsTab } from './components/AssignmentsTab';
import { AssignmentTab } from './components/AssignmentTab';
import { SpecificationsTab } from './components/SpecificationsTab';
import { DocumentsPanel } from './components/DocumentsPanel';
import { TaskAttachments } from './components/TaskAttachments';
import GanttChart from './components/GanttChart';
import MeetingsPanel from './components/MeetingsPanel';
import TimelogPanel from './components/TimelogPanel';
import { exportProjectXls, exportTransmittalPdf } from './utils/export';
import { GlobalSearch } from './components/GlobalSearch';
import { KanbanBoard } from './components/KanbanBoard';
import { ProjectTimeline } from './components/ProjectTimeline';
import { NotificationCenter } from './components/NotificationCenter';
import ActivityFeed from './components/ActivityFeed';
import LeadDashboard from './components/LeadDashboard';
import EngineerDashboard from './components/EngineerDashboard';
import { TaskTemplates } from './components/TaskTemplates';
import { ProjectReportPDF } from './components/ProjectReportPDF';
import { GipDashboard } from './components/GipDashboard';
import { BIMPanel } from './components/BIMPanel';
import StandardsSearch from './components/StandardsSearch';

const TAB_HELP: Record<string, { title: string; sections: { heading: string; text: string }[] }> = {
  conference: {
    title: "ð£ Ð¡Ð¾Ð²ÐµÑÐ°Ð½Ð¸Ðµ",
    sections: [
      { heading: "Ð§ÑÐ¾ ÑÑÐ¾", text: "ÐÐ¾Ð»Ð¾ÑÐ¾Ð²ÑÐµ ÑÐ¾Ð²ÐµÑÐ°Ð½Ð¸Ñ Ð² ÑÐµÐ°Ð»ÑÐ½Ð¾Ð¼ Ð²ÑÐµÐ¼ÐµÐ½Ð¸ Ð¿ÑÑÐ¼Ð¾ Ð²Ð½ÑÑÑÐ¸ Ð¿ÑÐ¾ÐµÐºÑÐ°. ÐÑÐµ ÑÑÐ°ÑÑÐ½Ð¸ÐºÐ¸ Ð²Ð¸Ð´ÑÑ ÑÐ°Ñ Ð¸ Ð¸ÑÑÐ¾ÑÐ¸Ñ Ð¿ÐµÑÐµÐ³Ð¾Ð²Ð¾ÑÐ¾Ð²." },
      { heading: "ÐÐ°Ðº Ð²Ð¾Ð¹ÑÐ¸", text: "ÐÐ°Ð¶Ð¼Ð¸ÑÐµ Â«ÐÐ¾Ð¹ÑÐ¸ Ð² ÑÐ¾Ð²ÐµÑÐ°Ð½Ð¸ÐµÂ». ÐÐ¾Ð¶Ð½Ð¾ Ð²ÐºÐ»ÑÑÐ¸ÑÑ Ð¼Ð¸ÐºÑÐ¾ÑÐ¾Ð½ (ð) Ð¸ Ð´ÐµÐ¼Ð¾Ð½ÑÑÑÐ°ÑÐ¸Ñ ÑÐºÑÐ°Ð½Ð° (ð¥)." },
      { heading: "ÐÑÐ¸Ð³Ð»Ð°ÑÐ¸ÑÑ ÑÑÐ°ÑÑÐ½Ð¸ÐºÐ¾Ð²", text: "ÐÐ°Ð¶Ð¼Ð¸ÑÐµ ÐºÐ½Ð¾Ð¿ÐºÑ Â«ÐÑÐ¸Ð³Ð»Ð°ÑÐ¸ÑÑÂ» â Ð²ÑÐ±ÐµÑÐ¸ÑÐµ ÑÐ¾ÑÑÑÐ´Ð½Ð¸ÐºÐ¾Ð² Ð¸Ð· ÑÐ¿Ð¸ÑÐºÐ° â Ð½Ð°Ð¶Ð¼Ð¸ÑÐµ Â«ÐÑÐ¿ÑÐ°Ð²Ð¸ÑÑÂ». Ð£ Ð½Ð¸Ñ Ð¿Ð¾ÑÐ²Ð¸ÑÑÑ Ð²ÑÐ¿Ð»ÑÐ²Ð°ÑÑÐµÐµ ÑÐ²ÐµÐ´Ð¾Ð¼Ð»ÐµÐ½Ð¸Ðµ." },
      { heading: "ÐÑÑÐ¾Ð´", text: "ÐÐ½Ð¾Ð¿ÐºÐ° Â«ÐÐ¾ÐºÐ¸Ð½ÑÑÑÂ» Ð·Ð°Ð²ÐµÑÑÐ°ÐµÑ Ð²Ð°ÑÐµ ÑÑÐ°ÑÑÐ¸Ðµ. Ð§Ð°Ñ Ð¸ Ð¸ÑÑÐ¾ÑÐ¸Ñ ÑÐ¾Ð²ÐµÑÐ°Ð½Ð¸Ñ ÑÐ¾ÑÑÐ°Ð½ÑÑÑÑÑ." },
    ],
  },
  tasks: {
    title: "â ÐÐ°Ð´Ð°ÑÐ¸",
    sections: [
      { heading: "Ð§ÑÐ¾ ÑÑÐ¾", text: "Ð¡Ð¿Ð¸ÑÐ¾Ðº Ð²ÑÐµÑ Ð·Ð°Ð´Ð°Ñ Ð¿Ð¾ Ð¿ÑÐ¾ÐµÐºÑÑ Ñ Ð½Ð°Ð·Ð½Ð°ÑÐµÐ½Ð¸ÐµÐ¼ Ð¾ÑÐ²ÐµÑÑÑÐ²ÐµÐ½Ð½ÑÑ, ÑÑÐ¾ÐºÐ°Ð¼Ð¸ Ð¸ Ð¿ÑÐ¸Ð¾ÑÐ¸ÑÐµÑÐ°Ð¼Ð¸." },
      { heading: "Ð¡Ð¾Ð·Ð´Ð°Ð½Ð¸Ðµ Ð·Ð°Ð´Ð°ÑÐ¸", text: "ÐÐÐ Ð½Ð°Ð¶Ð¸Ð¼Ð°ÐµÑ Â«+ ÐÐ¾Ð²Ð°Ñ Ð·Ð°Ð´Ð°ÑÐ°Â», Ð·Ð°Ð¿Ð¾Ð»Ð½ÑÐµÑ Ð½Ð°Ð·Ð²Ð°Ð½Ð¸Ðµ, Ð¾ÑÐ´ÐµÐ», Ð¸ÑÐ¿Ð¾Ð»Ð½Ð¸ÑÐµÐ»Ñ, ÑÑÐ¾Ðº Ð¸ Ð¿ÑÐ¸Ð¾ÑÐ¸ÑÐµÑ." },
      { heading: "ÐÐ¸Ð·Ð½ÐµÐ½Ð½ÑÐ¹ ÑÐ¸ÐºÐ»", text: "ÐÐ°Ð´Ð°ÑÐ° Ð¿ÑÐ¾ÑÐ¾Ð´Ð¸Ñ ÑÑÐ°Ð´Ð¸Ð¸: ÐÐ¶Ð¸Ð´Ð°ÐµÑ â Ð ÑÐ°Ð±Ð¾ÑÐµ â ÐÐ° Ð¿ÑÐ¾Ð²ÐµÑÐºÐµ ÑÑÐºÐ¾Ð²Ð¾Ð´Ð¸ÑÐµÐ»Ñ â ÐÐ° Ð¿ÑÐ¾Ð²ÐµÑÐºÐµ ÐÐÐÐ° â ÐÐ°Ð²ÐµÑÑÐµÐ½Ð°. ÐÐ°Ð¶Ð´ÑÐ¹ ÑÑÐ°ÑÑÐ½Ð¸Ðº Ð¿ÐµÑÐµÐ²Ð¾Ð´Ð¸Ñ Ð·Ð°Ð´Ð°ÑÑ Ð² ÑÐ»ÐµÐ´ÑÑÑÐ¸Ð¹ ÑÑÐ°ÑÑÑ ÐºÐ½Ð¾Ð¿ÐºÐ¾Ð¹ Ð² ÐºÐ°ÑÑÐ¾ÑÐºÐµ." },
      { heading: "Ð¤Ð¸Ð»ÑÑÑÑ", text: "ÐÐ°Ð´Ð°ÑÐ¸ Ð¼Ð¾Ð¶Ð½Ð¾ ÑÐ¸Ð»ÑÑÑÐ¾Ð²Ð°ÑÑ Ð¿Ð¾ Ð¾ÑÐ´ÐµÐ»Ñ ÑÐµÑÐµÐ· Ð²ÑÐ¿Ð°Ð´Ð°ÑÑÐ¸Ð¹ ÑÐ¿Ð¸ÑÐ¾Ðº Ð½Ð°Ð´ ÑÐ¿Ð¸ÑÐºÐ¾Ð¼ Ð·Ð°Ð´Ð°Ñ." },
    ],
  },
  documents: {
    title: "ð ÐÐ¾ÐºÑÐ¼ÐµÐ½ÑÑ",
    sections: [
      { heading: "Ð§ÑÐ¾ ÑÑÐ¾", text: "ÐÑÐµ ÑÐ°Ð¹Ð»Ñ Ð¿ÑÐ¾ÐµÐºÑÐ°: Ð¢Ð, Ð´Ð¾Ð¿Ð¾Ð»Ð½ÐµÐ½Ð¸Ñ, Ð¿ÑÐ¾ÑÐ¸Ðµ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÑ. ÐÐ¾ÑÑÑÐ¿Ð½Ñ ÑÑÐ°ÑÑÐ½Ð¸ÐºÐ°Ð¼ Ð¿ÑÐ¾ÐµÐºÑÐ°." },
      { heading: "ÐÐ°Ð³ÑÑÐ·ÐºÐ°", text: "ÐÐ½Ð¾Ð¿ÐºÐ° Â«+ ÐÐ°Ð³ÑÑÐ·Ð¸ÑÑ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÂ» â Ð²ÑÐ±ÐµÑÐ¸ÑÐµ ÑÐ¸Ð¿ (Ð¢Ð / ÐÐ¾Ð¿Ð¾Ð»Ð½ÐµÐ½Ð¸Ðµ / ÐÑÐ¾ÑÐµÐµ) Ð¸ ÑÐ°Ð¹Ð». ÐÐ¾Ð´Ð´ÐµÑÐ¶Ð¸Ð²Ð°ÑÑÑÑ PDF, Word (doc/docx), Excel (xls/xlsx). ÐÐ°ÐºÑ ÑÐ°Ð·Ð¼ÐµÑ â 50 ÐÐ." },
      { heading: "ÐÑÐ¾ÑÐ¼Ð¾ÑÑ", text: "ÐÐ²Ð¾Ð¹Ð½Ð¾Ð¹ ÐºÐ»Ð¸Ðº Ð¸Ð»Ð¸ ÐºÐ½Ð¾Ð¿ÐºÐ° Â«ÐÑÐºÑÑÑÑÂ» Ð½Ð° PDF/Word/Excel â Ð²ÑÑÑÐ¾ÐµÐ½Ð½ÑÐ¹ preview. ÐÐ° DWG/Ð¿ÑÐ¾ÑÐ¸Ñ â ÑÐºÐ°ÑÐ¸Ð²Ð°Ð½Ð¸Ðµ." },
      { heading: "ÐÐ·Ð¾Ð»ÑÑÐ¸Ñ", text: "Ð¤Ð°Ð¹Ð»Ñ Ð²Ð¸Ð´Ð½Ñ ÑÐ¾Ð»ÑÐºÐ¾ ÑÑÐ°ÑÑÐ½Ð¸ÐºÐ°Ð¼ Ð¿ÑÐ¾ÐµÐºÑÐ°. ÐÐÐ Ð¸ Ð°Ð²ÑÐ¾Ñ ÑÐ°Ð¹Ð»Ð° Ð¼Ð¾Ð³ÑÑ ÑÐ´Ð°Ð»Ð¸ÑÑ, Ð¾ÑÑÐ°Ð»ÑÐ½ÑÐµ â ÑÐ¾Ð»ÑÐºÐ¾ Ð¿ÑÐ¾ÑÐ¼Ð°ÑÑÐ¸Ð²Ð°ÑÑ." },
    ],
  },
  drawings: {
    title: "ð Ð§ÐµÑÑÐµÐ¶Ð¸",
    sections: [
      { heading: "Ð§ÑÐ¾ ÑÑÐ¾", text: "Ð ÐµÐµÑÑÑ Ð²ÑÐµÑ ÑÐµÑÑÐµÐ¶ÐµÐ¹ Ð¸ ÑÐµÑÐ½Ð¸ÑÐµÑÐºÐ¸Ñ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ¾Ð² Ð¿ÑÐ¾ÐµÐºÑÐ°." },
      { heading: "ÐÐ°Ð³ÑÑÐ·ÐºÐ°", text: "ÐÐ½Ð¾Ð¿ÐºÐ° Â«+ ÐÐ¾Ð±Ð°Ð²Ð¸ÑÑÂ» Ð¸Ð»Ð¸ Ð¿ÐµÑÐµÑÐ°ÑÐ¸ÑÐµ ÑÐ°Ð¹Ð» (PDF, DWG). Ð£ÐºÐ°Ð¶Ð¸ÑÐµ Ð½Ð¾Ð¼ÐµÑ, Ð½Ð°Ð·Ð²Ð°Ð½Ð¸Ðµ Ð¸ Ð¼Ð°ÑÐºÑ." },
      { heading: "ÐÐµÑÑÐ¸Ð¸", text: "ÐÐ° ÐºÐ°Ð¶Ð´ÑÐ¹ ÑÐµÑÑÑÐ¶ Ð¼Ð¾Ð¶Ð½Ð¾ Ð²ÑÐ¿ÑÑÑÐ¸ÑÑ Ð½Ð¾Ð²ÑÑ ÑÐµÐ²Ð¸Ð·Ð¸Ñ ÑÐµÑÐµÐ· Ð²ÐºÐ»Ð°Ð´ÐºÑ Â«Ð ÐµÐ²Ð¸Ð·Ð¸Ð¸Â» â ÑÑÐ°ÑÑÐµ Ð²ÐµÑÑÐ¸Ð¸ ÑÐ¾ÑÑÐ°Ð½ÑÑÑÑÑ." },
      { heading: "ÐÑÐ¾ÑÐ¼Ð¾ÑÑ", text: "ÐÐ°Ð¶Ð¼Ð¸ÑÐµ Ð½Ð° ÑÐµÑÑÑÐ¶ â Ð¾ÑÐºÑÐ¾ÐµÑÑÑ Ð²ÑÑÑÐ¾ÐµÐ½Ð½ÑÐ¹ Ð¿ÑÐ¾ÑÐ¼Ð¾ÑÑÑÐ¸Ðº. ÐÐ»Ñ PDF ÑÐ°Ð±Ð¾ÑÐ°ÐµÑ Ð¿ÑÑÐ¼Ð¾ Ð² Ð±ÑÐ°ÑÐ·ÐµÑÐµ." },
    ],
  },
  revisions: {
    title: "ð§¾ Ð ÐµÐ²Ð¸Ð·Ð¸Ð¸",
    sections: [
      { heading: "Ð§ÑÐ¾ ÑÑÐ¾", text: "ÐÑÑÐ¾ÑÐ¸Ñ Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ð¹ ÑÐµÑÑÐµÐ¶ÐµÐ¹. ÐÐ°Ð¶Ð´Ð°Ñ ÑÐµÐ²Ð¸Ð·Ð¸Ñ â ÑÑÐ¾ Ð½Ð¾Ð²Ð°Ñ Ð²ÐµÑÑÐ¸Ñ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ° Ñ Ð´Ð°ÑÐ¾Ð¹, Ð°Ð²ÑÐ¾ÑÐ¾Ð¼ Ð¸ ÑÑÐ°ÑÑÑÐ¾Ð¼." },
      { heading: "Ð¡Ð¾Ð·Ð´Ð°Ð½Ð¸Ðµ ÑÐµÐ²Ð¸Ð·Ð¸Ð¸", text: "ÐÑÐºÑÐ¾Ð¹ÑÐµ ÑÐµÑÑÑÐ¶ â Ð½Ð°Ð¶Ð¼Ð¸ÑÐµ Â«Ð¡Ð¾Ð·Ð´Ð°ÑÑ ÑÐµÐ²Ð¸Ð·Ð¸ÑÂ» â Ð·Ð°Ð³ÑÑÐ·Ð¸ÑÐµ Ð½Ð¾Ð²ÑÐ¹ ÑÐ°Ð¹Ð» Ð¸ ÑÐºÐ°Ð¶Ð¸ÑÐµ Ð¾Ð¿Ð¸ÑÐ°Ð½Ð¸Ðµ Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ð¹." },
      { heading: "Ð¡ÑÐ°ÑÑÑÑ", text: "Ð ÐµÐ²Ð¸Ð·Ð¸Ñ Ð¿ÑÐ¾ÑÐ¾Ð´Ð¸Ñ: Ð§ÐµÑÐ½Ð¾Ð²Ð¸Ðº â ÐÐ° Ð¿ÑÐ¾Ð²ÐµÑÐºÐµ â Ð£ÑÐ²ÐµÑÐ¶Ð´ÐµÐ½Ð° / ÐÑÐºÐ»Ð¾Ð½ÐµÐ½Ð°." },
      { heading: "ÐÐºÑÑÐ°Ð»ÑÐ½Ð°Ñ Ð²ÐµÑÑÐ¸Ñ", text: "Ð ÑÐµÐµÑÑÑÐµ ÑÐµÑÑÐµÐ¶ÐµÐ¹ Ð²ÑÐµÐ³Ð´Ð° Ð¿Ð¾ÐºÐ°Ð·ÑÐ²Ð°ÐµÑÑÑ Ð¿Ð¾ÑÐ»ÐµÐ´Ð½ÑÑ Ð°ÐºÑÑÐ°Ð»ÑÐ½Ð°Ñ ÑÐµÐ²Ð¸Ð·Ð¸Ñ." },
    ],
  },
  reviews: {
    title: "ð ÐÐ°Ð¼ÐµÑÐ°Ð½Ð¸Ñ",
    sections: [
      { heading: "Ð§ÑÐ¾ ÑÑÐ¾", text: "ÐÑÑÐ½Ð°Ð» Ð·Ð°Ð¼ÐµÑÐ°Ð½Ð¸Ð¹ Ðº Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°ÑÐ¸Ð¸ â Ð¾Ñ Ð¿ÑÐ¾Ð²ÐµÑÑÑÑÐ¸Ñ, ÐÐÐÐ° Ð¸Ð»Ð¸ Ð·Ð°ÐºÐ°Ð·ÑÐ¸ÐºÐ°." },
      { heading: "Ð¡Ð¾Ð·Ð´Ð°Ð½Ð¸Ðµ", text: "ÐÐ°Ð¶Ð¼Ð¸ÑÐµ Â«+ ÐÐ°Ð¼ÐµÑÐ°Ð½Ð¸ÐµÂ», ÑÐºÐ°Ð¶Ð¸ÑÐµ ÑÐµÑÑÑÐ¶, ÑÐµÐºÑÑ Ð·Ð°Ð¼ÐµÑÐ°Ð½Ð¸Ñ Ð¸ Ð¾ÑÐ²ÐµÑÑÑÐ²ÐµÐ½Ð½Ð¾Ð³Ð¾ Ð·Ð° ÑÑÑÑÐ°Ð½ÐµÐ½Ð¸Ðµ." },
      { heading: "Ð£ÑÑÑÐ°Ð½ÐµÐ½Ð¸Ðµ", text: "ÐÑÐ¿Ð¾Ð»Ð½Ð¸ÑÐµÐ»Ñ ÑÑÑÑÐ°Ð½ÑÐµÑ Ð·Ð°Ð¼ÐµÑÐ°Ð½Ð¸Ðµ Ð¸ Ð¼ÐµÐ½ÑÐµÑ ÑÑÐ°ÑÑÑ Ð½Ð° Â«Ð£ÑÑÑÐ°Ð½ÐµÐ½Ð¾Â». ÐÐ²ÑÐ¾Ñ Ð·Ð°Ð¼ÐµÑÐ°Ð½Ð¸Ñ Ð¿Ð¾Ð´ÑÐ²ÐµÑÐ¶Ð´Ð°ÐµÑ." },
      { heading: "ÐÑÑÐ»ÐµÐ¶Ð¸Ð²Ð°Ð½Ð¸Ðµ", text: "Ð¡Ð¿Ð¸ÑÐ¾Ðº Ð¿Ð¾ÐºÐ°Ð·ÑÐ²Ð°ÐµÑ Ð¾ÑÐºÑÑÑÑÐµ Ð¸ Ð·Ð°ÐºÑÑÑÑÐµ Ð·Ð°Ð¼ÐµÑÐ°Ð½Ð¸Ñ. Ð¤Ð¸Ð»ÑÑÑÑÐ¹ÑÐµ Ð¿Ð¾ ÑÐµÑÑÐµÐ¶Ñ Ð¸Ð»Ð¸ ÑÑÐ°ÑÑÑÑ." },
    ],
  },
  transmittals: {
    title: "ð¦ Ð¢ÑÐ°Ð½ÑÐ¼Ð¸ÑÑÐ°Ð»Ñ",
    sections: [
      { heading: "Ð§ÑÐ¾ ÑÑÐ¾", text: "Ð¢ÑÐ°Ð½ÑÐ¼Ð¸ÑÑÐ°Ð» â Ð¾ÑÐ¸ÑÐ¸Ð°Ð»ÑÐ½ÑÐ¹ Ð´Ð¾ÐºÑÐ¼ÐµÐ½Ñ Ð¿ÐµÑÐµÐ´Ð°ÑÐ¸ Ð¿Ð°ÐºÐµÑÐ° ÑÐµÑÑÐµÐ¶ÐµÐ¹ Ð·Ð°ÐºÐ°Ð·ÑÐ¸ÐºÑ Ð¸Ð»Ð¸ ÑÐ¼ÐµÐ¶Ð½Ð¾Ð¹ Ð¾ÑÐ³Ð°Ð½Ð¸Ð·Ð°ÑÐ¸Ð¸." },
      { heading: "Ð¡Ð¾Ð·Ð´Ð°Ð½Ð¸Ðµ", text: "ÐÐ°Ð¶Ð¼Ð¸ÑÐµ Â«+ Ð¢ÑÐ°Ð½ÑÐ¼Ð¸ÑÑÐ°Ð»Â» â Ð´Ð¾Ð±Ð°Ð²ÑÑÐµ ÑÐµÑÑÐµÐ¶Ð¸ Ð² Ð¿Ð°ÐºÐµÑ â ÑÐºÐ°Ð¶Ð¸ÑÐµ Ð¿Ð¾Ð»ÑÑÐ°ÑÐµÐ»Ñ Ð¸ Ð´Ð°ÑÑ." },
      { heading: "Ð¡ÑÐ°ÑÑÑÑ", text: "Ð§ÐµÑÐ½Ð¾Ð²Ð¸Ðº â ÐÑÐ¿ÑÐ°Ð²Ð»ÐµÐ½ â ÐÐ¾Ð»ÑÑÐµÐ½ Ð¿Ð¾Ð´ÑÐ²ÐµÑÐ¶Ð´ÐµÐ½Ð¸Ðµ. Ð¡ÑÐ°ÑÑÑ Ð¼ÐµÐ½ÑÐµÑÑÑ Ð²ÑÑÑÐ½ÑÑ." },
      { heading: "Ð­ÐºÑÐ¿Ð¾ÑÑ", text: "ÐÐ¾ÑÐ¾Ð²ÑÐ¹ ÑÑÐ°Ð½ÑÐ¼Ð¸ÑÑÐ°Ð» Ð¼Ð¾Ð¶Ð½Ð¾ ÑÐ¾ÑÑÐ°Ð½Ð¸ÑÑ Ð² PDF Ð´Ð»Ñ Ð¾ÑÐ¸ÑÐ¸Ð°Ð»ÑÐ½Ð¾Ð¹ Ð¾ÑÐ¿ÑÐ°Ð²ÐºÐ¸." },
    ],
  },
  assignments: {
    title: "â Ð£Ð²ÑÐ·ÐºÐ°",
    sections: [
      { heading: "Ð§ÑÐ¾ ÑÑÐ¾", text: "ÐÐ½ÑÑÑÑÐ¼ÐµÐ½Ñ Ð´Ð»Ñ ÑÐ²ÑÐ·ÐºÐ¸ Ð·Ð°Ð´Ð°Ñ Ñ ÑÐµÑÑÐµÐ¶Ð°Ð¼Ð¸ Ð¸ Ð¸ÑÐ¿Ð¾Ð»Ð½Ð¸ÑÐµÐ»ÑÐ¼Ð¸. ÐÐ¾Ð¼Ð¾Ð³Ð°ÐµÑ ÐºÐ¾Ð½ÑÑÐ¾Ð»Ð¸ÑÐ¾Ð²Ð°ÑÑ, ÐºÐ°ÐºÐ¾Ð¹ ÑÐµÑÑÑÐ¶ Ðº ÐºÐ°ÐºÐ¾Ð¹ Ð·Ð°Ð´Ð°ÑÐµ Ð¾ÑÐ½Ð¾ÑÐ¸ÑÑÑ." },
      { heading: "ÐÑÐ¸Ð²ÑÐ·ÐºÐ°", text: "ÐÑÐºÑÐ¾Ð¹ÑÐµ Ð·Ð°Ð´Ð°ÑÑ â Ð² Ð¿Ð¾Ð»Ðµ Â«Ð§ÐµÑÑÑÐ¶Â» Ð²ÑÐ±ÐµÑÐ¸ÑÐµ Ð´Ð¾ÐºÑÐ¼ÐµÐ½Ñ Ð¸Ð· ÑÐµÐµÑÑÑÐ°. Ð¡Ð²ÑÐ·Ñ Ð¾ÑÐ¾Ð±ÑÐ°Ð¶Ð°ÐµÑÑÑ Ð² Ð¾Ð±Ð¾Ð¸Ñ Ð¼ÐµÑÑÐ°Ñ." },
      { heading: "ÐÐ¾Ð½ÑÑÐ¾Ð»Ñ", text: "Ð¡Ð¿Ð¸ÑÐ¾Ðº Ð¿Ð¾ÐºÐ°Ð·ÑÐ²Ð°ÐµÑ Ð²ÑÐµ Ð·Ð°Ð´Ð°ÑÐ¸ Ñ Ð¿ÑÐ¸Ð²ÑÐ·Ð°Ð½Ð½ÑÐ¼Ð¸ ÑÐµÑÑÐµÐ¶Ð°Ð¼Ð¸. Ð£Ð´Ð¾Ð±Ð½Ð¾ Ð´Ð»Ñ Ð¿ÑÐ¾Ð²ÐµÑÐºÐ¸ ÐºÐ¾Ð¼Ð¿Ð»ÐµÐºÑÐ½Ð¾ÑÑÐ¸." },
    ],
  },
  gantt: {
    title: "ð ÐÐ¸Ð°Ð³ÑÐ°Ð¼Ð¼Ð° ÐÐ°Ð½ÑÐ°",
    sections: [
      { heading: "Ð§ÑÐ¾ ÑÑÐ¾", text: "ÐÐ¸Ð·ÑÐ°Ð»Ð¸Ð·Ð°ÑÐ¸Ñ ÑÑÐ¾ÐºÐ¾Ð² Ð²ÑÐµÑ Ð·Ð°Ð´Ð°Ñ Ð½Ð° Ð²ÑÐµÐ¼ÐµÐ½Ð½Ð¾Ð¹ ÑÐºÐ°Ð»Ðµ." },
      { heading: "ÐÐ°Ðº ÑÐ¸ÑÐ°ÑÑ", text: "ÐÐ°Ð¶Ð´Ð°Ñ ÑÑÑÐ¾ÐºÐ° â Ð·Ð°Ð´Ð°ÑÐ°, Ð¿Ð¾Ð»Ð¾ÑÐºÐ° â Ð¿ÐµÑÐ¸Ð¾Ð´ Ð²ÑÐ¿Ð¾Ð»Ð½ÐµÐ½Ð¸Ñ (Ð¾Ñ ÑÐ¾Ð·Ð´Ð°Ð½Ð¸Ñ Ð´Ð¾ Ð´ÐµÐ´Ð»Ð°Ð¹Ð½Ð°). Ð¦Ð²ÐµÑ Ð·Ð°Ð²Ð¸ÑÐ¸Ñ Ð¾Ñ ÑÑÐ°ÑÑÑÐ°." },
      { heading: "ÐÑÐ¾ÑÑÐ¾ÑÐµÐ½Ð½ÑÐµ", text: "ÐÐ°Ð´Ð°ÑÐ¸ Ñ Ð¸ÑÑÑÐºÑÐ¸Ð¼ ÑÑÐ¾ÐºÐ¾Ð¼ Ð¿Ð¾Ð´ÑÐ²ÐµÑÐ¸Ð²Ð°ÑÑÑÑ ÐºÑÐ°ÑÐ½ÑÐ¼." },
    ],
  },
  timeline: {
    title: "ðº Timeline",
    sections: [
      { heading: "Ð§ÑÐ¾ ÑÑÐ¾", text: "ÐÑÐµÐ¼ÐµÐ½Ð½Ð°Ñ ÑÐºÐ°Ð»Ð° ÐºÐ»ÑÑÐµÐ²ÑÑ ÑÐ¾Ð±ÑÑÐ¸Ð¹ Ð¸ Ð²ÐµÑ Ð¿ÑÐ¾ÐµÐºÑÐ°." },
      { heading: "ÐÐ¾Ð±Ð°Ð²Ð»ÐµÐ½Ð¸Ðµ Ð²ÐµÑÐ¸", text: "ÐÐ°Ð¶Ð¼Ð¸ÑÐµ Â«+ ÐÐµÑÐ°Â» â ÑÐºÐ°Ð¶Ð¸ÑÐµ Ð½Ð°Ð·Ð²Ð°Ð½Ð¸Ðµ, Ð´Ð°ÑÑ Ð¸ ÑÐ¸Ð¿ ÑÐ¾Ð±ÑÑÐ¸Ñ." },
      { heading: "ÐÐ°Ð·Ð½Ð°ÑÐµÐ½Ð¸Ðµ", text: "ÐÑÐ¿Ð¾Ð»ÑÐ·ÑÐ¹ÑÐµ Timeline Ð´Ð»Ñ ÑÐ¸ÐºÑÐ°ÑÐ¸Ð¸ ÐºÐ¾Ð½ÑÑÐ¾Ð»ÑÐ½ÑÑ ÑÐ¾ÑÐµÐº: ÑÐ´Ð°ÑÐ° ÑÐ°Ð·Ð´ÐµÐ»Ð¾Ð², ÑÐ¾Ð³Ð»Ð°ÑÐ¾Ð²Ð°Ð½Ð¸Ñ, ÑÐºÑÐ¿ÐµÑÑÐ¸Ð·Ð°." },
    ],
  },
  meetings: {
    title: "ð ÐÑÐ¾ÑÐ¾ÐºÐ¾Ð»Ñ",
    sections: [
      { heading: "Ð§ÑÐ¾ ÑÑÐ¾", text: "ÐÑÑÐ½Ð°Ð» Ð¿ÑÐ¾ÑÐ¾ÐºÐ¾Ð»Ð¾Ð² ÑÐ¾Ð²ÐµÑÐ°Ð½Ð¸Ð¹ Ð¸ ÑÐ°Ð±Ð¾ÑÐ¸Ñ Ð²ÑÑÑÐµÑ Ð¿Ð¾ Ð¿ÑÐ¾ÐµÐºÑÑ." },
      { heading: "Ð¡Ð¾Ð·Ð´Ð°Ð½Ð¸Ðµ Ð¿ÑÐ¾ÑÐ¾ÐºÐ¾Ð»Ð°", text: "ÐÐ°Ð¶Ð¼Ð¸ÑÐµ Â«+ ÐÑÐ¾ÑÐ¾ÐºÐ¾Ð»Â» â ÑÐºÐ°Ð¶Ð¸ÑÐµ Ð´Ð°ÑÑ, ÑÑÐ°ÑÑÐ½Ð¸ÐºÐ¾Ð², Ð¿Ð¾Ð²ÐµÑÑÐºÑ Ð¸ Ð¿ÑÐ¸Ð½ÑÑÑÐµ ÑÐµÑÐµÐ½Ð¸Ñ." },
      { heading: "ÐÐ¾ÑÑÑÐµÐ½Ð¸Ñ", text: "Ð ÐºÐ°Ð¶Ð´Ð¾Ð¼ Ð¿ÑÐ½ÐºÑÐµ Ð¿ÑÐ¾ÑÐ¾ÐºÐ¾Ð»Ð° Ð¼Ð¾Ð¶Ð½Ð¾ Ð½Ð°Ð·Ð½Ð°ÑÐ¸ÑÑ Ð¾ÑÐ²ÐµÑÑÑÐ²ÐµÐ½Ð½Ð¾Ð³Ð¾ Ð¸ ÑÑÐ¾Ðº â Ð¾Ð½Ð¸ Ð¿Ð¾Ð¿Ð°Ð´Ð°ÑÑ Ð² ÑÐ°Ð·Ð´ÐµÐ» Ð·Ð°Ð´Ð°Ñ." },
      { heading: "ÐÑÑÐ¾ÑÐ¸Ñ", text: "ÐÑÐµ Ð¿ÑÐ¾ÑÐ¾ÐºÐ¾Ð»Ñ ÑÑÐ°Ð½ÑÑÑÑ Ð² ÑÑÐ¾Ð½Ð¾Ð»Ð¾Ð³Ð¸ÑÐµÑÐºÐ¾Ð¼ Ð¿Ð¾ÑÑÐ´ÐºÐµ. ÐÐ¾Ð¶Ð½Ð¾ ÑÐºÑÐ¿Ð¾ÑÑÐ¸ÑÐ¾Ð²Ð°ÑÑ Ð² PDF." },
    ],
  },
  timelog: {
    title: "â± Ð¢Ð°Ð±ÐµÐ»Ñ",
    sections: [
      { heading: "Ð§ÑÐ¾ ÑÑÐ¾", text: "Ð£ÑÑÑ ÑÐ°Ð±Ð¾ÑÐµÐ³Ð¾ Ð²ÑÐµÐ¼ÐµÐ½Ð¸ ÑÐ¾ÑÑÑÐ´Ð½Ð¸ÐºÐ¾Ð² Ð¿Ð¾ Ð¿ÑÐ¾ÐµÐºÑÑ." },
      { heading: "ÐÐ°Ð¿Ð¾Ð»Ð½ÐµÐ½Ð¸Ðµ", text: "ÐÐ°Ð¶Ð´ÑÐ¹ ÑÐ¾ÑÑÑÐ´Ð½Ð¸Ðº Ð²Ð½Ð¾ÑÐ¸Ñ Ð·Ð°ÑÑÐ°ÑÐµÐ½Ð½Ð¾Ðµ Ð²ÑÐµÐ¼Ñ Ð½Ð° Ð·Ð°Ð´Ð°ÑÑ: ÐºÐ½Ð¾Ð¿ÐºÐ° Â«+ ÐÐ°Ð¿Ð¸ÑÑÂ» â Ð²ÑÐ±ÐµÑÐ¸ÑÐµ Ð·Ð°Ð´Ð°ÑÑ, Ð´Ð°ÑÑ Ð¸ ÑÐ°ÑÑ." },
      { heading: "ÐÑÐ¾ÑÐ¼Ð¾ÑÑ", text: "ÐÐÐ Ð¸ ÑÑÐºÐ¾Ð²Ð¾Ð´Ð¸ÑÐµÐ»Ð¸ Ð²Ð¸Ð´ÑÑ ÑÐ²Ð¾Ð´ÐºÑ Ð¿Ð¾ Ð²ÑÐµÐ¼ ÑÐ¾ÑÑÑÐ´Ð½Ð¸ÐºÐ°Ð¼ Ð¸ Ð·Ð°Ð´Ð°ÑÐ°Ð¼." },
      { heading: "Ð­ÐºÑÐ¿Ð¾ÑÑ", text: "Ð¢Ð°Ð±ÐµÐ»Ñ Ð¼Ð¾Ð¶Ð½Ð¾ Ð²ÑÐ³ÑÑÐ·Ð¸ÑÑ Ð² Excel Ð´Ð»Ñ Ð¿ÐµÑÐµÐ´Ð°ÑÐ¸ Ð² Ð±ÑÑÐ³Ð°Ð»ÑÐµÑÐ¸Ñ Ð¸Ð»Ð¸ Ð¾ÑÑÑÑÐ½Ð¾ÑÑÑ." },
    ],
  },
  gipdash: {
    title: "ð ÐÐ°Ð½ÐµÐ»Ñ ÐÐÐÐ°",
    sections: [
      { heading: "Ð§ÑÐ¾ ÑÑÐ¾", text: "Ð¡Ð²Ð¾Ð´Ð½Ð°Ñ Ð°Ð½Ð°Ð»Ð¸ÑÐ¸ÐºÐ° Ð´Ð»Ñ ÐÐ»Ð°Ð²Ð½Ð¾Ð³Ð¾ ÐÐ½Ð¶ÐµÐ½ÐµÑÐ° ÐÑÐ¾ÐµÐºÑÐ° Ð¿Ð¾ Ð²ÑÐµÐ¼ Ð·Ð°Ð´Ð°ÑÐ°Ð¼, Ð¾ÑÐ´ÐµÐ»Ð°Ð¼ Ð¸ Ð¸ÑÐ¿Ð¾Ð»Ð½Ð¸ÑÐµÐ»ÑÐ¼." },
      { heading: "ÐÐ°Ð³ÑÑÐ·ÐºÐ°", text: "ÐÑÐ°ÑÐ¸Ðº Ð¿Ð¾ÐºÐ°Ð·ÑÐ²Ð°ÐµÑ Ð·Ð°Ð³ÑÑÐ¶ÐµÐ½Ð½Ð¾ÑÑÑ ÐºÐ°Ð¶Ð´Ð¾Ð³Ð¾ ÑÐ¾ÑÑÑÐ´Ð½Ð¸ÐºÐ°: ÑÐºÐ¾Ð»ÑÐºÐ¾ Ð·Ð°Ð´Ð°Ñ Ð² ÑÐ°Ð±Ð¾ÑÐµ, Ð½Ð° Ð¿ÑÐ¾Ð²ÐµÑÐºÐµ, Ð·Ð°Ð²ÐµÑÑÐµÐ½Ð¾." },
      { heading: "ÐÐ¾Ð½ÑÑÐ¾Ð»Ñ ÐºÐ°ÑÐµÑÑÐ²Ð°", text: "ÐÐ°Ð¼ÐµÑÐ°Ð½Ð¸Ñ Ð¸ ÑÐµÐ²Ð¸Ð·Ð¸Ð¸ Ð¿Ð¾ Ð²ÑÐµÐ¼ ÑÐ°Ð·Ð´ÐµÐ»Ð°Ð¼ â Ð²Ð¸Ð´Ð½Ð¾ Ð³Ð´Ðµ ÑÐ·ÐºÐ¸Ðµ Ð¼ÐµÑÑÐ°." },
      { heading: "ÐÐ¾ÑÑÑÐ¿", text: "Ð Ð°Ð·Ð´ÐµÐ» Ð²Ð¸Ð´ÐµÐ½ ÑÐ¾Ð»ÑÐºÐ¾ Ð¿Ð¾Ð»ÑÐ·Ð¾Ð²Ð°ÑÐµÐ»ÑÐ¼ Ñ ÑÐ¾Ð»ÑÑ ÐÐÐ." },
    ],
  },
  bim: {
    title: "ð BIM",
    sections: [
      { heading: "Ð§ÑÐ¾ ÑÑÐ¾", text: "ÐÑÐ¾ÑÐ¼Ð¾ÑÑ Ð¸Ð½ÑÐ¾ÑÐ¼Ð°ÑÐ¸Ð¾Ð½Ð½Ð¾Ð¹ Ð¼Ð¾Ð´ÐµÐ»Ð¸ Ð·Ð´Ð°Ð½Ð¸Ñ (BIM) Ð¿ÑÑÐ¼Ð¾ Ð² Ð±ÑÐ°ÑÐ·ÐµÑÐµ." },
      { heading: "ÐÐ°Ð³ÑÑÐ·ÐºÐ° Ð¼Ð¾Ð´ÐµÐ»Ð¸", text: "ÐÐ°Ð³ÑÑÐ·Ð¸ÑÐµ IFC-ÑÐ°Ð¹Ð» ÑÐµÑÐµÐ· ÐºÐ½Ð¾Ð¿ÐºÑ Â«ÐÐ°Ð³ÑÑÐ·Ð¸ÑÑ Ð¼Ð¾Ð´ÐµÐ»ÑÂ». ÐÐ¾Ð´Ð´ÐµÑÐ¶Ð¸Ð²Ð°ÐµÑÑÑ ÑÐ¾ÑÐ¼Ð°Ñ IFC 2x3 Ð¸ IFC 4." },
      { heading: "ÐÐ°Ð²Ð¸Ð³Ð°ÑÐ¸Ñ", text: "ÐÑÑÑ: Ð²ÑÐ°ÑÐµÐ½Ð¸Ðµ â Ð»ÐµÐ²Ð°Ñ ÐºÐ½Ð¾Ð¿ÐºÐ°, Ð¿Ð°Ð½Ð¾ÑÐ°Ð¼Ð° â ÑÑÐµÐ´Ð½ÑÑ ÐºÐ½Ð¾Ð¿ÐºÐ° / Shift+ÐÐÐ, Ð¼Ð°ÑÑÑÐ°Ð± â ÐºÐ¾Ð»ÐµÑÐ¾." },
      { heading: "ÐÐ±ÑÑÐ¶Ð´ÐµÐ½Ð¸Ðµ", text: "Ð ÑÐ´Ð¾Ð¼ Ñ Ð¼Ð¾Ð´ÐµÐ»ÑÑ Ð´Ð¾ÑÑÑÐ¿ÐµÐ½ ÑÐ°Ñ Ð´Ð»Ñ Ð¾Ð±ÑÑÐ¶Ð´ÐµÐ½Ð¸Ñ ÐºÐ¾Ð½ÐºÑÐµÑÐ½ÑÑ ÑÐ»ÐµÐ¼ÐµÐ½ÑÐ¾Ð² Ð¼Ð¾Ð´ÐµÐ»Ð¸." },
      { heading: "ÐÐ¾ÑÑÑÐ¿", text: "Ð Ð°Ð·Ð´ÐµÐ» Ð²Ð¸Ð´ÐµÐ½ ÐÐÐÑ Ð¸ ÑÑÐºÐ¾Ð²Ð¾Ð´Ð¸ÑÐµÐ»ÑÐ¼ Ð¾ÑÐ´ÐµÐ»Ð¾Ð²." },
    ],
  },
};

export default function App() {
  const [dark, setDark] = useState(false); // Ð¡Ð²ÐµÑÐ»Ð°Ñ ÑÐµÐ¼Ð° Ð¿Ð¾ ÑÐ¼Ð¾Ð»ÑÐ°Ð½Ð¸Ñ
  const C = dark ? DARK : LIGHT;

  // Auth state: initialized from Supabase JS session, kept fresh via onAuthStateChange.
  // Never reads from localStorage.enghub_token â that stale path is eliminated.
  const [token, setToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string>(localStorage.getItem('enghub_email') || "");
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [screen, setScreen] = useState(localStorage.getItem('enghub_screen') || "dashboard");
  const [projects, setProjects] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  // B4: Ð³Ð»Ð¾Ð±Ð°Ð»ÑÐ½ÑÐµ Ð·Ð°Ð´Ð°ÑÐ¸ Ð´Ð»Ñ Ð´Ð°ÑÐ±Ð¾ÑÐ´Ð¾Ð² Lead/Engineer (multi-project), Ð½ÐµÐ·Ð°Ð²Ð¸ÑÐ¸Ð¼Ð¾ Ð¾Ñ activeProject
  const [dashboardTasks, setDashboardTasks] = useState<any[]>([]);
  const [taskAttachCounts, setTaskAttachCounts] = useState<Record<string, number>>({});
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
  const [useKb, setUseKb] = useState(true);
  const [calcActiveCat, setCalcActiveCat] = useState<string | null>(null);
  const [showDupModal, setShowDupModal] = useState(false);
  const [dupConflicts, setDupConflicts] = useState<{file: File, existing: any}[]>([]);
  const [dupDecisions, setDupDecisions] = useState<Record<string, 'overwrite' | 'skip'>>({});
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState<any>(null);
  const [archiveStep, setArchiveStep] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [telegramIdInput, setTelegramIdInput] = useState("");
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [showTelegramInput, setShowTelegramInput] = useState(false);
  // #08 design diff: Ð°Ð½Ð¸Ð¼Ð°ÑÐ¸Ñ Ð·Ð°Ð¿Ð¾Ð»Ð½ÐµÐ½Ð¸Ñ Ð¿ÑÐ¾Ð³ÑÐµÑÑ-Ð±Ð°ÑÐ¾Ð² Ð¾ÑÐ´ÐµÐ»Ð¾Ð² Ð½Ð° Ð´Ð°ÑÐ±Ð¾ÑÐ´Ðµ
  const [deptBarsAnimated, setDeptBarsAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDeptBarsAnimated(true), 120); return () => clearTimeout(t); }, []);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [archivedProjects, setArchivedProjects] = useState<any[]>([]);
  const [branding, setBranding] = useState<{ companyName: string; logoUrl: string | null }>({ companyName: 'EngHub', logoUrl: null });
  const [sideTab, setSideTab] = useState(() => { const s = localStorage.getItem('enghub_sidetab'); return s || 'conference'; });
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [maxTasksPerEng, setMaxTasksPerEng] = useState(5);

  const [showNewProject, setShowNewProject] = useState(false);
  const [newProject, setNewProject] = useState<any>({ name: "", code: "", deadline: "", status: "active", depts: [] });
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showTaskTemplates, setShowTaskTemplates] = useState(false);
  const [showReportPDF, setShowReportPDF] = useState(false);
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

  // CONV Stage 4b: Ð·Ð°Ð¿ÑÐ¾Ñ Ð´Ð°Ð½Ð½ÑÑ Ñ ÑÐ¼ÐµÐ¶Ð½Ð¾Ð³Ð¾ Ð¾ÑÐ´ÐµÐ»Ð°
  const [showDepRequest, setShowDepRequest] = useState(false);
  const [depRequest, setDepRequest] = useState({ target_dept_id: "", what_needed: "", deadline_hint: "" });

  // ÐÐ¾Ð¸ÑÐº Ð¸ ÑÐ¸Ð»ÑÑÑÑ
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterAssigned, setFilterAssigned] = useState("all");

  const role = currentUserData?.role?.toLowerCase() || "";
  // Admin is determined by the role in app_users, not by the e-mail string.
  // Legacy fallback: the bootstrap account admin@enghub.com is treated as admin
  // until a profile with role='admin' exists for it.
  const isAdmin =
    role === "admin" ||
    (!currentUserData && userEmail === "admin@enghub.com");
  const isGip = role.includes("gip") || role.includes("Ð³Ð¸Ð¿");
  const isLead = role.includes("lead") || role.includes("ÑÑÐºÐ¾Ð²Ð¾Ð´Ð¸ÑÐµÐ»Ñ");
  const isEng = role.includes("engineer") || role.includes("Ð¸Ð½Ð¶ÐµÐ½ÐµÑ");

  const getUserById = (id: any) => appUsers.find(u => String(u.id) === String(id));
  const getDeptName = (id: any) => depts.find(d => String(d.id) === String(id))?.name || "ÐÐ±ÑÐ¸Ðµ";

  // ââ Auth lifecycle: single source of truth = Supabase JS session ââââââââââ
  useEffect(() => {
    const sb = getSupabaseAnonClient();
    // Hydrate from existing session on mount (handles page reload)
    sb.auth.getSession().then(({ data }) => {
      if (data.session) {
        setToken(data.session.access_token);
        setUserEmail(data.session.user.email ?? '');
        localStorage.setItem('enghub_email', data.session.user.email ?? '');
      }
      setAuthReady(true);
    });
    // Keep token fresh: fires on login, token refresh, and logout
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      console.log('[AUTH_CHANGE] event:', _event, 'hasSession:', !!session, 'email:', session?.user?.email ?? 'none');
      if (session) {
        setToken(session.access_token);
        setUserEmail(session.user.email ?? '');
        localStorage.setItem('enghub_email', session.user.email ?? '');
      } else {
        console.warn('[AUTH_CHANGE] session is null \u2192 clearing token');
        setToken(null);
        setUserEmail('');
      }
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (token && !isAdmin) {
      console.log('[AUTH] Loading app data, token prefix:', token.slice(0, 20));
      Promise.all([
        loadAppUsers().catch((e: any) => { console.error('[AUTH] loadAppUsers failed:', e?.constructor?.name, e?.message); throw e; }),
        loadDepts().catch((e: any) => { console.error('[AUTH] loadDepts failed:', e?.constructor?.name, e?.message); throw e; }),
        loadProjects().catch((e: any) => { console.error('[AUTH] loadProjects failed:', e?.constructor?.name, e?.message); throw e; }),
        loadNormativeDocs().catch((e: any) => { console.error('[AUTH] loadNormativeDocs failed:', e?.constructor?.name, e?.message); throw e; }),
        loadBranding(),
      ])
        .then(() => console.log('[AUTH] All data loaded OK'))
        .catch(async (e: any) => {
          setLoading(false);
          console.error('[AUTH] Data load catch:', e?.constructor?.name, e?.message, 'isAuthError:', e instanceof AuthError);
          if (e instanceof AuthError) {
            try {
              const { data: sessionData } = await getSupabaseAnonClient().auth.getSession();
              if (!sessionData?.session) {
                console.warn('[AUTH] Session confirmed invalid \u2192 logging out');
                handleLogout();
              } else {
                console.warn('[AUTH] Got 401 but session still valid \u2014 NOT logging out.');
              }
            } catch {
              handleLogout();
            }
          }
        });
    }
  }, [token]); // eslint-disable-line
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

  // ChatGPT 4.0 AI Module States
  const [showCopilot, setShowCopilot] = useState(false);
  const [showTabHelp, setShowTabHelp] = useState(false);

  const [incomingCall, setIncomingCall] = useState<any>(null); // { project_id, project_name, initiator_name }
  const [conferenceParticipants, setConferenceParticipants] = useState<any[]>([]);
  // Debounced: turns OFF only after 2s without a sharer, so 1-frame presence heartbeats don't cause layout flicker
  const [conferenceScreenActive, setConferenceScreenActive] = useState(false);
  const rawConferenceScreenActive = sideTab === 'conference' && conferenceParticipants.some((p: any) => p.screenSharing);
  useEffect(() => {
    if (rawConferenceScreenActive) {
      setConferenceScreenActive(true);
    } else {
      const t = setTimeout(() => setConferenceScreenActive(false), 2000);
      return () => clearTimeout(t);
    }
  }, [rawConferenceScreenActive]); // eslint-disable-line
  const presenceChannelRef = useRef<any>(null);
  const activeConferenceProjectRef = useRef<any>(null); // { id, name } of current conference project
  // Track which user IDs are currently known in the conference â used to debounce join/leave notifications
  const knownParticipantIdsRef = useRef<Set<string>>(new Set());
  const sessionId = useRef<string>(Math.random().toString(36).slice(2) + Date.now().toString(36));
  const sessionChannelRef = useRef<any>(null);

  // ââ ÐÐ´Ð½Ð° ÑÐµÑÑÐ¸Ñ Ð½Ð° Ð¿Ð¾Ð»ÑÐ·Ð¾Ð²Ð°ÑÐµÐ»Ñ: Ð¿ÑÐ¸ Ð½Ð¾Ð²Ð¾Ð¼ Ð²ÑÐ¾Ð´Ðµ Ð²ÑÐ±Ð¸Ð²Ð°ÐµÐ¼ ÑÑÐ°ÑÑÐµ ÑÐµÑÑÐ¸Ð¸ ââ
  useEffect(() => {
    if (!currentUserData?.id || !token) {
      if (sessionChannelRef.current) {
        const { ch, supa } = sessionChannelRef.current;
        supa.removeChannel(ch);
        sessionChannelRef.current = null;
      }
      return;
    }
    const supa = getSupabaseAnonClient();
    const ch = supa.channel(`session:${currentUserData.id}`, {
      config: { broadcast: { self: false, ack: false } }
    });
    ch.on('broadcast', { event: 'login' }, ({ payload }: any) => {
      if (payload?.sessionId && payload.sessionId !== sessionId.current) {
        // ÐÑÑÐ³Ð¾Ðµ ÑÑÑÑÐ¾Ð¹ÑÑÐ²Ð¾/Ð²ÐºÐ»Ð°Ð´ÐºÐ° Ð²Ð¾ÑÐ»Ð¾ Ð¿Ð¾Ð´ ÑÑÐ¸Ð¼ Ð°ÐºÐºÐ°ÑÐ½ÑÐ¾Ð¼ â Ð²ÑÑÐ¾Ð´Ð¸Ð¼
        handleLogout();
      }
    }).subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        ch.send({ type: 'broadcast', event: 'login', payload: { sessionId: sessionId.current } });
        sessionChannelRef.current = { ch, supa };
      }
    });
    return () => {
      supa.removeChannel(ch);
      sessionChannelRef.current = null;
    };
  }, [currentUserData?.id]); // eslint-disable-line

  // ââ Ð£Ð²ÐµÐ´Ð¾Ð¼Ð»ÐµÐ½Ð¸Ñ Ð¾ Ð²ÑÐ¾Ð´ÑÑÐ¸Ñ Ð²ÑÐ·Ð¾Ð²Ð°Ñ (bypass RLS ÑÐµÑÐµÐ· broadcast) ââ
  useEffect(() => {
    if (!currentUserData?.id || !token) return;
    const supa = getSupabaseAnonClient();
    const ch = supa.channel(`callnotify:${currentUserData.id}`, {
      config: { broadcast: { self: false, ack: false } }
    });
    ch.on('broadcast', { event: 'call_invite' }, ({ payload }: any) => {
      if (!payload) return;
      setIncomingCall({
        project_id: payload.project_id,
        project_name: payload.project_name || 'ÐÑÐ¾ÐµÐºÑ',
        initiator_name: payload.initiator_name || 'Ð£ÑÐ°ÑÑÐ½Ð¸Ðº',
      });
    }).subscribe();
    return () => { supa.removeChannel(ch); };
  }, [currentUserData?.id]); // eslint-disable-line

  // ÐÐµÑÐµÐ·Ð°Ð³ÑÑÐ¶Ð°ÐµÐ¼ Ð·Ð°Ð´Ð°ÑÐ¸ ÐºÐ¾Ð³Ð´Ð° currentUserData Ð·Ð°Ð³ÑÑÐ·Ð¸Ð»ÑÑ
  useEffect(() => { if (activeProject && token && currentUserData) { loadAllTasks(activeProject.id); } }, [currentUserData?.id]);

  // B4: Ð³ÑÑÐ·Ð¸Ð¼ multi-project tasks Ð´Ð»Ñ Ð´Ð°ÑÐ±Ð¾ÑÐ´Ð¾Ð² Lead/Engineer
  useEffect(() => {
    if (token && currentUserData?.id && depts.length) { loadDashboardTasks(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserData?.id, depts.length]);

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

  const signStorageUrl = async (bucket: string, path: string, expiresInSec: number = 60 * 60) => {
    try {
      const j = await apiPost<{ signed_url: string }>('/api/storage-sign-url', {
        bucket, storage_path: path, expiresIn: expiresInSec,
      });
      return j?.signed_url || null;
    } catch {
      return null;
    }
  };

  const loadBranding = async () => {
    try {
      const data: any = await apiGet('/api/admin/org-public');
      if (data) {
        setBranding({
          companyName: String(data.company_name || 'EngHub'),
          logoUrl: data.logo_url ? String(data.logo_url) : null,
        });
      }
    } catch {}
  };
  const loadAllTasks = async (pid: number) => {
    const data = await listProjectTasks(pid, token!);
    if (Array.isArray(data)) {
      setAllTasks(data);
      // Ð¤Ð¸Ð»ÑÑÑÐ°ÑÐ¸Ñ Ð¿Ð¾ ÑÐ¾Ð»Ð¸
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
      // T30e: Ð±Ð°ÑÑ-Ð¿Ð¾Ð´ÑÑÑÑ Ð¿ÑÐ¸ÐºÑÐµÐ¿Ð»ÑÐ½Ð½ÑÑ ÑÐ°Ð¹Ð»Ð¾Ð² Ð½Ð° Ð·Ð°Ð´Ð°ÑÐ°Ñ
      try {
        const ids = data.map((t: any) => Number(t.id)).filter(Boolean);
        const rows = await listTaskAttachmentsByTaskIds(ids, token!);
        const counts: Record<string, number> = {};
        for (const r of rows) {
          const k = String(r.task_id);
          counts[k] = (counts[k] || 0) + 1;
        }
        setTaskAttachCounts(counts);
      } catch { /* ignore: Ð¼Ð¸Ð³ÑÐ°ÑÐ¸Ñ Ð¼Ð¾Ð³Ð»Ð° Ð±ÑÑÑ Ð½Ðµ Ð¿ÑÐ¸Ð¼ÐµÐ½ÐµÐ½Ð° */ }
    }
  };
  // Keep loadTasks as alias
  const loadTasks = loadAllTasks;
  // B4: multi-project ÑÐ°ÑÐºÐ¾Ð² Ð´Ð»Ñ Lead/Engineer dashboard'Ð¾Ð². Lead â Ð·Ð°Ð´Ð°ÑÐ¸ Ð¾ÑÐ´ÐµÐ»Ð°, Engineer â ÑÐ²Ð¾Ð¸.
  const loadDashboardTasks = async () => {
    if (!token || !currentUserData) return;
    const role = String(currentUserData.role || '').toLowerCase();
    const myId = String(currentUserData.id || '');
    const myDeptId = currentUserData.dept_id;
    let path: string | null = null;
    if (role === 'engineer' && myId) {
      path = `tasks?assigned_to=eq.${encodeURIComponent(myId)}&select=*&order=deadline.asc.nullsfirst`;
    } else if (role === 'lead' && myDeptId) {
      const deptName = (depts.find(d => d.id === myDeptId)?.name) || '';
      if (deptName) {
        path = `tasks?dept=eq.${encodeURIComponent(deptName)}&select=*&order=deadline.asc.nullsfirst`;
      }
    }
    if (!path) return;
    try {
      const data = await get(path, token!);
      if (Array.isArray(data)) setDashboardTasks(data);
    } catch { /* RLS Ð½Ðµ Ð´Ð¾Ð»Ð¶Ð½Ð° ÑÐ¾Ð½ÑÑÑ â Ð¿ÑÐ¾ÑÑÐ¾ Ð¿ÑÑÑÐ¾Ð¹ ÑÐ¿Ð¸ÑÐ¾Ðº */ }
  };
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

  // NORM-01 fix: Ð¾ÑÐºÑÑÑÑ Ð½Ð¾ÑÐ¼Ð°ÑÐ¸Ð²Ð½ÑÐ¹ Ð´Ð¾ÐºÑÐ¼ÐµÐ½Ñ ÑÐµÑÐµÐ· Ð¿Ð¾Ð´Ð¿Ð¸ÑÐ°Ð½Ð½ÑÐ¹ Storage URL (ÑÐµÑÐµÐ· /api)
  const openNormativeDoc = async (doc: any) => {
    if (!doc?.file_path) { addNotification("ÐÑÑÑ Ðº ÑÐ°Ð¹Ð»Ñ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½", "warning"); return; }
    const isPdf = doc.file_type?.includes("pdf") || doc.name?.toLowerCase().endsWith(".pdf");
    const signedUrl = await signStorageUrl('normative-docs', doc.file_path, 3600);
    if (!signedUrl) { addNotification("ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ Ð¿Ð¾Ð»ÑÑÐ¸ÑÑ ÑÑÑÐ»ÐºÑ Ð½Ð° ÑÐ°Ð¹Ð»", "warning"); return; }
    if (isPdf) {
      window.open(signedUrl, "_blank");
    } else {
      const a = document.createElement("a");
      a.href = signedUrl;
      a.download = doc.name;
      document.body.appendChild(a); a.click(); a.remove();
    }
  };

  // ÐÐ°Ð¿Ð°ÑÐ½Ð¾Ð¹ ÑÐµÐºÑÑÐ¾Ð²ÑÐ¹ Ð¿Ð¾Ð¸ÑÐº ÑÐµÑÐµÐ· ilike (ÐºÐ¾Ð³Ð´Ð° Ð½ÐµÑ ÑÐ¼Ð±ÐµÐ´Ð´Ð¸Ð½Ð³Ð¾Ð²) â ÑÐµÑÐµÐ· /api
  const searchNormativeIlike = async (query: string): Promise<any[]> => {
    try {
      const data = await apiGet<any[]>(`/api/normative-docs?ilike=${encodeURIComponent(query.trim())}`);
      if (!Array.isArray(data)) return [];
      const byDoc = new Map<string, any>();
      for (const c of data) {
        if (!byDoc.has(c.doc_id)) byDoc.set(c.doc_id, { ...c, similarity: null });
        else byDoc.get(c.doc_id).matchCount = (byDoc.get(c.doc_id).matchCount || 1) + 1;
      }
      return Array.from(byDoc.values());
    } catch {
      return [];
    }
  };

  const searchNormative = async (query: string) => {
    if (!query.trim()) { setNormSearchResults(null); return; }
    setNormSearching(true);
    try {
      // ÐÑÐ¾Ð±ÑÐµÐ¼ ÑÐµÐ¼Ð°Ð½ÑÐ¸ÑÐµÑÐºÐ¸Ð¹ Ð¿Ð¾Ð¸ÑÐº
      let semanticResults: any[] = [];
      try {
        const res = await fetch(`${process.env.REACT_APP_RAILWAY_API_URL || ''}/api/orchestrator`, {
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
      } catch { /* ÑÐµÐ¼Ð°Ð½ÑÐ¸ÑÐµÑÐºÐ¸Ð¹ Ð¿Ð¾Ð¸ÑÐº Ð½ÐµÐ´Ð¾ÑÑÑÐ¿ÐµÐ½ */ }

      if (semanticResults.length > 0) {
        setNormSearchResults(semanticResults);
      } else {
        // ÐÐ°Ð¿Ð°ÑÐ½Ð¾Ð¹ Ð²Ð°ÑÐ¸Ð°Ð½Ñ: Ð¿Ð¾Ð¸ÑÐº Ð¿Ð¾ ÑÐµÐºÑÑÑ
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
        // Overwrite: ÑÐ´Ð°Ð»Ð¸ÑÑ ÑÑÑÐµÑÑÐ²ÑÑÑÐ¸Ð¹ Ð´Ð¾ÐºÑÐ¼ÐµÐ½Ñ ÑÐµÑÐµÐ· /api/normative-docs
        let overwriteId: string | null = null;
        if (decisions[file.name] === 'overwrite') {
          const existing = normativeDocs.find(d => d.name === file.name);
          if (existing) overwriteId = existing.id;
        }
        const filePath = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        // ÐÐ°Ð³ÑÑÐ·ÐºÐ° Ð² Storage Ñ user JWT (Ð´Ð»Ñ bucket normative-docs Ð´Ð¾Ð»Ð¶Ð½Ð° Ð±ÑÑÑ Storage policy Ð´Ð»Ñ authenticated INSERT).
        const uploadRes = await fetch(`${SURL}/storage/v1/object/normative-docs/${filePath}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!uploadRes.ok) { addNotification(`ÐÑÐ¸Ð±ÐºÐ° Ð·Ð°Ð³ÑÑÐ·ÐºÐ¸ "${file.name}": Storage Ð½ÐµÐ´Ð¾ÑÑÑÐ¿ÐµÐ½`, 'warning'); continue; }

        // Ð ÐµÐ³Ð¸ÑÑÑÐ¸ÑÑÐµÐ¼ Ð´Ð¾ÐºÑÐ¼ÐµÐ½Ñ Ð² ÐÐ ÑÐµÑÐµÐ· server-side endpoint (admin/gip only).
        let docRow: any;
        try {
          docRow = await apiPost('/api/normative-docs', {
            action: 'upload_init',
            name: file.name,
            file_type: file.type || 'application/octet-stream',
            file_path: filePath,
            overwrite_id: overwriteId,
          });
        } catch (e: any) {
          addNotification(`ÐÑÐ¸Ð±ÐºÐ° Ð·Ð°Ð¿Ð¸ÑÐ¸ "${file.name}": ${e?.message || 'unknown'}`, 'warning');
          continue;
        }

        const docId = docRow?.id;
        if (!docId) continue;

        // ÐÐ°Ð¿ÑÑÐº Ð²ÐµÐºÑÐ¾ÑÐ¸Ð·Ð°ÑÐ¸Ð¸ â ÑÐµÑÐµÐ· ÑÐ¾Ñ Ð¶Ðµ endpoint
        apiPost('/api/normative-docs', { action: 'vectorize', doc_id: docId }).catch(() => {});
        successCount++;
      } catch {
        addNotification(`ÐÑÐ¸Ð±ÐºÐ° Ð·Ð°Ð³ÑÑÐ·ÐºÐ¸ "${file.name}"`, 'warning');
      }
    }
    await loadNormativeDocs();
    if (successCount > 0) addNotification(`ÐÐ°Ð³ÑÑÐ¶ÐµÐ½Ð¾ ${successCount} Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ¾Ð². ÐÐ´ÑÑ Ð²ÐµÐºÑÐ¾ÑÐ¸Ð·Ð°ÑÐ¸Ñ...`, 'success');
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
      addNotification(`Ð¡Ð¾Ð¾Ð±ÑÐµÐ½Ð¸Ðµ Ð½Ðµ Ð¾ÑÐ¿ÑÐ°Ð²Ð»ÐµÐ½Ð¾: ${err.message || 'ÐÑÐ¸Ð±ÐºÐ° ÑÐµÑÐ²ÐµÑÐ°'}`, 'warning');
      return false;
    }
  };
  // FIX: dedicated task comment sender using its own text param (not shared chatInput state)
  const sendTaskComment = async (taskId: number, text: string) => {
    if (!text.trim() || !activeProject || !currentUserData?.id) return;
    try {
      await post("messages", {
        text: text.trim(),
        user_id: String(currentUserData?.id),
        project_id: activeProject.id,
        type: "text",
        task_id: taskId
      }, token!);
      await loadMessages(activeProject.id, taskId);
    } catch (err: any) {
      addNotification(`ÐÐ¾Ð¼Ð¼ÐµÐ½ÑÐ°ÑÐ¸Ð¹ Ð½Ðµ Ð¾ÑÐ¿ÑÐ°Ð²Ð»ÐµÐ½: ${err.message || 'ÐÑÐ¸Ð±ÐºÐ° ÑÐµÑÐ²ÐµÑÐ°'}`, 'warning');
    }
  };
  const { notifications, addNotification, removeNotification } = useNotifications();

  // ââ Refs Ð´Ð»Ñ Realtime callbacks (escape stale closures) ââ
  const activeProjectRef = useRef<any>(null);
  const currentUserDataRef = useRef<any>(null);
  const appUsersRef = useRef<any[]>([]);
  const addNotifRef = useRef(addNotification);
  const loadTasksRef = useRef(loadAllTasks);
  const loadDashboardTasksRef = useRef(loadDashboardTasks);
  const msgsRef = useRef<any[]>([]);
  const projectsRef = useRef<any[]>([]);
  const sideTabRef = useRef(sideTab);
  const tzFileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { activeProjectRef.current = activeProject; }, [activeProject]);
  useEffect(() => { currentUserDataRef.current = currentUserData; }, [currentUserData]);
  useEffect(() => { appUsersRef.current = appUsers; }, [appUsers]);
  useEffect(() => { addNotifRef.current = addNotification; });
  useEffect(() => { loadTasksRef.current = loadAllTasks; });
  useEffect(() => { loadDashboardTasksRef.current = loadDashboardTasks; });
  useEffect(() => { msgsRef.current = msgs; }, [msgs]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);
  useEffect(() => { sideTabRef.current = sideTab; }, [sideTab]);
  useEffect(() => { window.scrollTo(0, 0); setShowTabHelp(false); }, [sideTab]);

  // DASH-AUTOREFRESH: refresh on tab focus + 30s polling fallback (ÐµÑÐ»Ð¸ Realtime Ð»Ð°Ð³Ð°ÐµÑ)
  useEffect(() => {
    if (!token || !currentUserData?.id) return;
    const refresh = () => {
      const ap = activeProjectRef.current;
      if (ap?.id) loadTasksRef.current?.(ap.id);
      loadDashboardTasksRef.current?.();
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refresh);
    const intervalId = window.setInterval(refresh, 30000);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refresh);
      window.clearInterval(intervalId);
    };
  }, [token, currentUserData?.id]);

  // ââ Supabase Realtime: Ð¿Ð¾Ð´Ð¿Ð¸ÑÐºÐ° Ð½Ð° Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ñ Ð·Ð°Ð´Ð°Ñ ââ
  useEffect(() => {
    if (!token || !currentUserData?.id) return;
    const supa = getSupabaseAnonClient();
    const channel = supa.channel('tasks:live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, (payload: any) => {
        const t = payload.new;
        const me = currentUserDataRef.current;
        if (!me) return;
        if (String(t.assigned_to) === String(me.id)) {
          addNotifRef.current(`ð ÐÐ°Ð¼ Ð½Ð°Ð·Ð½Ð°ÑÐµÐ½Ð° Ð·Ð°Ð´Ð°ÑÐ°: Â«${t.name}Â»`, 'info');
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
          if (t.status === 'revision') addNotifRef.current(`â¡ ÐÐ°Ð´Ð°ÑÐ° Ð½Ð° Ð´Ð¾ÑÐ°Ð±Ð¾ÑÐºÑ: Â«${t.name}Â»`, 'warning');
          if (t.status === 'done') addNotifRef.current(`â ÐÐ°Ð´Ð°ÑÐ° Ð·Ð°Ð²ÐµÑÑÐµÐ½Ð°: Â«${t.name}Â»`, 'success');
        }
        if (myRole === 'lead' && t.status === 'review_lead') {
          const myEngIds = new Set(appUsersRef.current.filter((u: any) => u.dept_id === me.dept_id).map((u: any) => String(u.id)));
          if (myEngIds.has(String(t.assigned_to)) || String(t.assigned_to) === uid) {
            addNotifRef.current(`ð ÐÐ°Ð´Ð°ÑÐ° Ð¾Ð¶Ð¸Ð´Ð°ÐµÑ Ð²Ð°ÑÐµÐ¹ Ð¿ÑÐ¾Ð²ÐµÑÐºÐ¸: Â«${t.name}Â»`, 'info');
          }
        }
        if (myRole === 'gip' && t.status === 'review_gip') {
          addNotifRef.current(`ð ÐÐ°Ð´Ð°ÑÐ° Ð¾Ð¶Ð¸Ð´Ð°ÐµÑ Ð¿ÑÐ¾Ð²ÐµÑÐºÐ¸ ÐÐÐÐ°: Â«${t.name}Â»`, 'info');
        }
        if (activeProjectRef.current?.id === t.project_id) loadTasksRef.current(t.project_id);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews' }, (payload: any) => {
        const r = payload.new;
        const me = currentUserDataRef.current;
        if (!me || String(r.author_id) === String(me.id)) return;
        if (activeProjectRef.current?.id === r.project_id) {
          addNotifRef.current(`ð ÐÐ¾Ð²Ð¾Ðµ Ð·Ð°Ð¼ÐµÑÐ°Ð½Ð¸Ðµ: Â«${r.title}Â»`, 'warning');
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reviews' }, (payload: any) => {
        const r = payload.new;
        const me = currentUserDataRef.current;
        if (!me) return;
        if (activeProjectRef.current?.id === r.project_id) {
          if (r.status === 'resolved') addNotifRef.current(`â ÐÐ°Ð¼ÐµÑÐ°Ð½Ð¸Ðµ ÑÐ½ÑÑÐ¾: Â«${r.title}Â»`, 'success');
          if (r.status === 'in_progress' && (me.role === 'gip' || me.role === 'lead')) addNotifRef.current(`ð§ ÐÐ°Ð¼ÐµÑÐ°Ð½Ð¸Ðµ Ð²Ð·ÑÑÐ¾ Ð² ÑÐ°Ð±Ð¾ÑÑ: Â«${r.title}Â»`, 'info');
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transmittals' }, (payload: any) => {
        const tr = payload.new;
        const me = currentUserDataRef.current;
        if (!me) return;
        if (activeProjectRef.current?.id === tr.project_id && tr.status === 'issued') {
          addNotifRef.current(`ð¬ Ð¢ÑÐ°Ð½ÑÐ¼Ð¸ÑÑÐ°Ð» Ð²ÑÐ¿ÑÑÐµÐ½: â${tr.number}`, 'info');
        }
      })
      // ââ Realtime: Ð½Ð¾Ð²ÑÐµ ÑÐ¾Ð¾Ð±ÑÐµÐ½Ð¸Ñ ÑÐ°ÑÐ° ââ
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
        const m = payload.new;
        const me = currentUserDataRef.current;
        if (!me) return;
        // ÐÐµ Ð´ÑÐ±Ð»Ð¸ÑÑÐµÐ¼ ÑÐ²Ð¾Ñ ÑÐ¾Ð±ÑÑÐ²ÐµÐ½Ð½Ð¾Ðµ ÑÐ¾Ð¾Ð±ÑÐµÐ½Ð¸Ðµ (Ð¾Ð½Ð¾ ÑÐ¶Ðµ Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ð¾ ÑÐµÑÐµÐ· loadMessages)
        if (String(m.user_id) === String(me.id)) return;
        const activeProj = activeProjectRef.current;
        if (activeProj?.id === m.project_id) {
          // ÐÐ¾Ð±Ð°Ð²Ð»ÑÐµÐ¼ ÑÐ¾Ð¾Ð±ÑÐµÐ½Ð¸Ðµ Ð² ÑÐµÐºÑÑÐ¸Ð¹ ÑÐ¿Ð¸ÑÐ¾Ðº ÐµÑÐ»Ð¸ Ð½Ðµ Ð´ÑÐ±Ð»Ð¸ÑÑÐµÑÑÑ
          setMsgs((prev: any[]) => prev.find(msg => msg.id === m.id) ? prev : [...prev, m]);
        } else {
          // Ð£Ð²ÐµÐ´Ð¾Ð¼Ð»ÐµÐ½Ð¸Ðµ Ð¾ ÑÐ¾Ð¾Ð±ÑÐµÐ½Ð¸Ð¸ Ð² Ð´ÑÑÐ³Ð¾Ð¼ Ð¿ÑÐ¾ÐµÐºÑÐµ
          const sender = appUsersRef.current.find((u: any) => String(u.id) === String(m.user_id));
          const proj = projectsRef.current.find((p: any) => p.id === m.project_id);
          if (proj && m.type !== 'call_invite') {
            addNotifRef.current(`ð¬ ${sender?.full_name || 'Ð£ÑÐ°ÑÑÐ½Ð¸Ðº'}: Ð½Ð¾Ð²Ð¾Ðµ ÑÐ¾Ð¾Ð±ÑÐµÐ½Ð¸Ðµ Ð² "${proj.name}"`, 'info');
          }
        }
        // call_invite Ð¾Ð±ÑÐ°Ð±Ð°ÑÑÐ²Ð°ÐµÑÑÑ ÑÐ¾Ð»ÑÐºÐ¾ ÑÐµÑÐµÐ· broadcast-ÐºÐ°Ð½Ð°Ð» (callnotify)
      })
      .subscribe();
    return () => { supa.removeChannel(channel); };
  }, [currentUserData?.id]); // eslint-disable-line

  // ââ Supabase Realtime: Ð¿Ð¾Ð´Ð¿Ð¸ÑÐºÐ° Ð½Ð° Ð½Ð¾Ð²ÑÐµ ÑÐ¾Ð¾Ð±ÑÐµÐ½Ð¸Ñ ÑÐ°ÑÐ° ââ
  useEffect(() => {
    if (!token || !currentUserData?.id) return;
    const supa = getSupabaseAnonClient();
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

  // Polling â Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ðµ ÑÐ¾Ð¾Ð±ÑÐµÐ½Ð¸Ð¹ ÑÐ°ÑÐ° Ð¿ÑÐ¸ Ð¾ÑÐºÑÑÑÐ¾Ð¼ ÑÐ¾Ð²ÐµÑÐ°Ð½Ð¸Ð¸
  useEffect(() => {
    if (!activeProject || !token || sideTab !== 'conference') return;
    const interval = setInterval(() => {
      loadMessages(activeProject.id);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeProject?.id, token, sideTab]); // eslint-disable-line

  // Polling â ÑÐ¾Ð»ÑÐºÐ¾ Ð´Ð»Ñ ÑÐ²ÐµÐ´Ð¾Ð¼Ð»ÐµÐ½Ð¸Ð¹ Ð¾ Ð·Ð²Ð¾Ð½ÐºÐ°Ñ (Ð·Ð°Ð´Ð°ÑÐ¸ Ð¾Ð±Ð½Ð¾Ð²Ð»ÑÑÑÑÑ ÑÐµÑÐµÐ· Realtime)
  useEffect(() => {
    if (!activeProject || !token) return;
    const interval = setInterval(async () => {
      const msgData = await get(`messages?project_id=eq.${activeProject.id}&type=eq.call_start&order=created_at.desc&limit=1`, token);
      if (Array.isArray(msgData) && msgData.length > 0) {
        const call = msgData[0];
        const callTime = new Date(call.created_at).getTime();
        // call_start Ð¿ÑÐ¾ÑÑÐ¾ Ð¾Ð±Ð½Ð¾Ð²Ð»ÑÐµÑ ÑÐ¿Ð¸ÑÐ¾Ðº â ÑÐ²ÐµÐ´Ð¾Ð¼Ð»ÐµÐ½Ð¸Ðµ ÑÐ¾Ð»ÑÐºÐ¾ ÑÐµÑÐµÐ· ÑÐ²Ð½Ð¾Ðµ Ð¿ÑÐ¸Ð³Ð»Ð°ÑÐµÐ½Ð¸Ðµ (callnotify broadcast)
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [activeProject, token, sideTab]);

  // ââ A6: AI task suggest â debounced call on task name change ââ
  useEffect(() => {
    if (!showNewTask || !newTask.name.trim() || newTask.name.trim().length < 5 || !activeProject) {
      setTaskSuggest(null);
      return;
    }
    const timer = setTimeout(async () => {
      setTaskSuggestLoading(true);
      try {
        const apiUrl = `${process.env.REACT_APP_RAILWAY_API_URL || ''}/api/orchestrator`;
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

  // ââ Presence: ÑÐ¿ÑÐ°Ð²Ð»ÐµÐ½Ð¸Ðµ Ð¿ÑÐ¸ÑÑÑÑÑÐ²Ð¸ÐµÐ¼ Ð² Ð·Ð°Ð»Ðµ ÑÐ¾Ð²ÐµÑÐ°Ð½Ð¸Ñ ââ
  const joinConference = async (initialMic = false, initialScreen = false) => {
    if (!activeProject?.id || !currentUserData) return;

    // ÐÐ°Ð¿ÑÐµÑÐ¸ÑÑ Ð²ÑÐ¾Ð´ Ð² Ð´ÑÑÐ³Ð¾Ðµ ÑÐ¾Ð²ÐµÑÐ°Ð½Ð¸Ðµ â Ð¿ÑÐµÐ´Ð»Ð¾Ð¶Ð¸ÑÑ ÑÐ½Ð°ÑÐ°Ð»Ð° Ð²ÑÐ¹ÑÐ¸
    if (presenceChannelRef.current && String(activeConferenceProjectRef.current?.id) !== String(activeProject.id)) {
      const otherName = activeConferenceProjectRef.current?.name || 'Ð´ÑÑÐ³Ð¾Ð¼ Ð¿ÑÐ¾ÐµÐºÑÐµ';
      const ok = window.confirm(`ÐÑ ÑÐ¶Ðµ Ð² ÑÐ¾Ð²ÐµÑÐ°Ð½Ð¸Ð¸ Ð¿Ð¾ Ð¿ÑÐ¾ÐµÐºÑÑ "${otherName}".\nÐÑÐ¹ÑÐ¸ Ð¸Ð· Ð½ÐµÐ³Ð¾ Ð¸ Ð²Ð¾Ð¹ÑÐ¸ Ð² ÑÑÐ¾ ÑÐ¾Ð²ÐµÑÐ°Ð½Ð¸Ðµ?`);
      if (!ok) return;
      await leaveConference();
    }
    const supa = getSupabaseAnonClient();
    const ch = supa.channel(`presence:${activeProject.id}`, {
      config: { presence: { key: String(currentUserData.id) } }
    });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      // Group by user key and merge status (mic, screen) across sessions
      const mergedUsers = Object.entries(state).map(([key, sessions]: [string, any[]]) => {
        const primary = sessions[0];
        return {
          ...primary,
          micEnabled: sessions.some(s => s.micEnabled),
          screenSharing: sessions.some(s => s.screenSharing),
          isTalking: sessions.some(s => s.isTalking),
          // Ensure we have a consistent ID
          id: primary.id || key
        };
      });
      setConferenceParticipants(mergedUsers);
    })
    .on('presence', { event: 'join' }, ({ newPresences }: any) => {
      const u = newPresences?.[0];
      if (u && String(u.id) !== String(currentUserData.id)) {
        const uid = String(u.id);
        // Only notify on first real join â ref is stable, no stale closure problem
        if (!knownParticipantIdsRef.current.has(uid)) {
          knownParticipantIdsRef.current.add(uid);
          addNotification(`ð¤ ${u.full_name || 'Ð£ÑÐ°ÑÑÐ½Ð¸Ðº'} Ð·Ð°ÑÑÐ» Ð² ÑÐ¾Ð²ÐµÑÐ°Ð½Ð¸Ðµ`, 'info');
        }
        // Always add to known set (presence update re-fires join â just update known)
      }
      // Re-fetch state on join to ensure sync
      const state = ch.presenceState();
      const mergedUsers = Object.entries(state).map(([key, sessions]: [string, any[]]) => {
        const primary = sessions[0];
        return {
          ...primary,
          micEnabled: sessions.some(s => s.micEnabled),
          screenSharing: sessions.some(s => s.screenSharing),
          isTalking: sessions.some(s => s.isTalking),
          id: primary.id || key
        };
      });
      setConferenceParticipants(mergedUsers);
    })
    .on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
      const u = leftPresences?.[0];
      if (u && String(u.id) !== String(currentUserData.id)) {
        const uid = String(u.id);
        // Wait 2s: if it's just a presence update (track() fires leave+join), user will rejoin
        setTimeout(() => {
          const state = ch.presenceState();
          const stillPresent = Object.values(state).flat().some((s: any) => String(s.id) === uid);
          if (!stillPresent) {
            knownParticipantIdsRef.current.delete(uid); // allow notification on next real join
            addNotification(`ð¤ ${u.full_name || 'Ð£ÑÐ°ÑÑÐ½Ð¸Ðº'} Ð²ÑÑÐµÐ» Ð¸Ð· ÑÐ¾Ð²ÐµÑÐ°Ð½Ð¸Ñ`, 'info');
          }
          // else: user came back (was a track() update) â no notification, keep in knownIds
        }, 2000);
      }
      // Re-fetch state on leave to ensure sync
      const state = ch.presenceState();
      const mergedUsers = Object.entries(state).map(([key, sessions]: [string, any[]]) => {
        const primary = sessions[0];
        return {
          ...primary,
          micEnabled: sessions.some(s => s.micEnabled),
          screenSharing: sessions.some(s => s.screenSharing),
          isTalking: sessions.some(s => s.isTalking),
          id: primary.id || key
        };
      });
      setConferenceParticipants(mergedUsers);
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
        activeConferenceProjectRef.current = { id: String(activeProject.id), name: activeProject.name };
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
    activeConferenceProjectRef.current = null;
    knownParticipantIdsRef.current.clear();
    pendingPresenceDataRef.current = {};
    clearTimeout(pendingPresenceRef.current);
    setConferenceParticipants([]);
  };

  // Debounce presence updates: each ch.track() call fires leave+join on ALL other clients.
  // Batching rapid calls (mic toggle, isTalking) into one prevents notification spam.
  const pendingPresenceRef = useRef<any>(null);
  const pendingPresenceDataRef = useRef<any>({});

  const updatePresence = async (updates: any) => {
    if (!presenceChannelRef.current || !currentUserData) return;
    // Merge updates so rapid calls accumulate rather than overwrite
    pendingPresenceDataRef.current = { ...pendingPresenceDataRef.current, ...updates };
    clearTimeout(pendingPresenceRef.current);
    pendingPresenceRef.current = setTimeout(async () => {
      if (!presenceChannelRef.current) return;
      const { ch } = presenceChannelRef.current;
      await ch.track({
        id: currentUserData.id,
        full_name: currentUserData.full_name,
        role: currentUserData.role,
        position: currentUserData.position,
        ...pendingPresenceDataRef.current
      });
      pendingPresenceDataRef.current = {};
    }, 800); // 800ms debounce â batches rapid mic/talking updates into one track() call
  };

  const createProject = async () => {
    if (!newProject.name || !newProject.code) return;
    setSaving(true);
    try {
      // B4: gip_id ÑÑÐ°Ð²Ð¸Ð¼ ÑÐµÐºÑÑÐ¸Ð¼ Ð¿Ð¾Ð»ÑÐ·Ð¾Ð²Ð°ÑÐµÐ»ÐµÐ¼ â Ð¾Ð½ ÑÑÐ°Ð½Ð¾Ð²Ð¸ÑÑÑ Ð²Ð»Ð°Ð´ÐµÐ»ÑÑÐµÐ¼ Ð¿ÑÐ¾ÐµÐºÑÐ°.
      // RLS projects_insert ÑÑÐµÐ±ÑÐµÑ, ÑÑÐ¾Ð±Ñ gip_id = auth_app_user_id() Ð´Ð»Ñ ÑÐ¾Ð»Ð¸ gip.
      const created = await post("projects", { ...newProject, gip_id: currentUserData?.id, progress: 0, archived: false }, token!);
      // ÐÐ°Ð³ÑÑÐ¶Ð°ÐµÐ¼ Ð¢Ð ÐµÑÐ»Ð¸ Ð²ÑÐ±ÑÐ°Ð½ ÑÐ°Ð¹Ð»
      const tzFile = tzFileRef.current?.files?.[0];
      if (tzFile && created?.[0]?.id) {
        try {
          const fd = new FormData();
          fd.append('project_id', String(created[0].id));
          fd.append('file', tzFile, tzFile.name);
          await fetch(`https://api-server-production-8157.up.railway.app/api/assignment`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
        } catch (_) { /* Ð¢Ð Ð½Ðµ ÐºÑÐ¸ÑÐ¸ÑÐ½Ð¾ â Ð¿ÑÐ¾ÐµÐºÑ ÑÐ¶Ðµ ÑÐ¾Ð·Ð´Ð°Ð½ */ }
        if (tzFileRef.current) tzFileRef.current.value = '';
      }
      setNewProject({ name: "", code: "", deadline: "", status: "active", depts: [] });
      setShowNewProject(false);
      loadProjects();
      addNotification(`ÐÑÐ¾ÐµÐºÑ "${newProject.name}" ÑÐ¾Ð·Ð´Ð°Ð½`, 'success');
    } catch (err: any) {
      addNotification(`ÐÑÐ¸Ð±ÐºÐ° ÑÐ¾Ð·Ð´Ð°Ð½Ð¸Ñ Ð¿ÑÐ¾ÐµÐºÑÐ°: ${err.message || 'ÐÑÐ¸Ð±ÐºÐ° ÑÐµÑÐ²ÐµÑÐ°'}`, 'warning');
    } finally {
      setSaving(false);
    }
  };
  
  const toggleProjectDept = (deptId: number) => {
    const current = newProject.depts || [];
    const next = current.includes(deptId) ? current.filter((id: number) => id !== deptId) : [...current, deptId];
    setNewProject({ ...newProject, depts: next });
  };

  const getDeptNameById = (id: number | string) => depts.find(d => String(d.id) === String(id))?.name || "";
  const archiveProject = async (id: number) => {
    await patch(`projects?id=eq.${id}`, { archived: true, archived_at: new Date().toISOString() }, token!);
    loadProjects();
  };

  const promptArchiveProject = (p: any) => {
    setArchiveConfirm(p);
    setArchiveStep(0);
  };
  const createTask = async () => {
    if (!newTask.name || !activeProject) return;
    if (!newTask.deadline) { addNotification('Ð£ÐºÐ°Ð¶Ð¸ÑÐµ Ð´ÐµÐ´Ð»Ð°Ð¹Ð½ Ð·Ð°Ð´Ð°ÑÐ¸', 'warning'); return; }
    setSaving(true);
    try {
      const leadUser = getUserById(newTask.assigned_to);
      const result = await createProjectTask({ name: newTask.name, dept: getDeptName(newTask.dept_id), priority: newTask.priority, deadline: newTask.deadline, assigned_to: newTask.assigned_to || null, status: "todo", project_id: activeProject.id, description: newTask.description || null }, token!);
      // Optimistic update: ÐµÑÐ»Ð¸ Ð²ÐµÑÐ½ÑÐ»Ð°ÑÑ Ð½Ð¾Ð²Ð°Ñ Ð·Ð°Ð´Ð°ÑÐ°, Ð´Ð¾Ð±Ð°Ð²Ñ ÐµÑ Ð² ÑÐ¿Ð¸ÑÐ¾Ðº ÑÑÐ°Ð·Ñ
      if (result && typeof result === 'object') {
        setAllTasks((prev) => [...prev, result]);
        loadAllTasks(activeProject.id); // ÐÐ¾ÑÐ¾Ð¼ Ð¿ÐµÑÐµÐ·Ð°Ð³ÑÑÐ·Ð¸ Ð´Ð»Ñ ÑÐ¸Ð½ÑÑÐ¾Ð½Ð¸Ð·Ð°ÑÐ¸Ð¸
        // Publish task.created event to Redis
        publishTaskCreated(String(result.id), String(activeProject.id), String(currentUserData?.id)).catch((err) => {
          console.warn('[Events] Failed to publish task.created:', err);
        });
      }
      addNotification(`ÐÐ°Ð´Ð°ÑÐ° "${newTask.name}" ÑÐ¾Ð·Ð´Ð°Ð½Ð°${leadUser ? ` â ${leadUser.full_name}` : ''}`, 'success');
      if (newTask.assigned_to && String(newTask.assigned_to) !== String(currentUserData?.id)) {
        createNotification({
          user_id: Number(newTask.assigned_to),
          project_id: activeProject.id,
          type: 'task_assigned',
          title: `ÐÐ°Ð¼ Ð½Ð°Ð·Ð½Ð°ÑÐµÐ½Ð° Ð½Ð¾Ð²Ð°Ñ Ð·Ð°Ð´Ð°ÑÐ°`,
          body: newTask.name,
          entity_type: 'task',
        }).catch(() => {});
      }
      setNewTask({ name: "", dept_id: "", priority: "medium", deadline: "", assigned_to: "", drawing_id: "", description: "" }); setShowNewTask(false); loadTasks(activeProject.id);
    } catch (err: any) {
      addNotification(`ÐÑÐ¸Ð±ÐºÐ° ÑÐ¾Ð·Ð´Ð°Ð½Ð¸Ñ Ð·Ð°Ð´Ð°ÑÐ¸: ${err.message || 'ÐÑÐ¸Ð±ÐºÐ° ÑÐµÑÐ²ÐµÑÐ°'}`, 'warning');
    } finally {
      setSaving(false);
    }
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
    addNotification(`ÐÐ°Ð´Ð°Ð½Ð¸Ðµ ÑÐ¼ÐµÐ¶Ð½Ð¸ÐºÐ°Ð¼ Ð¾ÑÐ¿ÑÐ°Ð²Ð»ÐµÐ½Ð¾`, 'success');
    setNewAssignment({ name: "", target_dept: "", priority: "high", deadline: "" });
    setShowNewAssignment(false);
    setSaving(false);
    loadTasks(activeProject.id);
  };

  // CONV Stage 4b: Ð·Ð°Ð¿ÑÐ¾Ñ Ð²ÑÐ¾Ð´Ð½ÑÑ Ð´Ð°Ð½Ð½ÑÑ Ñ ÑÐ¼ÐµÐ¶Ð½Ð¾Ð³Ð¾ Ð¾ÑÐ´ÐµÐ»Ð° (Ð¿Ð¾ ÑÑÐµÐ±Ð¾Ð²Ð°Ð½Ð¸Ñ)
  const requestDependencyData = async () => {
    if (!selectedTask || !depRequest.target_dept_id || !depRequest.what_needed.trim() || !activeProject) {
      addNotification('ÐÐ°Ð¿Ð¾Ð»Ð½Ð¸ Ð²ÑÐµ Ð¾Ð±ÑÐ·Ð°ÑÐµÐ»ÑÐ½ÑÐµ Ð¿Ð¾Ð»Ñ', 'warning');
      return;
    }
    setSaving(true);
    try {
      const targetDeptName = getDeptNameById(Number(depRequest.target_dept_id));
      const reqTitle = `ð¥ ÐÐ°Ð¿ÑÐ¾Ñ Ð´Ð°Ð½Ð½ÑÑ: ${depRequest.what_needed.trim().slice(0, 100)}`;
      const childTask: any = await post('tasks', {
        name: reqTitle,
        dept: targetDeptName,
        priority: 'high',
        deadline: depRequest.deadline_hint || selectedTask.deadline || '',
        status: 'todo',
        project_id: activeProject.id,
        is_assignment: true,
        target_dept_id: Number(depRequest.target_dept_id),
        assignment_status: 'pending_accept',
        description: `ÐÐ°Ð¿ÑÐ¾Ñ Ð¾Ñ Ð·Ð°Ð´Ð°ÑÐ¸ "${selectedTask.name}":\n\n${depRequest.what_needed}`,
        parent_task_id: selectedTask.id,
      }, token!);
      const childId = Array.isArray(childTask) ? childTask[0]?.id : childTask?.id;
      if (childId) {
        await post('task_dependencies', {
          parent_task_id: selectedTask.id,
          child_task_id: childId,
          what_needed: depRequest.what_needed.trim(),
          deadline_hint: depRequest.deadline_hint || null,
          status: 'pending',
          created_by: currentUserData?.id,
        }, token!);
      }
      // ÐÐµÑÐµÐ²ÐµÑÑÐ¸ ÑÐµÐºÑÑÑÑ Ð·Ð°Ð´Ð°ÑÑ Ð² awaiting_input
      await patch(`tasks?id=eq.${selectedTask.id}`, { status: 'awaiting_input' }, token!);
      setSelectedTask({ ...selectedTask, status: 'awaiting_input' });
      addNotification(`ÐÐ°Ð¿ÑÐ¾Ñ Ð¾ÑÐ¿ÑÐ°Ð²Ð»ÐµÐ½ Ð² Ð¾ÑÐ´ÐµÐ» ${targetDeptName}. ÐÐ°Ð´Ð°ÑÐ° Ð¿ÐµÑÐµÐ²ÐµÐ´ÐµÐ½Ð° Ð² "ÐÐ´ÑÑ Ð´Ð°Ð½Ð½ÑÑ"`, 'success');
      setShowDepRequest(false);
      setDepRequest({ target_dept_id: '', what_needed: '', deadline_hint: '' });
      loadTasks(activeProject.id);
    } catch (err: any) {
      addNotification(`ÐÑÐ¸Ð±ÐºÐ°: ${err.message || 'Ð½Ðµ ÑÐ´Ð°Ð»Ð¾ÑÑ Ð¾ÑÐ¿ÑÐ°Ð²Ð¸ÑÑ Ð·Ð°Ð¿ÑÐ¾Ñ'}`, 'warning');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignmentResponse = async (taskId: number, accept: boolean, comment?: string) => {
      setSaving(true);
      if (accept) {
          await patch(`tasks?id=eq.${taskId}`, { assignment_status: 'accepted' }, token!);
          addNotification('ÐÐ°Ð´Ð°Ð½Ð¸Ðµ Ð¿ÑÐ¸Ð½ÑÑÐ¾ Ð² ÑÐ°Ð±Ð¾ÑÑ', 'success');
      } else {
          await patch(`tasks?id=eq.${taskId}`, { assignment_status: 'rejected', comment: comment || 'ÐÑÐºÐ»Ð¾Ð½ÐµÐ½Ð¾ Ð±ÐµÐ· ÐºÐ¾Ð¼Ð¼ÐµÐ½ÑÐ°ÑÐ¸Ñ' }, token!);
          addNotification('ÐÐ°Ð´Ð°Ð½Ð¸Ðµ Ð²Ð¾Ð·Ð²ÑÐ°ÑÐµÐ½Ð¾', 'warning');
      }
      setSaving(false);
      if(activeProject) loadTasks(activeProject.id);
  };
  const updateTaskStatus = async (taskId: number, status: string, comment?: string) => {
    const targetTask = allTasks.find(t => t.id === taskId);
    const currentStatus = targetTask?.status;
    if (currentStatus && !((taskWorkflowTransitions[currentStatus] || []).includes(status))) {
      const localAllowed = taskWorkflowTransitions[currentStatus] || [];
      const localMessage = `ÐÐµÑÐµÑÐ¾Ð´ ${currentStatus} â ${status} Ð·Ð°Ð¿ÑÐµÑÑÐ½ workflow. ÐÐ¾Ð¿ÑÑÑÐ¸Ð¼Ð¾: ${localAllowed.join(', ') || 'Ð½ÐµÑ Ð¿ÐµÑÐµÑÐ¾Ð´Ð¾Ð²'}.`;
      setWorkflowBlockInfo(localMessage);
      addNotification(localMessage, 'warning');
      return;
    }
    // ÐÐ¾Ð·Ð²ÑÐ°Ñ Ð·Ð°Ð´Ð°ÑÐ¸ Ð² "revision" Ð¾Ð±ÑÐ·Ð°Ð½ ÑÐ¾Ð¿ÑÐ¾Ð²Ð¾Ð¶Ð´Ð°ÑÑÑÑ ÐºÐ¾Ð¼Ð¼ÐµÐ½ÑÐ°ÑÐ¸ÐµÐ¼ â
    // Ð¸Ð½Ð°ÑÐµ Ð¸ÑÐ¿Ð¾Ð»Ð½Ð¸ÑÐµÐ»Ñ Ð½Ðµ Ð¿Ð¾Ð½Ð¸Ð¼Ð°ÐµÑ, ÑÑÐ¾ Ð¿ÐµÑÐµÐ´ÐµÐ»ÑÐ²Ð°ÑÑ.
    if (status === 'revision') {
      const note = (comment || '').trim();
      if (!note) {
        const msg = 'Ð§ÑÐ¾Ð±Ñ Ð²ÐµÑÐ½ÑÑÑ Ð·Ð°Ð´Ð°ÑÑ Ð½Ð° Ð´Ð¾ÑÐ°Ð±Ð¾ÑÐºÑ, Ð¾Ð¿Ð¸ÑÐ¸ÑÐµ Ð¿ÑÐ¸ÑÐ¸Ð½Ñ Ð² ÐºÐ¾Ð¼Ð¼ÐµÐ½ÑÐ°ÑÐ¸Ð¸.';
        setWorkflowBlockInfo(msg);
        addNotification(msg, 'warning');
        return;
      }
    }
    if (currentStatus) {
      try {
        const wfRes = await fetch(`${process.env.REACT_APP_RAILWAY_API_URL || ''}/api/orchestrator`, {
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
          const msg = wfData.message || `ÐÐµÑÐµÑÐ¾Ð´ ${currentStatus} â ${status} Ð·Ð°Ð±Ð»Ð¾ÐºÐ¸ÑÐ¾Ð²Ð°Ð½`;
          setWorkflowBlockInfo(msg);
          addNotification(msg, 'warning');
          return;
        }
        setWorkflowBlockInfo("");
      } catch {
        addNotification('ÐÑÐ¾Ð²ÐµÑÐºÐ° workflow Ð½ÐµÐ´Ð¾ÑÑÑÐ¿Ð½Ð°, Ð¿ÑÐ¸Ð¼ÐµÐ½ÑÑ Ð»Ð¾ÐºÐ°Ð»ÑÐ½ÑÐµ Ð¿ÑÐ°Ð²Ð¸Ð»Ð°', 'info');
      }
    }
    setSaving(true);
    await patch(`tasks?id=eq.${taskId}`, { status, ...(comment ? { comment } : {}) }, token!);
    const statusLabel = statusMap[status]?.label || status;
    addNotification(`Ð¡ÑÐ°ÑÑÑ Ð·Ð°Ð´Ð°ÑÐ¸ Ð¸Ð·Ð¼ÐµÐ½ÑÐ½ â "${statusLabel}"`, status === 'done' ? 'success' : 'info');
    // Publish task status change event
    if (activeProject && currentUserData) {
      const metadata = comment ? { comment } : {};
      if (status === 'review' || status === 'in_review') {
        publishTaskSubmittedForReview(String(taskId), String(activeProject.id), String(currentUserData.id), metadata).catch((err) => {
          console.warn('[Events] Failed to publish task.submitted_for_review:', err);
        });
      } else if (status === 'done' || status === 'approved') {
        publishTaskApproved(String(taskId), String(activeProject.id), String(currentUserData.id), metadata).catch((err) => {
          console.warn('[Events] Failed to publish task.approved:', err);
        });
      } else if (status === 'revision') {
        publishTaskReturned(String(taskId), String(activeProject.id), String(currentUserData.id), 'lead', metadata).catch((err) => {
          console.warn('[Events] Failed to publish task.returned:', err);
        });
      }
    }
    // Ð¡Ð¾Ð·Ð´Ð°ÑÐ¼ ÑÐ²ÐµÐ´Ð¾Ð¼Ð»ÐµÐ½Ð¸Ðµ Ð² ÐÐ Ð´Ð»Ñ Ð¸ÑÐ¿Ð¾Ð»Ð½Ð¸ÑÐµÐ»Ñ Ð·Ð°Ð´Ð°ÑÐ¸
    if (targetTask?.assigned_to && targetTask.assigned_to !== currentUserData?.id) {
      createNotification({
        user_id: targetTask.assigned_to,
        project_id: activeProject?.id,
        type: 'task_status',
        title: `Ð¡ÑÐ°ÑÑÑ Ð·Ð°Ð´Ð°ÑÐ¸ Ð¸Ð·Ð¼ÐµÐ½ÑÐ½ â "${statusLabel}"`,
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
    addNotification('Ð§ÐµÑÑÐµÐ¶ Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½ Ð² ÑÐµÐµÑÑÑ', 'success');
    loadDrawings(activeProject.id);
  };
  const updateProjectDrawing = async (id: string, payload: any) => {
    if (!activeProject) return;
    await updateDrawing(id, { ...payload, updated_at: new Date().toISOString() }, token!);
    addNotification('ÐÐ°ÑÑÐ¾ÑÐºÐ° ÑÐµÑÑÐµÐ¶Ð° Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð°', 'info');
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
    addNotification('ÐÐ°Ð¼ÐµÑÐ°Ð½Ð¸Ðµ Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ð¾', 'success');
    loadReviews(activeProject.id);
  };
  const changeReviewStatus = async (reviewId: string, status: string) => {
    if (!activeProject) return;
    await updateReviewStatus(reviewId, status, token!);
    addNotification(`Ð¡ÑÐ°ÑÑÑ Ð·Ð°Ð¼ÐµÑÐ°Ð½Ð¸Ñ Ð¸Ð·Ð¼ÐµÐ½ÑÐ½: ${status}`, 'info');
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
    addNotification('Ð¢ÑÐ°Ð½ÑÐ¼Ð¸ÑÑÐ°Ð» ÑÐ¾Ð·Ð´Ð°Ð½', 'success');
    loadTransmittals(activeProject.id);
  };
  const changeTransmittalStatus = async (transmittalId: string, status: string) => {
    if (!activeProject) return;
    // ÐÐ°ÑÐ¸ÑÐ° Ð¾Ñ Ð²ÑÐ¿ÑÑÐºÐ° Ð½ÐµÐ¿Ð¾Ð´Ð¿Ð¸ÑÐ°Ð½Ð½Ð¾Ð³Ð¾ Ð¼Ð°ÑÐµÑÐ¸Ð°Ð»Ð°: ÐµÑÐ»Ð¸ Ð² ÑÐ¾ÑÑÐ°Ð²Ðµ ÑÑÐ°Ð½ÑÐ¼Ð¸ÑÑÐ°Ð»Ð°
    // ÐµÑÑÑ ÑÐµÑÑÑÐ¶, Ñ ÐºÐ¾ÑÐ¾ÑÐ¾Ð³Ð¾ Ð¾ÑÐºÑÑÑÑ Ð·Ð°Ð¼ÐµÑÐ°Ð½Ð¸Ñ severity='critical' â Ð½Ðµ Ð´Ð°ÑÐ¼
    // Ð¿ÐµÑÐµÐ²ÐµÑÑÐ¸ ÑÑÐ°ÑÑÑ Ð² 'issued', Ð¿Ð¾ÐºÐ° ÑÑÐ¸ Ð·Ð°Ð¼ÐµÑÐ°Ð½Ð¸Ñ Ð½Ðµ Ð·Ð°ÐºÑÑÑÑ.
    if (status === 'issued') {
      try {
        const items = await listTransmittalItems(transmittalId, token!);
        const drawingIds = (Array.isArray(items) ? items : [])
          .map((it: any) => it.drawing_id)
          .filter(Boolean);
        if (drawingIds.length) {
          const inList = drawingIds.map((id: string) => `"${id}"`).join(',');
          const blockers = await get(
            `reviews?select=id,title,drawing_id,severity,status&drawing_id=in.(${inList})&severity=eq.critical&status=eq.open`,
            token!
          );
          if (Array.isArray(blockers) && blockers.length > 0) {
            const titles = blockers.map((r: any) => r.title || `id=${r.id}`).slice(0, 3).join('; ');
            const more = blockers.length > 3 ? ` Ð¸ ÐµÑÑ ${blockers.length - 3}` : '';
            addNotification(
              `ÐÐµÐ»ÑÐ·Ñ Ð²ÑÐ¿ÑÑÑÐ¸ÑÑ ÑÑÐ°Ð½ÑÐ¼Ð¸ÑÑÐ°Ð»: Ð¾ÑÐºÑÑÑÐ¾ ${blockers.length} critical-Ð·Ð°Ð¼ÐµÑÐ°Ð½Ð¸Ðµ(Ð¹): ${titles}${more}.`,
              'warning'
            );
            return;
          }
        }
      } catch (e) {
        // ÐÑÐ»Ð¸ Ð¿ÑÐ¾Ð²ÐµÑÐºÐ° ÑÐ¿Ð°Ð»Ð° â Ð»ÑÑÑÐµ Ð½Ðµ Ð¿ÑÐ¾Ð¿ÑÑÐºÐ°ÑÑ "issued" Ð²ÑÐ»ÐµÐ¿ÑÑ.
        addNotification('ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ Ð¿ÑÐ¾Ð²ÐµÑÐ¸ÑÑ Ð¾ÑÐºÑÑÑÑÐµ critical-Ð·Ð°Ð¼ÐµÑÐ°Ð½Ð¸Ñ, Ð²ÑÐ¿ÑÑÐº Ð¾ÑÐ¼ÐµÐ½ÑÐ½.', 'warning');
        return;
      }
    }
    await updateTransmittalStatus(transmittalId, status, token!);
    addNotification(`Ð¡ÑÐ°ÑÑÑ ÑÑÐ°Ð½ÑÐ¼Ð¸ÑÑÐ°Ð»Ð° Ð¸Ð·Ð¼ÐµÐ½ÑÐ½: ${transmittalStatusMap[status] || status}`, 'info');
    loadTransmittals(activeProject.id);
  };
  const addTransmittalItem = async (transmittalId: string, drawingId?: string, revisionId?: string) => {
    if (!activeProject) return;
    if (!drawingId && !revisionId) {
      addNotification('ÐÑÐ±ÐµÑÐ¸ÑÐµ ÑÐµÑÑÑÐ¶ Ð¸/Ð¸Ð»Ð¸ ÑÐµÐ²Ð¸Ð·Ð¸Ñ Ð´Ð»Ñ Ð¿Ð¾Ð·Ð¸ÑÐ¸Ð¸ ÑÑÐ°Ð½ÑÐ¼Ð¸ÑÑÐ°Ð»Ð°', 'warning');
      return;
    }
    await createTransmittalItem({
      transmittal_id: transmittalId,
      drawing_id: drawingId || null,
      revision_id: revisionId || null,
    }, token!);
    addNotification('ÐÐ¾Ð·Ð¸ÑÐ¸Ñ Ð´Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ð° Ð² ÑÑÐ°Ð½ÑÐ¼Ð¸ÑÑÐ°Ð»', 'success');
    setTransmittalDraftLinks((prev) => ({ ...prev, [transmittalId]: { drawingId: '', revisionId: '' } }));
    loadTransmittals(activeProject.id);
  };
  const assignTask = async (taskId: number, assignedTo: string) => {
    const eng = getUserById(assignedTo);
    await patch(`tasks?id=eq.${taskId}`, { assigned_to: assignedTo, status: "todo" }, token!);
    addNotification(`ÐÐ°Ð´Ð°ÑÐ° Ð½Ð°Ð·Ð½Ð°ÑÐµÐ½Ð° â ${eng?.full_name || 'Ð¸Ð½Ð¶ÐµÐ½ÐµÑ'}`, 'info');
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
    addNotification(`ÐÑÐ¿ÑÑÐµÐ½Ð° ÑÐµÐ²Ð¸Ð·Ð¸Ñ R${newRevNum} Ð´Ð»Ñ Ð·Ð°Ð´Ð°ÑÐ¸ "${task.name}"`, 'success');
    setSaving(false);
    setShowTaskDetail(false);
    loadTasks(activeProject.id);
  };
  // handleLogin: Supabase JS already holds the session after signInWithPassword().
  // onAuthStateChange fires and updates token/userEmail via the auth useEffect above.
  // We only handle navigation and loading state here.
  const handleLogin = async (_accessToken: string, email: string) => {
    setScreen('dashboard');
    if (email !== "admin@enghub.com") setLoading(true);
    else setLoading(false);
  };

  const handleLogout = () => {
    // Sign out from Supabase JS â onAuthStateChange will clear token + userEmail.
    // Clear token immediately too so UI switches to login without waiting for async signOut.
    console.warn('[AUTH] handleLogout called', new Error().stack?.split('\n').slice(1, 4).join(' | '));
    setToken(null);
    setUserEmail('');
    getSupabaseAnonClient().auth.signOut({ scope: 'local' }).catch(() => {});
    setCurrentUserData(null); setProjects([]); setTasks([]); setAllTasks([]); setMsgs([]); setChatInput(""); setTaskComment("");
    setDrawings([]); setRevisions([]); setReviews([]); setTransmittals([]); setTransmittalItems({}); setArchivedProjects([]);
    setSearchQuery(""); setFilterStatus("all"); setFilterPriority("all"); setFilterAssigned("all");
    setActiveProject(null); setScreen('dashboard');
    localStorage.removeItem('enghub_email');
    localStorage.removeItem('enghub_screen'); localStorage.removeItem('enghub_sidetab');
  };

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

  // Wait for Supabase session check before rendering login (prevents login-page flash on reload)
  if (!authReady) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: dark ? '#0f1117' : '#f4f6fa' }}><span style={{ color: '#8896a8', fontSize: 14 }}>ÐÐ°Ð³ÑÑÐ·ÐºÐ°...</span></div>;
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
      if (task.status === "todo") actions.push({ label: "â¶ ÐÐ·ÑÑÑ Ð² ÑÐ°Ð±Ð¾ÑÑ", status: "inprogress", color: C.blue });
      if (task.status === "inprogress") actions.push({ label: "â ÐÑÐ¿ÑÐ°Ð²Ð¸ÑÑ Ð½Ð° Ð¿ÑÐ¾Ð²ÐµÑÐºÑ", status: "review_lead", color: C.accent });
      if (task.status === "revision") actions.push({ label: "â¶ Ð¡Ð½Ð¾Ð²Ð° Ð² ÑÐ°Ð±Ð¾ÑÑ", status: "inprogress", color: C.blue });
      // CONV-Q5 (B): Ð¸Ð½Ð¶ÐµÐ½ÐµÑ ÑÐ°Ð¼ Ð¿Ð¾Ð´ÑÐ²ÐµÑÐ¶Ð´Ð°ÐµÑ Ð²Ð¾Ð·Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ðµ ÑÐ°Ð±Ð¾ÑÑ Ð¿Ð¾ÑÐ»Ðµ Ð¿Ð¾Ð»ÑÑÐµÐ½Ð¸Ñ Ð´Ð°Ð½Ð½ÑÑ
      if (task.status === "awaiting_input") actions.push({ label: "â¶ ÐÐ¾Ð·Ð¾Ð±Ð½Ð¾Ð²Ð¸ÑÑ ÑÐ°Ð±Ð¾ÑÑ (Ð´Ð°Ð½Ð½ÑÐµ Ð¿Ð¾Ð»ÑÑÐµÐ½Ñ)", status: "inprogress", color: C.blue });
    }
    if (isLead) {
      const myEngIds = appUsers.filter(u => u.dept_id === currentUserData?.dept_id && u.role === "engineer").map(u => String(u.id));
      if (myEngIds.includes(assigned) && task.status === "review_lead") { actions.push({ label: "â Ð£ÑÐ²ÐµÑÐ´Ð¸ÑÑ â ÐÐÐÑ", status: "review_gip", color: C.green }); actions.push({ label: "â ÐÐ° Ð´Ð¾ÑÐ°Ð±Ð¾ÑÐºÑ (ÑÐºÐ°Ð¶Ð¸ÑÐµ Ð¿ÑÐ¸ÑÐ¸Ð½Ñ)", status: "revision", color: C.red, requiresReason: true }); }
    }
    if (isGip && task.status === "review_gip") { actions.push({ label: "â ÐÐ°Ð²ÐµÑÑÐ¸ÑÑ Ð·Ð°Ð´Ð°ÑÑ", status: "done", color: C.green }); actions.push({ label: "â ÐÐ° Ð´Ð¾ÑÐ°Ð±Ð¾ÑÐºÑ (ÑÐºÐ°Ð¶Ð¸ÑÐµ Ð¿ÑÐ¸ÑÐ¸Ð½Ñ)", status: "revision", color: C.red, requiresReason: true }); }
    return actions;
  };

  const navItems = [
    { id: "dashboard", icon: "â¬¡", label: "ÐÐ±Ð·Ð¾Ñ" },
    { id: "projects_list", icon: "â", label: "ÐÑÐ¾ÐµÐºÑÑ" },
    { id: "tasks", icon: "â¡", label: "ÐÐ°Ð´Ð°ÑÐ¸" },
    { id: "standards", icon: "â", label: "Ð¡ÑÐ°Ð½Ð´Ð°ÑÑÑ" },
    { id: "specifications", icon: "ð", label: "Ð¡Ð¿ÐµÑÐ¸ÑÐ¸ÐºÐ°ÑÐ¸Ð¸" },
    { id: "normative", icon: "ð", label: "ÐÐ¾ÑÐ¼Ð°ÑÐ¸Ð²ÐºÐ°" },
    { id: "calculations", icon: "â", label: "Ð Ð°ÑÑÑÑÑ" }
  ];

  const screenTitles: Record<string, string> = { dashboard: "Ð Ð°Ð±Ð¾ÑÐ¸Ð¹ ÑÑÐ¾Ð»", project: "ÐÐ°ÑÑÐ¾ÑÐºÐ° Ð¿ÑÐ¾ÐµÐºÑÐ°", projects_list: "Ð ÐµÐµÑÑÑ Ð¿ÑÐ¾ÐµÐºÑÐ¾Ð²", tasks: "ÐÐ¾Ð¸ Ð·Ð°Ð´Ð°ÑÐ¸", standards: "ÐÐ¾Ð¸ÑÐº Ð¡ÑÐ°Ð½Ð´Ð°ÑÑÐ¾Ð²", specifications: "Ð¡Ð¿ÐµÑÐ¸ÑÐ¸ÐºÐ°ÑÐ¸Ð¸", normative: "ÐÐ°Ð·Ð° Ð·Ð½Ð°Ð½Ð¸Ð¹ (ÐÐ¾ÑÐ¼Ð°ÑÐ¸Ð²ÐºÐ°)", calculations: "Ð Ð°ÑÑÑÑÑ" };

  const calcTemplates = Object.values(calcRegistry);
  const calcCatLabels: Record<string, string> = { "Ð¢Ð¥": "Ð¢Ð¥ â Ð¢ÐµÑÐ½Ð¾Ð»Ð¾Ð³Ð¸Ñ", "Ð¢Ð¢": "Ð¢Ð¢ â Ð¢ÐµÐ¿Ð»Ð¾ÑÐµÑÐ½Ð¸ÐºÐ°", "Ð­Ð": "Ð­Ð â Ð­Ð»ÐµÐºÑÑÐ¸ÐºÐ°", "ÐÐ": "ÐÐ â ÐÐ¾Ð´Ð¾ÑÐ½Ð°Ð±Ð¶ÐµÐ½Ð¸Ðµ", "ÐÐ": "ÐÐ â ÐÐ¾Ð¶Ð°ÑÐ½Ð°Ñ Ð±ÐµÐ·Ð¾Ð¿Ð°ÑÐ½Ð¾ÑÑÑ", "Ð": "ÐÐµÐ½Ð¿Ð»Ð°Ð½", "ÐÐ / ÐÐ": "ÐÐ / ÐÐ â ÐÐ¾Ð½ÑÑÑÑÐºÑÐ¸Ð²", "ÐÐÐÐ¸Ð": "ÐÐÐÐ¸Ð", "ÐÐ": "ÐÐ â ÐÑÐ¾Ð¿Ð»ÐµÐ½Ð¸Ðµ Ð¸ Ð²ÐµÐ½ÑÐ¸Ð»ÑÑÐ¸Ñ" };
  const calcAllCats = ["Ð¢Ð¥", "Ð¢Ð¢", "Ð­Ð", "ÐÐ", "ÐÐ", "Ð", "ÐÐ / ÐÐ", "ÐÐÐÐ¸Ð", "ÐÐ"];

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-logo">â¬¡</div>
      <div style={{ color: "#8892a4", fontSize: 14, fontWeight: 500 }}>ÐÐ°Ð³ÑÑÐ·ÐºÐ° EngHub...</div>
    </div>
  );

  return (
    <div className="app-root">
      {/* ===== MODALS ===== */}
      {showNewProject && (
        <Modal title="ÐÐ¾Ð²ÑÐ¹ Ð¿ÑÐ¾ÐµÐºÑ" onClose={() => setShowNewProject(false)} C={C}>
          <div className="form-stack">
            <Field label="ÐÐÐÐÐÐÐÐ *" C={C}><input value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} placeholder="Ð¢Ð­Ð¦-6 Ð¡ÑÑÐ¾Ð¸ÑÐµÐ»ÑÑÑÐ²Ð¾" style={getInp(C)} /></Field>
            <Field label="ÐÐÐ ÐÐ ÐÐÐÐ¢Ð *" C={C}><input value={newProject.code} onChange={e => setNewProject({ ...newProject, code: e.target.value })} placeholder="Ð¢Ð­Ð¦-2025-01" style={getInp(C)} /></Field>
            <Field label="ÐÐ¢ÐÐÐÐ« *" C={C}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                {depts.map(d => (
                  <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text, cursor: 'pointer' }}>
                    <input type="checkbox" checked={newProject.depts?.includes(d.id)} onChange={() => toggleProjectDept(d.id)} />
                    {d.name}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="ÐÐÐÐÐÐÐ" C={C}><RuDateInput value={newProject.deadline} onChange={v => setNewProject({ ...newProject, deadline: v })} C={C} /></Field>
            <Field label="Ð¡Ð¢ÐÐ¢Ð£Ð¡" C={C}><select value={newProject.status} onChange={e => setNewProject({ ...newProject, status: e.target.value })} style={getInp(C)}><option value="active">Ð ÑÐ°Ð±Ð¾ÑÐµ</option><option value="review">ÐÐ° Ð¿ÑÐ¾Ð²ÐµÑÐºÐµ</option></select></Field>
            <Field label="ÐÐÐÐÐÐÐ ÐÐ ÐÐ ÐÐÐÐ¢ÐÐ ÐÐÐÐÐÐ (Ð½ÐµÐ¾Ð±ÑÐ·Ð°ÑÐµÐ»ÑÐ½Ð¾)" C={C}>
              <input
                ref={tzFileRef}
                type="file"
                accept=".pdf"
                style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: '6px 8px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const }}
              />
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>PDF â Ð±ÑÐ´ÐµÑ Ð°Ð²ÑÐ¾Ð¼Ð°ÑÐ¸ÑÐµÑÐºÐ¸ ÑÐ°Ð·Ð¾Ð±ÑÐ°Ð½ Ð½Ð° ÑÐ°Ð·Ð´ÐµÐ»Ñ</div>
            </Field>
            <button className="btn btn-primary" onClick={createProject} disabled={saving || !newProject.name || !newProject.code} style={{ width: "100%", opacity: (!newProject.name || !newProject.code) ? 0.5 : 1 }}>{saving ? "Ð¡Ð¾Ð·Ð´Ð°ÑÑÑÑ..." : "Ð¡Ð¾Ð·Ð´Ð°ÑÑ Ð¿ÑÐ¾ÐµÐºÑ"}</button>
          </div>
        </Modal>
      )}
      {showReportPDF && activeProject && (
        <ProjectReportPDF
          data={{ project: activeProject, tasks: allTasks, drawings, reviews, transmittals, appUsers }}
          onClose={() => setShowReportPDF(false)}
        />
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
        <Modal title="ÐÐ¾Ð²Ð°Ñ Ð·Ð°Ð´Ð°ÑÐ°" onClose={() => { setShowNewTask(false); setNewTask({ name: "", dept_id: "", priority: "medium", deadline: "", assigned_to: "", drawing_id: "", description: "" }); setTaskSuggest(null); }} C={C}>
          <div className="form-stack">
            <button
              type="button"
              onClick={() => setShowTaskTemplates(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: C.accent, fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
            >
              ð ÐÑÐ±ÑÐ°ÑÑ Ð¸Ð· ÑÐ°Ð±Ð»Ð¾Ð½Ð°
            </button>
            <Field label="ÐÐÐÐÐÐÐÐ *" C={C}><input value={newTask.name} onChange={e => setNewTask({ ...newTask, name: e.target.value })} placeholder="Ð Ð°ÑÑÑÑ Ð½Ð°Ð³ÑÑÐ·Ð¾Ðº" style={getInp(C)} /></Field>
            <Field label="ÐÐÐÐ¡ÐÐÐÐ" C={C}><textarea value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} placeholder="ÐÐ¾Ð´ÑÐ¾Ð±Ð½Ð¾Ðµ Ð¾Ð¿Ð¸ÑÐ°Ð½Ð¸Ðµ Ð·Ð°Ð´Ð°ÑÐ¸..." rows={3} style={{ ...getInp(C), resize: 'vertical', fontFamily: 'inherit' }} /></Field>
            <Field label="ÐÐÐÐÐÐ§ÐÐ¢Ð¬ Ð Ð£ÐÐÐÐÐÐÐ¢ÐÐÐ®" C={C}><select value={newTask.assigned_to} onChange={e => { const lead = appUsers.find(u => String(u.id) === e.target.value); setNewTask({ ...newTask, assigned_to: e.target.value, dept_id: lead?.dept_id || "" }); }} style={getInp(C)}><option value="">â ÐÑÐ±ÑÐ°ÑÑ â</option>{myLeads.map(u => <option key={u.id} value={u.id}>{u.full_name} ({getDeptName(u.dept_id)})</option>)}</select></Field>
            <Field label="Ð§ÐÐ Ð¢ÐÐ (ÐÐÐ¦ÐÐÐÐÐÐ¬ÐÐ)" C={C}>
              <select value={newTask.drawing_id} onChange={e => setNewTask({ ...newTask, drawing_id: e.target.value })} style={getInp(C)}>
                <option value="">â ÐÐµÐ· Ð¿ÑÐ¸Ð²ÑÐ·ÐºÐ¸ â</option>
                {drawings.map(d => <option key={d.id} value={d.id}>{d.code} â {d.title}</option>)}
              </select>
            </Field>
            <Field label="ÐÐ ÐÐÐ ÐÐ¢ÐÐ¢" C={C}><select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })} style={getInp(C)}><option value="high">ð´ ÐÑÑÐ¾ÐºÐ¸Ð¹</option><option value="medium">ð¡ Ð¡ÑÐµÐ´Ð½Ð¸Ð¹</option><option value="low">âª ÐÐ¸Ð·ÐºÐ¸Ð¹</option></select></Field>
            <Field label="ÐÐÐÐÐÐÐ" C={C}><RuDateInput value={newTask.deadline} onChange={v => setNewTask({ ...newTask, deadline: v })} C={C} /></Field>
            {taskSuggestLoading && (
              <div style={{ fontSize: 12, color: C.accent, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: `2px solid ${C.accent}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                AI Ð¿Ð¾Ð´Ð±Ð¸ÑÐ°ÐµÑ Ð´ÐµÐ´Ð»Ð°Ð¹Ð½â¦
              </div>
            )}
            {taskSuggest && !taskSuggestLoading && (
              <div style={{ background: C.accent + '12', border: `1px solid ${C.accent}30`, borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>ð¤</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.accent }}>AI Ð¿ÑÐµÐ´Ð»Ð°Ð³Ð°ÐµÑ Ð´ÐµÐ´Ð»Ð°Ð¹Ð½: {taskSuggest.deadline}</div>
                  {taskSuggest.reason && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{taskSuggest.reason}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => { setNewTask(prev => ({ ...prev, deadline: taskSuggest.deadline! })); setTaskSuggest(null); }}
                  style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                >
                  ÐÑÐ¸Ð¼ÐµÐ½Ð¸ÑÑ
                </button>
              </div>
            )}
            <button className="btn btn-primary" onClick={createTask} disabled={saving || !newTask.name || !newTask.deadline} style={{ width: "100%", opacity: (!newTask.name || !newTask.deadline) ? 0.5 : 1 }}>{saving ? "Ð¡Ð¾Ð·Ð´Ð°ÑÑÑÑ..." : "Ð¡Ð¾Ð·Ð´Ð°ÑÑ Ð·Ð°Ð´Ð°ÑÑ"}</button>
          </div>
        </Modal>
      )}
      {showNewAssignment && (
        <Modal title="ÐÐ°Ð´Ð°Ð½Ð¸Ðµ ÑÐ¼ÐµÐ¶Ð½Ð¸ÐºÑ" onClose={() => setShowNewAssignment(false)} C={C}>
          <div className="form-stack">
            <Field label="Ð¡Ð£Ð¢Ð¬ ÐÐÐÐÐÐÐ¯ *" C={C}><input value={newAssignment.name} onChange={e => setNewAssignment({ ...newAssignment, name: e.target.value })} placeholder="ÐÑÐ´Ð°ÑÑ Ð½Ð°Ð³ÑÑÐ·ÐºÐ¸ Ð½Ð° ÑÑÐ½Ð´Ð°Ð¼ÐµÐ½Ñ..." style={getInp(C)} /></Field>
            <Field label="ÐÐ¢ÐÐÐ-ÐÐÐÐ£Ð§ÐÐ¢ÐÐÐ¬ *" C={C}>
              <select value={newAssignment.target_dept} onChange={e => setNewAssignment({ ...newAssignment, target_dept: e.target.value })} style={getInp(C)}>
                <option value="">â ÐÑÐ±ÑÐ°ÑÑ Ð¾ÑÐ´ÐµÐ» â</option>
                {(() => {
                  // BUG-2 fix: fallback Ð½Ð° Ð²ÑÐµ Ð¾ÑÐ´ÐµÐ»Ñ, ÐµÑÐ»Ð¸ Ð¿ÑÐ¾ÐµÐºÑÐ½ÑÐ¹ ÑÐ¿Ð¸ÑÐ¾Ðº Ð¿ÑÑÑ.
                  const projectDeptIds: number[] = (activeProject?.depts || []).filter((d:number) => String(d) !== String(currentUserData?.dept_id));
                  const fallback: number[] = depts.map((d:any) => Number(d.id)).filter((id:number) => String(id) !== String(currentUserData?.dept_id));
                  const list: number[] = projectDeptIds.length > 0 ? projectDeptIds : fallback;
                  return list.map((dId: number) => <option key={dId} value={dId}>{getDeptNameById(dId)}</option>);
                })()}
              </select>
            </Field>
            <Field label="ÐÐ ÐÐÐ ÐÐ¢ÐÐ¢" C={C}><select value={newAssignment.priority} onChange={e => setNewAssignment({ ...newAssignment, priority: e.target.value })} style={getInp(C)}><option value="high">ð´ ÐÑÑÐ¾ÐºÐ¸Ð¹</option><option value="medium">ð¡ Ð¡ÑÐµÐ´Ð½Ð¸Ð¹</option><option value="low">âª ÐÐ¸Ð·ÐºÐ¸Ð¹</option></select></Field>
            <Field label="Ð¢Ð ÐÐÐ£ÐÐÐ«Ð ÐÐÐÐÐÐÐ" C={C}><RuDateInput value={newAssignment.deadline} onChange={v => setNewAssignment({ ...newAssignment, deadline: v })} C={C} /></Field>
            <button className="btn btn-primary" onClick={createAssignment} disabled={saving || !newAssignment.name || !newAssignment.target_dept} style={{ width: "100%", opacity: (!newAssignment.name || !newAssignment.target_dept) ? 0.5 : 1 }}>{saving ? "ÐÑÐ¿ÑÐ°Ð²ÐºÐ°..." : "ÐÑÐ¿ÑÐ°Ð²Ð¸ÑÑ Ð·Ð°Ð´Ð°Ð½Ð¸Ðµ"}</button>
          </div>
        </Modal>
      )}
      {showDepRequest && selectedTask && (
        <Modal title="ÐÐ°Ð¿ÑÐ¾Ñ Ð´Ð°Ð½Ð½ÑÑ Ñ ÑÐ¼ÐµÐ¶Ð½Ð¾Ð³Ð¾ Ð¾ÑÐ´ÐµÐ»Ð°" onClose={() => setShowDepRequest(false)} C={C} topmost>
          <div className="form-stack">
            <div style={{ background: "rgba(6,182,212,.08)", border: "1px solid rgba(6,182,212,.3)", borderRadius: 8, padding: 10, fontSize: 12.5, color: C.textDim, marginBottom: 4 }}>
              â¹ Ð¢ÐµÐºÑÑÐ°Ñ Ð·Ð°Ð´Ð°ÑÐ° <b>Â«{selectedTask.name}Â»</b> Ð¿ÐµÑÐµÐ²ÐµÐ´ÑÑÑÑ Ð² ÑÑÐ°ÑÑÑ <b>Â«ÐÐ´ÑÑ Ð´Ð°Ð½Ð½ÑÑÂ»</b>. ÐÐ¾ÑÐ»Ðµ Ð¿Ð¾Ð»ÑÑÐµÐ½Ð¸Ñ Ð´Ð°Ð½Ð½ÑÑ Ð²ÐµÑÐ½ÑÑÑÑ Ðº ÑÐµÐ±Ðµ ÐºÐ½Ð¾Ð¿ÐºÐ¾Ð¹ Â«ÐÐ¾Ð·Ð¾Ð±Ð½Ð¾Ð²Ð¸ÑÑ ÑÐ°Ð±Ð¾ÑÑÂ».
            </div>
            <Field label="ÐÐ¢ÐÐÐ-ÐÐÐÐ£Ð§ÐÐ¢ÐÐÐ¬ *" C={C}>
              <select value={depRequest.target_dept_id} onChange={e => setDepRequest({ ...depRequest, target_dept_id: e.target.value })} style={getInp(C)}>
                <option value="">â ÐÑÐ±ÑÐ°ÑÑ Ð¾ÑÐ´ÐµÐ» â</option>
                {(() => {
                  // BUG-2 fix: ÐµÑÐ»Ð¸ Ð² Ð¿ÑÐ¾ÐµÐºÑÐµ Ð¼Ð°Ð»Ð¾ Ð¾ÑÐ´ÐµÐ»Ð¾Ð² (Ð¸Ð»Ð¸ ÑÐ¾Ð²Ð¿Ð°Ð´Ð°ÐµÑ Ñ Ð¼Ð¾Ð¸Ð¼), Ð¿Ð°Ð´Ð°ÐµÐ¼ Ð½Ð° Ð²ÑÐµ Ð¾ÑÐ´ÐµÐ»Ñ.
                  const projectDeptIds: number[] = (activeProject?.depts || []).filter((d:number) => String(d) !== String(currentUserData?.dept_id));
                  const fallback: number[] = depts.map((d:any) => Number(d.id)).filter((id:number) => String(id) !== String(currentUserData?.dept_id));
                  const list: number[] = projectDeptIds.length > 0 ? projectDeptIds : fallback;
                  return list.map((dId: number) => <option key={dId} value={dId}>{getDeptNameById(dId)}</option>);
                })()}
              </select>
            </Field>
            <Field label="Ð§Ð¢Ð ÐÐ£ÐÐÐ ÐÐÐÐ£Ð§ÐÐ¢Ð¬ *" C={C}>
              <textarea value={depRequest.what_needed} onChange={e => setDepRequest({ ...depRequest, what_needed: e.target.value })} placeholder="ÐÐ°Ð¿ÑÐ¸Ð¼ÐµÑ: ÐÐ°Ð³ÑÑÐ·ÐºÐ¸ Ð½Ð° ÑÑÐ½Ð´Ð°Ð¼ÐµÐ½Ñ Ð¿Ð¾ Ð¾ÑÑÐ¼ 1-5, ÑÐ¾Ð³Ð»Ð°ÑÐ¾Ð²Ð°Ð½Ð½ÑÐ¹ Ð¿Ð»Ð°Ð½..." style={{ ...getInp(C), minHeight: 80, fontFamily: "inherit", resize: "vertical" }} />
            </Field>
            <Field label="ÐÐÐÐÐÐÐ«Ð Ð¡Ð ÐÐ (Ð½ÐµÐ¾Ð±ÑÐ·Ð°ÑÐµÐ»ÑÐ½Ð¾)" C={C}><RuDateInput value={depRequest.deadline_hint} onChange={v => setDepRequest({ ...depRequest, deadline_hint: v })} C={C} /></Field>
            <button className="btn btn-primary" onClick={requestDependencyData} disabled={saving || !depRequest.target_dept_id || depRequest.what_needed.trim().length < 5} style={{ width: "100%", opacity: (!depRequest.target_dept_id || depRequest.what_needed.trim().length < 5) ? 0.5 : 1 }}>{saving ? "ÐÑÐ¿ÑÐ°Ð²ÐºÐ°..." : "ð ÐÑÐ¿ÑÐ°Ð²Ð¸ÑÑ Ð·Ð°Ð¿ÑÐ¾Ñ"}</button>
          </div>
        </Modal>
      )}
      {showTaskDetail && selectedTask && (
        <Modal title="ÐÐ°Ð´Ð°ÑÐ°" onClose={() => { setShowTaskDetail(false); setSelectedTask(null); setTaskComment(""); setWorkflowBlockInfo(""); setChatInput(""); loadMessages(activeProject.id); }} C={C}>
          <div className="form-stack">
            <div style={{ background: C.surface2, borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: C.text }}>{selectedTask.name}</div>
                <div title={`Ð ÐµÐ²Ð¸Ð·Ð¸Ñ ${selectedTask.revision_num || 0}`} style={{ background: C.accent + '20', color: C.accent, fontWeight: 700, fontSize: 12, padding: '3px 8px', borderRadius: 6, cursor: 'help' }}>R{selectedTask.revision_num || 0}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                <BadgeComp status={selectedTask.status} C={C} />
                <PriorityDot p={selectedTask.priority} C={C} />
                {selectedTask.dept && <span style={{ fontSize: 11, color: C.textMuted, background: C.surface, padding: "3px 8px", borderRadius: 6 }}>{selectedTask.dept}</span>}
                {selectedTask.drawing_id && (() => {
                  const d = drawings.find(dr => String(dr.id) === String(selectedTask.drawing_id));
                  return d ? <span style={{ fontSize: 11, color: C.textMuted, background: C.surface, padding: "3px 8px", borderRadius: 6 }}>ð {d.code}</span> : null;
                })()}
                {selectedTask.deadline && <span style={{ fontSize: 11, color: (() => { const dl = parseDeadline(selectedTask.deadline); return dl && dl < new Date() ? C.red : C.textMuted; })() }}>Ð´Ð¾ {formatDateRu(selectedTask.deadline)}</span>}
              </div>
            </div>
            {selectedTask.parent_task_id && (
              <div style={{ fontSize: 11, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                ð ÐÑÐµÐ´ÑÐ´ÑÑÐ°Ñ ÑÐµÐ²Ð¸Ð·Ð¸Ñ: <span style={{ color: C.accent, cursor: 'pointer' }} onClick={() => { const p = allTasks.find(t => t.id === selectedTask.parent_task_id); if (p) setSelectedTask(p); }}>#{String(selectedTask.parent_task_id).slice(0, 4)}</span>
              </div>
            )}
            {(() => {
              if (!selectedTask.assigned_to) return <div style={{ fontSize: 12, color: C.textMuted }}>ð¤ ÐÑÐ¿Ð¾Ð»Ð½Ð¸ÑÐµÐ»Ñ Ð½Ðµ Ð½Ð°Ð·Ð½Ð°ÑÐµÐ½</div>;
              const u = getUserById(selectedTask.assigned_to);
              if (u) return (<div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><AvatarComp user={u} size={28} C={C} /><span style={{ color: C.textDim, fontWeight: 500 }}>{u.full_name}</span><span style={{ fontSize: 11, color: C.textMuted }}>{u.position || roleLabels[u.role]}</span></div>);
              return <div style={{ fontSize: 12, color: C.textMuted }}>ð¤ ÐÑÐ¿Ð¾Ð»Ð½Ð¸ÑÐµÐ»Ñ: ID {String(selectedTask.assigned_to).slice(0, 8)}â¦</div>;
            })()}
            {selectedTask.drawing_id && (() => {
              const d = drawings.find(dr => String(dr.id) === String(selectedTask.drawing_id));
              return d ? (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, fontSize: 12 }}>
                  <div style={{ color: C.textMuted, marginBottom: 4 }}>Ð¡Ð²ÑÐ·Ð°Ð½Ð½ÑÐ¹ ÑÐµÑÑÐµÐ¶</div>
                  <div style={{ color: C.text, fontWeight: 600 }}>{d.code} â {d.title}</div>
                  <div style={{ color: C.textMuted, marginTop: 2 }}>Ð ÐµÐ²Ð¸Ð·Ð¸Ñ: {d.revision || 'R0'} Â· Ð¡ÑÐ°ÑÑÑ: {d.status || 'draft'}</div>
                </div>
              ) : null;
            })()}
            {selectedTask.description && (<div style={{ background: C.surface2, borderRadius: 10, padding: 14 }}><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>ÐÐ¿Ð¸ÑÐ°Ð½Ð¸Ðµ</div><div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6 }}>{selectedTask.description}</div></div>)}
            {selectedTask.comment && (<div style={{ background: C.red + "10", border: `1px solid ${C.red}25`, borderRadius: 10, padding: 14 }}><div style={{ fontSize: 10, color: C.red, fontWeight: 600, marginBottom: 4 }}>ÐÐÐÐÐÐÐ¢ÐÐ ÐÐ Ð ÐÐÐ ÐÐÐÐ¢ÐÐ</div><div style={{ fontSize: 13, color: C.textDim }}>{selectedTask.comment}</div></div>)}
            {workflowBlockInfo && (
              <div style={{ background: C.red + "12", border: `1px solid ${C.red}30`, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginBottom: 4 }}>ÐÐÐÐÐÐ ÐÐÐÐ WORKFLOW</div>
                <div style={{ fontSize: 12, color: C.textDim }}>{workflowBlockInfo}</div>
              </div>
            )}
            {isLead && selectedTask.status === "todo" && String(selectedTask.assigned_to) === String(currentUserData?.id) && (
              <Field label="ÐÐÐÐÐÐ§ÐÐ¢Ð¬ ÐÐÐÐÐÐÐ Ð£" C={C}><select onChange={e => { if (e.target.value) assignTask(selectedTask.id, e.target.value); }} defaultValue="" style={getInp(C)}><option value="">â ÐÑÐ±ÑÐ°ÑÑ Ð¸Ð½Ð¶ÐµÐ½ÐµÑÐ° â</option>{myEngineers.map(u => <option key={u.id} value={u.id}>{u.full_name} â {getEngLoad(u.id)}% Ð·Ð°Ð³ÑÑÐ·ÐºÐ°</option>)}</select></Field>
            )}
            {isLead && (<Field label="ÐÐ ÐÐÐ ÐÐ¢ÐÐ¢" C={C}><select value={selectedTask.priority} onChange={async e => { await patch(`tasks?id=eq.${selectedTask.id}`, { priority: e.target.value }, token!); setSelectedTask({ ...selectedTask, priority: e.target.value }); if (activeProject) loadTasks(activeProject.id); }} style={getInp(C)}><option value="high">ð´ ÐÑÑÐ¾ÐºÐ¸Ð¹</option><option value="medium">ð¡ Ð¡ÑÐµÐ´Ð½Ð¸Ð¹</option><option value="low">âª ÐÐ¸Ð·ÐºÐ¸Ð¹</option></select></Field>)}
            {(isLead || isGip) && (
              <Field label="Ð¡ÐÐ¯ÐÐÐÐÐ«Ð Ð§ÐÐ Ð¢ÐÐ" C={C}>
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
                  <option value="">â ÐÐµÐ· Ð¿ÑÐ¸Ð²ÑÐ·ÐºÐ¸ â</option>
                  {drawings.map((d) => <option key={d.id} value={d.id}>{d.code} â {d.title}</option>)}
                </select>
              </Field>
            )}
            {isGip && (
              <Field label="Ð¡Ð¢ÐÐ¢Ð£Ð¡ ÐÐÐÐÐ§Ð (ÐÐÐ)" C={C}>
                <select value={selectedTask.status} onChange={async e => {
                  const newStatus = e.target.value;
                  await patch(`tasks?id=eq.${selectedTask.id}`, { status: newStatus }, token!);
                  setSelectedTask({ ...selectedTask, status: newStatus });
                  if (activeProject) loadTasks(activeProject.id);
                  addNotification(`Ð¡ÑÐ°ÑÑÑ Ð·Ð°Ð´Ð°ÑÐ¸ â "${statusMap[newStatus]?.label || newStatus}"`, 'info');
                }} style={getInp(C)}>
                  <option value="todo">Ð Ð¾ÑÐµÑÐµÐ´Ð¸</option>
                  <option value="inprogress">Ð ÑÐ°Ð±Ð¾ÑÐµ</option>
                  <option value="awaiting_input">ÐÐ´ÑÑ Ð´Ð°Ð½Ð½ÑÑ</option>
                  <option value="review_lead">ÐÐ° Ð¿ÑÐ¾Ð²ÐµÑÐºÐµ</option>
                  <option value="review_gip">ÐÑÐ¾Ð²ÐµÑÐºÐ° ÐÐÐÐ°</option>
                  <option value="revision">ÐÐ¾ÑÐ°Ð±Ð¾ÑÐºÐ°</option>
                  <option value="done">ÐÐ°Ð²ÐµÑÑÐµÐ½Ð°</option>
                </select>
              </Field>
            )}
            {/* CONV Stage 4b: Ð·Ð°Ð¿ÑÐ¾ÑÐ¸ÑÑ Ð´Ð°Ð½Ð½ÑÐµ Ñ ÑÐ¼ÐµÐ¶Ð½Ð¾Ð³Ð¾ Ð¾ÑÐ´ÐµÐ»Ð° (Ð¿Ð¾ ÑÑÐµÐ±Ð¾Ð²Ð°Ð½Ð¸Ñ) */}
            {isEng && String(selectedTask.assigned_to) === String(currentUserData?.id) &&
              (selectedTask.status === "inprogress" || selectedTask.status === "todo") && (
              <button
                onClick={() => setShowDepRequest(true)}
                disabled={saving}
                style={{
                  background: "rgba(6,182,212,.1)",
                  border: "1px solid rgba(6,182,212,.4)",
                  color: "#06b6d4",
                  borderRadius: 10,
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  marginBottom: 8,
                }}
              >
                ð ÐÐ°Ð¿ÑÐ¾ÑÐ¸ÑÑ Ð´Ð°Ð½Ð½ÑÐµ Ñ ÑÐ¼ÐµÐ¶Ð½Ð¾Ð³Ð¾ Ð¾ÑÐ´ÐµÐ»Ð°
              </button>
            )}
            {getTaskActions(selectedTask).length > 0 && (
              <div>
                <div className="field-label" style={{ marginBottom: 8 }}>ÐÐÐÐ¡Ð¢ÐÐÐ¯</div>
                {(selectedTask.status === "review_lead" || selectedTask.status === "review_gip") && (<div style={{ marginBottom: 10 }}><div className="field-label" style={{ marginBottom: 6 }}>ÐÐÐÐÐÐÐ¢ÐÐ ÐÐ ÐÐ Ð ÐÐÐ ÐÐÐÐ¢ÐÐ</div><input value={taskComment} onChange={e => setTaskComment(e.target.value)} placeholder="Ð§ÑÐ¾ Ð½ÑÐ¶Ð½Ð¾ Ð¸ÑÐ¿ÑÐ°Ð²Ð¸ÑÑ..." style={getInp(C)} /></div>)}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {getTaskActions(selectedTask).map((action: any, i: number) => {
                    // CONV-Q5: ÐµÑÐ»Ð¸ ÑÑÐµÐ±ÑÐµÑÑÑ Ð¿ÑÐ¸ÑÐ¸Ð½Ð° (revision) â ÐºÐ½Ð¾Ð¿ÐºÐ° disabled Ð¿Ð¾ÐºÐ° comment Ð¿ÑÑÑÐ¾Ð¹
                    const needsReason = action.requiresReason && (!taskComment || taskComment.trim().length < 5);
                    return (
                    <button key={i} onClick={() => {
                      if (action.requiresReason && (!taskComment || taskComment.trim().length < 5)) {
                        alert("Ð£ÐºÐ°Ð¶Ð¸ÑÐµ Ð¿ÑÐ¸ÑÐ¸Ð½Ñ Ð²Ð¾Ð·Ð²ÑÐ°ÑÐ° Ð½Ð° Ð´Ð¾ÑÐ°Ð±Ð¾ÑÐºÑ (Ð¼Ð¸Ð½Ð¸Ð¼ÑÐ¼ 5 ÑÐ¸Ð¼Ð²Ð¾Ð»Ð¾Ð²)");
                        return;
                      }
                      updateTaskStatus(selectedTask.id, action.status, taskComment);
                    }} disabled={saving || needsReason}
                      title={needsReason ? "Ð¡Ð½Ð°ÑÐ°Ð»Ð° ÑÐºÐ°Ð¶Ð¸ÑÐµ Ð¿ÑÐ¸ÑÐ¸Ð½Ñ Ð² Ð¿Ð¾Ð»Ðµ Â«ÐÐ¾Ð¼Ð¼ÐµÐ½ÑÐ°ÑÐ¸Ð¹ Ð¿ÑÐ¸ Ð´Ð¾ÑÐ°Ð±Ð¾ÑÐºÐµÂ» Ð²ÑÑÐµ" : ""}
                      style={{ background: action.color + "15", border: `1px solid ${action.color}30`, color: action.color, borderRadius: 10, padding: "11px", cursor: needsReason ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", opacity: needsReason ? 0.5 : 1 }}>{action.label}</button>
                    );
                  })}
                  {getTaskActions(selectedTask).length > 0 && (
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      {getTaskActions(selectedTask).every((a: any) => isTransitionAllowed(selectedTask, a.status))
                        ? 'â ÐÑÐµ Ð´Ð¾ÑÑÑÐ¿Ð½ÑÐµ ÐºÐ½Ð¾Ð¿ÐºÐ¸ ÑÐ¾Ð¾ÑÐ²ÐµÑÑÑÐ²ÑÑÑ workflow.'
                        : 'â  ÐÑÑÑ Ð´ÐµÐ¹ÑÑÐ²Ð¸Ñ Ð²Ð½Ðµ workflow. ÐÑÐ¾Ð²ÐµÑÑÑÐµ Ð¿ÐµÑÐµÑÐ¾Ð´Ñ.'}
                    </div>
                  )}
                  {isGip && selectedTask.status === "done" && (
                    <button onClick={() => issueRevision(selectedTask)} disabled={saving}
                      style={{ background: C.accent + "15", border: `1px dashed ${C.accent}`, color: C.accent, borderRadius: 10, padding: "11px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", marginTop: 8 }}>â¡ ÐÑÐ¿ÑÑÑÐ¸ÑÑ Ð½Ð¾Ð²ÑÑ ÑÐµÐ²Ð¸Ð·Ð¸Ñ (R{(selectedTask.revision_num || 0) + 1})</button>
                  )}
                </div>
              </div>
            )}
            
            {/* T30e: Ð¿ÑÐ¸ÐºÑÐµÐ¿Ð»ÐµÐ½Ð¸Ñ Ðº Ð·Ð°Ð´Ð°ÑÐµ */}
            {activeProject && (
              <TaskAttachments
                C={C}
                projectId={activeProject.id}
                taskId={selectedTask.id}
                currentUserId={currentUserData?.id || 0}
                token={token!}
                canEdit={isGip || isLead || (currentUserData && String(selectedTask.assigned_to) === String(currentUserData.id))}
              />
            )}

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>ÐÐ°Ð¼ÐµÑÐ°Ð½Ð¸Ñ Ð¸ Ð¾Ð±ÑÑÐ¶Ð´ÐµÐ½Ð¸Ðµ</div>
              <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', height: 250 }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {msgs.filter(m => String(m.task_id) === String(selectedTask.id)).length === 0 && <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 12, marginTop: 40 }}>ÐÐ¾ÐºÐ° Ð½ÐµÑ Ð·Ð°Ð¼ÐµÑÐ°Ð½Ð¸Ð¹</div>}
                  {msgs.filter(m => String(m.task_id) === String(selectedTask.id)).map(m => {
                    const mu = getUserById(m.user_id);
                    return (
                      <div key={m.id} style={{ alignSelf: mu?.id === currentUserData?.id ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2, justifyContent: mu?.id === currentUserData?.id ? 'flex-end' : 'flex-start' }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: C.textDim }}>{mu?.full_name?.split(' ')[0]}</span>
                          <span style={{ fontSize: 9, color: C.textMuted }}>{new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ background: mu?.id === currentUserData?.id ? C.accent : C.surface2, color: mu?.id === currentUserData?.id ? '#fff' : C.text, padding: '8px 12px', borderRadius: 10, fontSize: 13 }}>{m.text}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: 10, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
                  {/* FIX: use taskComment state (not chatInput) so task comments don't conflict with conference chat */}
                  <input value={taskComment} onChange={e => setTaskComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && taskComment.trim()) { sendTaskComment(selectedTask.id, taskComment); setTaskComment(''); } }} placeholder="ÐÐ°Ð¿Ð¸ÑÐ°ÑÑ Ð·Ð°Ð¼ÐµÑÐ°Ð½Ð¸Ðµ..." style={{ ...getInp(C), borderRadius: 8, height: 36, fontSize: 12 }} />
                  <button onClick={() => { if (taskComment.trim()) { sendTaskComment(selectedTask.id, taskComment); setTaskComment(''); } }} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer' }}>â</button>
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
                  ð {showTaskHistory ? 'Ð¡ÐºÑÑÑÑ Ð¸ÑÑÐ¾ÑÐ¸Ñ' : 'ÐÑÑÐ¾ÑÐ¸Ñ Ð¸Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ð¹'}
                </button>
                {showTaskHistory && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {taskHistory.length === 0
                      ? <div style={{ fontSize: 12, color: C.textMuted, padding: '6px 0' }}>ÐÐ·Ð¼ÐµÐ½ÐµÐ½Ð¸Ð¹ Ð¿Ð¾ÐºÐ° Ð½ÐµÑ</div>
                      : taskHistory.map(h => {
                          const FIELD_LABELS: Record<string, string> = { status: 'Ð¡ÑÐ°ÑÑÑ', priority: 'ÐÑÐ¸Ð¾ÑÐ¸ÑÐµÑ', assigned_to: 'ÐÑÐ¿Ð¾Ð»Ð½Ð¸ÑÐµÐ»Ñ', deadline: 'ÐÐµÐ´Ð»Ð°Ð¹Ð½', comment: 'ÐÐ¾Ð¼Ð¼ÐµÐ½ÑÐ°ÑÐ¸Ð¹' };
                          const STATUS_RU: Record<string, string> = { todo: 'Ð Ð¾ÑÐµÑÐµÐ´Ð¸', inprogress: 'Ð ÑÐ°Ð±Ð¾ÑÐµ', awaiting_input: 'ÐÐ´ÑÑ Ð´Ð°Ð½Ð½ÑÑ', review_lead: 'ÐÑÐ¾Ð²ÐµÑÐºÐ°', review_gip: 'ÐÑÐ¾Ð²ÐµÑÐºÐ° ÐÐÐÐ°', revision: 'ÐÐ¾ÑÐ°Ð±Ð¾ÑÐºÐ°', done: 'ÐÐ¾ÑÐ¾Ð²Ð¾' };
                          const STATUS_EMOJI: Record<string, string> = { todo: 'â³', inprogress: 'â¶', awaiting_input: 'ð', review_lead: 'ð', review_gip: 'ð', revision: 'â©', done: 'â' };
                          const fmt = (v: string, field: string) => {
                            if (field === 'status') return `${STATUS_EMOJI[v]||''} ${STATUS_RU[v] || v}`.trim();
                            if (field === 'assigned_to') return getUserById(Number(v))?.full_name || `#${v}`;
                            return v || 'â';
                          };
                          const actor = h.changed_by ? (getUserById(Number(h.changed_by))?.full_name || `#${h.changed_by}`) : '';
                          const isRevisionReturn = h.field_name === 'status' && h.new_value === 'revision';
                          return (
                            <div key={h.id} style={{ fontSize: 12, color: C.textMuted, padding: '6px 0', borderBottom: `1px solid ${C.border}`, background: isRevisionReturn ? 'rgba(239,68,68,.05)' : 'transparent', borderLeft: isRevisionReturn ? '2px solid rgba(239,68,68,.4)' : 'none', paddingLeft: isRevisionReturn ? 8 : 0 }}>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ color: C.textMuted, minWidth: 110, fontSize: 11 }}>{new Date(h.changed_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                {actor && <span style={{ color: C.textMuted, fontSize: 11 }}>{actor}</span>}
                                <span style={{ color: C.text }}><b>{FIELD_LABELS[h.field_name] || h.field_name}</b>: <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{fmt(h.old_value, h.field_name)}</span> â <span style={{ color: isRevisionReturn ? '#ef4444' : C.accent }}>{fmt(h.new_value, h.field_name)}</span></span>
                              </div>
                              {isRevisionReturn && h.payload && typeof h.payload === 'object' && h.payload.comment && (
                                <div style={{ marginTop: 4, marginLeft: 118, fontSize: 11.5, color: C.textDim, fontStyle: 'italic' }}>
                                  ð¬ Â«{h.payload.comment}Â»
                                </div>
                              )}
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
              <div style={{ background: C.accent, color: '#fff', width: 50, height: 50, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, animation: 'pulse 1.5s infinite' }}>ð</div>
              <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>ÐÑÐ¾Ð´ÑÑÐ¸Ð¹ Ð²ÑÐ·Ð¾Ð²</div>
                  <div style={{ fontSize: 13, color: C.textDim }}>{incomingCall.initiator_name} Ð¿ÑÐ¸Ð³Ð»Ð°ÑÐ°ÐµÑ Ð²Ð°Ñ Ð² Ð¿ÑÐ¾ÐµÐºÑ "{incomingCall.project_name}"</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" onClick={() => {
                    if (incomingCall?.project_id) {
                      const p = projects.find((x: any) => String(x.id) === String(incomingCall.project_id));
                      if (p) setActiveProject(p);
                    }
                    setScreen('project');
                    setSideTab('conference');
                    setIncomingCall(null);
                  }}>ÐÑÐºÑÑÑÑ ÑÐ¾Ð²ÐµÑÐ°Ð½Ð¸Ðµ</button>
                  <button className="btn btn-ghost" onClick={() => setIncomingCall(null)}>ÐÐ¾Ð·Ð¶Ðµ</button>
              </div>
          </div>
      )}

      {showArchive && (
        <Modal title="ð¦ ÐÑÑÐ¸Ð² Ð¿ÑÐ¾ÐµÐºÑÐ¾Ð²" onClose={() => setShowArchive(false)} C={C}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {archivedProjects.length === 0 ? <div className="empty-state-cta" style={{ textAlign: 'center', padding: '40px 20px', background: C.surface, border: `1.5px dashed ${C.border}`, borderRadius: 12 }}><div style={{ fontSize: 32, marginBottom: 8 }}>ð¦</div><div style={{ fontSize: 14, color: C.text }}>ÐÑÑÐ¸Ð² Ð¿ÑÑÑ</div></div> : archivedProjects.map(p => (
              <div key={p.id} style={{ background: C.surface2, borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontWeight: 600, color: C.text }}>{p.name}</div><div style={{ fontSize: 11, color: C.textMuted }}>{p.code} Â· Ð´Ð¾ {p.deadline}</div></div>
                <span style={{ fontSize: 11, color: C.textMuted }}>Ð Ð°ÑÑÐ¸Ð²Ðµ</span>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {archiveConfirm && (
        <div className="delete-overlay">
          <div className="delete-box">
            <div style={{ fontSize: 40, marginBottom: 16 }}>ð¦</div>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8, color: C.orange }}>
              {archiveStep === 0 ? "ÐÑÐ¿ÑÐ°Ð²Ð¸ÑÑ Ð¿ÑÐ¾ÐµÐºÑ Ð² Ð°ÑÑÐ¸Ð²?" : "ÐÑ ÑÐ²ÐµÑÐµÐ½Ñ?"}
            </div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 24 }}>
              {archiveStep === 0
                ? `ÐÑÐ¾ÐµÐºÑ "${archiveConfirm.name}" Ð±ÑÐ´ÐµÑ ÑÐºÑÑÑ Ð¸Ð· Ð°ÐºÑÐ¸Ð²Ð½ÑÑ.`
                : "ÐÐ¾ÑÐ»Ðµ Ð°ÑÑÐ¸Ð²Ð°ÑÐ¸Ð¸ Ð¿ÑÐ¾ÐµÐºÑ Ð±ÑÐ´ÐµÑ Ð´Ð¾ÑÑÑÐ¿ÐµÐ½ ÑÐ¾Ð»ÑÐºÐ¾ Ð² ÑÐ°Ð·Ð´ÐµÐ»Ðµ Â«ÐÑÑÐ¸Ð²Â»."}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn btn-secondary" onClick={() => { setArchiveConfirm(null); setArchiveStep(0); }}>ÐÑÐ¼ÐµÐ½Ð°</button>
              <button
                className="btn"
                style={{ background: C.orange, color: "#fff" }}
                onClick={async () => {
                  if (archiveStep === 0) { setArchiveStep(1); return; }
                  await archiveProject(archiveConfirm.id);
                  setArchiveConfirm(null);
                  setArchiveStep(0);
                }}
              >
                {archiveStep === 0 ? "ÐÑÐ¾Ð´Ð¾Ð»Ð¶Ð¸ÑÑ â" : "ÐÑÐ¿ÑÐ°Ð²Ð¸ÑÑ Ð² Ð°ÑÑÐ¸Ð²"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== SIDEBAR ===== */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon" style={{ overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontFamily: 'Manrope', fontWeight: 900, fontSize: 14, color: '#fff', letterSpacing: '-0.02em' }}>Eh</span>
            )}
          </div>
          <div className="sidebar-logo-text">{branding.companyName || "EngHub"}</div>
        </div>
        <div className="sidebar-logo-sub">ENGINEERING PLATFORM</div>

        {/* DD-03: Active department/project icons */}
        {activeProject && (() => {
          const activeDept = selectedDeptId ? depts.find(d => String(d.id) === String(selectedDeptId)) : null;
          const deptCode = activeDept ? (activeDept.name.match(/^([Ð-Ð¯A-Z]{2,3})/)?.[1] || activeDept.name.slice(0,2).toUpperCase()) : null;
          const deptColorMap: Record<string, string> = { 'ÐÐ': '#a855f7', 'ÐÐ¡': '#2b5bb5', 'ÐÐ': '#4f7fd8', 'ÐÐ': '#2f9e62', 'ÐÐ': '#ef4444', 'Ð¡Ð': '#d08a38', 'Ð¢Ð¥': '#0ea5e9', 'Ð­Ð¡': '#facc15' };
          const deptBg = deptCode ? (deptColorMap[deptCode] || '#2b5bb5') : '#2b5bb5';
          return (
            <div style={{ padding: '0 12px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                {deptCode && (
                  <div title={activeDept?.name || ''} style={{ width: 32, height: 32, borderRadius: '50%', background: deptBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, flexShrink: 0, fontFamily: 'Manrope' }}>{deptCode}</div>
                )}
                <div title={activeProject.name || activeProject.code} style={{ width: 32, height: 32, borderRadius: '50%', background: C.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, flexShrink: 0, fontFamily: 'Manrope' }}>{(activeProject.code || activeProject.name || '?').slice(0,2).toUpperCase()}</div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeProject.name || activeProject.code}</div>
                  {activeDept && <div style={{ fontSize: 10, color: C.sidebarText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeDept.name}</div>}
                </div>
              </div>
            </div>
          );
        })()}

        <div className="sidebar-nav">
          <div className="sidebar-section-label">ÐÐ°Ð²Ð¸Ð³Ð°ÑÐ¸Ñ</div>
          {navItems.map(n => (
            <button key={n.id} className={`sidebar-btn ${screen === n.id ? "active" : ""}`} onClick={() => setScreen(n.id)}>
              <span className="sidebar-btn-icon">
                {NavIcon[n.id] ? React.createElement(NavIcon[n.id], { s: 16, c: 'currentColor' }) : n.icon}
              </span>
              <span>{n.label}</span>
            </button>
          ))}
        </div>

        {/* ÐÑÐ¾ÐµÐºÑÑ Ð² ÑÐ°Ð¹Ð´Ð±Ð°ÑÐµ (Figma-style) */}
        {projects.length > 0 && (
          <div style={{ padding: "0 12px", marginBottom: 16 }}>
            <div className="sidebar-section-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>ÐÑÐ¾ÐµÐºÑÑ</span>
              <span style={{ color: C.accent, fontSize: 11, cursor: "pointer" }}>ÐÑÐµ â</span>
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
                      <div className="sidebar-project-progress" style={{ fontSize: 10 }}>{p.code} â¢ {progress}%</div>
                    </div>
                  </button>
                  {isActive && p.depts && p.depts.length > 0 && (
                    <div className="sidebar-project-depts" style={{ paddingLeft: 24, marginTop: -4, marginBottom: 8 }}>
                      <button className={`sidebar-dept-item ${selectedDeptId === null ? "active" : ""}`} onClick={() => { setSelectedDeptId(null); setScreen("project"); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 13, background: selectedDeptId === null ? C.surface2 : 'transparent', color: selectedDeptId === null ? C.text : C.textMuted, border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                        ÐÐÐ¡Ð¬ ÐÐ ÐÐÐÐ¢
                      </button>
                      {p.depts.map((dId: number) => {
                        const dept = depts.find(d => String(d.id) === String(dId));
                        if (!dept) return null;
                        const isDeptActive = selectedDeptId === dId;
                        return (
                          <button key={dId} className={`sidebar-dept-item ${isDeptActive ? "active" : ""}`} onClick={() => { setSelectedDeptId(dId); setScreen("project"); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 13, background: isDeptActive ? C.surface2 : 'transparent', color: isDeptActive ? C.text : C.textMuted, border: 'none', borderRadius: 6, cursor: 'pointer', marginTop: 2 }}>
                            â³ {dept.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {isGip && <button className="sidebar-btn" onClick={() => { setNewProject({ name: "", code: "", deadline: "", status: "active", depts: [] }); setShowNewProject(true); }} style={{ color: C.accent, marginTop: 4 }}>
              <span className="sidebar-btn-icon">+</span><span>ÐÐ¾Ð²ÑÐ¹ Ð¿ÑÐ¾ÐµÐºÑ</span>
            </button>}
          </div>
        )}

        <div style={{ padding: "0 12px" }}>
          <div className="sidebar-section-label">Ð¡Ð¸ÑÑÐµÐ¼Ð°</div>
          <button className="sidebar-btn" onClick={() => { loadArchived(); setShowArchive(true); }}>
            <span className="sidebar-btn-icon">ð¦</span><span>ÐÑÑÐ¸Ð²</span>
          </button>
        </div>

        <div className="sidebar-bottom">
          <div style={{ padding: "10px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 5, flexShrink: 0 }}>
            <button className="sidebar-btn" style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.04)", color: "#8896a8", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>
              â ÐÐ°ÑÑÑÐ¾Ð¹ÐºÐ¸
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px" }}>
            <AvatarComp user={currentUserData} size={34} C={C} />
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={currentUserData?.full_name}>{currentUserData?.full_name?.split(" ").slice(0, 2).join(" ")}</div>
              <div style={{ fontSize: 10, color: C.sidebarText }}>{currentUserData?.position || roleLabels[currentUserData?.role] || ""}</div>
            </div>
            <button onClick={handleLogout} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, padding: 4 }} title="ÐÑÐ¹ÑÐ¸">â»</button>
          </div>
        </div>
      </div>

      {/* ===== MAIN AREA ===== */}
      <div className="main-area">
        {/* TOPBAR (Figma-style breadcrumbs) */}
        <div className="topbar">
          <div className="topbar-left">
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="topbar-title">{screen === "project" ? "ÐÐ°ÑÑÐ¾ÑÐºÐ° Ð¿ÑÐ¾ÐµÐºÑÐ°" : screenTitles[screen] || "EngHub"}</span>
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
                      ð¼ ÐÐ°Ð³ÑÑÐ·Ð¸ÑÑ ÑÐ¾ÑÐ¾
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !currentUserData) return;
                        const path = `${currentUserData.id}/${Date.now()}.${file.name.split('.').pop()}`;
                        try {
                          const uploadRes = await fetch(`${SURL}/storage/v1/object/avatars/${path}`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type },
                            body: file,
                          });
                          if (!uploadRes.ok) throw new Error('Upload failed');
                          const publicUrl = `${SURL}/storage/v1/object/public/avatars/${path}`;
                          await patch(`app_users?id=eq.${currentUserData.id}`, { avatar_url: publicUrl }, token!);
                          setAppUsers(prev => prev.map(u => u.id === currentUserData.id ? { ...u, avatar_url: publicUrl } : u));
                          addNotification('Ð¤Ð¾ÑÐ¾ Ð¿ÑÐ¾ÑÐ¸Ð»Ñ Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¾', 'success');
                        } catch {
                          addNotification('ÐÑÐ¸Ð±ÐºÐ° Ð·Ð°Ð³ÑÑÐ·ÐºÐ¸ ÑÐ¾ÑÐ¾', 'warning');
                        }
                        setShowUserMenu(false);
                      }} />
                    </label>
                    {/* Telegram linking */}
                    <div style={{ borderTop: `1px solid ${C.border}` }}>
                      {!showTelegramInput ? (
                        <button
                          onClick={() => setShowTelegramInput(true)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: C.text, fontSize: 13 }}
                        >
                          ð± {currentUserData?.telegram_id ? `Telegram: Ð¿ÑÐ¸Ð²ÑÐ·Ð°Ð½` : 'ÐÑÐ¸Ð²ÑÐ·Ð°ÑÑ Telegram'}
                        </button>
                      ) : (
                        <div style={{ padding: '10px 14px' }}>
                          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>
                            ÐÐ°Ð¿Ð¸ÑÐ¸ÑÐµ Ð±Ð¾ÑÑ <b>@cer_institut_ai_bot</b> ÐºÐ¾Ð¼Ð°Ð½Ð´Ñ <code>/start</code>, Ð¾Ð½ Ð¿Ð¾ÐºÐ°Ð¶ÐµÑ Ð²Ð°Ñ ID. ÐÑÑÐ°Ð²ÑÑÐµ ÐµÐ³Ð¾ Ð½Ð¸Ð¶Ðµ:
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              value={telegramIdInput}
                              onChange={e => setTelegramIdInput(e.target.value.replace(/\D/g, ''))}
                              placeholder="Telegram ID (ÑÐ¸ÑÐ»Ð°)"
                              style={{ flex: 1, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 8px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
                            />
                            <button
                              disabled={telegramSaving || !telegramIdInput}
                              onClick={async () => {
                                setTelegramSaving(true);
                                try {
                                  await patch(`app_users?id=eq.${currentUserData.id}`, { telegram_id: Number(telegramIdInput) }, token!);
                                  setCurrentUserData((prev: any) => ({ ...prev, telegram_id: Number(telegramIdInput) }));
                                  addNotification('Telegram Ð¿ÑÐ¸Ð²ÑÐ·Ð°Ð½! ÐÐ°Ð¿Ð¸ÑÐ¸ÑÐµ Ð±Ð¾ÑÑ /start', 'success');
                                  setShowTelegramInput(false);
                                  setTelegramIdInput('');
                                  setShowUserMenu(false);
                                } catch {
                                  addNotification('ÐÑÐ¸Ð±ÐºÐ° Ð¿ÑÐ¸Ð²ÑÐ·ÐºÐ¸', 'warning');
                                } finally {
                                  setTelegramSaving(false);
                                }
                              }}
                              style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', opacity: !telegramIdInput ? 0.5 : 1 }}
                            >
                              {telegramSaving ? '...' : 'OK'}
                            </button>
                          </div>
                          {currentUserData?.telegram_id && (
                            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>Ð¢ÐµÐºÑÑÐ¸Ð¹ ID: {currentUserData.telegram_id}</div>
                          )}
                        </div>
                      )}
                    </div>
                    <button onClick={() => { setShowUserMenu(false); handleLogout(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: `none`, borderTop: `1px solid ${C.border}`, cursor: 'pointer', color: '#ef4444', fontSize: 13, fontWeight: 600 }}>
                      â» ÐÑÐ¹ÑÐ¸ Ð¸Ð· ÑÐ¸ÑÑÐµÐ¼Ñ
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
                  <div className="page-label">Ð Ð°Ð±Ð¾ÑÐ¸Ð¹ ÑÑÐ¾Ð»</div>
                  <div className="page-title">ÐÐ¾Ð±ÑÐ¾ Ð¿Ð¾Ð¶Ð°Ð»Ð¾Ð²Ð°ÑÑ, {currentUserData?.full_name?.split(" ")[1] || currentUserData?.full_name?.split(" ")[0]} ð</div>
                </div>
                {isGip && <button className="btn btn-primary" onClick={() => { setNewProject({ name: "", code: "", deadline: "", status: "active", depts: [] }); setShowNewProject(true); }}>+ ÐÐ¾Ð²ÑÐ¹ Ð¿ÑÐ¾ÐµÐºÑ</button>}
              </div>

              {/* ÐÐ¾Ð¸ÑÐº */}
              <div className="search-wrap" style={{ marginBottom: 20 }}>
                <span className="search-icon">ð</span>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="ÐÐ¾Ð¸ÑÐº Ð¿Ð¾ Ð¿ÑÐ¾ÐµÐºÑÐ°Ð¼ Ð¸ Ð·Ð°Ð´Ð°ÑÐ°Ð¼..."
                  className="search-input" style={getInp(C, { paddingLeft: 40, borderRadius: 10, background: C.surface })} />
                {searchQuery && <button className="search-clear" onClick={() => setSearchQuery("")}>â</button>}
              </div>

              {/* DD-15: Role-specific dashboard for Lead */}
              {isLead && currentUserData && (
                <div style={{ marginBottom: 20 }}>
                  <LeadDashboard
                    C={C}
                    currentUser={currentUserData}
                    appUsers={appUsers}
                    /* B4: multi-project Ð·Ð°Ð´Ð°ÑÐ¸ Ð¾ÑÐ´ÐµÐ»Ð° (ÐµÑÐ»Ð¸ ÐµÑÑ Ð½Ðµ Ð·Ð°Ð³ÑÑÐ·Ð¸Ð»Ð¾ÑÑ â fallback Ð½Ð° ÑÐµÐºÑÑÐ¸Ð¹ Ð¿ÑÐ¾ÐµÐºÑ) */
                    allTasks={dashboardTasks.length ? dashboardTasks : allTasks}
                    setSelectedTask={setSelectedTask}
                    setShowTaskDetail={setShowTaskDetail}
                  />
                </div>
              )}

              {/* DD-16: Role-specific dashboard for Engineer */}
              {isEng && currentUserData && (
                <div style={{ marginBottom: 20 }}>
                  <EngineerDashboard
                    C={C}
                    currentUser={currentUserData}
                    /* B4: Ð²ÑÐµ Ð¼Ð¾Ð¸ Ð·Ð°Ð´Ð°ÑÐ¸ Ð¿Ð¾ Ð²ÑÐµÐ¼ Ð¿ÑÐ¾ÐµÐºÑÐ°Ð¼, Ð½Ðµ ÑÐ¾Ð»ÑÐºÐ¾ activeProject */
                    allTasks={dashboardTasks.length ? dashboardTasks : allTasks}
                    projects={projects}
                    setSelectedTask={setSelectedTask}
                    setShowTaskDetail={setShowTaskDetail}
                    setActiveProject={setActiveProject}
                  />
                </div>
              )}

              {/* ââ KPI ÐºÐ°ÑÑÐ¾ÑÐºÐ¸ ââ */}
              {/* B1: skeleton Ð¿Ð¾ÐºÐ° currentUserData Ð½Ðµ Ð¿ÑÐ¸ÑÑÐ» â Ð¸Ð½Ð°ÑÐµ KPI ÑÐµÐºÑÐ½Ð´Ñ Ð¿Ð¾ÐºÐ°Ð·ÑÐ²Ð°ÑÑ 0/0/0/0 */}
              {!currentUserData?.id ? (
                <div className="stats-row">
                  {[0,1,2,3].map(i => (
                    <div key={i} className="stat-card" style={{ opacity: 0.6 }}>
                      <div className="stat-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                        <span style={{ display: 'inline-block', width: 90, height: 11, background: C.border, borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: C.border, animation: 'pulse 1.5s ease-in-out infinite' }} />
                      </div>
                      <div style={{ width: 60, height: 38, background: C.border, borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
                    </div>
                  ))}
                </div>
              ) : (() => {
                const now = new Date();
                const baseTasks = (isGip || isAdmin) ? allTasks : tasks;
                const overdueProjects = projects.filter(p => { const dl = parseDeadline(p.deadline); return dl && dl < now && p.status !== 'done' && !p.archived; }).length;
                return (
                  <div className="stats-row">
                    {((isGip || isAdmin) ? [
                      { label: "ÐÑÐ¾ÐµÐºÑÐ¾Ð²", value: projects.length, color: C.accent, onClick: () => {} },
                      { label: "ÐÐºÑÐ¸Ð²Ð½ÑÑ Ð·Ð°Ð´Ð°Ñ", value: allTasks.filter(t => t.status !== "done").length, color: C.blue, onClick: () => setSideTab('tasks') },
                      { label: "ÐÐ° Ð¿ÑÐ¾Ð²ÐµÑÐºÐµ ÐÐÐÐ°", value: allTasks.filter(t => t.status === "review_gip").length, color: C.purple, onClick: () => setSideTab('tasks') },
                      { label: "ÐÑÐ¾ÑÑÐ¾ÑÐµÐ½Ð½ÑÑ Ð¿ÑÐ¾ÐµÐºÑÐ¾Ð²", value: overdueProjects, color: overdueProjects > 0 ? C.red : C.green, onClick: () => {} },
                    ] : isLead ? [
                      { label: "ÐÐ°Ð´Ð°Ñ Ð² Ð¾ÑÐ´ÐµÐ»Ðµ", value: baseTasks.length, color: C.accent, onClick: () => setSideTab('tasks') },
                      { label: "Ð ÑÐ°Ð±Ð¾ÑÐµ", value: baseTasks.filter(t => t.status === "inprogress").length, color: C.blue, onClick: () => setSideTab('tasks') },
                      { label: "ÐÐ° Ð¿ÑÐ¾Ð²ÐµÑÐºÐµ", value: baseTasks.filter(t => t.status === "review_lead" || t.status === "review_gip").length, color: C.purple, onClick: () => setSideTab('tasks') },
                      { label: "ÐÐ°Ð²ÐµÑÑÐµÐ½Ð¾", value: baseTasks.filter(t => t.status === "done").length, color: C.green, onClick: () => setSideTab('tasks') },
                    ] : [
                      { label: "ÐÐ¾Ð¸ Ð·Ð°Ð´Ð°ÑÐ¸", value: baseTasks.length, color: C.accent, onClick: () => setSideTab('tasks') },
                      { label: "Ð ÑÐ°Ð±Ð¾ÑÐµ", value: baseTasks.filter(t => t.status === "inprogress").length, color: C.blue, onClick: () => setSideTab('tasks') },
                      { label: "ÐÐ° Ð¿ÑÐ¾Ð²ÐµÑÐºÐµ", value: baseTasks.filter(t => t.status === "review_lead" || t.status === "review_gip").length, color: C.purple, onClick: () => setSideTab('tasks') },
                      { label: "ÐÐ°Ð²ÐµÑÑÐµÐ½Ð¾", value: baseTasks.filter(t => t.status === "done").length, color: C.green, onClick: () => setSideTab('tasks') },
                    ]).map(s => (
                      <div key={s.label} className="stat-card" onClick={s.onClick} style={{ cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 4px 16px ${s.color}30`)}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}>
                        <div className="stat-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                          <span className="stat-card-label" style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{s.label}</span>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: s.color + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                            {(() => { const iconMap: Record<string, any> = { 'ÐÑÐ¾ÐµÐºÑÐ¾Ð²': IconFolder, 'ÐÐºÑÐ¸Ð²Ð½ÑÑ Ð·Ð°Ð´Ð°Ñ': IconCheckSquare, 'ÐÐ° Ð¿ÑÐ¾Ð²ÐµÑÐºÐµ ÐÐÐÐ°': IconActivity, 'ÐÑÐ¾ÑÑÐ¾ÑÐµÐ½Ð½ÑÑ Ð¿ÑÐ¾ÐµÐºÑÐ¾Ð²': IconArchive, 'ÐÐ°Ð´Ð°Ñ Ð² Ð¾ÑÐ´ÐµÐ»Ðµ': IconCheckSquare, 'Ð ÑÐ°Ð±Ð¾ÑÐµ': IconActivity, 'ÐÐ° Ð¿ÑÐ¾Ð²ÐµÑÐºÐµ': IconActivity, 'ÐÐ°Ð²ÐµÑÑÐµÐ½Ð¾': IconCheckSquare, 'ÐÐ¾Ð¸ Ð·Ð°Ð´Ð°ÑÐ¸': IconCheckSquare }; const Icon = iconMap[s.label]; return Icon ? React.createElement(Icon, { s: 17 }) : null; })()}
                          </div>
                        </div>
                        <div style={{ fontFamily: 'Manrope, Inter, sans-serif', fontSize: 38, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>
                          <StatNumber value={s.value} color={s.color} />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Ð ÐµÐ·ÑÐ»ÑÑÐ°ÑÑ Ð¿Ð¾Ð¸ÑÐºÐ° */}
              {searchQuery && (() => {
                const sq = searchQuery.toLowerCase();
                const matchedTasks = tasks.filter(t => t.name.toLowerCase().includes(sq) || (t.dept || "").toLowerCase().includes(sq));
                if (matchedTasks.length > 0) return (
                  <div style={{ marginBottom: 20 }}>
                    <div className="page-label" style={{ marginBottom: 10 }}>ÐÐ°Ð¹Ð´ÐµÐ½Ð¾ Ð·Ð°Ð´Ð°Ñ: {matchedTasks.length}</div>
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

              {/* ââ ÐÐÐÐÐÐ¢ÐÐÐ ÐÐÐ¯ ÐÐÐÐ° / ÐÐÐÐÐÐÐ¡Ð¢Ð ÐÐ¢ÐÐ Ð ââ */}
              {(isGip || isAdmin) && (
                <div className="analytics-grid-2">
                  {/* ÐÐ°Ð³ÑÑÐ·ÐºÐ° Ð¾ÑÐ´ÐµÐ»Ð¾Ð² */}
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                    <div className="page-label" style={{ marginBottom: 14 }}>ÐÐ°Ð³ÑÑÐ·ÐºÐ° Ð¾ÑÐ´ÐµÐ»Ð¾Ð²</div>
                    {(() => {
                      const deptLoad: Record<string, { total: number; done: number; review: number }> = {};
                      for (const t of allTasks) {
                        const dn = t.dept || 'ÐÐµÐ· Ð¾ÑÐ´ÐµÐ»Ð°';
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
                            <span style={{ color: C.textMuted }}>{d.total} Ð·Ð°Ð´Ð°Ñ Â· {d.done} Ð³Ð¾ÑÐ¾Ð²Ð¾</span>
                          </div>
                          <div style={{ height: 7, background: C.surface2, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                            <div style={{ height: '100%', width: deptBarsAnimated ? `${(d.done / maxVal) * 100}%` : '0%', background: C.green, transition: 'width 0.9s cubic-bezier(.2,.8,.2,1)' }} />
                            <div style={{ height: '100%', width: deptBarsAnimated ? `${((d.total - d.done) / maxVal) * 100}%` : '0%', background: C.accent + '60', transition: 'width 0.9s cubic-bezier(.2,.8,.2,1)' }} />
                          </div>
                        </div>
                      )) : <div style={{ fontSize: 13, color: C.textMuted }}>ÐÐµÑ Ð´Ð°Ð½Ð½ÑÑ</div>;
                    })()}
                  </div>

                  {/* ÐÐµÐ´Ð»Ð°Ð¹Ð½Ñ Ð¿ÑÐ¾ÐµÐºÑÐ¾Ð² */}
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                    <div className="page-label" style={{ marginBottom: 14 }}>ÐÐµÐ´Ð»Ð°Ð¹Ð½Ñ Ð¿ÑÐ¾ÐµÐºÑÐ¾Ð²</div>
                    {[...projects].sort((a, b) => (parseDeadline(a.deadline)?.getTime() ?? 99999999999999) - (parseDeadline(b.deadline)?.getTime() ?? 99999999999999)).map(p => {
                      const now = new Date();
                      const dl = parseDeadline(p.deadline);
                      const daysLeft = dl ? Math.ceil((dl.getTime() - now.getTime()) / 86400000) : null;
                      const isDoneOrArchived = p.status === 'done' || p.archived;
                      const color = daysLeft === null ? C.textMuted : (daysLeft < 0 && !isDoneOrArchived) ? C.red : daysLeft < 30 ? C.red : daysLeft < 90 ? C.orange : C.green;
                      const label = daysLeft === null ? 'â' : daysLeft < 0 ? `ÐÑÐ¾ÑÑÐ¾ÑÐµÐ½ ${-daysLeft} Ð´.` : daysLeft === 0 ? 'Ð¡ÐµÐ³Ð¾Ð´Ð½Ñ!' : `${daysLeft} Ð´Ð½.`;
                      const progress = getAutoProgress(p.id);
                      return (
                        <div key={p.id} onClick={() => { setActiveProject(p); setScreen('project'); setSideTab('tasks'); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: C.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.name}>{p.name}</div>
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

              {/* ÐÑÐµÑÐµÐ´Ñ Ð½Ð° Ð¿ÑÐ¾Ð²ÐµÑÐºÑ ÐÐÐÐ° */}
              {(isGip || isAdmin) && (() => {
                const reviewTasks = allTasks.filter(t => t.status === 'review_gip');
                if (reviewTasks.length === 0) return null;
                return (
                  <div style={{ background: C.surface, border: `1px solid ${C.purple}30`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div className="page-label" style={{ color: C.purple }}>ÐÐ¶Ð¸Ð´Ð°ÑÑ Ð¿ÑÐ¾Ð²ÐµÑÐºÐ¸ ÐÐÐÐ°</div>
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
                              <div style={{ fontSize: 11, color: C.textMuted }}>{proj?.code} Â· {t.dept}</div>
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

              {/* ââ ÐÐÐÐÐÐ¢ÐÐÐ ÐÐÐ¯ Ð Ð£ÐÐÐÐÐÐÐ¢ÐÐÐ¯ ÐÐ¢ÐÐÐÐ ââ */}
              {isLead && (() => {
                const myDeptId = currentUserData?.dept_id;
                const myEngineers = appUsers.filter(u => u.dept_id === myDeptId && u.role === 'engineer');
                const myDeptTasks = tasks; // ÑÐ¶Ðµ Ð¾ÑÑÐ¸Ð»ÑÑÑÐ¾Ð²Ð°Ð½Ð¾ Ð¿Ð¾ Ð¾ÑÐ´ÐµÐ»Ñ
                return (
                  <div style={{ marginBottom: 20 }}>
                    {/* ÐÐ°Ð³ÑÑÐ·ÐºÐ° Ð¸Ð½Ð¶ÐµÐ½ÐµÑÐ¾Ð² */}
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                      <div className="page-label" style={{ marginBottom: 14 }}>ÐÐ°Ð³ÑÑÐ·ÐºÐ° Ð¸Ð½Ð¶ÐµÐ½ÐµÑÐ¾Ð² Ð¾ÑÐ´ÐµÐ»Ð°</div>
                      {myEngineers.length === 0 ? (
                        <div style={{ fontSize: 13, color: C.textMuted }}>ÐÐ½Ð¶ÐµÐ½ÐµÑÑ Ð½Ðµ Ð½Ð°Ð·Ð½Ð°ÑÐµÐ½Ñ Ð² Ð¾ÑÐ´ÐµÐ»</div>
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
                                <span style={{ color: C.textMuted }}>{total} Ð·Ð°Ð´Ð°Ñ Â· {pct}% Ð³Ð¾ÑÐ¾Ð²Ð¾</span>
                              </div>
                              <div style={{ height: 7, background: C.surface2, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                                <div title="ÐÐ°Ð²ÐµÑÑÐµÐ½Ð¾" style={{ width: `${total > 0 ? (done/total)*100 : 0}%`, background: C.green, height: '100%' }} />
                                <div title="ÐÐ° Ð¿ÑÐ¾Ð²ÐµÑÐºÐµ" style={{ width: `${total > 0 ? (review/total)*100 : 0}%`, background: C.purple, height: '100%' }} />
                                <div title="Ð ÑÐ°Ð±Ð¾ÑÐµ" style={{ width: `${total > 0 ? (inprog/total)*100 : 0}%`, background: C.blue, height: '100%' }} />
                                <div title="Ð Ð¾ÑÐµÑÐµÐ´Ð¸" style={{ width: `${total > 0 ? (todo/total)*100 : 0}%`, background: C.accent + '50', height: '100%' }} />
                              </div>
                              <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 10, color: C.textMuted }}>
                                {done > 0 && <span style={{ color: C.green }}>â {done} Ð³Ð¾ÑÐ¾Ð²Ð¾</span>}
                                {review > 0 && <span style={{ color: C.purple }}>â {review} Ð¿ÑÐ¾Ð²ÐµÑÐºÐ°</span>}
                                {inprog > 0 && <span style={{ color: C.blue }}>â¶ {inprog} Ð² ÑÐ°Ð±Ð¾ÑÐµ</span>}
                                {todo > 0 && <span>â {todo} Ð² Ð¾ÑÐµÑÐµÐ´Ð¸</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* ÐÐ°Ð´Ð°ÑÐ¸ Ð¾Ð¶Ð¸Ð´Ð°ÑÑÐ¸Ðµ Ð¿ÑÐ¾Ð²ÐµÑÐºÐ¸ ÑÑÐºÐ¾Ð²Ð¾Ð´Ð¸ÑÐµÐ»Ñ */}
                    {(() => {
                      const waitReview = myDeptTasks.filter(t => t.status === 'review_lead');
                      if (waitReview.length === 0) return null;
                      return (
                        <div style={{ background: C.surface, border: `1px solid ${C.purple}30`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div className="page-label" style={{ color: C.purple }}>ÐÐ¶Ð¸Ð´Ð°ÑÑ Ð²Ð°ÑÐµÐ¹ Ð¿ÑÐ¾Ð²ÐµÑÐºÐ¸</div>
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

              {/* ââ ÐÑÐ¾ÐµÐºÑÑ ââ */}
              <div className="page-label" style={{ marginBottom: 12 }}>ÐÑÐ¾ÐµÐºÑÑ</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* FIX: show "no results" message when search filter matches nothing */}
                {searchQuery && projects.filter(p => { const sq = searchQuery.toLowerCase(); return p.name.toLowerCase().includes(sq) || p.code.toLowerCase().includes(sq); }).length === 0 && (
                  <div style={{ fontSize: 13, color: C.textMuted, padding: '12px 0' }}>ÐÐ¾ Ð·Ð°Ð¿ÑÐ¾ÑÑ Â«{searchQuery}Â» Ð¿ÑÐ¾ÐµÐºÑÐ¾Ð² Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½Ð¾</div>
                )}
                {projects.filter(p => { if (!searchQuery) return true; const sq = searchQuery.toLowerCase(); return p.name.toLowerCase().includes(sq) || p.code.toLowerCase().includes(sq); }).map(p => {
                  const progress = getAutoProgress(p.id);
                  const _dl = parseDeadline(p.deadline);
                  const _daysLeft = _dl ? Math.ceil((_dl.getTime() - Date.now()) / 86400000) : null;
                  const _isDoneOrArchived = p.status === 'done' || p.archived;
                  const _deadlineColor = _daysLeft === null ? C.textMuted : (_daysLeft < 0 && !_isDoneOrArchived) ? C.red : _daysLeft < 30 ? C.red : _daysLeft < 90 ? C.orange : C.green;
                  return (
                    <div key={p.id} className={`project-card ${activeProject?.id === p.id ? "active" : ""}`} onClick={() => { setActiveProject(p); setScreen("project"); setSideTab("tasks"); }}
                      style={{ borderLeft: `3px solid ${_deadlineColor}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <span style={{ fontWeight: 600, fontSize: 15, color: C.text }}>{p.name}</span>
                          <span style={{ fontSize: 11, color: C.textMuted, background: C.surface2, padding: "3px 10px", borderRadius: 6 }}>{p.code}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: _deadlineColor, fontWeight: _daysLeft !== null && _daysLeft < 30 ? 700 : 400 }}>Ð´Ð¾ {p.deadline}</span>
                          {isGip && <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); promptArchiveProject(p); }}>â ÐÑÑÐ¸Ð²</button>}
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
              <div className="project-meta-bar" style={{ display: conferenceScreenActive ? 'none' : undefined }}>
                <button onClick={() => setScreen("dashboard")} className="btn btn-ghost">â Dashboard</button>
                <span className="project-meta-badge" style={{ color: C.accent, borderColor: C.accent + "40", background: C.accent + "10" }}>{activeProject.code}</span>
                <span className="project-meta-badge" style={{ color: C.green, borderColor: C.green + "40", background: C.green + "10" }}>{activeProject.status === "active" ? "Ð ÑÐ°Ð±Ð¾ÑÐµ" : "ÐÐ° Ð¿ÑÐ¾Ð²ÐµÑÐºÐµ"}</span>
                {activeProject.department && <span style={{ fontSize: 12, color: C.textMuted }}>{activeProject.department}</span>}
                <div style={{ flex: 1 }}></div>
                
                {/* EXPORT BUTTON */}
                <button
                  onClick={() => exportProjectXls(activeProject, allTasks, drawings, reviews, getUserById, activeProjectProgress, addNotification)}
                  title="Ð­ÐºÑÐ¿Ð¾ÑÑ Ð·Ð°Ð´Ð°Ñ Ð² Excel"
                  className="btn btn-secondary"
                >
                  <span style={{ fontSize: 14 }}>â¬</span> Excel
                </button>

                {/* PDF REPORT BUTTON */}
                <button
                  onClick={() => setShowReportPDF(true)}
                  title="ÐÑÑÑÑ Ð´Ð»Ñ Ð·Ð°ÐºÐ°Ð·ÑÐ¸ÐºÐ° (PDF)"
                  className="btn btn-secondary"
                >
                  <span style={{ fontSize: 14 }}>ð</span> ÐÑÑÑÑ
                </button>

                {/* COPILOT BUTTON */}
                <button
                  onClick={() => setShowCopilot(!showCopilot)}
                  className={`btn ${showCopilot ? "btn-primary" : "btn-secondary"}`}
                >
                  <span style={{ fontSize: 14 }}>â¨</span> ChatGPT 4.0
                </button>

                <div className="project-stats-bar">
                  <div className="project-stat">
                    <div className="project-stat-value" style={{ color: C.accent }}>{activeProjectProgress}%</div>
                    <div className="project-stat-label">Ð¿ÑÐ¾Ð³ÑÐµÑÑ</div>
                  </div>
                  <div className="project-stat">
                    <div className="project-stat-value" style={{ color: C.text }}>{tasks.filter(t => t.status === "done").length}/{tasks.length}</div>
                    <div className="project-stat-label">Ð·Ð°Ð´Ð°Ñ</div>
                  </div>
                  {activeProject.deadline && <div className="project-stat">
                    <div className="project-stat-value" style={{ color: C.text, fontSize: 14 }}>{activeProject.deadline}</div>
                    <div className="project-stat-label">Ð´ÐµÐ´Ð»Ð°Ð¹Ð½</div>
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
                  <div className="page-title" style={{ marginBottom: 12, fontSize: 28 }}>{activeProject.name}</div>
                  {/* #12 design diff: 3 Ð¼ÐµÑÑÐ¸ÐºÐ¸ Ð² ÑÐ°Ð¿ÐºÐµ Ð¿ÑÐ¾ÐµÐºÑÐ° */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 18, flexWrap: 'wrap' }}>
                    {(() => {
                      const projTasks = allTasks.filter(t => t.project_id === activeProject.id);
                      const doneCount = projTasks.filter(t => t.status === 'done').length;
                      const dl = parseDeadline(activeProject.deadline);
                      const now = new Date();
                      const daysLeft = dl ? Math.ceil((dl.getTime() - now.getTime()) / 86400000) : null;
                      const dlColor = daysLeft === null ? C.textMuted : (daysLeft < 0 ? C.red : daysLeft < 30 ? C.red : daysLeft < 90 ? C.orange : C.green);
                      const dlLabel = daysLeft === null ? 'â' : daysLeft < 0 ? `ÐÑÐ¾ÑÑÐ¾ÑÐµÐ½ ${-daysLeft} Ð´.` : `${daysLeft} Ð´Ð½.`;
                      const metrics = [
                        { value: `${activeProjectProgress}%`, label: 'Ð¿ÑÐ¾Ð³ÑÐµÑÑ', color: C.accent },
                        { value: `${doneCount}/${projTasks.length}`, label: 'Ð·Ð°Ð´Ð°Ñ', color: C.text },
                        { value: dlLabel, label: 'Ð´Ð¾ Ð´ÐµÐ´Ð»Ð°Ð¹Ð½Ð°', color: dlColor },
                      ];
                      return metrics.map((m, i) => (
                        <React.Fragment key={m.label}>
                          {i > 0 && <div style={{ width: 1, height: 28, background: C.border, margin: '0 18px' }} />}
                          <div style={{ textAlign: 'center', minWidth: 70 }}>
                            <div style={{ fontSize: 17, fontWeight: 800, color: m.color, fontFamily: 'Manrope, Inter, sans-serif', lineHeight: 1.2 }}>{m.value}</div>
                            <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>{m.label}</div>
                          </div>
                        </React.Fragment>
                      ));
                    })()}
                  </div>
                  <div className="progress-track" style={{ height: 6, marginBottom: 24 }}><div className="progress-bar" style={{ width: `${activeProjectProgress}%`, height: "100%" }} /></div>
                </>
              )}

              {/* Tabs */}
              <div style={{ display: conferenceScreenActive ? 'none' : 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
                <div className="tab-strip-wrap" style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                  <div className="tab-strip" style={{ flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch', flex: 1, marginBottom: 0 } as React.CSSProperties}>
                    {["conference","tasks","documents","activity","drawings","revisions","reviews","transmittals","assignments","tz","gantt","timeline","meetings","timelog",...(isGip ? ["gipdash"] : []),...((isGip || isLead) ? ["bim"] : [])].map(t => (
                      <button key={t} className={`tab-btn ${sideTab === t ? "active" : ""}`} onClick={() => setSideTab(t)} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {t === "tasks" ? "â ÐÐ°Ð´Ð°ÑÐ¸" : t === "documents" ? "ð ÐÐ¾ÐºÑÐ¼ÐµÐ½ÑÑ" : t === "activity" ? "ð° ÐÐºÑÐ¸Ð²Ð½Ð¾ÑÑÑ" : t === "drawings" ? "ð Ð§ÐµÑÑÐµÐ¶Ð¸" : t === "revisions" ? "ð§¾ Ð ÐµÐ²Ð¸Ð·Ð¸Ð¸" : t === "reviews" ? "ð ÐÐ°Ð¼ÐµÑÐ°Ð½Ð¸Ñ" : t === "transmittals" ? "ð¦ Ð¢ÑÐ°Ð½ÑÐ¼Ð¸ÑÑÐ°Ð»Ñ" : t === "assignments" ? "â Ð£Ð²ÑÐ·ÐºÐ°" : t === "tz" ? "ð Ð¢Ð" : t === "gantt" ? "ð ÐÐ¸Ð°Ð³ÑÐ°Ð¼Ð¼Ð°" : t === "timeline" ? "ðº Timeline" : t === "meetings" ? "ð ÐÑÐ¾ÑÐ¾ÐºÐ¾Ð»Ñ" : t === "timelog" ? "â± Ð¢Ð°Ð±ÐµÐ»Ñ" : t === "gipdash" ? "ð ÐÐÐ" : t === "bim" ? "ð BIM" : "ð£ Ð¡Ð¾Ð²ÐµÑÐ°Ð½Ð¸Ðµ"}
                      </button>
                    ))}
                  </div>
                  <div className="tab-strip-fade" aria-hidden="true" />
                </div>
                {TAB_HELP[sideTab] && (
                  <button
                    title="ÐÐ½ÑÑÑÑÐºÑÐ¸Ñ Ð¿Ð¾ ÑÐ°Ð·Ð´ÐµÐ»Ñ"
                    onClick={() => setShowTabHelp(true)}
                    style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '0 12px', height: 30, borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.surface2, color: C.textDim, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >ÐÐ½ÑÑÑÑÐºÑÐ¸Ñ</button>
                )}
              </div>

              {/* Tab Help Modal */}
              {showTabHelp && TAB_HELP[sideTab] && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowTabHelp(false)}>
                  <div style={{ background: C.surface, borderRadius: 16, padding: '28px 32px', maxWidth: 520, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', position: 'relative' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowTabHelp(false)} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.textDim, lineHeight: 1 }}>Ã</button>
                    <div style={{ fontWeight: 700, fontSize: 18, color: C.text, marginBottom: 20 }}>{TAB_HELP[sideTab].title} â Ð¸Ð½ÑÑÑÑÐºÑÐ¸Ñ</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {TAB_HELP[sideTab].sections.map((s, i) => (
                        <div key={i}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: C.accent, marginBottom: 3 }}>{s.heading}</div>
                          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>{s.text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {sideTab === "tasks" && (
                <div>
                  {/* Task List Header */}
                  <div className="task-list-header">
                    <div className="task-list-title">Ð¡Ð¿Ð¸ÑÐ¾Ðº Ð·Ð°Ð´Ð°Ñ</div>
                    {isGip && <button className="btn btn-primary" style={{ borderRadius: 20, padding: "10px 22px" }} onClick={() => { setNewTask({ name: "", dept_id: "", priority: "medium", deadline: "", assigned_to: "", drawing_id: "", description: "" }); setTaskSuggest(null); setShowNewTask(true); }}>+ ÐÐ¾Ð²Ð°Ñ Ð·Ð°Ð´Ð°ÑÐ°</button>}
                  </div>
                  <div className="task-list">
                    {tasks.length === 0 && (
                      <div className="empty-state-cta" style={{ textAlign: 'center', padding: '56px 20px', background: C.surface, border: `1.5px dashed ${C.border}`, borderRadius: 12 }}>
                        <div style={{ width: 52, height: 52, borderRadius: 13, background: `${C.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24 }}>ð</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 5 }}>ÐÐ°Ð´Ð°Ñ Ð¿Ð¾ÐºÐ° Ð½ÐµÑ</div>
                        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 18 }}>Ð¡Ð¾Ð·Ð´Ð°Ð¹ÑÐµ Ð¿ÐµÑÐ²ÑÑ Ð·Ð°Ð´Ð°ÑÑ Ð´Ð»Ñ ÑÑÐ¾Ð³Ð¾ Ð¿ÑÐ¾ÐµÐºÑÐ°</div>
                        {(isGip || isLead) && <button className="btn btn-primary" onClick={() => { setNewTask({ name: "", dept_id: "", priority: "medium", deadline: "", assigned_to: "", drawing_id: "", description: "" }); setShowNewTask(true); }}>+ Ð¡Ð¾Ð·Ð´Ð°ÑÑ Ð·Ð°Ð´Ð°ÑÑ</button>}
                      </div>
                    )}
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
                                <div title={`Ð ÐµÐ²Ð¸Ð·Ð¸Ñ ${t.revision_num || 0}`} style={{ background: C.accent + '15', color: C.accent, fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, cursor: 'help' }}>R{t.revision_num || 0}</div>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              {deptName && <span style={{ fontSize: 11, color: C.textMuted, background: C.surface2, padding: "3px 10px", borderRadius: 6, fontWeight: 500 }}>{deptName}</span>}
                              {t.drawing_id && (() => {
                                const d = drawings.find(dr => String(dr.id) === String(t.drawing_id));
                                return d ? <span style={{ fontSize: 11, color: C.textMuted }}>ð {d.code}</span> : null;
                              })()}
                              {t.deadline && <span style={{ fontSize: 11, color: (() => { const dl = parseDeadline(t.deadline); return dl && dl < new Date() ? C.red : C.textMuted; })() }}>ð {formatDateRu(t.deadline)}</span>}
                              {taskAttachCounts[String(t.id)] > 0 && <span style={{ fontSize: 11, color: C.textMuted }} title="ÐÑÐ¸ÐºÑÐµÐ¿Ð»ÑÐ½Ð½ÑÐµ ÑÐ°Ð¹Ð»Ñ">ð {taskAttachCounts[String(t.id)]}</span>}
                              <span style={{ fontSize: 11, color: t.priority === "high" ? C.red : t.priority === "medium" ? C.orange : C.green, fontWeight: 600 }}>â {t.priority === "high" ? "ÐÑÑÐ¾ÐºÐ¸Ð¹" : t.priority === "medium" ? "Ð¡ÑÐµÐ´Ð½Ð¸Ð¹" : "ÐÐ¸Ð·ÐºÐ¸Ð¹"}</span>
                            </div>
                          </div>
                          <span className="badge" style={{ color: st.color, background: st.bg, border: `1px solid ${st.color}25` }}>â {st.label}</span>
                          {u && <AvatarComp user={u} size={34} C={C} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {sideTab === "documents" && activeProject && (
                <DocumentsPanel
                  C={C}
                  projectId={activeProject.id}
                  currentUserId={currentUserData?.id || 0}
                  token={token!}
                  appUsers={appUsers}
                  canManage={isGip || isLead || currentUserData?.role === 'engineer'}
                />
              )}

              {sideTab === "activity" && activeProject && (
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 12 }}>ð° ÐÐºÑÐ¸Ð²Ð½Ð¾ÑÑÑ Ð¿ÑÐ¾ÐµÐºÑÐ°</div>
                  <ActivityFeed projectId={activeProject.id} appUsers={appUsers} C={C} limit={50} />
                </div>
              )}

              {sideTab === "drawings" && (
                <DrawingsPanel
                  C={C}
                  canEdit={isGip || isLead}
                  drawings={drawings}
                  onCreate={createProjectDrawing}
                  onUpdate={updateProjectDrawing}
                  token={token || ''}
                  userRole={role}
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
                  projectId={activeProject?.id ? String(activeProject.id) : undefined}
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

              {sideTab === "tz" && (
                <AssignmentTab
                  C={C}
                  token={token!}
                  project={activeProject}
                  isGip={isGip}
                  isAdmin={currentUserData?.role === 'admin'}
                />
              )}

              {/* ââ GANTT ââ */}
              {sideTab === "gantt" && <GanttChart tasks={allTasks} activeProject={activeProject} getUserById={getUserById} getDeptName={getDeptName} C={C} />}
              {sideTab === "timeline" && (
                <div style={{ padding: 20 }}>
                  <div className="page-header" style={{ marginBottom: 16 }}><div><div className="page-label">D5</div><div className="page-title">Timeline Ð¿ÑÐ¾ÐµÐºÑÐ°</div></div></div>
                  <ProjectTimeline tasks={allTasks} project={activeProject} C={C} />
                </div>
              )}

              {/* ââ MEETINGS ââ */}
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

              {/* ââ TIMELOG ââ */}
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

              {sideTab === "bim" && (isGip || isLead) && (
                <BIMPanel
                  C={C}
                  drawings={drawings}
                />
              )}

              {sideTab === "gipdash" && isGip && (
                <GipDashboard
                  project={activeProject}
                  tasks={allTasks}
                  reviews={reviews}
                  drawings={drawings}
                  appUsers={appUsers}
                  depts={activeProject?.depts?.map((id: number) => depts.find(d => d.id === id)?.name).filter(Boolean) || []}
                  C={C}
                  token={token!}
                />
              )}

              {sideTab === "conference" && (
                <MeetingRoomPage
                  C={C}
                  project={activeProject ? { id: activeProject.id, name: activeProject.name } : null}
                  currentUser={currentUserData}
                  token={token!}
                  addNotification={addNotification}
                />
              )}
            </div>
          )}

          {/* ===== PROJECTS REGISTRY ===== */}
          {screen === "projects_list" && (
            <div className="screen-fade">
              <div className="page-header">
                <div>
                  <div className="page-label">Ð ÐµÐµÑÑÑ Ð¿ÑÐ¾ÐµÐºÑÐ¾Ð²</div>
                  <div className="page-title">ÐÑÐµ Ð´Ð¾ÑÑÑÐ¿Ð½ÑÐµ Ð¿ÑÐ¾ÐµÐºÑÑ</div>
                </div>
                {isGip && <button className="btn btn-primary" onClick={() => { setNewProject({ name: "", code: "", deadline: "", status: "active", depts: [] }); setShowNewProject(true); }}>+ ÐÐ¾Ð²ÑÐ¹ Ð¿ÑÐ¾ÐµÐºÑ</button>}
              </div>

              <div className="search-wrap" style={{ marginBottom: 20 }}>
                <span className="search-icon">ð</span>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="ÐÐ¾Ð¸ÑÐº Ð¿Ð¾ Ð½Ð°Ð·Ð²Ð°Ð½Ð¸Ñ Ð¸Ð»Ð¸ ÑÐ¸ÑÑÑ..."
                  className="search-input" style={getInp(C, { paddingLeft: 40, borderRadius: 10, background: C.surface })} />
                {searchQuery && <button className="search-clear" onClick={() => setSearchQuery("")}>â</button>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {projects.filter(p => { if (!searchQuery) return true; const sq = searchQuery.toLowerCase(); return p.name.toLowerCase().includes(sq) || p.code.toLowerCase().includes(sq); }).map(p => {
                  const progress = getAutoProgress(p.id);
                  const _dl = parseDeadline(p.deadline);
                  const _daysLeft = _dl ? Math.ceil((_dl.getTime() - Date.now()) / 86400000) : null;
                  const _isDoneOrArchived = p.status === 'done' || p.archived;
                  const _deadlineColor = _daysLeft === null ? C.textMuted : (_daysLeft < 0 && !_isDoneOrArchived) ? C.red : _daysLeft < 30 ? C.red : _daysLeft < 90 ? C.orange : C.green;
                  return (
                    <div key={p.id} className={`project-card ${activeProject?.id === p.id ? "active" : ""}`} onClick={() => { setActiveProject(p); setScreen("project"); setSideTab("tasks"); }}
                      style={{ borderLeft: `3px solid ${_deadlineColor}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <span style={{ fontWeight: 600, fontSize: 15, color: C.text }}>{p.name}</span>
                          <span style={{ fontSize: 11, color: C.textMuted, background: C.surface2, padding: "3px 10px", borderRadius: 6 }}>{p.code}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: _deadlineColor, fontWeight: _daysLeft !== null && _daysLeft < 30 ? 700 : 400 }}>Ð´Ð¾ {p.deadline}</span>
                          {isGip && <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); promptArchiveProject(p); }}>â ÐÑÑÐ¸Ð²</button>}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div className="progress-track" style={{ flex: 1 }}><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.accent, minWidth: 40, textAlign: "right" }}>{progress}%</span>
                      </div>
                    </div>
                  );
                })}
                {projects.length === 0 && (
                  <div className="empty-state-cta" style={{ textAlign: 'center', padding: '56px 20px', background: C.surface, border: `1.5px dashed ${C.border}`, borderRadius: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 13, background: `${C.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24 }}>ð</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 5 }}>ÐÑÐ¾ÐµÐºÑÐ¾Ð² Ð¿Ð¾ÐºÐ° Ð½ÐµÑ</div>
                    <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 18 }}>{isGip ? 'Ð¡Ð¾Ð·Ð´Ð°Ð¹ÑÐµ Ð¿ÐµÑÐ²ÑÐ¹ Ð¿ÑÐ¾ÐµÐºÑ ÑÑÐ¾Ð±Ñ Ð½Ð°ÑÐ°ÑÑ ÑÐ°Ð±Ð¾ÑÑ' : 'Ð£ Ð²Ð°Ñ Ð¿Ð¾ÐºÐ° Ð½ÐµÑ Ð´Ð¾ÑÑÑÐ¿Ð° Ð½Ð¸ Ðº Ð¾Ð´Ð½Ð¾Ð¼Ñ Ð¿ÑÐ¾ÐµÐºÑÑ â Ð¿Ð¾Ð¿ÑÐ¾ÑÐ¸ÑÐµ ÐÐÐÐ° Ð´Ð¾Ð±Ð°Ð²Ð¸ÑÑ Ð²Ð°Ñ'}</div>
                    {isGip && <button className="btn btn-primary" onClick={() => { setNewProject({ name: "", code: "", deadline: "", status: "active", depts: [] }); setShowNewProject(true); }}>+ Ð¡Ð¾Ð·Ð´Ð°ÑÑ Ð¿ÑÐ¾ÐµÐºÑ</button>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== TASKS KANBAN ===== */}
          {screen === "tasks" && (
            <div className="screen-fade">
              <div className="page-header"><div><div className="page-label">ÐÐ¾Ð¸ Ð·Ð°Ð´Ð°ÑÐ¸</div><div className="page-title">ÐÐ°Ð´Ð°ÑÐ¸ Ð¿Ð¾ ÑÑÐ°ÑÑÑÑ</div></div></div>

              {/* Ð¤Ð¸Ð»ÑÑÑÑ */}
              <div className="filters-bar">
                <div className="search-wrap" style={{ flex: "1 1 200px" }}>
                  <span className="search-icon">ð</span>
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="ÐÐ¾Ð¸ÑÐº Ð·Ð°Ð´Ð°Ñ..."
                    className="search-input" style={getInp(C, { paddingLeft: 40, fontSize: 12, borderRadius: 10, background: C.surface })} />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="filter-chip" style={{ border: `1.5px solid ${C.border}`, background: C.surface, color: C.textDim, fontFamily: "inherit", cursor: "pointer", minWidth: 140 }}>
                  <option value="all">â ÐÑÐµ ÑÑÐ°ÑÑÑÑ</option>
                  {Object.entries(statusMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="filter-chip" style={{ border: `1.5px solid ${C.border}`, background: C.surface, color: C.textDim, fontFamily: "inherit", cursor: "pointer", minWidth: 140 }}>
                  <option value="all">â ÐÑÐ¸Ð¾ÑÐ¸ÑÐµÑ</option>
                  <option value="high">ð´ ÐÑÑÐ¾ÐºÐ¸Ð¹</option><option value="medium">ð¡ Ð¡ÑÐµÐ´Ð½Ð¸Ð¹</option><option value="low">âª ÐÐ¸Ð·ÐºÐ¸Ð¹</option>
                </select>
                {(isGip || isLead) && (
                  <select value={filterAssigned} onChange={e => setFilterAssigned(e.target.value)} className="filter-chip" style={{ border: `1.5px solid ${C.border}`, background: C.surface, color: C.textDim, fontFamily: "inherit", cursor: "pointer", minWidth: 150 }}>
                    <option value="all">â ÐÑÐ¿Ð¾Ð»Ð½Ð¸ÑÐµÐ»Ñ</option>
                    {appUsers.filter(u => u.role === "engineer" || u.role === "lead").map(u => <option key={u.id} value={String(u.id)}>{u.full_name}</option>)}
                  </select>
                )}
                {(searchQuery || filterStatus !== "all" || filterPriority !== "all" || filterAssigned !== "all") && (
                  <button className="btn btn-danger btn-sm" onClick={() => { setSearchQuery(""); setFilterStatus("all"); setFilterPriority("all"); setFilterAssigned("all"); }}>â Ð¡Ð±ÑÐ¾ÑÐ¸ÑÑ</button>
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

          {/* ===== SPECIFICATIONS ===== */}
          {screen === "specifications" && (
            <div className="screen-fade">
              {activeProject ? (
                <SpecificationsTab
                  C={C}
                  token={token!}
                  project={activeProject}
                  projects={projects}
                  onProjectChange={(p: any) => setActiveProject(p)}
                  currentUser={currentUserData}
                  isGip={isGip}
                  isLead={isLead}
                />
              ) : (
                <div className="empty-state" style={{ padding: 40 }}>ÐÐµÑ Ð°ÐºÑÐ¸Ð²Ð½Ð¾Ð³Ð¾ Ð¿ÑÐ¾ÐµÐºÑÐ° Ð´Ð»Ñ ÑÐ¿ÐµÑÐ¸ÑÐ¸ÐºÐ°ÑÐ¸Ð¸</div>
              )}
            </div>
          )}

          {/* ===== NORMATIVE KB (Phase 7) ===== */}
          {screen === "normative" && (
            <div style={{ padding: 40, display: "flex", flexDirection: "column", gap: 24, height: '100%', overflow: 'auto' }}>
              {/* Duplicate conflict modal */}
              {showDupModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ background: C.surface, borderRadius: 16, padding: 32, width: 520, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 6 }}>ÐÐ±Ð½Ð°ÑÑÐ¶ÐµÐ½Ñ Ð´ÑÐ±Ð»Ð¸ÐºÐ°ÑÑ</div>
                    <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>Ð¡Ð»ÐµÐ´ÑÑÑÐ¸Ðµ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÑ ÑÐ¶Ðµ ÑÑÑÐµÑÑÐ²ÑÑÑ Ð² Ð±Ð°Ð·Ðµ. ÐÑÐ±ÐµÑÐ¸ÑÐµ Ð´ÐµÐ¹ÑÑÐ²Ð¸Ðµ Ð´Ð»Ñ ÐºÐ°Ð¶Ð´Ð¾Ð³Ð¾:</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                      <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => {
                        const all: Record<string, 'overwrite' | 'skip'> = {};
                        dupConflicts.forEach(c => { all[c.file.name] = 'skip'; });
                        setDupDecisions(all);
                      }}>ÐÑÐ¾Ð¿ÑÑÑÐ¸ÑÑ Ð²ÑÐµ</button>
                      <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => {
                        const all: Record<string, 'overwrite' | 'skip'> = {};
                        dupConflicts.forEach(c => { all[c.file.name] = 'overwrite'; });
                        setDupDecisions(all);
                      }}>ÐÐµÑÐµÐ·Ð°Ð¿Ð¸ÑÐ°ÑÑ Ð²ÑÐµ</button>
                    </div>
                    {dupConflicts.map(({ file }) => (
                      <div key={file.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ flex: 1, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.name}>{file.name}</div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => setDupDecisions(d => ({ ...d, [file.name]: 'skip' }))}
                            style={{ padding: '4px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, cursor: 'pointer', background: dupDecisions[file.name] === 'skip' ? C.accent : C.surface2, color: dupDecisions[file.name] === 'skip' ? '#fff' : C.text }}>
                            ÐÑÐ¾Ð¿ÑÑÑÐ¸ÑÑ
                          </button>
                          <button onClick={() => setDupDecisions(d => ({ ...d, [file.name]: 'overwrite' }))}
                            style={{ padding: '4px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, cursor: 'pointer', background: dupDecisions[file.name] === 'overwrite' ? '#EF4444' : C.surface2, color: dupDecisions[file.name] === 'overwrite' ? '#fff' : C.text }}>
                            ÐÐµÑÐµÐ·Ð°Ð¿Ð¸ÑÐ°ÑÑ
                          </button>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary" onClick={() => { setShowDupModal(false); setPendingFiles([]); }}>ÐÑÐ¼ÐµÐ½Ð°</button>
                      <button className="btn btn-primary" onClick={async () => {
                        setShowDupModal(false);
                        const conflictFiles = dupConflicts.map(c => c.file);
                        addNotification(`ÐÐ±ÑÐ°Ð±Ð°ÑÑÐ²Ð°Ñ ${conflictFiles.length} ÑÐ°Ð¹Ð»Ð¾Ð²...`, 'info');
                        await doUpload(conflictFiles, dupDecisions);
                        setPendingFiles([]);
                      }}>ÐÑÐ¾Ð´Ð¾Ð»Ð¶Ð¸ÑÑ</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="page-header">
                <div>
                  <div className="page-label">ÐÐ¾ÑÐ¼Ð°ÑÐ¸Ð²Ð½Ð°Ñ Ð±Ð°Ð·Ð° (RAG)</div>
                  <div className="page-title">ÐÐ¾ÐºÐ°Ð»ÑÐ½ÑÐµ ÑÐµÐ³Ð»Ð°Ð¼ÐµÐ½ÑÑ Ð¸ ÐÐÐ¡Ð¢Ñ</div>
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
                          addNotification(`ÐÐ°Ð³ÑÑÐ¶Ð°Ñ ${noConflict.length} Ð½Ð¾Ð²ÑÑ ÑÐ°Ð¹Ð»Ð¾Ð²...`, 'info');
                          await doUpload(noConflict, {});
                        }
                      } else {
                        addNotification(`ÐÐ°ÑÐ¸Ð½Ð°Ñ Ð·Ð°Ð³ÑÑÐ·ÐºÑ (${files.length} ÑÑ.)...`, 'info');
                        await doUpload(files, {});
                      }
                    }} />
                    <button className="btn btn-primary" onClick={() => document.getElementById('normative-upload')?.click()}>+ ÐÐ°Ð³ÑÑÐ·Ð¸ÑÑ PDF/DOCX</button>
                    <button className="btn btn-secondary" onClick={async () => {
                      const pending = normativeDocs.filter(d => d.status === 'pending' || d.status === 'processing' || d.status === 'error');
                      if (pending.length === 0) { addNotification('ÐÑÐµ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÑ ÑÐ¶Ðµ Ð¿ÑÐ¾Ð¸Ð½Ð´ÐµÐºÑÐ¸ÑÐ¾Ð²Ð°Ð½Ñ', 'info'); return; }
                                            addNotification(`ÐÐ°Ð¿ÑÑÐºÐ°Ñ Ð¸Ð½Ð´ÐµÐºÑÐ°ÑÐ¸Ñ Ð´Ð»Ñ ${pending.length} Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ¾Ð²...`, 'info');
                      const BATCH = 2; // Reduced batch size for better stability
                      let done = 0;
                      let errors = 0;
                      for (let i = 0; i < pending.length; i += BATCH) {
                        const batch = pending.slice(i, i + BATCH);
                        const results = await Promise.all(batch.map(async (doc) => {
                          try {
                            await apiPost('/api/normative-docs', { action: 'vectorize', doc_id: doc.id });
                            return { success: true };
                          } catch (err) {
                            console.error(`Error indexing ${doc.name}:`, err);
                            return { success: false };
                          }
                        }));
                        
                        done += results.filter(r => r.success).length;
                        errors += results.filter(r => !r.success).length;
                        
                        addNotification(`ÐÐ±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ðµ: ${done} Ð³Ð¾ÑÐ¾Ð²Ð¾, ${errors} Ð¾ÑÐ¸Ð±Ð¾Ðº. ÐÑÐµÐ³Ð¾: ${pending.length}`, errors > 0 ? 'warning' : 'info');
                        await loadNormativeDocs();
                      }
                      addNotification(`ÐÐ±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ðµ Ð·Ð°Ð²ÐµÑÑÐµÐ½Ð¾. Ð£ÑÐ¿ÐµÑÐ½Ð¾: ${done}, ÐÑÐ¸Ð±Ð¾Ðº: ${errors}`, errors > 0 ? 'warning' : 'success');
                    }}>ð ÐÐ±Ð½Ð¾Ð²Ð¸ÑÑ Ð¿Ð¾Ð¸ÑÐº Ð¿Ð¾ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°Ð¼</button>
                  </div>
                )}
              </div>

              {/* AI Search bar */}
              <div style={{
                background: C.surface,
                border: `1px solid ${useKb ? C.accent : C.border}`,
                borderRadius: 14, padding: '18px 20px', marginBottom: 4,
                boxShadow: useKb ? `0 0 0 3px ${C.accent}18` : '0 1px 3px rgba(0,0,0,0.10)',
                transition: 'all 0.25s'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>â AI-Ð¿Ð¾Ð¸ÑÐº Ð¿Ð¾ Ð½Ð¾ÑÐ¼Ð°ÑÐ¸Ð²ÐºÐµ</span>
                  {/* RAG toggle */}
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: C.textMuted }}>RAG-Ð¿Ð¾Ð¸ÑÐº</span>
                    <div onClick={() => setUseKb(!useKb)} style={{ width: 36, height: 20, borderRadius: 10, background: useKb ? C.accent : C.border, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: useKb ? 18 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <input
                    placeholder={useKb ? 'Ð¡ÐµÐ¼Ð°Ð½ÑÐ¸ÑÐµÑÐºÐ¸Ð¹ Ð¿Ð¾Ð¸ÑÐº Ð¿Ð¾ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°Ð¼ (RAG)...' : 'ÐÐ¾Ð¸ÑÐº Ð¿Ð¾ ÑÐµÐºÑÑÑ Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ¾Ð²...'}
                    value={normSearchQuery}
                    onChange={e => { setNormSearchQuery(e.target.value); if (!e.target.value.trim()) setNormSearchResults(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') searchNormative(normSearchQuery); }}
                    style={{ ...getInp(C), flex: 1, height: 40, fontSize: 14 }}
                  />
                  {normSearchResults !== null && (
                    <button className="btn btn-secondary" style={{ height: 40, fontSize: 13 }} onClick={() => { setNormSearchQuery(''); setNormSearchResults(null); }}>â Ð¡Ð±ÑÐ¾ÑÐ¸ÑÑ</button>
                  )}
                  <button className="btn btn-primary" style={{ height: 40, width: 40, padding: 0 }} onClick={() => searchNormative(normSearchQuery)} disabled={normSearching}>
                    {normSearching ? 'â¦' : 'ð'}
                  </button>
                </div>
              </div>

              {/* Search results */}
              {normSearchResults !== null ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
                    {normSearchResults.length === 0 ? 'ÐÐ¸ÑÐµÐ³Ð¾ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½Ð¾' : `ÐÐ°Ð¹Ð´ÐµÐ½Ð¾ Ð² ${normSearchResults.length} Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°Ñ:`}
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
                    // NORM-01: Ð½Ð°Ð¹ÑÐ¸ Ð´Ð¾ÐºÑÐ¼ÐµÐ½Ñ Ð¿Ð¾ doc_id ÑÑÐ¾Ð±Ñ Ð¼Ð¾Ð¶Ð½Ð¾ Ð±ÑÐ»Ð¾ Ð¾ÑÐºÑÑÑÑ
                    const matchedDoc = normativeDocs.find((d: any) => d.id === r.doc_id || d.name === r.doc_name);
                    return (
                      <div key={r.id}
                        onClick={() => matchedDoc && openNormativeDoc(matchedDoc)}
                        style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.surface : C.surface2, cursor: matchedDoc ? 'pointer' : 'default', transition: 'background 0.15s' }}
                        onMouseEnter={e => { if (matchedDoc) e.currentTarget.style.background = C.accent + '15'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? C.surface : C.surface2; }}
                        title={matchedDoc ? 'ÐÐ»Ð¸ÐºÐ½Ð¸ ÑÑÐ¾Ð±Ñ Ð¾ÑÐºÑÑÑÑ Ð´Ð¾ÐºÑÐ¼ÐµÐ½Ñ' : ''}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <span style={{ fontSize: 15 }}>{r.doc_name?.toLowerCase().endsWith('.pdf') ? 'ð' : 'ð'}</span>
                          <span style={{ fontWeight: 600, fontSize: 13, color: matchedDoc ? C.accent : C.text, flex: 1, textDecoration: matchedDoc ? 'underline' : 'none' }}>{r.doc_name}{matchedDoc && ' â'}</span>
                          {pct != null && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: pctColor, background: pctColor + '18', padding: '2px 10px', borderRadius: 10 }}>
                              {pct}% ÑÐµÐ»ÐµÐ².
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
                /* All docs list â compact rows */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                  {normativeDocs.length === 0 ? (
                    <div style={{ padding: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                      <div style={{ fontSize: 40 }}>ð</div>
                      <div style={{ fontWeight: 700, color: C.text }}>ÐÐ°Ð·Ð° Ð·Ð½Ð°Ð½Ð¸Ð¹ Ð¿ÑÑÑÐ°</div>
                      <div style={{ fontSize: 13, color: C.textMuted }}>ÐÐ°Ð³ÑÑÐ·Ð¸ÑÐµ PDF, DOCX Ð¸Ð»Ð¸ TXT. ÐÐ-Ð°Ð³ÐµÐ½Ñ ÑÐ¼Ð¾Ð¶ÐµÑ Ð¸ÑÐºÐ°ÑÑ Ð¿Ð¾ Ð½Ð¸Ð¼ Ð¸ Ð´Ð°Ð²Ð°ÑÑ Ð¾ÑÐ²ÐµÑÑ Ñ Ð¸ÑÑÐ¾ÑÐ½Ð¸ÐºÐ°Ð¼Ð¸.</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 120px 100px 130px', gap: 0, padding: '8px 16px', background: C.surface2, borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <div></div><div>ÐÐ¾ÐºÑÐ¼ÐµÐ½Ñ</div><div>ÐÐ°ÑÐ°</div><div>Ð¢Ð¸Ð¿</div><div>Ð¡ÑÐ°ÑÑÑ</div>
                      </div>
                      {normativeDocs.map((doc, i) => (
                        <div key={doc.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 120px 100px 130px', gap: 0, padding: '10px 16px', alignItems: 'center', background: i % 2 === 0 ? C.surface : C.surface2, borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 16 }}>{doc.file_type?.includes('pdf') ? 'ð' : 'ð'}</div>
                          <div
                            style={{ fontSize: 13, color: C.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12, cursor: 'pointer', textDecoration: 'underline' }}
                            title={doc.name}
                            onClick={async () => {
                              if (!doc.file_path) { addNotification('ÐÑÑÑ Ðº ÑÐ°Ð¹Ð»Ñ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½', 'warning'); return; }
                              const isPdf = doc.file_type?.includes('pdf') || doc.name?.toLowerCase().endsWith('.pdf');
                              if (isPdf) {
                                // ÐÐ¾Ð»ÑÑÐ¸ÑÑ Ð¿Ð¾Ð´Ð¿Ð¸ÑÐ°Ð½Ð½ÑÐ¹ URL Ð´Ð»Ñ PDF Ð¸ Ð¾ÑÐºÑÑÑÑ Ð² Ð½Ð¾Ð²Ð¾Ð¹ Ð²ÐºÐ»Ð°Ð´ÐºÐµ
                                const signedUrl = await signStorageUrl('normative-docs', doc.file_path, 3600);
                                if (signedUrl) window.open(signedUrl, '_blank');
                                else addNotification('ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ Ð¿Ð¾Ð»ÑÑÐ¸ÑÑ ÑÑÑÐ»ÐºÑ Ð½Ð° ÑÐ°Ð¹Ð»', 'warning');
                              } else {
                                // DOCX/DOC â ÑÐºÐ°ÑÐ°ÑÑ ÑÐµÑÐµÐ· Ð¿Ð¾Ð´Ð¿Ð¸ÑÐ°Ð½Ð½ÑÐ¹ URL
                                const signedUrl = await signStorageUrl('normative-docs', doc.file_path, 3600);
                                if (signedUrl) {
                                  const a = document.createElement('a');
                                  a.href = signedUrl;
                                  a.download = doc.name;
                                  a.click();
                                } else addNotification('ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ Ð¿Ð¾Ð»ÑÑÐ¸ÑÑ ÑÑÑÐ»ÐºÑ Ð½Ð° ÑÐ°Ð¹Ð»', 'warning');
                              }
                            }}
                          >{doc.name}</div>
                          <div style={{ fontSize: 12, color: C.textMuted }}>{new Date(doc.created_at).toLocaleDateString('ru-RU')}</div>
                          <div style={{ fontSize: 11, color: C.textMuted }}>{doc.file_type?.includes('pdf') ? 'PDF' : doc.file_type?.includes('word') ? 'DOCX' : 'DOC'}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: C.textMuted }}>
                              {doc.status === 'ready' ? 'â ÐÐ¾ÑÐ¾Ð²' : doc.status === 'processing' ? 'âï¸ ÐÐ±ÑÐ°Ð±Ð°ÑÑÐ²Ð°ÐµÑÑÑ...' : doc.status === 'error' ? 'â ÐÐµ ÑÐ´Ð°Ð»Ð¾ÑÑ Ð¾Ð±ÑÐ°Ð±Ð¾ÑÐ°ÑÑ' : 'ð Ð Ð¾ÑÐµÑÐµÐ´Ð¸'}
                            </span>
                            {(isGip || isAdmin) && (
                              <button style={{ marginLeft: 'auto', fontSize: 11, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                                onClick={() => {
                                  if (!window.confirm(`Ð£Ð´Ð°Ð»Ð¸ÑÑ Ð´Ð¾ÐºÑÐ¼ÐµÐ½Ñ "${doc.name}"?`)) return;
                                  if (!window.confirm('ÐÐ¾Ð´ÑÐ²ÐµÑÐ´Ð¸ÑÐµ ÐµÑÑ ÑÐ°Ð·: Ð´Ð¾ÐºÑÐ¼ÐµÐ½Ñ Ð¸ Ð²ÑÐµ ÐµÐ³Ð¾ Ð´Ð°Ð½Ð½ÑÐµ Ð±ÑÐ´ÑÑ ÑÐ´Ð°Ð»ÐµÐ½Ñ Ð±ÐµÐ·Ð²Ð¾Ð·Ð²ÑÐ°ÑÐ½Ð¾.')) return;
                                  del(`normative_docs?id=eq.${doc.id}`, token!).then(loadNormativeDocs);
                                }}>â</button>
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


          {/* ===== CALCULATIONS SCREEN ===== */}
          {screen === "calculations" && (
            <div className="screen-fade" style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
              {/* Left sidebar: category filter + card grid */}
              <div style={{ width: activeCalc ? 380 : '100%', minWidth: 280, borderRight: activeCalc ? `1px solid ${C.border}` : 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.25s' }}>
                {/* Search + filters */}
                <div style={{ padding: '18px 18px 12px', borderBottom: `1px solid ${C.border}`, background: C.surface }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: "'Manrope',sans-serif" }}>ÐÐ¸Ð±Ð»Ð¸Ð¾ÑÐµÐºÐ° ÑÐ°ÑÑÑÑÐ¾Ð²</div>
                  <input
                    placeholder="ÐÐ¾Ð¸ÑÐº ÑÐ°ÑÑÑÑÐ°..."
                    value={calcSearch}
                    onChange={e => setCalcSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                  {/* Category pills */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    <button
                      onClick={() => setCalcActiveCat(null)}
                      style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', background: calcActiveCat === null ? C.accent : C.surface2, color: calcActiveCat === null ? '#fff' : C.textMuted, transition: 'all 0.15s' }}
                    >ÐÑÐµ</button>
                    {calcAllCats.filter(cat => calcTemplates.some(t => t.cat === cat)).map(cat => {
                      const CALC_CAT_COLORS: Record<string,string> = { 'Ð¢Ð¥': '#2b5bb5', 'Ð¢Ð¢': '#2f9e62', 'ÐÐ': '#2f9e62', 'Ð­Ð': '#f5a623', 'ÐÐ': '#06b6d4', 'ÐÐ / ÐÐ': '#a855f7', 'ÐÐ': '#a855f7', 'ÐÐ': '#a855f7', 'ÐÐ': '#ef4444', 'Ð': '#22c55e', 'ÐÐÐÐ¸Ð': '#8b5cf6' };
                      const cc = CALC_CAT_COLORS[cat] || C.accent;
                      const isActive = calcActiveCat === cat;
                      return (
                        <button key={cat} onClick={() => setCalcActiveCat(isActive ? null : cat)}
                          style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', background: isActive ? cc : cc + '20', color: isActive ? '#fff' : cc, transition: 'all 0.15s' }}>
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cards grid */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
                  {(() => {
                    const CALC_CAT_COLORS: Record<string,string> = { 'Ð¢Ð¥': '#2b5bb5', 'Ð¢Ð¢': '#2f9e62', 'ÐÐ': '#2f9e62', 'Ð­Ð': '#f5a623', 'ÐÐ': '#06b6d4', 'ÐÐ / ÐÐ': '#a855f7', 'ÐÐ': '#a855f7', 'ÐÐ': '#a855f7', 'ÐÐ': '#ef4444', 'Ð': '#22c55e', 'ÐÐÐÐ¸Ð': '#8b5cf6' };
                    const filtered = calcTemplates.filter(t => {
                      const matchCat = !calcActiveCat || t.cat === calcActiveCat;
                      const q = calcSearch.toLowerCase().trim();
                      const matchQ = !q || t.name.toLowerCase().includes(q) || (t.desc || '').toLowerCase().includes(q) || t.cat.toLowerCase().includes(q);
                      return matchCat && matchQ;
                    });
                    if (filtered.length === 0) return (
                      <div style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Ð Ð°ÑÑÑÑÐ¾Ð² Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½Ð¾</div>
                    );
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: activeCalc ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                        {filtered.map(calc => {
                          const catColor = CALC_CAT_COLORS[calc.cat] || C.accent;
                          const isActive = activeCalc === calc.id;
                          return (
                            <div key={calc.id}
                              onClick={() => setActiveCalc(isActive ? null : calc.id)}
                              style={{
                                background: isActive ? (catColor + '10') : C.surface,
                                border: isActive ? `1px solid ${catColor}60` : `1px solid ${C.border}`,
                                borderRadius: 12, padding: '16px 18px', cursor: 'pointer',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                                transition: 'all 0.22s', borderTop: `3px solid ${catColor}`,
                                position: 'relative', overflow: 'hidden'
                              }}>
                              {/* Badge + standard */}
                              <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 9 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, background: catColor + '20', color: catColor, padding: '2px 8px', borderRadius: 20 }}>{calc.cat}</span>
                                <span style={{ fontSize: 9, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{calc.normativeReference}</span>
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 5, lineHeight: 1.3, fontFamily: "'Manrope',sans-serif" }}>{calc.name}</div>
                              <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>{calc.desc}</div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Right panel: CalculationView detail */}
              {activeCalc && (
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <CalculationView calcId={activeCalc} C={C} />
                </div>
              )}
            </div>
          )}

          {/* ===== STANDARDS RETRIEVAL (Pilot Phase) ===== */}
          {screen === "standards" && (
            <StandardsSearch />
          )}

        </div>
      </div>
      <ToastContainer notifications={notifications} onRemove={removeNotification} />

      {/* ââ Mobile Bottom Navigation ââ */}
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
