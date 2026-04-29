-- 019b_project_storage_stats_invoker.sql — заменить SECURITY DEFINER view на security_invoker, чтобы RLS вызывающего применялась.
-- ПРИМЕНЕНО на prod через Supabase MCP 2026-04-29.

drop view if exists public.project_storage_stats;

create view public.project_storage_stats with (security_invoker=true) as
select p.id as project_id,
       p.name as project_name,
       p.code as project_code,
       coalesce(d.docs_count, 0::bigint)  as documents_count,
       coalesce(d.docs_bytes, 0::numeric) as documents_bytes,
       coalesce(a.atts_count, 0::bigint)  as attachments_count,
       coalesce(a.atts_bytes, 0::numeric) as attachments_bytes,
       coalesce(d.docs_bytes, 0::numeric) + coalesce(a.atts_bytes, 0::numeric) as total_bytes
from projects p
  left join (
    select project_id, count(*) as docs_count, sum(size_bytes) as docs_bytes
    from project_documents group by project_id
  ) d on d.project_id = p.id
  left join (
    select t.project_id, count(*) as atts_count, sum(att.size_bytes) as atts_bytes
    from task_attachments att join tasks t on t.id = att.task_id
    group by t.project_id
  ) a on a.project_id = p.id;

revoke all on public.project_storage_stats from anon;
grant select on public.project_storage_stats to authenticated;
