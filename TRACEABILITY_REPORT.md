# STAGE 1: TRACEABILITY & AUDIT LINKAGE REPORT

**Date:** 2026-05-08  
**Phase:** ÉTAP 3 Phase 2, Stage 1  
**Focus:** Bidirectional engineering traceability

---

## EXECUTIVE SUMMARY

**Traceability** is the ability to trace any report back to its source calculation and audit trail, and conversely, to trace any calculation forward to its generated reports. Stage 1 establishes the **bidirectional audit linkage** system that ensures:

- **Complete Traceability:** Calculation → Validation → Audit → Report (and reverse)
- **Engineering Accountability:** Every report tied to specific execution context
- **Regulatory Compliance Foundation:** Supports future regulatory workflows
- **Root Cause Analysis:** Link failures to specific validation rules and audit events

**Key Achievement:** Every report now carries complete provenance metadata linking back to calculation source, validation results, and audit events.

---

## TRACEABILITY ARCHITECTURE

### The Traceability Chain

```
Calculation Input
  ↓
[Runner]
  ├→ Input Validation
  ├→ Formula Execution
  ├→ Output Validation
  └→ Audit Trail Generation
  ↓
CalculationResult (with audit_trail)
  ↓
[Report Lifecycle Manager]
  ├→ Extract context
  ├→ Generate identity
  └→ Track lifecycle
  ↓
Report (with lifecycle metadata)
  ↓
[Audit Linkage System]
  ├→ Extract audit event IDs
  ├→ Extract validation event IDs
  ├→ Create bidirectional links
  └→ Store in database
  ↓
Fully Traceable Report
  (report_id ↔ calculation_id ↔ audit_events ↔ validation_results)
```

### Bidirectional Linkage

**Forward Direction (Calculation → Report):**
```
calculation_id="calc_001"
  ↓ (executed by runner, produced)
CalculationResult(audit_trail=[...])
  ↓ (report generated from)
report_id="rpt_calc_001_..._piping"
```

**Reverse Direction (Report → Calculation):**
```
report_id="rpt_calc_001_..._piping"
  ↓ (contains reference to)
calculation_id="calc_001"
  ↓ (linked via)
report_audit_linkage.calculation_id
```

**Cross-References (Audit ↔ Report):**
```
CalculationResult.audit_trail
  ├→ [audit_evt_input_validation_1]
  ├→ [audit_evt_formula_execution_1]
  ├→ [audit_evt_output_validation_1]
  └→ [audit_evt_audit_complete_1]
  ↓ (linked to report via)
report_audit_linkage.audit_event_ids = [...]
  ↓ (enables)
Trace: Report → Audit Events → Validation Results
```

---

## DATABASE LINKAGE TABLES

### Table 1: report_audit_linkage

**Purpose:** Establish bidirectional links between reports and audit/validation data

**Schema:**
```sql
CREATE TABLE report_audit_linkage (
    id BIGSERIAL PRIMARY KEY,
    report_id VARCHAR(255) NOT NULL REFERENCES reports(report_id),
    calculation_id VARCHAR(255) NOT NULL,
    
    -- Audit trail references
    audit_event_ids TEXT[],           -- Array of audit event IDs
    validation_event_ids TEXT[],      -- Array of validation result IDs
    
    -- Cross-references
    source_calculation_id VARCHAR(255),
    report_generation_id VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Example Data:**
```sql
INSERT INTO report_audit_linkage (
    report_id, 
    calculation_id,
    audit_event_ids,
    validation_event_ids,
    source_calculation_id,
    report_generation_id
) VALUES (
    'rpt_calc_001_a7f2e8c1_piping',
    'calc_001',
    ARRAY['audit_evt_001', 'audit_evt_002', 'audit_evt_003', 'audit_evt_004'],
    ARRAY['val_evt_001', 'val_evt_002', 'val_evt_003'],
    'calc_001',
    'gen_001_2026_05_08_10_00_00'
);
```

**Traceability Queries:**

```sql
-- Forward: From report to audit trail
SELECT audit_event_ids, validation_event_ids
FROM report_audit_linkage
WHERE report_id = 'rpt_calc_001_a7f2e8c1_piping';

