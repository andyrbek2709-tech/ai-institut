-- 024_agsk_observability.sql
-- AGSK Production Hardening Phase — Observability Layer
-- 1. Retrieval latency dashboard view (p50/p95/p99 per type/day)
-- 2. Parser diagnostics summary view
-- 3. False positive monitoring view
-- 4. Retrieval drift detection view
-- 5. Corpus health dashboard view
-- 6. Connection pool / concurrency stats helper
-- 7. Alert thresholds table

-- ═══════════════════════════════════════════════════════════════════════
-- 1. RETRIEVAL LATENCY DASHBOARD
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW agsk_v_latency_dashboard AS
SELECT
  date_trunc('hour', created_at)                                   AS hour_bucket,
  retrieval_type,
  COUNT(*)                                                          AS query_count,
  ROUND(AVG(latency_ms))                                           AS avg_ms,
  -- p50: median
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms)::int   AS p50_ms,
  -- p95
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::int   AS p95_ms,
  -- p99
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms)::int   AS p99_ms,
  -- Slowest query in bucket
  MAX(latency_ms)                                                   AS max_ms,
  -- Cache effectiveness
  ROUND(100.0 * SUM(CASE WHEN embedding_cache_hit THEN 1 ELSE 0 END) / COUNT(*), 1) AS cache_hit_pct,
  -- Zero-result rate (retrieval returned nothing)
  ROUND(100.0 * SUM(CASE WHEN result_count = 0 THEN 1 ELSE 0 END) / COUNT(*), 1)    AS zero_result_pct
FROM agsk_retrieval_logs
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- Daily rollup (lighter weight for trend analysis)
CREATE OR REPLACE VIEW agsk_v_latency_daily AS
SELECT
  date_trunc('day', created_at)                                    AS day_bucket,
  retrieval_type,
  COUNT(*)                                                          AS query_count,
  ROUND(AVG(latency_ms))                                           AS avg_ms,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms)::int   AS p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::int   AS p95_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms)::int   AS p99_ms,
  ROUND(100.0 * SUM(CASE WHEN embedding_cache_hit THEN 1 ELSE 0 END) / COUNT(*), 1) AS cache_hit_pct,
  ROUND(100.0 * SUM(CASE WHEN result_count = 0 THEN 1 ELSE 0 END) / COUNT(*), 1)    AS zero_result_pct
FROM agsk_retrieval_logs
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. FALSE POSITIVE MONITORING
-- ═══════════════════════════════════════════════════════════════════════

-- False positive = chunk retrieved but rated low relevance (1-2) or NOT cited
CREATE OR REPLACE VIEW agsk_v_false_positive_monitor AS
WITH fp_stats AS (
  SELECT
    f.standard_id,
    s.standard_code,
    s.discipline,
    s.year,
    COUNT(*)                                                          AS feedback_count,
    -- FP: relevance 1-2 or not cited
    SUM(CASE WHEN (f.relevance_score <= 2 OR f.was_cited = false) THEN 1 ELSE 0 END) AS fp_count,
    -- True positive: relevance 4-5 and cited
    SUM(CASE WHEN (f.relevance_score >= 4 AND f.was_cited = true) THEN 1 ELSE 0 END)  AS tp_count,
    AVG(f.relevance_score)                                            AS avg_relevance,
    SUM(CASE WHEN f.was_cited THEN 1 ELSE 0 END)                    AS cited_count
  FROM agsk_feedback f
  JOIN agsk_standards s ON f.standard_id = s.id
  WHERE f.created_at >= now() - interval '30 days'
  GROUP BY f.standard_id, s.standard_code, s.discipline, s.year
)
SELECT
  standard_code,
  discipline,
  year,
  feedback_count,
  fp_count,
  tp_count,
  ROUND(100.0 * fp_count / NULLIF(feedback_count, 0), 1)  AS fp_rate_pct,
  ROUND(avg_relevance::numeric, 2)                         AS avg_relevance,
  ROUND(100.0 * cited_count / NULLIF(feedback_count, 0), 1) AS citation_rate_pct,
  CASE
    WHEN fp_count::float / NULLIF(feedback_count, 0) > 0.25 THEN 'CRITICAL'
    WHEN fp_count::float / NULLIF(feedback_count, 0) > 0.15 THEN 'WARNING'
    ELSE 'OK'
  END AS fp_status
