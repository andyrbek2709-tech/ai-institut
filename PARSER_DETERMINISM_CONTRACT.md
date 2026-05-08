# PARSER DETERMINISM CONTRACT

**Status:** 📋 FORMAL DETERMINISM GUARANTEES  
**Scope:** Parser behavior stability contract  
**Target:** Pre-implementation hardening gate (Week 2 kickoff)

---

## CONTRACT DEFINITION

**Parser Determinism Contract** = formal commitment that:

Given **identical input** (file bytes + configuration), parser produces **identical extraction** (content + structure + metadata) **regardless of runtime context**.

### Core Principle

```
Same input + Same parser version 
    → Same deterministic payload
    → Same extraction_hash
    → Zero variance across runs, restarts, machines
```

---

## GUARANTEE 1: Stable Ordering

**Commitment:** Content processing order is deterministic.

### What This Means
- Same input → sections always returned in same order
- No random shuffling, no dict iteration reliance
- All collections explicitly sorted (if sorted output required)
- Results sorted by (page_number, char_offset) if multipage

### Verification
```python
def test_stable_ordering():
    input_pdf = load_test_pdf("AGSK-1.pdf")
    
    # Run 1
    result_1 = parser.extract(input_pdf)
    sections_1 = [s.number for s in result_1.sections]
    
    # Run 2
    result_2 = parser.extract(input_pdf)
    sections_2 = [s.number for s in result_2.sections]
    
    # Identical ordering
    assert sections_1 == sections_2  # ✓ Same section numbers
    assert [s.char_offset for s in result_1.sections] == \
           [s.char_offset for s in result_2.sections]  # ✓ Same positions
```

### Exception
Explicit sorting requirement in output schema = ordering controlled by schema, not random

---

## GUARANTEE 2: Stable Normalization

**Commitment:** Text normalization is deterministic and idempotent.

### What This Means
- `normalize(X) = normalize(normalize(X))` (idempotent)
- Same normalization rules for all parser versions (with explicit version pinning)
- Normalization configuration immutable per parser version
- No context-dependent normalization

### Normalization Rules (Locked v1.0)

```python
class TextNormalizationV1_0:
    """Immutable normalization rules for parser v1.0+"""
    
    # Rule 1: Unicode normalization
    # Form: NFC (Composed form, not NFD or NFKC)
    # Rationale: Standard Python default, reversible, deterministic
    
    # Rule 2: Whitespace handling
    # - Consecutive spaces → single space (e.g., "a  b" → "a b")
    # - Trailing whitespace on line → removed
    # - Empty lines → collapsed to single \n (max 2 newlines)
    # - Tabs → converted to 4 spaces (consistent with source formatting)
    
    # Rule 3: Line endings
    # - All inputs converted to \n (unix style)
    # - CRLF (\r\n) → \n
    # - CR (\r) → \n
    
    # Rule 4: Control characters
    # - ASCII 0x00-0x08, 0x0B-0x0C, 0x0E-0x1F → removed
    # - Unicode Zs/Zl/Zp (separator spaces) → \n
    
    # Rule 5: Special cases (NO contextual logic)
    # - Hyphens: preserved as-is (no smart hyphenation)
    # - Dashes: preserved as-is (no em-dash conversion)
    # - Quotes: preserved as-is (no smart quote conversion)
    
    @staticmethod
    def normalize(text: str) -> str:
        """Idempotent normalization."""
        # Unicode NFC
        text = unicodedata.normalize('NFC', text)
        
        # Whitespace normalization
        lines = []
        for line in text.split('\n'):
            # Strip trailing whitespace
            line = line.rstrip()
            # Collapse consecutive spaces
            line = re.sub(r'  +', ' ', line)
            # Convert tabs to spaces
            line = line.replace('\t', '    ')
            lines.append(line)
        
        text = '\n'.join(lines)
        
        # Collapse excessive blank lines
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # Remove control characters
        text = ''.join(c for c in text if ord(c) >= 0x20 or c in '\n\t')
        
        # Final trim
        text = text.strip()
        
        return text
    
    @staticmethod
    def hash_normalized(text: str) -> str:
        """SHA256 of normalized text."""
        normalized = TextNormalizationV1_0.normalize(text)
        return hashlib.sha256(normalized.encode('utf-8')).hexdigest()
```

