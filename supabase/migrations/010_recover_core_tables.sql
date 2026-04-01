-- Emergency recovery migration for production environments
-- where core engineering tables were not applied yet.
-- Safe/idempotent: only creates missing tables/indexes/policies.

create extension if not exists pgcrypto;

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

create unique index if not exists drawings_project_code_uq on drawings(project_id, code);
create index if not exists drawings_project_idx on drawings(project_id);
create index if not exists drawings_status_idx on drawings(status);

create table if not exists revisions (
  id uuid primary key default gen_random_uuid(),
  project_id bigint not null references projects(id) on delete cascade,
  drawing_id uuid not null references drawings(id) on delete cascade,
  from_revision text not null,
  to_revision text not null,
  issued_by bigint references app_users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists revisions_project_idx on revisions(project_id);
create index if not exists revisions_drawing_idx on revisions(drawing_id);

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

create index if not exists reviews_project_idx on reviews(project_id);
create index if not exists reviews_drawing_idx on reviews(drawing_id);

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

create unique index if not exists transmittals_project_number_uq on transmittals(project_id, number);
create index if not exists transmittals_project_idx on transmittals(project_id);

create table if not exists transmittal_items (
  id uuid primary key default gen_random_uuid(),
  transmittal_id uuid not null references transmittals(id) on delete cascade,
  drawing_id uuid references drawings(id) on delete set null,
  revision_id uuid references revisions(id) on delete set null,
  note text,
  created_at timestamptz default now()
);

create index if not exists transmittal_items_transmittal_idx on transmittal_items(transmittal_id);
create index if not exists transmittal_items_drawing_idx on transmittal_items(drawing_id);
create index if not exists transmittal_items_revision_idx on transmittal_items(revision_id);

alter table if exists drawings enable row level security;
alter table if exists revisions enable row level security;
alter table if exists reviews enable row level security;
alter table if exists transmittals enable row level security;
alter table if exists transmittal_items enable row level security;

drop policy if exists "Authenticated users can read drawings" on drawings;
create policy "Authenticated users can read drawings"
  on drawings for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can mutate drawings" on drawings;
create policy "Authenticated users can mutate drawings"
  on drawings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can read revisions" on revisions;
create policy "Authenticated users can read revisions"
  on revisions for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can mutate revisions" on revisions;
create policy "Authenticated users can mutate revisions"
  on revisions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can read reviews" on reviews;
create policy "Authenticated users can read reviews"
  on reviews for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can mutate reviews" on reviews;
create policy "Authenticated users can mutate reviews"
  on reviews for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can read transmittals" on transmittals;
create policy "Authenticated users can read transmittals"
  on transmittals for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can mutate transmittals" on transmittals;
create policy "Authenticated users can mutate transmittals"
  on transmittals for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can read transmittal items" on transmittal_items;
create policy "Authenticated users can read transmittal items"
  on transmittal_items for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can mutate transmittal items" on transmittal_items;
create policy "Authenticated users can mutate transmittal items"
  on transmittal_items for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
