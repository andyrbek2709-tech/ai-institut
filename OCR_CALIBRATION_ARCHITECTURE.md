# OCR Confidence Calibration Architecture

**Версия:** 1.0  
**Дата:** 2026-05-09  
**Статус:** ✅ Calibration Framework Design  

---

## Обзор

Confidence Calibration Architecture спроектирует методологию и инструменты для:
- Измерения OCR уверенности (confidence scores)
- Калибровки confidence против реальных ошибок
- Установки risk-adjusted thresholds
- Мониторинга calibration drift в production

**Критический факт:** 0.99 confidence ≠ 99% вероятность correctness.

```
Calibration Error = P(actual error | confidence = X) ≠ (1 - X)
```

---

## Архитектура калибровки

### Слой 1: Raw Confidence Scores (OCR engine)
```
PDF Input
  ↓
Preprocessing (rotation, normalization)
  ↓
Tesseract/PaddleOCR/OpenAI Vision
  ↓
Raw Confidence Scores: C_raw ∈ [0, 1] per character/word/region
  ↓
Aggregation (per extraction)
  ↓
C_aggregated (например, средняя по слову/формуле/таблице)
```

### Слой 2: Domain-Specific Confidence Models
```
C_aggregated + Context + Extraction Type
  ↓
Domain Models (formula vs numeric vs table)
  ↓
C_domain ∈ [0, 1] (calibrated)
```

### Слой 3: Risk-Adjusted Thresholds
```
C_domain + Risk Category + Regulatory Impact
  ↓
Threshold Decision
  ↓
{auto-accept, require-review, reject}
```

---

## Extraction Types & Calibration Models

### Type 1: Formulas
**Сложность:** Высокая (специальные символы, структура).

#### Raw Confidence Components
```python
C_formula = {
  'symbol_confidence': mean([char_confidence for char in formula]),
  'structure_confidence': how_well_recognized_math_structure,
  'completeness': did_we_get_all_parts_of_formula,
}
```

#### Domain Model Training
```
Validation Corpus:
  - 100+ scanned formulas (ground truth)
  - Extract с Tesseract/PaddleOCR
  - Compare с ground truth
  - Build calibration curve: C_raw → P(correct)

Example calibration data:
  C_raw = 0.85 → 62% actually correct (uncalibrated)
  C_raw = 0.92 → 88% actually correct (calibrated)
  C_raw = 0.98 → 94% actually correct (still < 100%)
```

#### Calibration Function
```python
def calibrate_formula(c_raw, c_symbol, c_structure):
    # Isotonic regression (non-parametric)
    # OR
    # Logistic regression: log(odds) = w0 + w1*c_raw + w2*c_symbol + w3*c_structure
    
    c_calibrated = isotonic_regressor.transform(c_raw)
    
    # Apply symbol-specific adjustments
    if contains_greek_letters:
        c_calibrated *= symbol_correction_factor[greek]
    if contains_division_bar:
        c_calibrated *= structure_correction_factor[fractions]
    
    return c_calibrated
```

#### Confidence Floor
**Formula confidence minimum:** 0.95 (из risk analysis — formulas high-impact)

**Decision logic:**
```
if C_formula ≥ 0.95:
    -> Accept (but log for monitoring)
else:
    -> Require human review
```

---

### Type 2: Numeric Values
**Сложность:** Средняя (цифры + decimal separators + units).

#### Raw Confidence Components
```python
C_numeric = {
  'digit_confidence': mean([digit_conf for digit in value]),
  'separator_confidence': confidence_in_decimal_separator,
  'unit_confidence': confidence_in_unit_recognition,
}
```

#### Common Error Modes
```
Error Mode                   | Frequency | Detection
---|---|---
Decimal separator (4.5 → 45) | ~8%       | Range check + unit-magnitude check
Minus sign (−5 → 5)          | ~3%       | Contextual magnitude check
Digit swap (15 → 51)         | ~2%       | Magnitude outlier detection
Trailing zeros (100 → 1000)  | ~1%       | Engineering range constraints
Cyrillic/Latin (0 vs O)      | ~4%       | Language detection + dictionary
```

