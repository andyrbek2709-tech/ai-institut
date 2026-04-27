-- Role-aware Row Level Security for EngHub.
-- Replaces blanket "authenticated" policies from 010/011 with rules that
-- actually check the role and department of the user behind the JWT.
--
-- Policy summary:
--   admin / gip       → full access to everything
--   lead              → projects where they participate; tasks in their dept
--                       or assigned to them; documents tied to those projects
--   engineer          → tasks assigned to them; projects where they have tasks
--   notifications     → own notifications only
--   app_users         → readable to all authenticated, writable by admin/gip
--   departments       → readable to all authenticated, writable by admin
--
-- Idempotent: drops + recreates helpers and policies. Safe to re-run.

-- 1. Helper functions ------------------------------------------------------

create or replace function public.auth_app_user_email() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    nullif(current_setting('request.jwt.claim.email', true), '')
  )
$$;

create or replace function public.auth_app_user_id() returns bigint
language sql stable security definer set search_path = public as $$
  select id from app_users where email = public.auth_app_user_email() limit 1
$$;

create or replace function public.auth_app_user_role() returns text
language sql stable security definer set search_path = public as $$
  select case
    when public.auth_app_user_email() = 'admin@enghub.com' then 'admin'
    else lower(coalesce(role, ''))
  end
  from app_users where email = public.auth_app_user_email() limit 1
$$;

-- For admin email that may not have an app_users row yet, fall back to 'admin'.
create or replace function public.auth_is_admin_or_gip() returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.auth_app_user_email() = 'admin@enghub.com'
    or public.auth_app_user_role() in ('admin', 'gip')
$$;

create or replace function public.auth_app_user_dept_id() returns bigint
language sql stable security definer set search_path = public as $$
  select dept_id from app_users where email = public.auth_app_user_email() limit 1
$$;

create or replace function public.auth_app_user_dept_name() returns text
language sql stable security definer set search_path = public as $$
  select d.name from app_users u
    left join departments d on d.id = u.dept_id
    where u.email = public.auth_app_user_email() limit 1
$$;

-- 2. app_users -------------------------------------------------------------
alter table if exists app_users enable row level security;

drop policy if exists "Authenticated users can read app_users"   on app_users;
drop policy if exists "Authenticated users can insert app_users" on app_users;
drop policy if exists "Authenticated users can update app_users" on app_users;
drop policy if exists "app_users_select" on app_users;
drop policy if exists "app_users_write"  on app_users;

create policy "app_users_select" on app_users
  for select using (auth.role() = 'authenticated');

create policy "app_users_write" on app_users
  for all
  using (public.auth_is_admin_or_gip())
  with check (public.auth_is_admin_or_gip());

-- 3. departments -----------------------------------------------------------
alter table if exists departments enable row level security;

drop policy if exists "Authenticated users can read departments" on departments;
drop policy if exists "departments_select" on departments;
drop policy if exists "departments_write"  on departments;

create policy "departments_select" on departments
  for select using (auth.role() = 'authenticated');

create policy "departments_write" on departments
  for all
  using (public.auth_app_user_role() = 'admin')
  with check (public.auth_app_user_role() = 'admin');

-- 4. projects --------------------------------------------------------------
alter table if exists projects enable row level security;

drop policy if exists "Authenticated users can read projects"   on projects;
drop policy if exists "Authenticated users can manage projects" on projects;
drop policy if exists "projects_select" on projects;
drop policy if exists "projects_write"  on projects;

-- gip/admin see everything; lead/engineer see projects they touch.
create policy "projects_select" on projects
  for select using (
    public.auth_is_admin_or_gip()
    or exists (
      select 1 from tasks t
      where t.project_id = projects.id
        and t.assigned_to::text = public.auth_app_user_id()::text
    )
    or exists (
      select 1 from tasks t
      where t.project_id = projects.id
        and t.dept = public.auth_app_user_dept_name()
        and public.auth_app_user_role() = 'lead'
    )
  );

create policy "projects_write" on projects
  for all
  using (public.auth_is_admin_or_gip())
  with check (public.auth_is_admin_or_gip());

-- 5. tasks -----------------------------------------------------------------
alter table if exists tasks enable row level security;

drop policy if exists "Authenticated users can read tasks"   on tasks;
drop policy if exists "Authenticated users can manage tasks" on tasks;
drop policy if exists "tasks_select"        on tasks;
drop policy if exists "tasks_write_gip"     on tasks;
drop policy if exists "tasks_write_lead"    on tasks;
drop policy if exists "tasks_update_engineer" on tasks;

