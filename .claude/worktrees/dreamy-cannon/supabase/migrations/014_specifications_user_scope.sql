-- Specifications ownership and item scoping (user_id + spec_id)

alter table if exists specifications
  add column if not exists user_id bigint;

create index if not exists idx_specifications_user_project
  on specifications(user_id, project_id, created_at desc);

create table if not exists spec_items (
  id bigserial primary key,
  spec_id bigint not null references specifications(id) on delete cascade,
  line_no integer not null default 1,
  name text not null,
  type text,
  code text,
  factory text,
  unit text,
  qty numeric(18,3) not null default 1,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_spec_items_spec_id on spec_items(spec_id);
create index if not exists idx_spec_items_spec_line on spec_items(spec_id, line_no);

-- Backfill items from legacy table (idempotent by natural key).
insert into spec_items (spec_id, line_no, name, type, code, factory, unit, qty, note)
select
  si.specification_id,
  si.line_no,
  si.name,
  si.type_mark,
  si.code,
  si.plant,
  si.unit,
  si.qty,
  null
from specification_items si
where not exists (
  select 1
  from spec_items n
  where n.spec_id = si.specification_id
    and n.line_no = si.line_no
    and coalesce(n.name, '') = coalesce(si.name, '')
    and coalesce(n.code, '') = coalesce(si.code, '')
);

alter table spec_items enable row level security;

drop policy if exists "Authenticated users can read spec_items" on spec_items;
create policy "Authenticated users can read spec_items" on spec_items
for select using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can manage spec_items" on spec_items;
create policy "Authenticated users can manage spec_items" on spec_items
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
