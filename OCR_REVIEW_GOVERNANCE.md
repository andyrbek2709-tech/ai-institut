# OCR Review Governance

**Версия:** 1.0  
**Дата:** 2026-05-09  
**Статус:** ✅ Operational Review Framework  

---

## Обзор

OCR Review Governance устанавливает операционный workflow для:
- Назначения human reviewers
- Управления review процессом
- Отслеживания corrections
- Accountability & SLA monitoring

**Критическая идея:** Низкоуверенные extraction должны доводиться до уверенного состояния (человеком или переработкой) перед использованием в regulatory workflows.

---

## Review Workflow

### Step 1: Extraction Triage

```
Extraction
  ↓
Calculate Confidence Score
  ↓
Run Failure Detection (11 failure classes)
  ↓
Decision Tree:
  ├─ Confidence ≥ Threshold + NO failures detected
  │   → Auto-Accept (log for monitoring)
  │
  ├─ Confidence < Threshold OR failures detected
  │   → Queue for Human Review
  │
  └─ Confidence < 0.80 OR critical failures
      → Escalate (require senior engineer review)
```

### Step 2: Queue Management

```
Review Queue:
  ├─ URGENT (confidence < 0.80)
  │   → SLA: 1 hour
  │   → Assigned to: Senior extractors
  │
  ├─ HIGH (confidence 0.80-0.90)
  │   → SLA: 4 hours
  │   → Assigned to: Engineering reviewers
  │
  └─ NORMAL (confidence 0.90+ but failures)
      → SLA: 24 hours
      → Assigned to: Any trained reviewer
```

### Step 3: Review Interface

**Reviewer sees:**
```
┌─────────────────────────────────────────┐
│ Review Task #1234                       │
├─────────────────────────────────────────┤
│                                         │
│ Document: IEC-60038-v1.pdf              │
│ Page: 3, Location: Table 5, Cell (2,3)  │
│                                         │
│ Extracted Value:  "4.5"                 │
│ Confidence:       0.82 (BELOW FLOOR)    │
│ Type:             Numeric               │
│                                         │
│ Failure Detections:                     │
│   ⚠ Decimal separator confidence: 0.71  │
│     → Could be missing decimal          │
│       (45 might be correct interpretation)│
│                                         │
│ [Original Image Context]                │
│ ┌──────────────────────┐               │
│ │ ... 4.5 ... ...      │  ← Circled    │
│ │ ... ... ... ...      │  │             │
│ └──────────────────────┘               │
│                                         │
│ Decision:                               │
│  ○ Accept as "4.5"                     │
│  ○ Correct to "45"                     │
│  ○ Mark as ambiguous (4.5 or 45?)      │
│  ○ Reject (cannot determine)           │
│                                         │
│ [Comments] ________________________     │
│                                         │
│ Reviewer: [dropdown]                    │
│ [Submit Review]                        │
└─────────────────────────────────────────┘
```

### Step 4: Review Decision

**Reviewer chooses:**

1. **Accept** — Extracted value is correct
   ```
   → Mark extraction as 'reviewed: true, corrected: false'
   → Add to success metrics
   → Log reviewer for analytics
   ```

2. **Correct** — Extracted value is wrong, reviewer provides correction
   ```
   → OCR extraction: "4.5"
   → Reviewer correction: "45"
   → Mark extraction as 'reviewed: true, corrected: true'
   → Store correction in ocr_corrections table
   → Create failure incident (for root cause analysis)
   ```

3. **Ambiguous** — Cannot determine which is correct without more context
   ```
   → Mark as 'needs_context: true'
   → Escalate to domain expert
   → Provide additional context (full table, document, etc.)
   ```

4. **Reject** — Cannot extract reliably
   ```
   → Mark as 'reviewed: true, extraction_rejected: true'
   → Suggest alternative approach (manual re-scan, etc.)
   → Create flag for document handling
   ```

---

## Reviewer Assignment

### Reviewer Roles

#### Role 1: Junior Extractor
- Qualification: Completed OCR training (4 hours)
- Scope: NORMAL priority tasks (confidence 0.90+, no critical failures)
- Authority: Can accept/correct obvious errors
- Escalation: Ambiguous/complex → Senior

#### Role 2: Senior Extractor
- Qualification: 2+ weeks production review + 15+ corrections
- Scope: HIGH + URGENT priority (confidence < 0.90)
- Authority: Can decide ambiguous cases, assign escalations
- Escalation: Regulatory/safety issues → Domain Expert

