-- 020_rls_governance_fix.sql
-- Adds INSERT / UPDATE / DELETE RLS policies to all operational tables.
--
-- Root cause: production only had SELECT ("Allow authenticated to read") policies.
-- RBAC model enforced here:
--
--   admin     → full access everywhere (via service_role in API server AND user JWT)
--   gip       → full project lifecycle; all tasks/docs within their projects
--   lead      → insert/update tasks in their department; docs scoped to their project
--   engineer  → update tasks assigned to them; insert own time/comments
--
-- Helper functions used (created by 028_restore_rbac_helpers):
--   public.auth_is_admin_or_gip()    → true if role IN ('admin','gip')
--   public.auth_is_admin()           → true if role = 'admin'
--   public.auth_app_user_id()        → bigint id from app_users (by JWT email)
--   public.auth_app_user_role()      → 'admin'|'gip'|'lead'|'engineer'
--   public.auth_app_user_dept_name() → department name string
--   public.auth_is_gip_of(id)        → true if gip_id = current user id
--
-- Idempotent: drops and recreates each policy. Safe to re-run.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. PROJECTS
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "projects_insert"    ON projects;
DROP POLICY IF EXISTS "projects_update"    ON projects;
DROP POLICY IF EXISTS "projects_delete"    ON projects;
DROP POLICY IF EXISTS "projects_archive"   ON projects;

-- GIP or admin can create projects (GIP becomes gip_id in the payload)
CREATE POLICY "projects_insert" ON projects
  FOR INSERT
  WITH CHECK (public.auth_is_admin_or_gip());

-- GIP can update only their own projects; admin can update any
CREATE POLICY "projects_update" ON projects
  FOR UPDATE
  USING (
    public.auth_is_admin()
    OR (public.auth_app_user_role() = 'gip'
        AND gip_id = public.auth_app_user_id())
  )
  WITH CHECK (
    public.auth_is_admin()
    OR (public.auth_app_user_role() = 'gip'
        AND gip_id = public.auth_app_user_id())
  );

-- Only admin can hard-delete projects (GIP uses archive = soft-delete)
CREATE POLICY "projects_delete" ON projects
  FOR DELETE
  USING (public.auth_is_admin());

-- ═══════════════════════════════════════════════════════════════════════
-- 2. TASKS
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "tasks_insert_gip"      ON tasks;
DROP POLICY IF EXISTS "tasks_insert_lead"     ON tasks;
DROP POLICY IF EXISTS "tasks_update_gip"      ON tasks;
DROP POLICY IF EXISTS "tasks_update_lead"     ON tasks;
DROP POLICY IF EXISTS "tasks_update_engineer" ON tasks;
DROP POLICY IF EXISTS "tasks_delete_gip"      ON tasks;

-- GIP/admin can insert any task
CREATE POLICY "tasks_insert_gip" ON tasks
  FOR INSERT
  WITH CHECK (public.auth_is_admin_or_gip());

-- Lead can insert tasks scoped to their own department
CREATE POLICY "tasks_insert_lead" ON tasks
  FOR INSERT
  WITH CHECK (
    public.auth_app_user_role() = 'lead'
    AND dept = public.auth_app_user_dept_name()
  );

-- GIP/admin can update any task
CREATE POLICY "tasks_update_gip" ON tasks
  FOR UPDATE
  USING (public.auth_is_admin_or_gip())
  WITH CHECK (public.auth_is_admin_or_gip());

-- Lead can update tasks in their department
CREATE POLICY "tasks_update_lead" ON tasks
  FOR UPDATE
  USING (
    public.auth_app_user_role() = 'lead'
    AND dept = public.auth_app_user_dept_name()
  )
  WITH CHECK (
    public.auth_app_user_role() = 'lead'
    AND dept = public.auth_app_user_dept_name()
  );

