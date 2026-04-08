-- Catalogs and specifications module

create table if not exists catalogs (
  id bigserial primary key,
  version text not null,
  catalog_date date not null,
  is_active boolean not null default false,
  source_file text,
  created_by bigint,
  created_at timestamptz not null default now(),
  unique (version, catalog_date)
);

create table if not exists sections (
  id bigserial primary key,
  catalog_id bigint not null references catalogs(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0
);

create table if not exists groups (
  id bigserial primary key,
  section_id bigint not null references sections(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0
);

create table if not exists catalog_items (
  id bigserial primary key,
  group_id bigint not null references groups(id) on delete cascade,
  code text not null,
  name text not null,
  unit text,
  standard text,
  searchable tsvector generated always as (
    to_tsvector('simple', coalesce(code, '') || ' ' || coalesce(name, '') || ' ' || coalesce(standard, ''))
  ) stored
);

create table if not exists specifications (
  id bigserial primary key,
  project_id bigint not null references projects(id) on delete cascade,
  name text not null,
  catalog_id bigint references catalogs(id) on delete set null,
  stamp jsonb not null default '{}'::jsonb,
  created_by bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists specification_items (
  id bigserial primary key,
  specification_id bigint not null references specifications(id) on delete cascade,
  line_no integer not null,
  item_id bigint references catalog_items(id) on delete set null,
  name text not null,
  type_mark text,
  code text,
  plant text,
  unit text,
  qty numeric(18,3) not null default 1
);

create index if not exists idx_sections_catalog_id on sections(catalog_id);
create index if not exists idx_groups_section_id on groups(section_id);
create index if not exists idx_catalog_items_group_id on catalog_items(group_id);
create index if not exists idx_catalog_items_code on catalog_items(code);
create index if not exists idx_catalog_items_searchable on catalog_items using gin(searchable);
create index if not exists idx_specifications_project_id on specifications(project_id);
create index if not exists idx_spec_items_spec_id on specification_items(specification_id);

-- Only one active catalog
create unique index if not exists uq_catalogs_active_true on catalogs((is_active)) where is_active = true;

-- Auto-update updated_at
create or replace function set_specifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_specifications_updated_at on specifications;
create trigger trg_specifications_updated_at
before update on specifications
for each row execute function set_specifications_updated_at();

-- RLS
alter table catalogs enable row level security;
alter table sections enable row level security;
alter table groups enable row level security;
alter table catalog_items enable row level security;
alter table specifications enable row level security;
alter table specification_items enable row level security;

drop policy if exists "Authenticated users can read catalogs" on catalogs;
create policy "Authenticated users can read catalogs" on catalogs
for select using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can manage catalogs" on catalogs;
create policy "Authenticated users can manage catalogs" on catalogs
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can read sections" on sections;
create policy "Authenticated users can read sections" on sections
for select using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can manage sections" on sections;
create policy "Authenticated users can manage sections" on sections
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can read groups" on groups;
create policy "Authenticated users can read groups" on groups
for select using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can manage groups" on groups;
create policy "Authenticated users can manage groups" on groups
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can read catalog_items" on catalog_items;
create policy "Authenticated users can read catalog_items" on catalog_items
for select using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can manage catalog_items" on catalog_items;
create policy "Authenticated users can manage catalog_items" on catalog_items
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can read specifications" on specifications;
create policy "Authenticated users can read specifications" on specifications
for select using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can manage specifications" on specifications;
create policy "Authenticated users can manage specifications" on specifications
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can read specification_items" on specification_items;
create policy "Authenticated users can read specification_items" on specification_items
for select using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can manage specification_items" on specification_items;
create policy "Authenticated users can manage specification_items" on specification_items
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