#### Domain Model
```python
def calibrate_numeric(c_raw, c_digits, c_sep, c_unit, extracted_value, unit):
    c_calibrated = c_raw
    
    # Separator confidence heavily weighted
    if c_sep < 0.8 and is_decimal_critical:
        c_calibrated *= 0.7  # Reduce confidence
    
    # Unit validation
    if unit not in valid_engineering_units:
        c_calibrated *= 0.5  # Major reduction
    
    # Range validation
    if extracted_value outside_engineering_range(unit):
        c_calibrated *= 0.6
    
    return isotonic_regressor_numeric.transform(c_calibrated)
```

#### Confidence Floor
**Numeric confidence minimum:** 0.96 (higher than formulas — precision critical)

---

### Type 3: Table Cells
**Сложность:** Средняя-высокая (структура + alignment + content).

#### Raw Confidence Components
```python
C_table_cell = {
  'content_confidence': confidence_in_cell_value,
  'structure_confidence': confidence_cell_recognized_correctly,
  'alignment_confidence': confidence_row_col_identification,
}
```

#### Structural Validation
```python
def validate_table_structure(table):
    """
    Before extracting cells, verify table integrity:
    - All rows same column count?
    - Column boundaries consistent?
    - No missing cells?
    """
    
    for row_idx, row in enumerate(table.rows):
        if len(row) != table.expected_cols:
            structural_confidence *= 0.7
        
        for col_idx, cell in enumerate(row):
            # Is cell aligned with header?
            if not cell.x_aligned_with_column(col_idx):
                cell.alignment_confidence *= 0.6
    
    return structural_confidence
```

#### Domain Model
```python
def calibrate_table_cell(c_raw, structure_conf, align_conf, row_idx, col_idx):
    c_calibrated = c_raw * structure_conf * align_conf
    
    # Row/column specific corrections
    if is_header_row(row_idx):
        c_calibrated *= header_extraction_multiplier  # Usually < 1.0
    
    if is_numeric_column(col_idx):
        # Same numeric checks as Type 2
        c_calibrated *= numeric_confidence_adjustment
    
    return isotonic_regressor_table.transform(c_calibrated)
```

#### Confidence Floor
**Table cell confidence minimum:** 0.94 (structural uncertainty)

---

### Type 4: Multilingual Content
**Сложность:** Высокая (language detection + character recognition).

#### Language-Specific Confidence
```python
C_multilingual = {
  'language_confidence': confidence_language_detected_correctly,
  'character_confidence': mean([char_conf in detected_lang for char in text]),
  'vocabulary_confidence': percentage_words_in_language_dict,
}
```

#### Cyrillic/Latin Confusion Matrix
```
Common confusions:
  А (Cyrillic A)    ↔ A (Latin A)      [indistinguishable]
  е (Cyrillic e)    ↔ e (Latin e)      [indistinguishable]
  о (Cyrillic o)    ↔ o (Latin o)      [indistinguishable]
  С (Cyrillic S)    ↔ C (Latin C)      [mostly distinguishable]
  Р (Cyrillic R)    ↔ P (Latin P)      [indistinguishable]
  К (Cyrillic K)    ↔ K (Latin K)      [indistinguishable]
  О (Cyrillic O)    ↔ 0 (digit zero)   [common error]
```

#### Domain Model
```python
def calibrate_multilingual(c_raw, lang_conf, char_conf, vocab_conf, text):
    # Language boundary detection
    detected_langs = detect_language_switches(text)
    
    if len(detected_langs) > 1:
        # Mixed language — higher risk
        boundary_confidence = assess_boundary_clarity()
        c_calibrated = c_raw * boundary_confidence
    else:
        c_calibrated = c_raw
    
    # Vocabulary check
    unknown_words = [w for w in text if w not in language_dict]
    if len(unknown_words) / len(text.words) > 0.05:
        c_calibrated *= 0.8  # Unusual terminology
    
    # Cyrillic/Latin confusion check
    for char in text:
        if char in ambiguous_confusions:
            char_confidence = vocabulary_contextual_check(char, context)
            c_calibrated *= char_confidence
    
    return isotonic_regressor_multilingual.transform(c_calibrated)
```

