# PARSER ARCHITECTURE HARDENING REPORT

**Status:** 🔧 HARDENING REVIEW IN PROGRESS  
**Started:** 2026-05-08  
**Target:** Eliminate hidden nondeterminism + lineage fragility + audit gaps before Week 2 parser implementation  
**Current Phase:** Stages 1-8 (deterministic foundation → extraction lineage → final review)

---

## EXECUTIVE SUMMARY

Parser will become **regulatory extraction foundation** for:
- Regulatory document analysis
- AI-assisted formula extraction  
- Template generation
- Auditability & compliance

**RISK:** Current design lacks:
- ✗ Deterministic payload separation (runtime metadata leaks into extraction)
- ✗ OCR audit trail (OCR treated as deterministic, should be confidence-aware)
- ✗ Logical chunk model (artificial page lineage for non-PDF formats)
- ✗ Extensible section grammar (regex-only, Cyrillic + mixed patterns inadequate)
- ✗ Formal extraction lineage (no provenance tracking)

**RESULT AFTER HARDENING:**
- ✅ Deterministic payload model (extraction_hash immune to runtime state)
- ✅ OCR audit model (confidence + engine version + preprocessing)
- ✅ Logical chunk lineage (no artificial page approximations)
- ✅ Extensible section grammar (GOST, CIS, Kazakh, mixed patterns)
- ✅ Extraction lineage formalization (source → parser → normalization → correction → review)
- ✅ Determinism contract (explicit stability guarantees)

---

## STAGE 1: DETERMINISTIC PAYLOAD SEPARATION

### Current State

**Problem:** `ParsedDocument` mixes deterministic + runtime metadata:

```python
@dataclass
class ParsedDocument:
    content: str                          # Deterministic ✅
    extracted_metadata: Dict[str, Any]   # Deterministic ✅
    
    # Runtime metadata polluting extraction_hash ✗
    parser_runtime_state: Dict             # execution_time_ms, memory_used, etc.
    ingestion_timestamp: datetime          # Non-deterministic
    page_count: int                        # Computed at runtime
    processing_duration_ms: int            # System-dependent
    
    # Derived from above (corrupted by runtime)
    extraction_hash: str  # ← DEPENDS ON RUNTIME STATE
```

**Impact:**
- Same document parsed twice → different hashes
- Hash used as extraction identity → no deduplication
- Lineage breaks across process restarts
- Audit trail becomes unreliable

### Hardened Design

**New structure separates concerns:**

```python
@dataclass
class DeterministicPayload:
    """Pure extraction result — immune to runtime state."""
    content: str
    sections: List[Section]
    metadata: ExtractedMetadata
    
    # Deterministic identifiers
    binary_identity_hash: str    # SHA256(file_bytes) — file identity
    content_normalization_hash: str  # normalized content + whitespace contract
    structure_hash: str          # sections + headings + chunks
    
    @property
    def deterministic_hash(self) -> str:
        """Combined signature for deduplication & lineage."""
        return hashlib.sha256(
            json.dumps({
                'content_norm': self.content_normalization_hash,
                'structure': self.structure_hash,
                'metadata': self.metadata.to_canonical_dict()
            }, sort_keys=True, default=str).encode()
        ).hexdigest()

@dataclass
class RuntimeMetadata:
    """Runtime context — never included in extraction_hash."""
    parser_version: str
    extraction_timestamp: datetime
    extraction_duration_ms: int
    memory_peak_mb: int
    parser_runtime_state: Dict  # execution details
    
    # Source context (deterministic per source file)
    source_document_id: str      # stable reference
    source_format: Literal['pdf', 'docx', 'txt', 'xlsx', 'html']
    source_file_size_bytes: int
    source_encoding: str

@dataclass
class ParsedDocument:
    """Top-level container separating deterministic + runtime."""
    deterministic_payload: DeterministicPayload
    runtime_metadata: RuntimeMetadata
```

**Guarantees:**
- `DeterministicPayload.deterministic_hash` = **NEVER depends on** parser version, extraction time, memory usage, execution time
- Same payload → same hash (across restarts, reruns, different machines)
- Hash stable for: content normalization, structure (sections, headings), metadata
- Hash unstable for: runtime state, timestamps, versions

---

## STAGE 2: OCR DETERMINISM REVIEW

### Current Misclassification

**Problem:** OCR currently treated as deterministic extraction:

```python
# WRONG ✗
ocr_output = perform_ocr(page_image)
content = ocr_output  # Treated as reliable extraction
extraction_hash = hash(content)  # Hash depends on OCR engine + version
```

