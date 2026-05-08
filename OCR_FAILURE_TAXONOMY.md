# OCR Failure Taxonomy

**Версия:** 1.0  
**Дата:** 2026-05-09  
**Статус:** ✅ Failure Classification Framework  

---

## Обзор

OCR Failure Taxonomy формализирует классификацию OCR ошибок, включая:
- Симптомы (что наблюдаем)
- Root causes (почему произошло)
- Detection strategies (как выявить)
- Prevention strategies (как избежать)
- Recovery procedures (как исправить)

---

## Taxonomy Structure

```
Error Category (высокий уровень)
  ├── Failure Class (конкретный тип ошибки)
  │   ├── Symptom (что видим)
  │   ├── Root Cause (почему)
  │   ├── Frequency (как часто в validation corpus)
  │   ├── Impact (severity на regulatory workflows)
  │   ├── Detection Method (как выявить)
  │   ├── Prevention (как избежать)
  │   └── Recovery (как исправить)
```

---

## CATEGORY 1: Symbol Recognition Errors

### Failure Class 1.1: Greek Letter Confusion

**Symptom:**
```
Expected:  α (alpha)
Extracted: a (letter a)

Expected:  Ω (omega)
Extracted: O (letter O)
```

**Root Cause:**
- Tesseract/PaddleOCR untrained на Greek symbols в mathematical context
- Low image quality → difficult to distinguish Ω vs O

**Frequency:** ~5% of formulas containing Greek letters

**Impact:** CRITICAL
- Formula becomes meaningless
- Example: α → a changes coefficient into variable name

**Detection Method:**
```python
def detect_greek_confusion(extracted_text):
    """Check if single-letter variables are consistent with math context"""
    
    # Greek letters should appear in formulas
    formula_pattern = r'[\+\-\*\/\=\(\)\\]'
    
    suspicious = []
    for word in extracted_text.split():
        # Single ASCII letters in mathematical context?
        if len(word) == 1 and word.isalpha():
            if formula_pattern in context_before(word):
                # Likely should be Greek
                suspicious.append(word)
    
    return suspicious
```

**Prevention:**
- Fine-tune OCR engine on mathematical fonts (if available)
- Post-OCR validation: flag single-letter variables in formulas → human check
- Confidence floor for Greek letters: 0.88 (lower than normal)

**Recovery:**
- Confidence < 0.88 → escalate for human review
- Provide context (surrounding formula) to reviewer

---

### Failure Class 1.2: Special Mathematical Symbols

**Symptom:**
```
Expected:  √ (square root)
Extracted: V (letter V) or ✓ (check mark)

Expected:  × (multiplication)
Extracted: x (letter x) or X

Expected:  ÷ (division)
Extracted: : (colon) or - (dash)
```

**Root Cause:**
- Special symbols not in standard OCR training data
- Rendering differences (font, size, style)

**Frequency:** ~8% of formulas

**Impact:** CRITICAL
- Wrong operation completely changes formula
- Example: 2×3 vs 2x3 (multiply vs variable x)

**Detection Method:**
```python
def detect_operation_ambiguity(extracted_formula):
    """Detect single-letter ops vs mathematical symbols"""
    
    problematic = []
    
    # Common substitutions
    substitutions = {
        'x': ['×', '*'],  # Could be multiplication or variable
        'X': ['×'],
        'V': ['√'],       # Could be squareroot or variable
        '-': ['−', '÷'],  # Could be minus or division
        ':': ['÷'],       # Could be division or ratio
    }
    
    for char, possibles in substitutions.items():
        if char in extracted_formula:
            # Is this in operand position (between numbers)?
            if is_between_numbers(char, extracted_formula):
                problematic.append({
                    'char': char,
                    'could_be': possibles,
                    'position': extracted_formula.index(char)
                })
    
    return problematic
```

**Prevention:**
- Formulas with ambiguous characters require confidence ≥ 0.93
- Provide visual context (image snippet) to reviewer
- Dictionary: common formula patterns (P = U·I → expect multiplication)

**Recovery:**
- Show extracted formula + original image snippet
- Reviewer selects correct symbol from list

---

### Failure Class 1.3: Decimal Separator Confusion

**Symptom:**
```
Expected:  4.5 (decimal point)
Extracted: 45 (no separator)
OR
Expected:  4,5 (European comma)
Extracted: 45 (no separator)
```

**Root Cause:**
- Image quality (faint decimal point)
- Font style (period might look like artifact)
- Language context ambiguity (. vs , vs context)

**Frequency:** ~3% of numeric values

**Impact:** CRITICAL
- 4.5 vs 45 = 10× difference in magnitude