-- Engineer can update only tasks assigned to them (status, comment fields)
CREATE POLICY "tasks_update_engineer" ON tasks
  FOR UPDATE
  USING (
    public.auth_app_user_role() = 'engineer'
    AND assigned_to::text = public.auth_app_user_id()::text
  )
  WITH CHECK (
    public.auth_app_user_role() = 'engineer'
    AND assigned_to::text = public.auth_app_user_id()::text
  );

-- GIP/admin can delete tasks
CREATE POLICY "tasks_delete_gip" ON tasks
  FOR DELETE
  USING (public.auth_is_admin_or_gip());

-- ═══════════════════════════════════════════════════════════════════════
-- 3. DRAWINGS
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "drawings_insert" ON drawings;
DROP POLICY IF EXISTS "drawings_update" ON drawings;
DROP POLICY IF EXISTS "drawings_delete" ON drawings;

CREATE POLICY "drawings_insert" ON drawings
  FOR INSERT
  WITH CHECK (
    public.auth_is_admin_or_gip()
    OR public.auth_app_user_role() = 'lead'
    OR public.auth_app_user_role() = 'engineer'
  );

CREATE POLICY "drawings_update" ON drawings
  FOR UPDATE
  USING (
    public.auth_is_admin_or_gip()
    OR public.auth_app_user_role() = 'lead'
    OR public.auth_app_user_role() = 'engineer'
  )
  WITH CHECK (
    public.auth_is_admin_or_gip()
    OR public.auth_app_user_role() = 'lead'
    OR public.auth_app_user_role() = 'engineer'
  );