**Reality:**
- OCR is **assisted extraction**, not extraction truth
- OCR quality depends on: engine version, confidence thresholds, preprocessing
- Different OCR engine versions → different content → different hashes

### Hardened Design

**New model treats OCR as confidence-aware layer:**

```python
@dataclass
class OcrResult:
    """Raw OCR output with full audit trail."""
    raw_text: str
    ocr_engine: str              # e.g., "tesseract:5.2.0", "paddle:2.4.0"
    engine_version: str
    confidence: float            # 0.0-1.0, global page confidence
    
    # Preprocessing config (affects reproducibility)
    preprocessing_steps: List[str]  # ["deskew", "contrast_boost", "denoise"]
    preprocessing_config: Dict
    
    # Per-line confidence (if available)
    line_confidences: List[float]
    
    # Preprocessing artifacts
    preprocessing_duration_ms: int

@dataclass
class ExtractionAuditPoint:
    """Extraction lineage checkpoint."""
    extraction_method: str    # "direct_text" | "ocr:tesseract" | "ocr:paddle"
    ocr_result: Optional[OcrResult]  # None if direct text extraction
    confidence: float         # 0.0-1.0, aggregated from OCR or 1.0 for direct
    
    # Correction chain (if applicable)
    corrections_applied: List[str]
    correction_confidence: float
    
    # Review chain
    review_flags: List[str]
    reviewer_notes: Optional[str]

@dataclass
class PageExtraction:
    """Per-page extraction with audit trail."""
    page_number: int
    raw_text: str
    ocr_audit: Optional[ExtractionAuditPoint]
    
    # Deterministic payload (unaffected by OCR confidence)
    canonical_text: str  # After normalization, independent of OCR version
    
    @property
    def is_ocr_extracted(self) -> bool:
        return self.ocr_audit is not None
    
    @property
    def extraction_confidence(self) -> float:
        return self.ocr_audit.confidence if self.is_ocr_extracted else 1.0
```

**Guarantees:**
- OCR output **LOGGED** but **NOT HASHED**
- OCR confidence **TRACKED** but **NOT HIDDEN**
- Same document + different OCR engine → different `ocr_audit` but **SAME canonical_text** (normalized)
- Deterministic payload **INDEPENDENT** of OCR engine version
- Audit trail **COMPLETE**: which OCR used, confidence, preprocessing steps

---

## STAGE 3: PAGE MODEL REFACTORING

### Current Problem

**Issue:** Treating non-PDF formats as "page-based" is fake:

```python
# WRONG ✗
for page in parsed_docx_document.pages:  # DOCX has no "pages"
    for line in page.lines:
        ...

# Result: artificial page boundaries that don't exist in source
# Citation becomes: "page 42" for a DOCX that was 1 continuous document
```

**Impact:**
- Non-PDF formats get artificial page lineage
- Citation system breaks ("DOCX page 42" is meaningless)
- No distinction between format-native and simulated boundaries
- Lineage falsely claims "pages exist"

### Hardened Design

**New model uses logical chunks instead:**

```python
@dataclass
class ChunkReference:
    """Format-agnostic reference to content location."""
    # Universal reference (works for all formats)
    chunk_type: Literal['section', 'paragraph', 'cell', 'block', 'page']
    
    # Format-specific references
    format_native_ref: Optional[str]  # Format-native path
    # Examples:
    # - PDF: "page:42"
    # - DOCX: "paragraph:7:section:2:subsection:3"
    # - XLSX: "sheet:Data:row:15:column:C"
    # - TXT: "line:234"
    # - HTML: "element:div#content:p:5"
    
    section_hierarchy: List[str]  # Universal hierarchy
    # Examples:
    # - ['Section 2', 'Subsection 2.3', 'Paragraph 2.3.4']
    # - ['Appendix A', 'Table 1', 'Row 5']
    
    # Byte offset (for format-agnostic verification)
    byte_offset_start: int
    byte_offset_end: int
    
    @property
    def citation_reference(self) -> str:
        """Human-readable citation."""
        if self.format_native_ref:
            return self.format_native_ref
        return ' → '.join(self.section_hierarchy)

@dataclass
class LogicalChunk:
    """Format-agnostic content chunk."""
    content: str
    
    # What kind of chunk is this?
    chunk_type: Literal['section', 'paragraph', 'list_item', 'table', 'code_block']
    
    # Where is it from? (format-agnostic reference)
    source_reference: ChunkReference
    
    # What format was source?
    source_format: Literal['pdf', 'docx', 'txt', 'xlsx', 'html']
    
    # Is this reference artificial or native to format?
    @property
    def reference_is_native(self) -> bool:
        """True if format supports this reference type."""
        native_refs = {
            'pdf': ['page', 'section'],
            'docx': ['paragraph', 'section'],
            'xlsx': ['cell', 'row', 'column', 'sheet'],
            'txt': ['line', 'paragraph'],
            'html': ['element', 'section']
        }
        return self.source_reference.chunk_type in native_refs.get(self.source_format, [])
    
    @property
    def reference_is_simulated(self) -> bool:
        """True if reference is artificially computed."""
        return not self.reference_is_native

@dataclass
class DocumentModel:
    """Unified document model for all formats."""
    format: Literal['pdf', 'docx', 'txt', 'xlsx', 'html']
    
    # Logical chunks (format-agnostic)
    chunks: List[LogicalChunk]
    
    # Format-specific metadata
    format_metadata: Dict[str, Any]
    # Example for XLSX: {'sheet_count': 3, 'sheets': ['Data', 'Metadata', 'Config']}
    # Example for DOCX: {'section_count': 2, 'page_count_reported': 15}
    
    def get_citations_for_chunk(self, chunk: LogicalChunk) -> List[str]:
        """Get all valid citation formats for a chunk."""
        citations = []
        if chunk.reference_is_native:
            citations.append(chunk.source_reference.citation_reference)
        if chunk.source_format == 'pdf':
            # PDF can cite both page + section
            citations.append(f"PDF:{chunk.source_reference.format_native_ref}")
        return citations
```