**Detection Method:**
```python
def detect_separator_error(value, unit, context):
    """Detect if decimal separator likely missing"""
    
    # Check against engineering ranges
    if unit in engineering_ranges:
        min_val, max_val = engineering_ranges[unit]
        
        # Is value way outside expected range?
        if not (min_val <= value <= max_val):
            # Could be missing separator
            
            # Try adding separators
            with_point = value / 10
            with_comma = value / 10  # Same effect
            
            if min_val <= with_point <= max_val:
                return 'likely_missing_separator'
    
    return 'ok'
```

**Prevention:**
- Numeric confidence must include separator_confidence
- Post-extraction: validate value against engineering ranges
- If separator confidence < 0.85, require review

**Recovery:**
- Show extracted value + expected range
- Reviewer confirms/corrects separator

---

## CATEGORY 2: Numeric Corruption

### Failure Class 2.1: Digit Transposition

**Symptom:**
```
Expected:  256
Extracted: 265
```

**Root Cause:**
- Blurred digits (6 and 5 close together)
- OCR confidence fluctuation (reads 65 instead of 56)

**Frequency:** ~2% of multi-digit numbers

**Impact:** HIGH
- 256 mm² vs 265 mm² = different cable rating

**Detection Method:**
```python
def detect_digit_transposition(value, previous_values, unit):
    """Detect if digits likely transposed"""
    
    # Check variance with historical values
    if unit in historical_data:
        mean_val = mean(historical_data[unit])
        std_val = std(historical_data[unit])
        
        # Is value unusual?
        z_score = (value - mean_val) / std_val
        if abs(z_score) > 2:
            # Outlier — might be transposition
            
            # Check permutations
            digits = str(value)
            permutations = [int(''.join(p)) for p in itertools.permutations(digits)]
            
            for perm in permutations:
                if (mean_val - std_val) <= perm <= (mean_val + std_val):
                    return f'likely_transposition: {value} → {perm}'
    
    return 'ok'
```

**Prevention:**
- Confidence includes digit-by-digit recognition
- Post-extraction: compare against historical distribution
- Flag outliers for review

**Recovery:**
- Show extracted value + suggest correct value
- Reviewer confirms

---

### Failure Class 2.2: Minus Sign Corruption

**Symptom:**
```
Expected:  −5 (negative)
Extracted: 5 (positive)
```

**Root Cause:**
- Minus sign rendered as hyphen or en-dash
- Image quality issues
- Character encoding ambiguity (−, -, —)

**Frequency:** ~1% of values (low, but high-impact)

**Impact:** CRITICAL
- Sign error can reverse entire calculation
- Example: tolerance −5%...+10% becomes +5%...+10%

**Detection Method:**
```python
def detect_sign_corruption(values, context):
    """Detect if sign might be incorrect"""
    
    # Check electrical/physical laws
    # Example: voltage, current usually positive
    # Tolerance usually has negative component
    
    if 'tolerance' in context.lower():
        for value in values:
            if value > 0:
                # Tolerance should have negative part
                return f'sign_error_likely: {value} should be negative'
    
    # Check magnitude consistency
    # Example: if -5 was read as 5, it would be major outlier
    return 'ok'
```

**Prevention:**
- Separate sign recognition from digit recognition
- Post-extraction validation: check context (tolerance, offset, etc.)
- Confidence floor for signed numbers: 0.96

**Recovery:**
- Show extracted value + context
- Reviewer confirms sign

---

## CATEGORY 3: Table Errors

### Failure Class 3.1: Cell Misalignment

**Symptom:**
```
Expected table:
| Cable | Current |
| 1 mm² | 10 A    |
| 2 mm² | 20 A    |

Extracted (misaligned):
| Cable | Current |
| 1 mm² | 20 A    |  ← WRONG: 1mm² paired with 20A
| 2 mm² | 10 A    |  ← WRONG: 2mm² paired with 10A
```

**Root Cause:**
- Table structure not recognized correctly
- Column boundaries offset by 1-2 pixels
- Row/column alignment calculation error

**Frequency:** ~4% of tables

**Impact:** CRITICAL
- Wrong cable-current pairing → safety hazard

