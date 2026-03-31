create table if not exists revisions (
  id uuid primary key default gen_random_uuid(),
  project_id bigint not null references projects(id) on delete cascade,
  drawing_id uuid not null references drawings(id) on delete cascade,
  from_revision text not null,
  to_revision text not null,
  issued_by bigint references app_users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists revisions_project_idx
  on revisions(project_id);

create index if not exists revisions_drawing_idx
  on revisions(drawing_id);

alter table revisions enable row level security;

drop policy if exists "Authenticated users can read revisions" on revisions;
create policy "Authenticated users can read revisions"
  on revisions for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can mutate revisions" on revisions;
create policy "Authenticated users can mutate revisions"
  on revisions for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