**Guarantees:**
- DOCX documents **NO LONGER GET fake page references**
- TXT documents cite by **line or paragraph**, not artificial pages
- XLSX cells cite by **sheet:row:column**, not artificial page
- All citations include **native vs. simulated** flag
- Lineage is **honest** about source format constraints

---

## STAGE 4: SECTION GRAMMAR HARDENING

### Current Limitation

**Problem:** Single regex pattern inadequate:

```python
HEADING_REGEX = r'^\s*((?:\d+\.?)*)\s+([A-ZА-Я].*?)(?:\s*$|\s{2,})'
# Fails for:
# - Приложение А (Cyrillic letter + space)
# - ANNEX B / Appendix B (Latin letter)
# - Раздел I (Roman numerals)
# - Nested GOST standards (ГОСТ 20295-85)
# - Mixed: "ПП 3.2.1.5" (Cyrillic prefix + digits)
```

### Hardened Design

**Extensible grammar architecture:**

```python
from enum import Enum
from dataclasses import dataclass

class SectionNumberingStyle(Enum):
    """Supported numbering schemes."""
    DECIMAL = "1.2.3"           # API 5L, ASME B31.x
    CYRILLIC_DECIMAL = "1. 2. 3"  # ГОСТ Р
    ROMAN = "I.II.III"          # Some standards
    CYRILLIC_LETTER = "А Б В"   # Appendices
    LATIN_LETTER = "A B C"      # Appendices
    MIXED = "2.3.В.4"           # Complex standards

class SectionKeyword(Enum):
    """Section heading keywords (multilingual)."""
    # Latin
    SECTION = "Section"
    SUBSECTION = "Subsection"
    ARTICLE = "Article"
    ANNEX = "Annex"
    APPENDIX = "Appendix"
    CHAPTER = "Chapter"
    
    # Cyrillic
    РАЗДЕЛ = "Раздел"
    ПОДРАЗДЕЛ = "Подраздел"
    ОТДЕЛ = "Отдел"
    ЧАСТЬ = "Часть"
    ГЛАВА = "Глава"
    СТАТЬЯ = "Статья"
    ПРИЛОЖЕНИЕ = "Приложение"
    ПУНКТ = "Пункт"
    ПОДПУНКТ = "Подпункт"
    ПРИМЕЧАНИЕ = "Примечание"
    
    # CIS Standards
    ГОСТ = "ГОСТ"
    ГОСТ_Р = "ГОСТ Р"
    СТ_РК = "СТ РК"
    СП = "СП"
    СНиП = "СНиП"
    РД = "РД"
    ВРД = "ВРД"
    ТУ = "ТУ"

@dataclass
class SectionPattern:
    """Grammar rule for section detection."""
    name: str
    regex: str
    numbering_style: SectionNumberingStyle
    keywords: List[SectionKeyword]
    
    # Confidence scoring
    confidence_base: float  # 0.0-1.0
    context_boost: float   # Additional confidence if context matches
    
    # Nesting rules
    supports_nesting: bool
    max_nesting_depth: int
    
    def match(self, line: str) -> Optional[Dict[str, Any]]:
        """Try to match line against this pattern."""
        m = re.match(self.regex, line)
        if m:
            return {
                'numbering': m.group(1),
                'title': m.group(2),
                'pattern': self.name,
                'confidence': self.confidence_base
            }
        return None

class SectionGrammarRegistry:
    """Extensible section grammar registry."""
    
    def __init__(self):
        self.patterns: List[SectionPattern] = []
        self._register_builtin_patterns()
    
    def _register_builtin_patterns(self):
        """Register all standard patterns."""
        
        # API / ASME decimal numbering
        self.register(SectionPattern(
            name='decimal_numbered',
            regex=r'^((?:\d+\.)*\d+)\s+([A-Z][^~]*?)$',
            numbering_style=SectionNumberingStyle.DECIMAL,
            keywords=[SectionKeyword.SECTION, SectionKeyword.SUBSECTION],
            confidence_base=0.85,
            context_boost=0.05,
            supports_nesting=True,
            max_nesting_depth=6
        ))
        
        # ГОСТ decimal numbering (Cyrillic context)
        self.register(SectionPattern(
            name='gost_decimal',
            regex=r'^((?:\d+\.)*\d+)\s+([А-ЯЁ][^~]*?)$',
            numbering_style=SectionNumberingStyle.CYRILLIC_DECIMAL,
            keywords=[SectionKeyword.РАЗДЕЛ, SectionKeyword.ПУНКТ],
            confidence_base=0.85,
            context_boost=0.05,
            supports_nesting=True,
            max_nesting_depth=6
        ))
        
        # Appendices (Latin letter + space/word)
        self.register(SectionPattern(
            name='appendix_latin',
            regex=r'^(?:ANNEX|Annex|Appendix|APPENDIX)\s+([A-Z])\s+([A-Z][^~]*?)$',
            numbering_style=SectionNumberingStyle.LATIN_LETTER,
            keywords=[SectionKeyword.ANNEX, SectionKeyword.APPENDIX],
            confidence_base=0.90,
            context_boost=0.0,
            supports_nesting=True,
            max_nesting_depth=3
        ))
        
        # Appendices (Cyrillic letter + space/word)
        self.register(SectionPattern(
            name='appendix_cyrillic',
            regex=r'^(?:Приложение|ПРИЛОЖЕНИЕ)\s+([А-ЯЁ])\s+([А-ЯЁ][^~]*?)$',
            numbering_style=SectionNumberingStyle.CYRILLIC_LETTER,
            keywords=[SectionKeyword.ПРИЛОЖЕНИЕ],
            confidence_base=0.90,
            context_boost=0.0,
            supports_nesting=True,
            max_nesting_depth=3
        ))
        
        # Roman numerals (sometimes used in standards)
        self.register(SectionPattern(
            name='roman_numbered',
            regex=r'^([IVXLC]+)\s+([A-Z][^~]*?)$',
            numbering_style=SectionNumberingStyle.ROMAN,
            keywords=[SectionKeyword.SECTION, SectionKeyword.CHAPTER],
            confidence_base=0.75,  # Lower confidence (ambiguous with text)
            context_boost=0.10,
            supports_nesting=True,
            max_nesting_depth=4
        ))
        
        # Mixed: Cyrillic prefix + decimal (ПП 3.2.1)
        self.register(SectionPattern(
            name='mixed_prefix_decimal',
            regex=r'^((?:[А-ЯЁ]+)\s+(?:\d+\.)*\d+)\s+([А-ЯЁ][^~]*?)$',
            numbering_style=SectionNumberingStyle.MIXED,
            keywords=[SectionKeyword.РАЗДЕЛ, SectionKeyword.ПУНКТ],
            confidence_base=0.80,
            context_boost=0.05,
            supports_nesting=True,
            max_nesting_depth=6
        ))
        
        # Keyword-only (no numbering)
        for keyword in [SectionKeyword.РАЗДЕЛ, SectionKeyword.SECTION]:
            self.register(SectionPattern(
                name=f'keyword_{keyword.value.lower()}',
                regex=rf'^(?:{keyword.value})\s+([A-ZА-Я][^~]*?)$',
                numbering_style=SectionNumberingStyle.DECIMAL,
                keywords=[keyword],
                confidence_base=0.70,
                context_boost=0.10,
                supports_nesting=True,
                max_nesting_depth=6
            ))
    
    def register(self, pattern: SectionPattern):
        """Register custom pattern."""
        self.patterns.append(pattern)
    
    def detect_sections(self, text: str) -> List[Dict[str, Any]]:
        """Detect sections using all patterns."""
        sections = []
        for line in text.split('\n'):
            for pattern in self.patterns:
                match = pattern.match(line.strip())
                if match:
                    sections.append(match)
                    break  # First match wins
        return sections
```

