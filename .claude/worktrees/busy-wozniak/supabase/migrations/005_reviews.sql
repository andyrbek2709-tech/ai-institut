create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  project_id bigint not null references projects(id) on delete cascade,
  drawing_id uuid references drawings(id) on delete set null,
  title text not null,
  severity text default 'major',
  status text default 'open',
  author_id bigint references app_users(id) on delete set null,
  assignee_id bigint references app_users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists reviews_project_idx
  on reviews(project_id);

create index if not exists reviews_drawing_idx
  on reviews(drawing_id);

alter table reviews enable row level security;

drop policy if exists "Authenticated users can read reviews" on reviews;
create policy "Authenticated users can read reviews"
  on reviews for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can mutate reviews" on reviews;
create policy "Authenticated users can mutate reviews"
  on reviews for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