### Verification
```python
def test_stable_normalization():
    # Idempotence
    text = "hello    world\n\n\ntext"
    norm_1 = normalize(text)
    norm_2 = normalize(norm_1)
    assert norm_1 == norm_2  # ✓ Idempotent
    
    # Determinism
    assert hash(norm_1) == hash(norm_2)  # ✓ Same hash
```

### Version Pinning
- Normalization rules locked per parser version
- Major version change → normalization may change (re-extraction required)
- Minor version change → normalization guaranteed same

---

## GUARANTEE 3: Whitespace Policy

**Commitment:** Whitespace handling is explicit, not implicit.

### What This Means
- Every whitespace decision documented
- No "smart" contextual whitespace cleanup
- Whitespace policy versioned
- Breaking changes require version bump

### Whitespace Policy v1.0

```python
class WhitespacePolicyV1_0:
    """Explicit whitespace handling."""
    
    # Within-line whitespace
    CONSECUTIVE_SPACES = 'collapse'  # "a  b" → "a b"
    TABS = 'convert_to_4_spaces'    # "\t" → "    "
    TRAILING_SPACES = 'remove'       # "text  \n" → "text\n"
    LEADING_SPACES = 'preserve'      # Keep for indentation
    
    # Between-line whitespace
    EMPTY_LINES = 'collapse_to_single'  # "\n\n\n" → "\n\n"
    LINE_ENDINGS = 'normalize_to_lf'    # CRLF/CR → LF
    
    # Section boundaries
    BLANK_LINE_BEFORE_SECTION = 'preserve'
    BLANK_LINE_AFTER_SECTION = 'preserve'
    
    # Never modified
    SPACES_IN_CITATIONS = 'preserve'     # "page 42" stays "page 42"
    SPACES_IN_NUMBERS = 'preserve'       # "1 000 000" stays "1 000 000"
```

### Verification
```python
def test_whitespace_policy():
    # Consecutive spaces
    assert normalize("a  b  c") == "a b c"
    
    # Tabs
    assert normalize("\t\t") == "        "  # 8 spaces
    
    # Empty lines
    assert normalize("a\n\n\nb") == "a\n\nb"
    
    # Preserved: citations
    assert normalize("on page 42") == "on page 42"
```

---

## GUARANTEE 4: Encoding Normalization

**Commitment:** Text encoding is normalized consistently.

### What This Means
- All input: converted to UTF-8
- Unicode normalization form: NFC (not NFD, NFKC, etc.)
- Combining characters: handled consistently
- Locale-independent: no locale-based lowercasing

### Encoding Rules

```python
class EncodingNormalizationV1_0:
    """Encoding normalization."""
    
    # Input encoding detection
    # - PDF: UTF-8 extracted (preserve as-is)
    # - DOCX: encoded as specified in XML (convert to UTF-8)
    # - XLSX: encoded as specified in worksheet (convert to UTF-8)
    # - TXT: auto-detect with chardet, fall back to UTF-8
    # - HTML: charset from meta tag, fall back to UTF-8
    
    # Unicode normalization
    UNICODE_FORM = 'NFC'  # Composed form (standard)
    
    # Combining characters
    # Rationale: NFC combines combining characters into precomposed form
    # Example: 'é' (e + acute) → 'é' (single codepoint)
    
    # Case operations
    # Locale-independent (not using str.lower() with locale)
    # Use: casefold() for robust case-insensitive comparison
    
    # BOM handling
    # UTF-8 BOM (EF BB BF) removed if present
```

### Verification
```python
def test_encoding_normalization():
    # Unicode normalization
    é_combined = 'é'  # e + acute combining
    é_composed = 'é'        # precomposed e acute
    
    assert normalize(é_combined) == normalize(é_composed)
    assert hash(é_combined) == hash(é_composed)  # ✓ Same hash
    
    # BOM removal
    utf8_bom = '﻿text'
    assert normalize(utf8_bom).startswith('text')  # BOM removed
```

---

## GUARANTEE 5: OCR Preprocessing (If Applicable)

**Commitment:** OCR preprocessing is deterministic and logged.

### What This Means
- Preprocessing steps explicitly listed
- Preprocessing configuration versioned
- Same preprocessing config + same OCR engine → same OCR output
- OCR output logged but NOT included in deterministic_hash

### OCR Preprocessing Contract

