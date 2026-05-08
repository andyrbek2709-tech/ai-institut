# OCR Architecture Hardening Review

> **Critical Stability Gate Before OCR Implementation**
> 
> *Designed to preserve deterministic PDF parser foundation while safely integrating probabilistic OCR capability.*

**Status:** 🔴 **ARCHITECTURE DESIGN PHASE** — NOT IMPLEMENTATION YET

**Document Version:** 1.0  
**Date:** 2026-05-10  
**Phase:** PDF Parser Phase 2 → Phase 3 (OCR Support)

---

## Executive Summary

The PDF Parser Phase 2 foundation is **deterministic, reproducible, and audit-safe**. OCR inherently adds probabilism. This review designs an **isolated OCR layer** that:

✅ **Preserves deterministic extraction** — extraction_hash remains stable  
✅ **Isolates probabilism** — OCR outputs never become normative truth  
✅ **Maintains auditability** — OCR lineage fully captured  
✅ **Supports human review** — low-confidence OCR requires validation  
✅ **Prevents nondeterminism leakage** — determinism boundary formally declared  

---

## Architecture Overview: Two-Layer Model

```
┌─────────────────────────────────────────────────────────────────┐
│  DETERMINISTIC LAYER (Parser Foundation)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PDF Input → [Deterministic Extraction] → extraction_hash       │
│                                                                 │
│  • Stable ordering (page, offset)                              │
│  • Normalization (UTF-8, encoding stable)                      │
│  • Lineage immutable (version-locked)                          │
│  • Reproducible (100+ runs = 1 hash)                           │
│                                                                 │
└──────────────────────┬──────────────────────────────────────────┘
                       │ extraction_hash (deterministic truth)
                       │
    ┌──────────────────▼──────────────────────────────────┐
    │  VALIDATION STAGE (Human Review + OCR Assistance)  │
    │                                                     │
    │  Use Case 1: Native-PDF (human → normative)        │
    │  Use Case 2: Scanned-PDF (OCR → candidate)         │
    │                                                     │
    └─────────────────────────────────────────────────────┘
                       │ validated_extraction (v1, v2, ...)
                       │
    ┌──────────────────▼──────────────────────────────────┐
    │  PROBABILISTIC OCR LAYER (Assistance Only)         │
    ├──────────────────────────────────────────────────────┤
    │                                                      │
    │  Scanned PDF → [OCR Engine] → text + confidence    │
    │                                                      │
    │  • OCR output ≠ canonical truth                     │
    │  • Requires confidence scoring (per-block)         │
    │  • Requires human validation (mandatory if low)    │
    │  • Lineage tracked separately (non-deterministic)  │
    │                                                      │
    └──────────────────────────────────────────────────────┘
```

---

## ЭТАП 1: OCR Isolation Architecture

### Principle
**Probabilistic OCR must not influence deterministic extraction.**

### Design

#### Input Classification
```sql
-- Native vs. Scanned classification
-- (Part of deterministic extraction phase)

INPUT_CLASSIFICATION:
  binary_hash (PDF binary content hash)
  │
  ├─→ [Heuristic: text density > 80%] → native_pdf_flag = TRUE
  │   (Direct extraction via PDFParser)
  │
  └─→ [Heuristic: text density < 30%] → scanned_pdf_flag = TRUE
      (Requires OCR path)
```

#### Extraction Paths (Isolated)

**Path A: Native PDF (Deterministic)**
```
PDF binary
  → PDFParser (deterministic)
  → extraction_hash (stable)
  → extracted_text (canonical)
  → confidence = 1.0 (implicit, text from PDF objects)
```

**Path B: Scanned PDF (Probabilistic, Isolated)**
```
PDF binary
  → Image extraction (deterministic: per-page images)
  → OCR engine (probabilistic)
  → ocr_text + ocr_confidence (non-deterministic)
  → Human review mandatory
  → validated_extraction (after human approval)
  → confidence = human_confidence (explicit)
```

### Critical Rule: No Mixing Paths

- **extraction_hash is computed ONLY from Path A output**
- OCR output (Path B) is stored in **separate fields** (ocr_text, ocr_confidence)
- Human review result (Path B validated_extraction) has **different versioning** than extraction_hash
- OCR metadata **never included in hash computation**

---

## ЕТАП 2: OCR Audit Architecture

