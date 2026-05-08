# OCR Confidence Model

> **Granular Confidence Scoring for Safe OCR Integration**
> 
> *Prevents low-confidence OCR from becoming normative truth.*

**Document Version:** 1.0  
**Date:** 2026-05-10  
**Implements:** OCR Architecture Hardening Review, ЭТАП 3

---

## Overview

The OCR Confidence Model ensures that **probabilistic OCR output is never automatically accepted as canonical truth**. Instead:

1. **Block-level confidence** is calculated for every semantic block (paragraph, formula, table)
2. **Confidence flags** determine the action (auto-accept, review, or reject)
3. **Low-confidence blocks** are routed to mandatory human review
4. **Confidence evolution** is tracked as corrections are made

---

## Confidence Calculation Model

### 1. Character-Level Confidence

OCR engine outputs per-character confidence:

```python
class CharacterConfidence:
    """
    Tesseract/PaddleOCR outputs character-level confidence (0.0-1.0).
    We use this as the foundation.
    """
    
    def aggregate_character_confidence(self, characters):
        """
        Block confidence = f(character confidences)
        
        Options:
        1. mean: simple average (most common)
        2. min: bottleneck (strictest, catches weak spots)
        3. harmonic_mean: penalizes outliers
        4. weighted_mean: weight by char importance (e.g., numbers > letters)
        """
        confidences = [c.confidence for c in characters]
        
        # Strategy: use mean + min pair for dual signal
        char_confidence_mean = mean(confidences)
        char_confidence_min = min(confidences)
        
        # If minimum is very low, reduce aggregate confidence
        if char_confidence_min < 0.5:
            char_confidence_mean *= 0.9  # 10% penalty for weak outlier
        
        return {
            'char_mean': char_confidence_mean,
            'char_min': char_confidence_min,
            'char_stddev': std(confidences)  # High variance = less certain
        }
```

### 2. Block Structure Confidence

Confidence depends on block type (paragraph, table, formula, etc.):

#### Paragraph Block Confidence

```python
def paragraph_block_confidence(self, ocr_block):
    """
    Paragraph: "normal" text in natural language.
    """
    char_conf = self.aggregate_character_confidence(ocr_block.characters)
    
    # Structural confidence: does layout match expected paragraph structure?
    # (margins, line breaks, word spacing)
    structure_score = self.match_paragraph_structure(ocr_block)
    
    # Language model: does text make sense linguistically?
    lang_score = self.language_model_confidence(ocr_block.text)
    
    block_confidence = (
        char_conf['char_mean'] * 0.5 +  # Character recognition
        structure_score * 0.25 +          # Layout structure
        lang_score * 0.25                 # Linguistic coherence
    )
    
    return {
        'block_type': 'paragraph',
        'confidence': block_confidence,
        'components': {
            'char_mean': char_conf['char_mean'],
            'structure_score': structure_score,
            'lang_score': lang_score
        }
    }
```

#### Formula Block Confidence

```python
def formula_block_confidence(self, ocr_block):
    """
    Formula: mathematical expression (high risk).
    
    Rules:
    - Single misrecognized character can corrupt entire formula
    - Math symbols are harder than letters
    - Must use stricter thresholds
    """
    char_conf = self.aggregate_character_confidence(ocr_block.characters)
    
    # Math symbol detection: are recognized symbols valid?
    symbol_validity = self.validate_math_symbols(ocr_block.text)
    
    # Formula structure: LaTeX or standard notation?
    formula_structure_score = self.validate_formula_structure(ocr_block.text)
    
    # STRICT: if min char confidence low, reduce formula confidence heavily
    formula_confidence = (
        char_conf['char_mean'] * 0.4 +
        symbol_validity * 0.35 +
        formula_structure_score * 0.25
    )
    
    # Extra penalty: formulas are high-risk
    if char_conf['char_min'] < 0.80:
        formula_confidence *= 0.8  # 20% penalty for weak symbol
    
    return {
        'block_type': 'formula',
        'confidence': formula_confidence,
        'components': {
            'char_mean': char_conf['char_mean'],
            'char_min': char_conf['char_min'],
            'symbol_validity': symbol_validity,
            'formula_structure': formula_structure_score
        },
        'risk_level': 'HIGH' if formula_confidence < 0.90 else 'MEDIUM'
    }
```

#### Table Block Confidence

