-- =========================================================================
-- T30 / T31 — Документы проекта + прикрепления к задачам + storage stats
-- Stage 2 EngHub. Идемпотентно. Безопасно для повторного запуска.
-- =========================================================================

create extension if not exists pgcrypto;

-- 1. project_documents -----------------------------------------------------
create table if not exists project_documents (
  id            uuid primary key default gen_random_uuid(),
  project_id    bigint not null references projects(id) on delete cascade,
  doc_type      text   not null check (doc_type in ('tz', 'addendum', 'other')),
  name          text   not null,
  storage_path  text   not null unique,
  mime_type     text,
  size_bytes    bigint not null,
  uploaded_by   bigint references app_users(id) on delete set null,
  uploaded_at   timestamptz not null default now()
);

create index if not exists idx_project_documents_project on project_documents(project_id);
create index if not exists idx_project_documents_type    on project_documents(doc_type);

alter table project_documents enable row level security;

drop policy if exists "project_documents_select" on project_documents;
create policy "project_documents_select" on project_documents
  for select using (
    public.auth_is_admin_or_gip()
    or exists (
      select 1 from tasks t
      where t.project_id = project_documents.project_id
        and t.assigned_to::text = public.auth_app_user_id()::text
    )
    or exists (
      select 1 from tasks t
      where t.project_id = project_documents.project_id
        and t.dept = public.auth_app_user_dept_name()
        and public.auth_app_user_role() = 'lead'
    )
  );

drop policy if exists "project_documents_insert" on project_documents;
create policy "project_documents_insert" on project_documents
  for insert with check (
    public.auth_is_admin_or_gip()
    or (
      public.auth_app_user_role() = 'lead'
      and exists (
        select 1 from tasks t
        where t.project_id = project_documents.project_id
          and t.dept = public.auth_app_user_dept_name()
      )
    )
    or (
      public.auth_app_user_role() = 'engineer'
      and exists (
        select 1 from tasks t
        where t.project_id = project_documents.project_id
          and t.assigned_to::text = public.auth_app_user_id()::text
      )
    )
  );

drop policy if exists "project_documents_delete" on project_documents;
create policy "project_documents_delete" on project_documents
  for delete using (
    public.auth_is_admin_or_gip()
    or uploaded_by::text = public.auth_app_user_id()::text
  );

-- 2. task_attachments ------------------------------------------------------
create table if not exists task_attachments (
  id            uuid primary key default gen_random_uuid(),
  task_id       bigint not null references tasks(id) on delete cascade,
  name          text   not null,
  storage_path  text   not null unique,
  mime_type     text,
  size_bytes    bigint not null,
  uploaded_by   bigint references app_users(id) on delete set null,
  uploaded_at   timestamptz not null default now()
);

create index if not exists idx_task_attachments_task on task_attachments(task_id);

alter table task_attachments enable row level security;

drop policy if exists "task_attachments_select" on task_attachments;
create policy "task_attachments_select" on task_attachments
  for select using (
    public.auth_is_admin_or_gip()
    or exists (
      select 1 from tasks t
      where t.id = task_attachments.task_id
        and (
          t.assigned_to::text = public.auth_app_user_id()::text
          or (public.auth_app_user_role() = 'lead'
              and t.dept = public.auth_app_user_dept_name())
        )
    )
  );

drop policy if exists "task_attachments_insert" on task_attachments;
create policy "task_attachments_insert" on task_attachments
  for insert with check (
    public.auth_is_admin_or_gip()
    or exists (
      select 1 from tasks t
      where t.id = task_attachments.task_id
        and (
          t.assigned_to::text = public.auth_app_user_id()::text
          or (public.auth_app_user_role() = 'lead'
              and t.dept = public.auth_app_user_dept_name())
        )
    )
  );

drop policy if exists "task_attachments_delete" on task_attachments;
create policy "task_attachments_delete" on task_attachments
  for delete using (
    public.auth_is_admin_or_gip()
    or uploaded_by::text = public.auth_app_user_id()::text
  );

-- 3. project_storage_stats VIEW -------------------------------------------
create or replace view project_storage_stats as
  with
    docs as (
      select project_id,
             count(*)::bigint                       as docs_count,
             coalesce(sum(size_bytes), 0)::bigint   as docs_bytes,
             max(uploaded_at)                       as last_doc_at
        from project_documents
       group by project_id
    ),
    atts as (
      select t.project_id,
             count(a.*)::bigint                     as att_count,
             coalesce(sum(a.size_bytes), 0)::bigint as att_bytes,
             max(a.uploaded_at)                     as last_att_at
        from task_attachments a
        join tasks t on t.id = a.task_id
       group by t.project_id
    )
  select p.id                                                            as project_id,
         p.name                                                          as project_name,
         p.code                                                          as project_code,
         coalesce(d.docs_count, 0) + coalesce(a.att_count, 0)            as files_count,
         coalesce(d.docs_bytes, 0) + coalesce(a.att_bytes, 0)            as total_bytes,
         coalesce(d.docs_count, 0)                                       as documents_count,
         coalesce(a.att_count, 0)                                        as attachments_count,
         coalesce(d.docs_bytes, 0)                                       as documents_bytes,
         coalesce(a.att_bytes, 0)                                        as attachments_bytes,
         greatest(coalesce(d.last_doc_at, 'epoch'::timestamptz),
                  coalesce(a.last_att_at, 'epoch'::timestamptz))         as last_upload_at
    from projects p
    left join docs d on d.project_id = p.id
    left join atts a on a.project_id = p.id;

-- =========================================================================
-- 4. Storage bucket — создать ВРУЧНУЮ через Supabase UI
-- =========================================================================
-- 1) Storage → Create bucket: name = "project-files", Public = OFF.
-- 2) Storage → Policies → "project-files" → New policy (см. SQL ниже).
-- 3) Структура путей:
--      project-files/{project_id}/tz|addendum|other/{timestamp}_{filename}
--      project-files/{project_id}/tasks/{task_id}/{timestamp}_{filename}
-- 4) Лимит на файл — 50 MB (валидация на фронте + bucket file_size_limit).
--
-- Bucket policies (SQL Editor):
--
-- create policy "project-files read for project members"
--   on storage.objects for select using (
--     bucket_id = 'project-files' and (
--       public.auth_is_admin_or_gip()
--       or exists (
--         select 1 from tasks t
--         where t.project_id::text = split_part(name, '/', 2)
--           and (
--             t.assigned_to::text = public.auth_app_user_id()::text
--             or (public.auth_app_user_role() = 'lead'
--                 and t.dept = public.auth_app_user_dept_name())
--           )
--       )
--     )
--   );
--
-- create policy "project-files insert for project members"
--   on storage.objects for insert with check (
--     bucket_id = 'project-files' and (
--       public.auth_is_admin_or_gip()
--       or exists (
--         select 1 from tasks t
--         where t.project_id::text = split_part(name, '/', 2)
--           and (
--             t.assigned_to::text = public.auth_app_user_id()::text
--             or (public.auth_app_user_role() = 'lead'
--                 and t.dept = public.auth_app_user_dept_name())
--           )
--       )
--     )
--   );
--
-- create policy "project-files delete for owner or admin"
--   on storage.objects for delete using (
--     bucket_id = 'project-files' and (
--       public.auth_is_admin_or_gip() or owner = auth.uid()
--     )
--   );
-- =========================================================================
