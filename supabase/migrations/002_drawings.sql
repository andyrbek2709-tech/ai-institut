create table if not exists drawings (
  id uuid primary key default gen_random_uuid(),
  project_id bigint not null references projects(id) on delete cascade,
  code text not null,
  title text not null,
  discipline text,
  stage text default 'P',
  status text default 'draft',
  revision text default 'R0',
  file_url text,
  due_date date,
  created_by bigint references app_users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists drawings_project_code_uq
  on drawings(project_id, code);

create index if not exists drawings_project_idx
  on drawings(project_id);

create index if not exists drawings_status_idx
  on drawings(status);

alter table drawings enable row level security;

drop policy if exists "Authenticated users can read drawings" on drawings;
create policy "Authenticated users can read drawings"
  on drawings for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can mutate drawings" on drawings;
create policy "Authenticated users can mutate drawings"
  on drawings for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
