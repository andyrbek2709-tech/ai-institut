# OCR Lineage Architecture

> **Parallel OCR Lineage System**
> 
> *Complete lineage tracking for OCR preprocessing, execution, and corrections.*

**Document Version:** 1.0  
**Date:** 2026-05-10  
**Implements:** OCR Architecture Hardening Review, ЭТАП 4

---

## Overview

OCR lineage is **separate from deterministic extraction lineage**:

- **Deterministic lineage** (extraction_lineage): PDF binary → extracted blocks → extraction_hash
- **Probabilistic lineage** (ocr_lineage): PDF binary → image preprocessing → OCR engine → text + confidence

The two lineages are **parallel, never merged** at the hash level.

---

## OCR Lineage Model

### OCR Lineage Chain

```
PDF binary (scanned)
  │
  ├─ [Binary Hash: SHA256]
  │
  ├─→ Image Extraction (per page)
  │   ├─ [Page Hash: SHA256 of extracted image]
  │   └─ [Metadata: page number, image format, dimensions]
  │
  ├─→ Preprocessing Pipeline (VERSIONED)
  │   ├─ [Resize: 300 DPI]
  │   ├─ [Grayscale conversion]
  │   ├─ [Denoising: bilateral filter]
  │   ├─ [Thresholding: Otsu's method]
  │   ├─ [Skew correction]
  │   └─ [Preprocessed Image Hash: SHA256]
  │
  ├─→ OCR Engine (VERSIONED)
  │   ├─ [Engine: Tesseract 5.3.2]
  │   ├─ [Language models: eng-v2.1, rus-v3.0]
  │   ├─ [Config: page segmentation = 3]
  │   └─ [Raw OCR Output: text + per-character confidence]
  │
  ├─→ Confidence Scoring (VERSIONED)
  │   ├─ [Block segmentation: paragraphs, formulas, tables]
  │   ├─ [Per-block confidence calculation]
  │   └─ [Confidence flags: HIGH, MEDIUM, LOW, VERY_LOW]
  │
  └─→ Human Review Chain (Optional)
      ├─ [Correction 1: analyst-456, corrected_at: 2026-05-10 14:32:15]
      ├─ [Correction 2: analyst-789, corrected_at: 2026-05-10 15:12:34]
      └─ [Final status: VALIDATED]
```

---

## OCR Lineage Table Structure

### `ocr_lineage` (Core Lineage Table)

```sql
CREATE TABLE ocr_lineage (
  lineage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source
  document_id UUID NOT NULL REFERENCES documents(id),
  extraction_id UUID NOT NULL REFERENCES extractions(id),
  
  -- OCR Run Reference
  ocr_run_id UUID NOT NULL REFERENCES ocr_runs(ocr_run_id),
  
  -- Binary Identity
  pdf_binary_hash VARCHAR(64) NOT NULL,
  pdf_page_count INT,
  
  -- Preprocessing Lineage
  preprocessing_version VARCHAR(50) NOT NULL,     -- 'v1.0'
  preprocessing_steps JSONB NOT NULL,             -- [{op: 'resize', dpi: 300}, ...]
  preprocessed_image_hashes JSONB NOT NULL,       -- {page_1: 'abc...', page_2: 'def...'}
  
  -- OCR Engine Lineage
  ocr_engine_type VARCHAR(50) NOT NULL,           -- 'tesseract'
  ocr_engine_version VARCHAR(50) NOT NULL,        -- '5.3.2'
  ocr_language_packs VARCHAR[] NOT NULL,
  ocr_model_version VARCHAR(50),
  ocr_config JSONB NOT NULL,
  
  -- Confidence Scoring Lineage
  confidence_scoring_version VARCHAR(50) NOT NULL, -- 'v1.0'
  confidence_thresholds JSONB NOT NULL,           -- {paragraph: {HIGH: 0.95, MEDIUM: 0.85, ...}, ...}
  
  -- Raw Output
  raw_ocr_text TEXT NOT NULL,
  raw_block_confidences JSONB NOT NULL,           -- [{page: 1, block_id: 1, text: '...', confidence: 0.95}, ...]
  
  -- Correction Chain
  correction_chain JSONB,                         -- [{seq: 1, corrected_by: user-456, reason: 'LOW_CONFIDENCE', corrected_at: '2026-05-10T14:32:15Z'}, ...]
  correction_count INT DEFAULT 0,
  
  -- Final Status
  validation_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_review', 'validated', 'rejected'
  validated_by_user_id UUID,
  validated_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
) STRICT;

CREATE INDEX idx_ocr_lineage_document_id ON ocr_lineage(document_id);
CREATE INDEX idx_ocr_lineage_ocr_run_id ON ocr_lineage(ocr_run_id);
CREATE INDEX idx_ocr_lineage_preprocessing_version ON ocr_lineage(preprocessing_version);
CREATE INDEX idx_ocr_lineage_engine_version ON ocr_lineage(ocr_engine_type, ocr_engine_version);
CREATE INDEX idx_ocr_lineage_validation_status ON ocr_lineage(validation_status);
```

