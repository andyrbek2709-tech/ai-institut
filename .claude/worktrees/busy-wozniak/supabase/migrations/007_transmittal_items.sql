create table if not exists transmittal_items (
  id uuid primary key default gen_random_uuid(),
  transmittal_id uuid not null references transmittals(id) on delete cascade,
  drawing_id uuid references drawings(id) on delete set null,
  revision_id uuid references revisions(id) on delete set null,
  note text,
  created_at timestamptz default now()
);

create index if not exists transmittal_items_transmittal_idx
  on transmittal_items(transmittal_id);

create index if not exists transmittal_items_drawing_idx
  on transmittal_items(drawing_id);

create index if not exists transmittal_items_revision_idx
  on transmittal_items(revision_id);

alter table transmittal_items enable row level security;

drop policy if exists "Authenticated users can read transmittal items" on transmittal_items;
create policy "Authenticated users can read transmittal items"
  on transmittal_items for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can mutate transmittal items" on transmittal_items;
create policy "Authenticated users can mutate transmittal items"
  on transmittal_items for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
