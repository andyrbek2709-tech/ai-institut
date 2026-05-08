-- Pilot Program Telemetry Tables (2026-05-09)
-- Phase: AGSK Internal Pilot Program
-- Purpose: Collect real usage data, user feedback, and corpus gaps

-- 1. Pilot Users (Access Control)
CREATE TABLE IF NOT EXISTS pilot_users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id text NOT NULL,
  discipline text NOT NULL CHECK (discipline IN ('pipeline', 'welding', 'corrosion', 'mechanical', 'inspection', 'structural', 'safety')),
  added_at timestamptz DEFAULT now(),
  active boolean DEFAULT true,
  notes text
);

CREATE INDEX idx_pilot_users_active ON pilot_users(active);
CREATE INDEX idx_pilot_users_discipline ON pilot_users(discipline);

-- RLS: Only admins can manage pilot_users
ALTER TABLE pilot_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pilot_users_admin_only" ON pilot_users
  FOR ALL USING (auth_is_admin_or_gip());

-- 2. Query Telemetry
CREATE TABLE IF NOT EXISTS agsk_query_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id text NOT NULL,
  query_text text NOT NULL,
  query_tokens int,
  discipline text,
  result_count int,
  retrieval_latency_ms int,
  top_result_score float,
  top_result_standard_id text,
  timestamp timestamptz DEFAULT now(),
  session_id text,
  is_pilot boolean DEFAULT false
);

CREATE INDEX idx_agsk_query_log_user ON agsk_query_log(user_id, timestamp DESC);
CREATE INDEX idx_agsk_query_log_discipline ON agsk_query_log(discipline);
CREATE INDEX idx_agsk_query_log_standard ON agsk_query_log(top_result_standard_id);
CREATE INDEX idx_agsk_query_log_session ON agsk_query_log(session_id);

ALTER TABLE agsk_query_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agsk_query_log_own_org" ON agsk_query_log
  FOR SELECT USING (
    org_id = (SELECT org_id FROM auth_user_org_mapping() LIMIT 1)
    OR auth_is_admin_or_gip()
  );
CREATE POLICY "agsk_query_log_insert_own" ON agsk_query_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Result Clicks
CREATE TABLE IF NOT EXISTS agsk_result_clicks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_log_id uuid NOT NULL REFERENCES agsk_query_log(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id text NOT NULL,
  result_rank int NOT NULL,
  chunk_id text NOT NULL,
  standard_id text,
  section_title text,
  clicked_at timestamptz DEFAULT now(),
  time_to_click_ms int
);

CREATE INDEX idx_agsk_result_clicks_query ON agsk_result_clicks(query_log_id);
CREATE INDEX idx_agsk_result_clicks_standard ON agsk_result_clicks(standard_id);
CREATE INDEX idx_agsk_result_clicks_user ON agsk_result_clicks(user_id);

ALTER TABLE agsk_result_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agsk_result_clicks_own_org" ON agsk_result_clicks
  FOR SELECT USING (
    org_id = (SELECT org_id FROM auth_user_org_mapping() LIMIT 1)
    OR auth_is_admin_or_gip()
  );
CREATE POLICY "agsk_result_clicks_insert_own" ON agsk_result_clicks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Relevance Feedback
CREATE TABLE IF NOT EXISTS agsk_relevance_feedback (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query_log_id uuid NOT NULL REFERENCES agsk_query_log(id) ON DELETE CASCADE,
  result_id text NOT NULL,
  feedback_type text NOT NULL CHECK (feedback_type IN ('relevant', 'irrelevant', 'partially_relevant')),
  citation_correct boolean,
  citation_issue text CHECK (citation_issue IN ('missing_section', 'wrong_section', 'outdated', null)),
  false_positive boolean DEFAULT false,
  correctness_confidence int CHECK (correctness_confidence >= 1 AND correctness_confidence <= 5),
  comments text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_agsk_feedback_user ON agsk_relevance_feedback(user_id);
CREATE INDEX idx_agsk_feedback_query ON agsk_relevance_feedback(query_log_id);
CREATE INDEX idx_agsk_feedback_type ON agsk_relevance_feedback(feedback_type);
CREATE INDEX idx_agsk_feedback_false_positive ON agsk_relevance_feedback(false_positive);

ALTER TABLE agsk_relevance_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agsk_feedback_own_org" ON agsk_relevance_feedback
  FOR SELECT USING (auth_is_admin_or_gip());
CREATE POLICY "agsk_feedback_insert_own" ON agsk_relevance_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Retrieval Failures
CREATE TABLE IF NOT EXISTS agsk_retrieval_failures (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query_log_id uuid NOT NULL REFERENCES agsk_query_log(id) ON DELETE CASCADE,
  failure_type text NOT NULL CHECK (failure_type IN ('no_results', 'low_confidence', 'timeout', 'error')),
  query_text text NOT NULL,
  discipline text,
  top_score float,
  error_details text,
  likely_cause text CHECK (likely_cause IN ('corpus_gap', 'query_malformed', 'service_error', 'unknown')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_agsk_failures_type ON agsk_retrieval_failures(failure_type);
CREATE INDEX idx_agsk_failures_discipline ON agsk_retrieval_failures(discipline);
CREATE INDEX idx_agsk_failures_user ON agsk_retrieval_failures(user_id);

ALTER TABLE agsk_retrieval_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agsk_failures_own_org" ON agsk_retrieval_failures
  FOR SELECT USING (auth_is_admin_or_gip());
CREATE POLICY "agsk_failures_insert_own" ON agsk_retrieval_failures
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Corpus Gaps
CREATE TABLE IF NOT EXISTS agsk_corpus_gaps (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  gap_type text NOT NULL CHECK (gap_type IN ('missing_standard', 'missing_revision', 'missing_discipline', 'missing_section')),
  standard_id text NOT NULL,
  standard_version text,
  discipline text,
  query_count int DEFAULT 1,
  first_query_date timestamptz,
  last_query_date timestamptz DEFAULT now(),
  user_feedbacks text[],
  priority text DEFAULT 'P3' CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(standard_id, standard_version, discipline)
);

CREATE INDEX idx_agsk_gaps_priority ON agsk_corpus_gaps(priority);
CREATE INDEX idx_agsk_gaps_standard ON agsk_corpus_gaps(standard_id);
CREATE INDEX idx_agsk_gaps_discipline ON agsk_corpus_gaps(discipline);

ALTER TABLE agsk_corpus_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agsk_gaps_admin_only" ON agsk_corpus_gaps
  FOR ALL USING (auth_is_admin_or_gip());

-- 7. Dashboard Views (Read-only)

-- View 1: Query Summary
CREATE OR REPLACE VIEW agsk_dashboard_query_summary AS
SELECT
  COUNT(*) as total_queries,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT DATE(timestamp)) as days_active,
  SUM(CASE WHEN result_count = 0 THEN 1 ELSE 0 END) as zero_result_count,
  SUM(CASE WHEN result_count = 0 THEN 1 ELSE 0 END)::float / COUNT(*) as zero_result_rate,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY retrieval_latency_ms) as p50_latency,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY retrieval_latency_ms) as p95_latency,
  AVG(retrieval_latency_ms) as avg_latency