#### Role 3: Domain Expert (Engineering)
- Qualification: Professional engineer + domain knowledge
- Scope: Escalated ambiguous cases, regulatory safety issues
- Authority: Final decision on ambiguous extractions
- Escalation: None (domain expert is final authority)

### Assignment Algorithm

```python
def assign_reviewer(extraction):
    """Assign reviewer based on priority + load"""
    
    priority = get_priority(extraction)
    
    if priority == URGENT:
        # Find senior with lowest load
        senior = find_reviewer(
            role='senior_extractor',
            sort_by='current_load',
            max_load=10
        )
        return senior or escalate_to_domain_expert()
    
    elif priority == HIGH:
        # Balance between senior and junior
        if extraction.has_critical_failure:
            return find_reviewer(role='senior_extractor')
        else:
            # Junior if available, senior otherwise
            return (find_reviewer(role='junior') or
                    find_reviewer(role='senior_extractor'))
    
    else:  # NORMAL
        # Junior preference
        return (find_reviewer(role='junior') or
                find_reviewer(role='senior_extractor'))
```

### Workload Balancing

```sql
-- Monitor reviewer load
SELECT
  reviewer_id,
  COUNT(*) as pending_count,
  EXTRACT(EPOCH FROM (MAX(assigned_at) - NOW())) / 3600 as oldest_pending_hours
FROM review_queue
WHERE completed_at IS NULL
GROUP BY reviewer_id
ORDER BY pending_count DESC;
```

**Alert trigger:**
- Reviewer pending > 20 → redistribute work
- Oldest pending > SLA → escalate automatically

---

## SLA Management

### SLA Timers

```
Queue        | Target SLA | Alert at | Escalation
---|---|---|---
URGENT       | 1 hour     | 50 min   | Auto-escalate to domain expert
HIGH         | 4 hours    | 2 hours  | Reassign to senior
NORMAL       | 24 hours   | 12 hours | Raise priority to HIGH
```

### SLA Tracking

```sql
SELECT
  extraction_id,
  assigned_at,
  completed_at,
  EXTRACT(EPOCH FROM (completed_at - assigned_at)) / 3600 as duration_hours,
  CASE
    WHEN priority = 'URGENT' AND duration > 1 THEN 'SLA_MISS'
    WHEN priority = 'HIGH' AND duration > 4 THEN 'SLA_MISS'
    WHEN priority = 'NORMAL' AND duration > 24 THEN 'SLA_MISS'
    ELSE 'SLA_OK'
  END as sla_status
FROM review_queue
WHERE completed_at > NOW() - INTERVAL '7 days'
ORDER BY duration_hours DESC;
```

---

## Correction Lineage

### Correction Tracking

```sql
-- ocr_corrections table schema
CREATE TABLE ocr_corrections (
  id UUID PRIMARY KEY,
  
  -- Extraction reference
  extraction_id UUID REFERENCES ocr_extractions(id),
  document_id VARCHAR,
  page_num INT,
  location VARCHAR,  -- "table 5, cell (2,3)"
  
  -- Original extraction
  ocr_value VARCHAR,
  ocr_confidence FLOAT,
  extraction_type VARCHAR,  -- 'formula', 'numeric', 'table', etc.
  
  -- Correction
  corrected_value VARCHAR,
  correction_reason VARCHAR,
  correction_category VARCHAR,  -- 'symbol_confusion', 'decimal_error', etc.
  
  -- Reviewer metadata
  reviewer_id UUID,
  reviewer_role VARCHAR,
  reviewed_at TIMESTAMP,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(extraction_id)
);
```

### Failure Root Cause Analysis

```python
def analyze_failure(correction):
    """Extract root cause from correction"""
    
    # Map correction to failure taxonomy
    failure_class = map_to_failure_class(
        extraction_type=correction.extraction_type,
        ocr_value=correction.ocr_value,
        corrected_value=correction.corrected_value,
        correction_reason=correction.correction_reason
    )
    
    return {
        'failure_class': failure_class,
        'confidence_impact': estimate_calibration_impact(failure_class),
        'prevention': get_prevention_strategy(failure_class),
    }
```

### Correction Statistics

```sql
-- Top failure modes from corrections
SELECT
  extraction_type,
  correction_category,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM ocr_corrections), 1) as pct
FROM ocr_corrections
WHERE reviewed_at > NOW() - INTERVAL '30 days'
GROUP BY extraction_type, correction_category
ORDER BY count DESC;
```

**Action if:** Any category > 10% → investigate, improve detection/prevention

---

## Reviewer Accountability

### Performance Metrics

