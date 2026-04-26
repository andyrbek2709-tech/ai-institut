-- Migration 018: Видеовстречи на LiveKit Cloud (порт из проекта Институт PRO).
-- ВАЖНО: имена таблиц с префиксом video_*, чтобы не конфликтовать с существующей
-- таблицей `meetings` (миграция 009 — это ПРОТОКОЛЫ совещаний, не видео).
--
-- Схема:
--   video_meetings              — сама встреча (room) с метаданными
--   video_meeting_participants  — кто приглашён / зашёл / вышел
--   video_meeting_chat_messages — внутричат во время встречи
--
-- RLS — в духе 015_role_aware_rls: admin/gip видят всё, организатор может править,
-- участники видят свою встречу. Helper-функции (auth_app_user_*) уже определены в 015.
-- Идемпотентно: drop+create, безопасно перезапускать.

-- 1. video_meetings --------------------------------------------------------

CREATE TABLE IF NOT EXISTS video_meetings (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id    bigint,                                  -- может быть NULL: «личная» встреча без проекта
  title         text NOT NULL DEFAULT 'Видеовстреча',
  description   text,
  scheduled_at  timestamptz,                             -- когда планировалась
  started_at    timestamptz,                             -- когда фактически открылась комната
  ended_at      timestamptz,                             -- когда закончилась (NULL = идёт)
  created_by    bigint NOT NULL,                         -- app_users.id организатора
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS video_meetings_project_id_idx  ON video_meetings(project_id);
CREATE INDEX IF NOT EXISTS video_meetings_created_by_idx  ON video_meetings(created_by);
CREATE INDEX IF NOT EXISTS video_meetings_active_idx      ON video_meetings(ended_at) WHERE ended_at IS NULL;

-- 2. video_meeting_participants -------------------------------------------

CREATE TABLE IF NOT EXISTS video_meeting_participants (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id  uuid NOT NULL REFERENCES video_meetings(id) ON DELETE CASCADE,
  user_id     bigint NOT NULL,                           -- app_users.id
  role        text NOT NULL DEFAULT 'participant',       -- 'host' | 'participant' | 'guest'
  invited_at  timestamptz DEFAULT now(),
  joined_at   timestamptz,                               -- последний раз вошёл
  left_at     timestamptz,                               -- последний раз вышел
  CONSTRAINT  video_meeting_participants_uniq UNIQUE (meeting_id, user_id)
);

CREATE INDEX IF NOT EXISTS vmp_meeting_id_idx ON video_meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS vmp_user_id_idx    ON video_meeting_participants(user_id);

-- 3. video_meeting_chat_messages ------------------------------------------

CREATE TABLE IF NOT EXISTS video_meeting_chat_messages (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id  uuid NOT NULL REFERENCES video_meetings(id) ON DELETE CASCADE,
  user_id     bigint NOT NULL,                           -- app_users.id (автор)
  user_name   text,                                      -- кэшированное имя на момент отправки
  message     text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vmcm_meeting_id_idx  ON video_meeting_chat_messages(meeting_id);
CREATE INDEX IF NOT EXISTS vmcm_created_at_idx  ON video_meeting_chat_messages(created_at);

-- 4. updated_at trigger для video_meetings --------------------------------

CREATE OR REPLACE FUNCTION public.video_meetings_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS video_meetings_touch_updated_at ON video_meetings;
CREATE TRIGGER video_meetings_touch_updated_at
BEFORE UPDATE ON video_meetings
FOR EACH ROW EXECUTE FUNCTION public.video_meetings_touch_updated_at();

-- 5. RLS -------------------------------------------------------------------

ALTER TABLE video_meetings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_meeting_participants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_meeting_chat_messages ENABLE ROW LEVEL SECURITY;

-- 5.1 video_meetings -------------------------------------------------------
DROP POLICY IF EXISTS "video_meetings_select" ON video_meetings;
DROP POLICY IF EXISTS "video_meetings_insert" ON video_meetings;
DROP POLICY IF EXISTS "video_meetings_update" ON video_meetings;
DROP POLICY IF EXISTS "video_meetings_delete" ON video_meetings;

-- Видят: admin/gip; организатор; любой участник, добавленный в video_meeting_participants.
CREATE POLICY "video_meetings_select" ON video_meetings
  FOR SELECT USING (
    public.auth_is_admin_or_gip()
    OR created_by = public.auth_app_user_id()
    OR EXISTS (
      SELECT 1 FROM video_meeting_participants p
       WHERE p.meeting_id = video_meetings.id
         AND p.user_id = public.auth_app_user_id()
    )
  );

-- Создавать может любой авторизованный, при условии created_by = собственный id.
CREATE POLICY "video_meetings_insert" ON video_meetings
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND (
      public.auth_is_admin_or_gip()
      OR created_by = public.auth_app_user_id()
    )
  );

-- Изменять: admin/gip или организатор.
CREATE POLICY "video_meetings_update" ON video_meetings
  FOR UPDATE USING (
    public.auth_is_admin_or_gip()
    OR created_by = public.auth_app_user_id()
  ) WITH CHECK (
    public.auth_is_admin_or_gip()
    OR created_by = public.auth_app_user_id()
  );

-- Удалять: только admin/gip.
CREATE POLICY "video_meetings_delete" ON video_meetings
  FOR DELETE USING (public.auth_is_admin_or_gip());

-- 5.2 video_meeting_participants ------------------------------------------
DROP POLICY IF EXISTS "vmp_select" ON video_meeting_participants;
DROP POLICY IF EXISTS "vmp_insert" ON video_meeting_participants;
DROP POLICY IF EXISTS "vmp_update" ON video_meeting_participants;
DROP POLICY IF EXISTS "vmp_delete" ON video_meeting_participants;

-- Видят список участников: admin/gip; организатор встречи; сами участники этой встречи.
CREATE POLICY "vmp_select" ON video_meeting_participants
  FOR SELECT USING (
    public.auth_is_admin_or_gip()
    OR user_id = public.auth_app_user_id()
    OR EXISTS (
      SELECT 1 FROM video_meetings m
       WHERE m.id = video_meeting_participants.meeting_id
         AND (
           m.created_by = public.auth_app_user_id()
           OR EXISTS (
             SELECT 1 FROM video_meeting_participants p2
              WHERE p2.meeting_id = m.id
                AND p2.user_id = public.auth_app_user_id()
           )
         )
    )
  );

-- Приглашать (insert): admin/gip или организатор встречи; либо сам пользователь
-- добавляет себя (self-join) — на тот случай если встреча открыта для всех.
CREATE POLICY "vmp_insert" ON video_meeting_participants
  FOR INSERT WITH CHECK (
    public.auth_is_admin_or_gip()
    OR user_id = public.auth_app_user_id()
    OR EXISTS (
      SELECT 1 FROM video_meetings m
       WHERE m.id = video_meeting_participants.meeting_id
         AND m.created_by = public.auth_app_user_id()
    )
  );

-- Менять joined_at/left_at — может admin/gip, организатор, или сам пользователь.
CREATE POLICY "vmp_update" ON video_meeting_participants
  FOR UPDATE USING (
    public.auth_is_admin_or_gip()
    OR user_id = public.auth_app_user_id()
    OR EXISTS (
      SELECT 1 FROM video_meetings m
       WHERE m.id = video_meeting_participants.meeting_id
         AND m.created_by = public.auth_app_user_id()
    )
  ) WITH CHECK (
    public.auth_is_admin_or_gip()
    OR user_id = public.auth_app_user_id()
    OR EXISTS (
      SELECT 1 FROM video_meetings m
       WHERE m.id = video_meeting_participants.meeting_id
         AND m.created_by = public.auth_app_user_id()
    )
  );

-- Удалять (отозвать приглашение): admin/gip или организатор.
CREATE POLICY "vmp_delete" ON video_meeting_participants
  FOR DELETE USING (
    public.auth_is_admin_or_gip()
    OR EXISTS (
      SELECT 1 FROM video_meetings m
       WHERE m.id = video_meeting_participants.meeting_id
         AND m.created_by = public.auth_app_user_id()
    )
  );

-- 5.3 video_meeting_chat_messages -----------------------------------------
DROP POLICY IF EXISTS "vmcm_select" ON video_meeting_chat_messages;
DROP POLICY IF EXISTS "vmcm_insert" ON video_meeting_chat_messages;
DROP POLICY IF EXISTS "vmcm_delete" ON video_meeting_chat_messages;

-- Видят сообщения только участники встречи (или admin/gip).
CREATE POLICY "vmcm_select" ON video_meeting_chat_messages
  FOR SELECT USING (
    public.auth_is_admin_or_gip()
    OR EXISTS (
      SELECT 1 FROM video_meetings m
       WHERE m.id = video_meeting_chat_messages.meeting_id
         AND (
           m.created_by = public.auth_app_user_id()
           OR EXISTS (
             SELECT 1 FROM video_meeting_participants p
              WHERE p.meeting_id = m.id
                AND p.user_id = public.auth_app_user_id()
           )
         )
    )
  );

-- Писать может только сам автор и только в встречу, где он участник.
CREATE POLICY "vmcm_insert" ON video_meeting_chat_messages
  FOR INSERT WITH CHECK (
    user_id = public.auth_app_user_id()
    AND (
      public.auth_is_admin_or_gip()
      OR EXISTS (
        SELECT 1 FROM video_meetings m
         WHERE m.id = video_meeting_chat_messages.meeting_id
           AND (
             m.created_by = public.auth_app_user_id()
             OR EXISTS (
               SELECT 1 FROM video_meeting_participants p
                WHERE p.meeting_id = m.id
                  AND p.user_id = public.auth_app_user_id()
             )
           )
      )
    )
  );

-- Удалять — только admin/gip или сам автор сообщения.
CREATE POLICY "vmcm_delete" ON video_meeting_chat_messages
  FOR DELETE USING (
    public.auth_is_admin_or_gip()
    OR user_id = public.auth_app_user_id()
  );