```python
def table_block_confidence(self, ocr_block):
    """
    Table: structured rows × columns (high complexity).
    
    Risks:
    - Row/column detection errors
    - Merged cells
    - Cell alignment errors
    - Border detection failures
    """
    
    # Cell-level confidence: average of all cell text confidences
    cell_confidences = [
        self.paragraph_block_confidence(cell)['confidence']
        for cell in ocr_block.cells
    ]
    cell_conf_avg = mean(cell_confidences)
    cell_conf_min = min(cell_confidences)
    
    # Row boundary detection: does OCR correctly identify row breaks?
    row_detection_score = self.detect_row_boundaries_confidence(ocr_block)
    
    # Column boundary detection: does OCR correctly identify columns?
    col_detection_score = self.detect_column_boundaries_confidence(ocr_block)
    
    # Merged cell handling: does OCR detect merged cells correctly?
    merged_cell_score = self.validate_merged_cells(ocr_block)
    
    table_confidence = (
        cell_conf_avg * 0.4 +
        row_detection_score * 0.2 +
        col_detection_score * 0.2 +
        merged_cell_score * 0.2
    )
    
    # Penalties: structural errors are critical
    if row_detection_score < 0.85:
        table_confidence *= 0.9
    if col_detection_score < 0.85:
        table_confidence *= 0.9
    
    return {
        'block_type': 'table',
        'confidence': table_confidence,
        'components': {
            'cell_avg': cell_conf_avg,
            'cell_min': cell_conf_min,
            'row_detection': row_detection_score,
            'col_detection': col_detection_score,
            'merged_cell_handling': merged_cell_score
        },
        'high_risk_cells': [
            (i, cell_conf) for i, cell_conf in enumerate(cell_confidences)
            if cell_conf < 0.75
        ]
    }
```

### 3. Global Block Confidence Aggregation

```python
class BlockConfidenceAggregator:
    """
    Master aggregation for any OCR block.
    """
    
    def aggregate_block_confidence(self, ocr_block):
        """Route to type-specific confidence calculator."""
        
        block_type = self.detect_block_type(ocr_block)
        
        if block_type == 'paragraph':
            return self.paragraph_block_confidence(ocr_block)
        elif block_type == 'formula':
            return self.formula_block_confidence(ocr_block)
        elif block_type == 'table':
            return self.table_block_confidence(ocr_block)
        elif block_type == 'figure':
            return self.figure_block_confidence(ocr_block)
        elif block_type == 'list':
            return self.list_block_confidence(ocr_block)
        else:
            return self.generic_block_confidence(ocr_block)
```

---

## Confidence Flags

Based on block-level confidence, assign action flags:

### Confidence Threshold Mapping

```python
class ConfidenceThresholds:
    """
    Confidence thresholds vary by block type and document context.
    Engineering documents (AGSK) have stricter thresholds.
    """
    
    THRESHOLDS = {
        'paragraph': {
            'HIGH': 0.95,
            'MEDIUM': 0.85,
            'LOW': 0.70,
            'VERY_LOW': 0.0
        },
        'formula': {
            'HIGH': 0.98,           # Formulas: much stricter
            'MEDIUM': 0.90,
            'LOW': 0.75,
            'VERY_LOW': 0.0
        },
        'table': {
            'HIGH': 0.95,
            'MEDIUM': 0.85,
            'LOW': 0.70,
            'VERY_LOW': 0.0
        },
        'figure': {
            'HIGH': 0.92,           # Figures: difficult to OCR
            'MEDIUM': 0.80,
            'LOW': 0.65,
            'VERY_LOW': 0.0
        }
    }
    
    def get_flag(self, block_type, confidence):
        """Assign flag based on confidence and block type."""
        thresholds = self.THRESHOLDS.get(block_type, self.THRESHOLDS['paragraph'])
        
        if confidence >= thresholds['HIGH']:
            return 'HIGH_CONFIDENCE'
        elif confidence >= thresholds['MEDIUM']:
            return 'MEDIUM_CONFIDENCE'
        elif confidence >= thresholds['LOW']:
            return 'LOW_CONFIDENCE'
        else:
            return 'VERY_LOW_CONFIDENCE'
```

### Flag Workflow