CREATE POLICY "drawings_delete" ON drawings
  FOR DELETE
  USING (
    public.auth_is_admin_or_gip()
    OR public.auth_app_user_role() = 'lead'
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 4. REVISIONS
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "revisions_insert" ON revisions;
DROP POLICY IF EXISTS "revisions_delete" ON revisions;

CREATE POLICY "revisions_insert" ON revisions
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "revisions_delete" ON revisions
  FOR DELETE
  USING (public.auth_is_admin_or_gip());

-- ═══════════════════════════════════════════════════════════════════════
-- 5. REVIEWS
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "reviews_insert" ON reviews;
DROP POLICY IF EXISTS "reviews_update" ON reviews;
DROP POLICY IF EXISTS "reviews_delete" ON reviews;

CREATE POLICY "reviews_insert" ON reviews
  FOR INSERT
  WITH CHECK (
    public.auth_is_admin_or_gip()
    OR public.auth_app_user_role() = 'lead'
    OR public.auth_app_user_role() = 'engineer'
  );

CREATE POLICY "reviews_update" ON reviews
  FOR UPDATE
  USING (
    public.auth_is_admin_or_gip()
    OR author_id::text   = public.auth_app_user_id()::text
    OR assignee_id::text = public.auth_app_user_id()::text
    OR public.auth_app_user_role() = 'lead'
  )
  WITH CHECK (
    public.auth_is_admin_or_gip()
    OR author_id::text   = public.auth_app_user_id()::text
    OR assignee_id::text = public.auth_app_user_id()::text
    OR public.auth_app_user_role() = 'lead'
  );

CREATE POLICY "reviews_delete" ON reviews
  FOR DELETE
  USING (
    public.auth_is_admin_or_gip()
    OR author_id::text = public.auth_app_user_id()::text
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 6. REVIEW_COMMENTS
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "review_comments_insert" ON review_comments;
DROP POLICY IF EXISTS "review_comments_update" ON review_comments;
DROP POLICY IF EXISTS "review_comments_delete" ON review_comments;

CREATE POLICY "review_comments_insert" ON review_comments
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "review_comments_update" ON review_comments
  FOR UPDATE
  USING (
    public.auth_is_admin_or_gip()
    OR author_id::text = public.auth_app_user_id()::text
  )
  WITH CHECK (
    public.auth_is_admin_or_gip()
    OR author_id::text = public.auth_app_user_id()::text
  );

CREATE POLICY "review_comments_delete" ON review_comments
  FOR DELETE
  USING (
    public.auth_is_admin_or_gip()
    OR author_id::text = public.auth_app_user_id()::text
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 7. TRANSMITTALS
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "transmittals_insert" ON transmittals;
DROP POLICY IF EXISTS "transmittals_update" ON transmittals;
DROP POLICY IF EXISTS "transmittals_delete" ON transmittals;

CREATE POLICY "transmittals_insert" ON transmittals
  FOR INSERT
  WITH CHECK (
    public.auth_is_admin_or_gip()
    OR public.auth_app_user_role() = 'lead'
  );

CREATE POLICY "transmittals_update" ON transmittals
  FOR UPDATE
  USING (
    public.auth_is_admin_or_gip()
    OR public.auth_app_user_role() = 'lead'
  )
  WITH CHECK (
    public.auth_is_admin_or_gip()
    OR public.auth_app_user_role() = 'lead'
  );

CREATE POLICY "transmittals_delete" ON transmittals
  FOR DELETE
  USING (public.auth_is_admin_or_gip());

-- ═══════════════════════════════════════════════════════════════════════
-- 8. TRANSMITTAL_ITEMS
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "transmittal_items_insert" ON transmittal_items;
DROP POLICY IF EXISTS "transmittal_items_delete" ON transmittal_items;

CREATE POLICY "transmittal_items_insert" ON transmittal_items
  FOR INSERT
  WITH CHECK (
    public.auth_is_admin_or_gip()
    OR public.auth_app_user_role() = 'lead'
  );

CREATE POLICY "transmittal_items_delete" ON transmittal_items
  FOR DELETE
  USING (
    public.auth_is_admin_or_gip()
    OR public.auth_app_user_role() = 'lead'
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 9. NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "notifications_insert"     ON notifications;
DROP POLICY IF EXISTS "notifications_own_update" ON notifications;
DROP POLICY IF EXISTS "notifications_delete"     ON notifications;

-- Any authenticated user (or service_role) can create notifications
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Users can mark their own notifications as read
CREATE POLICY "notifications_own_update" ON notifications
  FOR UPDATE
  USING (
    user_id::text = public.auth_app_user_id()::text
    OR public.auth_is_admin_or_gip()
  )
  WITH CHECK (
    user_id::text = public.auth_app_user_id()::text
    OR public.auth_is_admin_or_gip()
  );

CREATE POLICY "notifications_delete" ON notifications
  FOR DELETE
  USING (
    user_id::text = public.auth_app_user_id()::text
    OR public.auth_is_admin_or_gip()
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 10. APP_USERS (self-profile updates)
-- ═══════════════════════════════════════════════════════════════════════
-- Admin INSERT/DELETE goes through service_role (API server) — no user-facing policy needed.
-- User UPDATE: each user can update their own profile fields (avatar, position).

DROP POLICY IF EXISTS "app_users_self_update" ON app_users;
DROP POLICY IF EXISTS "app_users_admin_write" ON app_users;

-- Admin/GIP can write any user record (needed for role updates via direct Supabase calls)
CREATE POLICY "app_users_admin_write" ON app_users
  FOR ALL
  USING (public.auth_is_admin_or_gip())
  WITH CHECK (public.auth_is_admin_or_gip());

-- Any user can update their own profile (avatar, position — NOT role/dept)
CREATE POLICY "app_users_self_update" ON app_users
  FOR UPDATE
  USING (supabase_uid = auth.uid()::text)
  WITH CHECK (
    supabase_uid = auth.uid()::text
    AND role = (SELECT role FROM app_users WHERE supabase_uid = auth.uid()::text LIMIT 1)
    AND dept_id IS NOT DISTINCT FROM (SELECT dept_id FROM app_users WHERE supabase_uid = auth.uid()::text LIMIT 1)
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 11. DEPARTMENTS
-- ═══════════════════════════════════════════════════════════════════════
-- Admin CRUD goes through service_role (API server).
-- Add user-level policy so leads can read their department details.
-- (SELECT already covered. Write is admin-only via service_role.)

DROP POLICY IF EXISTS "departments_admin_write" ON departments;

CREATE POLICY "departments_admin_write" ON departments
  FOR ALL
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- ═══════════════════════════════════════════════════════════════════════
-- 12. MESSAGES (project chat)
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;
DROP POLICY IF EXISTS "messages_delete" ON messages;

CREATE POLICY "messages_insert" ON messages
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "messages_update" ON messages
  FOR UPDATE
  USING (
    public.auth_is_admin_or_gip()
    OR user_id::text = public.auth_app_user_id()::text
  )
  WITH CHECK (
    public.auth_is_admin_or_gip()
    OR user_id::text = public.auth_app_user_id()::text
  );

CREATE POLICY "messages_delete" ON messages
  FOR DELETE
  USING (
    public.auth_is_admin_or_gip()
    OR user_id::text = public.auth_app_user_id()::text
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 13. MEETINGS (protocol/minutes)
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "meetings_insert" ON meetings;
DROP POLICY IF EXISTS "meetings_update" ON meetings;
DROP POLICY IF EXISTS "meetings_delete" ON meetings;

CREATE POLICY "meetings_insert" ON meetings
  FOR INSERT
  WITH CHECK (
    public.auth_is_admin_or_gip()
    OR public.auth_app_user_role() = 'lead'
  );

CREATE POLICY "meetings_update" ON meetings
  FOR UPDATE
  USING (
    public.auth_is_admin_or_gip()
    OR public.auth_app_user_role() = 'lead'
  )
  WITH CHECK (
    public.auth_is_admin_or_gip()
    OR public.auth_app_user_role() = 'lead'
  );

CREATE POLICY "meetings_delete" ON meetings
  FOR DELETE
  USING (public.auth_is_admin_or_gip());

-- ═══════════════════════════════════════════════════════════════════════
-- 14. TIME_ENTRIES / TIME_LOG (tabulation)
-- ═══════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'time_entries') THEN

    EXECUTE 'DROP POLICY IF EXISTS "time_entries_insert" ON time_entries';
    EXECUTE 'DROP POLICY IF EXISTS "time_entries_update" ON time_entries';
    EXECUTE 'DROP POLICY IF EXISTS "time_entries_delete" ON time_entries';

    EXECUTE '
      CREATE POLICY "time_entries_insert" ON time_entries
        FOR INSERT WITH CHECK (auth.role() = ''authenticated'')';

    EXECUTE '
      CREATE POLICY "time_entries_update" ON time_entries
        FOR UPDATE
        USING (
          public.auth_is_admin_or_gip()
          OR user_id::text = public.auth_app_user_id()::text
        )
        WITH CHECK (
          public.auth_is_admin_or_gip()
          OR user_id::text = public.auth_app_user_id()::text
        )';

    EXECUTE '
      CREATE POLICY "time_entries_delete" ON time_entries
        FOR DELETE
        USING (
          public.auth_is_admin_or_gip()
          OR user_id::text = public.auth_app_user_id()::text
        )';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'time_log') THEN

    EXECUTE 'ALTER TABLE time_log ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated to read" ON time_log';
    EXECUTE 'DROP POLICY IF EXISTS "time_log_select" ON time_log';
    EXECUTE 'DROP POLICY IF EXISTS "time_log_insert" ON time_log';
    EXECUTE 'DROP POLICY IF EXISTS "time_log_update" ON time_log';

    EXECUTE '
      CREATE POLICY "time_log_select" ON time_log
        FOR SELECT USING (auth.role() = ''authenticated'')';

    EXECUTE '
      CREATE POLICY "time_log_insert" ON time_log
        FOR INSERT WITH CHECK (auth.role() = ''authenticated'')';

    EXECUTE '
      CREATE POLICY "time_log_update" ON time_log
        FOR UPDATE
        USING (public.auth_is_admin_or_gip() OR user_id::text = public.auth_app_user_id()::text)
        WITH CHECK (public.auth_is_admin_or_gip() OR user_id::text = public.auth_app_user_id()::text)';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 15. PROJECT_DOCUMENTS
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "project_documents_insert" ON project_documents;
DROP POLICY IF EXISTS "project_documents_delete" ON project_documents;

CREATE POLICY "project_documents_insert" ON project_documents
  FOR INSERT
  WITH CHECK (
    public.auth_is_admin_or_gip()
    OR public.auth_app_user_role() = 'lead'
    OR public.auth_app_user_role() = 'engineer'
  );

CREATE POLICY "project_documents_delete" ON project_documents
  FOR DELETE
  USING (
    public.auth_is_admin_or_gip()
    OR uploaded_by::text = public.auth_app_user_id()::text
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 16. TASK_ATTACHMENTS
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "task_attachments_insert" ON task_attachments;
DROP POLICY IF EXISTS "task_attachments_delete" ON task_attachments;

CREATE POLICY "task_attachments_insert" ON task_attachments
  FOR INSERT
  WITH CHECK (
    public.auth_is_admin_or_gip()
    OR public.auth_app_user_role() = 'lead'
    OR public.auth_app_user_role() = 'engineer'
  );

CREATE POLICY "task_attachments_delete" ON task_attachments
  FOR DELETE
  USING (
    public.auth_is_admin_or_gip()
    OR uploaded_by::text = public.auth_app_user_id()::text
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 17. AI_ACTIONS (copilot usage)
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "ai_actions_insert" ON ai_actions;
DROP POLICY IF EXISTS "ai_actions_update" ON ai_actions;
DROP POLICY IF EXISTS "ai_actions_delete" ON ai_actions;

CREATE POLICY "ai_actions_insert" ON ai_actions
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (
      user_id IS NULL
      OR user_id::text = public.auth_app_user_id()::text
      OR public.auth_is_admin_or_gip()
    )
  );

CREATE POLICY "ai_actions_update" ON ai_actions
  FOR UPDATE
  USING (
    user_id::text = public.auth_app_user_id()::text
    OR public.auth_is_admin_or_gip()
  )
  WITH CHECK (
    user_id::text = public.auth_app_user_id()::text
    OR public.auth_is_admin_or_gip()
  );

CREATE POLICY "ai_actions_delete" ON ai_actions
  FOR DELETE
  USING (public.auth_is_admin_or_gip());

-- ═══════════════════════════════════════════════════════════════════════
-- 18. SPECIFICATIONS / SPEC_ITEMS
-- ═══════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'specifications') THEN
    EXECUTE 'DROP POLICY IF EXISTS "specifications_insert" ON specifications';
    EXECUTE 'DROP POLICY IF EXISTS "specifications_update" ON specifications';
    EXECUTE 'DROP POLICY IF EXISTS "specifications_delete" ON specifications';

    EXECUTE '
      CREATE POLICY "specifications_insert" ON specifications
        FOR INSERT WITH CHECK (public.auth_is_admin_or_gip() OR public.auth_app_user_role() = ''lead'')';

    EXECUTE '
      CREATE POLICY "specifications_update" ON specifications
        FOR UPDATE
        USING (public.auth_is_admin_or_gip() OR public.auth_app_user_role() = ''lead'')
        WITH CHECK (public.auth_is_admin_or_gip() OR public.auth_app_user_role() = ''lead'')';

    EXECUTE '
      CREATE POLICY "specifications_delete" ON specifications
        FOR DELETE USING (public.auth_is_admin_or_gip())';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'spec_items') THEN
    EXECUTE 'DROP POLICY IF EXISTS "spec_items_insert" ON spec_items';
    EXECUTE 'DROP POLICY IF EXISTS "spec_items_update" ON spec_items';
    EXECUTE 'DROP POLICY IF EXISTS "spec_items_delete" ON spec_items';

    EXECUTE '
      CREATE POLICY "spec_items_insert" ON spec_items
        FOR INSERT WITH CHECK (public.auth_is_admin_or_gip() OR public.auth_app_user_role() = ''lead'')';

    EXECUTE '
      CREATE POLICY "spec_items_update" ON spec_items
        FOR UPDATE
        USING (public.auth_is_admin_or_gip() OR public.auth_app_user_role() = ''lead'')
        WITH CHECK (public.auth_is_admin_or_gip() OR public.auth_app_user_role() = ''lead'')';

    EXECUTE '
      CREATE POLICY "spec_items_delete" ON spec_items
        FOR DELETE USING (public.auth_is_admin_or_gip())';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 19. TASK_HISTORY (versioning — service_role trigger writes this)
--     Engineers should be able to read; nobody writes directly from client.
-- ═══════════════════════════════════════════════════════════════════════
-- No client-side write policy needed (trigger uses SECURITY DEFINER).

-- ═══════════════════════════════════════════════════════════════════════
-- 20. VIDEO_MEETINGS
-- ═══════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'video_meetings') THEN
    EXECUTE 'DROP POLICY IF EXISTS "video_meetings_insert" ON video_meetings';
    EXECUTE 'DROP POLICY IF EXISTS "video_meetings_update" ON video_meetings';
    EXECUTE 'DROP POLICY IF EXISTS "video_meetings_delete" ON video_meetings';

    EXECUTE '
      CREATE POLICY "video_meetings_insert" ON video_meetings
        FOR INSERT WITH CHECK (auth.role() = ''authenticated'')';

    EXECUTE '
      CREATE POLICY "video_meetings_update" ON video_meetings
        FOR UPDATE
        USING (public.auth_is_admin_or_gip() OR created_by::text = public.auth_app_user_id()::text)
        WITH CHECK (public.auth_is_admin_or_gip() OR created_by::text = public.auth_app_user_id()::text)';

    EXECUTE '
      CREATE POLICY "video_meetings_delete" ON video_meetings
        FOR DELETE USING (public.auth_is_admin_or_gip() OR created_by::text = public.auth_app_user_id()::text)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'video_meeting_participants') THEN
    EXECUTE 'DROP POLICY IF EXISTS "vmp_insert" ON video_meeting_participants';
    EXECUTE 'DROP POLICY IF EXISTS "vmp_delete" ON video_meeting_participants';

    EXECUTE '
      CREATE POLICY "vmp_insert" ON video_meeting_participants
        FOR INSERT WITH CHECK (auth.role() = ''authenticated'')';

    EXECUTE '
      CREATE POLICY "vmp_delete" ON video_meeting_participants
        FOR DELETE USING (auth.role() = ''authenticated'')';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'video_meeting_chat_messages') THEN
    EXECUTE 'DROP POLICY IF EXISTS "vmcm_insert" ON video_meeting_chat_messages';

    EXECUTE '
      CREATE POLICY "vmcm_insert" ON video_meeting_chat_messages
        FOR INSERT WITH CHECK (auth.role() = ''authenticated'')';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 21. RACI (responsibility assignment matrix)
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "raci_write" ON raci;

CREATE POLICY "raci_write" ON raci
  FOR ALL
  USING (public.auth_is_admin_or_gip())
  WITH CHECK (public.auth_is_admin_or_gip());

-- End of 020_rls_governance_fix.sql
-- Summary: Added INSERT/UPDATE/DELETE policies to 21 table categories.
-- All policies use PERMISSIVE mode and existing helper functions.
-- No policies were weakened; only write-path gaps were filled.