```python
class OcrPreprocessingContractV1_0:
    """OCR preprocessing determinism."""
    
    # Preprocessing pipeline
    STEPS = [
        'image_load',           # Load from PDF/file
        'orientation_detect',   # Detect rotation
        'rotation_correct',     # Correct if needed
        'resolution_check',     # Log DPI
        'denoise',             # Remove noise (optional)
        'contrast_boost',      # Enhance contrast (optional)
        'thresholding',        # Convert to BW (Otsu's method)
        'ocr_extract'          # Run OCR engine
    ]
    
    # Configuration version pinned
    PREPROCESSING_VERSION = "1.0"
    
    # Configuration parameters
    DENOISE_ENABLED = False
    DENOISE_STRENGTH = 1.0
    CONTRAST_ENABLED = True
    CONTRAST_FACTOR = 1.2
    THRESHOLD_METHOD = 'otsu'  # Not manual threshold
    
    # Reproducibility
    # Same config → same preprocessing output (given same image)
    # Same preprocessing → same OCR input
    # Same OCR input + same engine version → same OCR output
```

### Verification
```python
def test_ocr_preprocessing_determinism():
    image = load_pdf_page("AGSK-1.pdf", page_number=42)
    
    # Run 1
    ocr_1 = run_ocr_with_preprocessing(image, config="v1.0")
    
    # Run 2
    ocr_2 = run_ocr_with_preprocessing(image, config="v1.0")
    
    # Same preprocessing → same OCR output
    assert ocr_1['text'] == ocr_2['text']  # ✓ Identical
    assert ocr_1['confidence'] == ocr_2['confidence']  # ✓ Identical confidence
```

---

## GUARANTEE 6: Serialization

**Commitment:** Serialization to JSON/YAML is deterministic.

### What This Means
- JSON keys sorted alphabetically
- JSON values use consistent representation
- Floats: fixed precision (not scientific notation)
- Dates: ISO 8601 format
- None/null: explicit handling
- No implicit serialization order

### Serialization Rules

```python
class SerializationContractV1_0:
    """Deterministic serialization."""
    
    FORMAT = 'JSON'
    
    # Keys: alphabetically sorted
    KEY_ORDER = 'alphabetical'
    
    # Floats: 6 decimal places (fixed, not exponential)
    FLOAT_PRECISION = 6
    FLOAT_FORMAT = 'fixed'  # Not 'scientific'
    
    # Dates: ISO 8601
    DATE_FORMAT = 'iso8601'  # "2026-05-09T16:00:00Z"
    
    # Null: explicit "null" (not omitted, not empty)
    NULL_REPRESENTATION = 'null'
    
    # Collections: always ordered
    DICT_ORDER = 'key_sorted'
    LIST_ORDER = 'preserved'  # Original order

def serialize_deterministic(obj: Any) -> str:
    """Deterministic JSON serialization."""
    return json.dumps(
        obj,
        sort_keys=True,        # Keys alphabetical
        separators=(',', ':'), # Compact
        indent=None,           # Single line (but sorted)
        default=_serialize_custom
    )

def _serialize_custom(obj: Any) -> Any:
    """Handle custom types."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, float):
        return round(obj, 6)
    elif isinstance(obj, Enum):
        return obj.value
    return str(obj)
```

### Verification
```python
def test_serialization_determinism():
    data = {
        'z_field': 1,
        'a_field': 2,
        'float_value': 3.14159265
    }
    
    # Run 1
    json_1 = serialize_deterministic(data)
    
    # Run 2
    json_2 = serialize_deterministic(data)
    
    assert json_1 == json_2  # ✓ Identical JSON
    assert '"a_field"' in json_1.split('"z_field"')[0]  # ✓ Keys sorted
    assert '3.141593' in json_1  # ✓ Float precision
```

---

## GUARANTEE 7: No Runtime State Leakage

**Commitment:** Runtime state NEVER affects extraction_hash.

### What This Means
- Runtime state = execution context (NOT content/structure)
- Runtime state examples: execution_time, memory_usage, parser_version, timestamp, machine_id
- extraction_hash = function of (content + structure + metadata) only
- Same content → same extraction_hash (regardless of runtime)

### Protected Hash Computation

