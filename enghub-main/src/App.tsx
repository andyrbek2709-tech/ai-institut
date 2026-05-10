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

// ConferenceRoom legacy ÃÂ¸ÃÂ¼ÃÂ¿ÃÂ¾ÃÂÃÂ ÃÂÃÂ´ÃÂ°ÃÂ»ÃÂÃÂ½ 2026-04-27 Ã¢ÂÂ ÃÂ·ÃÂ°ÃÂ¼ÃÂµÃÂ½ÃÂµÃÂ½ÃÂ¾ ÃÂ½ÃÂ° MeetingRoomPage.
// ÃÂ¡ÃÂÃÂ°ÃÂÃÂ°ÃÂ ÃÂÃÂµÃÂ°ÃÂ»ÃÂ¸ÃÂ·ÃÂ°ÃÂÃÂ¸ÃÂ ÃÂ»ÃÂµÃÂ¶ÃÂ¸ÃÂ ÃÂÃÂÃÂ´ÃÂ¾ÃÂ¼ ÃÂºÃÂ°ÃÂº ConferenceRoom.legacy.tsx (DEPRECATED).
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
    title: "Ã°ÂÂÂ£ ÃÂ¡ÃÂ¾ÃÂ²ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂµ",
    sections: [
      { heading: "ÃÂ§ÃÂÃÂ¾ ÃÂÃÂÃÂ¾", text: "ÃÂÃÂ¾ÃÂ»ÃÂ¾ÃÂÃÂ¾ÃÂ²ÃÂÃÂµ ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ ÃÂ² ÃÂÃÂµÃÂ°ÃÂ»ÃÂÃÂ½ÃÂ¾ÃÂ¼ ÃÂ²ÃÂÃÂµÃÂ¼ÃÂµÃÂ½ÃÂ¸ ÃÂ¿ÃÂÃÂÃÂ¼ÃÂ¾ ÃÂ²ÃÂ½ÃÂÃÂÃÂÃÂ¸ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ°. ÃÂÃÂÃÂµ ÃÂÃÂÃÂ°ÃÂÃÂÃÂ½ÃÂ¸ÃÂºÃÂ¸ ÃÂ²ÃÂ¸ÃÂ´ÃÂÃÂ ÃÂÃÂ°ÃÂ ÃÂ¸ ÃÂ¸ÃÂÃÂÃÂ¾ÃÂÃÂ¸ÃÂ ÃÂ¿ÃÂµÃÂÃÂµÃÂ³ÃÂ¾ÃÂ²ÃÂ¾ÃÂÃÂ¾ÃÂ²." },
      { heading: "ÃÂÃÂ°ÃÂº ÃÂ²ÃÂ¾ÃÂ¹ÃÂÃÂ¸", text: "ÃÂÃÂ°ÃÂ¶ÃÂ¼ÃÂ¸ÃÂÃÂµ ÃÂ«ÃÂÃÂ¾ÃÂ¹ÃÂÃÂ¸ ÃÂ² ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂµÃÂ». ÃÂÃÂ¾ÃÂ¶ÃÂ½ÃÂ¾ ÃÂ²ÃÂºÃÂ»ÃÂÃÂÃÂ¸ÃÂÃÂ ÃÂ¼ÃÂ¸ÃÂºÃÂÃÂ¾ÃÂÃÂ¾ÃÂ½ (Ã°ÂÂÂ) ÃÂ¸ ÃÂ´ÃÂµÃÂ¼ÃÂ¾ÃÂ½ÃÂÃÂÃÂÃÂ°ÃÂÃÂ¸ÃÂ ÃÂÃÂºÃÂÃÂ°ÃÂ½ÃÂ° (Ã°ÂÂÂ¥)." },
      { heading: "ÃÂÃÂÃÂ¸ÃÂ³ÃÂ»ÃÂ°ÃÂÃÂ¸ÃÂÃÂ ÃÂÃÂÃÂ°ÃÂÃÂÃÂ½ÃÂ¸ÃÂºÃÂ¾ÃÂ²", text: "ÃÂÃÂ°ÃÂ¶ÃÂ¼ÃÂ¸ÃÂÃÂµ ÃÂºÃÂ½ÃÂ¾ÃÂ¿ÃÂºÃÂ ÃÂ«ÃÂÃÂÃÂ¸ÃÂ³ÃÂ»ÃÂ°ÃÂÃÂ¸ÃÂÃÂÃÂ» Ã¢ÂÂ ÃÂ²ÃÂÃÂ±ÃÂµÃÂÃÂ¸ÃÂÃÂµ ÃÂÃÂ¾ÃÂÃÂÃÂÃÂ´ÃÂ½ÃÂ¸ÃÂºÃÂ¾ÃÂ² ÃÂ¸ÃÂ· ÃÂÃÂ¿ÃÂ¸ÃÂÃÂºÃÂ° Ã¢ÂÂ ÃÂ½ÃÂ°ÃÂ¶ÃÂ¼ÃÂ¸ÃÂÃÂµ ÃÂ«ÃÂÃÂÃÂ¿ÃÂÃÂ°ÃÂ²ÃÂ¸ÃÂÃÂÃÂ». ÃÂ£ ÃÂ½ÃÂ¸ÃÂ ÃÂ¿ÃÂ¾ÃÂÃÂ²ÃÂ¸ÃÂÃÂÃÂ ÃÂ²ÃÂÃÂ¿ÃÂ»ÃÂÃÂ²ÃÂ°ÃÂÃÂÃÂµÃÂµ ÃÂÃÂ²ÃÂµÃÂ´ÃÂ¾ÃÂ¼ÃÂ»ÃÂµÃÂ½ÃÂ¸ÃÂµ." },
      { heading: "ÃÂÃÂÃÂÃÂ¾ÃÂ´", text: "ÃÂÃÂ½ÃÂ¾ÃÂ¿ÃÂºÃÂ° ÃÂ«ÃÂÃÂ¾ÃÂºÃÂ¸ÃÂ½ÃÂÃÂÃÂÃÂ» ÃÂ·ÃÂ°ÃÂ²ÃÂµÃÂÃÂÃÂ°ÃÂµÃÂ ÃÂ²ÃÂ°ÃÂÃÂµ ÃÂÃÂÃÂ°ÃÂÃÂÃÂ¸ÃÂµ. ÃÂ§ÃÂ°ÃÂ ÃÂ¸ ÃÂ¸ÃÂÃÂÃÂ¾ÃÂÃÂ¸ÃÂ ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ ÃÂÃÂ¾ÃÂÃÂÃÂ°ÃÂ½ÃÂÃÂÃÂÃÂÃÂ." },
    ],
  },
  tasks: {
    title: "Ã¢ÂÂ ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸",
    sections: [
      { heading: "ÃÂ§ÃÂÃÂ¾ ÃÂÃÂÃÂ¾", text: "ÃÂ¡ÃÂ¿ÃÂ¸ÃÂÃÂ¾ÃÂº ÃÂ²ÃÂÃÂµÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂ ÃÂ¿ÃÂ¾ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ ÃÂ ÃÂ½ÃÂ°ÃÂ·ÃÂ½ÃÂ°ÃÂÃÂµÃÂ½ÃÂ¸ÃÂµÃÂ¼ ÃÂ¾ÃÂÃÂ²ÃÂµÃÂÃÂÃÂÃÂ²ÃÂµÃÂ½ÃÂ½ÃÂÃÂ, ÃÂÃÂÃÂ¾ÃÂºÃÂ°ÃÂ¼ÃÂ¸ ÃÂ¸ ÃÂ¿ÃÂÃÂ¸ÃÂ¾ÃÂÃÂ¸ÃÂÃÂµÃÂÃÂ°ÃÂ¼ÃÂ¸." },
      { heading: "ÃÂ¡ÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂ½ÃÂ¸ÃÂµ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸", text: "ÃÂÃÂÃÂ ÃÂ½ÃÂ°ÃÂ¶ÃÂ¸ÃÂ¼ÃÂ°ÃÂµÃÂ ÃÂ«+ ÃÂÃÂ¾ÃÂ²ÃÂ°ÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ°ÃÂ», ÃÂ·ÃÂ°ÃÂ¿ÃÂ¾ÃÂ»ÃÂ½ÃÂÃÂµÃÂ ÃÂ½ÃÂ°ÃÂ·ÃÂ²ÃÂ°ÃÂ½ÃÂ¸ÃÂµ, ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ», ÃÂ¸ÃÂÃÂ¿ÃÂ¾ÃÂ»ÃÂ½ÃÂ¸ÃÂÃÂµÃÂ»ÃÂ, ÃÂÃÂÃÂ¾ÃÂº ÃÂ¸ ÃÂ¿ÃÂÃÂ¸ÃÂ¾ÃÂÃÂ¸ÃÂÃÂµÃÂ." },
      { heading: "ÃÂÃÂ¸ÃÂ·ÃÂ½ÃÂµÃÂ½ÃÂ½ÃÂÃÂ¹ ÃÂÃÂ¸ÃÂºÃÂ»", text: "ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ° ÃÂ¿ÃÂÃÂ¾ÃÂÃÂ¾ÃÂ´ÃÂ¸ÃÂ ÃÂÃÂÃÂ°ÃÂ´ÃÂ¸ÃÂ¸: ÃÂÃÂ¶ÃÂ¸ÃÂ´ÃÂ°ÃÂµÃÂ Ã¢ÂÂ ÃÂ ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂµ Ã¢ÂÂ ÃÂÃÂ° ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂµ ÃÂÃÂÃÂºÃÂ¾ÃÂ²ÃÂ¾ÃÂ´ÃÂ¸ÃÂÃÂµÃÂ»ÃÂ Ã¢ÂÂ ÃÂÃÂ° ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂµ ÃÂÃÂÃÂÃÂ° Ã¢ÂÂ ÃÂÃÂ°ÃÂ²ÃÂµÃÂÃÂÃÂµÃÂ½ÃÂ°. ÃÂÃÂ°ÃÂ¶ÃÂ´ÃÂÃÂ¹ ÃÂÃÂÃÂ°ÃÂÃÂÃÂ½ÃÂ¸ÃÂº ÃÂ¿ÃÂµÃÂÃÂµÃÂ²ÃÂ¾ÃÂ´ÃÂ¸ÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ ÃÂ² ÃÂÃÂ»ÃÂµÃÂ´ÃÂÃÂÃÂÃÂ¸ÃÂ¹ ÃÂÃÂÃÂ°ÃÂÃÂÃÂ ÃÂºÃÂ½ÃÂ¾ÃÂ¿ÃÂºÃÂ¾ÃÂ¹ ÃÂ² ÃÂºÃÂ°ÃÂÃÂÃÂ¾ÃÂÃÂºÃÂµ." },
      { heading: "ÃÂ¤ÃÂ¸ÃÂ»ÃÂÃÂÃÂÃÂ", text: "ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸ ÃÂ¼ÃÂ¾ÃÂ¶ÃÂ½ÃÂ¾ ÃÂÃÂ¸ÃÂ»ÃÂÃÂÃÂÃÂ¾ÃÂ²ÃÂ°ÃÂÃÂ ÃÂ¿ÃÂ¾ ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂ ÃÂÃÂµÃÂÃÂµÃÂ· ÃÂ²ÃÂÃÂ¿ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂÃÂ¸ÃÂ¹ ÃÂÃÂ¿ÃÂ¸ÃÂÃÂ¾ÃÂº ÃÂ½ÃÂ°ÃÂ´ ÃÂÃÂ¿ÃÂ¸ÃÂÃÂºÃÂ¾ÃÂ¼ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂ." },
    ],
  },
  documents: {
    title: "Ã°ÂÂÂ ÃÂÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂÃÂ",
    sections: [
      { heading: "ÃÂ§ÃÂÃÂ¾ ÃÂÃÂÃÂ¾", text: "ÃÂÃÂÃÂµ ÃÂÃÂ°ÃÂ¹ÃÂ»ÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ°: ÃÂ¢ÃÂ, ÃÂ´ÃÂ¾ÃÂ¿ÃÂ¾ÃÂ»ÃÂ½ÃÂµÃÂ½ÃÂ¸ÃÂ, ÃÂ¿ÃÂÃÂ¾ÃÂÃÂ¸ÃÂµ ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂÃÂ. ÃÂÃÂ¾ÃÂÃÂÃÂÃÂ¿ÃÂ½ÃÂ ÃÂÃÂÃÂ°ÃÂÃÂÃÂ½ÃÂ¸ÃÂºÃÂ°ÃÂ¼ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ°." },
      { heading: "ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂºÃÂ°", text: "ÃÂÃÂ½ÃÂ¾ÃÂ¿ÃÂºÃÂ° ÃÂ«+ ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂ¸ÃÂÃÂ ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂÃÂ» Ã¢ÂÂ ÃÂ²ÃÂÃÂ±ÃÂµÃÂÃÂ¸ÃÂÃÂµ ÃÂÃÂ¸ÃÂ¿ (ÃÂ¢ÃÂ / ÃÂÃÂ¾ÃÂ¿ÃÂ¾ÃÂ»ÃÂ½ÃÂµÃÂ½ÃÂ¸ÃÂµ / ÃÂÃÂÃÂ¾ÃÂÃÂµÃÂµ) ÃÂ¸ ÃÂÃÂ°ÃÂ¹ÃÂ». ÃÂÃÂ¾ÃÂ´ÃÂ´ÃÂµÃÂÃÂ¶ÃÂ¸ÃÂ²ÃÂ°ÃÂÃÂÃÂÃÂ PDF, Word (doc/docx), Excel (xls/xlsx). ÃÂÃÂ°ÃÂºÃÂ ÃÂÃÂ°ÃÂ·ÃÂ¼ÃÂµÃÂ Ã¢ÂÂ 50 ÃÂÃÂ." },
      { heading: "ÃÂÃÂÃÂ¾ÃÂÃÂ¼ÃÂ¾ÃÂÃÂ", text: "ÃÂÃÂ²ÃÂ¾ÃÂ¹ÃÂ½ÃÂ¾ÃÂ¹ ÃÂºÃÂ»ÃÂ¸ÃÂº ÃÂ¸ÃÂ»ÃÂ¸ ÃÂºÃÂ½ÃÂ¾ÃÂ¿ÃÂºÃÂ° ÃÂ«ÃÂÃÂÃÂºÃÂÃÂÃÂÃÂÃÂ» ÃÂ½ÃÂ° PDF/Word/Excel Ã¢ÂÂ ÃÂ²ÃÂÃÂÃÂÃÂ¾ÃÂµÃÂ½ÃÂ½ÃÂÃÂ¹ preview. ÃÂÃÂ° DWG/ÃÂ¿ÃÂÃÂ¾ÃÂÃÂ¸ÃÂ Ã¢ÂÂ ÃÂÃÂºÃÂ°ÃÂÃÂ¸ÃÂ²ÃÂ°ÃÂ½ÃÂ¸ÃÂµ." },
      { heading: "ÃÂÃÂ·ÃÂ¾ÃÂ»ÃÂÃÂÃÂ¸ÃÂ", text: "ÃÂ¤ÃÂ°ÃÂ¹ÃÂ»ÃÂ ÃÂ²ÃÂ¸ÃÂ´ÃÂ½ÃÂ ÃÂÃÂ¾ÃÂ»ÃÂÃÂºÃÂ¾ ÃÂÃÂÃÂ°ÃÂÃÂÃÂ½ÃÂ¸ÃÂºÃÂ°ÃÂ¼ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ°. ÃÂÃÂÃÂ ÃÂ¸ ÃÂ°ÃÂ²ÃÂÃÂ¾ÃÂ ÃÂÃÂ°ÃÂ¹ÃÂ»ÃÂ° ÃÂ¼ÃÂ¾ÃÂ³ÃÂÃÂ ÃÂÃÂ´ÃÂ°ÃÂ»ÃÂ¸ÃÂÃÂ, ÃÂ¾ÃÂÃÂÃÂ°ÃÂ»ÃÂÃÂ½ÃÂÃÂµ Ã¢ÂÂ ÃÂÃÂ¾ÃÂ»ÃÂÃÂºÃÂ¾ ÃÂ¿ÃÂÃÂ¾ÃÂÃÂ¼ÃÂ°ÃÂÃÂÃÂ¸ÃÂ²ÃÂ°ÃÂÃÂ." },
    ],
  },
  drawings: {
    title: "Ã°ÂÂÂ ÃÂ§ÃÂµÃÂÃÂÃÂµÃÂ¶ÃÂ¸",
    sections: [
      { heading: "ÃÂ§ÃÂÃÂ¾ ÃÂÃÂÃÂ¾", text: "ÃÂ ÃÂµÃÂµÃÂÃÂÃÂ ÃÂ²ÃÂÃÂµÃÂ ÃÂÃÂµÃÂÃÂÃÂµÃÂ¶ÃÂµÃÂ¹ ÃÂ¸ ÃÂÃÂµÃÂÃÂ½ÃÂ¸ÃÂÃÂµÃÂÃÂºÃÂ¸ÃÂ ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂÃÂ¾ÃÂ² ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ°." },
      { heading: "ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂºÃÂ°", text: "ÃÂÃÂ½ÃÂ¾ÃÂ¿ÃÂºÃÂ° ÃÂ«+ ÃÂÃÂ¾ÃÂ±ÃÂ°ÃÂ²ÃÂ¸ÃÂÃÂÃÂ» ÃÂ¸ÃÂ»ÃÂ¸ ÃÂ¿ÃÂµÃÂÃÂµÃÂÃÂ°ÃÂÃÂ¸ÃÂÃÂµ ÃÂÃÂ°ÃÂ¹ÃÂ» (PDF, DWG). ÃÂ£ÃÂºÃÂ°ÃÂ¶ÃÂ¸ÃÂÃÂµ ÃÂ½ÃÂ¾ÃÂ¼ÃÂµÃÂ, ÃÂ½ÃÂ°ÃÂ·ÃÂ²ÃÂ°ÃÂ½ÃÂ¸ÃÂµ ÃÂ¸ ÃÂ¼ÃÂ°ÃÂÃÂºÃÂ." },
      { heading: "ÃÂÃÂµÃÂÃÂÃÂ¸ÃÂ¸", text: "ÃÂÃÂ° ÃÂºÃÂ°ÃÂ¶ÃÂ´ÃÂÃÂ¹ ÃÂÃÂµÃÂÃÂÃÂÃÂ¶ ÃÂ¼ÃÂ¾ÃÂ¶ÃÂ½ÃÂ¾ ÃÂ²ÃÂÃÂ¿ÃÂÃÂÃÂÃÂ¸ÃÂÃÂ ÃÂ½ÃÂ¾ÃÂ²ÃÂÃÂ ÃÂÃÂµÃÂ²ÃÂ¸ÃÂ·ÃÂ¸ÃÂ ÃÂÃÂµÃÂÃÂµÃÂ· ÃÂ²ÃÂºÃÂ»ÃÂ°ÃÂ´ÃÂºÃÂ ÃÂ«ÃÂ ÃÂµÃÂ²ÃÂ¸ÃÂ·ÃÂ¸ÃÂ¸ÃÂ» Ã¢ÂÂ ÃÂÃÂÃÂ°ÃÂÃÂÃÂµ ÃÂ²ÃÂµÃÂÃÂÃÂ¸ÃÂ¸ ÃÂÃÂ¾ÃÂÃÂÃÂ°ÃÂ½ÃÂÃÂÃÂÃÂÃÂ." },
      { heading: "ÃÂÃÂÃÂ¾ÃÂÃÂ¼ÃÂ¾ÃÂÃÂ", text: "ÃÂÃÂ°ÃÂ¶ÃÂ¼ÃÂ¸ÃÂÃÂµ ÃÂ½ÃÂ° ÃÂÃÂµÃÂÃÂÃÂÃÂ¶ Ã¢ÂÂ ÃÂ¾ÃÂÃÂºÃÂÃÂ¾ÃÂµÃÂÃÂÃÂ ÃÂ²ÃÂÃÂÃÂÃÂ¾ÃÂµÃÂ½ÃÂ½ÃÂÃÂ¹ ÃÂ¿ÃÂÃÂ¾ÃÂÃÂ¼ÃÂ¾ÃÂÃÂÃÂÃÂ¸ÃÂº. ÃÂÃÂ»ÃÂ PDF ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂ°ÃÂµÃÂ ÃÂ¿ÃÂÃÂÃÂ¼ÃÂ¾ ÃÂ² ÃÂ±ÃÂÃÂ°ÃÂÃÂ·ÃÂµÃÂÃÂµ." },
    ],
  },
  revisions: {
    title: "Ã°ÂÂ§Â¾ ÃÂ ÃÂµÃÂ²ÃÂ¸ÃÂ·ÃÂ¸ÃÂ¸",
    sections: [
      { heading: "ÃÂ§ÃÂÃÂ¾ ÃÂÃÂÃÂ¾", text: "ÃÂÃÂÃÂÃÂ¾ÃÂÃÂ¸ÃÂ ÃÂ¸ÃÂ·ÃÂ¼ÃÂµÃÂ½ÃÂµÃÂ½ÃÂ¸ÃÂ¹ ÃÂÃÂµÃÂÃÂÃÂµÃÂ¶ÃÂµÃÂ¹. ÃÂÃÂ°ÃÂ¶ÃÂ´ÃÂ°ÃÂ ÃÂÃÂµÃÂ²ÃÂ¸ÃÂ·ÃÂ¸ÃÂ Ã¢ÂÂ ÃÂÃÂÃÂ¾ ÃÂ½ÃÂ¾ÃÂ²ÃÂ°ÃÂ ÃÂ²ÃÂµÃÂÃÂÃÂ¸ÃÂ ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂÃÂ° ÃÂ ÃÂ´ÃÂ°ÃÂÃÂ¾ÃÂ¹, ÃÂ°ÃÂ²ÃÂÃÂ¾ÃÂÃÂ¾ÃÂ¼ ÃÂ¸ ÃÂÃÂÃÂ°ÃÂÃÂÃÂÃÂ¾ÃÂ¼." },
      { heading: "ÃÂ¡ÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂ½ÃÂ¸ÃÂµ ÃÂÃÂµÃÂ²ÃÂ¸ÃÂ·ÃÂ¸ÃÂ¸", text: "ÃÂÃÂÃÂºÃÂÃÂ¾ÃÂ¹ÃÂÃÂµ ÃÂÃÂµÃÂÃÂÃÂÃÂ¶ Ã¢ÂÂ ÃÂ½ÃÂ°ÃÂ¶ÃÂ¼ÃÂ¸ÃÂÃÂµ ÃÂ«ÃÂ¡ÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂÃÂ ÃÂÃÂµÃÂ²ÃÂ¸ÃÂ·ÃÂ¸ÃÂÃÂ» Ã¢ÂÂ ÃÂ·ÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂ¸ÃÂÃÂµ ÃÂ½ÃÂ¾ÃÂ²ÃÂÃÂ¹ ÃÂÃÂ°ÃÂ¹ÃÂ» ÃÂ¸ ÃÂÃÂºÃÂ°ÃÂ¶ÃÂ¸ÃÂÃÂµ ÃÂ¾ÃÂ¿ÃÂ¸ÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂµ ÃÂ¸ÃÂ·ÃÂ¼ÃÂµÃÂ½ÃÂµÃÂ½ÃÂ¸ÃÂ¹." },
      { heading: "ÃÂ¡ÃÂÃÂ°ÃÂÃÂÃÂÃÂ", text: "ÃÂ ÃÂµÃÂ²ÃÂ¸ÃÂ·ÃÂ¸ÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂÃÂ¾ÃÂ´ÃÂ¸ÃÂ: ÃÂ§ÃÂµÃÂÃÂ½ÃÂ¾ÃÂ²ÃÂ¸ÃÂº Ã¢ÂÂ ÃÂÃÂ° ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂµ Ã¢ÂÂ ÃÂ£ÃÂÃÂ²ÃÂµÃÂÃÂ¶ÃÂ´ÃÂµÃÂ½ÃÂ° / ÃÂÃÂÃÂºÃÂ»ÃÂ¾ÃÂ½ÃÂµÃÂ½ÃÂ°." },
      { heading: "ÃÂÃÂºÃÂÃÂÃÂ°ÃÂ»ÃÂÃÂ½ÃÂ°ÃÂ ÃÂ²ÃÂµÃÂÃÂÃÂ¸ÃÂ", text: "ÃÂ ÃÂÃÂµÃÂµÃÂÃÂÃÂÃÂµ ÃÂÃÂµÃÂÃÂÃÂµÃÂ¶ÃÂµÃÂ¹ ÃÂ²ÃÂÃÂµÃÂ³ÃÂ´ÃÂ° ÃÂ¿ÃÂ¾ÃÂºÃÂ°ÃÂ·ÃÂÃÂ²ÃÂ°ÃÂµÃÂÃÂÃÂ ÃÂ¿ÃÂ¾ÃÂÃÂ»ÃÂµÃÂ´ÃÂ½ÃÂÃÂ ÃÂ°ÃÂºÃÂÃÂÃÂ°ÃÂ»ÃÂÃÂ½ÃÂ°ÃÂ ÃÂÃÂµÃÂ²ÃÂ¸ÃÂ·ÃÂ¸ÃÂ." },
    ],
  },
  reviews: {
    title: "Ã°ÂÂÂ ÃÂÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ",
    sections: [
      { heading: "ÃÂ§ÃÂÃÂ¾ ÃÂÃÂÃÂ¾", text: "ÃÂÃÂÃÂÃÂ½ÃÂ°ÃÂ» ÃÂ·ÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ¹ ÃÂº ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂÃÂ°ÃÂÃÂ¸ÃÂ¸ Ã¢ÂÂ ÃÂ¾ÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂÃÂÃÂÃÂ¸ÃÂ, ÃÂÃÂÃÂÃÂ° ÃÂ¸ÃÂ»ÃÂ¸ ÃÂ·ÃÂ°ÃÂºÃÂ°ÃÂ·ÃÂÃÂ¸ÃÂºÃÂ°." },
      { heading: "ÃÂ¡ÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂ½ÃÂ¸ÃÂµ", text: "ÃÂÃÂ°ÃÂ¶ÃÂ¼ÃÂ¸ÃÂÃÂµ ÃÂ«+ ÃÂÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂµÃÂ», ÃÂÃÂºÃÂ°ÃÂ¶ÃÂ¸ÃÂÃÂµ ÃÂÃÂµÃÂÃÂÃÂÃÂ¶, ÃÂÃÂµÃÂºÃÂÃÂ ÃÂ·ÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ ÃÂ¸ ÃÂ¾ÃÂÃÂ²ÃÂµÃÂÃÂÃÂÃÂ²ÃÂµÃÂ½ÃÂ½ÃÂ¾ÃÂ³ÃÂ¾ ÃÂ·ÃÂ° ÃÂÃÂÃÂÃÂÃÂ°ÃÂ½ÃÂµÃÂ½ÃÂ¸ÃÂµ." },
      { heading: "ÃÂ£ÃÂÃÂÃÂÃÂ°ÃÂ½ÃÂµÃÂ½ÃÂ¸ÃÂµ", text: "ÃÂÃÂÃÂ¿ÃÂ¾ÃÂ»ÃÂ½ÃÂ¸ÃÂÃÂµÃÂ»ÃÂ ÃÂÃÂÃÂÃÂÃÂ°ÃÂ½ÃÂÃÂµÃÂ ÃÂ·ÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂµ ÃÂ¸ ÃÂ¼ÃÂµÃÂ½ÃÂÃÂµÃÂ ÃÂÃÂÃÂ°ÃÂÃÂÃÂ ÃÂ½ÃÂ° ÃÂ«ÃÂ£ÃÂÃÂÃÂÃÂ°ÃÂ½ÃÂµÃÂ½ÃÂ¾ÃÂ». ÃÂÃÂ²ÃÂÃÂ¾ÃÂ ÃÂ·ÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ ÃÂ¿ÃÂ¾ÃÂ´ÃÂÃÂ²ÃÂµÃÂÃÂ¶ÃÂ´ÃÂ°ÃÂµÃÂ." },
      { heading: "ÃÂÃÂÃÂÃÂ»ÃÂµÃÂ¶ÃÂ¸ÃÂ²ÃÂ°ÃÂ½ÃÂ¸ÃÂµ", text: "ÃÂ¡ÃÂ¿ÃÂ¸ÃÂÃÂ¾ÃÂº ÃÂ¿ÃÂ¾ÃÂºÃÂ°ÃÂ·ÃÂÃÂ²ÃÂ°ÃÂµÃÂ ÃÂ¾ÃÂÃÂºÃÂÃÂÃÂÃÂÃÂµ ÃÂ¸ ÃÂ·ÃÂ°ÃÂºÃÂÃÂÃÂÃÂÃÂµ ÃÂ·ÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ. ÃÂ¤ÃÂ¸ÃÂ»ÃÂÃÂÃÂÃÂÃÂ¹ÃÂÃÂµ ÃÂ¿ÃÂ¾ ÃÂÃÂµÃÂÃÂÃÂµÃÂ¶ÃÂ ÃÂ¸ÃÂ»ÃÂ¸ ÃÂÃÂÃÂ°ÃÂÃÂÃÂÃÂ." },
    ],
  },
  transmittals: {
    title: "Ã°ÂÂÂ¦ ÃÂ¢ÃÂÃÂ°ÃÂ½ÃÂÃÂ¼ÃÂ¸ÃÂÃÂÃÂ°ÃÂ»ÃÂ",
    sections: [
      { heading: "ÃÂ§ÃÂÃÂ¾ ÃÂÃÂÃÂ¾", text: "ÃÂ¢ÃÂÃÂ°ÃÂ½ÃÂÃÂ¼ÃÂ¸ÃÂÃÂÃÂ°ÃÂ» Ã¢ÂÂ ÃÂ¾ÃÂÃÂ¸ÃÂÃÂ¸ÃÂ°ÃÂ»ÃÂÃÂ½ÃÂÃÂ¹ ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂ ÃÂ¿ÃÂµÃÂÃÂµÃÂ´ÃÂ°ÃÂÃÂ¸ ÃÂ¿ÃÂ°ÃÂºÃÂµÃÂÃÂ° ÃÂÃÂµÃÂÃÂÃÂµÃÂ¶ÃÂµÃÂ¹ ÃÂ·ÃÂ°ÃÂºÃÂ°ÃÂ·ÃÂÃÂ¸ÃÂºÃÂ ÃÂ¸ÃÂ»ÃÂ¸ ÃÂÃÂ¼ÃÂµÃÂ¶ÃÂ½ÃÂ¾ÃÂ¹ ÃÂ¾ÃÂÃÂ³ÃÂ°ÃÂ½ÃÂ¸ÃÂ·ÃÂ°ÃÂÃÂ¸ÃÂ¸." },
      { heading: "ÃÂ¡ÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂ½ÃÂ¸ÃÂµ", text: "ÃÂÃÂ°ÃÂ¶ÃÂ¼ÃÂ¸ÃÂÃÂµ ÃÂ«+ ÃÂ¢ÃÂÃÂ°ÃÂ½ÃÂÃÂ¼ÃÂ¸ÃÂÃÂÃÂ°ÃÂ»ÃÂ» Ã¢ÂÂ ÃÂ´ÃÂ¾ÃÂ±ÃÂ°ÃÂ²ÃÂÃÂÃÂµ ÃÂÃÂµÃÂÃÂÃÂµÃÂ¶ÃÂ¸ ÃÂ² ÃÂ¿ÃÂ°ÃÂºÃÂµÃÂ Ã¢ÂÂ ÃÂÃÂºÃÂ°ÃÂ¶ÃÂ¸ÃÂÃÂµ ÃÂ¿ÃÂ¾ÃÂ»ÃÂÃÂÃÂ°ÃÂÃÂµÃÂ»ÃÂ ÃÂ¸ ÃÂ´ÃÂ°ÃÂÃÂ." },
      { heading: "ÃÂ¡ÃÂÃÂ°ÃÂÃÂÃÂÃÂ", text: "ÃÂ§ÃÂµÃÂÃÂ½ÃÂ¾ÃÂ²ÃÂ¸ÃÂº Ã¢ÂÂ ÃÂÃÂÃÂ¿ÃÂÃÂ°ÃÂ²ÃÂ»ÃÂµÃÂ½ Ã¢ÂÂ ÃÂÃÂ¾ÃÂ»ÃÂÃÂÃÂµÃÂ½ ÃÂ¿ÃÂ¾ÃÂ´ÃÂÃÂ²ÃÂµÃÂÃÂ¶ÃÂ´ÃÂµÃÂ½ÃÂ¸ÃÂµ. ÃÂ¡ÃÂÃÂ°ÃÂÃÂÃÂ ÃÂ¼ÃÂµÃÂ½ÃÂÃÂµÃÂÃÂÃÂ ÃÂ²ÃÂÃÂÃÂÃÂ½ÃÂÃÂ." },
      { heading: "ÃÂ­ÃÂºÃÂÃÂ¿ÃÂ¾ÃÂÃÂ", text: "ÃÂÃÂ¾ÃÂÃÂ¾ÃÂ²ÃÂÃÂ¹ ÃÂÃÂÃÂ°ÃÂ½ÃÂÃÂ¼ÃÂ¸ÃÂÃÂÃÂ°ÃÂ» ÃÂ¼ÃÂ¾ÃÂ¶ÃÂ½ÃÂ¾ ÃÂÃÂ¾ÃÂÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂÃÂ ÃÂ² PDF ÃÂ´ÃÂ»ÃÂ ÃÂ¾ÃÂÃÂ¸ÃÂÃÂ¸ÃÂ°ÃÂ»ÃÂÃÂ½ÃÂ¾ÃÂ¹ ÃÂ¾ÃÂÃÂ¿ÃÂÃÂ°ÃÂ²ÃÂºÃÂ¸." },
    ],
  },
  assignments: {
    title: "Ã¢ÂÂ ÃÂ£ÃÂ²ÃÂÃÂ·ÃÂºÃÂ°",
    sections: [
      { heading: "ÃÂ§ÃÂÃÂ¾ ÃÂÃÂÃÂ¾", text: "ÃÂÃÂ½ÃÂÃÂÃÂÃÂÃÂ¼ÃÂµÃÂ½ÃÂ ÃÂ´ÃÂ»ÃÂ ÃÂÃÂ²ÃÂÃÂ·ÃÂºÃÂ¸ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂ ÃÂ ÃÂÃÂµÃÂÃÂÃÂµÃÂ¶ÃÂ°ÃÂ¼ÃÂ¸ ÃÂ¸ ÃÂ¸ÃÂÃÂ¿ÃÂ¾ÃÂ»ÃÂ½ÃÂ¸ÃÂÃÂµÃÂ»ÃÂÃÂ¼ÃÂ¸. ÃÂÃÂ¾ÃÂ¼ÃÂ¾ÃÂ³ÃÂ°ÃÂµÃÂ ÃÂºÃÂ¾ÃÂ½ÃÂÃÂÃÂ¾ÃÂ»ÃÂ¸ÃÂÃÂ¾ÃÂ²ÃÂ°ÃÂÃÂ, ÃÂºÃÂ°ÃÂºÃÂ¾ÃÂ¹ ÃÂÃÂµÃÂÃÂÃÂÃÂ¶ ÃÂº ÃÂºÃÂ°ÃÂºÃÂ¾ÃÂ¹ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂµ ÃÂ¾ÃÂÃÂ½ÃÂ¾ÃÂÃÂ¸ÃÂÃÂÃÂ." },
      { heading: "ÃÂÃÂÃÂ¸ÃÂ²ÃÂÃÂ·ÃÂºÃÂ°", text: "ÃÂÃÂÃÂºÃÂÃÂ¾ÃÂ¹ÃÂÃÂµ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ Ã¢ÂÂ ÃÂ² ÃÂ¿ÃÂ¾ÃÂ»ÃÂµ ÃÂ«ÃÂ§ÃÂµÃÂÃÂÃÂÃÂ¶ÃÂ» ÃÂ²ÃÂÃÂ±ÃÂµÃÂÃÂ¸ÃÂÃÂµ ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂ ÃÂ¸ÃÂ· ÃÂÃÂµÃÂµÃÂÃÂÃÂÃÂ°. ÃÂ¡ÃÂ²ÃÂÃÂ·ÃÂ ÃÂ¾ÃÂÃÂ¾ÃÂ±ÃÂÃÂ°ÃÂ¶ÃÂ°ÃÂµÃÂÃÂÃÂ ÃÂ² ÃÂ¾ÃÂ±ÃÂ¾ÃÂ¸ÃÂ ÃÂ¼ÃÂµÃÂÃÂÃÂ°ÃÂ." },
      { heading: "ÃÂÃÂ¾ÃÂ½ÃÂÃÂÃÂ¾ÃÂ»ÃÂ", text: "ÃÂ¡ÃÂ¿ÃÂ¸ÃÂÃÂ¾ÃÂº ÃÂ¿ÃÂ¾ÃÂºÃÂ°ÃÂ·ÃÂÃÂ²ÃÂ°ÃÂµÃÂ ÃÂ²ÃÂÃÂµ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸ ÃÂ ÃÂ¿ÃÂÃÂ¸ÃÂ²ÃÂÃÂ·ÃÂ°ÃÂ½ÃÂ½ÃÂÃÂ¼ÃÂ¸ ÃÂÃÂµÃÂÃÂÃÂµÃÂ¶ÃÂ°ÃÂ¼ÃÂ¸. ÃÂ£ÃÂ´ÃÂ¾ÃÂ±ÃÂ½ÃÂ¾ ÃÂ´ÃÂ»ÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂ¸ ÃÂºÃÂ¾ÃÂ¼ÃÂ¿ÃÂ»ÃÂµÃÂºÃÂÃÂ½ÃÂ¾ÃÂÃÂÃÂ¸." },
    ],
  },
  gantt: {
    title: "Ã°ÂÂÂ ÃÂÃÂ¸ÃÂ°ÃÂ³ÃÂÃÂ°ÃÂ¼ÃÂ¼ÃÂ° ÃÂÃÂ°ÃÂ½ÃÂÃÂ°",
    sections: [
      { heading: "ÃÂ§ÃÂÃÂ¾ ÃÂÃÂÃÂ¾", text: "ÃÂÃÂ¸ÃÂ·ÃÂÃÂ°ÃÂ»ÃÂ¸ÃÂ·ÃÂ°ÃÂÃÂ¸ÃÂ ÃÂÃÂÃÂ¾ÃÂºÃÂ¾ÃÂ² ÃÂ²ÃÂÃÂµÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂ ÃÂ½ÃÂ° ÃÂ²ÃÂÃÂµÃÂ¼ÃÂµÃÂ½ÃÂ½ÃÂ¾ÃÂ¹ ÃÂÃÂºÃÂ°ÃÂ»ÃÂµ." },
      { heading: "ÃÂÃÂ°ÃÂº ÃÂÃÂ¸ÃÂÃÂ°ÃÂÃÂ", text: "ÃÂÃÂ°ÃÂ¶ÃÂ´ÃÂ°ÃÂ ÃÂÃÂÃÂÃÂ¾ÃÂºÃÂ° Ã¢ÂÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ°, ÃÂ¿ÃÂ¾ÃÂ»ÃÂ¾ÃÂÃÂºÃÂ° Ã¢ÂÂ ÃÂ¿ÃÂµÃÂÃÂ¸ÃÂ¾ÃÂ´ ÃÂ²ÃÂÃÂ¿ÃÂ¾ÃÂ»ÃÂ½ÃÂµÃÂ½ÃÂ¸ÃÂ (ÃÂ¾ÃÂ ÃÂÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂ½ÃÂ¸ÃÂ ÃÂ´ÃÂ¾ ÃÂ´ÃÂµÃÂ´ÃÂ»ÃÂ°ÃÂ¹ÃÂ½ÃÂ°). ÃÂ¦ÃÂ²ÃÂµÃÂ ÃÂ·ÃÂ°ÃÂ²ÃÂ¸ÃÂÃÂ¸ÃÂ ÃÂ¾ÃÂ ÃÂÃÂÃÂ°ÃÂÃÂÃÂÃÂ°." },
      { heading: "ÃÂÃÂÃÂ¾ÃÂÃÂÃÂ¾ÃÂÃÂµÃÂ½ÃÂ½ÃÂÃÂµ", text: "ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸ ÃÂ ÃÂ¸ÃÂÃÂÃÂÃÂºÃÂÃÂ¸ÃÂ¼ ÃÂÃÂÃÂ¾ÃÂºÃÂ¾ÃÂ¼ ÃÂ¿ÃÂ¾ÃÂ´ÃÂÃÂ²ÃÂµÃÂÃÂ¸ÃÂ²ÃÂ°ÃÂÃÂÃÂÃÂ ÃÂºÃÂÃÂ°ÃÂÃÂ½ÃÂÃÂ¼." },
    ],
  },
  timeline: {
    title: "Ã°ÂÂÂº Timeline",
    sections: [
      { heading: "ÃÂ§ÃÂÃÂ¾ ÃÂÃÂÃÂ¾", text: "ÃÂÃÂÃÂµÃÂ¼ÃÂµÃÂ½ÃÂ½ÃÂ°ÃÂ ÃÂÃÂºÃÂ°ÃÂ»ÃÂ° ÃÂºÃÂ»ÃÂÃÂÃÂµÃÂ²ÃÂÃÂ ÃÂÃÂ¾ÃÂ±ÃÂÃÂÃÂ¸ÃÂ¹ ÃÂ¸ ÃÂ²ÃÂµÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ°." },
      { heading: "ÃÂÃÂ¾ÃÂ±ÃÂ°ÃÂ²ÃÂ»ÃÂµÃÂ½ÃÂ¸ÃÂµ ÃÂ²ÃÂµÃÂÃÂ¸", text: "ÃÂÃÂ°ÃÂ¶ÃÂ¼ÃÂ¸ÃÂÃÂµ ÃÂ«+ ÃÂÃÂµÃÂÃÂ°ÃÂ» Ã¢ÂÂ ÃÂÃÂºÃÂ°ÃÂ¶ÃÂ¸ÃÂÃÂµ ÃÂ½ÃÂ°ÃÂ·ÃÂ²ÃÂ°ÃÂ½ÃÂ¸ÃÂµ, ÃÂ´ÃÂ°ÃÂÃÂ ÃÂ¸ ÃÂÃÂ¸ÃÂ¿ ÃÂÃÂ¾ÃÂ±ÃÂÃÂÃÂ¸ÃÂ." },
      { heading: "ÃÂÃÂ°ÃÂ·ÃÂ½ÃÂ°ÃÂÃÂµÃÂ½ÃÂ¸ÃÂµ", text: "ÃÂÃÂÃÂ¿ÃÂ¾ÃÂ»ÃÂÃÂ·ÃÂÃÂ¹ÃÂÃÂµ Timeline ÃÂ´ÃÂ»ÃÂ ÃÂÃÂ¸ÃÂºÃÂÃÂ°ÃÂÃÂ¸ÃÂ¸ ÃÂºÃÂ¾ÃÂ½ÃÂÃÂÃÂ¾ÃÂ»ÃÂÃÂ½ÃÂÃÂ ÃÂÃÂ¾ÃÂÃÂµÃÂº: ÃÂÃÂ´ÃÂ°ÃÂÃÂ° ÃÂÃÂ°ÃÂ·ÃÂ´ÃÂµÃÂ»ÃÂ¾ÃÂ², ÃÂÃÂ¾ÃÂ³ÃÂ»ÃÂ°ÃÂÃÂ¾ÃÂ²ÃÂ°ÃÂ½ÃÂ¸ÃÂ, ÃÂÃÂºÃÂÃÂ¿ÃÂµÃÂÃÂÃÂ¸ÃÂ·ÃÂ°." },
    ],
  },
  meetings: {
    title: "Ã°ÂÂÂ ÃÂÃÂÃÂ¾ÃÂÃÂ¾ÃÂºÃÂ¾ÃÂ»ÃÂ",
    sections: [
      { heading: "ÃÂ§ÃÂÃÂ¾ ÃÂÃÂÃÂ¾", text: "ÃÂÃÂÃÂÃÂ½ÃÂ°ÃÂ» ÃÂ¿ÃÂÃÂ¾ÃÂÃÂ¾ÃÂºÃÂ¾ÃÂ»ÃÂ¾ÃÂ² ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ¹ ÃÂ¸ ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂ¸ÃÂ ÃÂ²ÃÂÃÂÃÂÃÂµÃÂ ÃÂ¿ÃÂ¾ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ." },
      { heading: "ÃÂ¡ÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂ½ÃÂ¸ÃÂµ ÃÂ¿ÃÂÃÂ¾ÃÂÃÂ¾ÃÂºÃÂ¾ÃÂ»ÃÂ°", text: "ÃÂÃÂ°ÃÂ¶ÃÂ¼ÃÂ¸ÃÂÃÂµ ÃÂ«+ ÃÂÃÂÃÂ¾ÃÂÃÂ¾ÃÂºÃÂ¾ÃÂ»ÃÂ» Ã¢ÂÂ ÃÂÃÂºÃÂ°ÃÂ¶ÃÂ¸ÃÂÃÂµ ÃÂ´ÃÂ°ÃÂÃÂ, ÃÂÃÂÃÂ°ÃÂÃÂÃÂ½ÃÂ¸ÃÂºÃÂ¾ÃÂ², ÃÂ¿ÃÂ¾ÃÂ²ÃÂµÃÂÃÂÃÂºÃÂ ÃÂ¸ ÃÂ¿ÃÂÃÂ¸ÃÂ½ÃÂÃÂÃÂÃÂµ ÃÂÃÂµÃÂÃÂµÃÂ½ÃÂ¸ÃÂ." },
      { heading: "ÃÂÃÂ¾ÃÂÃÂÃÂÃÂµÃÂ½ÃÂ¸ÃÂ", text: "ÃÂ ÃÂºÃÂ°ÃÂ¶ÃÂ´ÃÂ¾ÃÂ¼ ÃÂ¿ÃÂÃÂ½ÃÂºÃÂÃÂµ ÃÂ¿ÃÂÃÂ¾ÃÂÃÂ¾ÃÂºÃÂ¾ÃÂ»ÃÂ° ÃÂ¼ÃÂ¾ÃÂ¶ÃÂ½ÃÂ¾ ÃÂ½ÃÂ°ÃÂ·ÃÂ½ÃÂ°ÃÂÃÂ¸ÃÂÃÂ ÃÂ¾ÃÂÃÂ²ÃÂµÃÂÃÂÃÂÃÂ²ÃÂµÃÂ½ÃÂ½ÃÂ¾ÃÂ³ÃÂ¾ ÃÂ¸ ÃÂÃÂÃÂ¾ÃÂº Ã¢ÂÂ ÃÂ¾ÃÂ½ÃÂ¸ ÃÂ¿ÃÂ¾ÃÂ¿ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ ÃÂ² ÃÂÃÂ°ÃÂ·ÃÂ´ÃÂµÃÂ» ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂ." },
      { heading: "ÃÂÃÂÃÂÃÂ¾ÃÂÃÂ¸ÃÂ", text: "ÃÂÃÂÃÂµ ÃÂ¿ÃÂÃÂ¾ÃÂÃÂ¾ÃÂºÃÂ¾ÃÂ»ÃÂ ÃÂÃÂÃÂ°ÃÂ½ÃÂÃÂÃÂÃÂ ÃÂ² ÃÂÃÂÃÂ¾ÃÂ½ÃÂ¾ÃÂ»ÃÂ¾ÃÂ³ÃÂ¸ÃÂÃÂµÃÂÃÂºÃÂ¾ÃÂ¼ ÃÂ¿ÃÂ¾ÃÂÃÂÃÂ´ÃÂºÃÂµ. ÃÂÃÂ¾ÃÂ¶ÃÂ½ÃÂ¾ ÃÂÃÂºÃÂÃÂ¿ÃÂ¾ÃÂÃÂÃÂ¸ÃÂÃÂ¾ÃÂ²ÃÂ°ÃÂÃÂ ÃÂ² PDF." },
    ],
  },
  timelog: {
    title: "Ã¢ÂÂ± ÃÂ¢ÃÂ°ÃÂ±ÃÂµÃÂ»ÃÂ",
    sections: [
      { heading: "ÃÂ§ÃÂÃÂ¾ ÃÂÃÂÃÂ¾", text: "ÃÂ£ÃÂÃÂÃÂ ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂµÃÂ³ÃÂ¾ ÃÂ²ÃÂÃÂµÃÂ¼ÃÂµÃÂ½ÃÂ¸ ÃÂÃÂ¾ÃÂÃÂÃÂÃÂ´ÃÂ½ÃÂ¸ÃÂºÃÂ¾ÃÂ² ÃÂ¿ÃÂ¾ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ." },
      { heading: "ÃÂÃÂ°ÃÂ¿ÃÂ¾ÃÂ»ÃÂ½ÃÂµÃÂ½ÃÂ¸ÃÂµ", text: "ÃÂÃÂ°ÃÂ¶ÃÂ´ÃÂÃÂ¹ ÃÂÃÂ¾ÃÂÃÂÃÂÃÂ´ÃÂ½ÃÂ¸ÃÂº ÃÂ²ÃÂ½ÃÂ¾ÃÂÃÂ¸ÃÂ ÃÂ·ÃÂ°ÃÂÃÂÃÂ°ÃÂÃÂµÃÂ½ÃÂ½ÃÂ¾ÃÂµ ÃÂ²ÃÂÃÂµÃÂ¼ÃÂ ÃÂ½ÃÂ° ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ: ÃÂºÃÂ½ÃÂ¾ÃÂ¿ÃÂºÃÂ° ÃÂ«+ ÃÂÃÂ°ÃÂ¿ÃÂ¸ÃÂÃÂÃÂ» Ã¢ÂÂ ÃÂ²ÃÂÃÂ±ÃÂµÃÂÃÂ¸ÃÂÃÂµ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ, ÃÂ´ÃÂ°ÃÂÃÂ ÃÂ¸ ÃÂÃÂ°ÃÂÃÂ." },
      { heading: "ÃÂÃÂÃÂ¾ÃÂÃÂ¼ÃÂ¾ÃÂÃÂ", text: "ÃÂÃÂÃÂ ÃÂ¸ ÃÂÃÂÃÂºÃÂ¾ÃÂ²ÃÂ¾ÃÂ´ÃÂ¸ÃÂÃÂµÃÂ»ÃÂ¸ ÃÂ²ÃÂ¸ÃÂ´ÃÂÃÂ ÃÂÃÂ²ÃÂ¾ÃÂ´ÃÂºÃÂ ÃÂ¿ÃÂ¾ ÃÂ²ÃÂÃÂµÃÂ¼ ÃÂÃÂ¾ÃÂÃÂÃÂÃÂ´ÃÂ½ÃÂ¸ÃÂºÃÂ°ÃÂ¼ ÃÂ¸ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ°ÃÂ¼." },
      { heading: "ÃÂ­ÃÂºÃÂÃÂ¿ÃÂ¾ÃÂÃÂ", text: "ÃÂ¢ÃÂ°ÃÂ±ÃÂµÃÂ»ÃÂ ÃÂ¼ÃÂ¾ÃÂ¶ÃÂ½ÃÂ¾ ÃÂ²ÃÂÃÂ³ÃÂÃÂÃÂ·ÃÂ¸ÃÂÃÂ ÃÂ² Excel ÃÂ´ÃÂ»ÃÂ ÃÂ¿ÃÂµÃÂÃÂµÃÂ´ÃÂ°ÃÂÃÂ¸ ÃÂ² ÃÂ±ÃÂÃÂÃÂ³ÃÂ°ÃÂ»ÃÂÃÂµÃÂÃÂ¸ÃÂ ÃÂ¸ÃÂ»ÃÂ¸ ÃÂ¾ÃÂÃÂÃÂÃÂÃÂ½ÃÂ¾ÃÂÃÂÃÂ." },
    ],
  },
  gipdash: {
    title: "Ã°ÂÂÂ ÃÂÃÂ°ÃÂ½ÃÂµÃÂ»ÃÂ ÃÂÃÂÃÂÃÂ°",
    sections: [
      { heading: "ÃÂ§ÃÂÃÂ¾ ÃÂÃÂÃÂ¾", text: "ÃÂ¡ÃÂ²ÃÂ¾ÃÂ´ÃÂ½ÃÂ°ÃÂ ÃÂ°ÃÂ½ÃÂ°ÃÂ»ÃÂ¸ÃÂÃÂ¸ÃÂºÃÂ° ÃÂ´ÃÂ»ÃÂ ÃÂÃÂ»ÃÂ°ÃÂ²ÃÂ½ÃÂ¾ÃÂ³ÃÂ¾ ÃÂÃÂ½ÃÂ¶ÃÂµÃÂ½ÃÂµÃÂÃÂ° ÃÂÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ° ÃÂ¿ÃÂ¾ ÃÂ²ÃÂÃÂµÃÂ¼ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ°ÃÂ¼, ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂ°ÃÂ¼ ÃÂ¸ ÃÂ¸ÃÂÃÂ¿ÃÂ¾ÃÂ»ÃÂ½ÃÂ¸ÃÂÃÂµÃÂ»ÃÂÃÂ¼." },
      { heading: "ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂºÃÂ°", text: "ÃÂÃÂÃÂ°ÃÂÃÂ¸ÃÂº ÃÂ¿ÃÂ¾ÃÂºÃÂ°ÃÂ·ÃÂÃÂ²ÃÂ°ÃÂµÃÂ ÃÂ·ÃÂ°ÃÂ³ÃÂÃÂÃÂ¶ÃÂµÃÂ½ÃÂ½ÃÂ¾ÃÂÃÂÃÂ ÃÂºÃÂ°ÃÂ¶ÃÂ´ÃÂ¾ÃÂ³ÃÂ¾ ÃÂÃÂ¾ÃÂÃÂÃÂÃÂ´ÃÂ½ÃÂ¸ÃÂºÃÂ°: ÃÂÃÂºÃÂ¾ÃÂ»ÃÂÃÂºÃÂ¾ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂ ÃÂ² ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂµ, ÃÂ½ÃÂ° ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂµ, ÃÂ·ÃÂ°ÃÂ²ÃÂµÃÂÃÂÃÂµÃÂ½ÃÂ¾." },
      { heading: "ÃÂÃÂ¾ÃÂ½ÃÂÃÂÃÂ¾ÃÂ»ÃÂ ÃÂºÃÂ°ÃÂÃÂµÃÂÃÂÃÂ²ÃÂ°", text: "ÃÂÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ ÃÂ¸ ÃÂÃÂµÃÂ²ÃÂ¸ÃÂ·ÃÂ¸ÃÂ¸ ÃÂ¿ÃÂ¾ ÃÂ²ÃÂÃÂµÃÂ¼ ÃÂÃÂ°ÃÂ·ÃÂ´ÃÂµÃÂ»ÃÂ°ÃÂ¼ Ã¢ÂÂ ÃÂ²ÃÂ¸ÃÂ´ÃÂ½ÃÂ¾ ÃÂ³ÃÂ´ÃÂµ ÃÂÃÂ·ÃÂºÃÂ¸ÃÂµ ÃÂ¼ÃÂµÃÂÃÂÃÂ°." },
      { heading: "ÃÂÃÂ¾ÃÂÃÂÃÂÃÂ¿", text: "ÃÂ ÃÂ°ÃÂ·ÃÂ´ÃÂµÃÂ» ÃÂ²ÃÂ¸ÃÂ´ÃÂµÃÂ½ ÃÂÃÂ¾ÃÂ»ÃÂÃÂºÃÂ¾ ÃÂ¿ÃÂ¾ÃÂ»ÃÂÃÂ·ÃÂ¾ÃÂ²ÃÂ°ÃÂÃÂµÃÂ»ÃÂÃÂ¼ ÃÂ ÃÂÃÂ¾ÃÂ»ÃÂÃÂ ÃÂÃÂÃÂ." },
    ],
  },
  bim: {
    title: "Ã°ÂÂÂ BIM",
    sections: [
      { heading: "ÃÂ§ÃÂÃÂ¾ ÃÂÃÂÃÂ¾", text: "ÃÂÃÂÃÂ¾ÃÂÃÂ¼ÃÂ¾ÃÂÃÂ ÃÂ¸ÃÂ½ÃÂÃÂ¾ÃÂÃÂ¼ÃÂ°ÃÂÃÂ¸ÃÂ¾ÃÂ½ÃÂ½ÃÂ¾ÃÂ¹ ÃÂ¼ÃÂ¾ÃÂ´ÃÂµÃÂ»ÃÂ¸ ÃÂ·ÃÂ´ÃÂ°ÃÂ½ÃÂ¸ÃÂ (BIM) ÃÂ¿ÃÂÃÂÃÂ¼ÃÂ¾ ÃÂ² ÃÂ±ÃÂÃÂ°ÃÂÃÂ·ÃÂµÃÂÃÂµ." },
      { heading: "ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂºÃÂ° ÃÂ¼ÃÂ¾ÃÂ´ÃÂµÃÂ»ÃÂ¸", text: "ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂ¸ÃÂÃÂµ IFC-ÃÂÃÂ°ÃÂ¹ÃÂ» ÃÂÃÂµÃÂÃÂµÃÂ· ÃÂºÃÂ½ÃÂ¾ÃÂ¿ÃÂºÃÂ ÃÂ«ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂ¸ÃÂÃÂ ÃÂ¼ÃÂ¾ÃÂ´ÃÂµÃÂ»ÃÂÃÂ». ÃÂÃÂ¾ÃÂ´ÃÂ´ÃÂµÃÂÃÂ¶ÃÂ¸ÃÂ²ÃÂ°ÃÂµÃÂÃÂÃÂ ÃÂÃÂ¾ÃÂÃÂ¼ÃÂ°ÃÂ IFC 2x3 ÃÂ¸ IFC 4." },
      { heading: "ÃÂÃÂ°ÃÂ²ÃÂ¸ÃÂ³ÃÂ°ÃÂÃÂ¸ÃÂ", text: "ÃÂÃÂÃÂÃÂ: ÃÂ²ÃÂÃÂ°ÃÂÃÂµÃÂ½ÃÂ¸ÃÂµ Ã¢ÂÂ ÃÂ»ÃÂµÃÂ²ÃÂ°ÃÂ ÃÂºÃÂ½ÃÂ¾ÃÂ¿ÃÂºÃÂ°, ÃÂ¿ÃÂ°ÃÂ½ÃÂ¾ÃÂÃÂ°ÃÂ¼ÃÂ° Ã¢ÂÂ ÃÂÃÂÃÂµÃÂ´ÃÂ½ÃÂÃÂ ÃÂºÃÂ½ÃÂ¾ÃÂ¿ÃÂºÃÂ° / Shift+ÃÂÃÂÃÂ, ÃÂ¼ÃÂ°ÃÂÃÂÃÂÃÂ°ÃÂ± Ã¢ÂÂ ÃÂºÃÂ¾ÃÂ»ÃÂµÃÂÃÂ¾." },
      { heading: "ÃÂÃÂ±ÃÂÃÂÃÂ¶ÃÂ´ÃÂµÃÂ½ÃÂ¸ÃÂµ", text: "ÃÂ ÃÂÃÂ´ÃÂ¾ÃÂ¼ ÃÂ ÃÂ¼ÃÂ¾ÃÂ´ÃÂµÃÂ»ÃÂÃÂ ÃÂ´ÃÂ¾ÃÂÃÂÃÂÃÂ¿ÃÂµÃÂ½ ÃÂÃÂ°ÃÂ ÃÂ´ÃÂ»ÃÂ ÃÂ¾ÃÂ±ÃÂÃÂÃÂ¶ÃÂ´ÃÂµÃÂ½ÃÂ¸ÃÂ ÃÂºÃÂ¾ÃÂ½ÃÂºÃÂÃÂµÃÂÃÂ½ÃÂÃÂ ÃÂÃÂ»ÃÂµÃÂ¼ÃÂµÃÂ½ÃÂÃÂ¾ÃÂ² ÃÂ¼ÃÂ¾ÃÂ´ÃÂµÃÂ»ÃÂ¸." },
      { heading: "ÃÂÃÂ¾ÃÂÃÂÃÂÃÂ¿", text: "ÃÂ ÃÂ°ÃÂ·ÃÂ´ÃÂµÃÂ» ÃÂ²ÃÂ¸ÃÂ´ÃÂµÃÂ½ ÃÂÃÂÃÂÃÂ ÃÂ¸ ÃÂÃÂÃÂºÃÂ¾ÃÂ²ÃÂ¾ÃÂ´ÃÂ¸ÃÂÃÂµÃÂ»ÃÂÃÂ¼ ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂ¾ÃÂ²." },
    ],
  },
};