```sql
-- Per-reviewer metrics
SELECT
  reviewer_id,
  COUNT(*) as extractions_reviewed,
  SUM(CASE WHEN corrected = false THEN 1 ELSE 0 END) as correct_accepts,
  SUM(CASE WHEN corrected = true THEN 1 ELSE 0 END) as corrections_made,
  
  -- Accuracy: how many accepted extractions later found to be wrong?
  (SELECT COUNT(*) FROM production_corrections pc
   WHERE pc.reviewer_accepted_extraction = true
   AND pc.correction_time > extraction.reviewed_at) as false_accepts,
  
  ROUND(
    SUM(CASE WHEN corrected = false THEN 1 ELSE 0 END) * 100.0 / COUNT(*),
    1
  ) as accept_rate,
  
  AVG(EXTRACT(EPOCH FROM (completed_at - assigned_at))) / 60 as avg_review_time_min
FROM review_queue rq
JOIN ocr_extractions oe ON rq.extraction_id = oe.id
WHERE rq.completed_at > NOW() - INTERVAL '30 days'
GROUP BY reviewer_id
ORDER BY accept_rate DESC;
```

### Reviewer Feedback Loop

```
If reviewer metrics indicate issues:
  
  1. High accept rate + high false accepts
     → Training session on failure detection
     → Assign more challenging (HIGH/URGENT) tasks
     → Monthly check-in
  
  2. Low accept rate + many corrections
     → May be overcautious (unnecessary reviews)
     → Review SLA impact
     → Adjust confidence thresholds
  
  3. High average review time
     → May indicate unclear instructions
     → Provide refresher training
     → Simplify review interface
  
  4. SLA misses
     → Workload issue or capacity constraint
     → Redistribute load
     → Hire additional reviewer
```

---

## Edge Cases & Escalation

### Escalation Triggers

#### Trigger 1: Ambiguous Extraction
```
Reviewer cannot confidently decide A vs B
→ Escalate to senior extractor
→ If still ambiguous → Domain expert
→ If domain expert unsure → Mark for manual re-extraction
```

#### Trigger 2: Safety-Critical Extraction
```
If extraction impacts:
  - Cable safety (overload risk)
  - Voltage safety (isolation risk)
  - Critical formula
  
→ Require domain expert sign-off
→ Audit trail: extraction → senior → domain expert → approval
```

#### Trigger 3: Systemic Issue Detection
```
If > 5 corrections for same failure_class in one day
→ Alert engineering team
→ Investigate root cause
→ May trigger:
    - OCR engine update
    - Fine-tuning
    - Confidence recalibration
```

#### Trigger 4: Low-Quality Source Document
```
If document quality too poor:
  - Confidence floor < 0.75 for most extractions
  - Error rate > 20%
  
→ Mark document as "low-quality"
→ Suggest re-scanning
→ May reject entire document extraction
```

---

## Batch Review Mode

### Scenario: 100+ documents to review

```
1. Batch Creation
   - Group by similarity (same document type, quality level)
   - Create batch_id
   
2. Batch Review Assignment
   - Assign senior reviewer as batch lead
   - Junior reviewers handle majority
   - Lead spot-checks 10% of junior reviews
   
3. Batch QA
   - Lead reviews: random sample of junior submissions
   - If junior error rate > 5% → reassign rest of batch
   - If error rate < 2% → approve batch
   
4. Batch Metrics
   - Track per-batch accuracy
   - Compare accuracy across batches
   - Identify batch-specific issues
```

---

## Integration with Production

### Pre-Production Validation

```
Before extraction goes into regulatory calculations:

1. Extraction created
   ↓
2. Auto-validation (confidence + failure checks)
   ↓
3. If passes: marked 'production_ready'
   If fails: queued for review
   ↓
4. Human review (if needed)
   ↓
5. Approved extraction → locked
   ↓
6. Regulatory calculation can use it
   ↓
7. If later corrected: calculation flagged for re-run
```

### Correction Rollback

```
IF extraction corrected AFTER being used in calculation:

1. Correction approved
2. Query: which calculations used this extraction?
3. Mark those calculations as 'needs_recalculation'
4. Engineer notified: "Recalculation required for Project X"
5. Re-run calculation with corrected extraction
6. Audit trail: extraction → old value → new value → affected calcs
```

---

## Следующий шаг

После review governance:
→ `OCR_REPRODUCIBILITY_FRAMEWORK.md` (determinism validation)

---

**Статус:** OCR Review Governance ГОТОВА.

Ключевая идея: **Низкоуверенное extraction требует human sign-off перед production use.**