**Guarantees:**
- ГОСТ + СТ РК + API + ASME + Latin + Cyrillic **ALL SUPPORTED**
- **Extensible** — new patterns can be added without code recompilation
- **Confidence scoring** — patterns ranked by reliability
- **Nesting aware** — properly handles nested structures
- **Mixed numbering** — supports "ПП 3.2.1.5" style prefixes

---

## STAGE 5: HASH MODEL EXPANSION

### Current Problem

```python
# Single hash conflates different concerns
extraction_hash = hash(content + metadata)
# Problem: Can't distinguish between:
# - File identity (same physical file?)
# - Content identity (same normalized content?)
# - Structure identity (same sections/headings?)
```

### Hardened Design

```python
@dataclass
class ExtractionHashes:
    """Multi-layer hash model."""
    
    # Level 1: BINARY IDENTITY
    # Q: Is this the same file I saw before?
    binary_identity_hash: str
    # Computed: SHA256(file_bytes)
    # Immutable: never changes for same file
    # Use case: Deduplication at ingestion
    
    # Level 2: NORMALIZED CONTENT IDENTITY  
    # Q: Is the extracted text semantically the same?
    content_normalization_hash: str
    # Computed: SHA256(normalize(text))
    # Normalization includes:
    # - Whitespace normalization
    # - Unicode normalization (NFC)
    # - Case normalization (optional)
    # - Accent normalization (optional)
    # Immutable: depends only on content rules
    # Use case: Detect content changes despite parsing differences
    
    # Level 3: STRUCTURE IDENTITY
    # Q: Does the document have the same logical structure?
    structure_hash: str
    # Computed: SHA256(sections + headings + chunk_boundaries)
    # Includes:
    # - Section count & numbering
    # - Heading hierarchy
    # - Logical chunk boundaries
    # - NOT: content text, just structure
    # Immutable: depends on structure detection quality
    # Use case: Detect heading/section regressions
    
    # Level 4: EXTRACTION IDENTITY
    # Q: Is the extraction result identical?
    extraction_identity_hash: str
    # Computed: SHA256(content_norm + structure + metadata_canonical)
    # Combined signature for: "is this the same extraction I've seen?"
    # Use case: Lineage deduplication
    
    # Level 5: COMPREHENSIVE AUDIT HASH
    # Q: Can I audit this extraction completely?
    audit_hash: str
    # Computed: SHA256(extraction_identity + extraction_audit_trail)
    # Includes:
    # - Binary identity
    # - Content hashes
    # - OCR audit (if applicable)
    # - Corrections applied
    # - Review flags
    # Immutable: captures complete audit history
    # Use case: Compliance + legal audit trail
    
    @classmethod
    def compute_all(cls, 
                    file_bytes: bytes,
                    content: str,
                    sections: List[Section],
                    metadata: ExtractedMetadata,
                    audit_trail: ExtractionAuditTrail) -> 'ExtractionHashes':
        """Compute all hash levels."""
        return cls(
            binary_identity_hash=hashlib.sha256(file_bytes).hexdigest(),
            
            content_normalization_hash=hashlib.sha256(
                cls._normalize_content(content).encode()
            ).hexdigest(),
            
            structure_hash=hashlib.sha256(
                json.dumps({
                    'section_count': len(sections),
                    'section_nums': [s.number for s in sections],
                    'chunk_boundaries': [s.char_offset for s in sections]
                }, sort_keys=True).encode()
            ).hexdigest(),
            
            extraction_identity_hash=hashlib.sha256(
                json.dumps({
                    'content_norm': cls._normalize_content(content),
                    'structure': [s.to_dict() for s in sections],
                    'metadata': metadata.to_canonical_dict()
                }, sort_keys=True, default=str).encode()
            ).hexdigest(),
            
            audit_hash=hashlib.sha256(
                json.dumps({
                    'binary': hashlib.sha256(file_bytes).hexdigest(),
                    'content': cls._normalize_content(content),
                    'sections': [s.to_dict() for s in sections],
                    'metadata': metadata.to_canonical_dict(),
                    'audit': audit_trail.to_dict()
                }, sort_keys=True, default=str).encode()
            ).hexdigest()
        )
    
    @staticmethod
    def _normalize_content(text: str) -> str:
        """Deterministic content normalization."""
        # Unicode normalization
        text = unicodedata.normalize('NFC', text)
        # Whitespace normalization
        lines = [line.rstrip() for line in text.split('\n')]
        text = '\n'.join(lines).strip()
        # Remove excessive blank lines
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text
```

