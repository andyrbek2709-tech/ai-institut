# OCR DETERMINISM RISKS & MITIGATION ARCHITECTURE

**Status:** 📋 CRITICAL RISK ANALYSIS  
**Focus:** OCR as confidence-aware assisted layer, NOT deterministic extraction  
**Target:** Audit + traceability before Week 2 implementation

---

## EXECUTIVE SUMMARY

**Current architecture error:**
- OCR treated as deterministic extraction
- OCR output directly used for extraction_hash
- Different OCR engine version → different hash
- Same document → different extraction identity (false deduplication failures)

**After hardening:**
- OCR recognized as confidence-aware assisted layer
- OCR audit trail separate from deterministic payload
- Same canonical text regardless of OCR engine version
- Full traceability: which OCR used, confidence, preprocessing

---

## RISK 1: OCR ENGINE VERSION VARIANCE

### The Problem

```python
# PDF page: "гравий" (gravel, in Russian)
ocr_output_v4 = tesseract_4_1_1.recognize(page_image)  # "гравий"
ocr_output_v5 = tesseract_5_2_0.recognize(page_image)  # "гравий" (slightly different confidence)

extraction_hash_v4 = hash(ocr_output_v4)
extraction_hash_v5 = hash(ocr_output_v5)

# extraction_hash_v4 != extraction_hash_v5
# → Same document, different OCR version → different extraction identity
# → Deduplication breaks
# → Lineage breaks
```

### Why It Happens

1. **OCR engine differences:** Each version has different models/training
2. **Preprocessing differences:** Image enhancement algorithm changes
3. **Confidence thresholds:** Different filtering of low-confidence chars
4. **Language models:** Different statistical models for Cyrillic

### Impact

- 🔴 **Deduplication failure:** Document ingested twice (with different OCR versions) → 2 identities
- 🔴 **Lineage fragmentation:** Same source document → multiple extraction records
- 🔴 **Audit trail breaks:** Can't track "same document" across OCR upgrades
- 🔴 **Regulatory risk:** "Which OCR version was used for this extraction?"

### Mitigation Architecture

**Separate OCR audit from deterministic payload:**

```python
@dataclass
class OcrAudit:
    """Complete OCR metadata — never included in deterministic_hash."""
    
    engine: str              # "tesseract:5.2.0" | "paddle:2.4.1"
    engine_version: str
    confidence_global: float
    preprocessing_steps: List[str]
    preprocessing_config_hash: str  # Config version, not content
    
    page_number: int
    page_image_resolution: Tuple[int, int]  # DPI
    page_orientation: int  # degrees
    
    raw_text: str  # Raw OCR output (not normalized)
    raw_confidence_per_line: List[float]
    
    # Timing (for monitoring, NOT hashing)
    ocr_duration_ms: int
    preprocessing_duration_ms: int

@dataclass
class CanonicalText:
    """Normalized text — deterministic & version-independent."""
    
    text: str  # After normalization
    
    # Normalization rules applied
    normalization_config: str  # e.g., "whitespace:collapse,unicode:nfc"
    normalization_version: str  # e.g., "canonical:1.0"
    
    @property
    def deterministic_representation(self) -> str:
        """Canonical form for hashing (OCR-version-independent)."""
        return self.text

@dataclass
class PageExtraction:
    """Single page extraction with full audit trail."""
    
    page_number: int
    
    # Raw OCR output (fully auditable)
    ocr_audit: Optional[OcrAudit]  # None if direct text (PDF)
    
    # Canonical normalized text
    canonical_text: CanonicalText
    
    # Deterministic payload (OCR-version-independent)
    @property
    def deterministic_text(self) -> str:
        """Text for extraction_hash — immune to OCR version."""
        return self.canonical_text.deterministic_representation
    
    # Audit query methods
    def get_ocr_confidence(self) -> float:
        return self.ocr_audit.confidence_global if self.ocr_audit else 1.0
    
    def was_ocr_extracted(self) -> bool:
        return self.ocr_audit is not None
    
    def get_ocr_engine_used(self) -> Optional[str]:
        return self.ocr_audit.engine if self.ocr_audit else None
```