### `ocr_preprocessing_log` (Detailed Preprocessing Records)

```sql
CREATE TABLE ocr_preprocessing_log (
  preprocessing_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lineage_id UUID NOT NULL REFERENCES ocr_lineage(lineage_id),
  
  -- Page-level preprocessing
  page_number INT NOT NULL,
  original_image_hash VARCHAR(64),
  original_image_dimensions JSONB,                -- {width: 2048, height: 2820, dpi: 150}
  
  -- Preprocessing steps (versioned)
  step_sequence JSONB NOT NULL,                   -- [{step: 1, op: 'resize', params: {dpi: 300}, duration_ms: 125}]
  
  -- Preprocessed result
  preprocessed_image_hash VARCHAR(64) NOT NULL,
  preprocessed_image_dimensions JSONB,            -- {width: 2480, height: 3307, dpi: 300}
  preprocessing_duration_ms INT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT now()
) STRICT;

CREATE INDEX idx_preprocessing_log_lineage_id ON ocr_preprocessing_log(lineage_id);
```

### `ocr_correction_lineage` (Detailed Correction Tracking)

```sql
CREATE TABLE ocr_correction_lineage (
  correction_lineage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lineage_id UUID NOT NULL REFERENCES ocr_lineage(lineage_id),
  
  -- Correction sequence
  correction_sequence INT NOT NULL,
  
  -- What was corrected
  block_id INT,
  original_text TEXT,
  corrected_text TEXT NOT NULL,
  
  -- Confidence impact
  original_confidence FLOAT,
  corrected_confidence FLOAT,
  confidence_delta FLOAT,
  
  -- Who & why
  corrected_by_user_id UUID NOT NULL,
  correction_reason VARCHAR(100),                 -- 'LOW_CONFIDENCE', 'CONTEXT_ERROR', 'MANUAL_IMPROVEMENT'
  correction_notes TEXT,
  
  -- When
  corrected_at TIMESTAMP NOT NULL,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT now()
) STRICT;

CREATE INDEX idx_correction_lineage_lineage_id ON ocr_correction_lineage(lineage_id);
CREATE INDEX idx_correction_lineage_sequence ON ocr_correction_lineage(lineage_id, correction_sequence);
```

---

## OCR Lineage Queries

### 1. Complete Lineage Trace for Document

```sql
-- Show complete OCR lineage (from binary to corrections)
SELECT 
  l.lineage_id,
  l.pdf_binary_hash,
  l.preprocessing_version,
  l.ocr_engine_type || ' ' || l.ocr_engine_version AS ocr_engine,
  l.ocr_language_packs,
  l.confidence_scoring_version,
  l.validation_status,
  COUNT(DISTINCT cl.correction_sequence) AS corrections_applied,
  MAX(cl.corrected_at) AS final_correction_at,
  l.validated_at,
  l.validated_by_user_id
FROM ocr_lineage l
LEFT JOIN ocr_correction_lineage cl ON l.lineage_id = cl.lineage_id
WHERE l.document_id = 'doc-123'
GROUP BY l.lineage_id
ORDER BY l.created_at DESC;
```

### 2. Preprocessing Pipeline Audit

```sql
-- Show all preprocessing steps for a document
SELECT 
  pl.page_number,
  pl.original_image_dimensions,
  pl.step_sequence,
  pl.preprocessed_image_dimensions,
  pl.preprocessing_duration_ms
FROM ocr_preprocessing_log pl
JOIN ocr_lineage l ON pl.lineage_id = l.lineage_id
WHERE l.document_id = 'doc-123'
ORDER BY pl.page_number;
```