**Guarantees:**
- **Binary identity** = file never changed (ingestion deduplication)
- **Content identity** = content is semantically same (despite parser version)
- **Structure identity** = sections/headings detected consistently (regression detection)
- **Extraction identity** = full extraction unchanged (lineage stability)
- **Audit identity** = complete audit trail captured (compliance)

---

## STAGE 6: EXTRACTION LINEAGE FORMALIZATION

### Current Gap

No formal extraction lineage — impossible to trace: "where did this extraction come from?"

### Hardened Design

```python
@dataclass
class ExtractionLineagePoint:
    """Single step in extraction lineage."""
    step_number: int
    timestamp: datetime
    
    # What happened?
    operation: Literal[
        'parse',
        'chunk',
        'normalize',
        'ocr_preprocess',
        'ocr_extract',
        'section_detect',
        'metadata_extract',
        'manual_correction',
        'ai_review',
        'human_review'
    ]
    
    # Who did it?
    operator: str  # "parser:v2.1" | "ocr:tesseract:5.2" | "human:andyrbek"
    operator_version: str
    
    # What changed?
    input_state: Dict[str, Any]
    output_state: Dict[str, Any]
    
    # How confident?
    confidence: float
    
    # Why did we do this?
    rationale: Optional[str]
    
    # Metadata
    metadata: Dict[str, Any]

@dataclass
class ExtractionLineage:
    """Complete lineage from source document to final extraction."""
    
    source_document_id: str
    source_format: str
    source_file_hash: str
    
    # Timeline of changes
    lineage_points: List[ExtractionLineagePoint]
    
    # Critical checkpoints
    parse_checkpoint: Optional[ExtractionLineagePoint]
    normalize_checkpoint: Optional[ExtractionLineagePoint]
    structure_checkpoint: Optional[ExtractionLineagePoint]
    final_checkpoint: Optional[ExtractionLineagePoint]
    
    # Summary
    total_corrections: int
    total_reviews: int
    final_confidence: float
    
    def add_point(self, point: ExtractionLineagePoint):
        """Add lineage point."""
        point.step_number = len(self.lineage_points)
        self.lineage_points.append(point)
    
    def get_audit_trail(self) -> str:
        """Generate human-readable audit trail."""
        trail = [f"Extraction Lineage for {self.source_document_id}"]
        trail.append(f"Source: {self.source_format} (hash: {self.source_file_hash[:16]}...)")
        trail.append("")
        
        for point in self.lineage_points:
            trail.append(f"Step {point.step_number}: {point.operation}")
            trail.append(f"  Operator: {point.operator} v{point.operator_version}")
            trail.append(f"  Confidence: {point.confidence:.2%}")
            if point.rationale:
                trail.append(f"  Reason: {point.rationale}")
            trail.append("")
        
        return '\n'.join(trail)
    
    def is_human_reviewed(self) -> bool:
        """Has this extraction been human-reviewed?"""
        return any(
            point.operation in ('manual_correction', 'human_review')
            for point in self.lineage_points
        )
    
    def is_production_ready(self) -> bool:
        """Is this extraction ready for regulatory use?"""
        return (
            self.final_confidence >= 0.95 and 
            self.is_human_reviewed() and
            self.total_corrections == 0  # No corrections needed
        )
```

