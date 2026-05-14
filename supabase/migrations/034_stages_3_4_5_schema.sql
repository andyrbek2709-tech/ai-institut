-- 1. Таблица версий (ревизий)
CREATE TABLE IF NOT EXISTS public.report_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    checksum TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Таблица связей нормативов (для трейсинга)
CREATE TABLE IF NOT EXISTS public.report_normative_links (
    revision_id UUID REFERENCES public.report_revisions(id) ON DELETE CASCADE,
    chunk_id UUID, -- ссылка на agsk_chunks
    section_ref TEXT, -- описание раздела (например, 'п. 4.2.1')
    PRIMARY KEY (revision_id, chunk_id)
);

-- 3. Аудит-лог подписей
CREATE TABLE IF NOT EXISTS public.report_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'signed', 'rejected', 'revision_created'
    signer_id UUID REFERENCES auth.users(id),
    signature_hash TEXT, -- хеш состояния на момент подписи
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
