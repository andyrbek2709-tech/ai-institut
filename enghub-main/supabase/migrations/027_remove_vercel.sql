-- Migration 027: Remove Vercel from architecture
-- Railway is sole deployment platform. Vercel permanently decommissioned.
-- Created: 2026-05-07

-- Fix api_metrics: drop 'vercel' from provider constraint
ALTER TABLE public.api_metrics
  DROP CONSTRAINT IF EXISTS api_metrics_provider_check;

ALTER TABLE public.api_metrics
  ADD CONSTRAINT api_metrics_provider_check
  CHECK (provider IN ('railway'));

-- Delete any lingering vercel rows from api_metrics
DELETE FROM public.api_metrics WHERE provider = 'vercel';

-- Fix sticky_routing_sessions: drop 'vercel' from selected_provider constraint
ALTER TABLE public.sticky_routing_sessions
  DROP CONSTRAINT IF EXISTS sticky_routing_sessions_selected_provider_check;

ALTER TABLE public.sticky_routing_sessions
  ADD CONSTRAINT sticky_routing_sessions_selected_provider_check
  CHECK (selected_provider IN ('railway'));

-- Delete any lingering vercel sessions
DELETE FROM public.sticky_routing_sessions WHERE selected_provider = 'vercel';

-- Remove vercel_metrics feature flag (vercel is decommissioned)
DELETE FROM public.feature_flags WHERE flag_name = 'vercel_metrics';

-- Ensure api_railway_rollout is at 100%
UPDATE public.feature_flags
  SET rollout_percentage = 100, updated_at = NOW()
  WHERE flag_name = 'api_railway_rollout';