#### Confidence Floor
**Multilingual confidence minimum:** 0.93 (language boundary uncertainty)

---

## Calibration Data Pipeline

### Step 1: Collect Validation Data
```
Source: OCR_VALIDATION_STRATEGY.md corpus
├── 20+ scanned standards
├── Engineering tables
├── Mathematical formulas
├── Multilingual documents
├── Low-quality scans
├── Rotated/degraded PDFs
└── Handwritten annotations
```

### Step 2: Extraction & Confidence Scoring
```python
for pdf in validation_corpus:
    for page in pdf.pages:
        extractions = ocr_engine.extract(page)
        # extractions[i] = {
        #   'type': 'formula' | 'numeric' | 'table' | 'text',
        #   'value': extracted_text,
        #   'raw_confidence': float [0, 1],
        #   'components': {...}
        # }
```

### Step 3: Ground Truth Comparison
```python
for extraction in extractions:
    ground_truth = corpus_metadata[extraction.location]
    
    if extraction.value == ground_truth.expected_value:
        correct = 1
    else:
        correct = 0
    
    calibration_dataset.append({
        'raw_confidence': extraction.raw_confidence,
        'components': extraction.components,
        'correct': correct,
        'extraction_type': extraction.type,
    })
```

### Step 4: Train Isotonic Regressors
```python
from sklearn.isotonic import IsotonicRegression

# Per-type regressors
regressors = {}
for extraction_type in ['formula', 'numeric', 'table', 'multilingual']:
    data = calibration_dataset[extraction_type]
    
    iso_reg = IsotonicRegression(out_of_bounds='clip')
    iso_reg.fit(
        X=data['raw_confidence'],
        y=data['correct']
    )
    
    regressors[extraction_type] = iso_reg

# Save regressors
with open('ocr_calibration_models.pkl', 'wb') as f:
    pickle.dump(regressors, f)
```

### Step 5: Validation Metrics
```
Per-type calibration metrics:

Formula:
  - ECE (Expected Calibration Error): mean |confidence - accuracy|
  - Brier Score: mean (confidence - correct)²
  - Coverage @ 0.95 threshold
  
Numeric:
  - Same as formula
  - + Numeric-specific: digit error rate
  
Table:
  - Same as formula
  - + Structural metrics: misalignment rate
  
Multilingual:
  - Same as formula
  - + Language detection accuracy
```

---

## Confidence Thresholds & Decision Logic

### Decision Matrix

```
Extraction Type | Confidence Floor | Decision Tree
---|---|---
Formula         | C ≥ 0.95        | If C ≥ 0.95 → Auto-accept (log); else → Review
Numeric         | C ≥ 0.96        | If C ≥ 0.96 → Auto-accept; else → Review
Table Cell      | C ≥ 0.94        | If C ≥ 0.94 → Auto-accept; else → Review
Multilingual    | C ≥ 0.93        | If C ≥ 0.93 → Auto-accept; else → Review
```

### Conservative Default
```
For new extraction types (not in calibration data):
  → Use minimum confidence floor = 0.90
  → Require human review until calibration data available
```

---

## Calibration Monitoring (Production)

### Goal
Detect когда confidence calibration drifts от validation data.

### Monitoring Queries