```python
class ExtractionHashV1_0:
    """Deterministic extraction hash (runtime-independent)."""
    
    # Components (INCLUDED in hash)
    INCLUDE = {
        'content_normalized': 'Normalized text content',
        'sections': 'Section structure + numbering',
        'metadata': 'Extracted metadata (canonical form)',
    }
    
    # Components (EXCLUDED from hash)
    EXCLUDE = {
        'execution_time_ms': 'Varies per run',
        'memory_peak_mb': 'System-dependent',
        'parser_version': 'Logged separately, not in hash',
        'extraction_timestamp': 'Temporal, not content',
        'process_id': 'Machine-dependent',
        'machine_hostname': 'Deployment-dependent',
        'ocr_raw_output': 'OCR version-dependent',
        'ocr_confidence': 'Engine-dependent',
    }

def compute_extraction_hash(
    content_normalized: str,
    sections: List[Section],
    metadata: Dict[str, Any]
) -> str:
    """Compute extraction_hash (runtime-independent)."""
    
    payload = {
        'content': content_normalized,
        'sections': [s.to_dict() for s in sections],
        'metadata': metadata
    }
    
    # Never include: timestamp, execution_time, memory, parser_version, etc.
    
    payload_json = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(payload_json.encode()).hexdigest()
```

### Verification
```python
def test_no_runtime_leakage():
    input_pdf = load_test_pdf("AGSK-1.pdf")
    
    # Run 1: normal
    result_1 = parser.extract(input_pdf)
    hash_1 = result_1.deterministic_payload.extraction_hash
    
    # Run 2: same input, different runtime (different time, different machine, etc.)
    result_2 = parser.extract(input_pdf)
    hash_2 = result_2.deterministic_payload.extraction_hash
    
    # Same hash despite different runtime
    assert hash_1 == hash_2  # ✓ Runtime doesn't affect hash
    assert result_1.runtime_metadata.extraction_timestamp != \
           result_2.runtime_metadata.extraction_timestamp  # ✓ Times different
```

---

## GUARANTEE 8: Reproducibility Across Restarts

**Commitment:** Extraction survives process restart with identity preserved.

### What This Means
- Extraction stored with deterministic_hash
- On reload: recompute deterministic_hash from stored data
- Recomputed hash == original hash (identity preserved)
- No temporal dependencies (timestamps logged separately, never hashed)

### Restart-Safe Storage

```python
@dataclass
class StoredExtraction:
    """Extraction stored with reproducible identity."""
    
    # Deterministic payload (used for hashing)
    content_normalized: str
    sections: List[Section]
    metadata: Dict[str, Any]
    
    # Stored hash (for verification)
    stored_extraction_hash: str
    
    # Runtime metadata (not part of hash)
    extraction_timestamp: datetime
    parser_version: str
    
    def verify_identity_after_reload(self) -> bool:
        """Verify extraction identity survived storage/reload."""
        recomputed_hash = compute_extraction_hash(
            self.content_normalized,
            self.sections,
            self.metadata
        )
        return recomputed_hash == self.stored_extraction_hash
```

### Verification
```python
def test_restart_reproducibility():
    extraction = extract_document("AGSK-1.pdf")
    hash_original = extraction.deterministic_payload.extraction_hash
    
    # Store to database
    db.save_extraction(extraction)
    
    # Simulate restart: reload from database
    extraction_reloaded = db.load_extraction(extraction.id)
    hash_reloaded = extraction_reloaded.verify_identity_after_reload()
    
    # Identity preserved across restart
    assert hash_reloaded == hash_original  # ✓ Same identity
```

---

## GUARANTEE 9: Version Pinning

**Commitment:** Parser version pinning prevents silent behavior changes.

### What This Means
- Parser version explicitly stored per extraction
- Behavior changes documented in CHANGELOG
- Extraction lineage includes parser_version
- Same parser version guaranteed same behavior
- Version upgrade = explicit decision + re-extraction if needed

### Version Pinning Rules

```python
class VersionPinningV1_0:
    """Parser version pinning."""
    
    CURRENT_VERSION = "2.1"
    COMPATIBILITY = {
        '2.x': 'Same normalization + whitespace rules',
        '3.x': 'May have breaking changes (re-extraction required)',
    }
    
    BEHAVIOR_GUARANTEES = {
        '2.0': {'normalization': 'v1.0', 'whitespace': 'v1.0', 'encoding': 'v1.0'},
        '2.1': {'normalization': 'v1.0', 'whitespace': 'v1.0', 'encoding': 'v1.0'},
        # Future: 3.0 may change these guarantees (documented in CHANGELOG)
    }

def extract_with_version_pinning(
    document: bytes,
    parser_version: str = None
) -> Extraction:
    """Extract with explicit version pinning."""
    
    version = parser_version or PARSER_CURRENT_VERSION
    
    # Load version-specific behavior
    behavior = BEHAVIOR_GUARANTEES.get(version)
    if not behavior:
        raise ValueError(f"Unsupported parser version: {version}")
    
    # Extract using version-specific rules
    extraction = extract_internal(document, behavior)
    
    # Store version
    extraction.runtime_metadata.parser_version = version
    
    return extraction
```