**Guarantee:**
- `PageExtraction.deterministic_text` = **SAME** regardless of OCR version
- `PageExtraction.ocr_audit` = **COMPLETE** (engine, version, confidence, preprocessing)
- Hash = function of `deterministic_text`, not `ocr_audit`
- Same document + different OCR version = **SAME extraction_hash** (deduplication works)

---

## RISK 2: OCR CONFIDENCE DEGRADATION

### The Problem

```python
# Document with faint text
ocr_result = {
    "text": "гравий гравий гравий",
    "confidence": 0.65  # Low confidence (faint text)
}

# Current code: treats as fully reliable extraction
extraction_hash = hash(ocr_result["text"])  # No confidence tracking
confidence_flag = "high"  # WRONG

# If extracted data used in regulatory context:
# - "gравий" might be misread critical specification
# - Low confidence never flagged
# - Regulatory risk: relying on unreliable extraction
```

### Why It Happens

1. **No confidence threshold:** All OCR accepted equally
2. **No confidence logging:** Low-confidence extractions not flagged
3. **No quality gates:** Extraction proceeds regardless of confidence

### Impact

- 🟡 **Regulatory risk:** Low-confidence data treated as reliable
- 🟡 **Audit trail incomplete:** Can't distinguish high vs. low confidence
- 🟡 **False positives:** Wrong extractions marked as trusted

### Mitigation Architecture

**Add explicit confidence tracking & thresholds:**

```python
@dataclass
class OcrConfidenceMetrics:
    """Per-page OCR confidence breakdown."""
    
    # Global confidence
    global_confidence: float  # 0.0-1.0
    
    # Per-component confidence
    character_confidence_mean: float
    character_confidence_min: float
    
    # Line-level breakdown
    lines_high_confidence: int  # >= 0.80
    lines_medium_confidence: int  # 0.50-0.80
    lines_low_confidence: int  # < 0.50
    
    # Risk assessment
    @property
    def has_low_confidence_content(self) -> bool:
        return self.lines_low_confidence > 0
    
    @property
    def confidence_level(self) -> Literal['high', 'medium', 'low']:
        if self.global_confidence >= 0.85:
            return 'high'
        elif self.global_confidence >= 0.65:
            return 'medium'
        else:
            return 'low'
    
    @property
    def requires_manual_review(self) -> bool:
        """Does this extraction need human review?"""
        return (
            self.confidence_level == 'low' or
            self.has_low_confidence_content
        )

@dataclass
class OcrQualityGate:
    """Quality gate for OCR extraction."""
    
    min_confidence_acceptable: float = 0.65  # Accept only >= 65%
    min_confidence_trusted: float = 0.85     # Fully trust >= 85%
    
    # Flags
    flag_low_confidence: bool = True
    flag_high_variance: bool = True
    flag_mixed_languages: bool = True
    
    def evaluate(self, metrics: OcrConfidenceMetrics) -> Dict[str, bool]:
        """Evaluate quality gate."""
        return {
            'acceptable': metrics.global_confidence >= self.min_confidence_acceptable,
            'trusted': metrics.global_confidence >= self.min_confidence_trusted,
            'needs_review': metrics.requires_manual_review,
            'low_confidence': metrics.confidence_level == 'low',
            'high_variance': metrics.character_confidence_min < 0.30
        }

@dataclass
class PageExtraction:
    """Updated with confidence tracking."""
    
    page_number: int
    ocr_audit: Optional[OcrAudit]
    ocr_confidence: OcrConfidenceMetrics
    canonical_text: CanonicalText
    
    # Quality assessment
    quality_gate_result: Dict[str, bool]
    
    @property
    def extraction_trustworthiness(self) -> Literal['high', 'medium', 'low', 'untrustworthy']:
        """Can we trust this extraction?"""
        
        if not self.quality_gate_result['acceptable']:
            return 'untrustworthy'
        
        if self.quality_gate_result['needs_review']:
            return 'low'
        
        if self.quality_gate_result['trusted']:
            return 'high'
        
        return 'medium'
    
    def requires_manual_review(self) -> bool:
        return self.extraction_trustworthiness in ('low', 'untrustworthy')
```

