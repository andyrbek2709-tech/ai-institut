# OCR Reproducibility Validation Framework

**Версия:** 1.0  
**Дата:** 2026-05-09  
**Статус:** ✅ Reproducibility Testing Framework  

---

## Обзор

OCR Reproducibility Validation Framework спроектирует методологию для:
- Доказательства детерминизма OCR extraction
- Версионирования preprocessing + OCR engine
- Гарантии: same PDF + same setup = same extraction
- Audit safety (reproducibility enables auditing)

**Критический факт:** Та же PDF файл должна производить идентичную OCR extraction candidate при одинаковых условиях, несмотря на вероятностную природу confidence scores.

---

## Детерминизм в OCR

### Уровень 1: Byte-Level Determinism ✗
```
GOAL: exact_same_bytes_output
  ├─ Same PDF + Same Tesseract version
  │   → byte-identical output? RARE
  │
  └─ Why not?
      - Floating point rounding
      - Library version differences
      - Memory layout differences
```

**Verdict:** Byte-level determinism NOT required.

### Уровень 2: Extraction Candidate Determinism ✓
```
GOAL: same_extracted_value_and_confidence
  ├─ Same PDF + Same Tesseract + Same preprocessing
  │   → extracted values identical? YES
  │   → confidence scores identical? MOSTLY (minor floating-point variance)
  │
  └─ Why yes?
      - Tesseract is deterministic (given same config)
      - Preprocessing is deterministic (same algorithm)
      - Floating point rounding is reproducible (same machine)
```

**Verdict:** Extraction candidate determinism IS achievable and required.

### Уровень 3: Review Decision Determinism ?
```
GOAL: same_extraction_→_same_review_decision
  ├─ Same extracted value + Same reviewer
  │   → Same decision? USUALLY (human can vary)
  │
  └─ Why maybe not?
      - Reviewers have off days
      - Ambiguous cases might be reviewed differently
      - No strict decision logic (mostly human judgment)
```

**Verdict:** Review decision determinism NOT achievable (human judgment), but process should be consistent.

---

## Версионирование: Determinism Boundary

### Component Versions Affecting Determinism

```
Level | Component          | Version Type | Impact on Determinism
---|---|---|---
1    | Source PDF         | File hash    | CRITICAL (primary input)
2    | Preprocessing      | Algorithm v  | CRITICAL (transforms input)
3    | OCR Engine         | Tesseract v  | CRITICAL (generates extraction)
4    | Language Packs     | LANG_v       | CRITICAL (character recognition)
5    | Confidence Model   | CALIB_v      | AFFECTS (confidence scores only)
6    | Failure Detector   | DETECT_v     | META (doesn't change extraction)
7    | Reviewer          | Human        | META (review decision)
```

**Extraction Determinism Boundary:**
```
extraction_hash = hash(
    pdf_content,
    preprocessing_version,
    ocr_engine_version,
    language_packs_version,
    ocr_engine_config
)

Note: confidence_model_version NOT included
  (changing confidence_model shouldn't change extracted_value)
  (confidence scores might change, but extracted value stays same)
```

---

## Reproducibility Testing Protocol

### Test 1: Baseline Extraction Test

**Goal:** Establish baseline OCR extraction with specific PDF + versions.

```python
def test_baseline_extraction():
    """
    Extract from validation corpus with pinned versions.
    Store results as golden copy for future comparisons.
    """
    
    pdf_path = 'ocr_validation_corpus/v1.0/documents/standards/IEC-60038.pdf'
    
    # Pin all versions
    config = {
        'pdf_path': pdf_path,
        'preprocessing_version': '1.0',
        'ocr_engine': 'tesseract',
        'ocr_engine_version': '5.3.0',
        'language_packs_version': 'chi_sim-1.0',
        'ocr_config': 'configs/english-scientific.cfg',
        'confidence_model_version': '1.0',  # For reference only
    }
    
    # Extract
    extraction = extract_from_pdf(config, pdf_path)
    
    # Store baseline
    with open('baselines/IEC-60038-tesseract-5.3.0.json', 'w') as f:
        json.dump({
            'config': config,
            'extraction': extraction,
            'created_at': datetime.now().isoformat(),
        }, f, indent=2)
    
    return extraction
```

### Test 2: Determinism Verification Test

**Goal:** Verify that re-running extraction produces identical results.

