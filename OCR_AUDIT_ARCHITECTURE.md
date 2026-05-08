# OCR Audit Architecture

> **Detailed Audit Model for OCR Layer**
> 
> *Full traceability of OCR decisions, corrections, and confidence evolution.*

**Document Version:** 1.0  
**Date:** 2026-05-10  
**Implements:** OCR Architecture Hardening Review, ЭТАП 2

---

## Overview

OCR audit system must support:
1. **Full lineage** — where text came from (OCR engine, version, timestamp)
2. **Confidence tracking** — how confident we are (per-block, per-run)
3. **Correction history** — what humans changed and why
4. **Reproducibility verification** — same input → consistent OCR output
5. **Compliance** — regulatory audit trails for engineering documents

---

## Audit Table Structure

### Core Audit Tables

#### `ocr_runs` (OCR Execution Records)

```sql
CREATE TABLE ocr_runs (
  ocr_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source Reference
  document_id UUID NOT NULL REFERENCES documents(id),
  extraction_id UUID NOT NULL REFERENCES extractions(id),
  
  -- Binary Identity (Deterministic)
  scanned_pdf_binary_hash VARCHAR(64) NOT NULL,  -- SHA256(PDF binary)
  pdf_page_count INT,
  pdf_metadata JSONB,  -- Filename, size, producer
  
  -- OCR Engine Configuration (VERSIONED)
  ocr_engine_type VARCHAR(50) NOT NULL,          -- 'tesseract', 'paddleocr', 'google_vision'
  ocr_engine_version VARCHAR(50) NOT NULL,       -- '5.3.2', '3.1.0'
  ocr_engine_config JSONB,                       -- Engine-specific params (dpi, threshold, etc.)
  
  -- Language & Recognition Models (VERSIONED)
  ocr_language_packs VARCHAR[] NOT NULL,         -- ['eng-v2.1', 'rus-v3.0']
  ocr_model_version VARCHAR(50),                 -- Model training date/version
  
  -- Image Preprocessing (VERSIONED)
  preprocessing_pipeline JSONB NOT NULL,         -- {steps: [{op: 'resize', dpi: 300}, {op: 'grayscale'}, ...]}
  preprocessing_version VARCHAR(50) NOT NULL,    -- 'v1.0' (locked)
  preprocessed_image_hash VARCHAR(64),           -- SHA256 of preprocessed image (for reproducibility check)
  
  -- OCR Output (Probabilistic)
  raw_ocr_text TEXT NOT NULL,
  ocr_text_length INT,
  ocr_character_count INT,
  ocr_block_count INT,  -- Number of detected blocks
  
  -- Confidence Scores (Probabilistic)
  ocr_confidence_avg FLOAT,                      -- Average per-character confidence
  ocr_confidence_min FLOAT,                      -- Minimum confidence in any character
  block_confidences JSONB,                       -- [{page: 1, block_id: 1, text: "...", confidence: 0.95}, ...]
  
  -- Language Detection
  detected_languages JSONB,                      -- [{language: 'en', confidence: 0.98}, {language: 'ru', confidence: 0.01}]
  
  -- Triggers & Operator (Non-deterministic)
  ocr_triggered_by VARCHAR(50) NOT NULL,        -- 'automated_scanned_pdf', 'manual_override'
  ocr_operator_user_id UUID,                     -- WHO initiated (if manual)
  ocr_initiated_by_automation_rule VARCHAR(255), -- WHAT rule triggered (if automatic)
  
  -- Timestamps (Non-deterministic)
  ocr_requested_at TIMESTAMP NOT NULL,
  ocr_started_at TIMESTAMP NOT NULL,
  ocr_completed_at TIMESTAMP NOT NULL,
  ocr_duration_seconds INT,
  
  -- Status
  ocr_status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- 'pending', 'processing', 'success', 'failed'
  ocr_error_message TEXT,  -- If failed
  
  -- Audit Metadata
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
) STRICT;

CREATE INDEX idx_ocr_runs_document_id ON ocr_runs(document_id);
CREATE INDEX idx_ocr_runs_extraction_id ON ocr_runs(extraction_id);
CREATE INDEX idx_ocr_runs_binary_hash ON ocr_runs(scanned_pdf_binary_hash);
CREATE INDEX idx_ocr_runs_engine_version ON ocr_runs(ocr_engine_type, ocr_engine_version);
CREATE INDEX idx_ocr_runs_status ON ocr_runs(ocr_status, created_at DESC);
```