**Guarantee:**
- Low-confidence extractions **EXPLICITLY FLAGGED**
- Extraction trustworthiness **TRACKED AND AUDITABLE**
- Manual review **REQUIRED** for confidence < 0.85
- Regulatory context **CANNOT use untrustworthy extraction** without human sign-off

---

## RISK 3: OCR PREPROCESSING VARIABILITY

### The Problem

```python
# Page image with noise
image = load_pdf_page(page_number)

# Different preprocessing
text_v1 = tesseract_4.preprocess(denoise=True).recognize(image)
text_v2 = tesseract_4.preprocess(denoise=False).recognize(image)

# Different results from SAME engine version!
text_v1 != text_v2

# Hash breaks again:
hash(text_v1) != hash(text_v2)
```

### Why It Happens

1. **Preprocessing is stateful:** Different image enhancement → different OCR
2. **Preprocessing not tracked:** Which settings were used? Unknown
3. **Preprocessing version drift:** Library updates change default behavior

### Impact

- 🟡 **Extraction variance:** Same image, different preprocessing → different extraction
- 🟡 **Audit trail incomplete:** Can't reproduce preprocessing
- 🟡 **Version drift:** OCR library upgrade silently changes preprocessing

### Mitigation Architecture

**Explicit preprocessing config + versioning:**

```python
@dataclass
class OcrPreprocessingStep:
    """Single preprocessing step with full config."""
    
    operation: Literal[
        'deskew',
        'denoise',
        'contrast_boost',
        'thresholding',
        'resolution_upscale',
        'rotation_correction'
    ]
    
    # Configuration (for reproducibility)
    config: Dict[str, Any]  # algorithm-specific params
    
    # Versioning
    library: str  # "cv2:4.5.0" | "pillow:8.1.0"
    library_version: str
    
    # Execution
    duration_ms: int
    input_size: Tuple[int, int]  # Image dimensions
    output_size: Tuple[int, int]

@dataclass
class OcrPreprocessingAudit:
    """Complete preprocessing chain with audit trail."""
    
    preprocessing_steps: List[OcrPreprocessingStep]
    preprocessing_version: str  # "ocr_preprocessing:1.0"
    
    # Overall config hash (for reproducibility)
    config_hash: str
    
    @classmethod
    def compute_config_hash(cls, steps: List[OcrPreprocessingStep]) -> str:
        """Hash the preprocessing config (not results)."""
        config_dict = {
            'steps': [
                {
                    'operation': s.operation,
                    'config': s.config,
                    'library': s.library,
                    'library_version': s.library_version
                }
                for s in steps
            ]
        }
        return hashlib.sha256(
            json.dumps(config_dict, sort_keys=True, default=str).encode()
        ).hexdigest()
    
    def get_preprocessing_summary(self) -> str:
        """Human-readable preprocessing summary."""
        summary = []
        for step in self.preprocessing_steps:
            summary.append(
                f"{step.operation} ({step.library}:{step.library_version})"
            )
        return ' → '.join(summary)

@dataclass
class OcrAudit:
    """Updated with preprocessing audit."""
    
    engine: str
    engine_version: str
    preprocessing: OcrPreprocessingAudit  # NEW: full preprocessing trail
    raw_text: str
    confidence: float
    
    # Now fully reproducible
    @property
    def is_reproducible(self) -> bool:
        """Can we reproduce this OCR?"""
        return (
            self.engine and
            self.engine_version and
            self.preprocessing.config_hash is not None
        )
    
    def get_reproduction_instructions(self) -> str:
        """How to reproduce this OCR."""
        return f"""
To reproduce this OCR:
1. Load same PDF page image
2. Apply preprocessing: {self.preprocessing.get_preprocessing_summary()}
3. Use {self.engine}:{self.engine_version}
4. Preprocessing config hash: {self.preprocessing.config_hash}
"""
```

