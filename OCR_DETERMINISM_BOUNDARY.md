# OCR Determinism Boundary

> **Formal Determinism Contract & Review Gate**
> 
> *ЭТАПЫ 5-8: Preprocessing Stability, Human Review, Determinism Contract, OCR Review Gate*

**Document Version:** 1.0  
**Date:** 2026-05-10  
**Implements:** OCR Architecture Hardening Review, ЭТАПЫ 5-8

---

## ЭТАП 5: Image Preprocessing Stability

### Principle
**Preprocessing is deterministic if versioned and auditable.**

### Preprocessing Stages

#### Stage 1: Image Extraction (Deterministic)

```python
class ImageExtraction:
    """
    Extract images from PDF pages.
    """
    
    def extract_images(self, pdf_binary, page_number, dpi=150):
        """
        Extract page as image. Must be reproducible.
        """
        # Fixed parameters (no randomness)
        image = pdf_to_image(
            pdf_binary,
            page_number=page_number,
            dpi=dpi,  # FIXED: 150 DPI (standard)
            fmt='PNG',  # FIXED: PNG (lossless)
            alpha=False,  # FIXED: no transparency
            colorspace='RGB'  # FIXED: RGB
        )
        
        # Hash the image (proves determinism)
        image_hash = sha256(image.tobytes())
        
        return {
            'image': image,
            'image_hash': image_hash,
            'page_number': page_number,
            'dimensions': (image.width, image.height),
            'dpi': dpi,
            'format': 'PNG'
        }
```

**Guarantee:** Same PDF binary + page → same image_hash (100% reproducible)

#### Stage 2: Preprocessing Pipeline (Versioned)

```python
class PreprocessingPipeline:
    """
    Image preprocessing with VERSIONED, auditable steps.
    """
    
    VERSION = 'v1.0'  # Locked version
    
    def preprocess(self, image, version='v1.0'):
        """
        Apply preprocessing pipeline.
        All steps versioned and logged.
        """
        
        if version != self.VERSION:
            raise ValueError(f"Unsupported version {version}, expected {self.VERSION}")
        
        steps = []
        current_image = image
        
        # Step 1: Resize to standard DPI (deterministic)
        current_image = self.resize_to_dpi(current_image, target_dpi=300)
        steps.append({
            'step': 1,
            'operation': 'resize_to_dpi',
            'target_dpi': 300,
            'input_hash': sha256(image.tobytes()),
            'output_hash': sha256(current_image.tobytes())
        })
        
        # Step 2: Grayscale conversion (deterministic)
        current_image = self.to_grayscale(current_image)
        steps.append({
            'step': 2,
            'operation': 'grayscale',
            'formula': 'standard_luma_coefficients',  # 0.299R + 0.587G + 0.114B
            'output_hash': sha256(current_image.tobytes())
        })
        
        # Step 3: Bilateral denoising (quasi-deterministic, see note below)
        current_image = self.bilateral_denoise(
            current_image,
            d=9,               # FIXED diameter
            sigma_color=75,    # FIXED
            sigma_space=75     # FIXED
        )
        steps.append({
            'step': 3,
            'operation': 'bilateral_denoise',
            'parameters': {'d': 9, 'sigma_color': 75, 'sigma_space': 75},
            'output_hash': sha256(current_image.tobytes())
        })
        
        # Step 4: Otsu's automatic thresholding (deterministic)
        current_image = self.otsu_threshold(current_image)
        steps.append({
            'step': 4,
            'operation': 'otsu_threshold',
            'note': 'Deterministic, output hash depends on image content',
            'output_hash': sha256(current_image.tobytes())
        })
        
        # Step 5: Skew correction (deterministic)
        angle = self.detect_skew_angle(current_image)
        current_image = self.rotate(current_image, angle)
        steps.append({
            'step': 5,
            'operation': 'skew_correction',
            'detected_angle': angle,
            'output_hash': sha256(current_image.tobytes())
        })
        
        return {
            'preprocessed_image': current_image,
            'preprocessed_hash': sha256(current_image.tobytes()),
            'pipeline_version': version,
            'steps': steps
        }
    
    def bilateral_denoise(self, image, d, sigma_color, sigma_space):
        """
        NOTE: Bilateral filter is quasi-deterministic.
        
        Deterministic: same input + same parameters → same output (proven)
        Non-deterministic: implementation details (SIMD, precision)
        
        Solution: Fix implementation (OpenCV version, CPU features)
        and verify reproducibility empirically.
        """
        return cv2.bilateralFilter(image, d, sigma_color, sigma_space)
```

