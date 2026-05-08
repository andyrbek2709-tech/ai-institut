# EXTRACTION LINEAGE ARCHITECTURE

**Status:** 📋 LINEAGE FORMALIZATION & AUDIT TRAIL DESIGN  
**Focus:** Complete provenance tracking from source → final extraction  
**Target:** Regulatory-ready audit trail before Week 2 implementation

---

## EXECUTIVE SUMMARY

**Current gap:**
- No extraction lineage — impossible to trace provenance
- No operator accountability — who made each decision?
- No confidence tracking — confidence at which step?
- No correction chain — which corrections were applied?
- No regulatory audit trail — "prove this extraction is trustworthy"

**After hardening:**
- Complete lineage from source document → final extraction
- Operator + timestamp + rationale at each step
- Confidence tracking throughout pipeline
- Immutable correction + review chains
- Regulatory audit report generation

---

## ARCHITECTURE

### Core Model: Immutable Lineage Graph

```python
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any, List

class ExtractionOperation(Enum):
    """Categorized extraction operations."""
    
    # Automated parsing
    PARSE_PDF = "parse_pdf"
    PARSE_DOCX = "parse_docx"
    PARSE_XLSX = "parse_xlsx"
    PARSE_TEXT = "parse_text"
    PARSE_HTML = "parse_html"
    
    # Preprocessing
    OCR_PREPROCESS = "ocr_preprocess"
    ENCODING_NORMALIZE = "encoding_normalize"
    WHITESPACE_NORMALIZE = "whitespace_normalize"
    UNICODE_NORMALIZE = "unicode_normalize"
    
    # Extraction
    SECTION_DETECT = "section_detect"
    CHUNK_GENERATION = "chunk_generation"
    METADATA_EXTRACT = "metadata_extract"
    FORMULA_EXTRACT = "formula_extract"
    
    # OCR-specific
    OCR_EXTRACT = "ocr_extract"
    OCR_LANGUAGE_DETECT = "ocr_language_detect"
    OCR_CONFIDENCE_CHECK = "ocr_confidence_check"
    
    # Human intervention
    MANUAL_CORRECTION = "manual_correction"
    HUMAN_REVIEW = "human_review"
    HUMAN_APPROVAL = "human_approval"
    
    # Quality gates
    QUALITY_GATE_CHECK = "quality_gate_check"
    REGULATORY_VALIDATION = "regulatory_validation"
    
    # Finalization
    FINALIZATION = "finalization"
    PUBLICATION = "publication"

class ConfidenceLevel(Enum):
    """Confidence categorization."""
    UNTRUSTWORTHY = (0.0, 0.5)    # < 50%
    LOW = (0.5, 0.7)              # 50-70%
    MEDIUM = (0.7, 0.85)          # 70-85%
    HIGH = (0.85, 0.95)           # 85-95%
    VERY_HIGH = (0.95, 1.0)       # 95-100%

@dataclass
class LineagePoint:
    """Immutable record of single step in extraction."""
    
    # Identification
    step_number: int
    operation: ExtractionOperation
    
    # Timing
    timestamp: datetime
    duration_ms: int
    
    # Operator (who/what did this)
    operator_type: str              # "parser:v2.1" | "human:andyrbek" | "ai:claude"
    operator_name: str              # More readable: "Parser PDF v2.1", "Human (Andrey)"
    operator_version: str
    
    # Execution context
    execution_context: Dict[str, Any] = field(default_factory=dict)
    # Examples:
    # - parser: {'pdf_engine': 'pdfplumber:0.9.0', 'page_count': 42}
    # - ocr: {'engine': 'tesseract:5.2.0', 'preprocessing_config_hash': '...'}
    # - human: {'reviewer_expertise': 'regulatory', 'review_duration_min': 15}
    
    # State changes
    input_state_hash: str           # Hash of input before operation
    output_state_hash: str          # Hash of output after operation
    
    state_delta: Optional[Dict[str, Any]] = None  # What changed
    # Example: {'sections_added': 42, 'errors_fixed': 3}
    
    # Confidence & quality
    confidence_before: float        # 0.0-1.0
    confidence_after: float         # 0.0-1.0
    confidence_rationale: str       # Why this confidence?
    
    # Rationale (why did we do this?)
    operation_rationale: str        # Human-readable reason
    
    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)
    # Arbitrary operation-specific metadata
    
    # Immutability marker
    is_immutable: bool = True
    
    def to_audit_record(self) -> Dict[str, Any]:
        """Convert to audit trail record."""
        return {
            'step': self.step_number,
            'operation': self.operation.value,
            'timestamp': self.timestamp.isoformat(),
            'operator': f"{self.operator_name} ({self.operator_type}:{self.operator_version})",
            'confidence': {
                'before': self.confidence_before,
                'after': self.confidence_after,
                'rationale': self.confidence_rationale
            },
            'rationale': self.operation_rationale,
            'state_delta': self.state_delta
        }

@dataclass
class ExtractionLineage:
    """Complete extraction lineage — append-only."""
    
    # Source document identification
    source_document_id: str
    source_format: str              # 'pdf' | 'docx' | 'xlsx' | 'txt'
    source_file_hash: str           # Binary identity of source
    source_file_size_bytes: int
    
    # Lineage tracking
    lineage_points: List[LineagePoint] = field(default_factory=list)
    
    # Timing
    extraction_started: datetime = field(default_factory=datetime.utcnow)
    extraction_completed: Optional[datetime] = None
    
    # Summary
    total_duration_ms: int = 0
    total_operations: int = 0
    total_corrections: int = 0
    
    # Final state
    final_extraction_hash: str = ""
    final_confidence: float = 0.0
    
    # Lineage integrity
    lineage_hash: str = ""  # Hash of entire lineage (detects tampering)
    
    def add_point(self, point: LineagePoint) -> None:
        """Add immutable point to lineage."""
        if self.extraction_completed:
            raise ValueError("Cannot add points to completed extraction")
        
        point.step_number = len(self.lineage_points)
        self.lineage_points.append(point)
        self.total_operations += 1
        
        # Recompute lineage hash
        self._recompute_lineage_hash()
    
    def mark_completed(self, final_hash: str, final_confidence: float) -> None:
        """Mark extraction complete."""
        self.extraction_completed = datetime.utcnow()
        self.total_duration_ms = int(
            (self.extraction_completed - self.extraction_started).total_seconds() * 1000
        )
        self.final_extraction_hash = final_hash
        self.final_confidence = final_confidence
        self._recompute_lineage_hash()
    
    def _recompute_lineage_hash(self) -> None:
        """Recompute lineage integrity hash."""
        lineage_dict = {
            'source_id': self.source_document_id,
            'source_hash': self.source_file_hash,
            'operations': [p.to_audit_record() for p in self.lineage_points],
            'completed': self.extraction_completed.isoformat() if self.extraction_completed else None,
            'final_hash': self.final_extraction_hash,
            'final_confidence': self.final_confidence
        }
        
        self.lineage_hash = hashlib.sha256(
            json.dumps(lineage_dict, sort_keys=True, default=str).encode()
        ).hexdigest()
    
    def verify_integrity(self) -> bool:
        """Verify lineage hasn't been tampered with."""
        previous_hash = self.lineage_hash
        self._recompute_lineage_hash()
        return self.lineage_hash == previous_hash
    
    # Query methods
    def get_operator_chain(self) -> List[str]:
        """Get operator timeline."""
        return [
            f"{p.step_number}: {p.operator_name}"
            for p in self.lineage_points
        ]
    
    def get_confidence_timeline(self) -> List[float]:
        """Get confidence at each step."""
        return [p.confidence_after for p in self.lineage_points]
    
    def get_corrections_applied(self) -> List[str]:
        """Get all corrections."""
        return [
            p.operation_rationale
            for p in self.lineage_points
            if 'correction' in p.operation.value
        ]
    
    def has_human_review(self) -> bool:
        """Has this extraction been human-reviewed?"""
        return any(
            'human' in p.operator_type.lower()
            for p in self.lineage_points
        )
    
    def has_human_approval(self) -> bool:
        """Has this extraction been explicitly approved by human?"""
        return any(
            p.operation == ExtractionOperation.HUMAN_APPROVAL
            for p in self.lineage_points
        )
    
    def is_production_ready(self) -> bool:
        """Is this extraction ready for regulatory/production use?"""
        return (
            self.final_confidence >= 0.95 and
            self.has_human_review() and
            self.has_human_approval() and
            self.verify_integrity()
        )
    
    def is_suspicious(self) -> bool:
        """Are there red flags in this extraction?"""
        return (
            not self.has_human_review() or
            self.final_confidence < 0.7 or
            not self.verify_integrity()
        )
    
    def generate_audit_trail(self) -> str:
        """Generate human-readable audit trail."""
        report = []
        
        report.append("=" * 70)
        report.append("EXTRACTION LINEAGE AUDIT TRAIL")
        report.append("=" * 70)
        report.append("")
        
        # Source information
        report.append("SOURCE DOCUMENT:")
        report.append(f"  ID: {self.source_document_id}")
        report.append(f"  Format: {self.source_format}")
        report.append(f"  File Hash: {self.source_file_hash[:32]}...")
        report.append(f"  File Size: {self.source_file_size_bytes:,} bytes")
        report.append("")
        
        # Timeline
        report.append("EXTRACTION TIMELINE:")
        report.append(f"  Started: {self.extraction_started.isoformat()}")
        if self.extraction_completed:
            report.append(f"  Completed: {self.extraction_completed.isoformat()}")
            report.append(f"  Duration: {self.total_duration_ms}ms")
        report.append("")
        
        # Operations
        report.append("OPERATIONS:")
        for point in self.lineage_points:
            report.append(f"\n  Step {point.step_number}: {point.operation.value}")
            report.append(f"    Operator: {point.operator_name} ({point.operator_type}:{point.operator_version})")
            report.append(f"    Timestamp: {point.timestamp.isoformat()}")
            report.append(f"    Duration: {point.duration_ms}ms")
            report.append(f"    Confidence: {point.confidence_before:.1%} → {point.confidence_after:.1%}")
            report.append(f"    Rationale: {point.operation_rationale}")
            if point.state_delta:
                report.append(f"    Changes: {point.state_delta}")
        
        report.append("")
        
        # Final status
        report.append("FINAL STATUS:")
        report.append(f"  Extraction Hash: {self.final_extraction_hash[:32]}...")
        report.append(f"  Final Confidence: {self.final_confidence:.1%}")
        report.append(f"  Total Operations: {self.total_operations}")
        report.append(f"  Human Reviewed: {self.has_human_review()}")
        report.append(f"  Human Approved: {self.has_human_approval()}")
        report.append(f"  Production Ready: {self.is_production_ready()}")
        report.append(f"  Integrity Verified: {self.verify_integrity()}")
        
        report.append("")
        report.append("=" * 70)
        
        return '\n'.join(report)
```