**Example lineage:**

```
Extraction Lineage for AGSK-1.pdf
Source: pdf (hash: 36169acc7813c2c3...)

Step 0: parse
  Operator: parser:v2.1 PDF
  Confidence: 0.98
  Reason: PDF binary extraction using pdfplumber

Step 1: section_detect
  Operator: parser:v2.1
  Confidence: 0.85
  Reason: Regex + grammar-based section detection

Step 2: ocr_extract
  Operator: ocr:tesseract:5.2
  Confidence: 0.82
  Reason: OCR preprocessing + extraction for page 42

Step 3: manual_correction
  Operator: human:andyrbek
  Confidence: 0.99
  Reason: Fixed OCR misread "гравий" → "гравиil"

Step 4: ai_review
  Operator: ai:claude:opus
  Confidence: 0.88
  Reason: AI semantic review for regulatory compliance

Step 5: human_review
  Operator: human:andyrbek
  Confidence: 1.00
  Reason: Final human approval for production use

Status: PRODUCTION READY (100% confidence after human review)
```

**Guarantees:**
- **Complete provenance** — trace back to source document
- **Operator accountability** — who made each change
- **Confidence tracking** — confidence at each step
- **Audit trail** — human-readable + machine-parseable
- **Compliance ready** — regulatory audit support

---

## STAGE 7: DETERMINISM CONTRACT

### Definition