### Principle
**OCR must be fully auditable without compromising extraction identity.**

### OCR Metadata Model

```sql
-- ocr_runs table (NEW)
CREATE TABLE ocr_runs (
  ocr_run_id UUID PRIMARY KEY,
  
  -- Source
  document_id UUID REFERENCES documents(id),
  extraction_id UUID REFERENCES extractions(id),
  scanned_pdf_binary_hash VARCHAR(64),  -- SHA256 of PDF binary
  
  -- OCR Engine Version (VERSIONED)
  ocr_engine_type VARCHAR(50),          -- 'tesseract', 'paddleocr', etc.
  ocr_engine_version VARCHAR(50),       -- '5.3.2', '3.1.0'
  ocr_language_packs VARCHAR[],         -- ['eng-v2.1', 'rus-v3.0']
  
  -- Preprocessing Pipeline (VERSIONED)
  preprocessing_config JSONB,           -- {resize: 300dpi, threshold: auto, grayscale: true}
  preprocessing_version VARCHAR(20),    -- 'v1.0'
  preprocessing_timestamp TIMESTAMP,    -- When preprocessing applied
  
  -- Image Hash (Deterministic)
  preprocessed_image_hash VARCHAR(64),  -- SHA256 of preprocessed image
  
  -- OCR Output
  raw_ocr_text TEXT,                    -- Raw OCR text
  ocr_confidence_avg FLOAT,             -- Average confidence (0.0-1.0)
  block_confidences JSONB,              -- [{"block_id": 1, "confidence": 0.95}, ...]
  
  -- Lineage
  ocr_operator_user_id UUID,            -- Who initiated OCR (if manual)
  ocr_triggered_by VARCHAR(50),         -- 'automated', 'manual_override'
  ocr_correction_chain JSONB[],         -- [{version: 1, corrected_by_user_id: ..., timestamp: ...}]
  
  -- Timestamps (Non-deterministic)
  ocr_started_at TIMESTAMP,
  ocr_completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Indexed for audit trails
CREATE INDEX idx_ocr_runs_document_id ON ocr_runs(document_id);
CREATE INDEX idx_ocr_runs_extraction_id ON ocr_runs(extraction_id);
CREATE INDEX idx_ocr_runs_binary_hash ON ocr_runs(scanned_pdf_binary_hash);
CREATE INDEX idx_ocr_runs_engine_version ON ocr_runs(ocr_engine_version, ocr_engine_type);
```

### Audit Query Examples

```sql
-- Audit: Which OCR engine processed this document?
SELECT ocr_engine_type, ocr_engine_version, ocr_run_id
FROM ocr_runs
WHERE document_id = 'doc-123'
ORDER BY created_at DESC
LIMIT 1;

-- Audit: How did OCR confidence change after correction?
SELECT 
  ocr_run_id,
  ocr_confidence_avg,
  ocr_correction_chain,
  updated_at
FROM ocr_runs
WHERE document_id = 'doc-123'
ORDER BY updated_at;

-- Audit: Consistency check — same binary, same OCR engine, different output?
SELECT 
  scanned_pdf_binary_hash,
  ocr_engine_version,
  COUNT(DISTINCT raw_ocr_text) AS text_variance,
  COUNT(*) AS total_runs
FROM ocr_runs
GROUP BY scanned_pdf_binary_hash, ocr_engine_version
HAVING COUNT(DISTINCT raw_ocr_text) > 1;
```

---

## ЭТАП 3: OCR Confidence Model

### Principle
**Low-confidence OCR output must not become normative truth.**

### Confidence Hierarchy

#### Block-Level Confidence
```python
class OCRConfidenceModel:
    """
    Confidence scored at multiple granularities.
    Low confidence → mandatory human review.
    """
    
    def calculate_block_confidence(self, ocr_block):
        """
        Block: paragraph, table, formula, figure.
        Confidence = (character_avg + structure_score + language_model_score) / 3
        """
        char_confidence = mean([c.confidence for c in ocr_block.characters])
        
        # Structure confidence: block layout matches expected pattern
        structure_score = self.match_structure_pattern(ocr_block)
        
        # Language model: does text make linguistic sense?
        lang_model_score = self.language_model_score(ocr_block.text)
        
        block_confidence = (char_confidence + structure_score + lang_model_score) / 3
        return block_confidence
    
    def confidence_flags(self, block_confidence):
        """
        Assign action flags based on confidence threshold.
        """
        if block_confidence >= 0.95:
            return "HIGH_CONFIDENCE"  # Auto-accept candidate
        elif 0.85 <= block_confidence < 0.95:
            return "MEDIUM_CONFIDENCE"  # Flag for review, but acceptable
        elif 0.70 <= block_confidence < 0.85:
            return "LOW_CONFIDENCE"  # Mandatory human review
        else:
            return "VERY_LOW_CONFIDENCE"  # Reject, re-OCR or manual entry
```