#### `ocr_corrections` (Human Review & Corrections)

```sql
CREATE TABLE ocr_corrections (
  correction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocr_run_id UUID NOT NULL REFERENCES ocr_runs(ocr_run_id),
  
  -- What was corrected
  block_id INT,                               -- If block-level correction
  original_ocr_text TEXT,
  corrected_text TEXT NOT NULL,
  
  -- Why it was corrected
  correction_reason VARCHAR(100),             -- 'confidence_too_low', 'manual_review', 'context_error'
  correction_confidence_threshold FLOAT,      -- If reason = confidence_too_low, what was threshold?
  
  -- Who corrected
  corrected_by_user_id UUID NOT NULL,
  correction_approved_by_user_id UUID,
  
  -- When
  corrected_at TIMESTAMP NOT NULL,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT now()
) STRICT;

CREATE INDEX idx_ocr_corrections_ocr_run_id ON ocr_corrections(ocr_run_id);
CREATE INDEX idx_ocr_corrections_reason ON ocr_corrections(correction_reason);
```

#### `ocr_confidence_evolution` (Tracking confidence changes)

```sql
CREATE TABLE ocr_confidence_evolution (
  evolution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocr_run_id UUID NOT NULL REFERENCES ocr_runs(ocr_run_id),
  
  -- Confidence snapshot
  snapshot_version INT NOT NULL,               -- 1 (raw OCR), 2 (after first correction), etc.
  ocr_confidence_avg FLOAT,
  block_confidences_snapshot JSONB,
  
  -- What changed
  change_description VARCHAR(255),             -- 'manual_correction', 'engine_upgrade', etc.
  
  -- When
  snapshot_at TIMESTAMP NOT NULL,
  
  created_at TIMESTAMP DEFAULT now()
) STRICT;

CREATE INDEX idx_confidence_evolution_ocr_run_id ON ocr_confidence_evolution(ocr_run_id);
```

---

## Audit Query Examples

### 1. Document OCR History
```sql
-- Show all OCR runs for a document (complete history)
SELECT 
  ocr_run_id,
  ocr_engine_type,
  ocr_engine_version,
  ocr_confidence_avg,
  ocr_triggered_by,
  ocr_operator_user_id,
  ocr_status,
  ocr_started_at,
  ocr_completed_at,
  ocr_duration_seconds
FROM ocr_runs
WHERE document_id = 'doc-123'
ORDER BY ocr_started_at DESC;
```

### 2. OCR Engine Consistency Check
```sql
-- Same PDF binary + same engine version = same output?
WITH pdf_scans AS (
  SELECT 
    scanned_pdf_binary_hash,
    ocr_engine_version,
    raw_ocr_text,
    ocr_confidence_avg,
    ocr_run_id
  FROM ocr_runs
  WHERE ocr_status = 'success'
)
SELECT 
  scanned_pdf_binary_hash,
  ocr_engine_version,
  COUNT(DISTINCT raw_ocr_text) AS text_variance,
  COUNT(DISTINCT ocr_confidence_avg) AS confidence_variance,
  COUNT(*) AS total_runs,
  CASE 
    WHEN COUNT(DISTINCT raw_ocr_text) = 1 THEN 'CONSISTENT'
    ELSE 'INCONSISTENT (⚠️ INVESTIGATE)'
  END AS consistency_verdict
FROM pdf_scans
GROUP BY scanned_pdf_binary_hash, ocr_engine_version
HAVING COUNT(*) > 1;
```

### 3. Low-Confidence Blocks Requiring Review
```sql
-- Find OCR blocks below confidence threshold
SELECT 
  ocr_run_id,
  extraction_id,
  block->>'page' AS page_num,
  block->>'block_id' AS block_id,
  block->>'text' AS ocr_text,
  (block->>'confidence')::FLOAT AS confidence,
  CASE 
    WHEN (block->>'confidence')::FLOAT < 0.70 THEN 'VERY_LOW'
    WHEN (block->>'confidence')::FLOAT < 0.85 THEN 'LOW'
    ELSE 'ACCEPTABLE'
  END AS flag
FROM ocr_runs,
LATERAL jsonb_array_elements(block_confidences) AS block
WHERE (block->>'confidence')::FLOAT < 0.85
ORDER BY confidence ASC;
```

