-- Migration 000: Core Schema Initialization
-- Create all base tables required for EngHub application
-- This migration must run before all other migrations

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- ===== Base Tables (no dependencies) =====

-- Departments
CREATE TABLE IF NOT EXISTS public.departments (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- App Users
CREATE TABLE IF NOT EXISTS public.app_users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  position TEXT,
  role TEXT NOT NULL,
  dept_id BIGINT REFERENCES public.departments(id) ON DELETE SET NULL,
  supabase_uid TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  avatar_url TEXT,
  telegram_id BIGINT UNIQUE
);

-- Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  progress SMALLINT,
  status TEXT NOT NULL,
  deadline TEXT NOT NULL,
  archived BOOLEAN DEFAULT false,
  depts JSONB DEFAULT '[]'::jsonb,
  gip_id BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL
);

-- Normative Docs
CREATE TABLE IF NOT EXISTS public.normative_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT,
  status TEXT DEFAULT 'pending',
  user_id UUID,
  project_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  content TEXT
);

-- Normative Chunks (for RAG)
CREATE TABLE IF NOT EXISTS public.normative_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID REFERENCES public.normative_docs(id) ON DELETE CASCADE,
  doc_name TEXT,
  chunk_index INT DEFAULT 0,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT now(),
  status TEXT
);

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  dept TEXT NOT NULL,
  deadline TEXT NOT NULL,
  project_id BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  assigned_to TEXT,
  comment TEXT,
  is_assignment BOOLEAN DEFAULT false,
  target_dept_id INT,
  revision_num INT DEFAULT 0,
  parent_task_id BIGINT REFERENCES public.tasks(id) ON DELETE SET NULL,
  assignment_status TEXT DEFAULT 'new',
  description TEXT,
  planned_hours NUMERIC,
  drawing_id UUID
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  text TEXT NOT NULL,
  user_id TEXT NOT NULL,
  project_id BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type = ANY (ARRAY['text', 'call_start', 'file', 'system', 'comment', 'call_invite'])),
  task_id BIGINT REFERENCES public.tasks(id) ON DELETE CASCADE
);

-- AI Actions
CREATE TABLE IF NOT EXISTS public.ai_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  user_id TEXT,
  action_type VARCHAR NOT NULL,
  agent_type VARCHAR NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id INT REFERENCES public.app_users(id) ON DELETE CASCADE,
  project_id INT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,
  entity_id TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Task Templates
CREATE TABLE IF NOT EXISTS public.task_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  dept TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  duration_days INT,
  description TEXT,
  is_system BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Task History
