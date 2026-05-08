-- 027_fix_retrieval_rls_and_org_id.sql
-- CRITICAL FIX: Repair RLS policies and org_id type mismatches for retrieval API
--
-- Problems fixed:
-- 1. agsk_chunks RLS policy referenced non-existent org_id in app_users
-- 2. Type mismatch: agsk_chunks.org_id (uuid) vs pilot_users.org_id (text)
-- 3. Telemetry tables need RLS policies for RPC execution
--
-- Solution:
-- 1. Fix agsk_chunks RLS to use pilot_users org_id (with casting)
-- 2. Add RLS bypass for admin client on core tables
-- 3. Update RLS to allow authenticated admin users

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 1: Fix agsk_chunks RLS policy
-- ═══════════════════════════════════════════════════════════════════════

-- Drop broken RLS policy
DROP POLICY IF EXISTS "agsk_chunks_select" ON agsk_chunks;

-- Create corrected RLS policy that:
-- 1. Allows admin users (from auth.users)
-- 2. Allows users whose org_id matches chunks org_id (via pilot_users lookup)
-- 3. Uses SECURITY DEFINER RPC safe casting
CREATE POLICY "agsk_chunks_select" ON agsk_chunks
  FOR SELECT
  USING (
    public.auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM pilot_users
      WHERE pilot_users.user_id = auth.uid()
      AND pilot_users.org_id = agsk_chunks.org_id::text
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 2: Fix agsk_feedback RLS (similar fix)
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "agsk_feedback_select" ON agsk_feedback;
CREATE POLICY "agsk_feedback_select" ON agsk_feedback
  FOR SELECT
  USING (
    public.auth_is_admin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM pilot_users
      WHERE pilot_users.user_id = auth.uid()
      AND pilot_users.org_id = agsk_feedback.org_id
    )
  );

DROP POLICY IF EXISTS "agsk_feedback_insert" ON agsk_feedback;
CREATE POLICY "agsk_feedback_insert" ON agsk_feedback
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.auth_is_admin()
  );

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 3: Fix telemetry tables RLS for RPC execution
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "agsk_query_log_insert" ON agsk_query_log;
CREATE POLICY "agsk_query_log_insert" ON agsk_query_log
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.auth_is_admin()
  );

DROP POLICY IF EXISTS "agsk_query_log_select" ON agsk_query_log;
CREATE POLICY "agsk_query_log_select" ON agsk_query_log
  FOR SELECT
  USING (
    public.auth_is_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "agsk_click_log_insert" ON agsk_click_log;
CREATE POLICY "agsk_click_log_insert" ON agsk_click_log
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.auth_is_admin()
  );

DROP POLICY IF EXISTS "agsk_feedback_log_insert" ON agsk_feedback_log;
CREATE POLICY "agsk_feedback_log_insert" ON agsk_feedback_log
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.auth_is_admin()
  );

DROP POLICY IF EXISTS "agsk_retrieval_logs_insert" ON agsk_retrieval_logs;
CREATE POLICY "agsk_retrieval_logs_insert" ON agsk_retrieval_logs
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.auth_is_admin()
  );

DROP POLICY IF EXISTS "agsk_retrieval_logs_select" ON agsk_retrieval_logs;
CREATE POLICY "agsk_retrieval_logs_select" ON agsk_retrieval_logs
  FOR SELECT
  USING (
    public.auth_is_admin()
    OR user_id = auth.uid()
  );

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 4: Fix embedding cache RLS (minimal — only admins)
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "agsk_embedding_cache_all" ON agsk_embedding_cache;
CREATE POLICY "agsk_embedding_cache_all" ON agsk_embedding_cache
  FOR ALL
  USING (public.auth_is_admin());

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════

-- Verify policies are in place
SELECT
  tablename,
  policyname,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('agsk_chunks', 'agsk_feedback', 'agsk_query_log', 'agsk_retrieval_logs')
ORDER BY tablename, policyname;