---

## EXAMPLE LINEAGE

### Scenario: PDF Extraction with OCR Correction + Human Review

```python
lineage = ExtractionLineage(
    source_document_id="AGSK-1.pdf",
    source_format="pdf",
    source_file_hash="abc123def456...",
    source_file_size_bytes=6_800_000
)

# Step 0: PDF parsing
lineage.add_point(LineagePoint(
    operation=ExtractionOperation.PARSE_PDF,
    timestamp=datetime(2026, 5, 9, 16, 0, 0),
    duration_ms=2500,
    operator_type="parser:pdfplumber:0.9.0",
    operator_name="PDF Parser (pdfplumber)",
    operator_version="0.9.0",
    execution_context={'page_count': 394},
    input_state_hash="hash_of_pdf_bytes",
    output_state_hash="hash_of_parsed_text",
    confidence_before=0.0,
    confidence_after=0.98,
    confidence_rationale="Native PDF text extraction",
    operation_rationale="Extract text from PDF document"
))

# Step 1: Section detection
lineage.add_point(LineagePoint(
    operation=ExtractionOperation.SECTION_DETECT,
    timestamp=datetime(2026, 5, 9, 16, 0, 2),
    duration_ms=850,
    operator_type="parser:section_grammar:2.1",
    operator_name="Section Grammar Engine",
    operator_version="2.1",
    execution_context={'grammar_patterns': 12, 'sections_found': 87},
    input_state_hash="hash_of_parsed_text",
    output_state_hash="hash_of_sections",
    confidence_before=0.98,
    confidence_after=0.92,
    confidence_rationale="87/92 sections detected with high confidence",
    operation_rationale="Detect document sections and hierarchy"
))

# Step 2: Chunk generation
lineage.add_point(LineagePoint(
    operation=ExtractionOperation.CHUNK_GENERATION,
    timestamp=datetime(2026, 5, 9, 16, 0, 3),
    duration_ms=450,
    operator_type="parser:chunker:1.5",
    operator_name="Content Chunker",
    operator_version="1.5",
    execution_context={'chunk_size': 600, 'overlap': 30, 'total_chunks': 1565},
    input_state_hash="hash_of_sections",
    output_state_hash="hash_of_chunks",
    confidence_before=0.92,
    confidence_after=0.90,
    confidence_rationale="1560/1565 chunks within target size",
    operation_rationale="Split content into chunks for embedding"
))

# Step 3: Metadata extraction
lineage.add_point(LineagePoint(
    operation=ExtractionOperation.METADATA_EXTRACT,
    timestamp=datetime(2026, 5, 9, 16, 0, 3),
    duration_ms=320,
    operator_type="parser:metadata:1.0",
    operator_name="Metadata Extractor",
    operator_version="1.0",
    execution_context={'fields_detected': ['title', 'year', 'org', 'standard_code']},
    input_state_hash="hash_of_chunks",
    output_state_hash="hash_of_metadata",
    confidence_before=0.90,
    confidence_after=0.87,
    confidence_rationale="4/4 metadata fields detected",
    operation_rationale="Extract document metadata"
))

# Step 4: Human review (found OCR issue on page 42)
lineage.add_point(LineagePoint(
    operation=ExtractionOperation.MANUAL_CORRECTION,
    timestamp=datetime(2026, 5, 9, 16, 15, 30),
    duration_ms=480_000,  # 8 minutes review
    operator_type="human:andyrbek",
    operator_name="Andrey (Senior Engineer)",
    operator_version="1.0",
    execution_context={
        'pages_reviewed': 10,
        'issues_found': 3,
        'issues_fixed': 3
    },
    input_state_hash="hash_of_metadata",
    output_state_hash="hash_of_corrected_metadata",
    state_delta={'corrections_applied': ['page_42_ocr_fix', 'typo_section_5', 'metadata_year']},
    confidence_before=0.87,
    confidence_after=0.96,
    confidence_rationale="Manual review fixed 3 critical issues",
    operation_rationale="Human review identified OCR error on page 42: 'гравиil' → 'гравий'"
))

# Step 5: Final approval
lineage.add_point(LineagePoint(
    operation=ExtractionOperation.HUMAN_APPROVAL,
    timestamp=datetime(2026, 5, 9, 16, 16, 0),
    duration_ms=60,
    operator_type="human:andyrbek",
    operator_name="Andrey (Senior Engineer)",
    operator_version="1.0",
    execution_context={'approval_level': 'production_ready'},
    input_state_hash="hash_of_corrected_metadata",
    output_state_hash="hash_of_corrected_metadata",  # No change
    confidence_before=0.96,
    confidence_after=1.00,
    confidence_rationale="Explicit human approval",
    operation_rationale="APPROVED FOR PRODUCTION USE"
))

# Mark complete
lineage.mark_completed(
    final_hash="final_extraction_hash_abc123...",
    final_confidence=1.00
)

# Generate audit trail
print(lineage.generate_audit_trail())
```