FROM fp_stats
ORDER BY fp_rate_pct DESC NULLS LAST;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. RETRIEVAL DRIFT DETECTION
-- ═══════════════════════════════════════════════════════════════════════

-- Detect when retrieval quality is drifting (zero-result spike, latency spike,
-- or discipline distribution shift vs 7-day baseline)
CREATE OR REPLACE VIEW agsk_v_retrieval_drift AS
WITH hourly AS (
  SELECT
    date_trunc('hour', created_at)               AS hour_bucket,
    retrieval_type,
    discipline_filter,
    COUNT(*)                                      AS queries,
    AVG(latency_ms)                               AS avg_latency,
    SUM(CASE WHEN result_count = 0 THEN 1 ELSE 0 END) AS zero_results,
    AVG(result_count)                             AS avg_results
  FROM agsk_retrieval_logs
  WHERE created_at >= now() - interval '48 hours'
  GROUP BY 1, 2, 3
),
baseline AS (
  SELECT
    retrieval_type,
    AVG(latency_ms)                               AS baseline_latency,
    AVG(result_count)                             AS baseline_results,
    STDDEV(latency_ms)                            AS stddev_latency
  FROM agsk_retrieval_logs
  WHERE created_at BETWEEN now() - interval '7 days' AND now() - interval '2 hours'
  GROUP BY retrieval_type
)
SELECT
  h.hour_bucket,
  h.retrieval_type,
  h.queries,
  ROUND(h.avg_latency)                           AS avg_latency_ms,
  ROUND(b.baseline_latency)                      AS baseline_latency_ms,
  ROUND(h.avg_latency - b.baseline_latency)      AS latency_delta_ms,
  ROUND(100.0 * h.zero_results / NULLIF(h.queries, 0), 1) AS zero_result_pct,
  -- Drift signal: >2σ latency increase = ALERT
  CASE
    WHEN h.avg_latency > b.baseline_latency + 2 * COALESCE(b.stddev_latency, 50)
      THEN 'LATENCY_SPIKE'
    WHEN h.zero_results::float / NULLIF(h.queries, 0) > 0.3
      THEN 'HIGH_ZERO_RESULTS'
    WHEN h.avg_results < 2
      THEN 'LOW_RESULT_COUNT'
    ELSE 'NORMAL'
  END AS drift_signal
FROM hourly h
LEFT JOIN baseline b USING (retrieval_type)
ORDER BY h.hour_bucket DESC, h.queries DESC;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. CORPUS HEALTH DASHBOARD
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW agsk_v_corpus_health AS
SELECT
  s.discipline,
  s.organization,
  COUNT(*)                                          AS total_standards,
  SUM(CASE WHEN s.status = 'ready' THEN 1 ELSE 0 END)         AS ready,
  SUM(CASE WHEN s.status = 'processing' THEN 1 ELSE 0 END)    AS processing,
  SUM(CASE WHEN s.status = 'failed' THEN 1 ELSE 0 END)        AS failed,
  SUM(CASE WHEN s.status = 'superseded' THEN 1 ELSE 0 END)    AS superseded,
  SUM(s.chunks_count)                               AS total_chunks,
  ROUND(AVG(s.chunks_count))                        AS avg_chunks_per_doc,
  MAX(s.created_at)                                 AS last_ingested_at,
  -- Freshness: days since last ingestion
  EXTRACT(DAY FROM now() - MAX(s.created_at))::int  AS days_since_last_ingest,
  -- Policy coverage: standards in corpus that have an approved policy
  SUM(CASE WHEN p.approval_status = 'approved' THEN 1 ELSE 0 END) AS policy_approved_count
