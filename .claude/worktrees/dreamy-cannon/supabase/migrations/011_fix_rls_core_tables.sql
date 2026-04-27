-- Fix RLS policies for core tables that were created outside migrations.
-- Ensures all authenticated users can read/write app_users, projects, tasks,
-- messages, and departments. Idempotent: safe to re-run.

-- app_users ---------------------------------------------------------------
alter table if exists app_users enable row level security;

drop policy if exists "Authenticated users can read app_users" on app_users;
create policy "Authenticated users can read app_users"
  on app_users for select using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert app_users" on app_users;
create policy "Authenticated users can insert app_users"
  on app_users for insert with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update app_users" on app_users;
create policy "Authenticated users can update app_users"
  on app_users for update
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- projects ----------------------------------------------------------------
alter table if exists projects enable row level security;

drop policy if exists "Authenticated users can read projects" on projects;
create policy "Authenticated users can read projects"
  on projects for select using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can manage projects" on projects;
create policy "Authenticated users can manage projects"
  on projects for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- tasks -------------------------------------------------------------------
alter table if exists tasks enable row level security;

drop policy if exists "Authenticated users can read tasks" on tasks;
create policy "Authenticated users can read tasks"
  on tasks for select using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can manage tasks" on tasks;
create policy "Authenticated users can manage tasks"
  on tasks for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- messages ----------------------------------------------------------------
alter table if exists messages enable row level security;

drop policy if exists "Authenticated users can read messages" on messages;
create policy "Authenticated users can read messages"
  on messages for select using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can manage messages" on messages;
create policy "Authenticated users can manage messages"
  on messages for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- departments -------------------------------------------------------------
alter table if exists departments enable row level security;

drop policy if exists "Authenticated users can read departments" on departments;
create policy "Authenticated users can read departments"
  on departments for select using (auth.role() = 'authenticated');

-- normative_docs ----------------------------------------------------------
alter table if exists normative_docs enable row level security;

drop policy if exists "Authenticated users can read normative_docs" on normative_docs;
create policy "Authenticated users can read normative_docs"
  on normative_docs for select using (auth.role() = 'authenticated');

-- ai_actions (used by CopilotPanel) ---------------------------------------
alter table if exists ai_actions enable row level security;

drop policy if exists "Authenticated users can read ai_actions" on ai_actions;
create policy "Authenticated users can read ai_actions"
  on ai_actions for select using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can manage ai_actions" on ai_actions;
create policy "Authenticated users can manage ai_actions"
  on ai_actions for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