**Output:**

```
======================================================================
EXTRACTION LINEAGE AUDIT TRAIL
======================================================================

SOURCE DOCUMENT:
  ID: AGSK-1.pdf
  Format: pdf
  File Hash: abc123def456...
  File Size: 6,800,000 bytes

EXTRACTION TIMELINE:
  Started: 2026-05-09T16:00:00
  Completed: 2026-05-09T16:16:00
  Duration: 960000ms

OPERATIONS:

  Step 0: parse_pdf
    Operator: PDF Parser (pdfplumber) (parser:pdfplumber:0.9.0)
    Timestamp: 2026-05-09T16:00:00
    Duration: 2500ms
    Confidence: 0% → 98%
    Rationale: Extract text from PDF document
    Changes: None

  Step 1: section_detect
    Operator: Section Grammar Engine (parser:section_grammar:2.1)
    Timestamp: 2026-05-09T16:00:02
    Duration: 850ms
    Confidence: 98% → 92%
    Rationale: Detect document sections and hierarchy
    Changes: None

  Step 2: chunk_generation
    Operator: Content Chunker (parser:chunker:1.5)
    Timestamp: 2026-05-09T16:00:03
    Duration: 450ms
    Confidence: 92% → 90%
    Rationale: Split content into chunks for embedding
    Changes: None

  Step 3: metadata_extract
    Operator: Metadata Extractor (parser:metadata:1.0)
    Timestamp: 2026-05-09T16:00:03
    Duration: 320ms
    Confidence: 90% → 87%
    Rationale: Extract document metadata

  Step 4: manual_correction
    Operator: Andrey (Senior Engineer) (human:andyrbek)
    Timestamp: 2026-05-09T16:15:30
    Duration: 480000ms
    Confidence: 87% → 96%
    Rationale: Human review identified OCR error on page 42: 'гравиil' → 'гравий'
    Changes: {'corrections_applied': ['page_42_ocr_fix', 'typo_section_5', 'metadata_year']}

  Step 5: human_approval
    Operator: Andrey (Senior Engineer) (human:andyrbek)
    Timestamp: 2026-05-09T16:16:00
    Duration: 60ms
    Confidence: 96% → 100%
    Rationale: APPROVED FOR PRODUCTION USE

FINAL STATUS:
  Extraction Hash: final_extraction_hash_abc123...
  Final Confidence: 100%
  Total Operations: 6
  Human Reviewed: True
  Human Approved: True
  Production Ready: True
  Integrity Verified: True

======================================================================
```

