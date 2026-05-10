-- =========================================================================
-- 028_project_assignments.sql
-- Задание на проектирование: хранение PDF + автопарсинг по разделам
-- =========================================================================

-- 1. Основная таблица заданий (bigint FK — под схему projects.id / app_users.id)
create table if not exists project_assignments (
  id            uuid primary key default gen_random_uuid(),
  project_id    bigint not null references projects(id) on delete cascade,
  version       int  not null default 1,
  is_current    boolean not null default true,
  file_name     text not null,
  file_url      text,           -- (резерв)
  storage_path  text,           -- bucket path: {project_id}/v{N}/{filename}
  full_text     text,           -- extracted plaintext для поиска/агента
  uploaded_by   bigint references app_users(id) on delete set null,
  uploaded_at   timestamptz not null default now(),
  notes         text
);

create index if not exists idx_pa_project_id on project_assignments(project_id);
create unique index if not exists idx_pa_project_current
  on project_assignments(project_id) where is_current = true;

-- 2. Разделы задания (автопарсинг по нумерованным заголовкам)
create table if not exists assignment_sections (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid not null references project_assignments(id) on delete cascade,
  section_number  int,
  section_title   text not null,
  section_text    text not null,
  discipline      text  -- 'ЭС'|'КИПиА'|'ООС'|'ПОС'|'Смета'|'ПБ'|'ПромБ'|'КР'|'ОПД'|'АКЗ'|null
);

create index if not exists idx_as_assignment_id on assignment_sections(assignment_id);
create index if not exists idx_as_discipline    on assignment_sections(discipline);

-- 3. RLS: читают все аутентифицированные; пишут только admin/ГИП
alter table project_assignments enable row level security;
alter table assignment_sections  enable row level security;

create policy "pa_select_auth" on project_assignments
  for select using (auth.role() = 'authenticated');
create policy "pa_insert_gip" on project_assignments
  for insert with check (public.auth_is_admin_or_gip());
create policy "pa_update_gip" on project_assignments
  for update using (public.auth_is_admin_or_gip());

create policy "as_select_auth" on assignment_sections
  for select using (auth.role() = 'authenticated');
create policy "as_insert_gip" on assignment_sections
  for insert with check (public.auth_is_admin_or_gip());
create policy "as_delete_gip" on assignment_sections
  for delete using (public.auth_is_admin_or_gip());

-- 4. Storage bucket (private)
insert into storage.buckets (id, name, public)
values ('project-assignments', 'project-assignments', false)
on conflict (id) do nothing;