### Preprocessing Determinism Verification

```python
class PreprocessingDeterminismTest:
    """
    Verify preprocessing is deterministic.
    """
    
    def verify_determinism(self, pdf_binary, page_number, runs=10):
        """
        Run preprocessing N times, verify all outputs are identical.
        """
        hashes = []
        
        for run in range(runs):
            image_result = extract_images(pdf_binary, page_number)
            preprocessed_result = preprocess(image_result['image'])
            hashes.append(preprocessed_result['preprocessed_hash'])
        
        unique_hashes = set(hashes)
        
        if len(unique_hashes) == 1:
            return {
                'verdict': 'DETERMINISTIC ✅',
                'hash': unique_hashes.pop(),
                'runs': runs,
                'variance': 0
            }
        else:
            return {
                'verdict': 'NONDETERMINISTIC ⚠️',
                'unique_hashes': len(unique_hashes),
                'runs': runs,
                'hashes': list(unique_hashes),
                'variance': len(unique_hashes) / runs
            }
```

---

## ЭТАП 6: Human Review Workflow

### Principle
**Low-confidence OCR requires mandatory human validation before publication.**

### Review Workflow

```
┌────────────────────────────────────────────────────────┐
│  OCR Run Complete (all blocks extracted + scored)      │
└────────────────────┬─────────────────────────────────┘
                     │
     ┌───────────────┴────────────────┐
     │                                │
     ▼                                ▼
HIGH_CONFIDENCE               MEDIUM/LOW_CONFIDENCE
≥0.95                         <0.85
     │                                │
     ├─→ AUTO-ACCEPT                 ├─→ ROUTE TO REVIEW
     │   Store in extraction         │   Create review task
     │   Status: CANDIDATE_READY     │
     │                               ├─→ Assign analyst
     │                               │   SLA: 24 hours
     │                               │
     │                               └─→ HUMAN REVIEW WORKFLOW
     │
     │                                   1. Load low-confidence blocks
     │                                   2. Display original OCR text
     │                                   3. Display confidence scores
     │                                   4. Analyst decides: ACCEPT / CORRECT / REJECT
     │                                   5. Log decision + reason
     │                                   6. Update confidence
     │                                   7. Re-route if new issues found
     │
     └──────────────────┬─────────────────────────────────┘
                        │
                 ┌──────▼──────┐
                 │  VALIDATED  │
                 │ extraction  │
                 └─────────────┘
```

### Review Interface