FROM agsk_query_log
WHERE timestamp > NOW() - INTERVAL '30 days';

-- View 2: Top Searched Standards
CREATE OR REPLACE VIEW agsk_dashboard_top_standards AS
SELECT
  top_result_standard_id,
  COUNT(*) as search_count,
  COUNT(DISTINCT user_id) as unique_users,
  ROUND(AVG(top_result_score)::numeric, 2) as avg_score,
  discipline
FROM agsk_query_log
WHERE timestamp > NOW() - INTERVAL '7 days'
  AND top_result_standard_id IS NOT NULL
GROUP BY top_result_standard_id, discipline
ORDER BY search_count DESC
LIMIT 20;

-- View 3: Discipline Distribution
CREATE OR REPLACE VIEW agsk_dashboard_discipline_dist AS
SELECT
  discipline,
  COUNT(*) as query_count,
  COUNT(DISTINCT user_id) as unique_users,
  SUM(CASE WHEN result_count = 0 THEN 1 ELSE 0 END)::float / COUNT(*) as zero_result_rate,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY retrieval_latency_ms) as p50_latency
FROM agsk_query_log
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY discipline
ORDER BY query_count DESC;

-- View 4: Feedback Summary
CREATE OR REPLACE VIEW agsk_dashboard_feedback_summary AS
SELECT
  feedback_type,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ()::numeric, 1) as pct
FROM agsk_relevance_feedback
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY feedback_type
ORDER BY count DESC;

-- View 5: Top Corpus Gaps
CREATE OR REPLACE VIEW agsk_dashboard_corpus_gaps_priority AS
SELECT
  gap_type,
  standard_id,
  standard_version,
  discipline,
  query_count,
  priority,
  first_query_date
FROM agsk_corpus_gaps
WHERE priority IN ('P0', 'P1')
ORDER BY priority, query_count DESC;

-- View 6: Click-through Analysis
CREATE OR REPLACE VIEW agsk_dashboard_ctr AS
SELECT
  COUNT(DISTINCT q.id) as total_queries,
  COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN q.id END) as queries_with_clicks,
  ROUND(COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN q.id END)::float /
        NULLIF(COUNT(DISTINCT q.id), 0) * 100, 1) as overall_ctr,
  ROUND(SUM(CASE WHEN c.result_rank = 1 THEN 1 ELSE 0 END)::float /
        NULLIF(COUNT(DISTINCT q.id), 0) * 100, 1) as top1_ctr
FROM agsk_query_log q
LEFT JOIN agsk_result_clicks c ON q.id = c.query_log_id
WHERE q.timestamp > NOW() - INTERVAL '7 days';

-- Permissions
GRANT SELECT ON agsk_dashboard_query_summary TO authenticated;
GRANT SELECT ON agsk_dashboard_top_standards TO authenticated;
GRANT SELECT ON agsk_dashboard_discipline_dist TO authenticated;
GRANT SELECT ON agsk_dashboard_feedback_summary TO authenticated;
GRANT SELECT ON agsk_dashboard_corpus_gaps_priority TO authenticated;
GRANT SELECT ON agsk_dashboard_ctr TO authenticated;

-- Mark as applied
INSERT INTO supabase_migrations (name) VALUES ('023_pilot_telemetry') ON CONFLICT DO NOTHING;
