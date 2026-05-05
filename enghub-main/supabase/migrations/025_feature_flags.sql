-- Migration 025: Feature Flags and Rollout Management
-- Created: 2026-05-06

-- Create feature_flags table
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id BIGSERIAL PRIMARY KEY,
  flag_name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  rollout_percentage INTEGER NOT NULL DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  auto_rollback_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  error_rate_threshold NUMERIC(4, 2) NOT NULL DEFAULT 5.0 CHECK (error_rate_threshold > 0),
  latency_threshold_ms INTEGER NOT NULL DEFAULT 2000 CHECK (latency_threshold_ms > 0),
  monitoring_window_minutes INTEGER NOT NULL DEFAULT 5 CHECK (monitoring_window_minutes > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create sticky_routing_sessions table
CREATE TABLE IF NOT EXISTS public.sticky_routing_sessions (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  user_id UUID,
  selected_provider TEXT NOT NULL CHECK (selected_provider IN ('vercel', 'railway')),
  hash_value INTEGER NOT NULL CHECK (hash_value >= 0 AND hash_value < 100),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_accessed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create feature_rollback_events table (audit trail)
CREATE TABLE IF NOT EXISTS public.feature_rollback_events (
  id BIGSERIAL PRIMARY KEY,
  flag_name TEXT NOT NULL,
  previous_rollout_percentage INTEGER NOT NULL,
  new_rollout_percentage INTEGER NOT NULL,
  trigger_reason TEXT NOT NULL CHECK (trigger_reason IN ('error_rate', 'latency', 'manual')),
  error_rate NUMERIC(5, 2),
  avg_latency NUMERIC(10, 2),
  triggered_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Initialize feature flags
INSERT INTO public.feature_flags (flag_name, enabled, rollout_percentage, auto_rollback_enabled, error_rate_threshold, latency_threshold_ms, monitoring_window_minutes)
VALUES
  ('api_railway_rollout', TRUE, 0, TRUE, 5.0, 2000, 5),
  ('sticky_routing', TRUE, 100, FALSE, 5.0, 2000, 5),
  ('vercel_metrics', TRUE, 100, FALSE, 5.0, 2000, 5),
  ('auto_rollback', TRUE, 100, TRUE, 5.0, 2000, 5)
ON CONFLICT (flag_name) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sticky_routing_sessions_user_id
  ON public.sticky_routing_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_sticky_routing_sessions_expires_at
  ON public.sticky_routing_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_feature_rollback_events_flag_name
  ON public.feature_rollback_events(flag_name);

CREATE INDEX IF NOT EXISTS idx_feature_rollback_events_created_at
  ON public.feature_rollback_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticky_routing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_rollback_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies: feature_flags (read by authenticated, write by service_role only)
CREATE POLICY "Allow authenticated users to read feature flags"
  ON public.feature_flags
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Allow service role to update feature flags"
  ON public.feature_flags
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow service role to insert feature flags"
  ON public.feature_flags
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- RLS Policies: sticky_routing_sessions
CREATE POLICY "Allow authenticated users to read own sessions"
  ON public.sticky_routing_sessions
  FOR SELECT
  USING (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE POLICY "Allow service role to manage sessions"
  ON public.sticky_routing_sessions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- RLS Policies: feature_rollback_events (audit trail)
CREATE POLICY "Allow authenticated users to read rollback events"
  ON public.feature_rollback_events
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Allow service role to insert rollback events"
  ON public.feature_rollback_events
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT SELECT ON public.sticky_routing_sessions TO authenticated;
GRANT SELECT ON public.feature_rollback_events TO authenticated;
