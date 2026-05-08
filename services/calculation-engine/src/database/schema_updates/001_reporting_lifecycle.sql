-- Stage 1: Report Lifecycle Integration
-- Core tables for report lifecycle, identity, and audit linkage

-- Reports table: Stores report metadata and lifecycle
CREATE TABLE IF NOT EXISTS reports (
    id BIGSERIAL PRIMARY KEY,
    report_id VARCHAR(255) UNIQUE NOT NULL,  -- Deterministic: rpt_calc_id_hash_template
    calculation_id VARCHAR(255) NOT NULL,
    template_type VARCHAR(50) NOT NULL,  -- piping, structural, thermal, generic

    -- Identity hashes (deterministic reproducibility)
    identity_hash VARCHAR(64),  -- SHA256 of combined hashes
    inputs_hash VARCHAR(64),
    formula_hash VARCHAR(64),
    execution_hash VARCHAR(64),
    semantic_hash VARCHAR(64),
    template_hash VARCHAR(64),

    -- Generation context
    generator_id VARCHAR(100),  -- runner, api_v1, batch_job, etc.
    generated_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    template_version VARCHAR(20),
    engine_version VARCHAR(20),
    runner_version VARCHAR(20),

    -- State
    current_stage VARCHAR(50),  -- context_building, identity_generated, document_rendering, etc.
    is_stale BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,

    -- Tracking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Indexes for common queries
    CONSTRAINT valid_template_type CHECK (template_type IN ('piping', 'structural', 'thermal', 'generic'))
);

CREATE INDEX idx_reports_calculation_id ON reports(calculation_id);
CREATE INDEX idx_reports_identity_hash ON reports(identity_hash);
CREATE INDEX idx_reports_template_type ON reports(template_type);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);

-- Report lifecycle events: Complete event log for each report
CREATE TABLE IF NOT EXISTS report_lifecycle_events (
    id BIGSERIAL PRIMARY KEY,
    report_id VARCHAR(255) NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,

    -- Event details
    stage VARCHAR(50) NOT NULL,  -- context_building, identity_generated, etc.
    event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_ms FLOAT,
    generator_id VARCHAR(100),

    -- Tracking
    error_message TEXT,
    metadata JSONB,  -- Stage-specific data

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_lifecycle_events_report_id ON report_lifecycle_events(report_id);
CREATE INDEX idx_lifecycle_events_stage ON report_lifecycle_events(stage);
CREATE INDEX idx_lifecycle_events_timestamp ON report_lifecycle_events(event_timestamp DESC);

-- Report audit linkage: Bidirectional traceability Calculation ↔ Report ↔ Audit
CREATE TABLE IF NOT EXISTS report_audit_linkage (
    id BIGSERIAL PRIMARY KEY,
    report_id VARCHAR(255) NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,
    calculation_id VARCHAR(255) NOT NULL,

    -- Audit trail references
    audit_event_ids TEXT[],  -- Array of audit event IDs from CalculationResult
    validation_event_ids TEXT[],  -- Array of validation result IDs

    -- Cross-references for traceability
    source_calculation_id VARCHAR(255),  -- Original calculation
    report_generation_id VARCHAR(255),  -- Unique generation context

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_linkage_report_id ON report_audit_linkage(report_id);
CREATE INDEX idx_audit_linkage_calculation_id ON report_audit_linkage(calculation_id);

-- Report generation metadata: Captures generation context for reproducibility
CREATE TABLE IF NOT EXISTS report_generation_metadata (
    id BIGSERIAL PRIMARY KEY,
    report_id VARCHAR(255) UNIQUE NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,

    -- Execution context
    calculation_id VARCHAR(255) NOT NULL,
    calculation_timestamp TIMESTAMP WITH TIME ZONE,
    execution_time_ms FLOAT,
    validation_status VARCHAR(50),  -- success, warning, error

    -- Generation context
    template_type VARCHAR(50),
    template_version VARCHAR(20),
    engine_version VARCHAR(20),
    runner_version VARCHAR(20),

    -- Flags
    audit_trail_present BOOLEAN,
    semantic_validation_enabled BOOLEAN,

    -- Reproducibility info
    is_deterministic BOOLEAN DEFAULT TRUE,
    can_reproduce BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_generation_metadata_report_id ON report_generation_metadata(report_id);
CREATE INDEX idx_generation_metadata_calculation_id ON report_generation_metadata(calculation_id);

-- Report staleness tracking: Monitor if reports become outdated
CREATE TABLE IF NOT EXISTS report_staleness_tracking (
    id BIGSERIAL PRIMARY KEY,
    report_id VARCHAR(255) NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,
    calculation_id VARCHAR(255) NOT NULL,

    -- Timestamps for staleness detection
    report_generated_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    calculation_last_updated TIMESTAMP WITH TIME ZONE,

    -- Staleness status
    is_stale BOOLEAN DEFAULT FALSE,
    stale_detected_at TIMESTAMP WITH TIME ZONE,
    stale_reason TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_staleness_report_id ON report_staleness_tracking(report_id);
CREATE INDEX idx_staleness_is_stale ON report_staleness_tracking(is_stale);

-- Comments for documentation
COMMENT ON TABLE reports IS 'Core report storage with lifecycle state and identity hashes';
COMMENT ON TABLE report_lifecycle_events IS 'Complete event log for report generation stages';
COMMENT ON TABLE report_audit_linkage IS 'Bidirectional traceability: Calculation ↔ Report ↔ Audit Trail';
COMMENT ON TABLE report_generation_metadata IS 'Generation context for reproducibility and verification';
COMMENT ON TABLE report_staleness_tracking IS 'Monitor report staleness when underlying calculation changes';

COMMENT ON COLUMN reports.identity_hash IS 'Deterministic hash for reproducibility: same calc+inputs+formula = same hash';
COMMENT ON COLUMN reports.generator_id IS 'Origin: runner, api_v1, batch_job, etc.';
COMMENT ON COLUMN reports.is_stale IS 'True if source calculation modified after report generation';
