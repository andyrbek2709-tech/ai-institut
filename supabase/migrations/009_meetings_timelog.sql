-- Migration 009: Meetings (протоколы совещаний) + Time Entries (табель)

-- ── Meetings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meetings (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  meeting_date date,
  participants text,
  agenda      text,
  decisions   text,
  created_by  uuid,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meetings_project_id_idx ON meetings(project_id);
CREATE INDEX IF NOT EXISTS meetings_date_idx ON meetings(meeting_date DESC);

-- ── Time Entries ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_entries (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  task_id     uuid REFERENCES tasks(id) ON DELETE SET NULL,
  user_id     uuid,
  hours       numeric(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  date        date NOT NULL,
  note        text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS time_entries_project_id_idx ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS time_entries_user_id_idx ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS time_entries_date_idx ON time_entries(date DESC);