**Guarantee:**
- OCR preprocessing **FULLY DOCUMENTED**
- Preprocessing config **IMMUTABLE** (stored in audit)
- Same preprocessing config + same engine → reproducible results
- Preprocessing changes **VISIBLE IN AUDIT TRAIL**

---

## RISK 4: MIXED LANGUAGE OCR VARIANCE

### The Problem

```python
# Page with mixed Latin + Cyrillic
text = "API 5L: стальные трубы для нефтепровода"
#       ^^^^^^   Cyrillic text

# Different OCR engines handle mixed text differently
tesseract_cyrillic_model(text)  # Result 1
paddle_ocr_multimodel(text)     # Result 2

# Different results = different hash
```

### Why It Happens

1. **OCR language models separate:** Different training for each language
2. **Model selection ambiguous:** Which model to use for mixed text?
3. **Fallback behavior varies:** Different handling of unknown characters

### Impact

- 🟡 **Mixed-language document inconsistency:** Latin + Cyrillic → different results per engine
- 🟡 **Audit trail incomplete:** Which language models used?

### Mitigation Architecture

**Track language models explicitly:**

```python
@dataclass
class OcrLanguageModel:
    """Single OCR language model."""
    
    language: str  # "eng" | "rus" | "kaz"
    model_name: str
    model_version: str
    confidence: float  # Per-language confidence
    
    # Detection method
    detection_method: Literal['explicit', 'detected', 'fallback']
    
    # Stats
    detected_chars: int
    detected_lines: int

@dataclass
class OcrMultilingualAudit:
    """Audit trail for multilingual OCR."""
    
    language_models_used: List[OcrLanguageModel]
    
    # Mixed text handling
    mixed_language: bool
    mixed_language_confidence: float
    
    @property
    def languages_detected(self) -> List[str]:
        return [m.language for m in self.language_models_used]
    
    def get_language_summary(self) -> str:
        return ', '.join([
            f"{m.language}:{m.model_version}({m.confidence:.2%})"
            for m in self.language_models_used
        ])

@dataclass
class OcrAudit:
    """Updated with language model tracking."""
    
    engine: str
    engine_version: str
    language_models: OcrMultilingualAudit  # NEW: language tracking
    preprocessing: OcrPreprocessingAudit
    confidence: float
    raw_text: str
```

**Guarantee:**
- Language models **EXPLICITLY RECORDED**
- Mixed-language documents **FULLY AUDITABLE**
- Language model choice **DOCUMENTED IN AUDIT**

---

## RISK 5: DETERMINISM DEGRADATION OVER TIME

### The Problem

```python
# Initial OCR infrastructure
ocr_service = OcrService(engine='tesseract:5.2.0', preprocessing='v1.0')
extraction_1 = ocr_service.extract(pdf_page)

# 6 months later: library upgrades
ocr_service = OcrService(engine='tesseract:5.3.0', preprocessing='v1.1')
extraction_2 = ocr_service.extract(pdf_page)

# Different version = different extraction = breaking deduplication
```

### Why It Happens

1. **Silent library upgrades:** Dependencies updated without explicit coordination
2. **Preprocessing changes:** Default behavior changes in new versions
3. **No version pinning:** No explicit contract on "which version was used"

### Impact

- 🔴 **Version drift breaks deduplication:** Library upgrade silently breaks extraction identity
- 🔴 **Audit trail loses reproducibility:** Can't reproduce old extractions
- 🔴 **Compliance risk:** "Which OCR version was used?" → unknown

### Mitigation Architecture

**Explicit version pinning + upgrade workflow:**