### 4. Correction Impact Analysis
```sql
-- Track how many blocks were corrected after OCR
SELECT 
  o.ocr_run_id,
  COUNT(DISTINCT c.block_id) AS blocks_corrected,
  COUNT(DISTINCT c.correction_id) AS total_corrections,
  ROUND(100.0 * COUNT(DISTINCT c.block_id) / o.ocr_block_count, 2) AS correction_percentage
FROM ocr_runs o
LEFT JOIN ocr_corrections c ON o.ocr_run_id = c.ocr_run_id
WHERE o.document_id = 'doc-123'
GROUP BY o.ocr_run_id
ORDER BY correction_percentage DESC;
```

### 5. Engine Upgrade Impact
```sql
-- Compare OCR quality before/after engine upgrade
WITH engine_versions AS (
  SELECT DISTINCT ocr_engine_version FROM ocr_runs ORDER BY ocr_engine_version
)
SELECT 
  o.ocr_engine_version,
  COUNT(o.ocr_run_id) AS total_runs,
  ROUND(AVG(o.ocr_confidence_avg), 3) AS avg_confidence,
  ROUND(MIN(o.ocr_confidence_min), 3) AS min_confidence,
  COUNT(CASE WHEN o.ocr_status = 'failed' THEN 1 END) AS failed_runs,
  ROUND(100.0 * COUNT(CASE WHEN o.ocr_status = 'failed' THEN 1 END) / COUNT(*), 1) AS failure_rate_percent
FROM ocr_runs o
GROUP BY o.ocr_engine_version
ORDER BY o.ocr_engine_version DESC;
```

### 6. Preprocessing Pipeline Reproducibility
```sql
-- Verify preprocessing is stable (same input → same preprocessed image hash)
SELECT 
  scanned_pdf_binary_hash,
  preprocessing_version,
  COUNT(DISTINCT preprocessed_image_hash) AS image_hash_variance,
  COUNT(*) AS total_runs,
  CASE 
    WHEN COUNT(DISTINCT preprocessed_image_hash) = 1 THEN 'DETERMINISTIC ✅'
    ELSE 'NONDETERMINISTIC ⚠️'
  END AS preprocessing_verdict
FROM ocr_runs
WHERE ocr_status = 'success'
GROUP BY scanned_pdf_binary_hash, preprocessing_version
HAVING COUNT(*) > 1;
```

### 7. Confidence Degradation Tracking
```sql
-- Track if confidence drops after corrections
SELECT 
  o.ocr_run_id,
  o.ocr_confidence_avg AS initial_confidence,
  ce.ocr_confidence_avg AS final_confidence,
  ROUND(ce.ocr_confidence_avg - o.ocr_confidence_avg, 3) AS confidence_delta,
  COUNT(c.correction_id) AS corrections_applied,
  CASE 
    WHEN ce.ocr_confidence_avg < o.ocr_confidence_avg THEN 'DEGRADED ⚠️'
    WHEN ce.ocr_confidence_avg > o.ocr_confidence_avg THEN 'IMPROVED ✅'
    ELSE 'UNCHANGED'
  END AS confidence_trend
FROM ocr_runs o
LEFT JOIN ocr_confidence_evolution ce ON o.ocr_run_id = ce.ocr_run_id 
  AND ce.snapshot_version = (
    SELECT MAX(snapshot_version) FROM ocr_confidence_evolution 
    WHERE ocr_run_id = o.ocr_run_id
  )
LEFT JOIN ocr_corrections c ON o.ocr_run_id = c.ocr_run_id
WHERE o.document_id = 'doc-123'
GROUP BY o.ocr_run_id, o.ocr_confidence_avg, ce.ocr_confidence_avg;
```

---

## Audit Report Examples

### Example 1: OCR Audit Report for Single Document

