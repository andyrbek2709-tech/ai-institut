-- 1. Таблицы (уже существуют, проверяем политики)

-- 2. Политика: чтение ревизий
ALTER TABLE public.report_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view revisions of reports they can access" ON public.report_revisions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.reports r
            JOIN public.project_members pm ON r.project_id::text = pm.project_id::text
            WHERE r.id = report_revisions.report_id 
            AND pm.user_id::text = auth.uid()::text
        )
    );

-- 3. Политика: чтение связей нормативов
ALTER TABLE public.report_normative_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view normative links of reports they can access" ON public.report_normative_links
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.report_revisions rr
            JOIN public.reports r ON rr.report_id = r.id
            JOIN public.project_members pm ON r.project_id::text = pm.project_id::text
            WHERE rr.id = report_normative_links.revision_id 
            AND pm.user_id::text = auth.uid()::text
        )
    );

-- 4. Политика: чтение логов аудита
ALTER TABLE public.report_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view audit logs of reports they can access" ON public.report_audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.reports r
            JOIN public.project_members pm ON r.project_id::text = pm.project_id::text
            WHERE r.id = report_audit_log.report_id 
            AND pm.user_id::text = auth.uid()::text
        )
    );