```
Block confidence calculated
  │
  ├─→ HIGH_CONFIDENCE (≥0.95)
  │   Action: AUTO-ACCEPT to candidate_extraction
  │   Flow: Store in extraction → no human review required
  │   Risk: Very low
  │
  ├─→ MEDIUM_CONFIDENCE (0.85-0.94)
  │   Action: ADD to candidate_extraction + flag for review
  │   Flow: Store, but mark [⚠️ REVIEW RECOMMENDED]
  │   Risk: Low
  │
  ├─→ LOW_CONFIDENCE (0.70-0.84)
  │   Action: ROUTE to human_review_queue (MANDATORY)
  │   Flow: Store in low_confidence_pool → assign to analyst
  │   Risk: Medium
  │   SLA: Must be reviewed within 24 hours
  │
  └─→ VERY_LOW_CONFIDENCE (<0.70)
      Action: REJECT or REQUEST MANUAL ENTRY
      Flow: Flag for rejection → suggest manual entry
      Risk: High
      Note: Do not include in candidate_extraction
```

---

## Confidence Workflow Example

### Input: AGSK Engineering Standard (Scanned PDF)

```
Page 5, Section 3.2 (Formula Block)
Raw OCR output:
  E = mc²

Character confidences:
  E: 0.98
  =: 0.62 ⚠️ (low!)
  m: 0.99
  c: 0.97
  ²: 0.45 ⚠️ (very low!)

Processing:
1. Aggregate character confidence
   char_mean = (0.98 + 0.62 + 0.99 + 0.97 + 0.45) / 5 = 0.80
   char_min = 0.45

2. Formula-specific scoring
   - Symbol validity: ✅ (E, =, m, c, ² are valid math symbols)
   - Formula structure: ✅ (standard physics notation)
   - Penalty for low char_min: confidence *= 0.8

3. Final confidence calculation
   formula_confidence = (0.80 * 0.4 + 0.85 * 0.35 + 0.90 * 0.25) * 0.8
                      = 0.70 (LOW_CONFIDENCE)

4. Action: Route to human_review_queue
   Reason: Formula confidence = 0.70 (below 0.75 threshold for formulas)
   Suggested correction: Verify superscript "²" recognition (char conf = 0.45)
```

### Output: Human Review Result

```
Analyst: analyst-456
Review decision: CORRECTED
  Original: E = mc²
  Corrected: E = mc²
  Change: None (OCR was correct)
  Reason: Confidence threshold validation (systematic review)
  New confidence: 1.0 (human validated)
  Time: 2 minutes

Correction stored in ocr_corrections table
Confidence evolution tracked
Final status: VALIDATED ✅
```

---

## Confidence Tracking & Evolution

```python
class ConfidenceEvolution:
    """
    Track how confidence changes as corrections are made.
    """
    
    def snapshot_confidence(self, ocr_run_id, version):
        """
        Snapshot confidence state at each stage:
        - Version 1: Raw OCR output
        - Version 2: After batch 1 corrections
        - Version 3: After final human review
        """
        INSERT INTO ocr_confidence_evolution (
            ocr_run_id,
            snapshot_version,
            ocr_confidence_avg,
            block_confidences_snapshot,
            change_description,
            snapshot_at
        ) VALUES (
            ocr_run_id,
            version,
            calculate_avg_confidence(ocr_run_id),
            extract_block_confidences(ocr_run_id),
            'after_corrections' if version > 1 else 'raw_ocr',
            now()
        )
    
    def confidence_trend(self, ocr_run_id):
        """
        Analyze confidence trend across versions.
        """
        SELECT 
            snapshot_version,
            ocr_confidence_avg,
            LAG(ocr_confidence_avg) OVER (ORDER BY snapshot_version) AS prev_version_confidence,
            ocr_confidence_avg - LAG(ocr_confidence_avg) OVER (ORDER BY snapshot_version) AS delta
        FROM ocr_confidence_evolution
        WHERE ocr_run_id = ?
        ORDER BY snapshot_version
```

---

## Special Cases

### 1. Multilingual Documents

```python
def multilingual_confidence(self, ocr_block):
    """
    Document with multiple languages requires per-language confidence.
    """
    
    # Detect language per sentence/paragraph
    language_segments = self.segment_by_language(ocr_block.text)
    
    # Calculate confidence per language
    confidences = {
        lang: self.paragraph_block_confidence_for_language(segment, lang)
        for lang, segment in language_segments.items()
    }
    
    # Aggregate: weighted by segment length
    total_length = sum(len(s) for s in language_segments.values())
    aggregate_confidence = sum(
        conf * (len(language_segments[lang]) / total_length)
        for lang, conf in confidences.items()
    )
    
    return {
        'block_type': 'multilingual_paragraph',
        'confidence': aggregate_confidence,
        'per_language_confidences': confidences
    }
```

