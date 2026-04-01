-- Migration 009: Meetings (протоколы совещаний) + Time Entries (табель)
-- Note: no REFERENCES constraints because projects table has composite PK

CREATE TABLE IF NOT EXISTS meetings (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id   bigint NOT NULL,
  title        text NOT NULL,
  meeting_date date,
  participants text,
  agenda       text,
  decisions    text,
  created_by   bigint,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meetings_project_id_idx ON meetings(project_id);
CREATE INDEX IF NOT EXISTS meetings_date_idx ON meetings(meeting_date DESC);

CREATE TABLE IF NOT EXISTS time_entries (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  bigint NOT NULL,
  task_id     bigint,
  user_id     bigint,
  hours       numeric(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  date        date NOT NULL,
  note        text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS time_entries_project_id_idx ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS time_entries_user_id_idx ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS time_entries_date_idx ON time_entries(date DESC);