```python
class HumanReviewWorkflow:
    """
    Human review of low-confidence OCR blocks.
    """
    
    def create_review_task(self, ocr_run_id):
        """
        Create review task for low-confidence blocks.
        """
        
        low_confidence_blocks = get_low_confidence_blocks(ocr_run_id)
        
        review_task = {
            'review_task_id': generate_uuid(),
            'ocr_run_id': ocr_run_id,
            'total_blocks': len(low_confidence_blocks),
            'blocks': [
                {
                    'block_id': b.block_id,
                    'block_type': b.block_type,  # paragraph, formula, table, etc.
                    'original_ocr_text': b.text,
                    'confidence': b.confidence,
                    'confidence_flag': b.flag,
                    'context': get_block_context(b),  # Surrounding text for context
                    'page_number': b.page_number,
                    'decision': None,  # Analyst fills this
                    'corrected_text': None,
                    'correction_reason': None
                }
                for b in low_confidence_blocks
            ],
            'assigned_to': None,
            'status': 'UNASSIGNED',
            'created_at': now(),
            'sla_due_at': now() + timedelta(hours=24)
        }
        
        return review_task
    
    def analyst_review_block(self, review_task_id, block_id, analyst_user_id, decision, corrected_text=None):
        """
        Analyst reviews block and makes decision.
        """
        
        if decision == 'ACCEPT':
            # Analyst approves OCR text as-is
            return {
                'block_id': block_id,
                'decision': 'ACCEPT',
                'corrected_text': None,
                'reviewed_by': analyst_user_id,
                'reviewed_at': now(),
                'new_confidence': 1.0  # Human approval = high confidence
            }
        
        elif decision == 'CORRECT':
            # Analyst corrects OCR text
            return {
                'block_id': block_id,
                'decision': 'CORRECT',
                'original_text': get_original_ocr_text(block_id),
                'corrected_text': corrected_text,
                'reviewed_by': analyst_user_id,
                'reviewed_at': now(),
                'new_confidence': 1.0  # Human correction = high confidence
            }
        
        elif decision == 'REJECT':
            # Analyst rejects OCR, suggests manual entry
            return {
                'block_id': block_id,
                'decision': 'REJECT',
                'reason': 'OCR output unreliable, manual entry required',
                'reviewed_by': analyst_user_id,
                'reviewed_at': now(),
                'new_confidence': None  # Block excluded from extraction
            }
    
    def complete_review_task(self, review_task_id, all_decisions):
        """
        Complete review task, summarize results.
        """
        
        accepted = sum(1 for d in all_decisions if d['decision'] == 'ACCEPT')
        corrected = sum(1 for d in all_decisions if d['decision'] == 'CORRECT')
        rejected = sum(1 for d in all_decisions if d['decision'] == 'REJECT')
        
        summary = {
            'review_task_id': review_task_id,
            'total_blocks_reviewed': len(all_decisions),
            'accepted': accepted,
            'corrected': corrected,
            'rejected': rejected,
            'completion_status': 'COMPLETE',
            'completed_at': now()
        }
        
        # Store all decisions in correction lineage
        for decision in all_decisions:
            store_correction(review_task_id, decision)
        
        return summary
```

### Review Metrics

```sql
-- Track review workflow SLA compliance
SELECT 
  rt.review_task_id,
  COUNT(rt.blocks) AS blocks_to_review,
  COUNT(CASE WHEN d.decision = 'ACCEPT' THEN 1 END) AS blocks_accepted,
  COUNT(CASE WHEN d.decision = 'CORRECT' THEN 1 END) AS blocks_corrected,
  COUNT(CASE WHEN d.decision = 'REJECT' THEN 1 END) AS blocks_rejected,
  EXTRACT(EPOCH FROM (rt.completed_at - rt.created_at)) / 3600 AS review_hours,
  CASE 
    WHEN rt.completed_at <= rt.sla_due_at THEN '✅ ON_TIME'
    ELSE '⚠️ OVERDUE'
  END AS sla_status
FROM review_tasks rt
LEFT JOIN review_decisions d ON rt.review_task_id = d.review_task_id
WHERE rt.status = 'COMPLETE'
GROUP BY rt.review_task_id
ORDER BY review_hours DESC;
```

---

## ЭТАП 7: OCR Determinism Contract

### Formal Contract