FROM agsk_standards s
LEFT JOIN agsk_corpus_policy p ON p.standard_code = s.standard_code AND p.org_id IS NULL
GROUP BY s.discipline, s.organization
ORDER BY total_chunks DESC;

-- ═══════════════════════════════════════════════════════════════════════
-- 5. PARSER DIAGNOSTICS SUMMARY VIEW
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW agsk_v_parser_diagnostics AS
SELECT
  s.standard_code,
  s.title,
  s.discipline,
  s.year,
  s.page_count,
  s.chunks_count,
  CASE
    WHEN s.chunks_count = 0 THEN 'PARSE_FAILURE'
    WHEN s.chunks_count < 10 THEN 'VERY_FEW_CHUNKS'
    WHEN s.page_count > 0 AND s.chunks_count::float / s.page_count < 0.5 THEN 'LOW_DENSITY'
    ELSE 'OK'
  END AS parse_quality,
  -- Average chunks per page (quality signal: healthy = 2-8 chunks/page)
  CASE
    WHEN s.page_count > 0
      THEN ROUND(s.chunks_count::numeric / s.page_count, 2)
    ELSE NULL
  END AS chunks_per_page,
  s.status,
  s.created_at,
  j.error_message AS last_job_error
FROM agsk_standards s
LEFT JOIN LATERAL (
  SELECT error_message
  FROM agsk_ingestion_jobs
  WHERE standard_id = s.id
  ORDER BY created_at DESC
  LIMIT 1
) j ON true
ORDER BY parse_quality DESC, s.chunks_count ASC;

