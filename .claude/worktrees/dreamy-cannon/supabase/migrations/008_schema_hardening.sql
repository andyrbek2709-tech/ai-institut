-- E.1 Data / migration hardening: query indexes + domain CHECK constraints
-- aligned with enghub-main/src/constants.ts and TransmittalsTab status values.
-- Apply in Supabase Dashboard → SQL Editor (or supabase db push).

-- List/filter patterns (project + status)
create index if not exists reviews_project_status_idx
  on reviews (project_id, status);

create index if not exists transmittals_project_status_idx
  on transmittals (project_id, status);

-- Revision journal per drawing (newest first)
create index if not exists revisions_drawing_created_idx
  on revisions (drawing_id, created_at desc);

-- Domain checks (idempotent: skip if constraint name already exists)
do $$ begin
  alter table drawings add constraint drawings_status_domain_chk
    check (status in ('draft', 'in_work', 'review', 'approved', 'issued'));
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table reviews add constraint reviews_severity_domain_chk
    check (severity in ('minor', 'major', 'critical'));
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table reviews add constraint reviews_status_domain_chk
    check (status in ('open', 'in_progress', 'resolved', 'rejected'));
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter table transmittals add constraint transmittals_status_domain_chk
    check (status in ('draft', 'issued', 'delivered', 'cancelled'));
exception
  when duplicate_object then null;
end $$;

-- At least one link target (matches Copilot apply-contract and intended UI flow)
do $$ begin
  alter table transmittal_items add constraint transmittal_items_link_chk
    check (drawing_id is not null or revision_id is not null);
exception
  when duplicate_object then null;
end $$;