**ParserDeterminismContract** — formal contract guaranteeing stable parser behavior:

```python
class ParserDeterminismContract:
    """Guarantees extraction stability across runs, restarts, machines."""
    
    # GUARANTEE 1: Stable Ordering
    def guarantee_stable_ordering(self):
        """
        Same input → sections in same order every time.
        
        Implementation:
        - No random shuffling
        - No dict ordering reliance
        - All collections use consistent iteration order
        - Results sorted explicitly by (page, char_offset)
        """
        pass
    
    # GUARANTEE 2: Stable Normalization
    def guarantee_stable_normalization(self):
        """
        Normalization is deterministic and idempotent.
        
        Contract:
        - normalize(X) = normalize(normalize(X))
        - Same normalization rules across all parser versions (with version pinning)
        - Normalization config immutable per parser version
        """
        pass
    
    # GUARANTEE 3: Whitespace Policy
    def guarantee_whitespace_policy(self):
        """
        Whitespace handling is explicit and documented.
        
        Contract:
        - Consecutive spaces: reduced to single space (or preserved, explicitly)
        - Newlines: NL at section boundaries (specific positions)
        - Trailing whitespace: stripped from lines
        - Empty lines: normalized to single \n\n
        
        No implicit cleanup or contextual decisions.
        """
        pass
    
    # GUARANTEE 4: Encoding Normalization
    def guarantee_encoding_normalization(self):
        """
        Text encoding is normalized deterministically.
        
        Contract:
        - All input converted to UTF-8
        - Unicode normalization: NFC (not NFD, NFKC, etc.)
        - Combining characters handled consistently
        - No locale-dependent lowercasing or collation
        """
        pass
    
    # GUARANTEE 5: OCR Preprocessing (if applicable)
    def guarantee_ocr_preprocessing(self):
        """
        OCR preprocessing is deterministic and logged.
        
        Contract:
        - Preprocessing steps explicitly listed
        - Preprocessing config version pinned
        - Preprocessing duration logged (not used for hashing)
        - OCR engine version pinned
        - Same preprocessing on same input → same OCR output
        """
        pass
    
    # GUARANTEE 6: Serialization
    def guarantee_serialization(self):
        """
        Serialization to JSON is deterministic.
        
        Contract:
        - JSON keys sorted alphabetically
        - JSON values use consistent representation
        - Floats: fixed precision (not scientific notation)
        - Dates: ISO 8601 format
        - None/null: explicit handling
        """
        pass
    
    # GUARANTEE 7: No Runtime State Leakage
    def guarantee_no_runtime_state_leakage(self):
        """
        Runtime state never affects extraction identity.
        
        Contract:
        - Execution time: NOT in deterministic_hash
        - Memory usage: NOT in deterministic_hash
        - Parser version: NOT in deterministic_hash (but logged separately)
        - Parser execution timestamp: NOT in deterministic_hash
        - Process ID: NOT in deterministic_hash
        - Machine hostname: NOT in deterministic_hash
        
        Same content → same deterministic_hash (regardless of runtime)
        """
        pass
    
    # GUARANTEE 8: Reproducibility Across Restarts
    def guarantee_reproducibility_across_restarts(self):
        """
        Extraction survives process restart with identity preserved.
        
        Contract:
        - Extraction stored with deterministic_hash
        - On reload: recompute deterministic_hash from stored data
        - Recomputed hash == original hash (identity preserved)
        - No temporal dependencies (timestamps logged separately)
        """
        pass
    
    # GUARANTEE 9: Version Pinning
    def guarantee_version_pinning(self):
        """
        Parser version pinning prevents silent behavior changes.
        
        Contract:
        - Parser version explicitly stored per extraction
        - Behavior changes documented in CHANGELOG
        - Extraction lineage includes parser_version
        - Same parser version guaranteed same behavior
        - Version upgrade = explicit decision + re-extraction if needed
        """
        pass
    
    # GUARANTEE 10: Audit Trail Immutability
    def guarantee_audit_trail_immutability(self):
        """
        Extraction lineage cannot be modified after recording.
        
        Contract:
        - Lineage points append-only
        - No retroactive modification of audit trail
        - Hash includes full audit trail
        - Hash change = breaking audit trail (detected)
        """
        pass

@dataclass
class DeterminismContractStatus:
    """Report on determinism contract compliance."""
    
    guarantees_met: List[str]
    guarantees_violated: List[str]
    
    @property
    def is_compliant(self) -> bool:
        return len(self.guarantees_violated) == 0
    
    def audit_report(self) -> str:
        report = "DETERMINISM CONTRACT AUDIT\n"
        report += "=" * 50 + "\n\n"
        
        report += f"Guarantees Met ({len(self.guarantees_met)}/10):\n"
        for g in self.guarantees_met:
            report += f"  ✅ {g}\n"
        
        if self.guarantees_violated:
            report += f"\nGuarantees Violated ({len(self.guarantees_violated)}/10):\n"
            for g in self.guarantees_violated:
                report += f"  ❌ {g}\n"
        
        report += f"\nCompliance: {'✅ COMPLIANT' if self.is_compliant else '❌ NON-COMPLIANT'}\n"
        
        return report
```