---

## GUARANTEE 10: Audit Trail Immutability

**Commitment:** Extraction lineage cannot be modified after recording.

### What This Means
- Lineage points append-only (no retroactive modification)
- Hash includes full audit trail (hash change = breaking trail)
- Hash changes detected (lineage integrity verified)
- Regulatory audit trail permanent

### Immutable Lineage

```python
class ImmutableLineageV1_0:
    """Append-only extraction lineage."""
    
    # Lineage points: append-only
    # Once added: never modified
    
    # Hash includes: full audit trail
    # Hash change = breaking audit trail (detected)
    
    def add_point(self, point: LineagePoint) -> None:
        """Add immutable point."""
        if self._completed:
            raise ValueError("Cannot add points to completed extraction")
        self.points.append(point)
        self._recompute_hash()
    
    def verify_integrity(self) -> bool:
        """Verify audit trail hasn't been tampered."""
        previous_hash = self.audit_trail_hash
        self._recompute_hash()
        return self.audit_trail_hash == previous_hash
```

---

## CONTRACT COMPLIANCE AUDIT

### Pre-Implementation Checklist

- [ ] **Guarantee 1:** Stable ordering implemented + tested
  - [ ] `test_stable_ordering()` passes
  - [ ] Results sorted explicitly by (page, char_offset)

- [ ] **Guarantee 2:** Stable normalization implemented + tested
  - [ ] `TextNormalizationV1_0` immutable class created
  - [ ] `test_stable_normalization()` passes (idempotence)
  - [ ] Normalization rules versioned (locked v1.0)

- [ ] **Guarantee 3:** Whitespace policy documented + tested
  - [ ] `WhitespacePolicyV1_0` class created
  - [ ] `test_whitespace_policy()` passes
  - [ ] Policy versioned (locked v1.0)

- [ ] **Guarantee 4:** Encoding normalization implemented + tested
  - [ ] `EncodingNormalizationV1_0` class created
  - [ ] `test_encoding_normalization()` passes
  - [ ] Unicode NFC normalization locked

- [ ] **Guarantee 5:** OCR preprocessing logged (if applicable) + tested
  - [ ] `OcrPreprocessingContractV1_0` class created
  - [ ] `test_ocr_preprocessing_determinism()` passes
  - [ ] OCR output logged, NOT in deterministic_hash

- [ ] **Guarantee 6:** Deterministic serialization implemented + tested
  - [ ] `SerializationContractV1_0` class created
  - [ ] `serialize_deterministic()` function locks key order + precision
  - [ ] `test_serialization_determinism()` passes

- [ ] **Guarantee 7:** Runtime state excluded from extraction_hash + tested
  - [ ] `ExtractionHashV1_0.EXCLUDE` list explicit
  - [ ] `test_no_runtime_leakage()` passes
  - [ ] Same content → same hash (regardless of runtime)

- [ ] **Guarantee 8:** Restart-safe storage + tested
  - [ ] `StoredExtraction` class implements `verify_identity_after_reload()`
  - [ ] `test_restart_reproducibility()` passes
  - [ ] Identity survives store → reload cycle

- [ ] **Guarantee 9:** Version pinning implemented + documented
  - [ ] `VersionPinningV1_0` class created
  - [ ] `BEHAVIOR_GUARANTEES` dictionary locked
  - [ ] Extraction stores `parser_version`
  - [ ] CHANGELOG documents breaking changes

- [ ] **Guarantee 10:** Immutable lineage implemented + tested
  - [ ] `LineagePoint` append-only (no modification)
  - [ ] `audit_trail_hash` detects tampering
  - [ ] `verify_integrity()` method implemented

---

## REGULATORY SIGN-OFF

**Contract reviewed by:** [TBD]  
**Contract approved by:** [TBD]  
**Effective date:** 2026-05-13 (Week 2 parser implementation start)  
**Expiration:** N/A (immutable contract)

---

**STATUS:** ✅ PARSER DETERMINISM CONTRACT FORMALIZED

**Next Step:** Implementation Week 2 (parser + OCR audit model)