**Detection Method:**
```python
def detect_table_misalignment(table):
    """Detect if cells might be misaligned"""
    
    # Method 1: Sanity check — values should follow patterns
    # Example: Current should monotonically increase with cable size
    
    cables = [row[0] for row in table.rows]  # Column 0
    currents = [row[1] for row in table.rows]  # Column 1
    
    # Extract numeric values
    cable_sizes = [extract_numeric(c) for c in cables]
    current_values = [extract_numeric(c) for c in currents]
    
    # Check monotonicity
    is_increasing = all(
        cable_sizes[i] <= cable_sizes[i+1] and
        current_values[i] <= current_values[i+1]
        for i in range(len(cable_sizes)-1)
    )
    
    if not is_increasing:
        return 'table_likely_misaligned'
    
    # Method 2: Check column boundary precision
    # ...
    
    return 'ok'
```

**Prevention:**
- Structural validation before cell extraction
- Sanity checks on table data (monotonicity, range, etc.)
- Confidence includes alignment_confidence

**Recovery:**
- Show extracted table + sanity check failures
- Reviewer manually re-aligns cells

---

### Failure Class 3.2: Row/Column Confusion

**Symptom:**
```
Table reads as:
  Row: [4.5, 10, 25, 30]  (should be column)
  Instead of:
  Col: [4.5, 10, 25, 30]
```

**Root Cause:**
- Rotated table (45° angle)
- Transposed table reading
- OCR thinks horizontal table is vertical

**Frequency:** ~2% of tables

**Impact:** HIGH
- Completely inverts table semantics

**Detection Method:**
```python
def detect_row_col_confusion(table):
    """Check if table might be transposed"""
    
    # Check if row/column counts unusual
    num_rows = len(table.rows)
    num_cols = len(table.rows[0]) if table.rows else 0
    
    # If 1 row × 10 cols, but header suggests many properties
    if num_rows == 1 and num_cols > 5:
        # Likely transposed
        return 'table_likely_transposed'
    
    # Check header consistency
    header = table.rows[0]
    if header has_numeric_values:
        # Headers are usually text, not numbers
        return 'table_likely_transposed'
    
    return 'ok'
```

**Prevention:**
- Rotation detection before table extraction
- Header/data row identification
- Confidence includes rotation_confidence

**Recovery:**
- Show original image + detected table
- Reviewer confirms orientation

---

## CATEGORY 4: Language Confusion

### Failure Class 4.1: Cyrillic/Latin Ambiguity

**Symptom:**
```
Expected:  Усредённый (Russian: "averaged")
Extracted: Ycpedённый (mixed Cyrillic/Latin)
```

**Root Cause:**
- Characters with identical glyphs (А = A, е = e, о = o, etc.)
- Language detection failure
- Font rendering makes characters indistinguishable

**Frequency:** ~4% of multilingual documents

**Impact:** MEDIUM-HIGH
- Corruption of parameter names, units, descriptions
- Word becomes unrecognizable

**Detection Method:**
```python
def detect_cyrillic_latin_confusion(text):
    """Detect mixed Cyrillic/Latin in same word"""
    
    words = text.split()
    suspicious = []
    
    for word in words:
        cyrillic_chars = sum(1 for c in word if is_cyrillic(c))
        latin_chars = sum(1 for c in word if is_latin(c))
        
        # Single word shouldn't mix scripts
        if cyrillic_chars > 0 and latin_chars > 0:
            suspicious.append(word)
    
    return suspicious
```

**Prevention:**
- Language detection per paragraph
- Symbol-level language identification
- Post-extraction vocabulary check
- Confidence includes language_consistency

**Recovery:**
- Show word + suggest corrections based on dictionary
- Reviewer selects correct form

---

### Failure Class 4.2: Wrong Language Detection

**Symptom:**
```
Expected:  Russian document
Extracted: Language detected as English
```

**Root Cause:**
- Too much English text (comments, units like "kW")
- Language detector confusion

**Frequency:** ~1% of documents

**Impact:** MEDIUM
- Wrong language → wrong confidence models applied
- Numbers might use wrong decimal separator expectation

**Detection Method:**
```python
def detect_wrong_language(text, expected_language):
    """Check if language detection matches expected"""
    
    detected_lang = detect_language(text)
    
    if detected_lang != expected_language:
        # Check confidence
        lang_confidence = language_detector.confidence(text)
        
        if lang_confidence < 0.85:
            return 'language_detection_uncertain'
    
    return 'ok'
```

**Prevention:**
- Require explicit language specification in extraction request
- Cross-validate with document metadata
- Flag low-confidence language detection

**Recovery:**
- Show detected language + suggest correction
- Re-run extraction with correct language

---

## CATEGORY 5: Confidence Miscalibration

### Failure Class 5.1: Overconfident Extraction

**Symptom:**
```
Extracted: "P = 2 · U · I" with confidence 0.98
Actual:    "P = √3 · U · I · cos(φ)"
→ System thinks high-confidence correct, but it's wrong
```