---

## STAGE 8: FINAL HARDENING REVIEW CHECKLIST

### Pre-Implementation Gate

Before Week 2 parser implementation starts:

- [ ] **STAGE 1:** `DeterministicPayload` class separated from `RuntimeMetadata`
  - [ ] `deterministic_hash` depends only on content + structure + metadata
  - [ ] No parser_version, timestamp, execution_time in hash computation
  - [ ] Test: same payload, different runtime → same hash

- [ ] **STAGE 2:** OCR audit model implemented
  - [ ] `OcrResult` captures engine, version, preprocessing
  - [ ] `ExtractionAuditPoint` tracks OCR confidence separately
  - [ ] OCR output logged but NOT hashed
  - [ ] Test: same document, different OCR engine → different audit, SAME canonical text

- [ ] **STAGE 3:** Logical chunk model with format-aware references
  - [ ] No artificial page numbers for DOCX/TXT/XLSX
  - [ ] `ChunkReference.reference_is_native` flag present
  - [ ] `ChunkReference.reference_is_simulated` flag present
  - [ ] All citations include format context
  - [ ] Test: DOCX document cites by paragraph, not page

- [ ] **STAGE 4:** Extensible section grammar registry
  - [ ] Support ГОСТ + СТ РК + API + ASME + Latin + Cyrillic
  - [ ] `SectionGrammarRegistry` class with pattern registration
  - [ ] Confidence scoring per pattern
  - [ ] Nesting support with depth limits
  - [ ] Test: "ПП 3.2.1.5" detected correctly

- [ ] **STAGE 5:** Multi-layer hash model
  - [ ] `binary_identity_hash` = SHA256(file_bytes)
  - [ ] `content_normalization_hash` = SHA256(normalize(text))
  - [ ] `structure_hash` = SHA256(sections + headings)
  - [ ] `extraction_identity_hash` = combined
  - [ ] `audit_hash` = full audit trail
  - [ ] Test: each hash level has different use case

- [ ] **STAGE 6:** Extraction lineage formalization
  - [ ] `ExtractionLineage` class with append-only points
  - [ ] Source + parser + normalization + correction + review chain
  - [ ] Human-readable audit trail
  - [ ] `is_production_ready()` method
  - [ ] Test: lineage reconstructed from database == original

- [ ] **STAGE 7:** Determinism contract formalization
  - [ ] 10 guarantee methods documented
  - [ ] Contract compliance audit implemented
  - [ ] `DeterminismContractStatus` report generated
  - [ ] Test: all 10 guarantees verified

- [ ] **STAGE 8:** Architecture review documents complete
  - [ ] ✅ This report (PARSER_HARDENING_REPORT.md)
  - [ ] ✅ OCR_DETERMINISM_RISKS.md (in progress)
  - [ ] ✅ EXTRACTION_LINEAGE_ARCHITECTURE.md (in progress)
  - [ ] ✅ SECTION_GRAMMAR_ARCHITECTURE.md (in progress)
  - [ ] ✅ PARSER_DETERMINISM_CONTRACT.md (in progress)

---

## RISK REGISTER

### Pre-Implementation Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Nondeterministic whitespace in OCR output | 🔴 HIGH | Explicit whitespace policy + OCR audit |
| Heading detection regressions | 🟡 MEDIUM | Section grammar registry + test suite |
| Artificial page lineage (non-PDF) | 🔴 HIGH | Logical chunk model with native/simulated flags |
| Hash collision on similar content | 🟡 MEDIUM | Multi-layer hash model (binary + content + structure) |
| OCR version upgrades breaking hashes | 🔴 HIGH | OCR audit trail separate from extraction_hash |
| Untraceability after parsing | 🔴 HIGH | Extraction lineage formalization |

---

**Status:** 🔧 STAGES 1-8 IN PROGRESS

**Next:** Create supporting documents:
- OCR_DETERMINISM_RISKS.md
- EXTRACTION_LINEAGE_ARCHITECTURE.md
- SECTION_GRAMMAR_ARCHITECTURE.md
- PARSER_DETERMINISM_CONTRACT.md
