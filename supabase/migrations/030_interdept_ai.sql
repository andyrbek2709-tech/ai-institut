-- Migration 030: Interdept AI Integration (C1–C6)
-- C1: Stage 4b AI-summary on task_dependencies
-- C2: SLA timers on tasks
-- C3: Transmittals AI-diff
-- C4: Assignment AI-check on task_dependencies
-- C5: Revisions AI-diff
-- C6: Transmittals recipient_dept_id + reviews location

-- C1 + C4: task_dependencies new AI columns
ALTER TABLE public.task_dependencies
  ADD COLUMN IF NOT EXISTS attachment_url    TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary        TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_check          TEXT,
  ADD COLUMN IF NOT EXISTS ai_check_at       TIMESTAMPTZ;

-- C2: SLA fields on tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS awaiting_since    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_hours         SMALLINT DEFAULT 24;

-- C3: Transmittals AI-diff
ALTER TABLE public.transmittals
  ADD COLUMN IF NOT EXISTS ai_diff           TEXT,
  ADD COLUMN IF NOT EXISTS ai_diff_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prev_transmittal_id UUID REFERENCES public.transmittals(id) ON DELETE SET NULL;

-- C5: Revisions AI-diff
ALTER TABLE public.revisions
  ADD COLUMN IF NOT EXISTS ai_diff           TEXT,
  ADD COLUMN IF NOT EXISTS ai_diff_at        TIMESTAMPTZ;

-- C6: Transmittals recipient dept + reviews location
ALTER TABLE public.transmittals
  ADD COLUMN IF NOT EXISTS recipient_dept_id BIGINT REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS location          TEXT;

-- Trigger: set awaiting_since when assignment_status becomes pending_accept
CREATE OR REPLACE FUNCTION public.tasks_set_awaiting_since()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.assignment_status = 'pending_accept'
     AND (OLD.assignment_status IS DISTINCT FROM 'pending_accept')
     AND NEW.awaiting_since IS NULL
  THEN
    NEW.awaiting_since = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_awaiting_since ON public.tasks;
CREATE TRIGGER trg_tasks_awaiting_since
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_set_awaiting_since();

-- Also set awaiting_since on INSERT when already pending_accept
CREATE OR REPLACE FUNCTION public.tasks_set_awaiting_since_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.assignment_status = 'pending_accept' AND NEW.awaiting_since IS NULL THEN
    NEW.awaiting_since = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_awaiting_since_insert ON public.tasks;
CREATE TRIGGER trg_tasks_awaiting_since_insert
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_set_awaiting_since_insert();