### 3. Correction Chain for Block

```sql
-- Show all corrections for a specific block
SELECT 
  cl.correction_sequence,
  cl.original_text,
  cl.corrected_text,
  cl.original_confidence,
  cl.corrected_confidence,
  cl.confidence_delta,
  cl.corrected_by_user_id,
  cl.correction_reason,
  cl.corrected_at
FROM ocr_correction_lineage cl
JOIN ocr_lineage l ON cl.lineage_id = l.lineage_id
WHERE l.document_id = 'doc-123' AND cl.block_id = 5
ORDER BY cl.correction_sequence;
```

### 4. Preprocessing Reproducibility Check

```sql
-- Verify: same binary + same preprocessing version = same preprocessed hash?
WITH preprocessing_runs AS (
  SELECT 
    l.pdf_binary_hash,
    l.preprocessing_version,
    pl.preprocessed_image_hash,
    COUNT(*) AS run_count
  FROM ocr_lineage l
  JOIN ocr_preprocessing_log pl ON l.lineage_id = pl.lineage_id
  WHERE l.validation_status = 'validated'
  GROUP BY l.pdf_binary_hash, l.preprocessing_version, pl.preprocessed_image_hash
)
SELECT 
  pdf_binary_hash,
  preprocessing_version,
  COUNT(DISTINCT preprocessed_image_hash) AS hash_variance,
  SUM(run_count) AS total_runs,
  CASE 
    WHEN COUNT(DISTINCT preprocessed_image_hash) = 1 THEN '✅ DETERMINISTIC'
    ELSE '⚠️ NONDETERMINISTIC'
  END AS verdict
FROM preprocessing_runs
GROUP BY pdf_binary_hash, preprocessing_version
HAVING SUM(run_count) > 1;
```

### 5. Lineage Comparison (Engine Upgrade)

```sql
-- Compare lineages before/after engine upgrade
WITH lineage_summary AS (
  SELECT 
    l.ocr_engine_version,
    COUNT(l.lineage_id) AS total_documents,
    AVG((l.raw_block_confidences->0->>'confidence')::FLOAT) AS avg_confidence,
    COUNT(DISTINCT cl.lineage_id) AS documents_with_corrections,
    AVG(l.correction_count) AS avg_corrections_per_doc
  FROM ocr_lineage l
  LEFT JOIN ocr_correction_lineage cl ON l.lineage_id = cl.lineage_id
  WHERE l.validation_status = 'validated'
  GROUP BY l.ocr_engine_version
)
SELECT 
  ocr_engine_version,
  total_documents,
  ROUND(avg_confidence, 3) AS avg_confidence,
  documents_with_corrections,
  ROUND(avg_corrections_per_doc, 2) AS avg_corrections_per_doc
FROM lineage_summary
ORDER BY ocr_engine_version DESC;
```

---

## Lineage Isolation Principle

### What OCR Lineage Contains

```
✅ Included in ocr_lineage:
  - OCR engine type and version
  - Image preprocessing chain (versioned)
  - OCR language models
  - Confidence scoring configuration
  - Correction history (who, when, why)
  - Validation status

❌ Never in ocr_lineage:
  - extraction_hash computation (separate from deterministic lineage)
  - extraction_id (referential only)
  - PDF content extraction details (those are in extraction_lineage)
```

### Lineage Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│  DETERMINISTIC EXTRACTION LINEAGE                              │
├────────────────────────────────────────────────────────────────┤
│  PDF binary → [Parser] → chunks → [Normalization] → extraction │
│  · extraction_hash: stable, reproducible                       │
│  · extraction_id: deterministic identity                       │
│  · Table: extraction_lineage                                   │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  PROBABILISTIC OCR LINEAGE (PARALLEL)                          │
├────────────────────────────────────────────────────────────────┤
│  PDF binary → [Preprocessing] → [OCR] → [Corrections] → valid  │
│  · ocr_lineage: tracks pipeline                                │
│  · ocr_preprocessing_log: preprocessing details                │
│  · ocr_correction_lineage: correction chain                    │
│  · ⚠️ NEVER merged with extraction_hash                        │
└────────────────────────────────────────────────────────────────┘

         Both lineages reference document_id
         but remain architecturally separated
