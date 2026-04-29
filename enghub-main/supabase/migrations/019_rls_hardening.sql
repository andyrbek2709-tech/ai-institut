-- 019_rls_hardening.sql — закрыть оставшиеся public-таблицы под RLS, ужесточить permissive-политики, поднять search_path и закрыть anon на security-definer auth-helpers.
-- ПРИМЕНЕНО на prod через Supabase MCP 2026-04-29.
-- Безопасно: фронт ещё ходит под service_role (BYPASSRLS) — изменения вступают в силу после ротации ключа.

-- 1. Включить RLS на оставшихся таблицах
alter table public.meetings        enable row level security;
alter table public.time_entries    enable row level security;
alter table public.task_templates  enable row level security;
alter table public.review_comments enable row level security;

-- 2. meetings (legacy, 0 строк): доступ только по проекту
drop policy if exists "meetings_select" on public.meetings;
create policy "meetings_select" on public.meetings
  for select to authenticated
  using (auth_can_see_project(project_id));
drop policy if exists "meetings_write" on public.meetings;
create policy "meetings_write" on public.meetings
  for all to authenticated
  using (auth_is_admin() or auth_is_gip_of(project_id) or created_by = auth_app_user_id())
  with check (auth_is_admin() or auth_is_gip_of(project_id) or created_by = auth_app_user_id());

-- 3. time_entries: own + admin/gip + lead-видимый-проект
drop policy if exists "time_entries_select" on public.time_entries;
create policy "time_entries_select" on public.time_entries
  for select to authenticated
  using (auth_is_admin_or_gip() or user_id = auth_app_user_id() or
         (auth_app_user_role() = 'lead' and auth_can_see_project(project_id)));
drop policy if exists "time_entries_write" on public.time_entries;
create policy "time_entries_write" on public.time_entries
  for all to authenticated
  using (auth_is_admin() or user_id = auth_app_user_id())
  with check (auth_is_admin() or user_id = auth_app_user_id());

-- 4. task_templates: read для всех auth, write только admin/gip
drop policy if exists "task_templates_read" on public.task_templates;
create policy "task_templates_read" on public.task_templates
  for select to authenticated using (true);
drop policy if exists "task_templates_write" on public.task_templates;
create policy "task_templates_write" on public.task_templates
  for all to authenticated using (auth_is_admin_or_gip()) with check (auth_is_admin_or_gip());

-- 5. review_comments: SCHEMA MISMATCH — review_comments.review_id bigint vs reviews.id uuid.
--    Locked admin/gip-only до отдельного фикса схемы.
drop policy if exists "review_comments_select" on public.review_comments;
drop policy if exists "review_comments_insert" on public.review_comments;
drop policy if exists "review_comments_update" on public.review_comments;
drop policy if exists "review_comments_delete" on public.review_comments;
drop policy if exists "review_comments_admin_only" on public.review_comments;
create policy "review_comments_admin_only" on public.review_comments
  for all to authenticated
  using (auth_is_admin_or_gip())
  with check (auth_is_admin_or_gip());

-- 6. Удалить permissive легаси-политики (есть строгие ai_actions_select / ai_actions_write)
drop policy if exists "Enable insert for all users" on public.ai_actions;
drop policy if exists "Enable read access for all users" on public.ai_actions;
drop policy if exists "Enable update for all users" on public.ai_actions;

-- 7. activity_log_insert: ограничить доступом к проекту (раньше with_check = true)
drop policy if exists "activity_log_insert" on public.activity_log;
create policy "activity_log_insert" on public.activity_log
  for insert to authenticated
  with check (project_id is null or user_can_access_project(project_id));

-- 8. raci: 0 строк, заменили raci_all (qual=true) на admin/gip-only
drop policy if exists "raci_all" on public.raci;
drop policy if exists "raci_select" on public.raci;
create policy "raci_select" on public.raci for select to authenticated using (auth_is_admin_or_gip());
drop policy if exists "raci_write" on public.raci;
create policy "raci_write" on public.raci for all to authenticated using (auth_is_admin_or_gip()) with check (auth_is_admin_or_gip());

-- 9. Зафиксировать search_path на функциях (защита от schema-hijack)
alter function public.user_can_access_project(bigint)        set search_path = public;
alter function public.current_app_user_id()                  set search_path = public;
alter function public.log_task_change()                      set search_path = public;
alter function public.video_meetings_touch_updated_at()      set search_path = public;
alter function public.search_normative(vector, integer)      set search_path = public;
alter function public.log_attachment_upload()                set search_path = public;
alter function public.log_document_upload()                  set search_path = public;
alter function public.log_task_changes()                     set search_path = public;
alter function public.set_specifications_updated_at()        set search_path = public;

-- 10. Снять execute с anon на SECURITY DEFINER auth-helpers
revoke execute on function public.auth_app_user_dept_id()                from anon;
revoke execute on function public.auth_app_user_dept_name()              from anon;
revoke execute on function public.auth_app_user_email()                  from anon;
revoke execute on function public.auth_app_user_id()                     from anon;
revoke execute on function public.auth_app_user_role()                   from anon;
revoke execute on function public.auth_can_see_project(bigint)           from anon;
revoke execute on function public.auth_is_admin()                        from anon;
revoke execute on function public.auth_is_admin_or_gip()                 from anon;
revoke execute on function public.auth_is_gip_of(bigint)                 from anon;
revoke execute on function public.current_app_user_id()                  from anon;
revoke execute on function public.is_meeting_participant(uuid)           from anon;
revoke execute on function public.user_can_access_project(bigint)        from anon;

-- 11. project_storage_stats: пересоздать как security_invoker (вынесено в 019b_project_storage_stats_invoker для чистого commit-graph)
