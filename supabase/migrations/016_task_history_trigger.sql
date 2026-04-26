-- task_history: гарантированно ведём аудит смен ключевых полей задачи
-- на уровне БД, чтобы история не пропадала, если фронтенд забыл записать.
--
-- Таблица создаётся если её нет (idempotent), затем вешаем AFTER UPDATE
-- триггер, который на изменение status / assigned_to / priority / deadline
-- кладёт новую запись.

create table if not exists task_history (
  id bigserial primary key,
  task_id bigint not null references tasks(id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  changed_by bigint references app_users(id) on delete set null,
  changed_at timestamptz not null default now(),
  comment text
);

create index if not exists task_history_task_idx on task_history(task_id);
create index if not exists task_history_changed_at_idx on task_history(changed_at desc);

-- RLS: видим историю задач, которые видим сами.
alter table task_history enable row level security;

drop policy if exists "task_history_select" on task_history;
create policy "task_history_select" on task_history
  for select using (
    public.auth_is_admin_or_gip()
    or exists (select 1 from tasks t where t.id = task_history.task_id)
  );

drop policy if exists "task_history_insert" on task_history;
create policy "task_history_insert" on task_history
  for insert with check (auth.role() = 'authenticated');

-- Триггерная функция: на UPDATE задачи смотрим, какие поля изменились.
create or replace function public.tasks_log_history() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who bigint := public.auth_app_user_id();
  c   text   := nullif(new.comment, '');
begin
  if new.status is distinct from old.status then
    insert into task_history(task_id, field, old_value, new_value, changed_by, comment)
      values (new.id, 'status', old.status, new.status, who, c);
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into task_history(task_id, field, old_value, new_value, changed_by)
      values (new.id, 'assigned_to', old.assigned_to::text, new.assigned_to::text, who);
  end if;
  if new.priority is distinct from old.priority then
    insert into task_history(task_id, field, old_value, new_value, changed_by)
      values (new.id, 'priority', old.priority, new.priority, who);
  end if;
  if new.deadline is distinct from old.deadline then
    insert into task_history(task_id, field, old_value, new_value, changed_by)
      values (new.id, 'deadline', old.deadline::text, new.deadline::text, who);
  end if;
  return new;
end $$;

drop trigger if exists trg_tasks_history on tasks;
create trigger trg_tasks_history
  after update on tasks
  for each row execute function public.tasks_log_history();

-- На INSERT тоже стоит зафиксировать — кто и когда создал задачу.
create or replace function public.tasks_log_create() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who bigint := public.auth_app_user_id();
begin
  insert into task_history(task_id, field, old_value, new_value, changed_by)
    values (new.id, 'created', null, new.status, who);
  if new.assigned_to is not null then
    insert into task_history(task_id, field, old_value, new_value, changed_by)
      values (new.id, 'assigned_to', null, new.assigned_to::text, who);
  end if;
  return new;
end $$;

drop trigger if exists trg_tasks_history_create on tasks;
create trigger trg_tasks_history_create
  after insert on tasks
  for each row execute function public.tasks_log_create();
