-- Migration 024: API Metrics System for Gradual Rollout Monitoring
-- Created: 2026-05-06

-- Create api_metrics table
CREATE TABLE IF NOT EXISTS public.api_metrics (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  provider TEXT NOT NULL CHECK (provider IN ('vercel', 'railway')),
  endpoint TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time INTEGER NOT NULL, -- milliseconds
  error TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_metrics_timestamp_desc
  ON public.api_metrics(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_api_metrics_provider
  ON public.api_metrics(provider);

CREATE INDEX IF NOT EXISTS idx_api_metrics_endpoint
  ON public.api_metrics(endpoint);

CREATE INDEX IF NOT EXISTS idx_api_metrics_status_code
  ON public.api_metrics(status_code);

CREATE INDEX IF NOT EXISTS idx_api_metrics_provider_timestamp
  ON public.api_metrics(provider, timestamp DESC);

-- Create materialized view for aggregation (used by dashboard)
CREATE OR REPLACE VIEW api_metrics_summary AS
SELECT
  provider,
  endpoint,
  COUNT(*) as request_count,
  ROUND(100.0 * SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) / COUNT(*)::numeric, 2) as error_rate,
  ROUND(AVG(response_time)::numeric, 2) as avg_latency,
  MAX(response_time) as max_latency,
  MAX(CASE WHEN status_code >= 400 THEN error END) as last_error,
  MAX(timestamp) as last_request_time
FROM public.api_metrics
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY provider, endpoint;

-- Enable RLS
ALTER TABLE public.api_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read metrics
CREATE POLICY "Allow authenticated users to read metrics"
  ON public.api_metrics
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policy: Allow service role to insert metrics (from backend)
CREATE POLICY "Allow service role to insert metrics"
  ON public.api_metrics
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON public.api_metrics TO authenticated;
GRANT SELECT ON public.api_metrics_summary TO authenticated;
