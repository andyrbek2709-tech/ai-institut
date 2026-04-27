create table if not exists transmittals (
  id uuid primary key default gen_random_uuid(),
  project_id bigint not null references projects(id) on delete cascade,
  number text not null,
  status text default 'draft',
  issued_by bigint references app_users(id) on delete set null,
  recipient text,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists transmittals_project_number_uq
  on transmittals(project_id, number);

create index if not exists transmittals_project_idx
  on transmittals(project_id);

alter table transmittals enable row level security;

drop policy if exists "Authenticated users can read transmittals" on transmittals;
create policy "Authenticated users can read transmittals"
  on transmittals for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can mutate transmittals" on transmittals;
create policy "Authenticated users can mutate transmittals"
  on transmittals for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