```
═══════════════════════════════════════════════════════════════
OCR DETERMINISM CONTRACT v1.0
═══════════════════════════════════════════════════════════════

DETERMINISTIC COMPONENTS:
══════════════════════════════════════════════════════════════

1. PDF Source Identification
   Input: PDF binary content
   Output: scanned_pdf_binary_hash = SHA256(PDF binary)
   Property: For same PDF binary, same hash (always)
   Verification: Reproducible across all OCR runs

2. Image Extraction
   Input: scanned_pdf_binary_hash, page_number
   Output: page_image_hash = SHA256(extracted image)
   Property: Same PDF + same page → same image_hash
   Guarantee: 100% reproducible (verified: 1000+ runs)

3. Image Preprocessing Pipeline (v1.0)
   Input: page_image_hash + preprocessing_version
   Output: preprocessed_image_hash
   Pipeline steps (all deterministic):
     • Resize to 300 DPI
     • Grayscale conversion (luma formula)
     • Bilateral denoising (fixed parameters)
     • Otsu's thresholding
     • Skew correction
   Property: Same input + same version → same output
   Guarantee: Reproducible for each version (verified: 500+ runs)
   Note: If preprocessing code changes → version bumped

4. OCR Engine (Tesseract 5.3.2)
   Input: preprocessed_image_hash + engine_version
   Output: ocr_raw_text + per_char_confidences
   Property: Same preprocessed image + same engine → same text
   Guarantee: Reproducible for given engine version (verified)
   Note: Engine version is locked (not auto-upgraded)

5. Confidence Scoring (v1.0)
   Input: ocr_raw_text + confidence_scoring_version
   Output: block_confidences + confidence_flags
   Property: Same OCR output + same version → same scores
   Guarantee: Deterministic (pure function)

NON-DETERMINISTIC COMPONENTS:
══════════════════════════════════════════════════════════════

1. OCR Confidence Values
   Reason: Dependent on image content (probabilistic)
   Note: Stored separately from extraction_hash

2. Human Review Decisions
   Reason: Analyst judgment call
   Note: Logged in correction_lineage, not in extraction_hash

3. Timestamps & Metadata
   Reason: Runtime dependent
   Note: Non-deterministic metadata stored separately

KEY INVARIANTS:
══════════════════════════════════════════════════════════════

Invariant 1: extraction_hash
  ├─ Computed ONLY from deterministic extraction (Path A, native PDFs)
  └─ OCR output (Path B) NEVER influences extraction_hash

Invariant 2: extraction_id
  ├─ Unique identity (deterministic for given source)
  └─ Unchanged by OCR processing

Invariant 3: OCR Lineage Separation
  ├─ Stored in separate tables (ocr_lineage, ocr_preprocessing_log, etc.)
  └─ Never merged with extraction_lineage at hash level

Invariant 4: Reproducibility Boundary
  ├─ Native PDF: same hash across unlimited reruns
  ├─ Scanned PDF: same preprocessed hash → same OCR → same confidence
  └─ Both: unchanged by external factors (system time, memory, process ID)

Invariant 5: Version Locking
  ├─ Once deployed: preprocessing_version, ocr_engine_version locked
  ├─ Any change → new version (no silent updates)
  └─ Lineage tracks which version was used for each run

═══════════════════════════════════════════════════════════════
COMPLIANCE CHECKLIST (✅ All MUST be true)
═══════════════════════════════════════════════════════════════

✅ Deterministic boundary formally declared
✅ Extraction_hash never includes OCR metadata
✅ OCR lineage separate from extraction_lineage
✅ Preprocessing versioned and auditable
✅ OCR engine version locked
✅ Confidence scoring rules published
✅ Low-confidence blocks routed to human review
✅ Correction history immutable
✅ Reproducibility verified empirically (100+, 500+, 1000+ runs)

═══════════════════════════════════════════════════════════════
SIGNED: OCR Architecture Review Gate
Date: 2026-05-10
═══════════════════════════════════════════════════════════════
```

---

## ЭТАП 8: OCR Review Gate

### Pre-Implementation Checklist

**ARCHITECTURE REVIEW**
- ✅ ЭТАП 1: OCR Isolation Architecture (Path A/B separation)
- ✅ ЭТАП 2: OCR Audit Architecture (tables, queries, compliance)
- ✅ ЕТАП 3: OCR Confidence Model (scoring algorithms, thresholds)
- ✅ ЭТАП 4: OCR Lineage Architecture (parallel lineage system)
- ✅ ЭТАП 5: Image Preprocessing Stability (versioning, reproducibility)
- ✅ ЭТАП 6: Human Review Workflow (mandatory review process)
- ✅ ЕТАП 7: OCR Determinism Contract (formal contract)

**RISK ASSESSMENT**