```python
def test_determinism_same_pdf_same_versions():
    """
    Re-extract from same PDF with same configuration.
    Compare extracted values (NOT confidence scores).
    """
    
    baseline_path = 'baselines/IEC-60038-tesseract-5.3.0.json'
    with open(baseline_path) as f:
        baseline = json.load(f)
    
    # Re-extract with exact same config
    new_extraction = extract_from_pdf(
        config=baseline['config'],
        pdf_path=baseline['config']['pdf_path']
    )
    
    # Compare extracted values (ignore confidence variance)
    for baseline_item, new_item in zip(baseline['extraction'], new_extraction):
        assert baseline_item['value'] == new_item['value'], \
            f"Extraction mismatch: {baseline_item['value']} vs {new_item['value']}"
        
        # Confidence might vary slightly (acceptable: < 0.01)
        confidence_diff = abs(baseline_item['confidence'] - new_item['confidence'])
        assert confidence_diff < 0.01, \
            f"Confidence drift: {confidence_diff} (acceptable < 0.01)"
    
    print("✅ Determinism verified: same PDF + same versions = same extraction")
```

### Test 3: Version Pinning Test

**Goal:** Verify that version pinning works correctly.

```python
def test_version_pinning():
    """
    Extract with different OCR engine versions.
    Verify that different versions produce different extractions.
    """
    
    pdf_path = 'ocr_validation_corpus/v1.0/documents/standards/IEC-60038.pdf'
    
    # Extract with Tesseract 5.2.0
    extraction_v520 = extract_from_pdf(
        config={
            'ocr_engine_version': '5.2.0',
            ...
        },
        pdf_path=pdf_path
    )
    
    # Extract with Tesseract 5.3.0
    extraction_v530 = extract_from_pdf(
        config={
            'ocr_engine_version': '5.3.0',
            ...
        },
        pdf_path=pdf_path
    )
    
    # Should be different (different engine versions)
    extraction_hashes = {
        '5.2.0': hash_extraction(extraction_v520),
        '5.3.0': hash_extraction(extraction_v530),
    }
    
    assert extraction_hashes['5.2.0'] != extraction_hashes['5.3.0'], \
        "Different OCR versions should produce different extractions"
    
    print(f"✅ Version difference verified:")
    print(f"  v5.2.0 hash: {extraction_hashes['5.2.0']}")
    print(f"  v5.3.0 hash: {extraction_hashes['5.3.0']}")
```

### Test 4: Preprocessing Stability Test

**Goal:** Verify preprocessing produces deterministic output.

```python
def test_preprocessing_determinism():
    """
    Run preprocessing multiple times on same PDF.
    Verify preprocessed images are byte-identical.
    """
    
    pdf_path = 'ocr_validation_corpus/v1.0/documents/standards/IEC-60038.pdf'
    
    # Preprocess 3 times
    preprocessed_1 = preprocess_pdf(pdf_path, version='1.0')
    preprocessed_2 = preprocess_pdf(pdf_path, version='1.0')
    preprocessed_3 = preprocess_pdf(pdf_path, version='1.0')
    
    # Compare hashes
    hash_1 = hash_images(preprocessed_1['images'])
    hash_2 = hash_images(preprocessed_2['images'])
    hash_3 = hash_images(preprocessed_3['images'])
    
    assert hash_1 == hash_2 == hash_3, \
        "Preprocessing should be deterministic"
    
    print(f"✅ Preprocessing determinism verified: {hash_1}")
```

### Test 5: Confidence Model Isolation Test

**Goal:** Verify that changing confidence model doesn't change extracted values.

```python
def test_confidence_model_isolated():
    """
    Extract with confidence_model v1.0, then v2.0.
    Verify extracted values identical, confidence scores might differ.
    """
    
    pdf_path = 'ocr_validation_corpus/v1.0/documents/standards/IEC-60038.pdf'
    
    # Extract with confidence model v1.0
    config_v10 = {
        'ocr_engine_version': '5.3.0',
        'confidence_model_version': '1.0',
        ...
    }
    extraction_v10 = extract_from_pdf(config_v10, pdf_path)
    
    # Extract with confidence model v2.0 (same OCR engine, different calibration)
    config_v20 = {
        'ocr_engine_version': '5.3.0',
        'confidence_model_version': '2.0',
        ...
    }
    extraction_v20 = extract_from_pdf(config_v20, pdf_path)
    
    # Compare extracted values (should be identical)
    for item_10, item_20 in zip(extraction_v10, extraction_v20):
        assert item_10['value'] == item_20['value'], \
            f"Extracted value should not change with confidence model: " \
            f"{item_10['value']} vs {item_20['value']}"
        
        # Confidence scores might differ
        print(f"  {item_10['value']}: conf v1.0={item_10['confidence']:.2f}, " \
              f"conf v2.0={item_20['confidence']:.2f}")
    
    print("✅ Confidence model isolated: different calibration, same extraction")
```

