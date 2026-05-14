-- Create reports table for ReportLifecycleManager
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    discipline TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'generated',
    checksum TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    signed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Add basic RLS policies
CREATE POLICY "Users can view reports in projects they participate in" ON public.reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = reports.project_id AND pm.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = reports.project_id AND p.gip_id = auth.uid()
        )
    );

CREATE POLICY "Engineers/Leads can insert reports" ON public.reports
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = reports.project_id AND pm.user_id = auth.uid()
        )
    );
