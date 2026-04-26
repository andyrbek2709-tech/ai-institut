-- Link spec_items rows to the АГСК-3 catalog (catalog_items).
-- Optional reference: nullable, on delete set null. Hand-written rows keep
-- item_id = null and are visually marked as "manual" in the Excel export.

alter table if exists spec_items
  add column if not exists item_id bigint;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'spec_items_item_id_fkey'
  ) then
    alter table spec_items
      add constraint spec_items_item_id_fkey
      foreign key (item_id) references catalog_items(id) on delete set null;
  end if;
end $$;

create index if not exists idx_spec_items_item_id on spec_items(item_id);
