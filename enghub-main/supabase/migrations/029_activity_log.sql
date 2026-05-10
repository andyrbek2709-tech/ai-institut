-- 029_activity_log.sql
-- Лента активности для дашбордов (ГИП, Лид, Инженер)
-- Таблица уже существует в prod (создана вручную ранее); миграция документирует схему.
create table if not exists activity_log (
  id          bigint generated always as identity primary key,
  project_id  bigint references projects(id) on delete cascade,
  actor_id    bigint references app_users(id) on delete set null,
  action_type text not null,  -- 'task_created'|'task_status_changed'|'document_uploaded'|'drawing_added'|'review_added'
  target_type text not null,  -- 'task'|'document'|'drawing'|'review'
  target_id   bigint,         -- id целевой сущности
  payload     jsonb,          -- доп. данные: name, title, from_status, to_status, etc.
  created_at  timestamptz default now()
);
create index if not exists idx_al_project_id on activity_log(project_id);
create index if not exists idx_al_actor_id   on activity_log(actor_id);
create index if not exists idx_al_created_at on activity_log(created_at desc);

alter table activity_log enable row level security;
create policy "al_select_auth" on activity_log
  for select using (auth.role() = 'authenticated');
create policy "al_insert_auth" on activity_log
  for insert with check (auth.role() = 'authenticated');