#### Calibration Drift Detection
```sql
SELECT
  extraction_type,
  DATE_TRUNC('day', created_at) as date,
  
  -- Bins of confidence
  WIDTH_BUCKET(confidence, 0, 1, 10) as confidence_bin,
  
  -- Actual correctness (from corrections table)
  COUNT(*) as total,
  SUM(CASE WHEN was_corrected = false THEN 1 ELSE 0 END) as actual_correct,
  
  -- Expected correctness (from calibration model)
  AVG(confidence) as mean_confidence,
  
  -- Calibration error
  ABS(
    SUM(CASE WHEN was_corrected = false THEN 1 ELSE 0 END) / COUNT(*) 
    - AVG(confidence)
  ) as calibration_error

FROM ocr_extractions
LEFT JOIN ocr_corrections ON ocr_extractions.id = ocr_corrections.extraction_id
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY extraction_type, date, confidence_bin
ORDER BY calibration_error DESC;
```

**Alert trigger:** calibration_error > 0.15 (outside acceptable bounds)

#### Threshold Effectiveness
```sql
SELECT
  extraction_type,
  confidence_threshold,
  
  -- Performance at this threshold
  COUNT(*) as total_extractions,
  SUM(CASE WHEN confidence >= $threshold THEN 1 ELSE 0 END) as accepted,
  SUM(CASE WHEN confidence < $threshold THEN 1 ELSE 0 END) as reviewed,
  
  -- Actual errors among accepted
  SUM(CASE 
    WHEN confidence >= $threshold AND was_corrected = true 
    THEN 1 ELSE 0 
  END) as false_accepts,
  
  -- Review efficiency
  SUM(CASE 
    WHEN confidence < $threshold AND was_corrected = false 
    THEN 1 ELSE 0 
  END) as unnecessary_reviews

FROM ocr_extractions
LEFT JOIN ocr_corrections ON ocr_extractions.id = ocr_corrections.extraction_id
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY extraction_type, confidence_threshold;
```

**Metric:** False accept rate should remain < 5% per extraction type.

---

## Recalibration Triggers

### Trigger 1: Distribution Shift
```
IF: confidence distribution of new documents significantly differs from training corpus
THEN: Recalibrate on new data
```

### Trigger 2: High Calibration Error
```
IF: ECE > 0.15 for any extraction type
THEN: Investigate + recalibrate
```

### Trigger 3: Systematic Bias
```
IF: Confidence systematically under/overestimated for any extraction type
THEN: Adjust isotonic regression
```

### Trigger 4: New OCR Engine Version
```
IF: Tesseract/PaddleOCR updated (major version)
THEN: Re-run validation corpus → recalibrate
```

### Trigger 5: Regulatory Feedback
```
IF: Post-deployment issues detected (errors missed by review)
THEN: Recalibrate with real production data
```

---

## Calibration Artifacts

### Stored Artifacts
```
ocr_calibration/
  v1.0/
    calibration_models.pkl           # Isotonic regressors
    validation_results.json          # Per-type ECE, Brier, coverage
    threshold_tuning.json            # Optimal thresholds per type
    metadata.json                    # Creation date, corpus version
```

### Model Versioning
```
When retraining:
  - Save v2.0 alongside v1.0
  - Update config to point to v2.0
  - Keep v1.0 for audit trail
  - Compare v1.0 vs v2.0 metrics
```

---

## ключевые метрики

| Метрика | Формула | Интерпретация |
|---|---|---|
| ECE | mean \|pred_conf - actual_acc\| | Calibration quality; < 0.05 excellent |
| Brier Score | mean (pred_conf - actual)² | Confidence + accuracy alignment |
| Coverage @ threshold | % accepted at threshold | How many extractions auto-accepted |
| False Accept Rate | % high-conf but incorrect | Risk of undetected errors |
| Precision @ threshold | correct / (correct + wrong) | Actual accuracy at threshold |

---

## Следующий шаг

После calibration architecture завершена:
→ `OCR_FAILURE_TAXONOMY.md` (failure classification & detection)

---

**Статус:** OCR Confidence Calibration Architecture ГОТОВА.

Ключевая идея: **Доверяй confidence, но проверяй с валидацией корпусом.**