```
DOCUMENT: AGSK-1-Section-2.3 (doc-789)
BINARY HASH: a3f2e8c1d9b4e5c2f7a1d3b6c8e9f2a4

═══════════════════════════════════════════

OCR RUN #1 (INITIAL SCAN)
  Engine: tesseract 5.3.2
  Triggered: automated_scanned_pdf
  Status: SUCCESS
  Confidence: avg=0.87, min=0.42
  Duration: 12.3 seconds
  Blocks detected: 24
  Blocks with confidence < 0.80: 6 (25%) ⚠️

OCR RUN #2 (AFTER CORRECTION)
  Engine: tesseract 5.3.2
  Triggered: manual_correction (user: analyst-456)
  Status: SUCCESS
  Corrections applied: 8 blocks
  Confidence after: avg=0.91, min=0.68
  Duration: 8.2 seconds (reprocessing)
  Blocks with confidence < 0.80: 2 (8%) ✅

═══════════════════════════════════════════

AUDIT VERDICT:
  ✅ OCR runs consistent (same engine version, same preprocessed image hash)
  ✅ Confidence improved after manual corrections
  ⚠️ Formula block (page 2, block 5) still shows low confidence (0.68)
     → RECOMMENDATION: manual entry for formula

COMPLIANCE: All OCR metadata captured, lineage complete
```

### Example 2: Engine Version Comparison Report

```
DOCUMENT BATCH: AGSK Standards (1,500 pages)

────────────────────────────────────────────
Tesseract 5.2.0 (Previous)
  Documents processed: 1,200
  Avg confidence: 0.84
  Failure rate: 2.1%
  Avg correction %: 18%
  Manual review time: 2,400 hours

Tesseract 5.3.2 (Current)
  Documents processed: 1,200
  Avg confidence: 0.89 (+5.9%)
  Failure rate: 0.8% (-60%)
  Avg correction %: 12% (-33%)
  Est. manual review time: 1,440 hours (-40%)

────────────────────────────────────────────
IMPACT: Upgrade RECOMMENDED ✅
  Cost: engine update, re-OCR batch
  Benefit: 40% reduction in manual review, 6% confidence improvement
```

---

## Compliance Support

### 1. Regulatory Audit Trail
```sql
-- Generate complete audit trail for regulatory inspection
SELECT 
  o.ocr_run_id,
  o.scanned_pdf_binary_hash,
  o.ocr_engine_type || ' ' || o.ocr_engine_version AS engine,
  o.ocr_confidence_avg,
  o.ocr_operator_user_id,
  o.ocr_initiated_by_automation_rule,
  o.ocr_status,
  o.ocr_started_at,
  o.ocr_completed_at,
  COUNT(c.correction_id) AS human_corrections,
  STRING_AGG(c.correction_reason, ', ') AS correction_types
FROM ocr_runs o
LEFT JOIN ocr_corrections c ON o.ocr_run_id = c.ocr_run_id
WHERE o.document_id = 'doc-789'
GROUP BY o.ocr_run_id
ORDER BY o.ocr_started_at;
```

### 2. Confidence Validation Certificate
```
DOCUMENT: Engineering Standard AGSK-2 v3.1
EXTRACTED: 2026-05-10 14:32:42 UTC
OCR STATUS: VALIDATED ✅

Confidence thresholds:
  ≥ 0.95: Auto-acceptable (HIGH)
  0.85-0.94: Acceptable with review (MEDIUM)
  0.70-0.84: Requires manual review (LOW)
  < 0.70: Rejected or manual entry (VERY_LOW)

Block distribution:
  HIGH (≥0.95): 156 blocks (68%)
  MEDIUM (0.85-0.94): 52 blocks (23%)
  LOW (0.70-0.84): 18 blocks (8%)
  VERY_LOW (<0.70): 2 blocks (1%)

Human review: 20 blocks (9%) reviewed and approved
Final confidence: 0.92 (after corrections)

Signed by: ocr_validator (system), approved_by: human-analyst-456
Date: 2026-05-10 15:45:22 UTC
```

---

## Key Guarantees

| Property | Guarantee |
|----------|-----------|
| **OCR lineage** | Every OCR run logged with engine, version, timestamp |
| **Confidence audit** | Every block's confidence tracked, history preserved |
| **Reproducibility verification** | Same binary + engine = same output (detectable drift) |
| **Correction history** | Every human correction logged with who/when/why |
| **Compliance readiness** | Full audit trail for regulatory inspection |
| **No mixing** | OCR metadata never affects extraction_hash |

---

## Status

✅ **AUDIT ARCHITECTURE DESIGNED**
- Tables defined
- Queries documented
- Compliance examples provided
- Report templates ready

🔴 **NOT IMPLEMENTED** until all ETAPA 1-8 complete + review gate passed