**Root Cause:**
- Confidence model not calibrated against real data
- Low-quality PDF but OCR engine still produces high confidence (optical illusion)
- Validation corpus doesn't cover specific document type

**Frequency:** ~5-8% (typical calibration error)

**Impact:** CRITICAL
- False sense of security
- Reviewers skip low-confidence review, trust high-confidence → errors slip through

**Detection Method:**
```python
def detect_overconfidence(extraction):
    """Monitor if high-confidence extractions are actually wrong"""
    
    if extraction.confidence >= 0.95:
        # These should rarely be wrong (< 5%)
        
        # Track in production
        production_errors = query_errors_table(
            confidence_range=(0.95, 1.0),
            time_window='30_days'
        )
        
        error_rate = len(production_errors) / total_high_conf_extractions
        
        if error_rate > 0.05:
            alert('Overconfidence detected: {:.1%} error rate'.format(error_rate))
    
    return production_errors
```

**Prevention:**
- Calibrate on diverse corpus (not just "good" documents)
- Include low-quality examples in training
- Continuous monitoring in production
- Trigger recalibration if error rate > 5%

**Recovery:**
- Recalibrate confidence models
- Lower confidence thresholds
- Increase human review coverage

---

### Failure Class 5.2: Underconfident Extraction

**Symptom:**
```
Extracted: "P = √3 · U · I · cos(φ)" with confidence 0.72
→ System requires review, but extraction is actually correct
```

**Root Cause:**
- Overly conservative calibration
- Confidence model trained on hard examples only

**Frequency:** ~10-20% (if threshold set too high)

**Impact:** MEDIUM
- Operational: more manual review needed
- Cost: reviewer time wasted on correct extractions

**Detection Method:**
```python
def detect_underconfidence(extraction):
    """Monitor unnecessary review burden"""
    
    if extraction.confidence < 0.92:
        # These require review
        
        # Track how many are actually correct
        reviewed = query_review_table(
            extraction_id=extraction.id
        )
        
        if reviewed.needed_correction == False:
            # Unnecessary review
            return 'underconfident_extraction'
```

**Prevention:**
- Monitor ratio of unnecessary reviews
- Adjust thresholds to balance precision/recall
- Target: ~5% false positives (wrong extractions caught by review)
           ~20% false negatives acceptable (unnecessary reviews)

**Recovery:**
- Increase confidence threshold slightly
- Reduce review burden while maintaining safety

---

## Master Failure Index

| Category | Failure Class | Symptom | Frequency | Impact | Detection | Prevention |
|---|---|---|---|---|---|---|
| Symbol | Greek confusion | α → a | ~5% | CRITICAL | Single-letter check | Fine-tune OCR |
| Symbol | Math symbols | √ → V | ~8% | CRITICAL | Operand position | Confidence floor |
| Symbol | Decimal separator | 4.5 → 45 | ~3% | CRITICAL | Range check | Post-validation |
| Numeric | Digit transpose | 256 → 265 | ~2% | HIGH | Distribution check | Confidence + validation |
| Numeric | Minus sign | −5 → 5 | ~1% | CRITICAL | Context check | Separate sign |
| Table | Cell misalign | Row↔Col pair | ~4% | CRITICAL | Monotonicity check | Structural validation |
| Table | Row/Col confusion | Transposed | ~2% | HIGH | Dimension check | Rotation detection |
| Lang | Cyrillic/Latin | Mixed scripts | ~4% | MEDIUM-HIGH | Script detection | Language detection |
| Lang | Wrong language | RU detected as EN | ~1% | MEDIUM | Cross-validation | Explicit language |
| Calibr | Overconfident | High-conf but wrong | ~5-8% | CRITICAL | Production monitoring | Recalibration |
| Calibr | Underconfident | Low-conf but right | ~10-20% | MEDIUM | Review efficiency | Threshold adjustment |

---

## Integration with Review Workflow

```
Extraction
  ↓
Confidence Score
  ↓
Failure Detection (all 11 failure classes)
  ↓ (if failure detected)
Flag for review + attach detection info
  ↓
Reviewer sees:
  - Extracted value
  - Failure detection results
  - Original image context
  - Suggested corrections
  ↓
Reviewer: Accept/Correct/Reject
```

---

## Следующий шаг

После failure taxonomy:
→ `OCR_REVIEW_GOVERNANCE.md` (operational human review workflows)

---

**Статус:** OCR Failure Taxonomy ГОТОВА К ИСПОЛЬЗОВАНИЮ.

Ключевая идея: **Классифицируй ошибки → Выявляй автоматически → Направляй на review.**