CREATE TABLE IF NOT EXISTS public.task_history (
  id BIGSERIAL PRIMARY KEY,
  task_id INT NOT NULL,
  changed_by INT REFERENCES public.app_users(id) ON DELETE SET NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- RACI Matrix
CREATE TABLE IF NOT EXISTS public.raci (
  id INT PRIMARY KEY DEFAULT nextval('raci_id_seq'::regclass),
  project_id INT NOT NULL,
  discipline TEXT NOT NULL,
  user_id INT NOT NULL,
  role CHAR(1) NOT NULL CHECK (role = ANY (ARRAY['R', 'A', 'C', 'I'])),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Catalogs
CREATE TABLE IF NOT EXISTS public.catalogs (
  id BIGSERIAL PRIMARY KEY,
  version TEXT NOT NULL,
  catalog_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  source_file TEXT,
  created_by BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sections (in catalogs)
CREATE TABLE IF NOT EXISTS public.sections (
  id BIGSERIAL PRIMARY KEY,
  catalog_id BIGINT NOT NULL REFERENCES public.catalogs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

-- Groups (in sections)
CREATE TABLE IF NOT EXISTS public.groups (
  id BIGSERIAL PRIMARY KEY,
  section_id BIGINT NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

-- Catalog Items
CREATE TABLE IF NOT EXISTS public.catalog_items (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT,
  standard TEXT,
  searchable TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', COALESCE(code, '') || ' ' || COALESCE(name, '') || ' ' || COALESCE(standard, ''))
  ) STORED
);

-- Specifications
CREATE TABLE IF NOT EXISTS public.specifications (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  catalog_id BIGINT REFERENCES public.catalogs(id) ON DELETE SET NULL,
  stamp JSONB DEFAULT '{}',
  created_by BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  user_id BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL
);

-- Specification Items
CREATE TABLE IF NOT EXISTS public.specification_items (
  id BIGSERIAL PRIMARY KEY,
  specification_id BIGINT NOT NULL REFERENCES public.specifications(id) ON DELETE CASCADE,
  line_no INT NOT NULL,
  item_id BIGINT REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type_mark TEXT,
  code TEXT,
  plant TEXT,
  unit TEXT,
  qty NUMERIC DEFAULT 1
);

-- Spec Items (legacy)
CREATE TABLE IF NOT EXISTS public.spec_items (
  id BIGSERIAL PRIMARY KEY,
  spec_id BIGINT NOT NULL REFERENCES public.specifications(id) ON DELETE CASCADE,
  line_no INT DEFAULT 1,
  name TEXT NOT NULL,
  type TEXT,
  code TEXT,
  factory TEXT,
  unit TEXT,
  qty NUMERIC DEFAULT 1,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  item_id BIGINT REFERENCES public.catalog_items(id) ON DELETE SET NULL
);

-- Drawings
CREATE TABLE IF NOT EXISTS public.drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  discipline TEXT,
  stage TEXT DEFAULT 'P',
  status TEXT DEFAULT 'draft',
  revision TEXT DEFAULT 'R0',
  file_url TEXT,
  due_date DATE,
  created_by BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Revisions
CREATE TABLE IF NOT EXISTS public.revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  drawing_id UUID NOT NULL REFERENCES public.drawings(id) ON DELETE CASCADE,
  from_revision TEXT NOT NULL,
  to_revision TEXT NOT NULL,
  issued_by BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  drawing_id UUID REFERENCES public.drawings(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  severity TEXT DEFAULT 'major',
  status TEXT DEFAULT 'open',
  author_id BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL,
  assignee_id BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Review Comments
CREATE TABLE IF NOT EXISTS public.review_comments (
  id BIGSERIAL PRIMARY KEY,
  review_id BIGINT NOT NULL,
  parent_id BIGINT REFERENCES public.review_comments(id) ON DELETE CASCADE,
  author_id INT REFERENCES public.app_users(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Transmittals
CREATE TABLE IF NOT EXISTS public.transmittals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  issued_by BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL,
  recipient TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Transmittal Items
CREATE TABLE IF NOT EXISTS public.transmittal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transmittal_id UUID NOT NULL REFERENCES public.transmittals(id) ON DELETE CASCADE,
  drawing_id UUID REFERENCES public.drawings(id) ON DELETE SET NULL,
  revision_id UUID REFERENCES public.revisions(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Meetings
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  meeting_date DATE,
  participants TEXT,
  agenda TEXT,
  decisions TEXT,
  created_by BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Time Entries
CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id BIGINT NOT NULL,
  task_id BIGINT REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL,
  hours NUMERIC NOT NULL CHECK (hours > 0 AND hours <= 24),
  date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Video Meetings
CREATE TABLE IF NOT EXISTS public.video_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id BIGINT,
  title TEXT DEFAULT 'Видеовстреча',
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_by BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Video Meeting Participants
CREATE TABLE IF NOT EXISTS public.video_meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.video_meetings(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  role TEXT DEFAULT 'participant',
  invited_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ
);

-- Video Meeting Chat Messages
CREATE TABLE IF NOT EXISTS public.video_meeting_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.video_meetings(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  user_name TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Project Documents
CREATE TABLE IF NOT EXISTS public.project_documents (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type = ANY (ARRAY['tz', 'addendum', 'other'])),
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL,
  uploaded_by BIGINT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Task Attachments
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id BIGSERIAL PRIMARY KEY,
  task_id BIGINT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL,
  uploaded_by BIGINT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Activity Log
CREATE TABLE IF NOT EXISTS public.activity_log (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_id BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id BIGINT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Task Dependencies
CREATE TABLE IF NOT EXISTS public.task_dependencies (
  id BIGSERIAL PRIMARY KEY,
  parent_task_id BIGINT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  child_task_id BIGINT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  what_needed TEXT NOT NULL,
  deadline_hint TEXT,
  status TEXT DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'provided', 'cancelled'])),
  created_by BIGINT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL
);

-- Conversations (from ad-intake-bot schema)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id TEXT NOT NULL,
  telegram_chat_id TEXT NOT NULL,
  history JSONB DEFAULT '[]',
  files JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active' CHECK (status = ANY (ARRAY['active', 'completed', 'cancelled'])),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  lang TEXT,
  metadata JSONB DEFAULT '{}',
  last_user_message_at TIMESTAMPTZ
);

-- Orders (from ad-intake-bot schema)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  telegram_user_id TEXT,
  telegram_chat_id TEXT,
  json_data JSONB NOT NULL,
  service_type TEXT,
  description TEXT,
  size TEXT,
  quantity TEXT,
  deadline TEXT,
  budget TEXT,
  contact TEXT,
  notes TEXT,
  files JSONB DEFAULT '[]',
  status TEXT DEFAULT 'new' CHECK (status = ANY (ARRAY['new', 'in_progress', 'done', 'rejected'])),
  created_at TIMESTAMPTZ DEFAULT now(),
  lang TEXT
);

-- Leads (from ad-intake-bot schema)
CREATE TABLE IF NOT EXISTS public.leads (
  id BIGSERIAL PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  telegram_chat_id BIGINT NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status = ANY (ARRAY['new', 'in_progress', 'closed', 'rejected'])),
  lead_score INT DEFAULT 50 CHECK (lead_score >= 0 AND lead_score <= 100),
  assigned_to BIGINT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Knowledge Base (from ad-intake-bot schema)
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC,
  description TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_by_chat_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== Enable RLS on all tables =====
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.normative_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.normative_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raci ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specification_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spec_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transmittals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transmittal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_meeting_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- ===== Create indexes =====
CREATE UNIQUE INDEX IF NOT EXISTS drawings_project_code_uq ON public.drawings(project_id, code);
CREATE INDEX IF NOT EXISTS drawings_project_idx ON public.drawings(project_id);
CREATE INDEX IF NOT EXISTS drawings_status_idx ON public.drawings(status);
CREATE INDEX IF NOT EXISTS revisions_project_idx ON public.revisions(project_id);
CREATE INDEX IF NOT EXISTS revisions_drawing_idx ON public.revisions(drawing_id);
CREATE INDEX IF NOT EXISTS reviews_project_idx ON public.reviews(project_id);
CREATE INDEX IF NOT EXISTS reviews_drawing_idx ON public.reviews(drawing_id);
CREATE UNIQUE INDEX IF NOT EXISTS transmittals_project_number_uq ON public.transmittals(project_id, number);
CREATE INDEX IF NOT EXISTS transmittals_project_idx ON public.transmittals(project_id);
CREATE INDEX IF NOT EXISTS transmittal_items_transmittal_idx ON public.transmittal_items(transmittal_id);
CREATE INDEX IF NOT EXISTS transmittal_items_drawing_idx ON public.transmittal_items(drawing_id);
CREATE INDEX IF NOT EXISTS transmittal_items_revision_idx ON public.transmittal_items(revision_id);
CREATE INDEX IF NOT EXISTS normative_chunks_embedding_idx ON public.normative_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS reviews_project_status_idx ON public.reviews (project_id, status);
CREATE INDEX IF NOT EXISTS transmittals_project_status_idx ON public.transmittals (project_id, status);
CREATE INDEX IF NOT EXISTS revisions_drawing_created_idx ON public.revisions (drawing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sticky_routing_sessions_user_id ON public.sticky_routing_sessions(user_id);
CREATE INDEX IF NOT EXISTS sticky_routing_sessions_expires_at ON public.sticky_routing_sessions(expires_at);