```

---

## Lineage Integrity Guarantees

| Property | Guarantee |
|----------|-----------|
| **Preprocessing traceability** | Every preprocessing step versioned and recorded |
| **OCR engine traceability** | Engine type/version locked, not changed retroactively |
| **Correction auditability** | Every correction logged with user, reason, timestamp |
| **Preprocessing reproducibility** | Same binary + version = same preprocessing output (detectable drift) |
| **Lineage immutability** | Once created, lineage records are append-only |
| **Separation from determinism** | OCR lineage never influences extraction_hash |

---

## Lineage Reporting

### OCR Lineage Report Template

```
DOCUMENT: AGSK-2-Section-4.1 (doc-456)
BINARY HASH: f8a3e2c1d9b4e5c2f7a1d3b6c8e9f2a4

═══════════════════════════════════════════════════════════════

OCR LINEAGE SUMMARY

1. PREPROCESSING PIPELINE (v1.0)
   └─ Resize: 300 DPI
   └─ Grayscale conversion
   └─ Bilateral denoising (radius=5)
   └─ Otsu's automatic thresholding
   └─ Skew correction (deskew angle: -0.3°)
   Result: Preprocessed image hash = a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7

2. OCR ENGINE (Tesseract 5.3.2)
   └─ Language models: eng-v2.1, rus-v3.0
   └─ Page segmentation: PSM=3 (full page)
   └─ OEM: 1 (legacy + LSTM)
   Result: Raw OCR output = 1,542 characters

3. CONFIDENCE SCORING (v1.0)
   └─ Paragraph blocks: 45
   └─ Formula blocks: 3
   └─ Table blocks: 2
   └─ Average confidence: 0.89
   └─ Low-confidence blocks: 8 (flagged for review)

4. HUMAN REVIEW & CORRECTIONS (4 iterations)
   ├─ Iteration 1: analyst-456, 8 blocks corrected, confidence → 0.91
   ├─ Iteration 2: analyst-789, 2 blocks corrected, confidence → 0.93
   ├─ Iteration 3: supervisor-123, final validation, confidence → 0.95
   └─ Status: VALIDATED ✅

═══════════════════════════════════════════════════════════════

LINEAGE VERDICT: ✅ COMPLETE & AUDITABLE
  Preprocessing: deterministic (reproducible)
  OCR: consistent (same engine version, same output)
  Corrections: fully logged (4 versions, final confidence = 0.95)
  Validation: complete (signed by supervisor)
```

---

## Integration with Extraction

```python
class ExtractionWithOCRLineage:
    """
    Link extraction to OCR lineage.
    """
    
    def create_extraction_from_ocr(self, document_id, lineage_id):
        """
        For scanned PDFs, extraction is based on OCR lineage,
        not deterministic parser lineage.
        """
        
        lineage = get_ocr_lineage(lineage_id)
        
        extraction = {
            'extraction_id': generate_uuid(),
            'document_id': document_id,
            'extraction_source': 'ocr',
            'ocr_lineage_id': lineage_id,
            'source_binary_hash': lineage.pdf_binary_hash,
            'extraction_version': 1,
            'extracted_blocks': get_validated_blocks(lineage_id),
            'confidence': lineage.validated_confidence,
            'created_at': now(),
            'lineage': {
                'type': 'ocr_based',
                'preprocessing_version': lineage.preprocessing_version,
                'ocr_engine': lineage.ocr_engine_version,
                'corrections_applied': lineage.correction_count
            }
        }
        
        return extraction
```

---

## Status

✅ **LINEAGE ARCHITECTURE DESIGNED**
- Separate lineage tables defined
- Preprocessing logging designed
- Correction chain tracking
- Reproducibility checks
- Integrity guarantees established

🔴 **NOT IMPLEMENTED** until all ЕТAPS 1-8 complete + review gate passed

---

## Next

- **ЭТАП 5:** Image Preprocessing Stability (formalize versioning, ensure determinism)
- **ЭТАП 6:** Human Review Workflow (mandatory review process)
- **ЕТАП 7:** OCR Determinism Contract (formal boundary declaration)
