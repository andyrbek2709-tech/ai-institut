-- Feature flags table for rollout configuration and auto rollback
CREATE TABLE feature_flags (
  id bigserial PRIMARY KEY,
  flag_name text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  rollout_percentage integer DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  
  -- Auto rollback settings
  auto_rollback_enabled boolean DEFAULT true,
  error_rate_threshold numeric DEFAULT 5.0, -- % errors
  latency_threshold_ms integer DEFAULT 2000, -- milliseconds
  monitoring_window_minutes integer DEFAULT 5, -- time window for evaluation
  
  -- Metadata
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Initialize default flags
INSERT INTO feature_flags (flag_name, enabled, rollout_percentage, description)
VALUES 
  ('api_railway_rollout', true, 0, 'Gradual Railway migration - 0% baseline'),
  ('sticky_routing', true, 100, 'Enable sticky routing (same user same provider in session)'),
  ('vercel_metrics', true, 100, 'Enable Vercel metrics logging'),
  ('auto_rollback', true, 100, 'Enable automatic rollback on metrics breach');

-- Indexes
CREATE INDEX idx_feature_flags_name ON feature_flags(flag_name);
CREATE INDEX idx_feature_flags_enabled ON feature_flags(enabled);

-- RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Policy: allow reads from authenticated users and service role
CREATE POLICY "allow_read_flags" ON feature_flags
  FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));

-- Policy: allow updates from service role only
CREATE POLICY "allow_update_flags_service" ON feature_flags
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Rollback events log (audit trail)
CREATE TABLE feature_rollback_events (
  id bigserial PRIMARY KEY,
  flag_name text NOT NULL,
  previous_rollout_percentage integer,
  new_rollout_percentage integer,
  trigger_reason text NOT NULL, -- 'error_rate' | 'latency' | 'manual'
  error_rate numeric,
  avg_latency numeric,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_rollback_events_flag ON feature_rollback_events(flag_name);
CREATE INDEX idx_rollback_events_timestamp ON feature_rollback_events(timestamp DESC);

ALTER TABLE feature_rollback_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_read_rollback_events" ON feature_rollback_events
  FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));

-- Sticky routing sessions (user → provider mapping for session)
CREATE TABLE sticky_routing_sessions (
  session_id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_provider text NOT NULL CHECK (selected_provider IN ('vercel', 'railway')),
  hash_value integer, -- The hash value used for selection
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_accessed timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Clean up expired sessions
CREATE INDEX idx_sticky_sessions_expires ON sticky_routing_sessions(expires_at);
CREATE INDEX idx_sticky_sessions_user ON sticky_routing_sessions(user_id);

ALTER TABLE sticky_routing_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_read_own_session" ON sticky_routing_sessions
  FOR SELECT
  USING (user_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "allow_insert_session" ON sticky_routing_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');

-- Function to update last_accessed
CREATE OR REPLACE FUNCTION update_session_accessed()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_accessed = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sticky_routing_accessed
BEFORE UPDATE ON sticky_routing_sessions
FOR EACH ROW
EXECUTE FUNCTION update_session_accessed();
