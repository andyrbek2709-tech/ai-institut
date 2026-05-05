-- Migration: 026_api_performance_indexes
-- Purpose: Add missing indexes to optimize slow queries
-- Target latency: 150-300ms (was 400-1000ms)

-- 1. Index for /api/tasks/:projectId query
-- This is the main bottleneck - fetching all tasks for a project
CREATE INDEX IF NOT EXISTS tasks_project_id_idx 
  ON tasks(project_id) 
  INCLUDE (name, status, priority, assigned_to, created_at, deadline, rework_count);

-- 2. Index for /api/auto-rollback/check feature_flags lookup
-- Used in both checkAutoRollback and executeAutoRollback
CREATE INDEX IF NOT EXISTS feature_flags_flag_name_idx 
  ON feature_flags(flag_name) 
  INCLUDE (auto_rollback_enabled, rollout_percentage, monitoring_window_minutes, error_rate_threshold, latency_threshold_ms);

-- 3. Composite index for api_metrics queries
-- Used in getErrorRate and checkAutoRollback to filter by provider and timestamp
CREATE INDEX IF NOT EXISTS api_metrics_provider_timestamp_idx 
  ON api_metrics(provider, timestamp DESC) 
  INCLUDE (status_code, response_time);

-- 4. Index for api_metrics endpoint filtering
-- Used for analyzing specific endpoint performance
CREATE INDEX IF NOT EXISTS api_metrics_endpoint_idx 
  ON api_metrics(endpoint, timestamp DESC);

-- 5. Composite index for quick lookups by status code
-- Used for error rate calculations
CREATE INDEX IF NOT EXISTS api_metrics_status_code_timestamp_idx 
  ON api_metrics(status_code, timestamp DESC);

-- 6. Index for tasks status filtering (needed for state machine queries)
CREATE INDEX IF NOT EXISTS tasks_status_idx 
  ON tasks(status) 
  INCLUDE (project_id, id);

-- 7. Index for auto-rollback edge cases
CREATE INDEX IF NOT EXISTS tasks_project_status_idx 
  ON tasks(project_id, status) 
  INCLUDE (id, assigned_to);

-- Analyze table statistics after indexes are created
-- This helps PostgreSQL optimizer choose the best execution plans
ANALYZE tasks;
ANALYZE api_metrics;
ANALYZE feature_flags;

-- Grant appropriate permissions for RLS policies
GRANT SELECT ON tasks TO authenticated;
GRANT SELECT ON api_metrics TO authenticated;
GRANT SELECT ON feature_flags TO authenticated;

-- Create a statistics view for monitoring optimization impact
CREATE OR REPLACE VIEW api_performance_stats AS
SELECT 
  provider,
  COUNT(*) as total_requests,
  ROUND(AVG(response_time)::numeric, 2) as avg_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) as p95_latency_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time) as p99_latency_ms,
  COUNT(CASE WHEN status_code >= 400 THEN 1 END) * 100.0 / COUNT(*) as error_rate_percent,
  MAX(timestamp) as last_request
FROM api_metrics
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY provider;

GRANT SELECT ON api_performance_stats TO authenticated;