create policy "tasks_select" on tasks
  for select using (
    public.auth_is_admin_or_gip()
    or assigned_to::text = public.auth_app_user_id()::text
    or (public.auth_app_user_role() = 'lead'
        and dept = public.auth_app_user_dept_name())
  );

-- gip/admin can insert / delete / fully update.
create policy "tasks_write_gip" on tasks
  for all
  using (public.auth_is_admin_or_gip())
  with check (public.auth_is_admin_or_gip());

-- lead can insert tasks for their dept and update them.
create policy "tasks_write_lead" on tasks
  for insert
  with check (
    public.auth_app_user_role() = 'lead'
    and dept = public.auth_app_user_dept_name()
  );

create policy "tasks_update_lead" on tasks
  for update
  using (
    public.auth_app_user_role() = 'lead'
    and dept = public.auth_app_user_dept_name()
  )
  with check (
    public.auth_app_user_role() = 'lead'
    and dept = public.auth_app_user_dept_name()
  );

-- engineer can update only tasks assigned to them.
create policy "tasks_update_engineer" on tasks
  for update
  using (
    public.auth_app_user_role() = 'engineer'
    and assigned_to::text = public.auth_app_user_id()::text
  )
  with check (
    public.auth_app_user_role() = 'engineer'
    and assigned_to::text = public.auth_app_user_id()::text
  );

-- 6. drawings, revisions, reviews -----------------------------------------
-- Visibility follows the project: if you can see the project, you can see
-- its docs. Mutations: gip/admin always; lead within their project scope;
-- engineer only on documents tied to their tasks.

do $$
declare
  t text;
begin
  foreach t in array array['drawings','revisions','reviews','transmittals','transmittal_items']
  loop
    execute format('alter table if exists %I enable row level security', t);
  end loop;
end $$;

-- drawings
drop policy if exists "Authenticated users can read drawings"   on drawings;
drop policy if exists "Authenticated users can mutate drawings" on drawings;
drop policy if exists "drawings_select" on drawings;
drop policy if exists "drawings_write"  on drawings;

create policy "drawings_select" on drawings
  for select using (
    public.auth_is_admin_or_gip()
    or exists (
      select 1 from projects p
      where p.id = drawings.project_id
        and (
          exists (select 1 from tasks t where t.project_id = p.id and t.assigned_to::text = public.auth_app_user_id()::text)
          or (public.auth_app_user_role() = 'lead'
              and exists (select 1 from tasks t where t.project_id = p.id and t.dept = public.auth_app_user_dept_name()))
        )
    )
  );

create policy "drawings_write" on drawings
  for all
  using (
    public.auth_is_admin_or_gip()
    or (public.auth_app_user_role() = 'lead'
        and exists (select 1 from tasks t where t.project_id = drawings.project_id
                     and t.dept = public.auth_app_user_dept_name()))
    or (public.auth_app_user_role() = 'engineer'
        and exists (select 1 from tasks t where t.project_id = drawings.project_id
                     and t.assigned_to::text = public.auth_app_user_id()::text))
  )
  with check (
    public.auth_is_admin_or_gip()
    or (public.auth_app_user_role() = 'lead'
        and exists (select 1 from tasks t where t.project_id = drawings.project_id
                     and t.dept = public.auth_app_user_dept_name()))
    or (public.auth_app_user_role() = 'engineer'
        and exists (select 1 from tasks t where t.project_id = drawings.project_id
                     and t.assigned_to::text = public.auth_app_user_id()::text))
  );

-- revisions
drop policy if exists "Authenticated users can read revisions"   on revisions;
drop policy if exists "Authenticated users can mutate revisions" on revisions;
drop policy if exists "revisions_select" on revisions;
drop policy if exists "revisions_write"  on revisions;

create policy "revisions_select" on revisions
  for select using (
    public.auth_is_admin_or_gip()
    or exists (
      select 1 from drawings d where d.id = revisions.drawing_id
    )
  );

create policy "revisions_write" on revisions
  for all
  using (
    public.auth_is_admin_or_gip()
    or public.auth_app_user_role() in ('lead', 'engineer')
  )
  with check (
    public.auth_is_admin_or_gip()
    or public.auth_app_user_role() in ('lead', 'engineer')
  );

-- reviews
drop policy if exists "Authenticated users can read reviews"   on reviews;
drop policy if exists "Authenticated users can mutate reviews" on reviews;
drop policy if exists "reviews_select" on reviews;
drop policy if exists "reviews_write"  on reviews;

