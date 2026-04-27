alter table tasks
  add column if not exists drawing_id uuid references drawings(id) on delete set null;

create index if not exists tasks_drawing_id_idx
  on tasks(drawing_id);