#### Formula-Level Confidence
```
Formula OCR is especially risky (complex structure, many characters).

Rules:
- Formula block confidence = minimum(character_confidence, structure_confidence)
- Math symbol recognition requires >0.90 confidence
- If any symbol < 0.85: mark REQUIRES_REVIEW
- If dominant = VERY_LOW, suggest manual entry
```

#### Table-Level Confidence
```
Table OCR requires structural understanding (row/column).

Rules:
- Table confidence = (cell_avg + boundary_detection + header_detection) / 3
- If cell_confidence < 0.80: mark cell as UNCERTAIN
- If row_boundary < 0.85: flag REQUIRES_STRUCTURAL_REVIEW
- Merged cells: if confidence < 0.90, flag REQUIRES_MANUAL_ADJUSTMENT
```

### Confidence Workflow

```
1. OCR produces text + per-character confidence
   ↓
2. Block-level aggregation (paragraph, formula, table, etc.)
   ↓
3. Confidence flags assigned (HIGH, MEDIUM, LOW, VERY_LOW)
   ↓
4. Dispatch by flag:
   ├─→ HIGH_CONFIDENCE      → Add to candidate_extraction (auto-candidate)
   ├─→ MEDIUM_CONFIDENCE    → Add to candidate_extraction (flag for review)
   ├─→ LOW_CONFIDENCE       → Store in low_confidence_pool (requires mandatory human review)
   └─→ VERY_LOW_CONFIDENCE  → Reject (suggest manual entry or re-image)
   ↓
5. Human review workflow (see ЭТАП 6)
```

---

## Key Invariants (Through ЭТАП 3)

| Property | Guarantee | Rationale |
|----------|-----------|-----------|
| **extraction_hash** | Computed from Path A only (native PDF) | OCR is Path B (isolated) |
| **extraction_id** | Deterministic identity, unchanged by OCR | OCR stores in ocr_runs (separate table) |
| **OCR metadata** | Never included in extraction_hash | Audit trail separation principle |
| **confidence field** | Split: extraction_confidence (=1.0 for native, explicit for OCR-validated) vs. block_confidences | Granular audit trail |
| **Reproducibility** | Native PDF: same hash across runs. Scanned PDF: same image → same OCR output (for same engine version) | Determinism boundary formalized |

---

## Next Steps (ЭТАП 4-8)

- **ЭТАП 4:** OCR Lineage Architecture (parallel tracking system)
- **ЭТАП 5:** Image Preprocessing Stability (formalize versioning)
- **ЭТАП 6:** Human Review Workflow (mandatory for low-confidence)
- **ЭТАП 7:** OCR Determinism Contract (formal boundary declaration)
- **ЭТАП 8:** OCR Review Gate (sign-off checklist)

---

## Status

✅ **ЭТАП 1-3 DESIGN COMPLETE**
- OCR isolation architecture defined
- Audit metadata model finalized
- Confidence scoring rules established
- Critical invariants identified

❌ **OCR IMPLEMENTATION BLOCKED** until remaining ETAPs completed + review gate passed

---

## Document Roadmap

1. ✅ `OCR_ARCHITECTURE_HARDENING.md` (THIS) — Etaps 1-3, isolation + audit + confidence
2. 📋 `OCR_AUDIT_ARCHITECTURE.md` (NEXT) — Etap 2 detailed, audit queries, compliance
3. 📋 `OCR_CONFIDENCE_MODEL.md` (NEXT) — Etap 3 detailed, confidence algorithms, examples
4. 📋 `OCR_LINEAGE_ARCHITECTURE.md` (NEXT) — Etap 4, lineage tracking system
5. 📋 `OCR_DETERMINISM_BOUNDARY.md` (NEXT) — Etaps 5-8, preprocessing, human review, contract