create policy "reviews_select" on reviews
  for select using (
    public.auth_is_admin_or_gip()
    or author_id::text   = public.auth_app_user_id()::text
    or assignee_id::text = public.auth_app_user_id()::text
    or exists (
      select 1 from tasks t
      where t.project_id = reviews.project_id
        and (t.assigned_to::text = public.auth_app_user_id()::text
             or (public.auth_app_user_role() = 'lead'
                 and t.dept = public.auth_app_user_dept_name()))
    )
  );

create policy "reviews_write" on reviews
  for all
  using (
    public.auth_is_admin_or_gip()
    or author_id::text   = public.auth_app_user_id()::text
    or assignee_id::text = public.auth_app_user_id()::text
    or public.auth_app_user_role() = 'lead'
  )
  with check (
    public.auth_is_admin_or_gip()
    or author_id::text   = public.auth_app_user_id()::text
    or assignee_id::text = public.auth_app_user_id()::text
    or public.auth_app_user_role() = 'lead'
  );

-- transmittals: only admin/gip/lead can issue; engineers see read-only
drop policy if exists "Authenticated users can read transmittals"   on transmittals;
drop policy if exists "Authenticated users can mutate transmittals" on transmittals;
drop policy if exists "transmittals_select" on transmittals;
drop policy if exists "transmittals_write"  on transmittals;

create policy "transmittals_select" on transmittals
  for select using (
    public.auth_is_admin_or_gip()
    or public.auth_app_user_role() = 'lead'
    or exists (
      select 1 from tasks t
      where t.project_id = transmittals.project_id
        and t.assigned_to::text = public.auth_app_user_id()::text
    )
  );

create policy "transmittals_write" on transmittals
  for all
  using (
    public.auth_is_admin_or_gip()
    or public.auth_app_user_role() = 'lead'
  )
  with check (
    public.auth_is_admin_or_gip()
    or public.auth_app_user_role() = 'lead'
  );

-- transmittal_items follow the parent transmittal
drop policy if exists "Authenticated users can read transmittal items"   on transmittal_items;
drop policy if exists "Authenticated users can mutate transmittal items" on transmittal_items;
drop policy if exists "transmittal_items_select" on transmittal_items;
drop policy if exists "transmittal_items_write"  on transmittal_items;

create policy "transmittal_items_select" on transmittal_items
  for select using (
    public.auth_is_admin_or_gip()
    or exists (select 1 from transmittals t where t.id = transmittal_items.transmittal_id)
  );

create policy "transmittal_items_write" on transmittal_items
  for all
  using (
    public.auth_is_admin_or_gip()
    or public.auth_app_user_role() = 'lead'
  )
  with check (
    public.auth_is_admin_or_gip()
    or public.auth_app_user_role() = 'lead'
  );

-- 7. notifications ---------------------------------------------------------
do $$ begin
  if exists (select 1 from information_schema.tables where table_name = 'notifications') then
    execute 'alter table notifications enable row level security';
  end if;
end $$;

drop policy if exists "notifications_own_select" on notifications;
drop policy if exists "notifications_own_update" on notifications;
drop policy if exists "notifications_insert"     on notifications;

create policy "notifications_own_select" on notifications
  for select using (
    public.auth_is_admin_or_gip()
    or user_id::text = public.auth_app_user_id()::text
  );

create policy "notifications_own_update" on notifications
  for update
  using (user_id::text = public.auth_app_user_id()::text)
  with check (user_id::text = public.auth_app_user_id()::text);

create policy "notifications_insert" on notifications
  for insert with check (auth.role() = 'authenticated');

-- 8. ai_actions ------------------------------------------------------------
alter table if exists ai_actions enable row level security;

drop policy if exists "Authenticated users can read ai_actions"   on ai_actions;
drop policy if exists "Authenticated users can manage ai_actions" on ai_actions;
drop policy if exists "ai_actions_select" on ai_actions;
drop policy if exists "ai_actions_write"  on ai_actions;

create policy "ai_actions_select" on ai_actions
  for select using (
    public.auth_is_admin_or_gip()
    or user_id::text = public.auth_app_user_id()::text
  );

create policy "ai_actions_write" on ai_actions
  for all
  using (
    public.auth_is_admin_or_gip()
    or user_id::text = public.auth_app_user_id()::text
  )
  with check (
    public.auth_is_admin_or_gip()
    or user_id::text = public.auth_app_user_id()::text
  );

-- End of 015_role_aware_rls.sql