-- ═══════════════════════════════════════════════════════════════════════
-- 6. ALERT THRESHOLDS TABLE
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agsk_alert_thresholds (
  id              uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name     text   NOT NULL UNIQUE,
  warning_value   float  NOT NULL,
  critical_value  float  NOT NULL,
  comparison      text   NOT NULL DEFAULT 'gt'  -- 'gt' (greater-than) | 'lt'
                    CHECK (comparison IN ('gt', 'lt')),
  unit            text,
  description     text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO agsk_alert_thresholds (metric_name, warning_value, critical_value, comparison, unit, description)
VALUES
  ('p95_latency_ms',       500,  2000, 'gt', 'ms',      'p95 retrieval latency'),
  ('p99_latency_ms',       1000, 5000, 'gt', 'ms',      'p99 retrieval latency'),
  ('zero_result_pct',      10,   30,   'gt', '%',       'Queries returning 0 results'),
  ('fp_rate_pct',          15,   25,   'gt', '%',       'False positive rate (30-day)'),
  ('cache_hit_pct',        50,   20,   'lt', '%',       'Embedding cache hit rate'),
  ('failed_ingestions_24h', 1,   5,    'gt', 'count',   'Failed ingestion jobs in 24h'),
  ('corpus_stale_days',    30,   90,   'gt', 'days',    'Days since any new standard ingested'),
  ('chunks_per_page_min',  0.5,  0.1,  'lt', 'ratio',   'Parser density (chunks/page) too low')
ON CONFLICT (metric_name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- 7. ACTIVE ALERTS VIEW
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW agsk_v_active_alerts AS
WITH recent_stats AS (
  SELECT
    -- Latest p95 latency (last 1 hour)
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::float AS p95_ms_1h,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms)::float AS p99_ms_1h,
    100.0 * SUM(CASE WHEN result_count = 0 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*),0) AS zero_result_pct_1h,
    100.0 * SUM(CASE WHEN embedding_cache_hit THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*),0) AS cache_hit_pct_1h
  FROM agsk_retrieval_logs
  WHERE created_at >= now() - interval '1 hour'
),
failed_jobs AS (
  SELECT COUNT(*) AS failed_count_24h
  FROM agsk_ingestion_jobs
  WHERE status = 'failed' AND created_at >= now() - interval '24 hours'
),
corpus_age AS (
  SELECT EXTRACT(DAY FROM now() - MAX(created_at))::float AS stale_days
  FROM agsk_standards
  WHERE status = 'ready'
)
SELECT
  t.metric_name,
  CASE t.metric_name
    WHEN 'p95_latency_ms'        THEN r.p95_ms_1h
    WHEN 'p99_latency_ms'        THEN r.p99_ms_1h
    WHEN 'zero_result_pct'       THEN r.zero_result_pct_1h
    WHEN 'cache_hit_pct'         THEN r.cache_hit_pct_1h
    WHEN 'failed_ingestions_24h' THEN f.failed_count_24h::float
    WHEN 'corpus_stale_days'     THEN c.stale_days
    ELSE NULL
  END AS current_value,
  t.warning_value,
  t.critical_value,
  t.unit,
  CASE
    WHEN t.comparison = 'gt' THEN
      CASE
        WHEN (CASE t.metric_name
                WHEN 'p95_latency_ms'        THEN r.p95_ms_1h
                WHEN 'p99_latency_ms'        THEN r.p99_ms_1h
                WHEN 'zero_result_pct'       THEN r.zero_result_pct_1h
                WHEN 'cache_hit_pct'         THEN r.cache_hit_pct_1h
                WHEN 'failed_ingestions_24h' THEN f.failed_count_24h::float
                WHEN 'corpus_stale_days'     THEN c.stale_days
              END) > t.critical_value THEN 'CRITICAL'
        WHEN (CASE t.metric_name
                WHEN 'p95_latency_ms'        THEN r.p95_ms_1h
                WHEN 'p99_latency_ms'        THEN r.p99_ms_1h
                WHEN 'zero_result_pct'       THEN r.zero_result_pct_1h
                WHEN 'cache_hit_pct'         THEN r.cache_hit_pct_1h
                WHEN 'failed_ingestions_24h' THEN f.failed_count_24h::float
                WHEN 'corpus_stale_days'     THEN c.stale_days
              END) > t.warning_value  THEN 'WARNING'
        ELSE 'OK'
      END
    ELSE -- 'lt'
      CASE
        WHEN (CASE t.metric_name
                WHEN 'cache_hit_pct'      THEN r.cache_hit_pct_1h
                WHEN 'chunks_per_page_min' THEN NULL
              END) < t.critical_value THEN 'CRITICAL'
        WHEN (CASE t.metric_name
                WHEN 'cache_hit_pct'      THEN r.cache_hit_pct_1h
                WHEN 'chunks_per_page_min' THEN NULL
              END) < t.warning_value  THEN 'WARNING'
        ELSE 'OK'
      END
  END AS alert_level
FROM agsk_alert_thresholds t
CROSS JOIN recent_stats r
CROSS JOIN failed_jobs f
CROSS JOIN corpus_age c
WHERE t.metric_name NOT IN ('chunks_per_page_min')  -- computed differently
ORDER BY
  CASE alert_level WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,
  t.metric_name;

-- ═══════════════════════════════════════════════════════════════════════
-- 8. CONCURRENCY MONITORING HELPER (pg_stat_activity based)
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION agsk_connection_stats()
RETURNS TABLE (
  total_connections     int,
  active_queries        int,
  idle_connections      int,
  waiting_on_lock       int,
  agsk_queries          int,
  oldest_active_ms      bigint
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)::int                                                         AS total_connections,
    COUNT(*) FILTER (WHERE state = 'active')::int                        AS active_queries,
    COUNT(*) FILTER (WHERE state = 'idle')::int                          AS idle_connections,
    COUNT(*) FILTER (WHERE wait_event_type = 'Lock')::int                AS waiting_on_lock,
    COUNT(*) FILTER (WHERE query ILIKE '%agsk%' AND state = 'active')::int AS agsk_queries,
    COALESCE(MAX(EXTRACT(MILLISECONDS FROM (now() - query_start))::bigint)
               FILTER (WHERE state = 'active'), 0)                       AS oldest_active_ms
  FROM pg_stat_activity
  WHERE datname = current_database();
$$;