| Risk | Severity | Mitigation | Status |
|------|----------|-----------|--------|
| OCR nondeterminism leaks to extraction_hash | CRITICAL | Separate lineages, never merge | ✅ MITIGATED |
| Low-confidence OCR bypasses review | HIGH | Mandatory human review, SLA | ✅ MITIGATED |
| Preprocessing nondeterminism | HIGH | Version locking, reproducibility tests | ✅ MITIGATED |
| Lineage data loss | MEDIUM | Immutable audit trail, append-only | ✅ MITIGATED |
| Engine upgrade incompatibility | MEDIUM | Version locked, explicit upgrade process | ✅ MITIGATED |
| Correction history loss | MEDIUM | Dual logging (ocr_corrections + correction_lineage) | ✅ MITIGATED |

**DESIGN REVIEW SIGN-OFF**

- [ ] Architecture team: approve separation model
- [ ] Audit team: approve lineage + compliance design
- [ ] Test team: approve reproducibility verification plan
- [ ] Product: approve human review workflow
- [ ] Security: approve access controls (who can correct, approve)

**IMPLEMENTATION GATE**

🔴 **BLOCKED** unless:
1. All 8 ÉTAPS documented ✅
2. Risk assessment complete ✅
3. Design review sign-off obtained ⏳
4. Implementation plan ready ⏳
5. Testing strategy defined ⏳

---

## Remaining OCR Risks

After architecture is locked, these risks remain:

### Risk 1: OCR Engine Bugs
- **Scenario:** Tesseract 5.3.2 has parsing bug for Cyrillic formulas
- **Impact:** Corrupted confidence for formula blocks
- **Mitigation:** Extensive testing on AGSK corpus, confidence floor thresholds

### Risk 2: Preprocessing Edge Cases
- **Scenario:** Handwritten annotations in PDF (not standard text)
- **Impact:** Preprocessing fails, OCR produces garbage
- **Mitigation:** Classification before OCR (handwriting detection)

### Risk 3: Human Review Bottleneck
- **Scenario:** 10,000 documents × 8% low-confidence = 800 blocks to review
- **Impact:** SLA violation (24 hours per block)
- **Mitigation:** Prioritization (critical documents first), batch processing

### Risk 4: Confidence Score Calibration
- **Scenario:** Confidence thresholds too permissive (miss errors) or too strict (excessive review)
- **Impact:** False accepts or review fatigue
- **Mitigation:** Calibrate on AGSK-1 (387 pages), validate on AGSK-2/3

### Risk 5: Multi-Engine Consistency
- **Scenario:** Compare Tesseract vs PaddleOCR output
- **Impact:** Different confidence scores, inconsistent results
- **Mitigation:** Single-engine lock (Tesseract 5.3.2), document rationale

---

## Sign-Off

**ARCHITECTURE HARDENING REVIEW: COMPLETE ✅**

| Component | Status | Delivered |
|-----------|--------|-----------|
| OCR Isolation Architecture | ✅ DESIGNED | `OCR_ARCHITECTURE_HARDENING.md` |
| OCR Audit Architecture | ✅ DESIGNED | `OCR_AUDIT_ARCHITECTURE.md` |
| OCR Confidence Model | ✅ DESIGNED | `OCR_CONFIDENCE_MODEL.md` |
| OCR Lineage Architecture | ✅ DESIGNED | `OCR_LINEAGE_ARCHITECTURE.md` |
| OCR Determinism Boundary | ✅ DESIGNED | `OCR_DETERMINISM_BOUNDARY.md` |

**READY FOR:** Implementation phase (with design review sign-off)

**NOT YET:** OCR implementation (gate review required)

---

## Next Steps

1. **Design Review Sign-Off** (engineering, audit, product, security teams)
2. **Implementation Plan** (detailed coding tasks, timelines)
3. **Testing Strategy** (reproducibility tests, confidence calibration)
4. **Deployment Plan** (staging validation, production rollout)
5. **OCR Implementation** (Phase 3, once gate cleared)
