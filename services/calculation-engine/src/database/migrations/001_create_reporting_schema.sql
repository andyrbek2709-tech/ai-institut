-- Migration: Create deterministic reporting schema
-- Date: 2026-05-08
-- Purpose: PostgreSQL tables for lifecycle, lineage, and identity persistence

-- Table 1: Report lifecycle metadata
CREATE TABLE IF NOT EXISTS report_lifecycle_metadata (
    id BIGSERIAL PRIMARY KEY,
    report_id VARCHAR(255) NOT NULL UNIQUE,
    calculation_id VARCHAR(255) NOT NULL,
    current_stage VARCHAR(64) NOT NULL,
    total_generation_time_ms NUMERIC NOT NULL,
    is_stale BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    parent_report_id VARCHAR(255),
    events_count INTEGER NOT NULL DEFAULT 0,
    lifecycle_data JSONB NOT NULL,
    persisted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lifecycle_calculation ON report_lifecycle_metadata(calculation_id);
CREATE INDEX idx_lifecycle_parent ON report_lifecycle_metadata(parent_report_id);
CREATE INDEX idx_lifecycle_created ON report_lifecycle_metadata(created_at DESC);

-- Table 2: Report identity hashes
CREATE TABLE IF NOT EXISTS report_identity (
    id BIGSERIAL PRIMARY KEY,
    report_id VARCHAR(255) NOT NULL UNIQUE,
    calculation_id VARCHAR(255) NOT NULL,
    identity_hash VARCHAR(64) NOT NULL,
    inputs_hash VARCHAR(64) NOT NULL,
    formula_hash VARCHAR(64) NOT NULL,
    execution_hash VARCHAR(64) NOT NULL,
    semantic_hash VARCHAR(64) NOT NULL,
    template_hash VARCHAR(64) NOT NULL,
    generation_hash VARCHAR(64) NOT NULL,
    lifecycle_hash VARCHAR(64) NOT NULL,
    is_deterministic BOOLEAN NOT NULL DEFAULT TRUE,
    can_reproduce BOOLEAN NOT NULL DEFAULT TRUE,
    identity_data JSONB NOT NULL,
    persisted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_identity_hash ON report_identity(identity_hash);
CREATE INDEX idx_identity_calculation ON report_identity(calculation_id);
CREATE INDEX idx_identity_created ON report_identity(created_at DESC);

-- Table 3: Report lineage (revision chains)
CREATE TABLE IF NOT EXISTS report_lineage (
    id BIGSERIAL PRIMARY KEY,
    report_id VARCHAR(255) NOT NULL,
    parent_report_id VARCHAR(255),
    calculation_id VARCHAR(255) NOT NULL,
    lineage_data JSONB NOT NULL,
    persisted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lineage_report ON report_lineage(report_id);
CREATE INDEX idx_lineage_parent ON report_lineage(parent_report_id);
CREATE INDEX idx_lineage_calculation ON report_lineage(calculation_id);

-- Table 4: Determinism verification log
CREATE TABLE IF NOT EXISTS determinism_verification_log (
    id BIGSERIAL PRIMARY KEY,
    report_id VARCHAR(255) NOT NULL,
    calculation_id VARCHAR(255) NOT NULL,
    verification_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    is_reproducible BOOLEAN NOT NULL,
    error_message TEXT,
    verification_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verification_report ON determinism_verification_log(report_id);
CREATE INDEX idx_verification_timestamp ON determinism_verification_log(verification_timestamp DESC);