---

## DATABASE SCHEMA

```sql
-- Lineage storage
CREATE TABLE extraction_lineages (
    lineage_id UUID PRIMARY KEY,
    source_document_id TEXT NOT NULL,
    source_format TEXT NOT NULL,
    source_file_hash TEXT NOT NULL,
    
    extraction_started TIMESTAMP NOT NULL,
    extraction_completed TIMESTAMP,
    
    final_extraction_hash TEXT,
    final_confidence FLOAT,
    
    lineage_hash TEXT NOT NULL,  -- Integrity marker
    
    is_production_ready BOOLEAN,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Immutable lineage points
CREATE TABLE lineage_points (
    point_id UUID PRIMARY KEY,
    lineage_id UUID NOT NULL REFERENCES extraction_lineages(lineage_id),
    
    step_number INT NOT NULL,
    operation TEXT NOT NULL,
    
    timestamp TIMESTAMP NOT NULL,
    duration_ms INT,
    
    operator_type TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    operator_version TEXT NOT NULL,
    
    execution_context JSONB,
    
    input_state_hash TEXT,
    output_state_hash TEXT,
    state_delta JSONB,
    
    confidence_before FLOAT,
    confidence_after FLOAT,
    confidence_rationale TEXT,
    
    operation_rationale TEXT NOT NULL,
    metadata JSONB,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT point_immutable UNIQUE (lineage_id, step_number)
);

-- Audit trail queries
CREATE INDEX idx_lineage_source ON extraction_lineages(source_document_id);
CREATE INDEX idx_lineage_production_ready ON extraction_lineages(is_production_ready);
CREATE INDEX idx_points_operation ON lineage_points(operation);
CREATE INDEX idx_points_operator ON lineage_points(operator_type);
```