export default function App() {
  const [dark, setDark] = useState(false); // ÃÂ¡ÃÂ²ÃÂµÃÂÃÂ»ÃÂ°ÃÂ ÃÂÃÂµÃÂ¼ÃÂ° ÃÂ¿ÃÂ¾ ÃÂÃÂ¼ÃÂ¾ÃÂ»ÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ
  const C = dark ? DARK : LIGHT;

  // Auth state: initialized from Supabase JS session, kept fresh via onAuthStateChange.
  // Never reads from localStorage.enghub_token Ã¢ÂÂ that stale path is eliminated.
  const [token, setToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string>(localStorage.getItem('enghub_email') || "");
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [screen, setScreen] = useState(localStorage.getItem('enghub_screen') || "dashboard");
  const [projects, setProjects] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  // B4: ÃÂ³ÃÂ»ÃÂ¾ÃÂ±ÃÂ°ÃÂ»ÃÂÃÂ½ÃÂÃÂµ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸ ÃÂ´ÃÂ»ÃÂ ÃÂ´ÃÂ°ÃÂÃÂ±ÃÂ¾ÃÂÃÂ´ÃÂ¾ÃÂ² Lead/Engineer (multi-project), ÃÂ½ÃÂµÃÂ·ÃÂ°ÃÂ²ÃÂ¸ÃÂÃÂ¸ÃÂ¼ÃÂ¾ ÃÂ¾ÃÂ activeProject
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
  // #08 design diff: ÃÂ°ÃÂ½ÃÂ¸ÃÂ¼ÃÂ°ÃÂÃÂ¸ÃÂ ÃÂ·ÃÂ°ÃÂ¿ÃÂ¾ÃÂ»ÃÂ½ÃÂµÃÂ½ÃÂ¸ÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂ³ÃÂÃÂµÃÂÃÂ-ÃÂ±ÃÂ°ÃÂÃÂ¾ÃÂ² ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂ¾ÃÂ² ÃÂ½ÃÂ° ÃÂ´ÃÂ°ÃÂÃÂ±ÃÂ¾ÃÂÃÂ´ÃÂµ
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

  // CONV Stage 4b: ÃÂ·ÃÂ°ÃÂ¿ÃÂÃÂ¾ÃÂ ÃÂ´ÃÂ°ÃÂ½ÃÂ½ÃÂÃÂ ÃÂ ÃÂÃÂ¼ÃÂµÃÂ¶ÃÂ½ÃÂ¾ÃÂ³ÃÂ¾ ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂ°
  const [showDepRequest, setShowDepRequest] = useState(false);
  const [depRequest, setDepRequest] = useState({ target_dept_id: "", what_needed: "", deadline_hint: "" });

  // ÃÂÃÂ¾ÃÂ¸ÃÂÃÂº ÃÂ¸ ÃÂÃÂ¸ÃÂ»ÃÂÃÂÃÂÃÂ
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
  const isGip = role.includes("gip") || role.includes("ÃÂ³ÃÂ¸ÃÂ¿");
  const isLead = role.includes("lead") || role.includes("ÃÂÃÂÃÂºÃÂ¾ÃÂ²ÃÂ¾ÃÂ´ÃÂ¸ÃÂÃÂµÃÂ»ÃÂ");
  const isEng = role.includes("engineer") || role.includes("ÃÂ¸ÃÂ½ÃÂ¶ÃÂµÃÂ½ÃÂµÃÂ");

  const getUserById = (id: any) => appUsers.find(u => String(u.id) === String(id));
  const getDeptName = (id: any) => depts.find(d => String(d.id) === String(id))?.name || "ÃÂÃÂ±ÃÂÃÂ¸ÃÂµ";

  // Ã¢ÂÂÃ¢ÂÂ Auth lifecycle: single source of truth = Supabase JS session Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
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
  // Track which user IDs are currently known in the conference Ã¢ÂÂ used to debounce join/leave notifications
  const knownParticipantIdsRef = useRef<Set<string>>(new Set());
  const sessionId = useRef<string>(Math.random().toString(36).slice(2) + Date.now().toString(36));
  const sessionChannelRef = useRef<any>(null);

  // Ã¢ÂÂÃ¢ÂÂ ÃÂÃÂ´ÃÂ½ÃÂ° ÃÂÃÂµÃÂÃÂÃÂ¸ÃÂ ÃÂ½ÃÂ° ÃÂ¿ÃÂ¾ÃÂ»ÃÂÃÂ·ÃÂ¾ÃÂ²ÃÂ°ÃÂÃÂµÃÂ»ÃÂ: ÃÂ¿ÃÂÃÂ¸ ÃÂ½ÃÂ¾ÃÂ²ÃÂ¾ÃÂ¼ ÃÂ²ÃÂÃÂ¾ÃÂ´ÃÂµ ÃÂ²ÃÂÃÂ±ÃÂ¸ÃÂ²ÃÂ°ÃÂµÃÂ¼ ÃÂÃÂÃÂ°ÃÂÃÂÃÂµ ÃÂÃÂµÃÂÃÂÃÂ¸ÃÂ¸ Ã¢ÂÂÃ¢ÂÂ
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
    const topic = `session:${currentUserData.id}`;
    // Purge ghost subscriptions — Phoenix auto-reconnect revives removed channels;
    // their SUBSCRIBED callback re-broadcasts a stale sessionId, kicking out fresh logins.
    try {
      (supa.getChannels() as any[])
        .filter((c: any) => c.topic === `realtime:${topic}` || c.topic === topic)
        .forEach((c: any) => { console.log('[SESSION] Ghost purge:', c.topic); supa.removeChannel(c); });
    } catch { /* older SDK */ }
    const ch = supa.channel(topic, {
      config: { broadcast: { self: false, ack: false } }
    });
    ch.on('broadcast', { event: 'login' }, ({ payload }: any) => {
      const age = Date.now() - (payload?.timestamp ?? 0);
      console.warn('[SESSION] Broadcast received (age ' + age + 'ms) sid:', payload?.sessionId?.slice(0, 8), 'mine:', sessionId.current.slice(0, 8));
      if (age > 10_000) { console.warn('[SESSION] Ignoring stale broadcast'); return; }
      if (payload?.sessionId && payload.sessionId !== sessionId.current) {
        handleLogout();
      }
    }).subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        ch.send({ type: 'broadcast', event: 'login', payload: { sessionId: sessionId.current, timestamp: Date.now() } });
        sessionChannelRef.current = { ch, supa };
      }
    });
    return () => {
      console.log('[SESSION] useEffect cleanup: removing channel for user', currentUserData.id);
      supa.removeChannel(ch);
      sessionChannelRef.current = null;
    };
  }, [currentUserData?.id, token]); // eslint-disable-line

  // Ã¢ÂÂÃ¢ÂÂ ÃÂ£ÃÂ²ÃÂµÃÂ´ÃÂ¾ÃÂ¼ÃÂ»ÃÂµÃÂ½ÃÂ¸ÃÂ ÃÂ¾ ÃÂ²ÃÂÃÂ¾ÃÂ´ÃÂÃÂÃÂ¸ÃÂ ÃÂ²ÃÂÃÂ·ÃÂ¾ÃÂ²ÃÂ°ÃÂ (bypass RLS ÃÂÃÂµÃÂÃÂµÃÂ· broadcast) Ã¢ÂÂÃ¢ÂÂ
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
        project_name: payload.project_name || 'ÃÂÃÂÃÂ¾ÃÂµÃÂºÃÂ',
        initiator_name: payload.initiator_name || 'ÃÂ£ÃÂÃÂ°ÃÂÃÂÃÂ½ÃÂ¸ÃÂº',
      });
    }).subscribe();
    return () => { supa.removeChannel(ch); };
  }, [currentUserData?.id]); // eslint-disable-line

  // ÃÂÃÂµÃÂÃÂµÃÂ·ÃÂ°ÃÂ³ÃÂÃÂÃÂ¶ÃÂ°ÃÂµÃÂ¼ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸ ÃÂºÃÂ¾ÃÂ³ÃÂ´ÃÂ° currentUserData ÃÂ·ÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂ¸ÃÂ»ÃÂÃÂ
  useEffect(() => { if (activeProject && token && currentUserData) { loadAllTasks(activeProject.id); } }, [currentUserData?.id]);

  // B4: ÃÂ³ÃÂÃÂÃÂ·ÃÂ¸ÃÂ¼ multi-project tasks ÃÂ´ÃÂ»ÃÂ ÃÂ´ÃÂ°ÃÂÃÂ±ÃÂ¾ÃÂÃÂ´ÃÂ¾ÃÂ² Lead/Engineer
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
      // ÃÂ¤ÃÂ¸ÃÂ»ÃÂÃÂÃÂÃÂ°ÃÂÃÂ¸ÃÂ ÃÂ¿ÃÂ¾ ÃÂÃÂ¾ÃÂ»ÃÂ¸
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
      // T30e: ÃÂ±ÃÂ°ÃÂÃÂ-ÃÂ¿ÃÂ¾ÃÂ´ÃÂÃÂÃÂÃÂ ÃÂ¿ÃÂÃÂ¸ÃÂºÃÂÃÂµÃÂ¿ÃÂ»ÃÂÃÂ½ÃÂ½ÃÂÃÂ ÃÂÃÂ°ÃÂ¹ÃÂ»ÃÂ¾ÃÂ² ÃÂ½ÃÂ° ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ°ÃÂ
      try {
        const ids = data.map((t: any) => Number(t.id)).filter(Boolean);
        const rows = await listTaskAttachmentsByTaskIds(ids, token!);
        const counts: Record<string, number> = {};
        for (const r of rows) {
          const k = String(r.task_id);
          counts[k] = (counts[k] || 0) + 1;
        }
        setTaskAttachCounts(counts);
      } catch { /* ignore: ÃÂ¼ÃÂ¸ÃÂ³ÃÂÃÂ°ÃÂÃÂ¸ÃÂ ÃÂ¼ÃÂ¾ÃÂ³ÃÂ»ÃÂ° ÃÂ±ÃÂÃÂÃÂ ÃÂ½ÃÂµ ÃÂ¿ÃÂÃÂ¸ÃÂ¼ÃÂµÃÂ½ÃÂµÃÂ½ÃÂ° */ }
    }
  };
  // Keep loadTasks as alias
  const loadTasks = loadAllTasks;
  // B4: multi-project ÃÂÃÂ°ÃÂÃÂºÃÂ¾ÃÂ² ÃÂ´ÃÂ»ÃÂ Lead/Engineer dashboard'ÃÂ¾ÃÂ². Lead Ã¢ÂÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸ ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂ°, Engineer Ã¢ÂÂ ÃÂÃÂ²ÃÂ¾ÃÂ¸.
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
    } catch { /* RLS ÃÂ½ÃÂµ ÃÂ´ÃÂ¾ÃÂ»ÃÂ¶ÃÂ½ÃÂ° ÃÂÃÂ¾ÃÂ½ÃÂÃÂÃÂ Ã¢ÂÂ ÃÂ¿ÃÂÃÂ¾ÃÂÃÂÃÂ¾ ÃÂ¿ÃÂÃÂÃÂÃÂ¾ÃÂ¹ ÃÂÃÂ¿ÃÂ¸ÃÂÃÂ¾ÃÂº */ }
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

  // NORM-01 fix: ÃÂ¾ÃÂÃÂºÃÂÃÂÃÂÃÂ ÃÂ½ÃÂ¾ÃÂÃÂ¼ÃÂ°ÃÂÃÂ¸ÃÂ²ÃÂ½ÃÂÃÂ¹ ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂ ÃÂÃÂµÃÂÃÂµÃÂ· ÃÂ¿ÃÂ¾ÃÂ´ÃÂ¿ÃÂ¸ÃÂÃÂ°ÃÂ½ÃÂ½ÃÂÃÂ¹ Storage URL (ÃÂÃÂµÃÂÃÂµÃÂ· /api)
  const openNormativeDoc = async (doc: any) => {
    if (!doc?.file_path) { addNotification("ÃÂÃÂÃÂÃÂ ÃÂº ÃÂÃÂ°ÃÂ¹ÃÂ»ÃÂ ÃÂ½ÃÂµ ÃÂ½ÃÂ°ÃÂ¹ÃÂ´ÃÂµÃÂ½", "warning"); return; }
    const isPdf = doc.file_type?.includes("pdf") || doc.name?.toLowerCase().endsWith(".pdf");
    const signedUrl = await signStorageUrl('normative-docs', doc.file_path, 3600);
    if (!signedUrl) { addNotification("ÃÂÃÂµ ÃÂÃÂ´ÃÂ°ÃÂ»ÃÂ¾ÃÂÃÂ ÃÂ¿ÃÂ¾ÃÂ»ÃÂÃÂÃÂ¸ÃÂÃÂ ÃÂÃÂÃÂÃÂ»ÃÂºÃÂ ÃÂ½ÃÂ° ÃÂÃÂ°ÃÂ¹ÃÂ»", "warning"); return; }
    if (isPdf) {
      window.open(signedUrl, "_blank");
    } else {
      const a = document.createElement("a");
      a.href = signedUrl;
      a.download = doc.name;
      document.body.appendChild(a); a.click(); a.remove();
    }
  };

  // ÃÂÃÂ°ÃÂ¿ÃÂ°ÃÂÃÂ½ÃÂ¾ÃÂ¹ ÃÂÃÂµÃÂºÃÂÃÂÃÂ¾ÃÂ²ÃÂÃÂ¹ ÃÂ¿ÃÂ¾ÃÂ¸ÃÂÃÂº ÃÂÃÂµÃÂÃÂµÃÂ· ilike (ÃÂºÃÂ¾ÃÂ³ÃÂ´ÃÂ° ÃÂ½ÃÂµÃÂ ÃÂÃÂ¼ÃÂ±ÃÂµÃÂ´ÃÂ´ÃÂ¸ÃÂ½ÃÂ³ÃÂ¾ÃÂ²) Ã¢ÂÂ ÃÂÃÂµÃÂÃÂµÃÂ· /api
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
      // ÃÂÃÂÃÂ¾ÃÂ±ÃÂÃÂµÃÂ¼ ÃÂÃÂµÃÂ¼ÃÂ°ÃÂ½ÃÂÃÂ¸ÃÂÃÂµÃÂÃÂºÃÂ¸ÃÂ¹ ÃÂ¿ÃÂ¾ÃÂ¸ÃÂÃÂº
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
      } catch { /* ÃÂÃÂµÃÂ¼ÃÂ°ÃÂ½ÃÂÃÂ¸ÃÂÃÂµÃÂÃÂºÃÂ¸ÃÂ¹ ÃÂ¿ÃÂ¾ÃÂ¸ÃÂÃÂº ÃÂ½ÃÂµÃÂ´ÃÂ¾ÃÂÃÂÃÂÃÂ¿ÃÂµÃÂ½ */ }

      if (semanticResults.length > 0) {
        setNormSearchResults(semanticResults);
      } else {
        // ÃÂÃÂ°ÃÂ¿ÃÂ°ÃÂÃÂ½ÃÂ¾ÃÂ¹ ÃÂ²ÃÂ°ÃÂÃÂ¸ÃÂ°ÃÂ½ÃÂ: ÃÂ¿ÃÂ¾ÃÂ¸ÃÂÃÂº ÃÂ¿ÃÂ¾ ÃÂÃÂµÃÂºÃÂÃÂÃÂ
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
        // Overwrite: ÃÂÃÂ´ÃÂ°ÃÂ»ÃÂ¸ÃÂÃÂ ÃÂÃÂÃÂÃÂµÃÂÃÂÃÂ²ÃÂÃÂÃÂÃÂ¸ÃÂ¹ ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂ ÃÂÃÂµÃÂÃÂµÃÂ· /api/normative-docs
        let overwriteId: string | null = null;
        if (decisions[file.name] === 'overwrite') {
          const existing = normativeDocs.find(d => d.name === file.name);
          if (existing) overwriteId = existing.id;
        }
        const filePath = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        // ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂºÃÂ° ÃÂ² Storage ÃÂ user JWT (ÃÂ´ÃÂ»ÃÂ bucket normative-docs ÃÂ´ÃÂ¾ÃÂ»ÃÂ¶ÃÂ½ÃÂ° ÃÂ±ÃÂÃÂÃÂ Storage policy ÃÂ´ÃÂ»ÃÂ authenticated INSERT).
        const uploadRes = await fetch(`${SURL}/storage/v1/object/normative-docs/${filePath}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!uploadRes.ok) { addNotification(`ÃÂÃÂÃÂ¸ÃÂ±ÃÂºÃÂ° ÃÂ·ÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂºÃÂ¸ "${file.name}": Storage ÃÂ½ÃÂµÃÂ´ÃÂ¾ÃÂÃÂÃÂÃÂ¿ÃÂµÃÂ½`, 'warning'); continue; }

        // ÃÂ ÃÂµÃÂ³ÃÂ¸ÃÂÃÂÃÂÃÂ¸ÃÂÃÂÃÂµÃÂ¼ ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂ ÃÂ² ÃÂÃÂ ÃÂÃÂµÃÂÃÂµÃÂ· server-side endpoint (admin/gip only).
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
          addNotification(`ÃÂÃÂÃÂ¸ÃÂ±ÃÂºÃÂ° ÃÂ·ÃÂ°ÃÂ¿ÃÂ¸ÃÂÃÂ¸ "${file.name}": ${e?.message || 'unknown'}`, 'warning');
          continue;
        }

        const docId = docRow?.id;
        if (!docId) continue;

        // ÃÂÃÂ°ÃÂ¿ÃÂÃÂÃÂº ÃÂ²ÃÂµÃÂºÃÂÃÂ¾ÃÂÃÂ¸ÃÂ·ÃÂ°ÃÂÃÂ¸ÃÂ¸ Ã¢ÂÂ ÃÂÃÂµÃÂÃÂµÃÂ· ÃÂÃÂ¾ÃÂ ÃÂ¶ÃÂµ endpoint
        apiPost('/api/normative-docs', { action: 'vectorize', doc_id: docId }).catch(() => {});
        successCount++;
      } catch {
        addNotification(`ÃÂÃÂÃÂ¸ÃÂ±ÃÂºÃÂ° ÃÂ·ÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂºÃÂ¸ "${file.name}"`, 'warning');
      }
    }
    await loadNormativeDocs();
    if (successCount > 0) addNotification(`ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ¶ÃÂµÃÂ½ÃÂ¾ ${successCount} ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂÃÂ¾ÃÂ². ÃÂÃÂ´ÃÂÃÂ ÃÂ²ÃÂµÃÂºÃÂÃÂ¾ÃÂÃÂ¸ÃÂ·ÃÂ°ÃÂÃÂ¸ÃÂ...`, 'success');
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
      addNotification(`ÃÂ¡ÃÂ¾ÃÂ¾ÃÂ±ÃÂÃÂµÃÂ½ÃÂ¸ÃÂµ ÃÂ½ÃÂµ ÃÂ¾ÃÂÃÂ¿ÃÂÃÂ°ÃÂ²ÃÂ»ÃÂµÃÂ½ÃÂ¾: ${err.message || 'ÃÂÃÂÃÂ¸ÃÂ±ÃÂºÃÂ° ÃÂÃÂµÃÂÃÂ²ÃÂµÃÂÃÂ°'}`, 'warning');
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
      addNotification(`ÃÂÃÂ¾ÃÂ¼ÃÂ¼ÃÂµÃÂ½ÃÂÃÂ°ÃÂÃÂ¸ÃÂ¹ ÃÂ½ÃÂµ ÃÂ¾ÃÂÃÂ¿ÃÂÃÂ°ÃÂ²ÃÂ»ÃÂµÃÂ½: ${err.message || 'ÃÂÃÂÃÂ¸ÃÂ±ÃÂºÃÂ° ÃÂÃÂµÃÂÃÂ²ÃÂµÃÂÃÂ°'}`, 'warning');
    }
  };
  const { notifications, addNotification, removeNotification } = useNotifications();

  // Ã¢ÂÂÃ¢ÂÂ Refs ÃÂ´ÃÂ»ÃÂ Realtime callbacks (escape stale closures) Ã¢ÂÂÃ¢ÂÂ
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

  // DASH-AUTOREFRESH: refresh on tab focus + 30s polling fallback (ÃÂµÃÂÃÂ»ÃÂ¸ Realtime ÃÂ»ÃÂ°ÃÂ³ÃÂ°ÃÂµÃÂ)
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

  // Ã¢ÂÂÃ¢ÂÂ Supabase Realtime: ÃÂ¿ÃÂ¾ÃÂ´ÃÂ¿ÃÂ¸ÃÂÃÂºÃÂ° ÃÂ½ÃÂ° ÃÂ¸ÃÂ·ÃÂ¼ÃÂµÃÂ½ÃÂµÃÂ½ÃÂ¸ÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂ Ã¢ÂÂÃ¢ÂÂ
  useEffect(() => {
    if (!token || !currentUserData?.id) return;
    const supa = getSupabaseAnonClient();
    const channel = supa.channel('tasks:live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, (payload: any) => {
        const t = payload.new;
        const me = currentUserDataRef.current;
        if (!me) return;
        if (String(t.assigned_to) === String(me.id)) {
          addNotifRef.current(`Ã°ÂÂÂ ÃÂÃÂ°ÃÂ¼ ÃÂ½ÃÂ°ÃÂ·ÃÂ½ÃÂ°ÃÂÃÂµÃÂ½ÃÂ° ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ°: ÃÂ«${t.name}ÃÂ»`, 'info');
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
          if (t.status === 'revision') addNotifRef.current(`Ã¢ÂÂ¡ ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ° ÃÂ½ÃÂ° ÃÂ´ÃÂ¾ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂºÃÂ: ÃÂ«${t.name}ÃÂ»`, 'warning');
          if (t.status === 'done') addNotifRef.current(`Ã¢ÂÂ ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ° ÃÂ·ÃÂ°ÃÂ²ÃÂµÃÂÃÂÃÂµÃÂ½ÃÂ°: ÃÂ«${t.name}ÃÂ»`, 'success');
        }
        if (myRole === 'lead' && t.status === 'review_lead') {
          const myEngIds = new Set(appUsersRef.current.filter((u: any) => u.dept_id === me.dept_id).map((u: any) => String(u.id)));
          if (myEngIds.has(String(t.assigned_to)) || String(t.assigned_to) === uid) {
            addNotifRef.current(`Ã°ÂÂÂ ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ° ÃÂ¾ÃÂ¶ÃÂ¸ÃÂ´ÃÂ°ÃÂµÃÂ ÃÂ²ÃÂ°ÃÂÃÂµÃÂ¹ ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂ¸: ÃÂ«${t.name}ÃÂ»`, 'info');
          }
        }
        if (myRole === 'gip' && t.status === 'review_gip') {
          addNotifRef.current(`Ã°ÂÂÂ ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ° ÃÂ¾ÃÂ¶ÃÂ¸ÃÂ´ÃÂ°ÃÂµÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂ¸ ÃÂÃÂÃÂÃÂ°: ÃÂ«${t.name}ÃÂ»`, 'info');
        }
        if (activeProjectRef.current?.id === t.project_id) loadTasksRef.current(t.project_id);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews' }, (payload: any) => {
        const r = payload.new;
        const me = currentUserDataRef.current;
        if (!me || String(r.author_id) === String(me.id)) return;
        if (activeProjectRef.current?.id === r.project_id) {
          addNotifRef.current(`Ã°ÂÂÂ ÃÂÃÂ¾ÃÂ²ÃÂ¾ÃÂµ ÃÂ·ÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂµ: ÃÂ«${r.title}ÃÂ»`, 'warning');
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reviews' }, (payload: any) => {
        const r = payload.new;
        const me = currentUserDataRef.current;
        if (!me) return;
        if (activeProjectRef.current?.id === r.project_id) {
          if (r.status === 'resolved') addNotifRef.current(`Ã¢ÂÂ ÃÂÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂµ ÃÂÃÂ½ÃÂÃÂÃÂ¾: ÃÂ«${r.title}ÃÂ»`, 'success');
          if (r.status === 'in_progress' && (me.role === 'gip' || me.role === 'lead')) addNotifRef.current(`Ã°ÂÂÂ§ ÃÂÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂµ ÃÂ²ÃÂ·ÃÂÃÂÃÂ¾ ÃÂ² ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂ: ÃÂ«${r.title}ÃÂ»`, 'info');
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transmittals' }, (payload: any) => {
        const tr = payload.new;
        const me = currentUserDataRef.current;
        if (!me) return;
        if (activeProjectRef.current?.id === tr.project_id && tr.status === 'issued') {
          addNotifRef.current(`Ã°ÂÂÂ¬ ÃÂ¢ÃÂÃÂ°ÃÂ½ÃÂÃÂ¼ÃÂ¸ÃÂÃÂÃÂ°ÃÂ» ÃÂ²ÃÂÃÂ¿ÃÂÃÂÃÂµÃÂ½: Ã¢ÂÂ${tr.number}`, 'info');
        }
      })
      // Ã¢ÂÂÃ¢ÂÂ Realtime: ÃÂ½ÃÂ¾ÃÂ²ÃÂÃÂµ ÃÂÃÂ¾ÃÂ¾ÃÂ±ÃÂÃÂµÃÂ½ÃÂ¸ÃÂ ÃÂÃÂ°ÃÂÃÂ° Ã¢ÂÂÃ¢ÂÂ
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
        const m = payload.new;
        const me = currentUserDataRef.current;
        if (!me) return;
        // ÃÂÃÂµ ÃÂ´ÃÂÃÂ±ÃÂ»ÃÂ¸ÃÂÃÂÃÂµÃÂ¼ ÃÂÃÂ²ÃÂ¾ÃÂ ÃÂÃÂ¾ÃÂ±ÃÂÃÂÃÂ²ÃÂµÃÂ½ÃÂ½ÃÂ¾ÃÂµ ÃÂÃÂ¾ÃÂ¾ÃÂ±ÃÂÃÂµÃÂ½ÃÂ¸ÃÂµ (ÃÂ¾ÃÂ½ÃÂ¾ ÃÂÃÂ¶ÃÂµ ÃÂ´ÃÂ¾ÃÂ±ÃÂ°ÃÂ²ÃÂ»ÃÂµÃÂ½ÃÂ¾ ÃÂÃÂµÃÂÃÂµÃÂ· loadMessages)
        if (String(m.user_id) === String(me.id)) return;
        const activeProj = activeProjectRef.current;
        if (activeProj?.id === m.project_id) {
          // ÃÂÃÂ¾ÃÂ±ÃÂ°ÃÂ²ÃÂ»ÃÂÃÂµÃÂ¼ ÃÂÃÂ¾ÃÂ¾ÃÂ±ÃÂÃÂµÃÂ½ÃÂ¸ÃÂµ ÃÂ² ÃÂÃÂµÃÂºÃÂÃÂÃÂ¸ÃÂ¹ ÃÂÃÂ¿ÃÂ¸ÃÂÃÂ¾ÃÂº ÃÂµÃÂÃÂ»ÃÂ¸ ÃÂ½ÃÂµ ÃÂ´ÃÂÃÂ±ÃÂ»ÃÂ¸ÃÂÃÂÃÂµÃÂÃÂÃÂ
          setMsgs((prev: any[]) => prev.find(msg => msg.id === m.id) ? prev : [...prev, m]);
        } else {
          // ÃÂ£ÃÂ²ÃÂµÃÂ´ÃÂ¾ÃÂ¼ÃÂ»ÃÂµÃÂ½ÃÂ¸ÃÂµ ÃÂ¾ ÃÂÃÂ¾ÃÂ¾ÃÂ±ÃÂÃÂµÃÂ½ÃÂ¸ÃÂ¸ ÃÂ² ÃÂ´ÃÂÃÂÃÂ³ÃÂ¾ÃÂ¼ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂµ
          const sender = appUsersRef.current.find((u: any) => String(u.id) === String(m.user_id));
          const proj = projectsRef.current.find((p: any) => p.id === m.project_id);
          if (proj && m.type !== 'call_invite') {
            addNotifRef.current(`Ã°ÂÂÂ¬ ${sender?.full_name || 'ÃÂ£ÃÂÃÂ°ÃÂÃÂÃÂ½ÃÂ¸ÃÂº'}: ÃÂ½ÃÂ¾ÃÂ²ÃÂ¾ÃÂµ ÃÂÃÂ¾ÃÂ¾ÃÂ±ÃÂÃÂµÃÂ½ÃÂ¸ÃÂµ ÃÂ² "${proj.name}"`, 'info');
          }
        }
        // call_invite ÃÂ¾ÃÂ±ÃÂÃÂ°ÃÂ±ÃÂ°ÃÂÃÂÃÂ²ÃÂ°ÃÂµÃÂÃÂÃÂ ÃÂÃÂ¾ÃÂ»ÃÂÃÂºÃÂ¾ ÃÂÃÂµÃÂÃÂµÃÂ· broadcast-ÃÂºÃÂ°ÃÂ½ÃÂ°ÃÂ» (callnotify)
      })
      .subscribe();
    return () => { supa.removeChannel(channel); };
  }, [currentUserData?.id]); // eslint-disable-line

  // Ã¢ÂÂÃ¢ÂÂ Supabase Realtime: ÃÂ¿ÃÂ¾ÃÂ´ÃÂ¿ÃÂ¸ÃÂÃÂºÃÂ° ÃÂ½ÃÂ° ÃÂ½ÃÂ¾ÃÂ²ÃÂÃÂµ ÃÂÃÂ¾ÃÂ¾ÃÂ±ÃÂÃÂµÃÂ½ÃÂ¸ÃÂ ÃÂÃÂ°ÃÂÃÂ° Ã¢ÂÂÃ¢ÂÂ
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

  // Polling Ã¢ÂÂ ÃÂ¾ÃÂ±ÃÂ½ÃÂ¾ÃÂ²ÃÂ»ÃÂµÃÂ½ÃÂ¸ÃÂµ ÃÂÃÂ¾ÃÂ¾ÃÂ±ÃÂÃÂµÃÂ½ÃÂ¸ÃÂ¹ ÃÂÃÂ°ÃÂÃÂ° ÃÂ¿ÃÂÃÂ¸ ÃÂ¾ÃÂÃÂºÃÂÃÂÃÂÃÂ¾ÃÂ¼ ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ¸
  useEffect(() => {
    if (!activeProject || !token || sideTab !== 'conference') return;
    const interval = setInterval(() => {
      loadMessages(activeProject.id);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeProject?.id, token, sideTab]); // eslint-disable-line

  // Polling Ã¢ÂÂ ÃÂÃÂ¾ÃÂ»ÃÂÃÂºÃÂ¾ ÃÂ´ÃÂ»ÃÂ ÃÂÃÂ²ÃÂµÃÂ´ÃÂ¾ÃÂ¼ÃÂ»ÃÂµÃÂ½ÃÂ¸ÃÂ¹ ÃÂ¾ ÃÂ·ÃÂ²ÃÂ¾ÃÂ½ÃÂºÃÂ°ÃÂ (ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸ ÃÂ¾ÃÂ±ÃÂ½ÃÂ¾ÃÂ²ÃÂ»ÃÂÃÂÃÂÃÂÃÂ ÃÂÃÂµÃÂÃÂµÃÂ· Realtime)
  useEffect(() => {
    if (!activeProject || !token) return;
    const interval = setInterval(async () => {
      const msgData = await get(`messages?project_id=eq.${activeProject.id}&type=eq.call_start&order=created_at.desc&limit=1`, token);
      if (Array.isArray(msgData) && msgData.length > 0) {
        const call = msgData[0];
        const callTime = new Date(call.created_at).getTime();
        // call_start ÃÂ¿ÃÂÃÂ¾ÃÂÃÂÃÂ¾ ÃÂ¾ÃÂ±ÃÂ½ÃÂ¾ÃÂ²ÃÂ»ÃÂÃÂµÃÂ ÃÂÃÂ¿ÃÂ¸ÃÂÃÂ¾ÃÂº Ã¢ÂÂ ÃÂÃÂ²ÃÂµÃÂ´ÃÂ¾ÃÂ¼ÃÂ»ÃÂµÃÂ½ÃÂ¸ÃÂµ ÃÂÃÂ¾ÃÂ»ÃÂÃÂºÃÂ¾ ÃÂÃÂµÃÂÃÂµÃÂ· ÃÂÃÂ²ÃÂ½ÃÂ¾ÃÂµ ÃÂ¿ÃÂÃÂ¸ÃÂ³ÃÂ»ÃÂ°ÃÂÃÂµÃÂ½ÃÂ¸ÃÂµ (callnotify broadcast)
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [activeProject, token, sideTab]);

  // Ã¢ÂÂÃ¢ÂÂ A6: AI task suggest Ã¢ÂÂ debounced call on task name change Ã¢ÂÂÃ¢ÂÂ
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

  // Ã¢ÂÂÃ¢ÂÂ Presence: ÃÂÃÂ¿ÃÂÃÂ°ÃÂ²ÃÂ»ÃÂµÃÂ½ÃÂ¸ÃÂµ ÃÂ¿ÃÂÃÂ¸ÃÂÃÂÃÂÃÂÃÂÃÂ²ÃÂ¸ÃÂµÃÂ¼ ÃÂ² ÃÂ·ÃÂ°ÃÂ»ÃÂµ ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ Ã¢ÂÂÃ¢ÂÂ
  const joinConference = async (initialMic = false, initialScreen = false) => {
    if (!activeProject?.id || !currentUserData) return;

    // ÃÂÃÂ°ÃÂ¿ÃÂÃÂµÃÂÃÂ¸ÃÂÃÂ ÃÂ²ÃÂÃÂ¾ÃÂ´ ÃÂ² ÃÂ´ÃÂÃÂÃÂ³ÃÂ¾ÃÂµ ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂµ Ã¢ÂÂ ÃÂ¿ÃÂÃÂµÃÂ´ÃÂ»ÃÂ¾ÃÂ¶ÃÂ¸ÃÂÃÂ ÃÂÃÂ½ÃÂ°ÃÂÃÂ°ÃÂ»ÃÂ° ÃÂ²ÃÂÃÂ¹ÃÂÃÂ¸
    if (presenceChannelRef.current && String(activeConferenceProjectRef.current?.id) !== String(activeProject.id)) {
      const otherName = activeConferenceProjectRef.current?.name || 'ÃÂ´ÃÂÃÂÃÂ³ÃÂ¾ÃÂ¼ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂµ';
      const ok = window.confirm(`ÃÂÃÂ ÃÂÃÂ¶ÃÂµ ÃÂ² ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ¸ ÃÂ¿ÃÂ¾ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ "${otherName}".\nÃÂÃÂÃÂ¹ÃÂÃÂ¸ ÃÂ¸ÃÂ· ÃÂ½ÃÂµÃÂ³ÃÂ¾ ÃÂ¸ ÃÂ²ÃÂ¾ÃÂ¹ÃÂÃÂ¸ ÃÂ² ÃÂÃÂÃÂ¾ ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂµ?`);
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
        // Only notify on first real join Ã¢ÂÂ ref is stable, no stale closure problem
        if (!knownParticipantIdsRef.current.has(uid)) {
          knownParticipantIdsRef.current.add(uid);
          addNotification(`Ã°ÂÂÂ¤ ${u.full_name || 'ÃÂ£ÃÂÃÂ°ÃÂÃÂÃÂ½ÃÂ¸ÃÂº'} ÃÂ·ÃÂ°ÃÂÃÂÃÂ» ÃÂ² ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂµ`, 'info');
        }
        // Always add to known set (presence update re-fires join Ã¢ÂÂ just update known)
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
            addNotification(`Ã°ÂÂÂ¤ ${u.full_name || 'ÃÂ£ÃÂÃÂ°ÃÂÃÂÃÂ½ÃÂ¸ÃÂº'} ÃÂ²ÃÂÃÂÃÂµÃÂ» ÃÂ¸ÃÂ· ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ`, 'info');
          }
          // else: user came back (was a track() update) Ã¢ÂÂ no notification, keep in knownIds
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
    }, 800); // 800ms debounce Ã¢ÂÂ batches rapid mic/talking updates into one track() call
  };

  const createProject = async () => {
    if (!newProject.name || !newProject.code) return;
    setSaving(true);
    try {
      // B4: gip_id ÃÂÃÂÃÂ°ÃÂ²ÃÂ¸ÃÂ¼ ÃÂÃÂµÃÂºÃÂÃÂÃÂ¸ÃÂ¼ ÃÂ¿ÃÂ¾ÃÂ»ÃÂÃÂ·ÃÂ¾ÃÂ²ÃÂ°ÃÂÃÂµÃÂ»ÃÂµÃÂ¼ Ã¢ÂÂ ÃÂ¾ÃÂ½ ÃÂÃÂÃÂ°ÃÂ½ÃÂ¾ÃÂ²ÃÂ¸ÃÂÃÂÃÂ ÃÂ²ÃÂ»ÃÂ°ÃÂ´ÃÂµÃÂ»ÃÂÃÂÃÂµÃÂ¼ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ°.
      // RLS projects_insert ÃÂÃÂÃÂµÃÂ±ÃÂÃÂµÃÂ, ÃÂÃÂÃÂ¾ÃÂ±ÃÂ gip_id = auth_app_user_id() ÃÂ´ÃÂ»ÃÂ ÃÂÃÂ¾ÃÂ»ÃÂ¸ gip.
      const created = await post("projects", { ...newProject, gip_id: currentUserData?.id, progress: 0, archived: false }, token!);
      // ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ¶ÃÂ°ÃÂµÃÂ¼ ÃÂ¢ÃÂ ÃÂµÃÂÃÂ»ÃÂ¸ ÃÂ²ÃÂÃÂ±ÃÂÃÂ°ÃÂ½ ÃÂÃÂ°ÃÂ¹ÃÂ»
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
        } catch (_) { /* ÃÂ¢ÃÂ ÃÂ½ÃÂµ ÃÂºÃÂÃÂ¸ÃÂÃÂ¸ÃÂÃÂ½ÃÂ¾ Ã¢ÂÂ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂ ÃÂÃÂ¶ÃÂµ ÃÂÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂ½ */ }
        if (tzFileRef.current) tzFileRef.current.value = '';
      }
      setNewProject({ name: "", code: "", deadline: "", status: "active", depts: [] });
      setShowNewProject(false);
      loadProjects();
      addNotification(`ÃÂÃÂÃÂ¾ÃÂµÃÂºÃÂ "${newProject.name}" ÃÂÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂ½`, 'success');
    } catch (err: any) {
      addNotification(`ÃÂÃÂÃÂ¸ÃÂ±ÃÂºÃÂ° ÃÂÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂ½ÃÂ¸ÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ°: ${err.message || 'ÃÂÃÂÃÂ¸ÃÂ±ÃÂºÃÂ° ÃÂÃÂµÃÂÃÂ²ÃÂµÃÂÃÂ°'}`, 'warning');
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
    if (!newTask.deadline) { addNotification('ÃÂ£ÃÂºÃÂ°ÃÂ¶ÃÂ¸ÃÂÃÂµ ÃÂ´ÃÂµÃÂ´ÃÂ»ÃÂ°ÃÂ¹ÃÂ½ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸', 'warning'); return; }
    setSaving(true);
    try {
      const leadUser = getUserById(newTask.assigned_to);
      const result = await createProjectTask({ name: newTask.name, dept: getDeptName(newTask.dept_id), priority: newTask.priority, deadline: newTask.deadline, assigned_to: newTask.assigned_to || null, status: "todo", project_id: activeProject.id, description: newTask.description || null }, token!);
      // Optimistic update: ÃÂµÃÂÃÂ»ÃÂ¸ ÃÂ²ÃÂµÃÂÃÂ½ÃÂÃÂ»ÃÂ°ÃÂÃÂ ÃÂ½ÃÂ¾ÃÂ²ÃÂ°ÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ°, ÃÂ´ÃÂ¾ÃÂ±ÃÂ°ÃÂ²ÃÂ ÃÂµÃÂ ÃÂ² ÃÂÃÂ¿ÃÂ¸ÃÂÃÂ¾ÃÂº ÃÂÃÂÃÂ°ÃÂ·ÃÂ
      if (result && typeof result === 'object') {
        setAllTasks((prev) => [...prev, result]);
        loadAllTasks(activeProject.id); // ÃÂÃÂ¾ÃÂÃÂ¾ÃÂ¼ ÃÂ¿ÃÂµÃÂÃÂµÃÂ·ÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂ¸ ÃÂ´ÃÂ»ÃÂ ÃÂÃÂ¸ÃÂ½ÃÂÃÂÃÂ¾ÃÂ½ÃÂ¸ÃÂ·ÃÂ°ÃÂÃÂ¸ÃÂ¸
        // Publish task.created event to Redis
        publishTaskCreated(String(result.id), String(activeProject.id), String(currentUserData?.id)).catch((err) => {
          console.warn('[Events] Failed to publish task.created:', err);
        });
      }
      addNotification(`ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ° "${newTask.name}" ÃÂÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂ½ÃÂ°${leadUser ? ` Ã¢ÂÂ ${leadUser.full_name}` : ''}`, 'success');
      if (newTask.assigned_to && String(newTask.assigned_to) !== String(currentUserData?.id)) {
        createNotification({
          user_id: Number(newTask.assigned_to),
          project_id: activeProject.id,
          type: 'task_assigned',
          title: `ÃÂÃÂ°ÃÂ¼ ÃÂ½ÃÂ°ÃÂ·ÃÂ½ÃÂ°ÃÂÃÂµÃÂ½ÃÂ° ÃÂ½ÃÂ¾ÃÂ²ÃÂ°ÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ°`,
          body: newTask.name,
          entity_type: 'task',
        }).catch(() => {});
      }
      setNewTask({ name: "", dept_id: "", priority: "medium", deadline: "", assigned_to: "", drawing_id: "", description: "" }); setShowNewTask(false); loadTasks(activeProject.id);
    } catch (err: any) {
      addNotification(`ÃÂÃÂÃÂ¸ÃÂ±ÃÂºÃÂ° ÃÂÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂ½ÃÂ¸ÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸: ${err.message || 'ÃÂÃÂÃÂ¸ÃÂ±ÃÂºÃÂ° ÃÂÃÂµÃÂÃÂ²ÃÂµÃÂÃÂ°'}`, 'warning');
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
    addNotification(`ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂ½ÃÂ¸ÃÂµ ÃÂÃÂ¼ÃÂµÃÂ¶ÃÂ½ÃÂ¸ÃÂºÃÂ°ÃÂ¼ ÃÂ¾ÃÂÃÂ¿ÃÂÃÂ°ÃÂ²ÃÂ»ÃÂµÃÂ½ÃÂ¾`, 'success');
    setNewAssignment({ name: "", target_dept: "", priority: "high", deadline: "" });
    setShowNewAssignment(false);
    setSaving(false);
    loadTasks(activeProject.id);
  };

  // CONV Stage 4b: ÃÂ·ÃÂ°ÃÂ¿ÃÂÃÂ¾ÃÂ ÃÂ²ÃÂÃÂ¾ÃÂ´ÃÂ½ÃÂÃÂ ÃÂ´ÃÂ°ÃÂ½ÃÂ½ÃÂÃÂ ÃÂ ÃÂÃÂ¼ÃÂµÃÂ¶ÃÂ½ÃÂ¾ÃÂ³ÃÂ¾ ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂ° (ÃÂ¿ÃÂ¾ ÃÂÃÂÃÂµÃÂ±ÃÂ¾ÃÂ²ÃÂ°ÃÂ½ÃÂ¸ÃÂ)
  const requestDependencyData = async () => {
    if (!selectedTask || !depRequest.target_dept_id || !depRequest.what_needed.trim() || !activeProject) {
      addNotification('ÃÂÃÂ°ÃÂ¿ÃÂ¾ÃÂ»ÃÂ½ÃÂ¸ ÃÂ²ÃÂÃÂµ ÃÂ¾ÃÂ±ÃÂÃÂ·ÃÂ°ÃÂÃÂµÃÂ»ÃÂÃÂ½ÃÂÃÂµ ÃÂ¿ÃÂ¾ÃÂ»ÃÂ', 'warning');
      return;
    }
    setSaving(true);
    try {
      const targetDeptName = getDeptNameById(Number(depRequest.target_dept_id));
      const reqTitle = `Ã°ÂÂÂ¥ ÃÂÃÂ°ÃÂ¿ÃÂÃÂ¾ÃÂ ÃÂ´ÃÂ°ÃÂ½ÃÂ½ÃÂÃÂ: ${depRequest.what_needed.trim().slice(0, 100)}`;
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
        description: `ÃÂÃÂ°ÃÂ¿ÃÂÃÂ¾ÃÂ ÃÂ¾ÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸ "${selectedTask.name}":\n\n${depRequest.what_needed}`,
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
      // ÃÂÃÂµÃÂÃÂµÃÂ²ÃÂµÃÂÃÂÃÂ¸ ÃÂÃÂµÃÂºÃÂÃÂÃÂÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ ÃÂ² awaiting_input
      await patch(`tasks?id=eq.${selectedTask.id}`, { status: 'awaiting_input' }, token!);
      setSelectedTask({ ...selectedTask, status: 'awaiting_input' });
      addNotification(`ÃÂÃÂ°ÃÂ¿ÃÂÃÂ¾ÃÂ ÃÂ¾ÃÂÃÂ¿ÃÂÃÂ°ÃÂ²ÃÂ»ÃÂµÃÂ½ ÃÂ² ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ» ${targetDeptName}. ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ° ÃÂ¿ÃÂµÃÂÃÂµÃÂ²ÃÂµÃÂ´ÃÂµÃÂ½ÃÂ° ÃÂ² "ÃÂÃÂ´ÃÂÃÂ ÃÂ´ÃÂ°ÃÂ½ÃÂ½ÃÂÃÂ"`, 'success');
      setShowDepRequest(false);
      setDepRequest({ target_dept_id: '', what_needed: '', deadline_hint: '' });
      loadTasks(activeProject.id);
    } catch (err: any) {
      addNotification(`ÃÂÃÂÃÂ¸ÃÂ±ÃÂºÃÂ°: ${err.message || 'ÃÂ½ÃÂµ ÃÂÃÂ´ÃÂ°ÃÂ»ÃÂ¾ÃÂÃÂ ÃÂ¾ÃÂÃÂ¿ÃÂÃÂ°ÃÂ²ÃÂ¸ÃÂÃÂ ÃÂ·ÃÂ°ÃÂ¿ÃÂÃÂ¾ÃÂ'}`, 'warning');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignmentResponse = async (taskId: number, accept: boolean, comment?: string) => {
      setSaving(true);
      if (accept) {
          await patch(`tasks?id=eq.${taskId}`, { assignment_status: 'accepted' }, token!);
          addNotification('ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂ½ÃÂ¸ÃÂµ ÃÂ¿ÃÂÃÂ¸ÃÂ½ÃÂÃÂÃÂ¾ ÃÂ² ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂ', 'success');
      } else {
          await patch(`tasks?id=eq.${taskId}`, { assignment_status: 'rejected', comment: comment || 'ÃÂÃÂÃÂºÃÂ»ÃÂ¾ÃÂ½ÃÂµÃÂ½ÃÂ¾ ÃÂ±ÃÂµÃÂ· ÃÂºÃÂ¾ÃÂ¼ÃÂ¼ÃÂµÃÂ½ÃÂÃÂ°ÃÂÃÂ¸ÃÂ' }, token!);
          addNotification('ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂ½ÃÂ¸ÃÂµ ÃÂ²ÃÂ¾ÃÂ·ÃÂ²ÃÂÃÂ°ÃÂÃÂµÃÂ½ÃÂ¾', 'warning');
      }
      setSaving(false);
      if(activeProject) loadTasks(activeProject.id);
  };
  const updateTaskStatus = async (taskId: number, status: string, comment?: string) => {
    const targetTask = allTasks.find(t => t.id === taskId);
    const currentStatus = targetTask?.status;
    if (currentStatus && !((taskWorkflowTransitions[currentStatus] || []).includes(status))) {
      const localAllowed = taskWorkflowTransitions[currentStatus] || [];
      const localMessage = `ÃÂÃÂµÃÂÃÂµÃÂÃÂ¾ÃÂ´ ${currentStatus} Ã¢ÂÂ ${status} ÃÂ·ÃÂ°ÃÂ¿ÃÂÃÂµÃÂÃÂÃÂ½ workflow. ÃÂÃÂ¾ÃÂ¿ÃÂÃÂÃÂÃÂ¸ÃÂ¼ÃÂ¾: ${localAllowed.join(', ') || 'ÃÂ½ÃÂµÃÂ ÃÂ¿ÃÂµÃÂÃÂµÃÂÃÂ¾ÃÂ´ÃÂ¾ÃÂ²'}.`;
      setWorkflowBlockInfo(localMessage);
      addNotification(localMessage, 'warning');
      return;
    }
    // ÃÂÃÂ¾ÃÂ·ÃÂ²ÃÂÃÂ°ÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸ ÃÂ² "revision" ÃÂ¾ÃÂ±ÃÂÃÂ·ÃÂ°ÃÂ½ ÃÂÃÂ¾ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂ¾ÃÂ¶ÃÂ´ÃÂ°ÃÂÃÂÃÂÃÂ ÃÂºÃÂ¾ÃÂ¼ÃÂ¼ÃÂµÃÂ½ÃÂÃÂ°ÃÂÃÂ¸ÃÂµÃÂ¼ Ã¢ÂÂ
    // ÃÂ¸ÃÂ½ÃÂ°ÃÂÃÂµ ÃÂ¸ÃÂÃÂ¿ÃÂ¾ÃÂ»ÃÂ½ÃÂ¸ÃÂÃÂµÃÂ»ÃÂ ÃÂ½ÃÂµ ÃÂ¿ÃÂ¾ÃÂ½ÃÂ¸ÃÂ¼ÃÂ°ÃÂµÃÂ, ÃÂÃÂÃÂ¾ ÃÂ¿ÃÂµÃÂÃÂµÃÂ´ÃÂµÃÂ»ÃÂÃÂ²ÃÂ°ÃÂÃÂ.
    if (status === 'revision') {
      const note = (comment || '').trim();
      if (!note) {
        const msg = 'ÃÂ§ÃÂÃÂ¾ÃÂ±ÃÂ ÃÂ²ÃÂµÃÂÃÂ½ÃÂÃÂÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ ÃÂ½ÃÂ° ÃÂ´ÃÂ¾ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂºÃÂ, ÃÂ¾ÃÂ¿ÃÂ¸ÃÂÃÂ¸ÃÂÃÂµ ÃÂ¿ÃÂÃÂ¸ÃÂÃÂ¸ÃÂ½ÃÂ ÃÂ² ÃÂºÃÂ¾ÃÂ¼ÃÂ¼ÃÂµÃÂ½ÃÂÃÂ°ÃÂÃÂ¸ÃÂ¸.';
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
          const msg = wfData.message || `ÃÂÃÂµÃÂÃÂµÃÂÃÂ¾ÃÂ´ ${currentStatus} Ã¢ÂÂ ${status} ÃÂ·ÃÂ°ÃÂ±ÃÂ»ÃÂ¾ÃÂºÃÂ¸ÃÂÃÂ¾ÃÂ²ÃÂ°ÃÂ½`;
          setWorkflowBlockInfo(msg);
          addNotification(msg, 'warning');
          return;
        }
        setWorkflowBlockInfo("");
      } catch {
        addNotification('ÃÂÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂ° workflow ÃÂ½ÃÂµÃÂ´ÃÂ¾ÃÂÃÂÃÂÃÂ¿ÃÂ½ÃÂ°, ÃÂ¿ÃÂÃÂ¸ÃÂ¼ÃÂµÃÂ½ÃÂÃÂ ÃÂ»ÃÂ¾ÃÂºÃÂ°ÃÂ»ÃÂÃÂ½ÃÂÃÂµ ÃÂ¿ÃÂÃÂ°ÃÂ²ÃÂ¸ÃÂ»ÃÂ°', 'info');
      }
    }
    setSaving(true);
    await patch(`tasks?id=eq.${taskId}`, { status, ...(comment ? { comment } : {}) }, token!);
    const statusLabel = statusMap[status]?.label || status;
    addNotification(`ÃÂ¡ÃÂÃÂ°ÃÂÃÂÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸ ÃÂ¸ÃÂ·ÃÂ¼ÃÂµÃÂ½ÃÂÃÂ½ Ã¢ÂÂ "${statusLabel}"`, status === 'done' ? 'success' : 'info');
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
    // ÃÂ¡ÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂÃÂ¼ ÃÂÃÂ²ÃÂµÃÂ´ÃÂ¾ÃÂ¼ÃÂ»ÃÂµÃÂ½ÃÂ¸ÃÂµ ÃÂ² ÃÂÃÂ ÃÂ´ÃÂ»ÃÂ ÃÂ¸ÃÂÃÂ¿ÃÂ¾ÃÂ»ÃÂ½ÃÂ¸ÃÂÃÂµÃÂ»ÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸
    if (targetTask?.assigned_to && targetTask.assigned_to !== currentUserData?.id) {
      createNotification({
        user_id: targetTask.assigned_to,
        project_id: activeProject?.id,
        type: 'task_status',
        title: `ÃÂ¡ÃÂÃÂ°ÃÂÃÂÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸ ÃÂ¸ÃÂ·ÃÂ¼ÃÂµÃÂ½ÃÂÃÂ½ Ã¢ÂÂ "${statusLabel}"`,
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
    addNotification('ÃÂ§ÃÂµÃÂÃÂÃÂµÃÂ¶ ÃÂ´ÃÂ¾ÃÂ±ÃÂ°ÃÂ²ÃÂ»ÃÂµÃÂ½ ÃÂ² ÃÂÃÂµÃÂµÃÂÃÂÃÂ', 'success');
    loadDrawings(activeProject.id);
  };
  const updateProjectDrawing = async (id: string, payload: any) => {
    if (!activeProject) return;
    await updateDrawing(id, { ...payload, updated_at: new Date().toISOString() }, token!);
    addNotification('ÃÂÃÂ°ÃÂÃÂÃÂ¾ÃÂÃÂºÃÂ° ÃÂÃÂµÃÂÃÂÃÂµÃÂ¶ÃÂ° ÃÂ¾ÃÂ±ÃÂ½ÃÂ¾ÃÂ²ÃÂ»ÃÂµÃÂ½ÃÂ°', 'info');
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
    addNotification('ÃÂÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂµ ÃÂ´ÃÂ¾ÃÂ±ÃÂ°ÃÂ²ÃÂ»ÃÂµÃÂ½ÃÂ¾', 'success');
    loadReviews(activeProject.id);
  };
  const changeReviewStatus = async (reviewId: string, status: string) => {
    if (!activeProject) return;
    await updateReviewStatus(reviewId, status, token!);
    addNotification(`ÃÂ¡ÃÂÃÂ°ÃÂÃÂÃÂ ÃÂ·ÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ ÃÂ¸ÃÂ·ÃÂ¼ÃÂµÃÂ½ÃÂÃÂ½: ${status}`, 'info');
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
    addNotification('ÃÂ¢ÃÂÃÂ°ÃÂ½ÃÂÃÂ¼ÃÂ¸ÃÂÃÂÃÂ°ÃÂ» ÃÂÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂ½', 'success');
    loadTransmittals(activeProject.id);
  };
  const changeTransmittalStatus = async (transmittalId: string, status: string) => {
    if (!activeProject) return;
    // ÃÂÃÂ°ÃÂÃÂ¸ÃÂÃÂ° ÃÂ¾ÃÂ ÃÂ²ÃÂÃÂ¿ÃÂÃÂÃÂºÃÂ° ÃÂ½ÃÂµÃÂ¿ÃÂ¾ÃÂ´ÃÂ¿ÃÂ¸ÃÂÃÂ°ÃÂ½ÃÂ½ÃÂ¾ÃÂ³ÃÂ¾ ÃÂ¼ÃÂ°ÃÂÃÂµÃÂÃÂ¸ÃÂ°ÃÂ»ÃÂ°: ÃÂµÃÂÃÂ»ÃÂ¸ ÃÂ² ÃÂÃÂ¾ÃÂÃÂÃÂ°ÃÂ²ÃÂµ ÃÂÃÂÃÂ°ÃÂ½ÃÂÃÂ¼ÃÂ¸ÃÂÃÂÃÂ°ÃÂ»ÃÂ°
    // ÃÂµÃÂÃÂÃÂ ÃÂÃÂµÃÂÃÂÃÂÃÂ¶, ÃÂ ÃÂºÃÂ¾ÃÂÃÂ¾ÃÂÃÂ¾ÃÂ³ÃÂ¾ ÃÂ¾ÃÂÃÂºÃÂÃÂÃÂÃÂ ÃÂ·ÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ severity='critical' Ã¢ÂÂ ÃÂ½ÃÂµ ÃÂ´ÃÂ°ÃÂÃÂ¼
    // ÃÂ¿ÃÂµÃÂÃÂµÃÂ²ÃÂµÃÂÃÂÃÂ¸ ÃÂÃÂÃÂ°ÃÂÃÂÃÂ ÃÂ² 'issued', ÃÂ¿ÃÂ¾ÃÂºÃÂ° ÃÂÃÂÃÂ¸ ÃÂ·ÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ ÃÂ½ÃÂµ ÃÂ·ÃÂ°ÃÂºÃÂÃÂÃÂÃÂ.
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
            const more = blockers.length > 3 ? ` ÃÂ¸ ÃÂµÃÂÃÂ ${blockers.length - 3}` : '';
            addNotification(
              `ÃÂÃÂµÃÂ»ÃÂÃÂ·ÃÂ ÃÂ²ÃÂÃÂ¿ÃÂÃÂÃÂÃÂ¸ÃÂÃÂ ÃÂÃÂÃÂ°ÃÂ½ÃÂÃÂ¼ÃÂ¸ÃÂÃÂÃÂ°ÃÂ»: ÃÂ¾ÃÂÃÂºÃÂÃÂÃÂÃÂ¾ ${blockers.length} critical-ÃÂ·ÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂµ(ÃÂ¹): ${titles}${more}.`,
              'warning'
            );
            return;
          }
        }
      } catch (e) {
        // ÃÂÃÂÃÂ»ÃÂ¸ ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂ° ÃÂÃÂ¿ÃÂ°ÃÂ»ÃÂ° Ã¢ÂÂ ÃÂ»ÃÂÃÂÃÂÃÂµ ÃÂ½ÃÂµ ÃÂ¿ÃÂÃÂ¾ÃÂ¿ÃÂÃÂÃÂºÃÂ°ÃÂÃÂ "issued" ÃÂ²ÃÂÃÂ»ÃÂµÃÂ¿ÃÂÃÂ.
        addNotification('ÃÂÃÂµ ÃÂÃÂ´ÃÂ°ÃÂ»ÃÂ¾ÃÂÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂ¸ÃÂÃÂ ÃÂ¾ÃÂÃÂºÃÂÃÂÃÂÃÂÃÂµ critical-ÃÂ·ÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ, ÃÂ²ÃÂÃÂ¿ÃÂÃÂÃÂº ÃÂ¾ÃÂÃÂ¼ÃÂµÃÂ½ÃÂÃÂ½.', 'warning');
        return;
      }
    }
    await updateTransmittalStatus(transmittalId, status, token!);
    addNotification(`ÃÂ¡ÃÂÃÂ°ÃÂÃÂÃÂ ÃÂÃÂÃÂ°ÃÂ½ÃÂÃÂ¼ÃÂ¸ÃÂÃÂÃÂ°ÃÂ»ÃÂ° ÃÂ¸ÃÂ·ÃÂ¼ÃÂµÃÂ½ÃÂÃÂ½: ${transmittalStatusMap[status] || status}`, 'info');
    loadTransmittals(activeProject.id);
  };
  const addTransmittalItem = async (transmittalId: string, drawingId?: string, revisionId?: string) => {
    if (!activeProject) return;
    if (!drawingId && !revisionId) {
      addNotification('ÃÂÃÂÃÂ±ÃÂµÃÂÃÂ¸ÃÂÃÂµ ÃÂÃÂµÃÂÃÂÃÂÃÂ¶ ÃÂ¸/ÃÂ¸ÃÂ»ÃÂ¸ ÃÂÃÂµÃÂ²ÃÂ¸ÃÂ·ÃÂ¸ÃÂ ÃÂ´ÃÂ»ÃÂ ÃÂ¿ÃÂ¾ÃÂ·ÃÂ¸ÃÂÃÂ¸ÃÂ¸ ÃÂÃÂÃÂ°ÃÂ½ÃÂÃÂ¼ÃÂ¸ÃÂÃÂÃÂ°ÃÂ»ÃÂ°', 'warning');
      return;
    }
    await createTransmittalItem({
      transmittal_id: transmittalId,
      drawing_id: drawingId || null,
      revision_id: revisionId || null,
    }, token!);
    addNotification('ÃÂÃÂ¾ÃÂ·ÃÂ¸ÃÂÃÂ¸ÃÂ ÃÂ´ÃÂ¾ÃÂ±ÃÂ°ÃÂ²ÃÂ»ÃÂµÃÂ½ÃÂ° ÃÂ² ÃÂÃÂÃÂ°ÃÂ½ÃÂÃÂ¼ÃÂ¸ÃÂÃÂÃÂ°ÃÂ»', 'success');
    setTransmittalDraftLinks((prev) => ({ ...prev, [transmittalId]: { drawingId: '', revisionId: '' } }));
    loadTransmittals(activeProject.id);
  };
  const assignTask = async (taskId: number, assignedTo: string) => {
    const eng = getUserById(assignedTo);
    await patch(`tasks?id=eq.${taskId}`, { assigned_to: assignedTo, status: "todo" }, token!);
    addNotification(`ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ° ÃÂ½ÃÂ°ÃÂ·ÃÂ½ÃÂ°ÃÂÃÂµÃÂ½ÃÂ° Ã¢ÂÂ ${eng?.full_name || 'ÃÂ¸ÃÂ½ÃÂ¶ÃÂµÃÂ½ÃÂµÃÂ'}`, 'info');
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
    addNotification(`ÃÂÃÂÃÂ¿ÃÂÃÂÃÂµÃÂ½ÃÂ° ÃÂÃÂµÃÂ²ÃÂ¸ÃÂ·ÃÂ¸ÃÂ R${newRevNum} ÃÂ´ÃÂ»ÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸ "${task.name}"`, 'success');
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
    // Sign out from Supabase JS Ã¢ÂÂ onAuthStateChange will clear token + userEmail.
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
  if (!authReady) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: dark ? '#0f1117' : '#f4f6fa' }}><span style={{ color: '#8896a8', fontSize: 14 }}>ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂºÃÂ°...</span></div>;
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
      if (task.status === "todo") actions.push({ label: "Ã¢ÂÂ¶ ÃÂÃÂ·ÃÂÃÂÃÂ ÃÂ² ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂ", status: "inprogress", color: C.blue });
      if (task.status === "inprogress") actions.push({ label: "Ã¢ÂÂ ÃÂÃÂÃÂ¿ÃÂÃÂ°ÃÂ²ÃÂ¸ÃÂÃÂ ÃÂ½ÃÂ° ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂ", status: "review_lead", color: C.accent });
      if (task.status === "revision") actions.push({ label: "Ã¢ÂÂ¶ ÃÂ¡ÃÂ½ÃÂ¾ÃÂ²ÃÂ° ÃÂ² ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂ", status: "inprogress", color: C.blue });
      // CONV-Q5 (B): ÃÂ¸ÃÂ½ÃÂ¶ÃÂµÃÂ½ÃÂµÃÂ ÃÂÃÂ°ÃÂ¼ ÃÂ¿ÃÂ¾ÃÂ´ÃÂÃÂ²ÃÂµÃÂÃÂ¶ÃÂ´ÃÂ°ÃÂµÃÂ ÃÂ²ÃÂ¾ÃÂ·ÃÂ¾ÃÂ±ÃÂ½ÃÂ¾ÃÂ²ÃÂ»ÃÂµÃÂ½ÃÂ¸ÃÂµ ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂ ÃÂ¿ÃÂ¾ÃÂÃÂ»ÃÂµ ÃÂ¿ÃÂ¾ÃÂ»ÃÂÃÂÃÂµÃÂ½ÃÂ¸ÃÂ ÃÂ´ÃÂ°ÃÂ½ÃÂ½ÃÂÃÂ
      if (task.status === "awaiting_input") actions.push({ label: "Ã¢ÂÂ¶ ÃÂÃÂ¾ÃÂ·ÃÂ¾ÃÂ±ÃÂ½ÃÂ¾ÃÂ²ÃÂ¸ÃÂÃÂ ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂ (ÃÂ´ÃÂ°ÃÂ½ÃÂ½ÃÂÃÂµ ÃÂ¿ÃÂ¾ÃÂ»ÃÂÃÂÃÂµÃÂ½ÃÂ)", status: "inprogress", color: C.blue });
    }
    if (isLead) {
      const myEngIds = appUsers.filter(u => u.dept_id === currentUserData?.dept_id && u.role === "engineer").map(u => String(u.id));
      if (myEngIds.includes(assigned) && task.status === "review_lead") { actions.push({ label: "Ã¢ÂÂ ÃÂ£ÃÂÃÂ²ÃÂµÃÂÃÂ´ÃÂ¸ÃÂÃÂ Ã¢ÂÂ ÃÂÃÂÃÂÃÂ", status: "review_gip", color: C.green }); actions.push({ label: "Ã¢ÂÂ ÃÂÃÂ° ÃÂ´ÃÂ¾ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂºÃÂ (ÃÂÃÂºÃÂ°ÃÂ¶ÃÂ¸ÃÂÃÂµ ÃÂ¿ÃÂÃÂ¸ÃÂÃÂ¸ÃÂ½ÃÂ)", status: "revision", color: C.red, requiresReason: true }); }
    }
    if (isGip && task.status === "review_gip") { actions.push({ label: "Ã¢ÂÂ ÃÂÃÂ°ÃÂ²ÃÂµÃÂÃÂÃÂ¸ÃÂÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ", status: "done", color: C.green }); actions.push({ label: "Ã¢ÂÂ ÃÂÃÂ° ÃÂ´ÃÂ¾ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂºÃÂ (ÃÂÃÂºÃÂ°ÃÂ¶ÃÂ¸ÃÂÃÂµ ÃÂ¿ÃÂÃÂ¸ÃÂÃÂ¸ÃÂ½ÃÂ)", status: "revision", color: C.red, requiresReason: true }); }
    return actions;
  };

  const navItems = [
    { id: "dashboard", icon: "Ã¢Â¬Â¡", label: "ÃÂÃÂ±ÃÂ·ÃÂ¾ÃÂ" },
    { id: "projects_list", icon: "Ã¢ÂÂ", label: "ÃÂÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ" },
    { id: "tasks", icon: "Ã¢ÂÂ¡", label: "ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸" },
    { id: "standards", icon: "Ã¢ÂÂ", label: "ÃÂ¡ÃÂÃÂ°ÃÂ½ÃÂ´ÃÂ°ÃÂÃÂÃÂ" },
    { id: "specifications", icon: "Ã°ÂÂÂ", label: "ÃÂ¡ÃÂ¿ÃÂµÃÂÃÂ¸ÃÂÃÂ¸ÃÂºÃÂ°ÃÂÃÂ¸ÃÂ¸" },
    { id: "normative", icon: "Ã°ÂÂÂ", label: "ÃÂÃÂ¾ÃÂÃÂ¼ÃÂ°ÃÂÃÂ¸ÃÂ²ÃÂºÃÂ°" },
    { id: "calculations", icon: "Ã¢ÂÂ", label: "ÃÂ ÃÂ°ÃÂÃÂÃÂÃÂÃÂ" }
  ];

  const screenTitles: Record<string, string> = { dashboard: "ÃÂ ÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂ¸ÃÂ¹ ÃÂÃÂÃÂ¾ÃÂ»", project: "ÃÂÃÂ°ÃÂÃÂÃÂ¾ÃÂÃÂºÃÂ° ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ°", projects_list: "ÃÂ ÃÂµÃÂµÃÂÃÂÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ¾ÃÂ²", tasks: "ÃÂÃÂ¾ÃÂ¸ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸", standards: "ÃÂÃÂ¾ÃÂ¸ÃÂÃÂº ÃÂ¡ÃÂÃÂ°ÃÂ½ÃÂ´ÃÂ°ÃÂÃÂÃÂ¾ÃÂ²", specifications: "ÃÂ¡ÃÂ¿ÃÂµÃÂÃÂ¸ÃÂÃÂ¸ÃÂºÃÂ°ÃÂÃÂ¸ÃÂ¸", normative: "ÃÂÃÂ°ÃÂ·ÃÂ° ÃÂ·ÃÂ½ÃÂ°ÃÂ½ÃÂ¸ÃÂ¹ (ÃÂÃÂ¾ÃÂÃÂ¼ÃÂ°ÃÂÃÂ¸ÃÂ²ÃÂºÃÂ°)", calculations: "ÃÂ ÃÂ°ÃÂÃÂÃÂÃÂÃÂ" };

  const calcTemplates = Object.values(calcRegistry);
  const calcCatLabels: Record<string, string> = { "ÃÂ¢ÃÂ¥": "ÃÂ¢ÃÂ¥ Ã¢ÂÂ ÃÂ¢ÃÂµÃÂÃÂ½ÃÂ¾ÃÂ»ÃÂ¾ÃÂ³ÃÂ¸ÃÂ", "ÃÂ¢ÃÂ¢": "ÃÂ¢ÃÂ¢ Ã¢ÂÂ ÃÂ¢ÃÂµÃÂ¿ÃÂ»ÃÂ¾ÃÂÃÂµÃÂÃÂ½ÃÂ¸ÃÂºÃÂ°", "ÃÂ­ÃÂ": "ÃÂ­ÃÂ Ã¢ÂÂ ÃÂ­ÃÂ»ÃÂµÃÂºÃÂÃÂÃÂ¸ÃÂºÃÂ°", "ÃÂÃÂ": "ÃÂÃÂ Ã¢ÂÂ ÃÂÃÂ¾ÃÂ´ÃÂ¾ÃÂÃÂ½ÃÂ°ÃÂ±ÃÂ¶ÃÂµÃÂ½ÃÂ¸ÃÂµ", "ÃÂÃÂ": "ÃÂÃÂ Ã¢ÂÂ ÃÂÃÂ¾ÃÂ¶ÃÂ°ÃÂÃÂ½ÃÂ°ÃÂ ÃÂ±ÃÂµÃÂ·ÃÂ¾ÃÂ¿ÃÂ°ÃÂÃÂ½ÃÂ¾ÃÂÃÂÃÂ", "ÃÂ": "ÃÂÃÂµÃÂ½ÃÂ¿ÃÂ»ÃÂ°ÃÂ½", "ÃÂÃÂ / ÃÂÃÂ": "ÃÂÃÂ / ÃÂÃÂ Ã¢ÂÂ ÃÂÃÂ¾ÃÂ½ÃÂÃÂÃÂÃÂÃÂºÃÂÃÂ¸ÃÂ²", "ÃÂÃÂÃÂÃÂ¸ÃÂ": "ÃÂÃÂÃÂÃÂ¸ÃÂ", "ÃÂÃÂ": "ÃÂÃÂ Ã¢ÂÂ ÃÂÃÂÃÂ¾ÃÂ¿ÃÂ»ÃÂµÃÂ½ÃÂ¸ÃÂµ ÃÂ¸ ÃÂ²ÃÂµÃÂ½ÃÂÃÂ¸ÃÂ»ÃÂÃÂÃÂ¸ÃÂ" };
  const calcAllCats = ["ÃÂ¢ÃÂ¥", "ÃÂ¢ÃÂ¢", "ÃÂ­ÃÂ", "ÃÂÃÂ", "ÃÂÃÂ", "ÃÂ", "ÃÂÃÂ / ÃÂÃÂ", "ÃÂÃÂÃÂÃÂ¸ÃÂ", "ÃÂÃÂ"];

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-logo">Ã¢Â¬Â¡</div>
      <div style={{ color: "#8892a4", fontSize: 14, fontWeight: 500 }}>ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂºÃÂ° EngHub...</div>
    </div>
  );

  return (
    <div className="app-root">
      {/* ===== MODALS ===== */}
      {showNewProject && (
        <Modal title="ÃÂÃÂ¾ÃÂ²ÃÂÃÂ¹ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂ" onClose={() => setShowNewProject(false)} C={C}>
          <div className="form-stack">
            <Field label="ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ *" C={C}><input value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} placeholder="ÃÂ¢ÃÂ­ÃÂ¦-6 ÃÂ¡ÃÂÃÂÃÂ¾ÃÂ¸ÃÂÃÂµÃÂ»ÃÂÃÂÃÂÃÂ²ÃÂ¾" style={getInp(C)} /></Field>
            <Field label="ÃÂÃÂÃÂ ÃÂÃÂ ÃÂÃÂÃÂÃÂ¢ÃÂ *" C={C}><input value={newProject.code} onChange={e => setNewProject({ ...newProject, code: e.target.value })} placeholder="ÃÂ¢ÃÂ­ÃÂ¦-2025-01" style={getInp(C)} /></Field>
            <Field label="ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ« *" C={C}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                {depts.map(d => (
                  <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text, cursor: 'pointer' }}>
                    <input type="checkbox" checked={newProject.depts?.includes(d.id)} onChange={() => toggleProjectDept(d.id)} />
                    {d.name}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="ÃÂÃÂÃÂÃÂÃÂÃÂÃÂ" C={C}><RuDateInput value={newProject.deadline} onChange={v => setNewProject({ ...newProject, deadline: v })} C={C} /></Field>
            <Field label="ÃÂ¡ÃÂ¢ÃÂÃÂ¢ÃÂ£ÃÂ¡" C={C}><select value={newProject.status} onChange={e => setNewProject({ ...newProject, status: e.target.value })} style={getInp(C)}><option value="active">ÃÂ ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂµ</option><option value="review">ÃÂÃÂ° ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂµ</option></select></Field>
            <Field label="ÃÂÃÂÃÂÃÂÃÂÃÂÃÂ ÃÂÃÂ ÃÂÃÂ ÃÂÃÂÃÂÃÂ¢ÃÂÃÂ ÃÂÃÂÃÂÃÂÃÂÃÂ (ÃÂ½ÃÂµÃÂ¾ÃÂ±ÃÂÃÂ·ÃÂ°ÃÂÃÂµÃÂ»ÃÂÃÂ½ÃÂ¾)" C={C}>
              <input
                ref={tzFileRef}
                type="file"
                accept=".pdf"
                style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: '6px 8px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const }}
              />
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>PDF Ã¢ÂÂ ÃÂ±ÃÂÃÂ´ÃÂµÃÂ ÃÂ°ÃÂ²ÃÂÃÂ¾ÃÂ¼ÃÂ°ÃÂÃÂ¸ÃÂÃÂµÃÂÃÂºÃÂ¸ ÃÂÃÂ°ÃÂ·ÃÂ¾ÃÂ±ÃÂÃÂ°ÃÂ½ ÃÂ½ÃÂ° ÃÂÃÂ°ÃÂ·ÃÂ´ÃÂµÃÂ»ÃÂ</div>
            </Field>
            <button className="btn btn-primary" onClick={createProject} disabled={saving || !newProject.name || !newProject.code} style={{ width: "100%", opacity: (!newProject.name || !newProject.code) ? 0.5 : 1 }}>{saving ? "ÃÂ¡ÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂÃÂÃÂÃÂ..." : "ÃÂ¡ÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂ"}</button>
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
        <Modal title="ÃÂÃÂ¾ÃÂ²ÃÂ°ÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ°" onClose={() => { setShowNewTask(false); setNewTask({ name: "", dept_id: "", priority: "medium", deadline: "", assigned_to: "", drawing_id: "", description: "" }); setTaskSuggest(null); }} C={C}>
          <div className="form-stack">
            <button
              type="button"
              onClick={() => setShowTaskTemplates(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: C.accent, fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
            >
              Ã°ÂÂÂ ÃÂÃÂÃÂ±ÃÂÃÂ°ÃÂÃÂ ÃÂ¸ÃÂ· ÃÂÃÂ°ÃÂ±ÃÂ»ÃÂ¾ÃÂ½ÃÂ°
            </button>
            <Field label="ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ *" C={C}><input value={newTask.name} onChange={e => setNewTask({ ...newTask, name: e.target.value })} placeholder="ÃÂ ÃÂ°ÃÂÃÂÃÂÃÂ ÃÂ½ÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂ¾ÃÂº" style={getInp(C)} /></Field>
            <Field label="ÃÂÃÂÃÂÃÂ¡ÃÂÃÂÃÂÃÂ" C={C}><textarea value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} placeholder="ÃÂÃÂ¾ÃÂ´ÃÂÃÂ¾ÃÂ±ÃÂ½ÃÂ¾ÃÂµ ÃÂ¾ÃÂ¿ÃÂ¸ÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂµ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸..." rows={3} style={{ ...getInp(C), resize: 'vertical', fontFamily: 'inherit' }} /></Field>
            <Field label="ÃÂÃÂÃÂÃÂÃÂÃÂ§ÃÂÃÂ¢ÃÂ¬ ÃÂ ÃÂ£ÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂ®" C={C}><select value={newTask.assigned_to} onChange={e => { const lead = appUsers.find(u => String(u.id) === e.target.value); setNewTask({ ...newTask, assigned_to: e.target.value, dept_id: lead?.dept_id || "" }); }} style={getInp(C)}><option value="">Ã¢ÂÂ ÃÂÃÂÃÂ±ÃÂÃÂ°ÃÂÃÂ Ã¢ÂÂ</option>{myLeads.map(u => <option key={u.id} value={u.id}>{u.full_name} ({getDeptName(u.dept_id)})</option>)}</select></Field>
            <Field label="ÃÂ§ÃÂÃÂ ÃÂ¢ÃÂÃÂ (ÃÂÃÂÃÂ¦ÃÂÃÂÃÂÃÂÃÂÃÂ¬ÃÂÃÂ)" C={C}>
              <select value={newTask.drawing_id} onChange={e => setNewTask({ ...newTask, drawing_id: e.target.value })} style={getInp(C)}>
                <option value="">Ã¢ÂÂ ÃÂÃÂµÃÂ· ÃÂ¿ÃÂÃÂ¸ÃÂ²ÃÂÃÂ·ÃÂºÃÂ¸ Ã¢ÂÂ</option>
                {drawings.map(d => <option key={d.id} value={d.id}>{d.code} Ã¢ÂÂ {d.title}</option>)}
              </select>
            </Field>
            <Field label="ÃÂÃÂ ÃÂÃÂÃÂ ÃÂÃÂ¢ÃÂÃÂ¢" C={C}><select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })} style={getInp(C)}><option value="high">Ã°ÂÂÂ´ ÃÂÃÂÃÂÃÂ¾ÃÂºÃÂ¸ÃÂ¹</option><option value="medium">Ã°ÂÂÂ¡ ÃÂ¡ÃÂÃÂµÃÂ´ÃÂ½ÃÂ¸ÃÂ¹</option><option value="low">Ã¢ÂÂª ÃÂÃÂ¸ÃÂ·ÃÂºÃÂ¸ÃÂ¹</option></select></Field>
            <Field label="ÃÂÃÂÃÂÃÂÃÂÃÂÃÂ" C={C}><RuDateInput value={newTask.deadline} onChange={v => setNewTask({ ...newTask, deadline: v })} C={C} /></Field>
            {taskSuggestLoading && (
              <div style={{ fontSize: 12, color: C.accent, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: `2px solid ${C.accent}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                AI ÃÂ¿ÃÂ¾ÃÂ´ÃÂ±ÃÂ¸ÃÂÃÂ°ÃÂµÃÂ ÃÂ´ÃÂµÃÂ´ÃÂ»ÃÂ°ÃÂ¹ÃÂ½Ã¢ÂÂ¦
              </div>
            )}
            {taskSuggest && !taskSuggestLoading && (
              <div style={{ background: C.accent + '12', border: `1px solid ${C.accent}30`, borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>Ã°ÂÂ¤Â</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.accent }}>AI ÃÂ¿ÃÂÃÂµÃÂ´ÃÂ»ÃÂ°ÃÂ³ÃÂ°ÃÂµÃÂ ÃÂ´ÃÂµÃÂ´ÃÂ»ÃÂ°ÃÂ¹ÃÂ½: {taskSuggest.deadline}</div>
                  {taskSuggest.reason && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{taskSuggest.reason}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => { setNewTask(prev => ({ ...prev, deadline: taskSuggest.deadline! })); setTaskSuggest(null); }}
                  style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                >
                  ÃÂÃÂÃÂ¸ÃÂ¼ÃÂµÃÂ½ÃÂ¸ÃÂÃÂ
                </button>
              </div>
            )}
            <button className="btn btn-primary" onClick={createTask} disabled={saving || !newTask.name || !newTask.deadline} style={{ width: "100%", opacity: (!newTask.name || !newTask.deadline) ? 0.5 : 1 }}>{saving ? "ÃÂ¡ÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂÃÂÃÂÃÂ..." : "ÃÂ¡ÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ"}</button>
          </div>
        </Modal>
      )}
      {showNewAssignment && (
        <Modal title="ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂ½ÃÂ¸ÃÂµ ÃÂÃÂ¼ÃÂµÃÂ¶ÃÂ½ÃÂ¸ÃÂºÃÂ" onClose={() => setShowNewAssignment(false)} C={C}>
          <div className="form-stack">
            <Field label="ÃÂ¡ÃÂ£ÃÂ¢ÃÂ¬ ÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¯ *" C={C}><input value={newAssignment.name} onChange={e => setNewAssignment({ ...newAssignment, name: e.target.value })} placeholder="ÃÂÃÂÃÂ´ÃÂ°ÃÂÃÂ ÃÂ½ÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂºÃÂ¸ ÃÂ½ÃÂ° ÃÂÃÂÃÂ½ÃÂ´ÃÂ°ÃÂ¼ÃÂµÃÂ½ÃÂ..." style={getInp(C)} /></Field>
            <Field label="ÃÂÃÂ¢ÃÂÃÂÃÂ-ÃÂÃÂÃÂÃÂ£ÃÂ§ÃÂÃÂ¢ÃÂÃÂÃÂ¬ *" C={C}>
              <select value={newAssignment.target_dept} onChange={e => setNewAssignment({ ...newAssignment, target_dept: e.target.value })} style={getInp(C)}>
                <option value="">Ã¢ÂÂ ÃÂÃÂÃÂ±ÃÂÃÂ°ÃÂÃÂ ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ» Ã¢ÂÂ</option>
                {(() => {
                  // BUG-2 fix: fallback ÃÂ½ÃÂ° ÃÂ²ÃÂÃÂµ ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂ, ÃÂµÃÂÃÂ»ÃÂ¸ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ½ÃÂÃÂ¹ ÃÂÃÂ¿ÃÂ¸ÃÂÃÂ¾ÃÂº ÃÂ¿ÃÂÃÂÃÂ.
                  const projectDeptIds: number[] = (activeProject?.depts || []).filter((d:number) => String(d) !== String(currentUserData?.dept_id));
                  const fallback: number[] = depts.map((d:any) => Number(d.id)).filter((id:number) => String(id) !== String(currentUserData?.dept_id));
                  const list: number[] = projectDeptIds.length > 0 ? projectDeptIds : fallback;
                  return list.map((dId: number) => <option key={dId} value={dId}>{getDeptNameById(dId)}</option>);
                })()}
              </select>
            </Field>
            <Field label="ÃÂÃÂ ÃÂÃÂÃÂ ÃÂÃÂ¢ÃÂÃÂ¢" C={C}><select value={newAssignment.priority} onChange={e => setNewAssignment({ ...newAssignment, priority: e.target.value })} style={getInp(C)}><option value="high">Ã°ÂÂÂ´ ÃÂÃÂÃÂÃÂ¾ÃÂºÃÂ¸ÃÂ¹</option><option value="medium">Ã°ÂÂÂ¡ ÃÂ¡ÃÂÃÂµÃÂ´ÃÂ½ÃÂ¸ÃÂ¹</option><option value="low">Ã¢ÂÂª ÃÂÃÂ¸ÃÂ·ÃÂºÃÂ¸ÃÂ¹</option></select></Field>
            <Field label="ÃÂ¢ÃÂ ÃÂÃÂÃÂ£ÃÂÃÂÃÂ«ÃÂ ÃÂÃÂÃÂÃÂÃÂÃÂÃÂ" C={C}><RuDateInput value={newAssignment.deadline} onChange={v => setNewAssignment({ ...newAssignment, deadline: v })} C={C} /></Field>
            <button className="btn btn-primary" onClick={createAssignment} disabled={saving || !newAssignment.name || !newAssignment.target_dept} style={{ width: "100%", opacity: (!newAssignment.name || !newAssignment.target_dept) ? 0.5 : 1 }}>{saving ? "ÃÂÃÂÃÂ¿ÃÂÃÂ°ÃÂ²ÃÂºÃÂ°..." : "ÃÂÃÂÃÂ¿ÃÂÃÂ°ÃÂ²ÃÂ¸ÃÂÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂ½ÃÂ¸ÃÂµ"}</button>
          </div>
        </Modal>
      )}
      {showDepRequest && selectedTask && (
        <Modal title="ÃÂÃÂ°ÃÂ¿ÃÂÃÂ¾ÃÂ ÃÂ´ÃÂ°ÃÂ½ÃÂ½ÃÂÃÂ ÃÂ ÃÂÃÂ¼ÃÂµÃÂ¶ÃÂ½ÃÂ¾ÃÂ³ÃÂ¾ ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂ°" onClose={() => setShowDepRequest(false)} C={C} topmost>
          <div className="form-stack">
            <div style={{ background: "rgba(6,182,212,.08)", border: "1px solid rgba(6,182,212,.3)", borderRadius: 8, padding: 10, fontSize: 12.5, color: C.textDim, marginBottom: 4 }}>
              Ã¢ÂÂ¹ ÃÂ¢ÃÂµÃÂºÃÂÃÂÃÂ°ÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ° <b>ÃÂ«{selectedTask.name}ÃÂ»</b> ÃÂ¿ÃÂµÃÂÃÂµÃÂ²ÃÂµÃÂ´ÃÂÃÂÃÂÃÂ ÃÂ² ÃÂÃÂÃÂ°ÃÂÃÂÃÂ <b>ÃÂ«ÃÂÃÂ´ÃÂÃÂ ÃÂ´ÃÂ°ÃÂ½ÃÂ½ÃÂÃÂÃÂ»</b>. ÃÂÃÂ¾ÃÂÃÂ»ÃÂµ ÃÂ¿ÃÂ¾ÃÂ»ÃÂÃÂÃÂµÃÂ½ÃÂ¸ÃÂ ÃÂ´ÃÂ°ÃÂ½ÃÂ½ÃÂÃÂ ÃÂ²ÃÂµÃÂÃÂ½ÃÂÃÂÃÂÃÂ ÃÂº ÃÂÃÂµÃÂ±ÃÂµ ÃÂºÃÂ½ÃÂ¾ÃÂ¿ÃÂºÃÂ¾ÃÂ¹ ÃÂ«ÃÂÃÂ¾ÃÂ·ÃÂ¾ÃÂ±ÃÂ½ÃÂ¾ÃÂ²ÃÂ¸ÃÂÃÂ ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂÃÂ».
            </div>
            <Field label="ÃÂÃÂ¢ÃÂÃÂÃÂ-ÃÂÃÂÃÂÃÂ£ÃÂ§ÃÂÃÂ¢ÃÂÃÂÃÂ¬ *" C={C}>
              <select value={depRequest.target_dept_id} onChange={e => setDepRequest({ ...depRequest, target_dept_id: e.target.value })} style={getInp(C)}>
                <option value="">Ã¢ÂÂ ÃÂÃÂÃÂ±ÃÂÃÂ°ÃÂÃÂ ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ» Ã¢ÂÂ</option>
                {(() => {
                  // BUG-2 fix: ÃÂµÃÂÃÂ»ÃÂ¸ ÃÂ² ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂµ ÃÂ¼ÃÂ°ÃÂ»ÃÂ¾ ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂ¾ÃÂ² (ÃÂ¸ÃÂ»ÃÂ¸ ÃÂÃÂ¾ÃÂ²ÃÂ¿ÃÂ°ÃÂ´ÃÂ°ÃÂµÃÂ ÃÂ ÃÂ¼ÃÂ¾ÃÂ¸ÃÂ¼), ÃÂ¿ÃÂ°ÃÂ´ÃÂ°ÃÂµÃÂ¼ ÃÂ½ÃÂ° ÃÂ²ÃÂÃÂµ ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂ.
                  const projectDeptIds: number[] = (activeProject?.depts || []).filter((d:number) => String(d) !== String(currentUserData?.dept_id));
                  const fallback: number[] = depts.map((d:any) => Number(d.id)).filter((id:number) => String(id) !== String(currentUserData?.dept_id));
                  const list: number[] = projectDeptIds.length > 0 ? projectDeptIds : fallback;
                  return list.map((dId: number) => <option key={dId} value={dId}>{getDeptNameById(dId)}</option>);
                })()}
              </select>
            </Field>
            <Field label="ÃÂ§ÃÂ¢ÃÂ ÃÂÃÂ£ÃÂÃÂÃÂ ÃÂÃÂÃÂÃÂ£ÃÂ§ÃÂÃÂ¢ÃÂ¬ *" C={C}>
              <textarea value={depRequest.what_needed} onChange={e => setDepRequest({ ...depRequest, what_needed: e.target.value })} placeholder="ÃÂÃÂ°ÃÂ¿ÃÂÃÂ¸ÃÂ¼ÃÂµÃÂ: ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂºÃÂ¸ ÃÂ½ÃÂ° ÃÂÃÂÃÂ½ÃÂ´ÃÂ°ÃÂ¼ÃÂµÃÂ½ÃÂ ÃÂ¿ÃÂ¾ ÃÂ¾ÃÂÃÂÃÂ¼ 1-5, ÃÂÃÂ¾ÃÂ³ÃÂ»ÃÂ°ÃÂÃÂ¾ÃÂ²ÃÂ°ÃÂ½ÃÂ½ÃÂÃÂ¹ ÃÂ¿ÃÂ»ÃÂ°ÃÂ½..." style={{ ...getInp(C), minHeight: 80, fontFamily: "inherit", resize: "vertical" }} />
            </Field>
            <Field label="ÃÂÃÂÃÂÃÂÃÂÃÂÃÂ«ÃÂ ÃÂ¡ÃÂ ÃÂÃÂ (ÃÂ½ÃÂµÃÂ¾ÃÂ±ÃÂÃÂ·ÃÂ°ÃÂÃÂµÃÂ»ÃÂÃÂ½ÃÂ¾)" C={C}><RuDateInput value={depRequest.deadline_hint} onChange={v => setDepRequest({ ...depRequest, deadline_hint: v })} C={C} /></Field>
            <button className="btn btn-primary" onClick={requestDependencyData} disabled={saving || !depRequest.target_dept_id || depRequest.what_needed.trim().length < 5} style={{ width: "100%", opacity: (!depRequest.target_dept_id || depRequest.what_needed.trim().length < 5) ? 0.5 : 1 }}>{saving ? "ÃÂÃÂÃÂ¿ÃÂÃÂ°ÃÂ²ÃÂºÃÂ°..." : "Ã°ÂÂÂ ÃÂÃÂÃÂ¿ÃÂÃÂ°ÃÂ²ÃÂ¸ÃÂÃÂ ÃÂ·ÃÂ°ÃÂ¿ÃÂÃÂ¾ÃÂ"}</button>
          </div>
        </Modal>
      )}
      {showTaskDetail && selectedTask && (
        <Modal title="ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ°" onClose={() => { setShowTaskDetail(false); setSelectedTask(null); setTaskComment(""); setWorkflowBlockInfo(""); setChatInput(""); loadMessages(activeProject.id); }} C={C}>
          <div className="form-stack">
            <div style={{ background: C.surface2, borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: C.text }}>{selectedTask.name}</div>
                <div title={`ÃÂ ÃÂµÃÂ²ÃÂ¸ÃÂ·ÃÂ¸ÃÂ ${selectedTask.revision_num || 0}`} style={{ background: C.accent + '20', color: C.accent, fontWeight: 700, fontSize: 12, padding: '3px 8px', borderRadius: 6, cursor: 'help' }}>R{selectedTask.revision_num || 0}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                <BadgeComp status={selectedTask.status} C={C} />
                <PriorityDot p={selectedTask.priority} C={C} />
                {selectedTask.dept && <span style={{ fontSize: 11, color: C.textMuted, background: C.surface, padding: "3px 8px", borderRadius: 6 }}>{selectedTask.dept}</span>}
                {selectedTask.drawing_id && (() => {
                  const d = drawings.find(dr => String(dr.id) === String(selectedTask.drawing_id));
                  return d ? <span style={{ fontSize: 11, color: C.textMuted, background: C.surface, padding: "3px 8px", borderRadius: 6 }}>Ã°ÂÂÂ {d.code}</span> : null;
                })()}
                {selectedTask.deadline && <span style={{ fontSize: 11, color: (() => { const dl = parseDeadline(selectedTask.deadline); return dl && dl < new Date() ? C.red : C.textMuted; })() }}>ÃÂ´ÃÂ¾ {formatDateRu(selectedTask.deadline)}</span>}
              </div>
            </div>
            {selectedTask.parent_task_id && (
              <div style={{ fontSize: 11, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                Ã°ÂÂÂ ÃÂÃÂÃÂµÃÂ´ÃÂÃÂ´ÃÂÃÂÃÂ°ÃÂ ÃÂÃÂµÃÂ²ÃÂ¸ÃÂ·ÃÂ¸ÃÂ: <span style={{ color: C.accent, cursor: 'pointer' }} onClick={() => { const p = allTasks.find(t => t.id === selectedTask.parent_task_id); if (p) setSelectedTask(p); }}>#{String(selectedTask.parent_task_id).slice(0, 4)}</span>
              </div>
            )}
            {(() => {
              if (!selectedTask.assigned_to) return <div style={{ fontSize: 12, color: C.textMuted }}>Ã°ÂÂÂ¤ ÃÂÃÂÃÂ¿ÃÂ¾ÃÂ»ÃÂ½ÃÂ¸ÃÂÃÂµÃÂ»ÃÂ ÃÂ½ÃÂµ ÃÂ½ÃÂ°ÃÂ·ÃÂ½ÃÂ°ÃÂÃÂµÃÂ½</div>;
              const u = getUserById(selectedTask.assigned_to);
              if (u) return (<div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><AvatarComp user={u} size={28} C={C} /><span style={{ color: C.textDim, fontWeight: 500 }}>{u.full_name}</span><span style={{ fontSize: 11, color: C.textMuted }}>{u.position || roleLabels[u.role]}</span></div>);
              return <div style={{ fontSize: 12, color: C.textMuted }}>Ã°ÂÂÂ¤ ÃÂÃÂÃÂ¿ÃÂ¾ÃÂ»ÃÂ½ÃÂ¸ÃÂÃÂµÃÂ»ÃÂ: ID {String(selectedTask.assigned_to).slice(0, 8)}Ã¢ÂÂ¦</div>;
            })()}
            {selectedTask.drawing_id && (() => {
              const d = drawings.find(dr => String(dr.id) === String(selectedTask.drawing_id));
              return d ? (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, fontSize: 12 }}>
                  <div style={{ color: C.textMuted, marginBottom: 4 }}>ÃÂ¡ÃÂ²ÃÂÃÂ·ÃÂ°ÃÂ½ÃÂ½ÃÂÃÂ¹ ÃÂÃÂµÃÂÃÂÃÂµÃÂ¶</div>
                  <div style={{ color: C.text, fontWeight: 600 }}>{d.code} Ã¢ÂÂ {d.title}</div>
                  <div style={{ color: C.textMuted, marginTop: 2 }}>ÃÂ ÃÂµÃÂ²ÃÂ¸ÃÂ·ÃÂ¸ÃÂ: {d.revision || 'R0'} ÃÂ· ÃÂ¡ÃÂÃÂ°ÃÂÃÂÃÂ: {d.status || 'draft'}</div>
                </div>
              ) : null;
            })()}
            {selectedTask.description && (<div style={{ background: C.surface2, borderRadius: 10, padding: 14 }}><div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>ÃÂÃÂ¿ÃÂ¸ÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂµ</div><div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6 }}>{selectedTask.description}</div></div>)}
            {selectedTask.comment && (<div style={{ background: C.red + "10", border: `1px solid ${C.red}25`, borderRadius: 10, padding: 14 }}><div style={{ fontSize: 10, color: C.red, fontWeight: 600, marginBottom: 4 }}>ÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂ ÃÂÃÂ ÃÂ ÃÂÃÂÃÂ ÃÂÃÂÃÂÃÂ¢ÃÂÃÂ</div><div style={{ fontSize: 13, color: C.textDim }}>{selectedTask.comment}</div></div>)}
            {workflowBlockInfo && (
              <div style={{ background: C.red + "12", border: `1px solid ${C.red}30`, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginBottom: 4 }}>ÃÂÃÂÃÂÃÂÃÂÃÂ ÃÂÃÂÃÂÃÂ WORKFLOW</div>
                <div style={{ fontSize: 12, color: C.textDim }}>{workflowBlockInfo}</div>
              </div>
            )}
            {isLead && selectedTask.status === "todo" && String(selectedTask.assigned_to) === String(currentUserData?.id) && (
              <Field label="ÃÂÃÂÃÂÃÂÃÂÃÂ§ÃÂÃÂ¢ÃÂ¬ ÃÂÃÂÃÂÃÂÃÂÃÂÃÂ ÃÂ£" C={C}><select onChange={e => { if (e.target.value) assignTask(selectedTask.id, e.target.value); }} defaultValue="" style={getInp(C)}><option value="">Ã¢ÂÂ ÃÂÃÂÃÂ±ÃÂÃÂ°ÃÂÃÂ ÃÂ¸ÃÂ½ÃÂ¶ÃÂµÃÂ½ÃÂµÃÂÃÂ° Ã¢ÂÂ</option>{myEngineers.map(u => <option key={u.id} value={u.id}>{u.full_name} Ã¢ÂÂ {getEngLoad(u.id)}% ÃÂ·ÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂºÃÂ°</option>)}</select></Field>
            )}
            {isLead && (<Field label="ÃÂÃÂ ÃÂÃÂÃÂ ÃÂÃÂ¢ÃÂÃÂ¢" C={C}><select value={selectedTask.priority} onChange={async e => { await patch(`tasks?id=eq.${selectedTask.id}`, { priority: e.target.value }, token!); setSelectedTask({ ...selectedTask, priority: e.target.value }); if (activeProject) loadTasks(activeProject.id); }} style={getInp(C)}><option value="high">Ã°ÂÂÂ´ ÃÂÃÂÃÂÃÂ¾ÃÂºÃÂ¸ÃÂ¹</option><option value="medium">Ã°ÂÂÂ¡ ÃÂ¡ÃÂÃÂµÃÂ´ÃÂ½ÃÂ¸ÃÂ¹</option><option value="low">Ã¢ÂÂª ÃÂÃÂ¸ÃÂ·ÃÂºÃÂ¸ÃÂ¹</option></select></Field>)}
            {(isLead || isGip) && (
              <Field label="ÃÂ¡ÃÂÃÂ¯ÃÂÃÂÃÂÃÂÃÂ«ÃÂ ÃÂ§ÃÂÃÂ ÃÂ¢ÃÂÃÂ" C={C}>
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
                  <option value="">Ã¢ÂÂ ÃÂÃÂµÃÂ· ÃÂ¿ÃÂÃÂ¸ÃÂ²ÃÂÃÂ·ÃÂºÃÂ¸ Ã¢ÂÂ</option>
                  {drawings.map((d) => <option key={d.id} value={d.id}>{d.code} Ã¢ÂÂ {d.title}</option>)}
                </select>
              </Field>
            )}
            {isGip && (
              <Field label="ÃÂ¡ÃÂ¢ÃÂÃÂ¢ÃÂ£ÃÂ¡ ÃÂÃÂÃÂÃÂÃÂ§ÃÂ (ÃÂÃÂÃÂ)" C={C}>
                <select value={selectedTask.status} onChange={async e => {
                  const newStatus = e.target.value;
                  await patch(`tasks?id=eq.${selectedTask.id}`, { status: newStatus }, token!);
                  setSelectedTask({ ...selectedTask, status: newStatus });
                  if (activeProject) loadTasks(activeProject.id);
                  addNotification(`ÃÂ¡ÃÂÃÂ°ÃÂÃÂÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸ Ã¢ÂÂ "${statusMap[newStatus]?.label || newStatus}"`, 'info');
                }} style={getInp(C)}>
                  <option value="todo">ÃÂ ÃÂ¾ÃÂÃÂµÃÂÃÂµÃÂ´ÃÂ¸</option>
                  <option value="inprogress">ÃÂ ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂµ</option>
                  <option value="awaiting_input">ÃÂÃÂ´ÃÂÃÂ ÃÂ´ÃÂ°ÃÂ½ÃÂ½ÃÂÃÂ</option>
                  <option value="review_lead">ÃÂÃÂ° ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂµ</option>
                  <option value="review_gip">ÃÂÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂ° ÃÂÃÂÃÂÃÂ°</option>
                  <option value="revision">ÃÂÃÂ¾ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂºÃÂ°</option>
                  <option value="done">ÃÂÃÂ°ÃÂ²ÃÂµÃÂÃÂÃÂµÃÂ½ÃÂ°</option>
                </select>
              </Field>
            )}
            {/* CONV Stage 4b: ÃÂ·ÃÂ°ÃÂ¿ÃÂÃÂ¾ÃÂÃÂ¸ÃÂÃÂ ÃÂ´ÃÂ°ÃÂ½ÃÂ½ÃÂÃÂµ ÃÂ ÃÂÃÂ¼ÃÂµÃÂ¶ÃÂ½ÃÂ¾ÃÂ³ÃÂ¾ ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂ° (ÃÂ¿ÃÂ¾ ÃÂÃÂÃÂµÃÂ±ÃÂ¾ÃÂ²ÃÂ°ÃÂ½ÃÂ¸ÃÂ) */}
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
                Ã°ÂÂÂ ÃÂÃÂ°ÃÂ¿ÃÂÃÂ¾ÃÂÃÂ¸ÃÂÃÂ ÃÂ´ÃÂ°ÃÂ½ÃÂ½ÃÂÃÂµ ÃÂ ÃÂÃÂ¼ÃÂµÃÂ¶ÃÂ½ÃÂ¾ÃÂ³ÃÂ¾ ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂ°
              </button>
            )}
            {getTaskActions(selectedTask).length > 0 && (
              <div>
                <div className="field-label" style={{ marginBottom: 8 }}>ÃÂÃÂÃÂÃÂ¡ÃÂ¢ÃÂÃÂÃÂ¯</div>
                {(selectedTask.status === "review_lead" || selectedTask.status === "review_gip") && (<div style={{ marginBottom: 10 }}><div className="field-label" style={{ marginBottom: 6 }}>ÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂ ÃÂÃÂ ÃÂÃÂ ÃÂ ÃÂÃÂÃÂ ÃÂÃÂÃÂÃÂ¢ÃÂÃÂ</div><input value={taskComment} onChange={e => setTaskComment(e.target.value)} placeholder="ÃÂ§ÃÂÃÂ¾ ÃÂ½ÃÂÃÂ¶ÃÂ½ÃÂ¾ ÃÂ¸ÃÂÃÂ¿ÃÂÃÂ°ÃÂ²ÃÂ¸ÃÂÃÂ..." style={getInp(C)} /></div>)}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {getTaskActions(selectedTask).map((action: any, i: number) => {
                    // CONV-Q5: ÃÂµÃÂÃÂ»ÃÂ¸ ÃÂÃÂÃÂµÃÂ±ÃÂÃÂµÃÂÃÂÃÂ ÃÂ¿ÃÂÃÂ¸ÃÂÃÂ¸ÃÂ½ÃÂ° (revision) Ã¢ÂÂ ÃÂºÃÂ½ÃÂ¾ÃÂ¿ÃÂºÃÂ° disabled ÃÂ¿ÃÂ¾ÃÂºÃÂ° comment ÃÂ¿ÃÂÃÂÃÂÃÂ¾ÃÂ¹
                    const needsReason = action.requiresReason && (!taskComment || taskComment.trim().length < 5);
                    return (
                    <button key={i} onClick={() => {
                      if (action.requiresReason && (!taskComment || taskComment.trim().length < 5)) {
                        alert("ÃÂ£ÃÂºÃÂ°ÃÂ¶ÃÂ¸ÃÂÃÂµ ÃÂ¿ÃÂÃÂ¸ÃÂÃÂ¸ÃÂ½ÃÂ ÃÂ²ÃÂ¾ÃÂ·ÃÂ²ÃÂÃÂ°ÃÂÃÂ° ÃÂ½ÃÂ° ÃÂ´ÃÂ¾ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂºÃÂ (ÃÂ¼ÃÂ¸ÃÂ½ÃÂ¸ÃÂ¼ÃÂÃÂ¼ 5 ÃÂÃÂ¸ÃÂ¼ÃÂ²ÃÂ¾ÃÂ»ÃÂ¾ÃÂ²)");
                        return;
                      }
                      updateTaskStatus(selectedTask.id, action.status, taskComment);
                    }} disabled={saving || needsReason}
                      title={needsReason ? "ÃÂ¡ÃÂ½ÃÂ°ÃÂÃÂ°ÃÂ»ÃÂ° ÃÂÃÂºÃÂ°ÃÂ¶ÃÂ¸ÃÂÃÂµ ÃÂ¿ÃÂÃÂ¸ÃÂÃÂ¸ÃÂ½ÃÂ ÃÂ² ÃÂ¿ÃÂ¾ÃÂ»ÃÂµ ÃÂ«ÃÂÃÂ¾ÃÂ¼ÃÂ¼ÃÂµÃÂ½ÃÂÃÂ°ÃÂÃÂ¸ÃÂ¹ ÃÂ¿ÃÂÃÂ¸ ÃÂ´ÃÂ¾ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂºÃÂµÃÂ» ÃÂ²ÃÂÃÂÃÂµ" : ""}
                      style={{ background: action.color + "15", border: `1px solid ${action.color}30`, color: action.color, borderRadius: 10, padding: "11px", cursor: needsReason ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", opacity: needsReason ? 0.5 : 1 }}>{action.label}</button>
                    );
                  })}
                  {getTaskActions(selectedTask).length > 0 && (
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      {getTaskActions(selectedTask).every((a: any) => isTransitionAllowed(selectedTask, a.status))
                        ? 'Ã¢ÂÂ ÃÂÃÂÃÂµ ÃÂ´ÃÂ¾ÃÂÃÂÃÂÃÂ¿ÃÂ½ÃÂÃÂµ ÃÂºÃÂ½ÃÂ¾ÃÂ¿ÃÂºÃÂ¸ ÃÂÃÂ¾ÃÂ¾ÃÂÃÂ²ÃÂµÃÂÃÂÃÂÃÂ²ÃÂÃÂÃÂ workflow.'
                        : 'Ã¢ÂÂ  ÃÂÃÂÃÂÃÂ ÃÂ´ÃÂµÃÂ¹ÃÂÃÂÃÂ²ÃÂ¸ÃÂ ÃÂ²ÃÂ½ÃÂµ workflow. ÃÂÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂÃÂÃÂµ ÃÂ¿ÃÂµÃÂÃÂµÃÂÃÂ¾ÃÂ´ÃÂ.'}
                    </div>
                  )}
                  {isGip && selectedTask.status === "done" && (
                    <button onClick={() => issueRevision(selectedTask)} disabled={saving}
                      style={{ background: C.accent + "15", border: `1px dashed ${C.accent}`, color: C.accent, borderRadius: 10, padding: "11px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", marginTop: 8 }}>Ã¢ÂÂ¡ ÃÂÃÂÃÂ¿ÃÂÃÂÃÂÃÂ¸ÃÂÃÂ ÃÂ½ÃÂ¾ÃÂ²ÃÂÃÂ ÃÂÃÂµÃÂ²ÃÂ¸ÃÂ·ÃÂ¸ÃÂ (R{(selectedTask.revision_num || 0) + 1})</button>
                  )}
                </div>
              </div>
            )}
            
            {/* T30e: ÃÂ¿ÃÂÃÂ¸ÃÂºÃÂÃÂµÃÂ¿ÃÂ»ÃÂµÃÂ½ÃÂ¸ÃÂ ÃÂº ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂµ */}
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
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>ÃÂÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ ÃÂ¸ ÃÂ¾ÃÂ±ÃÂÃÂÃÂ¶ÃÂ´ÃÂµÃÂ½ÃÂ¸ÃÂµ</div>
              <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', height: 250 }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {msgs.filter(m => String(m.task_id) === String(selectedTask.id)).length === 0 && <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 12, marginTop: 40 }}>ÃÂÃÂ¾ÃÂºÃÂ° ÃÂ½ÃÂµÃÂ ÃÂ·ÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ¹</div>}
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
                  <input value={taskComment} onChange={e => setTaskComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && taskComment.trim()) { sendTaskComment(selectedTask.id, taskComment); setTaskComment(''); } }} placeholder="ÃÂÃÂ°ÃÂ¿ÃÂ¸ÃÂÃÂ°ÃÂÃÂ ÃÂ·ÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂµ..." style={{ ...getInp(C), borderRadius: 8, height: 36, fontSize: 12 }} />
                  <button onClick={() => { if (taskComment.trim()) { sendTaskComment(selectedTask.id, taskComment); setTaskComment(''); } }} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer' }}>Ã¢ÂÂ</button>
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
                  Ã°ÂÂÂ {showTaskHistory ? 'ÃÂ¡ÃÂºÃÂÃÂÃÂÃÂ ÃÂ¸ÃÂÃÂÃÂ¾ÃÂÃÂ¸ÃÂ' : 'ÃÂÃÂÃÂÃÂ¾ÃÂÃÂ¸ÃÂ ÃÂ¸ÃÂ·ÃÂ¼ÃÂµÃÂ½ÃÂµÃÂ½ÃÂ¸ÃÂ¹'}
                </button>
                {showTaskHistory && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {taskHistory.length === 0
                      ? <div style={{ fontSize: 12, color: C.textMuted, padding: '6px 0' }}>ÃÂÃÂ·ÃÂ¼ÃÂµÃÂ½ÃÂµÃÂ½ÃÂ¸ÃÂ¹ ÃÂ¿ÃÂ¾ÃÂºÃÂ° ÃÂ½ÃÂµÃÂ</div>
                      : taskHistory.map(h => {
                          const FIELD_LABELS: Record<string, string> = { status: 'ÃÂ¡ÃÂÃÂ°ÃÂÃÂÃÂ', priority: 'ÃÂÃÂÃÂ¸ÃÂ¾ÃÂÃÂ¸ÃÂÃÂµÃÂ', assigned_to: 'ÃÂÃÂÃÂ¿ÃÂ¾ÃÂ»ÃÂ½ÃÂ¸ÃÂÃÂµÃÂ»ÃÂ', deadline: 'ÃÂÃÂµÃÂ´ÃÂ»ÃÂ°ÃÂ¹ÃÂ½', comment: 'ÃÂÃÂ¾ÃÂ¼ÃÂ¼ÃÂµÃÂ½ÃÂÃÂ°ÃÂÃÂ¸ÃÂ¹' };
                          const STATUS_RU: Record<string, string> = { todo: 'ÃÂ ÃÂ¾ÃÂÃÂµÃÂÃÂµÃÂ´ÃÂ¸', inprogress: 'ÃÂ ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂµ', awaiting_input: 'ÃÂÃÂ´ÃÂÃÂ ÃÂ´ÃÂ°ÃÂ½ÃÂ½ÃÂÃÂ', review_lead: 'ÃÂÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂ°', review_gip: 'ÃÂÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂ° ÃÂÃÂÃÂÃÂ°', revision: 'ÃÂÃÂ¾ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂºÃÂ°', done: 'ÃÂÃÂ¾ÃÂÃÂ¾ÃÂ²ÃÂ¾' };
                          const STATUS_EMOJI: Record<string, string> = { todo: 'Ã¢ÂÂ³', inprogress: 'Ã¢ÂÂ¶', awaiting_input: 'Ã°ÂÂÂ', review_lead: 'Ã°ÂÂÂ', review_gip: 'Ã°ÂÂÂ', revision: 'Ã¢ÂÂ©', done: 'Ã¢ÂÂ' };
                          const fmt = (v: string, field: string) => {
                            if (field === 'status') return `${STATUS_EMOJI[v]||''} ${STATUS_RU[v] || v}`.trim();
                            if (field === 'assigned_to') return getUserById(Number(v))?.full_name || `#${v}`;
                            return v || 'Ã¢ÂÂ';
                          };
                          const actor = h.changed_by ? (getUserById(Number(h.changed_by))?.full_name || `#${h.changed_by}`) : '';
                          const isRevisionReturn = h.field_name === 'status' && h.new_value === 'revision';
                          return (
                            <div key={h.id} style={{ fontSize: 12, color: C.textMuted, padding: '6px 0', borderBottom: `1px solid ${C.border}`, background: isRevisionReturn ? 'rgba(239,68,68,.05)' : 'transparent', borderLeft: isRevisionReturn ? '2px solid rgba(239,68,68,.4)' : 'none', paddingLeft: isRevisionReturn ? 8 : 0 }}>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ color: C.textMuted, minWidth: 110, fontSize: 11 }}>{new Date(h.changed_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                {actor && <span style={{ color: C.textMuted, fontSize: 11 }}>{actor}</span>}
                                <span style={{ color: C.text }}><b>{FIELD_LABELS[h.field_name] || h.field_name}</b>: <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{fmt(h.old_value, h.field_name)}</span> Ã¢ÂÂ <span style={{ color: isRevisionReturn ? '#ef4444' : C.accent }}>{fmt(h.new_value, h.field_name)}</span></span>
                              </div>
                              {isRevisionReturn && h.payload && typeof h.payload === 'object' && h.payload.comment && (
                                <div style={{ marginTop: 4, marginLeft: 118, fontSize: 11.5, color: C.textDim, fontStyle: 'italic' }}>
                                  Ã°ÂÂÂ¬ ÃÂ«{h.payload.comment}ÃÂ»
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
              <div style={{ background: C.accent, color: '#fff', width: 50, height: 50, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, animation: 'pulse 1.5s infinite' }}>Ã°ÂÂÂ</div>
              <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>ÃÂÃÂÃÂ¾ÃÂ´ÃÂÃÂÃÂ¸ÃÂ¹ ÃÂ²ÃÂÃÂ·ÃÂ¾ÃÂ²</div>
                  <div style={{ fontSize: 13, color: C.textDim }}>{incomingCall.initiator_name} ÃÂ¿ÃÂÃÂ¸ÃÂ³ÃÂ»ÃÂ°ÃÂÃÂ°ÃÂµÃÂ ÃÂ²ÃÂ°ÃÂ ÃÂ² ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂ "{incomingCall.project_name}"</div>
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
                  }}>ÃÂÃÂÃÂºÃÂÃÂÃÂÃÂ ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂµ</button>
                  <button className="btn btn-ghost" onClick={() => setIncomingCall(null)}>ÃÂÃÂ¾ÃÂ·ÃÂ¶ÃÂµ</button>
              </div>
          </div>
      )}

      {showArchive && (
        <Modal title="Ã°ÂÂÂ¦ ÃÂÃÂÃÂÃÂ¸ÃÂ² ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ¾ÃÂ²" onClose={() => setShowArchive(false)} C={C}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {archivedProjects.length === 0 ? <div className="empty-state-cta" style={{ textAlign: 'center', padding: '40px 20px', background: C.surface, border: `1.5px dashed ${C.border}`, borderRadius: 12 }}><div style={{ fontSize: 32, marginBottom: 8 }}>Ã°ÂÂÂ¦</div><div style={{ fontSize: 14, color: C.text }}>ÃÂÃÂÃÂÃÂ¸ÃÂ² ÃÂ¿ÃÂÃÂÃÂ</div></div> : archivedProjects.map(p => (
              <div key={p.id} style={{ background: C.surface2, borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontWeight: 600, color: C.text }}>{p.name}</div><div style={{ fontSize: 11, color: C.textMuted }}>{p.code} ÃÂ· ÃÂ´ÃÂ¾ {p.deadline}</div></div>
                <span style={{ fontSize: 11, color: C.textMuted }}>ÃÂ ÃÂ°ÃÂÃÂÃÂ¸ÃÂ²ÃÂµ</span>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {archiveConfirm && (
        <div className="delete-overlay">
          <div className="delete-box">
            <div style={{ fontSize: 40, marginBottom: 16 }}>Ã°ÂÂÂ¦</div>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8, color: C.orange }}>
              {archiveStep === 0 ? "ÃÂÃÂÃÂ¿ÃÂÃÂ°ÃÂ²ÃÂ¸ÃÂÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂ ÃÂ² ÃÂ°ÃÂÃÂÃÂ¸ÃÂ²?" : "ÃÂÃÂ ÃÂÃÂ²ÃÂµÃÂÃÂµÃÂ½ÃÂ?"}
            </div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 24 }}>
              {archiveStep === 0
                ? `ÃÂÃÂÃÂ¾ÃÂµÃÂºÃÂ "${archiveConfirm.name}" ÃÂ±ÃÂÃÂ´ÃÂµÃÂ ÃÂÃÂºÃÂÃÂÃÂ ÃÂ¸ÃÂ· ÃÂ°ÃÂºÃÂÃÂ¸ÃÂ²ÃÂ½ÃÂÃÂ.`
                : "ÃÂÃÂ¾ÃÂÃÂ»ÃÂµ ÃÂ°ÃÂÃÂÃÂ¸ÃÂ²ÃÂ°ÃÂÃÂ¸ÃÂ¸ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂ ÃÂ±ÃÂÃÂ´ÃÂµÃÂ ÃÂ´ÃÂ¾ÃÂÃÂÃÂÃÂ¿ÃÂµÃÂ½ ÃÂÃÂ¾ÃÂ»ÃÂÃÂºÃÂ¾ ÃÂ² ÃÂÃÂ°ÃÂ·ÃÂ´ÃÂµÃÂ»ÃÂµ ÃÂ«ÃÂÃÂÃÂÃÂ¸ÃÂ²ÃÂ»."}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn btn-secondary" onClick={() => { setArchiveConfirm(null); setArchiveStep(0); }}>ÃÂÃÂÃÂ¼ÃÂµÃÂ½ÃÂ°</button>
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
                {archiveStep === 0 ? "ÃÂÃÂÃÂ¾ÃÂ´ÃÂ¾ÃÂ»ÃÂ¶ÃÂ¸ÃÂÃÂ Ã¢ÂÂ" : "ÃÂÃÂÃÂ¿ÃÂÃÂ°ÃÂ²ÃÂ¸ÃÂÃÂ ÃÂ² ÃÂ°ÃÂÃÂÃÂ¸ÃÂ²"}
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
          const deptCode = activeDept ? (activeDept.name.match(/^([ÃÂ-ÃÂ¯A-Z]{2,3})/)?.[1] || activeDept.name.slice(0,2).toUpperCase()) : null;
          const deptColorMap: Record<string, string> = { 'ÃÂÃÂ': '#a855f7', 'ÃÂÃÂ¡': '#2b5bb5', 'ÃÂÃÂ': '#4f7fd8', 'ÃÂÃÂ': '#2f9e62', 'ÃÂÃÂ': '#ef4444', 'ÃÂ¡ÃÂ': '#d08a38', 'ÃÂ¢ÃÂ¥': '#0ea5e9', 'ÃÂ­ÃÂ¡': '#facc15' };
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
          <div className="sidebar-section-label">ÃÂÃÂ°ÃÂ²ÃÂ¸ÃÂ³ÃÂ°ÃÂÃÂ¸ÃÂ</div>
          {navItems.map(n => (
            <button key={n.id} className={`sidebar-btn ${screen === n.id ? "active" : ""}`} onClick={() => setScreen(n.id)}>
              <span className="sidebar-btn-icon">
                {NavIcon[n.id] ? React.createElement(NavIcon[n.id], { s: 16, c: 'currentColor' }) : n.icon}
              </span>
              <span>{n.label}</span>
            </button>
          ))}
        </div>

        {/* ÃÂÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ ÃÂ² ÃÂÃÂ°ÃÂ¹ÃÂ´ÃÂ±ÃÂ°ÃÂÃÂµ (Figma-style) */}
        {projects.length > 0 && (
          <div style={{ padding: "0 12px", marginBottom: 16 }}>
            <div className="sidebar-section-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>ÃÂÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ</span>
              <span style={{ color: C.accent, fontSize: 11, cursor: "pointer" }}>ÃÂÃÂÃÂµ Ã¢ÂÂ</span>
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
                      <div className="sidebar-project-progress" style={{ fontSize: 10 }}>{p.code} Ã¢ÂÂ¢ {progress}%</div>
                    </div>
                  </button>
                  {isActive && p.depts && p.depts.length > 0 && (
                    <div className="sidebar-project-depts" style={{ paddingLeft: 24, marginTop: -4, marginBottom: 8 }}>
                      <button className={`sidebar-dept-item ${selectedDeptId === null ? "active" : ""}`} onClick={() => { setSelectedDeptId(null); setScreen("project"); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 13, background: selectedDeptId === null ? C.surface2 : 'transparent', color: selectedDeptId === null ? C.text : C.textMuted, border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                        ÃÂÃÂÃÂ¡ÃÂ¬ ÃÂÃÂ ÃÂÃÂÃÂÃÂ¢
                      </button>
                      {p.depts.map((dId: number) => {
                        const dept = depts.find(d => String(d.id) === String(dId));
                        if (!dept) return null;
                        const isDeptActive = selectedDeptId === dId;
                        return (
                          <button key={dId} className={`sidebar-dept-item ${isDeptActive ? "active" : ""}`} onClick={() => { setSelectedDeptId(dId); setScreen("project"); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 13, background: isDeptActive ? C.surface2 : 'transparent', color: isDeptActive ? C.text : C.textMuted, border: 'none', borderRadius: 6, cursor: 'pointer', marginTop: 2 }}>
                            Ã¢ÂÂ³ {dept.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {isGip && <button className="sidebar-btn" onClick={() => { setNewProject({ name: "", code: "", deadline: "", status: "active", depts: [] }); setShowNewProject(true); }} style={{ color: C.accent, marginTop: 4 }}>
              <span className="sidebar-btn-icon">+</span><span>ÃÂÃÂ¾ÃÂ²ÃÂÃÂ¹ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂ</span>
            </button>}
          </div>
        )}

        <div style={{ padding: "0 12px" }}>
          <div className="sidebar-section-label">ÃÂ¡ÃÂ¸ÃÂÃÂÃÂµÃÂ¼ÃÂ°</div>
          <button className="sidebar-btn" onClick={() => { loadArchived(); setShowArchive(true); }}>
            <span className="sidebar-btn-icon">Ã°ÂÂÂ¦</span><span>ÃÂÃÂÃÂÃÂ¸ÃÂ²</span>
          </button>
        </div>

        <div className="sidebar-bottom">
          <div style={{ padding: "10px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 5, flexShrink: 0 }}>
            <button className="sidebar-btn" style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.04)", color: "#8896a8", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>
              Ã¢ÂÂ ÃÂÃÂ°ÃÂÃÂÃÂÃÂ¾ÃÂ¹ÃÂºÃÂ¸
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px" }}>
            <AvatarComp user={currentUserData} size={34} C={C} />
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={currentUserData?.full_name}>{currentUserData?.full_name?.split(" ").slice(0, 2).join(" ")}</div>
              <div style={{ fontSize: 10, color: C.sidebarText }}>{currentUserData?.position || roleLabels[currentUserData?.role] || ""}</div>
            </div>
            <button onClick={handleLogout} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, padding: 4 }} title="ÃÂÃÂÃÂ¹ÃÂÃÂ¸">Ã¢ÂÂ»</button>
          </div>
        </div>
      </div>

      {/* ===== MAIN AREA ===== */}
      <div className="main-area">
        {/* TOPBAR (Figma-style breadcrumbs) */}
        <div className="topbar">
          <div className="topbar-left">
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="topbar-title">{screen === "project" ? "ÃÂÃÂ°ÃÂÃÂÃÂ¾ÃÂÃÂºÃÂ° ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ°" : screenTitles[screen] || "EngHub"}</span>
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
                      Ã°ÂÂÂ¼ ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂ¸ÃÂÃÂ ÃÂÃÂ¾ÃÂÃÂ¾
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
                          addNotification('ÃÂ¤ÃÂ¾ÃÂÃÂ¾ ÃÂ¿ÃÂÃÂ¾ÃÂÃÂ¸ÃÂ»ÃÂ ÃÂ¾ÃÂ±ÃÂ½ÃÂ¾ÃÂ²ÃÂ»ÃÂµÃÂ½ÃÂ¾', 'success');
                        } catch {
                          addNotification('ÃÂÃÂÃÂ¸ÃÂ±ÃÂºÃÂ° ÃÂ·ÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂºÃÂ¸ ÃÂÃÂ¾ÃÂÃÂ¾', 'warning');
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
                          Ã°ÂÂÂ± {currentUserData?.telegram_id ? `Telegram: ÃÂ¿ÃÂÃÂ¸ÃÂ²ÃÂÃÂ·ÃÂ°ÃÂ½` : 'ÃÂÃÂÃÂ¸ÃÂ²ÃÂÃÂ·ÃÂ°ÃÂÃÂ Telegram'}
                        </button>
                      ) : (
                        <div style={{ padding: '10px 14px' }}>
                          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>
                            ÃÂÃÂ°ÃÂ¿ÃÂ¸ÃÂÃÂ¸ÃÂÃÂµ ÃÂ±ÃÂ¾ÃÂÃÂ <b>@cer_institut_ai_bot</b> ÃÂºÃÂ¾ÃÂ¼ÃÂ°ÃÂ½ÃÂ´ÃÂ <code>/start</code>, ÃÂ¾ÃÂ½ ÃÂ¿ÃÂ¾ÃÂºÃÂ°ÃÂ¶ÃÂµÃÂ ÃÂ²ÃÂ°ÃÂ ID. ÃÂÃÂÃÂÃÂ°ÃÂ²ÃÂÃÂÃÂµ ÃÂµÃÂ³ÃÂ¾ ÃÂ½ÃÂ¸ÃÂ¶ÃÂµ:
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              value={telegramIdInput}
                              onChange={e => setTelegramIdInput(e.target.value.replace(/\D/g, ''))}
                              placeholder="Telegram ID (ÃÂÃÂ¸ÃÂÃÂ»ÃÂ°)"
                              style={{ flex: 1, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 8px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
                            />
                            <button
                              disabled={telegramSaving || !telegramIdInput}
                              onClick={async () => {
                                setTelegramSaving(true);
                                try {
                                  await patch(`app_users?id=eq.${currentUserData.id}`, { telegram_id: Number(telegramIdInput) }, token!);
                                  setCurrentUserData((prev: any) => ({ ...prev, telegram_id: Number(telegramIdInput) }));
                                  addNotification('Telegram ÃÂ¿ÃÂÃÂ¸ÃÂ²ÃÂÃÂ·ÃÂ°ÃÂ½! ÃÂÃÂ°ÃÂ¿ÃÂ¸ÃÂÃÂ¸ÃÂÃÂµ ÃÂ±ÃÂ¾ÃÂÃÂ /start', 'success');
                                  setShowTelegramInput(false);
                                  setTelegramIdInput('');
                                  setShowUserMenu(false);
                                } catch {
                                  addNotification('ÃÂÃÂÃÂ¸ÃÂ±ÃÂºÃÂ° ÃÂ¿ÃÂÃÂ¸ÃÂ²ÃÂÃÂ·ÃÂºÃÂ¸', 'warning');
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
                            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>ÃÂ¢ÃÂµÃÂºÃÂÃÂÃÂ¸ÃÂ¹ ID: {currentUserData.telegram_id}</div>
                          )}
                        </div>
                      )}
                    </div>
                    <button onClick={() => { setShowUserMenu(false); handleLogout(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: `none`, borderTop: `1px solid ${C.border}`, cursor: 'pointer', color: '#ef4444', fontSize: 13, fontWeight: 600 }}>
                      Ã¢ÂÂ» ÃÂÃÂÃÂ¹ÃÂÃÂ¸ ÃÂ¸ÃÂ· ÃÂÃÂ¸ÃÂÃÂÃÂµÃÂ¼ÃÂ
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
                  <div className="page-label">ÃÂ ÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂ¸ÃÂ¹ ÃÂÃÂÃÂ¾ÃÂ»</div>
                  <div className="page-title">ÃÂÃÂ¾ÃÂ±ÃÂÃÂ¾ ÃÂ¿ÃÂ¾ÃÂ¶ÃÂ°ÃÂ»ÃÂ¾ÃÂ²ÃÂ°ÃÂÃÂ, {currentUserData?.full_name?.split(" ")[1] || currentUserData?.full_name?.split(" ")[0]} Ã°ÂÂÂ</div>
                </div>
                {isGip && <button className="btn btn-primary" onClick={() => { setNewProject({ name: "", code: "", deadline: "", status: "active", depts: [] }); setShowNewProject(true); }}>+ ÃÂÃÂ¾ÃÂ²ÃÂÃÂ¹ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂ</button>}
              </div>

              {/* ÃÂÃÂ¾ÃÂ¸ÃÂÃÂº */}
              <div className="search-wrap" style={{ marginBottom: 20 }}>
                <span className="search-icon">Ã°ÂÂÂ</span>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="ÃÂÃÂ¾ÃÂ¸ÃÂÃÂº ÃÂ¿ÃÂ¾ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ°ÃÂ¼ ÃÂ¸ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ°ÃÂ¼..."
                  className="search-input" style={getInp(C, { paddingLeft: 40, borderRadius: 10, background: C.surface })} />
                {searchQuery && <button className="search-clear" onClick={() => setSearchQuery("")}>Ã¢ÂÂ</button>}
              </div>

              {/* DD-15: Role-specific dashboard for Lead */}
              {isLead && currentUserData && (
                <div style={{ marginBottom: 20 }}>
                  <LeadDashboard
                    C={C}
                    currentUser={currentUserData}
                    appUsers={appUsers}
                    /* B4: multi-project ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸ ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂ° (ÃÂµÃÂÃÂ»ÃÂ¸ ÃÂµÃÂÃÂ ÃÂ½ÃÂµ ÃÂ·ÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂ¸ÃÂ»ÃÂ¾ÃÂÃÂ Ã¢ÂÂ fallback ÃÂ½ÃÂ° ÃÂÃÂµÃÂºÃÂÃÂÃÂ¸ÃÂ¹ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂ) */
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
                    /* B4: ÃÂ²ÃÂÃÂµ ÃÂ¼ÃÂ¾ÃÂ¸ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸ ÃÂ¿ÃÂ¾ ÃÂ²ÃÂÃÂµÃÂ¼ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ°ÃÂ¼, ÃÂ½ÃÂµ ÃÂÃÂ¾ÃÂ»ÃÂÃÂºÃÂ¾ activeProject */
                    allTasks={dashboardTasks.length ? dashboardTasks : allTasks}
                    projects={projects}
                    setSelectedTask={setSelectedTask}
                    setShowTaskDetail={setShowTaskDetail}
                    setActiveProject={setActiveProject}
                  />
                </div>
              )}

              {/* Ã¢ÂÂÃ¢ÂÂ KPI ÃÂºÃÂ°ÃÂÃÂÃÂ¾ÃÂÃÂºÃÂ¸ Ã¢ÂÂÃ¢ÂÂ */}
              {/* B1: skeleton ÃÂ¿ÃÂ¾ÃÂºÃÂ° currentUserData ÃÂ½ÃÂµ ÃÂ¿ÃÂÃÂ¸ÃÂÃÂÃÂ» Ã¢ÂÂ ÃÂ¸ÃÂ½ÃÂ°ÃÂÃÂµ KPI ÃÂÃÂµÃÂºÃÂÃÂ½ÃÂ´ÃÂ ÃÂ¿ÃÂ¾ÃÂºÃÂ°ÃÂ·ÃÂÃÂ²ÃÂ°ÃÂÃÂ 0/0/0/0 */}
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
                      { label: "ÃÂÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ¾ÃÂ²", value: projects.length, color: C.accent, onClick: () => {} },
                      { label: "ÃÂÃÂºÃÂÃÂ¸ÃÂ²ÃÂ½ÃÂÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂ", value: allTasks.filter(t => t.status !== "done").length, color: C.blue, onClick: () => setSideTab('tasks') },
                      { label: "ÃÂÃÂ° ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂµ ÃÂÃÂÃÂÃÂ°", value: allTasks.filter(t => t.status === "review_gip").length, color: C.purple, onClick: () => setSideTab('tasks') },
                      { label: "ÃÂÃÂÃÂ¾ÃÂÃÂÃÂ¾ÃÂÃÂµÃÂ½ÃÂ½ÃÂÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ¾ÃÂ²", value: overdueProjects, color: overdueProjects > 0 ? C.red : C.green, onClick: () => {} },
                    ] : isLead ? [
                      { label: "ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂ ÃÂ² ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂµ", value: baseTasks.length, color: C.accent, onClick: () => setSideTab('tasks') },
                      { label: "ÃÂ ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂµ", value: baseTasks.filter(t => t.status === "inprogress").length, color: C.blue, onClick: () => setSideTab('tasks') },
                      { label: "ÃÂÃÂ° ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂµ", value: baseTasks.filter(t => t.status === "review_lead" || t.status === "review_gip").length, color: C.purple, onClick: () => setSideTab('tasks') },
                      { label: "ÃÂÃÂ°ÃÂ²ÃÂµÃÂÃÂÃÂµÃÂ½ÃÂ¾", value: baseTasks.filter(t => t.status === "done").length, color: C.green, onClick: () => setSideTab('tasks') },
                    ] : [
                      { label: "ÃÂÃÂ¾ÃÂ¸ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸", value: baseTasks.length, color: C.accent, onClick: () => setSideTab('tasks') },
                      { label: "ÃÂ ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂµ", value: baseTasks.filter(t => t.status === "inprogress").length, color: C.blue, onClick: () => setSideTab('tasks') },
                      { label: "ÃÂÃÂ° ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂµ", value: baseTasks.filter(t => t.status === "review_lead" || t.status === "review_gip").length, color: C.purple, onClick: () => setSideTab('tasks') },
                      { label: "ÃÂÃÂ°ÃÂ²ÃÂµÃÂÃÂÃÂµÃÂ½ÃÂ¾", value: baseTasks.filter(t => t.status === "done").length, color: C.green, onClick: () => setSideTab('tasks') },
                    ]).map(s => (
                      <div key={s.label} className="stat-card" onClick={s.onClick} style={{ cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 4px 16px ${s.color}30`)}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}>
                        <div className="stat-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                          <span className="stat-card-label" style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{s.label}</span>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: s.color + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                            {(() => { const iconMap: Record<string, any> = { 'ÃÂÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ¾ÃÂ²': IconFolder, 'ÃÂÃÂºÃÂÃÂ¸ÃÂ²ÃÂ½ÃÂÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂ': IconCheckSquare, 'ÃÂÃÂ° ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂµ ÃÂÃÂÃÂÃÂ°': IconActivity, 'ÃÂÃÂÃÂ¾ÃÂÃÂÃÂ¾ÃÂÃÂµÃÂ½ÃÂ½ÃÂÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ¾ÃÂ²': IconArchive, 'ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂ ÃÂ² ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂµ': IconCheckSquare, 'ÃÂ ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂµ': IconActivity, 'ÃÂÃÂ° ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂµ': IconActivity, 'ÃÂÃÂ°ÃÂ²ÃÂµÃÂÃÂÃÂµÃÂ½ÃÂ¾': IconCheckSquare, 'ÃÂÃÂ¾ÃÂ¸ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸': IconCheckSquare }; const Icon = iconMap[s.label]; return Icon ? React.createElement(Icon, { s: 17 }) : null; })()}
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

              {/* ÃÂ ÃÂµÃÂ·ÃÂÃÂ»ÃÂÃÂÃÂ°ÃÂÃÂ ÃÂ¿ÃÂ¾ÃÂ¸ÃÂÃÂºÃÂ° */}
              {searchQuery && (() => {
                const sq = searchQuery.toLowerCase();
                const matchedTasks = tasks.filter(t => t.name.toLowerCase().includes(sq) || (t.dept || "").toLowerCase().includes(sq));
                if (matchedTasks.length > 0) return (
                  <div style={{ marginBottom: 20 }}>
                    <div className="page-label" style={{ marginBottom: 10 }}>ÃÂÃÂ°ÃÂ¹ÃÂ´ÃÂµÃÂ½ÃÂ¾ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂ: {matchedTasks.length}</div>
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

              {/* Ã¢ÂÂÃ¢ÂÂ ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂ ÃÂÃÂÃÂ¯ ÃÂÃÂÃÂÃÂ° / ÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¡ÃÂ¢ÃÂ ÃÂÃÂ¢ÃÂÃÂ ÃÂ Ã¢ÂÂÃ¢ÂÂ */}
              {(isGip || isAdmin) && (
                <div className="analytics-grid-2">
                  {/* ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂºÃÂ° ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂ¾ÃÂ² */}
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                    <div className="page-label" style={{ marginBottom: 14 }}>ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂºÃÂ° ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂ¾ÃÂ²</div>
                    {(() => {
                      const deptLoad: Record<string, { total: number; done: number; review: number }> = {};
                      for (const t of allTasks) {
                        const dn = t.dept || 'ÃÂÃÂµÃÂ· ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂ°';
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
                            <span style={{ color: C.textMuted }}>{d.total} ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂ ÃÂ· {d.done} ÃÂ³ÃÂ¾ÃÂÃÂ¾ÃÂ²ÃÂ¾</span>
                          </div>
                          <div style={{ height: 7, background: C.surface2, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                            <div style={{ height: '100%', width: deptBarsAnimated ? `${(d.done / maxVal) * 100}%` : '0%', background: C.green, transition: 'width 0.9s cubic-bezier(.2,.8,.2,1)' }} />
                            <div style={{ height: '100%', width: deptBarsAnimated ? `${((d.total - d.done) / maxVal) * 100}%` : '0%', background: C.accent + '60', transition: 'width 0.9s cubic-bezier(.2,.8,.2,1)' }} />
                          </div>
                        </div>
                      )) : <div style={{ fontSize: 13, color: C.textMuted }}>ÃÂÃÂµÃÂ ÃÂ´ÃÂ°ÃÂ½ÃÂ½ÃÂÃÂ</div>;
                    })()}
                  </div>

                  {/* ÃÂÃÂµÃÂ´ÃÂ»ÃÂ°ÃÂ¹ÃÂ½ÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ¾ÃÂ² */}
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                    <div className="page-label" style={{ marginBottom: 14 }}>ÃÂÃÂµÃÂ´ÃÂ»ÃÂ°ÃÂ¹ÃÂ½ÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ¾ÃÂ²</div>
                    {[...projects].sort((a, b) => (parseDeadline(a.deadline)?.getTime() ?? 99999999999999) - (parseDeadline(b.deadline)?.getTime() ?? 99999999999999)).map(p => {
                      const now = new Date();
                      const dl = parseDeadline(p.deadline);
                      const daysLeft = dl ? Math.ceil((dl.getTime() - now.getTime()) / 86400000) : null;
                      const isDoneOrArchived = p.status === 'done' || p.archived;
                      const color = daysLeft === null ? C.textMuted : (daysLeft < 0 && !isDoneOrArchived) ? C.red : daysLeft < 30 ? C.red : daysLeft < 90 ? C.orange : C.green;
                      const label = daysLeft === null ? 'Ã¢ÂÂ' : daysLeft < 0 ? `ÃÂÃÂÃÂ¾ÃÂÃÂÃÂ¾ÃÂÃÂµÃÂ½ ${-daysLeft} ÃÂ´.` : daysLeft === 0 ? 'ÃÂ¡ÃÂµÃÂ³ÃÂ¾ÃÂ´ÃÂ½ÃÂ!' : `${daysLeft} ÃÂ´ÃÂ½.`;
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

              {/* ÃÂÃÂÃÂµÃÂÃÂµÃÂ´ÃÂ ÃÂ½ÃÂ° ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂ ÃÂÃÂÃÂÃÂ° */}
              {(isGip || isAdmin) && (() => {
                const reviewTasks = allTasks.filter(t => t.status === 'review_gip');
                if (reviewTasks.length === 0) return null;
                return (
                  <div style={{ background: C.surface, border: `1px solid ${C.purple}30`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div className="page-label" style={{ color: C.purple }}>ÃÂÃÂ¶ÃÂ¸ÃÂ´ÃÂ°ÃÂÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂ¸ ÃÂÃÂÃÂÃÂ°</div>
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
                              <div style={{ fontSize: 11, color: C.textMuted }}>{proj?.code} ÃÂ· {t.dept}</div>
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

              {/* Ã¢ÂÂÃ¢ÂÂ ÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂ ÃÂÃÂÃÂ¯ ÃÂ ÃÂ£ÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂ¯ ÃÂÃÂ¢ÃÂÃÂÃÂÃÂ Ã¢ÂÂÃ¢ÂÂ */}
              {isLead && (() => {
                const myDeptId = currentUserData?.dept_id;
                const myEngineers = appUsers.filter(u => u.dept_id === myDeptId && u.role === 'engineer');
                const myDeptTasks = tasks; // ÃÂÃÂ¶ÃÂµ ÃÂ¾ÃÂÃÂÃÂ¸ÃÂ»ÃÂÃÂÃÂÃÂ¾ÃÂ²ÃÂ°ÃÂ½ÃÂ¾ ÃÂ¿ÃÂ¾ ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂ
                return (
                  <div style={{ marginBottom: 20 }}>
                    {/* ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂºÃÂ° ÃÂ¸ÃÂ½ÃÂ¶ÃÂµÃÂ½ÃÂµÃÂÃÂ¾ÃÂ² */}
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                      <div className="page-label" style={{ marginBottom: 14 }}>ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂºÃÂ° ÃÂ¸ÃÂ½ÃÂ¶ÃÂµÃÂ½ÃÂµÃÂÃÂ¾ÃÂ² ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»ÃÂ°</div>
                      {myEngineers.length === 0 ? (
                        <div style={{ fontSize: 13, color: C.textMuted }}>ÃÂÃÂ½ÃÂ¶ÃÂµÃÂ½ÃÂµÃÂÃÂ ÃÂ½ÃÂµ ÃÂ½ÃÂ°ÃÂ·ÃÂ½ÃÂ°ÃÂÃÂµÃÂ½ÃÂ ÃÂ² ÃÂ¾ÃÂÃÂ´ÃÂµÃÂ»</div>
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
                                <span style={{ color: C.textMuted }}>{total} ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂ ÃÂ· {pct}% ÃÂ³ÃÂ¾ÃÂÃÂ¾ÃÂ²ÃÂ¾</span>
                              </div>
                              <div style={{ height: 7, background: C.surface2, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                                <div title="ÃÂÃÂ°ÃÂ²ÃÂµÃÂÃÂÃÂµÃÂ½ÃÂ¾" style={{ width: `${total > 0 ? (done/total)*100 : 0}%`, background: C.green, height: '100%' }} />
                                <div title="ÃÂÃÂ° ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂµ" style={{ width: `${total > 0 ? (review/total)*100 : 0}%`, background: C.purple, height: '100%' }} />
                                <div title="ÃÂ ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂµ" style={{ width: `${total > 0 ? (inprog/total)*100 : 0}%`, background: C.blue, height: '100%' }} />
                                <div title="ÃÂ ÃÂ¾ÃÂÃÂµÃÂÃÂµÃÂ´ÃÂ¸" style={{ width: `${total > 0 ? (todo/total)*100 : 0}%`, background: C.accent + '50', height: '100%' }} />
                              </div>
                              <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 10, color: C.textMuted }}>
                                {done > 0 && <span style={{ color: C.green }}>Ã¢ÂÂ {done} ÃÂ³ÃÂ¾ÃÂÃÂ¾ÃÂ²ÃÂ¾</span>}
                                {review > 0 && <span style={{ color: C.purple }}>Ã¢ÂÂ {review} ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂ°</span>}
                                {inprog > 0 && <span style={{ color: C.blue }}>Ã¢ÂÂ¶ {inprog} ÃÂ² ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂµ</span>}
                                {todo > 0 && <span>Ã¢ÂÂ {todo} ÃÂ² ÃÂ¾ÃÂÃÂµÃÂÃÂµÃÂ´ÃÂ¸</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸ ÃÂ¾ÃÂ¶ÃÂ¸ÃÂ´ÃÂ°ÃÂÃÂÃÂ¸ÃÂµ ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂ¸ ÃÂÃÂÃÂºÃÂ¾ÃÂ²ÃÂ¾ÃÂ´ÃÂ¸ÃÂÃÂµÃÂ»ÃÂ */}
                    {(() => {
                      const waitReview = myDeptTasks.filter(t => t.status === 'review_lead');
                      if (waitReview.length === 0) return null;
                      return (
                        <div style={{ background: C.surface, border: `1px solid ${C.purple}30`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div className="page-label" style={{ color: C.purple }}>ÃÂÃÂ¶ÃÂ¸ÃÂ´ÃÂ°ÃÂÃÂ ÃÂ²ÃÂ°ÃÂÃÂµÃÂ¹ ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂ¸</div>
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

              {/* Ã¢ÂÂÃ¢ÂÂ ÃÂÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ Ã¢ÂÂÃ¢ÂÂ */}
              <div className="page-label" style={{ marginBottom: 12 }}>ÃÂÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* FIX: show "no results" message when search filter matches nothing */}
                {searchQuery && projects.filter(p => { const sq = searchQuery.toLowerCase(); return p.name.toLowerCase().includes(sq) || p.code.toLowerCase().includes(sq); }).length === 0 && (
                  <div style={{ fontSize: 13, color: C.textMuted, padding: '12px 0' }}>ÃÂÃÂ¾ ÃÂ·ÃÂ°ÃÂ¿ÃÂÃÂ¾ÃÂÃÂ ÃÂ«{searchQuery}ÃÂ» ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ¾ÃÂ² ÃÂ½ÃÂµ ÃÂ½ÃÂ°ÃÂ¹ÃÂ´ÃÂµÃÂ½ÃÂ¾</div>
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
                          <span style={{ fontSize: 12, color: _deadlineColor, fontWeight: _daysLeft !== null && _daysLeft < 30 ? 700 : 400 }}>ÃÂ´ÃÂ¾ {p.deadline}</span>
                          {isGip && <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); promptArchiveProject(p); }}>Ã¢ÂÂ ÃÂÃÂÃÂÃÂ¸ÃÂ²</button>}
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
                <button onClick={() => setScreen("dashboard")} className="btn btn-ghost">Ã¢ÂÂ Dashboard</button>
                <span className="project-meta-badge" style={{ color: C.accent, borderColor: C.accent + "40", background: C.accent + "10" }}>{activeProject.code}</span>
                <span className="project-meta-badge" style={{ color: C.green, borderColor: C.green + "40", background: C.green + "10" }}>{activeProject.status === "active" ? "ÃÂ ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂµ" : "ÃÂÃÂ° ÃÂ¿ÃÂÃÂ¾ÃÂ²ÃÂµÃÂÃÂºÃÂµ"}</span>
                {activeProject.department && <span style={{ fontSize: 12, color: C.textMuted }}>{activeProject.department}</span>}
                <div style={{ flex: 1 }}></div>
                
                {/* EXPORT BUTTON */}
                <button
                  onClick={() => exportProjectXls(activeProject, allTasks, drawings, reviews, getUserById, activeProjectProgress, addNotification)}
                  title="ÃÂ­ÃÂºÃÂÃÂ¿ÃÂ¾ÃÂÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂ ÃÂ² Excel"
                  className="btn btn-secondary"
                >
                  <span style={{ fontSize: 14 }}>Ã¢Â¬Â</span> Excel
                </button>

                {/* PDF REPORT BUTTON */}
                <button
                  onClick={() => setShowReportPDF(true)}
                  title="ÃÂÃÂÃÂÃÂÃÂ ÃÂ´ÃÂ»ÃÂ ÃÂ·ÃÂ°ÃÂºÃÂ°ÃÂ·ÃÂÃÂ¸ÃÂºÃÂ° (PDF)"
                  className="btn btn-secondary"
                >
                  <span style={{ fontSize: 14 }}>Ã°ÂÂÂ</span> ÃÂÃÂÃÂÃÂÃÂ
                </button>

                {/* COPILOT BUTTON */}
                <button
                  onClick={() => setShowCopilot(!showCopilot)}
                  className={`btn ${showCopilot ? "btn-primary" : "btn-secondary"}`}
                >
                  <span style={{ fontSize: 14 }}>Ã¢ÂÂ¨</span> ChatGPT 4.0
                </button>

                <div className="project-stats-bar">
                  <div className="project-stat">
                    <div className="project-stat-value" style={{ color: C.accent }}>{activeProjectProgress}%</div>
                    <div className="project-stat-label">ÃÂ¿ÃÂÃÂ¾ÃÂ³ÃÂÃÂµÃÂÃÂ</div>
                  </div>
                  <div className="project-stat">
                    <div className="project-stat-value" style={{ color: C.text }}>{tasks.filter(t => t.status === "done").length}/{tasks.length}</div>
                    <div className="project-stat-label">ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂ</div>
                  </div>
                  {activeProject.deadline && <div className="project-stat">
                    <div className="project-stat-value" style={{ color: C.text, fontSize: 14 }}>{activeProject.deadline}</div>
                    <div className="project-stat-label">ÃÂ´ÃÂµÃÂ´ÃÂ»ÃÂ°ÃÂ¹ÃÂ½</div>
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
                  {/* #12 design diff: 3 ÃÂ¼ÃÂµÃÂÃÂÃÂ¸ÃÂºÃÂ¸ ÃÂ² ÃÂÃÂ°ÃÂ¿ÃÂºÃÂµ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ° */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 18, flexWrap: 'wrap' }}>
                    {(() => {
                      const projTasks = allTasks.filter(t => t.project_id === activeProject.id);
                      const doneCount = projTasks.filter(t => t.status === 'done').length;
                      const dl = parseDeadline(activeProject.deadline);
                      const now = new Date();
                      const daysLeft = dl ? Math.ceil((dl.getTime() - now.getTime()) / 86400000) : null;
                      const dlColor = daysLeft === null ? C.textMuted : (daysLeft < 0 ? C.red : daysLeft < 30 ? C.red : daysLeft < 90 ? C.orange : C.green);
                      const dlLabel = daysLeft === null ? 'Ã¢ÂÂ' : daysLeft < 0 ? `ÃÂÃÂÃÂ¾ÃÂÃÂÃÂ¾ÃÂÃÂµÃÂ½ ${-daysLeft} ÃÂ´.` : `${daysLeft} ÃÂ´ÃÂ½.`;
                      const metrics = [
                        { value: `${activeProjectProgress}%`, label: 'ÃÂ¿ÃÂÃÂ¾ÃÂ³ÃÂÃÂµÃÂÃÂ', color: C.accent },
                        { value: `${doneCount}/${projTasks.length}`, label: 'ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂ', color: C.text },
                        { value: dlLabel, label: 'ÃÂ´ÃÂ¾ ÃÂ´ÃÂµÃÂ´ÃÂ»ÃÂ°ÃÂ¹ÃÂ½ÃÂ°', color: dlColor },
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
                        {t === "tasks" ? "Ã¢ÂÂ ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸" : t === "documents" ? "Ã°ÂÂÂ ÃÂÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂÃÂ" : t === "activity" ? "Ã°ÂÂÂ° ÃÂÃÂºÃÂÃÂ¸ÃÂ²ÃÂ½ÃÂ¾ÃÂÃÂÃÂ" : t === "drawings" ? "Ã°ÂÂÂ ÃÂ§ÃÂµÃÂÃÂÃÂµÃÂ¶ÃÂ¸" : t === "revisions" ? "Ã°ÂÂ§Â¾ ÃÂ ÃÂµÃÂ²ÃÂ¸ÃÂ·ÃÂ¸ÃÂ¸" : t === "reviews" ? "Ã°ÂÂÂ ÃÂÃÂ°ÃÂ¼ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂ" : t === "transmittals" ? "Ã°ÂÂÂ¦ ÃÂ¢ÃÂÃÂ°ÃÂ½ÃÂÃÂ¼ÃÂ¸ÃÂÃÂÃÂ°ÃÂ»ÃÂ" : t === "assignments" ? "Ã¢ÂÂ ÃÂ£ÃÂ²ÃÂÃÂ·ÃÂºÃÂ°" : t === "tz" ? "Ã°ÂÂÂ ÃÂ¢ÃÂ" : t === "gantt" ? "Ã°ÂÂÂ ÃÂÃÂ¸ÃÂ°ÃÂ³ÃÂÃÂ°ÃÂ¼ÃÂ¼ÃÂ°" : t === "timeline" ? "Ã°ÂÂÂº Timeline" : t === "meetings" ? "Ã°ÂÂÂ ÃÂÃÂÃÂ¾ÃÂÃÂ¾ÃÂºÃÂ¾ÃÂ»ÃÂ" : t === "timelog" ? "Ã¢ÂÂ± ÃÂ¢ÃÂ°ÃÂ±ÃÂµÃÂ»ÃÂ" : t === "gipdash" ? "Ã°ÂÂÂ ÃÂÃÂÃÂ" : t === "bim" ? "Ã°ÂÂÂ BIM" : "Ã°ÂÂÂ£ ÃÂ¡ÃÂ¾ÃÂ²ÃÂµÃÂÃÂ°ÃÂ½ÃÂ¸ÃÂµ"}
                      </button>
                    ))}
                  </div>
                  <div className="tab-strip-fade" aria-hidden="true" />
                </div>
                {TAB_HELP[sideTab] && (
                  <button
                    title="ÃÂÃÂ½ÃÂÃÂÃÂÃÂÃÂºÃÂÃÂ¸ÃÂ ÃÂ¿ÃÂ¾ ÃÂÃÂ°ÃÂ·ÃÂ´ÃÂµÃÂ»ÃÂ"
                    onClick={() => setShowTabHelp(true)}
                    style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '0 12px', height: 30, borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.surface2, color: C.textDim, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >ÃÂÃÂ½ÃÂÃÂÃÂÃÂÃÂºÃÂÃÂ¸ÃÂ</button>
                )}
              </div>

              {/* Tab Help Modal */}
              {showTabHelp && TAB_HELP[sideTab] && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowTabHelp(false)}>
                  <div style={{ background: C.surface, borderRadius: 16, padding: '28px 32px', maxWidth: 520, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', position: 'relative' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowTabHelp(false)} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.textDim, lineHeight: 1 }}>ÃÂ</button>
                    <div style={{ fontWeight: 700, fontSize: 18, color: C.text, marginBottom: 20 }}>{TAB_HELP[sideTab].title} Ã¢ÂÂ ÃÂ¸ÃÂ½ÃÂÃÂÃÂÃÂÃÂºÃÂÃÂ¸ÃÂ</div>
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
                    <div className="task-list-title">ÃÂ¡ÃÂ¿ÃÂ¸ÃÂÃÂ¾ÃÂº ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂ</div>
                    {isGip && <button className="btn btn-primary" style={{ borderRadius: 20, padding: "10px 22px" }} onClick={() => { setNewTask({ name: "", dept_id: "", priority: "medium", deadline: "", assigned_to: "", drawing_id: "", description: "" }); setTaskSuggest(null); setShowNewTask(true); }}>+ ÃÂÃÂ¾ÃÂ²ÃÂ°ÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ°</button>}
                  </div>
                  <div className="task-list">
                    {tasks.length === 0 && (
                      <div className="empty-state-cta" style={{ textAlign: 'center', padding: '56px 20px', background: C.surface, border: `1.5px dashed ${C.border}`, borderRadius: 12 }}>
                        <div style={{ width: 52, height: 52, borderRadius: 13, background: `${C.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24 }}>Ã°ÂÂÂ</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 5 }}>ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂ ÃÂ¿ÃÂ¾ÃÂºÃÂ° ÃÂ½ÃÂµÃÂ</div>
                        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 18 }}>ÃÂ¡ÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂ¹ÃÂÃÂµ ÃÂ¿ÃÂµÃÂÃÂ²ÃÂÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ ÃÂ´ÃÂ»ÃÂ ÃÂÃÂÃÂ¾ÃÂ³ÃÂ¾ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ°</div>
                        {(isGip || isLead) && <button className="btn btn-primary" onClick={() => { setNewTask({ name: "", dept_id: "", priority: "medium", deadline: "", assigned_to: "", drawing_id: "", description: "" }); setShowNewTask(true); }}>+ ÃÂ¡ÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂÃÂ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ</button>}
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
                                <div title={`ÃÂ ÃÂµÃÂ²ÃÂ¸ÃÂ·ÃÂ¸ÃÂ ${t.revision_num || 0}`} style={{ background: C.accent + '15', color: C.accent, fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, cursor: 'help' }}>R{t.revision_num || 0}</div>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              {deptName && <span style={{ fontSize: 11, color: C.textMuted, background: C.surface2, padding: "3px 10px", borderRadius: 6, fontWeight: 500 }}>{deptName}</span>}
                              {t.drawing_id && (() => {
                                const d = drawings.find(dr => String(dr.id) === String(t.drawing_id));
                                return d ? <span style={{ fontSize: 11, color: C.textMuted }}>Ã°ÂÂÂ {d.code}</span> : null;
                              })()}
                              {t.deadline && <span style={{ fontSize: 11, color: (() => { const dl = parseDeadline(t.deadline); return dl && dl < new Date() ? C.red : C.textMuted; })() }}>Ã°ÂÂÂ {formatDateRu(t.deadline)}</span>}
                              {taskAttachCounts[String(t.id)] > 0 && <span style={{ fontSize: 11, color: C.textMuted }} title="ÃÂÃÂÃÂ¸ÃÂºÃÂÃÂµÃÂ¿ÃÂ»ÃÂÃÂ½ÃÂ½ÃÂÃÂµ ÃÂÃÂ°ÃÂ¹ÃÂ»ÃÂ">Ã°ÂÂÂ {taskAttachCounts[String(t.id)]}</span>}
                              <span style={{ fontSize: 11, color: t.priority === "high" ? C.red : t.priority === "medium" ? C.orange : C.green, fontWeight: 600 }}>Ã¢ÂÂ {t.priority === "high" ? "ÃÂÃÂÃÂÃÂ¾ÃÂºÃÂ¸ÃÂ¹" : t.priority === "medium" ? "ÃÂ¡ÃÂÃÂµÃÂ´ÃÂ½ÃÂ¸ÃÂ¹" : "ÃÂÃÂ¸ÃÂ·ÃÂºÃÂ¸ÃÂ¹"}</span>
                            </div>
                          </div>
                          <span className="badge" style={{ color: st.color, background: st.bg, border: `1px solid ${st.color}25` }}>Ã¢ÂÂ {st.label}</span>
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
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 12 }}>Ã°ÂÂÂ° ÃÂÃÂºÃÂÃÂ¸ÃÂ²ÃÂ½ÃÂ¾ÃÂÃÂÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ°</div>
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

              {/* Ã¢ÂÂÃ¢ÂÂ GANTT Ã¢ÂÂÃ¢ÂÂ */}
              {sideTab === "gantt" && <GanttChart tasks={allTasks} activeProject={activeProject} getUserById={getUserById} getDeptName={getDeptName} C={C} />}
              {sideTab === "timeline" && (
                <div style={{ padding: 20 }}>
                  <div className="page-header" style={{ marginBottom: 16 }}><div><div className="page-label">D5</div><div className="page-title">Timeline ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ°</div></div></div>
                  <ProjectTimeline tasks={allTasks} project={activeProject} C={C} />
                </div>
              )}

              {/* Ã¢ÂÂÃ¢ÂÂ MEETINGS Ã¢ÂÂÃ¢ÂÂ */}
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

              {/* Ã¢ÂÂÃ¢ÂÂ TIMELOG Ã¢ÂÂÃ¢ÂÂ */}
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
                  <div className="page-label">ÃÂ ÃÂµÃÂµÃÂÃÂÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ¾ÃÂ²</div>
                  <div className="page-title">ÃÂÃÂÃÂµ ÃÂ´ÃÂ¾ÃÂÃÂÃÂÃÂ¿ÃÂ½ÃÂÃÂµ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ</div>
                </div>
                {isGip && <button className="btn btn-primary" onClick={() => { setNewProject({ name: "", code: "", deadline: "", status: "active", depts: [] }); setShowNewProject(true); }}>+ ÃÂÃÂ¾ÃÂ²ÃÂÃÂ¹ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂ</button>}
              </div>

              <div className="search-wrap" style={{ marginBottom: 20 }}>
                <span className="search-icon">Ã°ÂÂÂ</span>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="ÃÂÃÂ¾ÃÂ¸ÃÂÃÂº ÃÂ¿ÃÂ¾ ÃÂ½ÃÂ°ÃÂ·ÃÂ²ÃÂ°ÃÂ½ÃÂ¸ÃÂ ÃÂ¸ÃÂ»ÃÂ¸ ÃÂÃÂ¸ÃÂÃÂÃÂ..."
                  className="search-input" style={getInp(C, { paddingLeft: 40, borderRadius: 10, background: C.surface })} />
                {searchQuery && <button className="search-clear" onClick={() => setSearchQuery("")}>Ã¢ÂÂ</button>}
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
                          <span style={{ fontSize: 12, color: _deadlineColor, fontWeight: _daysLeft !== null && _daysLeft < 30 ? 700 : 400 }}>ÃÂ´ÃÂ¾ {p.deadline}</span>
                          {isGip && <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); promptArchiveProject(p); }}>Ã¢ÂÂ ÃÂÃÂÃÂÃÂ¸ÃÂ²</button>}
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
                    <div style={{ width: 52, height: 52, borderRadius: 13, background: `${C.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24 }}>Ã°ÂÂÂ</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 5 }}>ÃÂÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ¾ÃÂ² ÃÂ¿ÃÂ¾ÃÂºÃÂ° ÃÂ½ÃÂµÃÂ</div>
                    <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 18 }}>{isGip ? 'ÃÂ¡ÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂ¹ÃÂÃÂµ ÃÂ¿ÃÂµÃÂÃÂ²ÃÂÃÂ¹ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂ ÃÂÃÂÃÂ¾ÃÂ±ÃÂ ÃÂ½ÃÂ°ÃÂÃÂ°ÃÂÃÂ ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂ' : 'ÃÂ£ ÃÂ²ÃÂ°ÃÂ ÃÂ¿ÃÂ¾ÃÂºÃÂ° ÃÂ½ÃÂµÃÂ ÃÂ´ÃÂ¾ÃÂÃÂÃÂÃÂ¿ÃÂ° ÃÂ½ÃÂ¸ ÃÂº ÃÂ¾ÃÂ´ÃÂ½ÃÂ¾ÃÂ¼ÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ Ã¢ÂÂ ÃÂ¿ÃÂ¾ÃÂ¿ÃÂÃÂ¾ÃÂÃÂ¸ÃÂÃÂµ ÃÂÃÂÃÂÃÂ° ÃÂ´ÃÂ¾ÃÂ±ÃÂ°ÃÂ²ÃÂ¸ÃÂÃÂ ÃÂ²ÃÂ°ÃÂ'}</div>
                    {isGip && <button className="btn btn-primary" onClick={() => { setNewProject({ name: "", code: "", deadline: "", status: "active", depts: [] }); setShowNewProject(true); }}>+ ÃÂ¡ÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂÃÂ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂ</button>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== TASKS KANBAN ===== */}
          {screen === "tasks" && (
            <div className="screen-fade">
              <div className="page-header"><div><div className="page-label">ÃÂÃÂ¾ÃÂ¸ ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸</div><div className="page-title">ÃÂÃÂ°ÃÂ´ÃÂ°ÃÂÃÂ¸ ÃÂ¿ÃÂ¾ ÃÂÃÂÃÂ°ÃÂÃÂÃÂÃÂ</div></div></div>

              {/* ÃÂ¤ÃÂ¸ÃÂ»ÃÂÃÂÃÂÃÂ */}
              <div className="filters-bar">
                <div className="search-wrap" style={{ flex: "1 1 200px" }}>
                  <span className="search-icon">Ã°ÂÂÂ</span>
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="ÃÂÃÂ¾ÃÂ¸ÃÂÃÂº ÃÂ·ÃÂ°ÃÂ´ÃÂ°ÃÂ..."
                    className="search-input" style={getInp(C, { paddingLeft: 40, fontSize: 12, borderRadius: 10, background: C.surface })} />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="filter-chip" style={{ border: `1.5px solid ${C.border}`, background: C.surface, color: C.textDim, fontFamily: "inherit", cursor: "pointer", minWidth: 140 }}>
                  <option value="all">Ã¢ÂÂ ÃÂÃÂÃÂµ ÃÂÃÂÃÂ°ÃÂÃÂÃÂÃÂ</option>
                  {Object.entries(statusMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="filter-chip" style={{ border: `1.5px solid ${C.border}`, background: C.surface, color: C.textDim, fontFamily: "inherit", cursor: "pointer", minWidth: 140 }}>
                  <option value="all">Ã¢ÂÂ ÃÂÃÂÃÂ¸ÃÂ¾ÃÂÃÂ¸ÃÂÃÂµÃÂ</option>
                  <option value="high">Ã°ÂÂÂ´ ÃÂÃÂÃÂÃÂ¾ÃÂºÃÂ¸ÃÂ¹</option><option value="medium">Ã°ÂÂÂ¡ ÃÂ¡ÃÂÃÂµÃÂ´ÃÂ½ÃÂ¸ÃÂ¹</option><option value="low">Ã¢ÂÂª ÃÂÃÂ¸ÃÂ·ÃÂºÃÂ¸ÃÂ¹</option>
                </select>
                {(isGip || isLead) && (
                  <select value={filterAssigned} onChange={e => setFilterAssigned(e.target.value)} className="filter-chip" style={{ border: `1.5px solid ${C.border}`, background: C.surface, color: C.textDim, fontFamily: "inherit", cursor: "pointer", minWidth: 150 }}>
                    <option value="all">Ã¢ÂÂ ÃÂÃÂÃÂ¿ÃÂ¾ÃÂ»ÃÂ½ÃÂ¸ÃÂÃÂµÃÂ»ÃÂ</option>
                    {appUsers.filter(u => u.role === "engineer" || u.role === "lead").map(u => <option key={u.id} value={String(u.id)}>{u.full_name}</option>)}
                  </select>
                )}
                {(searchQuery || filterStatus !== "all" || filterPriority !== "all" || filterAssigned !== "all") && (
                  <button className="btn btn-danger btn-sm" onClick={() => { setSearchQuery(""); setFilterStatus("all"); setFilterPriority("all"); setFilterAssigned("all"); }}>Ã¢ÂÂ ÃÂ¡ÃÂ±ÃÂÃÂ¾ÃÂÃÂ¸ÃÂÃÂ</button>
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
                <div className="empty-state" style={{ padding: 40 }}>ÃÂÃÂµÃÂ ÃÂ°ÃÂºÃÂÃÂ¸ÃÂ²ÃÂ½ÃÂ¾ÃÂ³ÃÂ¾ ÃÂ¿ÃÂÃÂ¾ÃÂµÃÂºÃÂÃÂ° ÃÂ´ÃÂ»ÃÂ ÃÂÃÂ¿ÃÂµÃÂÃÂ¸ÃÂÃÂ¸ÃÂºÃÂ°ÃÂÃÂ¸ÃÂ¸</div>
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
                    <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 6 }}>ÃÂÃÂ±ÃÂ½ÃÂ°ÃÂÃÂÃÂ¶ÃÂµÃÂ½ÃÂ ÃÂ´ÃÂÃÂ±ÃÂ»ÃÂ¸ÃÂºÃÂ°ÃÂÃÂ</div>
                    <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>ÃÂ¡ÃÂ»ÃÂµÃÂ´ÃÂÃÂÃÂÃÂ¸ÃÂµ ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂÃÂ ÃÂÃÂ¶ÃÂµ ÃÂÃÂÃÂÃÂµÃÂÃÂÃÂ²ÃÂÃÂÃÂ ÃÂ² ÃÂ±ÃÂ°ÃÂ·ÃÂµ. ÃÂÃÂÃÂ±ÃÂµÃÂÃÂ¸ÃÂÃÂµ ÃÂ´ÃÂµÃÂ¹ÃÂÃÂÃÂ²ÃÂ¸ÃÂµ ÃÂ´ÃÂ»ÃÂ ÃÂºÃÂ°ÃÂ¶ÃÂ´ÃÂ¾ÃÂ³ÃÂ¾:</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                      <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => {
                        const all: Record<string, 'overwrite' | 'skip'> = {};
                        dupConflicts.forEach(c => { all[c.file.name] = 'skip'; });
                        setDupDecisions(all);
                      }}>ÃÂÃÂÃÂ¾ÃÂ¿ÃÂÃÂÃÂÃÂ¸ÃÂÃÂ ÃÂ²ÃÂÃÂµ</button>
                      <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => {
                        const all: Record<string, 'overwrite' | 'skip'> = {};
                        dupConflicts.forEach(c => { all[c.file.name] = 'overwrite'; });
                        setDupDecisions(all);
                      }}>ÃÂÃÂµÃÂÃÂµÃÂ·ÃÂ°ÃÂ¿ÃÂ¸ÃÂÃÂ°ÃÂÃÂ ÃÂ²ÃÂÃÂµ</button>
                    </div>
                    {dupConflicts.map(({ file }) => (
                      <div key={file.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ flex: 1, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.name}>{file.name}</div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => setDupDecisions(d => ({ ...d, [file.name]: 'skip' }))}
                            style={{ padding: '4px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, cursor: 'pointer', background: dupDecisions[file.name] === 'skip' ? C.accent : C.surface2, color: dupDecisions[file.name] === 'skip' ? '#fff' : C.text }}>
                            ÃÂÃÂÃÂ¾ÃÂ¿ÃÂÃÂÃÂÃÂ¸ÃÂÃÂ
                          </button>
                          <button onClick={() => setDupDecisions(d => ({ ...d, [file.name]: 'overwrite' }))}
                            style={{ padding: '4px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, cursor: 'pointer', background: dupDecisions[file.name] === 'overwrite' ? '#EF4444' : C.surface2, color: dupDecisions[file.name] === 'overwrite' ? '#fff' : C.text }}>
                            ÃÂÃÂµÃÂÃÂµÃÂ·ÃÂ°ÃÂ¿ÃÂ¸ÃÂÃÂ°ÃÂÃÂ
                          </button>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary" onClick={() => { setShowDupModal(false); setPendingFiles([]); }}>ÃÂÃÂÃÂ¼ÃÂµÃÂ½ÃÂ°</button>
                      <button className="btn btn-primary" onClick={async () => {
                        setShowDupModal(false);
                        const conflictFiles = dupConflicts.map(c => c.file);
                        addNotification(`ÃÂÃÂ±ÃÂÃÂ°ÃÂ±ÃÂ°ÃÂÃÂÃÂ²ÃÂ°ÃÂ ${conflictFiles.length} ÃÂÃÂ°ÃÂ¹ÃÂ»ÃÂ¾ÃÂ²...`, 'info');
                        await doUpload(conflictFiles, dupDecisions);
                        setPendingFiles([]);
                      }}>ÃÂÃÂÃÂ¾ÃÂ´ÃÂ¾ÃÂ»ÃÂ¶ÃÂ¸ÃÂÃÂ</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="page-header">
                <div>
                  <div className="page-label">ÃÂÃÂ¾ÃÂÃÂ¼ÃÂ°ÃÂÃÂ¸ÃÂ²ÃÂ½ÃÂ°ÃÂ ÃÂ±ÃÂ°ÃÂ·ÃÂ° (RAG)</div>
                  <div className="page-title">ÃÂÃÂ¾ÃÂºÃÂ°ÃÂ»ÃÂÃÂ½ÃÂÃÂµ ÃÂÃÂµÃÂ³ÃÂ»ÃÂ°ÃÂ¼ÃÂµÃÂ½ÃÂÃÂ ÃÂ¸ ÃÂÃÂÃÂ¡ÃÂ¢ÃÂ</div>
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
                          addNotification(`ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ¶ÃÂ°ÃÂ ${noConflict.length} ÃÂ½ÃÂ¾ÃÂ²ÃÂÃÂ ÃÂÃÂ°ÃÂ¹ÃÂ»ÃÂ¾ÃÂ²...`, 'info');
                          await doUpload(noConflict, {});
                        }
                      } else {
                        addNotification(`ÃÂÃÂ°ÃÂÃÂ¸ÃÂ½ÃÂ°ÃÂ ÃÂ·ÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂºÃÂ (${files.length} ÃÂÃÂ.)...`, 'info');
                        await doUpload(files, {});
                      }
                    }} />
                    <button className="btn btn-primary" onClick={() => document.getElementById('normative-upload')?.click()}>+ ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂ¸ÃÂÃÂ PDF/DOCX</button>
                    <button className="btn btn-secondary" onClick={async () => {
                      const pending = normativeDocs.filter(d => d.status === 'pending' || d.status === 'processing' || d.status === 'error');
                      if (pending.length === 0) { addNotification('ÃÂÃÂÃÂµ ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂÃÂ ÃÂÃÂ¶ÃÂµ ÃÂ¿ÃÂÃÂ¾ÃÂ¸ÃÂ½ÃÂ´ÃÂµÃÂºÃÂÃÂ¸ÃÂÃÂ¾ÃÂ²ÃÂ°ÃÂ½ÃÂ', 'info'); return; }
                                            addNotification(`ÃÂÃÂ°ÃÂ¿ÃÂÃÂÃÂºÃÂ°ÃÂ ÃÂ¸ÃÂ½ÃÂ´ÃÂµÃÂºÃÂÃÂ°ÃÂÃÂ¸ÃÂ ÃÂ´ÃÂ»ÃÂ ${pending.length} ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂÃÂ¾ÃÂ²...`, 'info');
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
                        
                        addNotification(`ÃÂÃÂ±ÃÂ½ÃÂ¾ÃÂ²ÃÂ»ÃÂµÃÂ½ÃÂ¸ÃÂµ: ${done} ÃÂ³ÃÂ¾ÃÂÃÂ¾ÃÂ²ÃÂ¾, ${errors} ÃÂ¾ÃÂÃÂ¸ÃÂ±ÃÂ¾ÃÂº. ÃÂÃÂÃÂµÃÂ³ÃÂ¾: ${pending.length}`, errors > 0 ? 'warning' : 'info');
                        await loadNormativeDocs();
                      }
                      addNotification(`ÃÂÃÂ±ÃÂ½ÃÂ¾ÃÂ²ÃÂ»ÃÂµÃÂ½ÃÂ¸ÃÂµ ÃÂ·ÃÂ°ÃÂ²ÃÂµÃÂÃÂÃÂµÃÂ½ÃÂ¾. ÃÂ£ÃÂÃÂ¿ÃÂµÃÂÃÂ½ÃÂ¾: ${done}, ÃÂÃÂÃÂ¸ÃÂ±ÃÂ¾ÃÂº: ${errors}`, errors > 0 ? 'warning' : 'success');
                    }}>Ã°ÂÂÂ ÃÂÃÂ±ÃÂ½ÃÂ¾ÃÂ²ÃÂ¸ÃÂÃÂ ÃÂ¿ÃÂ¾ÃÂ¸ÃÂÃÂº ÃÂ¿ÃÂ¾ ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂÃÂ°ÃÂ¼</button>
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
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Ã¢ÂÂ AI-ÃÂ¿ÃÂ¾ÃÂ¸ÃÂÃÂº ÃÂ¿ÃÂ¾ ÃÂ½ÃÂ¾ÃÂÃÂ¼ÃÂ°ÃÂÃÂ¸ÃÂ²ÃÂºÃÂµ</span>
                  {/* RAG toggle */}
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: C.textMuted }}>RAG-ÃÂ¿ÃÂ¾ÃÂ¸ÃÂÃÂº</span>
                    <div onClick={() => setUseKb(!useKb)} style={{ width: 36, height: 20, borderRadius: 10, background: useKb ? C.accent : C.border, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: useKb ? 18 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <input
                    placeholder={useKb ? 'ÃÂ¡ÃÂµÃÂ¼ÃÂ°ÃÂ½ÃÂÃÂ¸ÃÂÃÂµÃÂÃÂºÃÂ¸ÃÂ¹ ÃÂ¿ÃÂ¾ÃÂ¸ÃÂÃÂº ÃÂ¿ÃÂ¾ ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂÃÂ°ÃÂ¼ (RAG)...' : 'ÃÂÃÂ¾ÃÂ¸ÃÂÃÂº ÃÂ¿ÃÂ¾ ÃÂÃÂµÃÂºÃÂÃÂÃÂ ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂÃÂ¾ÃÂ²...'}
                    value={normSearchQuery}
                    onChange={e => { setNormSearchQuery(e.target.value); if (!e.target.value.trim()) setNormSearchResults(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') searchNormative(normSearchQuery); }}
                    style={{ ...getInp(C), flex: 1, height: 40, fontSize: 14 }}
                  />
                  {normSearchResults !== null && (
                    <button className="btn btn-secondary" style={{ height: 40, fontSize: 13 }} onClick={() => { setNormSearchQuery(''); setNormSearchResults(null); }}>Ã¢ÂÂ ÃÂ¡ÃÂ±ÃÂÃÂ¾ÃÂÃÂ¸ÃÂÃÂ</button>
                  )}
                  <button className="btn btn-primary" style={{ height: 40, width: 40, padding: 0 }} onClick={() => searchNormative(normSearchQuery)} disabled={normSearching}>
                    {normSearching ? 'Ã¢ÂÂ¦' : 'Ã°ÂÂÂ'}
                  </button>
                </div>
              </div>

              {/* Search results */}
              {normSearchResults !== null ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
                    {normSearchResults.length === 0 ? 'ÃÂÃÂ¸ÃÂÃÂµÃÂ³ÃÂ¾ ÃÂ½ÃÂµ ÃÂ½ÃÂ°ÃÂ¹ÃÂ´ÃÂµÃÂ½ÃÂ¾' : `ÃÂÃÂ°ÃÂ¹ÃÂ´ÃÂµÃÂ½ÃÂ¾ ÃÂ² ${normSearchResults.length} ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂÃÂ°ÃÂ:`}
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
                    // NORM-01: ÃÂ½ÃÂ°ÃÂ¹ÃÂÃÂ¸ ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂ ÃÂ¿ÃÂ¾ doc_id ÃÂÃÂÃÂ¾ÃÂ±ÃÂ ÃÂ¼ÃÂ¾ÃÂ¶ÃÂ½ÃÂ¾ ÃÂ±ÃÂÃÂ»ÃÂ¾ ÃÂ¾ÃÂÃÂºÃÂÃÂÃÂÃÂ
                    const matchedDoc = normativeDocs.find((d: any) => d.id === r.doc_id || d.name === r.doc_name);
                    return (
                      <div key={r.id}
                        onClick={() => matchedDoc && openNormativeDoc(matchedDoc)}
                        style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.surface : C.surface2, cursor: matchedDoc ? 'pointer' : 'default', transition: 'background 0.15s' }}
                        onMouseEnter={e => { if (matchedDoc) e.currentTarget.style.background = C.accent + '15'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? C.surface : C.surface2; }}
                        title={matchedDoc ? 'ÃÂÃÂ»ÃÂ¸ÃÂºÃÂ½ÃÂ¸ ÃÂÃÂÃÂ¾ÃÂ±ÃÂ ÃÂ¾ÃÂÃÂºÃÂÃÂÃÂÃÂ ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂ' : ''}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <span style={{ fontSize: 15 }}>{r.doc_name?.toLowerCase().endsWith('.pdf') ? 'Ã°ÂÂÂ' : 'Ã°ÂÂÂ'}</span>
                          <span style={{ fontWeight: 600, fontSize: 13, color: matchedDoc ? C.accent : C.text, flex: 1, textDecoration: matchedDoc ? 'underline' : 'none' }}>{r.doc_name}{matchedDoc && ' Ã¢ÂÂ'}</span>
                          {pct != null && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: pctColor, background: pctColor + '18', padding: '2px 10px', borderRadius: 10 }}>
                              {pct}% ÃÂÃÂµÃÂ»ÃÂµÃÂ².
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
                /* All docs list Ã¢ÂÂ compact rows */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                  {normativeDocs.length === 0 ? (
                    <div style={{ padding: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                      <div style={{ fontSize: 40 }}>Ã°ÂÂÂ</div>
                      <div style={{ fontWeight: 700, color: C.text }}>ÃÂÃÂ°ÃÂ·ÃÂ° ÃÂ·ÃÂ½ÃÂ°ÃÂ½ÃÂ¸ÃÂ¹ ÃÂ¿ÃÂÃÂÃÂÃÂ°</div>
                      <div style={{ fontSize: 13, color: C.textMuted }}>ÃÂÃÂ°ÃÂ³ÃÂÃÂÃÂ·ÃÂ¸ÃÂÃÂµ PDF, DOCX ÃÂ¸ÃÂ»ÃÂ¸ TXT. ÃÂÃÂ-ÃÂ°ÃÂ³ÃÂµÃÂ½ÃÂ ÃÂÃÂ¼ÃÂ¾ÃÂ¶ÃÂµÃÂ ÃÂ¸ÃÂÃÂºÃÂ°ÃÂÃÂ ÃÂ¿ÃÂ¾ ÃÂ½ÃÂ¸ÃÂ¼ ÃÂ¸ ÃÂ´ÃÂ°ÃÂ²ÃÂ°ÃÂÃÂ ÃÂ¾ÃÂÃÂ²ÃÂµÃÂÃÂ ÃÂ ÃÂ¸ÃÂÃÂÃÂ¾ÃÂÃÂ½ÃÂ¸ÃÂºÃÂ°ÃÂ¼ÃÂ¸.</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 120px 100px 130px', gap: 0, padding: '8px 16px', background: C.surface2, borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <div></div><div>ÃÂÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂ</div><div>ÃÂÃÂ°ÃÂÃÂ°</div><div>ÃÂ¢ÃÂ¸ÃÂ¿</div><div>ÃÂ¡ÃÂÃÂ°ÃÂÃÂÃÂ</div>
                      </div>
                      {normativeDocs.map((doc, i) => (
                        <div key={doc.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 120px 100px 130px', gap: 0, padding: '10px 16px', alignItems: 'center', background: i % 2 === 0 ? C.surface : C.surface2, borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 16 }}>{doc.file_type?.includes('pdf') ? 'Ã°ÂÂÂ' : 'Ã°ÂÂÂ'}</div>
                          <div
                            style={{ fontSize: 13, color: C.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12, cursor: 'pointer', textDecoration: 'underline' }}
                            title={doc.name}
                            onClick={async () => {
                              if (!doc.file_path) { addNotification('ÃÂÃÂÃÂÃÂ ÃÂº ÃÂÃÂ°ÃÂ¹ÃÂ»ÃÂ ÃÂ½ÃÂµ ÃÂ½ÃÂ°ÃÂ¹ÃÂ´ÃÂµÃÂ½', 'warning'); return; }
                              const isPdf = doc.file_type?.includes('pdf') || doc.name?.toLowerCase().endsWith('.pdf');
                              if (isPdf) {
                                // ÃÂÃÂ¾ÃÂ»ÃÂÃÂÃÂ¸ÃÂÃÂ ÃÂ¿ÃÂ¾ÃÂ´ÃÂ¿ÃÂ¸ÃÂÃÂ°ÃÂ½ÃÂ½ÃÂÃÂ¹ URL ÃÂ´ÃÂ»ÃÂ PDF ÃÂ¸ ÃÂ¾ÃÂÃÂºÃÂÃÂÃÂÃÂ ÃÂ² ÃÂ½ÃÂ¾ÃÂ²ÃÂ¾ÃÂ¹ ÃÂ²ÃÂºÃÂ»ÃÂ°ÃÂ´ÃÂºÃÂµ
                                const signedUrl = await signStorageUrl('normative-docs', doc.file_path, 3600);
                                if (signedUrl) window.open(signedUrl, '_blank');
                                else addNotification('ÃÂÃÂµ ÃÂÃÂ´ÃÂ°ÃÂ»ÃÂ¾ÃÂÃÂ ÃÂ¿ÃÂ¾ÃÂ»ÃÂÃÂÃÂ¸ÃÂÃÂ ÃÂÃÂÃÂÃÂ»ÃÂºÃÂ ÃÂ½ÃÂ° ÃÂÃÂ°ÃÂ¹ÃÂ»', 'warning');
                              } else {
                                // DOCX/DOC Ã¢ÂÂ ÃÂÃÂºÃÂ°ÃÂÃÂ°ÃÂÃÂ ÃÂÃÂµÃÂÃÂµÃÂ· ÃÂ¿ÃÂ¾ÃÂ´ÃÂ¿ÃÂ¸ÃÂÃÂ°ÃÂ½ÃÂ½ÃÂÃÂ¹ URL
                                const signedUrl = await signStorageUrl('normative-docs', doc.file_path, 3600);
                                if (signedUrl) {
                                  const a = document.createElement('a');
                                  a.href = signedUrl;
                                  a.download = doc.name;
                                  a.click();
                                } else addNotification('ÃÂÃÂµ ÃÂÃÂ´ÃÂ°ÃÂ»ÃÂ¾ÃÂÃÂ ÃÂ¿ÃÂ¾ÃÂ»ÃÂÃÂÃÂ¸ÃÂÃÂ ÃÂÃÂÃÂÃÂ»ÃÂºÃÂ ÃÂ½ÃÂ° ÃÂÃÂ°ÃÂ¹ÃÂ»', 'warning');
                              }
                            }}
                          >{doc.name}</div>
                          <div style={{ fontSize: 12, color: C.textMuted }}>{new Date(doc.created_at).toLocaleDateString('ru-RU')}</div>
                          <div style={{ fontSize: 11, color: C.textMuted }}>{doc.file_type?.includes('pdf') ? 'PDF' : doc.file_type?.includes('word') ? 'DOCX' : 'DOC'}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: C.textMuted }}>
                              {doc.status === 'ready' ? 'Ã¢ÂÂ ÃÂÃÂ¾ÃÂÃÂ¾ÃÂ²' : doc.status === 'processing' ? 'Ã¢ÂÂÃ¯Â¸Â ÃÂÃÂ±ÃÂÃÂ°ÃÂ±ÃÂ°ÃÂÃÂÃÂ²ÃÂ°ÃÂµÃÂÃÂÃÂ...' : doc.status === 'error' ? 'Ã¢ÂÂ ÃÂÃÂµ ÃÂÃÂ´ÃÂ°ÃÂ»ÃÂ¾ÃÂÃÂ ÃÂ¾ÃÂ±ÃÂÃÂ°ÃÂ±ÃÂ¾ÃÂÃÂ°ÃÂÃÂ' : 'Ã°ÂÂÂ ÃÂ ÃÂ¾ÃÂÃÂµÃÂÃÂµÃÂ´ÃÂ¸'}
                            </span>
                            {(isGip || isAdmin) && (
                              <button style={{ marginLeft: 'auto', fontSize: 11, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                                onClick={() => {
                                  if (!window.confirm(`ÃÂ£ÃÂ´ÃÂ°ÃÂ»ÃÂ¸ÃÂÃÂ ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂ "${doc.name}"?`)) return;
                                  if (!window.confirm('ÃÂÃÂ¾ÃÂ´ÃÂÃÂ²ÃÂµÃÂÃÂ´ÃÂ¸ÃÂÃÂµ ÃÂµÃÂÃÂ ÃÂÃÂ°ÃÂ·: ÃÂ´ÃÂ¾ÃÂºÃÂÃÂ¼ÃÂµÃÂ½ÃÂ ÃÂ¸ ÃÂ²ÃÂÃÂµ ÃÂµÃÂ³ÃÂ¾ ÃÂ´ÃÂ°ÃÂ½ÃÂ½ÃÂÃÂµ ÃÂ±ÃÂÃÂ´ÃÂÃÂ ÃÂÃÂ´ÃÂ°ÃÂ»ÃÂµÃÂ½ÃÂ ÃÂ±ÃÂµÃÂ·ÃÂ²ÃÂ¾ÃÂ·ÃÂ²ÃÂÃÂ°ÃÂÃÂ½ÃÂ¾.')) return;
                                  del(`normative_docs?id=eq.${doc.id}`, token!).then(loadNormativeDocs);
                                }}>Ã¢ÂÂ</button>
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
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: "'Manrope',sans-serif" }}>ÃÂÃÂ¸ÃÂ±ÃÂ»ÃÂ¸ÃÂ¾ÃÂÃÂµÃÂºÃÂ° ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂ¾ÃÂ²</div>
                  <input
                    placeholder="ÃÂÃÂ¾ÃÂ¸ÃÂÃÂº ÃÂÃÂ°ÃÂÃÂÃÂÃÂÃÂ°..."
                    value={calcSearch}
                    onChange={e => setCalcSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                  {/* Category pills */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    <button
                      onClick={() => setCalcActiveCat(null)}
                      style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', background: calcActiveCat === null ? C.accent : C.surface2, color: calcActiveCat === null ? '#fff' : C.textMuted, transition: 'all 0.15s' }}
                    >ÃÂÃÂÃÂµ</button>
                    {calcAllCats.filter(cat => calcTemplates.some(t => t.cat === cat)).map(cat => {
                      const CALC_CAT_COLORS: Record<string,string> = { 'ÃÂ¢ÃÂ¥': '#2b5bb5', 'ÃÂ¢ÃÂ¢': '#2f9e62', 'ÃÂÃÂ': '#2f9e62', 'ÃÂ­ÃÂ': '#f5a623', 'ÃÂÃÂ': '#06b6d4', 'ÃÂÃÂ / ÃÂÃÂ': '#a855f7', 'ÃÂÃÂ': '#a855f7', 'ÃÂÃÂ': '#a855f7', 'ÃÂÃÂ': '#ef4444', 'ÃÂ': '#22c55e', 'ÃÂÃÂÃÂÃÂ¸ÃÂ': '#8b5cf6' };
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
                    const CALC_CAT_COLORS: Record<string,string> = { 'ÃÂ¢ÃÂ¥': '#2b5bb5', 'ÃÂ¢ÃÂ¢': '#2f9e62', 'ÃÂÃÂ': '#2f9e62', 'ÃÂ­ÃÂ': '#f5a623', 'ÃÂÃÂ': '#06b6d4', 'ÃÂÃÂ / ÃÂÃÂ': '#a855f7', 'ÃÂÃÂ': '#a855f7', 'ÃÂÃÂ': '#a855f7', 'ÃÂÃÂ': '#ef4444', 'ÃÂ': '#22c55e', 'ÃÂÃÂÃÂÃÂ¸ÃÂ': '#8b5cf6' };
                    const filtered = calcTemplates.filter(t => {
                      const matchCat = !calcActiveCat || t.cat === calcActiveCat;
                      const q = calcSearch.toLowerCase().trim();
                      const matchQ = !q || t.name.toLowerCase().includes(q) || (t.desc || '').toLowerCase().includes(q) || t.cat.toLowerCase().includes(q);
                      return matchCat && matchQ;
                    });
                    if (filtered.length === 0) return (
                      <div style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>ÃÂ ÃÂ°ÃÂÃÂÃÂÃÂÃÂ¾ÃÂ² ÃÂ½ÃÂµ ÃÂ½ÃÂ°ÃÂ¹ÃÂ´ÃÂµÃÂ½ÃÂ¾</div>
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

      {/* Ã¢ÂÂÃ¢ÂÂ Mobile Bottom Navigation Ã¢ÂÂÃ¢ÂÂ */}
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