---

## Version Registry

### Schema

```sql
CREATE TABLE ocr_version_registry (
  id UUID PRIMARY KEY,
  
  -- Version specification
  component VARCHAR,  -- 'preprocessing', 'ocr_engine', 'language_packs', etc.
  version VARCHAR,    -- '1.0', '5.3.0', etc.
  
  -- Determinism implications
  affects_extraction BOOLEAN,  -- Does changing this affect extracted values?
  affects_confidence BOOLEAN,  -- Does changing this affect confidence?
  
  -- Metadata
  source_url VARCHAR,          -- Where to download
  release_date DATE,
  checksum VARCHAR,            -- SHA256 of binary/config
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(component, version)
);
```

### Example Entries

```sql
INSERT INTO ocr_version_registry VALUES
  (
    uuid_generate_v4(),
    'preprocessing',
    '1.0',
    true,   -- Changes in preprocessing affect extraction
    false,  -- But don't affect confidence directly
    'internal://preprocessing-v1.0.tar.gz',
    '2025-01-15',
    'abc123def456...',
    'Initial deterministic preprocessing',
    NOW()
  ),
  (
    uuid_generate_v4(),
    'ocr_engine',
    'tesseract-5.3.0',
    true,   -- OCR engine changes affect extraction
    false,  -- Direct affect on confidence (confidence model independent)
    'https://github.com/UB-Mannheim/tesseract/releases/tag/v5.3.0',
    '2023-09-10',
    'xyz789...',
    'Tesseract 5.3.0 release',
    NOW()
  ),
  (
    uuid_generate_v4(),
    'confidence_model',
    '1.0',
    false,  -- Changing confidence model DOES NOT change extraction
    true,   -- But DOES change confidence scores
    'internal://confidence-model-v1.0.pkl',
    '2026-01-20',
    'conf123...',
    'Initial calibration model (trained on validation corpus)',
    NOW()
  );
```

---

## Extraction Lineage & Reproducibility

### Extraction Metadata

```sql
CREATE TABLE ocr_extractions (
  id UUID PRIMARY KEY,
  
  -- Source
  document_id VARCHAR,
  pdf_path VARCHAR,
  pdf_hash VARCHAR,      -- SHA256 of original PDF
  page_num INT,
  
  -- Configuration (versions)
  preprocessing_version VARCHAR,
  ocr_engine_version VARCHAR,
  language_packs_version VARCHAR,
  ocr_config_name VARCHAR,
  confidence_model_version VARCHAR,
  
  -- Extraction candidate
  extracted_value VARCHAR,
  extraction_type VARCHAR,
  raw_confidence FLOAT,
  
  -- Determinism tracking
  extraction_hash VARCHAR,  -- hash(value + raw_confidence)
  reproducibility_verified BOOLEAN,
  reproducibility_check_date TIMESTAMP,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(pdf_hash, page_num, extracted_value)
);
```

### Reproducibility Queries

```sql
-- Check if extraction is reproducible with current versions
SELECT
  oe.id,
  oe.extracted_value,
  oe.ocr_engine_version,
  oe.preprocessing_version,
  oe.reproducibility_verified,
  
  -- How old is this extraction compared to current pinned versions?
  CASE
    WHEN oe.ocr_engine_version != (SELECT version FROM ocr_version_registry 
                                   WHERE component = 'ocr_engine' ORDER BY created_at DESC LIMIT 1)
    THEN 'OLD_OCR_ENGINE'
    WHEN oe.preprocessing_version != (SELECT version FROM ocr_version_registry 
                                       WHERE component = 'preprocessing' ORDER BY created_at DESC LIMIT 1)
    THEN 'OLD_PREPROCESSING'
    ELSE 'CURRENT'
  END as version_status

FROM ocr_extractions oe
WHERE reproducibility_verified = false;
```

---

## Re-reproducibility Testing

### Scenario: OCR Engine Updated

```
IF: Tesseract updated from 5.3.0 → 5.4.0

THEN:
  1. Mark all extractions from v5.3.0 as 'potentially_stale'
  2. Run test_determinism_same_pdf_same_versions with sample PDFs
  3. If tests pass: version migration OK (mark extractions 'current')
  4. If tests fail: version migration BLOCKS production use
     (must re-extract with v5.4.0)
```

---

## Следующий шаг

После reproducibility framework:
→ `OCR_RELEASE_GATE.md` (formal deployment criteria)

---

**Статус:** OCR Reproducibility Validation Framework ГОТОВА.

Ключевая идея: **Version pinning → deterministic extraction → audit safety.**