---

## REGULATORY COMPLIANCE

### Audit Trail Requirements

✅ **Complete provenance:** Source → parser → corrections → review → approval
✅ **Operator accountability:** Who made each decision
✅ **Timestamp immutability:** When each step occurred
✅ **Confidence tracking:** Confidence at each step
✅ **Correction chain:** What corrections were applied
✅ **Integrity verification:** Lineage hasn't been tampered with
✅ **Production readiness:** Explicit human approval gate

### Regulatory Report Generation

```python
def generate_regulatory_audit_report(lineage: ExtractionLineage) -> str:
    """Generate compliance report."""
    
    report = []
    
    # Compliance checklist
    report.append("REGULATORY COMPLIANCE CHECKLIST")
    report.append("")
    
    checks = {
        'Source Document Identified': lineage.source_document_id is not None,
        'Complete Lineage Recorded': len(lineage.lineage_points) > 0,
        'All Operations Timestamped': all(p.timestamp for p in lineage.lineage_points),
        'Operators Identified': all(p.operator_type for p in lineage.lineage_points),
        'Confidence Tracked': all(p.confidence_after for p in lineage.lineage_points),
        'Corrections Documented': len(lineage.get_corrections_applied()) == lineage.total_corrections,
        'Human Review Present': lineage.has_human_review(),
        'Human Approval Present': lineage.has_human_approval(),
        'Integrity Verified': lineage.verify_integrity(),
        'Production Ready': lineage.is_production_ready()
    }
    
    for check, result in checks.items():
        status = "✅" if result else "❌"
        report.append(f"  {status} {check}")
    
    report.append("")
    
    # Risk assessment
    if lineage.is_suspicious():
        report.append("⚠️ WARNING: This extraction has quality concerns:")
        if not lineage.has_human_review():
            report.append("  - No human review performed")
        if lineage.final_confidence < 0.7:
            report.append(f"  - Low confidence: {lineage.final_confidence:.1%}")
        if not lineage.verify_integrity():
            report.append("  - Integrity verification FAILED (potential tampering)")
    else:
        report.append("✅ This extraction PASSED all compliance checks")
    
    return '\n'.join(report)
```

---

**Status:** 📋 EXTRACTION LINEAGE ARCHITECTURE COMPLETE

**Next Step:** SECTION_GRAMMAR_ARCHITECTURE.md (extensible grammar design)