```python
@dataclass
class OcrDependencyLock:
    """Locked OCR dependencies (immutable per extraction)."""
    
    tesseract_version: str  # e.g., "5.2.0"
    tesseract_data_version: str  # Language data version
    
    opencv_version: str  # For preprocessing
    pillow_version: str  # Image processing
    
    paddle_version: Optional[str]  # If using Paddle OCR
    paddle_models: Optional[Dict[str, str]]  # Model versions per language
    
    python_version: str
    
    lock_timestamp: datetime
    lock_hash: str
    
    @property
    def is_locked(self) -> bool:
        """Dependencies explicitly locked."""
        return self.lock_hash is not None
    
    def verify_runtime_consistency(self, runtime: Dict[str, str]) -> bool:
        """Verify runtime matches locked deps."""
        return (
            runtime.get('tesseract_version') == self.tesseract_version and
            runtime.get('opencv_version') == self.opencv_version
        )

@dataclass
class OcrVersionUpgradeProtocol:
    """Protocol for upgrading OCR versions."""
    
    current_lock: OcrDependencyLock
    
    # Upgrade decision
    @staticmethod
    def can_upgrade(old_lock: OcrDependencyLock, new_version: str) -> bool:
        """Can we safely upgrade OCR?"""
        # Semver rules
        old_major = old_lock.tesseract_version.split('.')[0]
        new_major = new_version.split('.')[0]
        
        if old_major != new_major:
            # Major version change = potential breaking changes
            # Requires re-extraction + testing
            return False
        
        # Minor/patch changes = safe
        return True
    
    def upgrade_workflow(self, new_version: str) -> Dict[str, Any]:
        """Upgrade OCR version."""
        return {
            'action': 'upgrade_minor_version',
            'old_version': self.current_lock.tesseract_version,
            'new_version': new_version,
            'required_actions': [
                'Update dependency lock',
                'Re-run test suite against new version',
                'Verify extraction hashes match (for minor) or accept new hashes (for major)',
                'Update audit trail with version change',
                'Document any behavior changes'
            ]
        }
```

**Guarantee:**
- OCR versions **EXPLICITLY LOCKED**
- Version upgrades **EXPLICIT DECISION** (not silent)
- Major version changes **REQUIRE RE-EXTRACTION**
- Minor version changes **VERIFIED COMPATIBLE** before rollout

---

## RISK MITIGATION CHECKLIST

### Before Week 2 Implementation

- [ ] `OcrAudit` class separates OCR output from deterministic payload
  - [ ] `ocr_audit` never included in `extraction_hash`
  - [ ] `canonical_text` deterministic + version-independent
  - [ ] Test: same OCR output → different versions → same hash

- [ ] `OcrConfidenceMetrics` + `OcrQualityGate` implemented
  - [ ] Low-confidence extractions flagged
  - [ ] `extraction_trustworthiness` computed
  - [ ] Manual review required for confidence < 0.85
  - [ ] Test: low-confidence extraction requires review

- [ ] `OcrPreprocessingAudit` documents preprocessing chain
  - [ ] Each preprocessing step versioned + config captured
  - [ ] Preprocessing config hash computed
  - [ ] Reproduction instructions generated
  - [ ] Test: preprocessing config captured in audit

- [ ] `OcrMultilingualAudit` tracks language models
  - [ ] Language models explicitly recorded
  - [ ] Mixed-language detection implemented
  - [ ] Language model versions captured
  - [ ] Test: Cyrillic + Latin → both models recorded

- [ ] `OcrDependencyLock` prevents silent version drift
  - [ ] Dependencies locked per extraction
  - [ ] Runtime consistency verified
  - [ ] Upgrade workflow explicit
  - [ ] Test: version mismatch detected

---

**Status:** 📋 OCR DETERMINISM RISKS ANALYZED & MITIGATED

**Next Step:** EXTRACTION_LINEAGE_ARCHITECTURE.md (formal lineage model)