### 2. Numeric/Code Blocks

```python
def numeric_block_confidence(self, ocr_block):
    """
    Numeric blocks (serial numbers, codes, measurements) are critical.
    Single digit error = total failure.
    """
    
    # Character confidence for each digit
    digit_confidences = [c.confidence for c in ocr_block.characters if c.is_digit]
    
    # STRICT: use minimum, not mean
    numeric_confidence = min(digit_confidences) if digit_confidences else 0.0
    
    # If any digit confidence < 0.95: flag
    if numeric_confidence < 0.95:
        flag = 'LOW_CONFIDENCE'  # Even if average is high!
    else:
        flag = 'HIGH_CONFIDENCE'
    
    return {
        'block_type': 'numeric',
        'confidence': numeric_confidence,
        'flag': flag,
        'risk': 'CRITICAL' if numeric_confidence < 0.95 else 'LOW'
    }
```

---

## Integration with Extraction Pipeline

```python
class ExtractionWithConfidence:
    """
    OCR confidence integrates into extraction versioning.
    """
    
    def create_extraction_version(self, document_id, ocr_run_id):
        """
        Each OCR run can produce multiple extraction_versions
        depending on confidence flags and human decisions.
        """
        
        # Get OCR blocks
        ocr_blocks = get_ocr_blocks(ocr_run_id)
        
        # Filter by confidence flag
        high_confidence_blocks = [
            b for b in ocr_blocks 
            if b.confidence_flag == 'HIGH_CONFIDENCE'
        ]
        
        medium_confidence_blocks = [
            b for b in ocr_blocks 
            if b.confidence_flag == 'MEDIUM_CONFIDENCE'
        ]
        
        low_confidence_blocks = [
            b for b in ocr_blocks 
            if b.confidence_flag in ['LOW_CONFIDENCE', 'VERY_LOW_CONFIDENCE']
        ]
        
        # Create extraction version
        extraction_v1 = {
            'document_id': document_id,
            'ocr_run_id': ocr_run_id,
            'extraction_version': 1,
            'blocks': high_confidence_blocks + medium_confidence_blocks,
            'pending_review_blocks': low_confidence_blocks,
            'status': 'CANDIDATE' if low_confidence_blocks else 'READY_FOR_VALIDATION'
        }
        
        return extraction_v1
```

---

## Quality Metrics

Track confidence metrics over time:

```sql
-- Confidence quality dashboard
SELECT 
  DATE(ocr_started_at) AS date,
  COUNT(*) AS total_blocks,
  COUNT(CASE WHEN confidence >= 0.95 THEN 1 END) AS high_conf,
  COUNT(CASE WHEN 0.85 <= confidence < 0.95 THEN 1 END) AS medium_conf,
  COUNT(CASE WHEN 0.70 <= confidence < 0.85 THEN 1 END) AS low_conf,
  COUNT(CASE WHEN confidence < 0.70 THEN 1 END) AS very_low_conf,
  ROUND(AVG(confidence), 3) AS avg_confidence,
  ROUND(STDDEV(confidence), 3) AS confidence_stddev,
  ROUND(100.0 * COUNT(CASE WHEN confidence >= 0.95 THEN 1 END) / COUNT(*), 1) AS high_conf_percent
FROM ocr_runs, 
LATERAL jsonb_array_elements(block_confidences) AS block
WHERE ocr_status = 'success'
GROUP BY DATE(ocr_started_at)
ORDER BY date DESC;
```

---

## Status

✅ **CONFIDENCE MODEL DESIGNED**
- Block-level scoring algorithms defined
- Threshold-based flags designed
- Type-specific rules (formula, table, numeric)
- Integration with extraction pipeline
- Quality metrics ready

🔴 **NOT IMPLEMENTED** until all ETAPS 1-8 complete + review gate passed

---

## Next

- **ETAP 4:** OCR Lineage Architecture (parallel lineage system)
- **ETAP 5:** Image Preprocessing Stability (versioning)
- **ETAP 6:** Human Review Workflow (mandatory review process)