-- Result: [audit_evt_001, audit_evt_002, audit_evt_003, audit_evt_004]

-- Reverse: From calculation to all reports
SELECT report_id
FROM report_audit_linkage
WHERE calculation_id = 'calc_001';

-- Result: [rpt_calc_001_a7f2e8c1_piping, rpt_calc_001_b3d4f9a6_structural, ...]

-- Cross-reference: All validation results for report
SELECT validation_event_ids
FROM report_audit_linkage
WHERE report_id = 'rpt_calc_001_a7f2e8c1_piping';
```

### Table 2: report_lifecycle_events

**Purpose:** Complete event log of report generation stages

**Schema:**
```sql
CREATE TABLE report_lifecycle_events (
    id BIGSERIAL PRIMARY KEY,
    report_id VARCHAR(255) NOT NULL REFERENCES reports(report_id),
    
    stage VARCHAR(50) NOT NULL,           -- Stage name
    event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_ms FLOAT,
    generator_id VARCHAR(100),
    
    error_message TEXT,
    metadata JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Traceability Example:**
```sql
-- Get complete lifecycle of report
SELECT 
    stage,
    event_timestamp,
    duration_ms,
    error_message
FROM report_lifecycle_events
WHERE report_id = 'rpt_calc_001_a7f2e8c1_piping'
ORDER BY event_timestamp ASC;

-- Result (chronological):
stage                    | timestamp           | duration | error
─────────────────────────┼─────────────────────┼──────────┼───────
CONTEXT_BUILDING         | 2026-05-08T10:00:00Z| 15.2ms   | null
IDENTITY_GENERATED       | 2026-05-08T10:00:00Z| 8.1ms    | null
DOCUMENT_RENDERING       | 2026-05-08T10:00:01Z| 285.3ms  | null
LIFECYCLE_REGISTERED     | 2026-05-08T10:00:02Z| 32.5ms   | null
```

---

## TRACEABILITY EXAMPLES

### Example 1: Complete Forward Trace (Calculation → Report)

**Given:**
```
calculation_id = "calc_pipe_design_001"
```

**Trace:**

```
Step 1: Load calculation
  SELECT calculation_id, status, metadata, validation_results, audit_trail
  FROM calculations
  WHERE id = 'calc_pipe_design_001'
  
  Result:
  {
    "id": "calc_pipe_design_001",
    "status": "success",
    "validation_results": [
      {"rule_id": "rule_flow_range", "status": "passed"},
      {"rule_id": "rule_diameter_range", "status": "passed"},
      {"rule_id": "rule_length_range", "status": "passed"}
    ],
    "audit_trail": [
      "audit_evt_input_cap_001",
      "audit_evt_formula_exec_001",
      "audit_evt_output_val_001"
    ]
  }

Step 2: Find report generated from calculation
  SELECT report_id
  FROM report_audit_linkage
  WHERE calculation_id = 'calc_pipe_design_001'
  
  Result: rpt_calc_pipe_design_001_a7f2e8c1_b3d4f9a6_piping

Step 3: Get report lifecycle
  SELECT stage, duration_ms, error_message
  FROM report_lifecycle_events
  WHERE report_id = 'rpt_calc_pipe_design_001_a7f2e8c1_b3d4f9a6_piping'
  ORDER BY event_timestamp
  
  Result:
  - CONTEXT_BUILDING (15.2ms) ✓
  - IDENTITY_GENERATED (8.1ms) ✓
  - DOCUMENT_RENDERING (285.3ms) ✓
  - LIFECYCLE_REGISTERED (32.5ms) ✓

Step 4: Get report metadata and audit linkage
  SELECT identity_hash, audit_event_ids, validation_event_ids
  FROM reports r
  JOIN report_audit_linkage l ON r.report_id = l.report_id
  WHERE r.report_id = 'rpt_calc_pipe_design_001_a7f2e8c1_b3d4f9a6_piping'
  
  Result:
  {
    "identity_hash": "d1e2f3a4b5c6d7e8...",
    "audit_event_ids": ["audit_evt_001", "audit_evt_002", "audit_evt_003"],
    "validation_event_ids": ["val_evt_001", "val_evt_002", "val_evt_003"]
  }

Complete trace established:
  Calculation (calc_pipe_design_001)
    ↓
  Validation Results (3 passed)
    ↓
  Audit Events (3 events)
    ↓
  Report Generated (rpt_calc_pipe_design_001_...)
    ↓
  Report Lifecycle (4 stages, total 341.1ms)
    ↓
  Report Identity (d1e2f3a4b5c6...)
```

### Example 2: Complete Reverse Trace (Report → Calculation)

**Given:**
```
report_id = "rpt_calc_pipe_design_001_a7f2e8c1_b3d4f9a6_piping"
```

**Trace:**

```
Step 1: Get report metadata
  SELECT report_id, calculation_id, identity_hash, current_stage
  FROM reports
  WHERE report_id = 'rpt_calc_pipe_design_001_a7f2e8c1_b3d4f9a6_piping'
  
  Result:
  {
    "report_id": "rpt_calc_pipe_design_001_a7f2e8c1_b3d4f9a6_piping",
    "calculation_id": "calc_pipe_design_001",
    "identity_hash": "d1e2f3a4b5c6...",
    "current_stage": "LIFECYCLE_REGISTERED"
  }

Step 2: Get audit linkage
  SELECT audit_event_ids, validation_event_ids
  FROM report_audit_linkage
  WHERE report_id = 'rpt_calc_pipe_design_001_a7f2e8c1_b3d4f9a6_piping'
  
  Result:
  {
    "audit_event_ids": ["audit_evt_001", "audit_evt_002", "audit_evt_003"],
    "validation_event_ids": ["val_evt_001", "val_evt_002", "val_evt_003"]
  }

Step 3: Get source calculation
  SELECT calculation_id, status, results
  FROM calculations
  WHERE id = 'calc_pipe_design_001'
  
  Result:
  {
    "id": "calc_pipe_design_001",
    "status": "success",
    "results": {"pressure_drop": 15.5}
  }

Step 4: Get validation details
  SELECT rule_id, status, message
  FROM validation_results
  WHERE id IN ('val_evt_001', 'val_evt_002', 'val_evt_003')
  
  Result:
  - val_evt_001: rule_flow_range → PASSED
  - val_evt_002: rule_diameter_range → PASSED
  - val_evt_003: rule_length_range → PASSED

Complete trace established:
  Report (rpt_calc_pipe_design_001_...)
    ↓
  Source Calculation (calc_pipe_design_001, status=success)
    ↓
  Calculation Results (pressure_drop=15.5)
    ↓
  Validation Results (3 rules passed)
    ↓
  Audit Events (3 events)
    ↓
  Engineering Context
```

### Example 3: Audit Trail Root Cause Analysis

**Scenario:** Report generation failed. Investigate root cause.

```
Report: rpt_calc_pipe_design_001_..._piping (FAILED)

Step 1: Get failure information from lifecycle events
  SELECT stage, error_message, metadata
  FROM report_lifecycle_events
  WHERE report_id = 'rpt_calc_pipe_design_001_..._piping'
  
  Result:
  - CONTEXT_BUILDING: ✓ (15.2ms)
  - IDENTITY_GENERATED: ✓ (8.1ms)
  - DOCUMENT_RENDERING: ✗ ERROR "DOCX generation failed: memory limit exceeded"
  - LIFECYCLE_REGISTERED: — (not reached)

Step 2: Identify failure point
  Failure point: DOCUMENT_RENDERING stage
  Root cause: Memory limit exceeded during DOCX generation
  
  Likely reasons:
  - Report too large (many formulas?)
  - Template too complex?
  - Audit appendix too big?

Step 3: Check calculation and validation
  SELECT num_formulas, num_validation_results, result_size
  FROM report_generation_metadata
  WHERE report_id = 'rpt_calc_pipe_design_001_..._piping'
  
  Result:
  - Formulas: 12 (moderate)
  - Validations: 45 (high)
  - Audit trail size: 2.3MB (large)
  
  Conclusion: Audit appendix too large for DOCX builder

Step 4: Recommended action
  - Generate report WITHOUT audit appendix (include_audit_appendix=False)
  - Or use streaming DOCX generation (Stage 7)
  - Or optimize audit trail size
```

---

## TRACEABILITY QUERIES REFERENCE

### Forward Traceability Queries

**1. Get all reports for a calculation:**
```sql
SELECT r.report_id, r.current_stage, r.template_type
FROM reports r
JOIN report_audit_linkage l ON r.report_id = l.report_id
WHERE l.calculation_id = 'calc_001'
ORDER BY r.created_at DESC;
```

**2. Get audit trail for a report:**
```sql
SELECT unnest(ral.audit_event_ids) as audit_event_id
FROM report_audit_linkage ral
WHERE ral.report_id = 'rpt_calc_001_..._piping';
```

**3. Get validation results linked to report:**
```sql
SELECT unnest(ral.validation_event_ids) as validation_event_id
FROM report_audit_linkage ral
WHERE ral.report_id = 'rpt_calc_001_..._piping';
```

### Reverse Traceability Queries

**1. Get calculation for a report:**
```sql
SELECT l.calculation_id
FROM report_audit_linkage l
WHERE l.report_id = 'rpt_calc_001_..._piping';
```

**2. Get report metadata and identity:**
```sql
SELECT 
    r.report_id,
    r.calculation_id,
    r.identity_hash,
    r.inputs_hash,
    r.formula_hash,
    r.current_stage,
    r.is_stale
FROM reports r
WHERE r.report_id = 'rpt_calc_001_..._piping';
```

**3. Get complete generation context:**
```sql
SELECT 
    m.calculation_id,
    m.execution_time_ms,
    m.validation_status,
    m.template_type,
    m.template_version,
    m.engine_version
FROM report_generation_metadata m
WHERE m.report_id = 'rpt_calc_001_..._piping';
```

### Failure Analysis Queries

**1. Find failed reports:**
```sql
SELECT r.report_id, r.calculation_id, le.error_message
FROM reports r
JOIN report_lifecycle_events le ON r.report_id = le.report_id
WHERE le.error_message IS NOT NULL
ORDER BY le.event_timestamp DESC
LIMIT 20;
```

**2. Get lifecycle timeline for failed report:**
```sql
SELECT 
    stage,
    event_timestamp,
    duration_ms,
    error_message
FROM report_lifecycle_events
WHERE report_id = 'rpt_calc_001_..._piping'
ORDER BY event_timestamp ASC;
```

**3. Find stale reports:**
```sql
SELECT r.report_id, r.calculation_id, r.created_at
FROM reports r
WHERE r.is_stale = TRUE
ORDER BY r.created_at DESC;
```

---

## TRACEABILITY USE CASES

### Use Case 1: Regulatory Audit
**Requirement:** "Show proof that report XYZ was correctly generated from calculation ABC"

**Solution:**
1. Get report metadata (identity, hashes)
2. Get audit linkage (validation events)
3. Show lifecycle events (generation stages)
4. Verify identity against current calculation
5. Present complete chain: Calculation → Validation → Report

**Output:** Complete audit trail proving report authenticity

### Use Case 2: Root Cause Analysis
**Requirement:** "Report XYZ generation failed. What went wrong?"

**Solution:**
1. Get lifecycle events for report
2. Find error_message in failed stage
3. Link to calculation and its audit trail
4. Analyze which validation rule failed
5. Recommend remediation

**Output:** Root cause identified, path to fix clear

### Use Case 3: Report Comparison
**Requirement:** "Are reports XYZ and ABC generated from same calculation with different templates?"

**Solution:**
1. Get calculation_id from both reports
2. Compare identity_hashes
3. If calculation_ids same but identity_hashes different → Different templates/context
4. Show which components differ (inputs_hash, formula_hash, etc.)

**Output:** Detailed comparison showing differences

### Use Case 4: Verification
**Requirement:** "Has report XYZ been tampered with since generation?"

**Solution:**
1. Get report identity_hash
2. Re-compute identity from current calculation state
3. Compare hashes
4. If mismatch → Report is stale or tampered
5. Show what changed (inputs, formula, template)

**Output:** Tampering verification with details of changes

---

## DATABASE RELATIONSHIPS

### Entity-Relationship Diagram

```
Calculations Table
    |
    | 1:N (one calc → many reports)
    |
    ↓
Reports Table (with lifecycle metadata)
    |
    | 1:1 (bidirectional)
    |
    ↓
report_audit_linkage (references to audit/validation)
    |
    |├→ audit_event_ids (TEXT array)
    |└→ validation_event_ids (TEXT array)
    
Reports Table
    |
    | 1:N (one report → many lifecycle events)
    |
    ↓
report_lifecycle_events (chronological timeline)

Reports Table
    |
    | 1:1
    |
    ↓
report_generation_metadata (execution context)

Reports Table
    |
    | 1:1
    |
    ↓
report_staleness_tracking (modification detection)
```

---

## TRACEABILITY GUARANTEES

### What IS Guaranteed

✅ **Bidirectional Linkage:** Calculation ↔ Report is always maintained

✅ **Audit Event Reference:** All audit events from calculation linked to report

✅ **Validation Result Linkage:** All validation results traceable to report

✅ **Lifecycle Timeline:** Complete chronological record of generation stages

✅ **Error Propagation:** Any generation errors recorded with details

✅ **Staleness Detection:** Can identify if report is outdated

### What is NOT Guaranteed (Future Stages)

❌ **Tamper Prevention:** Identity can be recomputed, not cryptographically signed
   - *Mitigation (Stage 5):* HMAC signature

❌ **Audit Event Persistence:** Audit events not stored in reports table
   - *Mitigation (Stage 2):* Archive audit events with report

❌ **Immutability:** Links can be modified post-generation
   - *Mitigation (Stage 3):* Implement audit trail locking

❌ **Integrity Signature:** No signature preventing report modification
   - *Mitigation (Stage 6):* Digital signature

---

## IMPLEMENTATION CHECKLIST

- [x] report_audit_linkage table schema designed (5 columns)
- [x] report_lifecycle_events table schema finalized (7 columns)
- [x] report_generation_metadata table created (12 columns)
- [x] Foreign keys and indexes defined
- [x] Traceability queries documented (10+ examples)
- [x] Bidirectional linkage verified (tests)
- [x] Lifecycle timeline tracking implemented
- [x] Error propagation tested

---

## PERFORMANCE CONSIDERATIONS

### Query Performance

```
Typical traceability queries:

Forward trace (Calculation → Report):
  - Join: report_audit_linkage.calculation_id
  - Index: idx_audit_linkage_calculation_id
  - Expected: <5ms

Reverse trace (Report → Calculation):
  - Join: reports.report_id = report_audit_linkage.report_id
  - Index: idx_audit_linkage_report_id
  - Expected: <5ms

Lifecycle timeline:
  - Range query: report_lifecycle_events.report_id
  - Index: idx_lifecycle_events_report_id
  - Expected: <10ms
```

### Scalability
```
Expected volumes (per year):
- Calculations: ~10M
- Reports: ~10M (1:1 ratio)
- Audit events: ~50M (5 events per calculation)
- Lifecycle events: ~40M (4 stages per report)

Database size: ~10GB (indices included)
Expected growth: Manageable with archival (Stage 2+)
```

---

## FUTURE ENHANCEMENTS

### Stage 2: Audit Event Archival
- Store audit events within report record
- Enable offline access to complete audit trail

### Stage 3: Traceability Locking
- Prevent modification of linkage after generation
- Implement append-only audit trail

### Stage 5: Signature Integration
- Sign audit linkage with private key
- Verify signature to prove authenticity

### Stage 6: Regulatory Report
- Generate compliance report from traceability data
- Export complete audit chain for regulators

---

## CONCLUSION

The **Traceability System** establishes complete bidirectional linkage between calculations and reports, enabling:

✅ Engineering accountability (every report tied to calculation + audit trail)
✅ Regulatory compliance foundation (complete provenance metadata)
✅ Root cause analysis (trace failures to specific validation rules)
✅ Verification capabilities (detect tampering via identity hash)
✅ Future audit workflows (foundation for signatures and locks)

**Status:** ✅ TRACEABILITY SYSTEM COMPLETE, READY FOR REVIEW & INTEGRATION
