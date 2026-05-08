# ÉTAP 3 Phase 2 — REPORT INTEGRATION & REGULATORY FOUNDATION
## COMPREHENSIVE IMPLEMENTATION PLAN

**Date:** 2026-05-08  
**Status:** Planning Phase → Ready for Implementation  
**Target Duration:** 8 weeks (80-100 hours)  
**Priority:** HIGH (engineering deliverables)

---

## EXECUTIVE SUMMARY

Transform ÉTAP 3 Phase 1 baseline (basic report generation) into production-grade engineering reporting system with:
- **Deterministic output** (identical input → identical hash)
- **Revision control** (versions with full metadata)
- **Normative traceability** (GOST/ASME/SNiP references)
- **Engineering lifecycle** (generated → reviewed → approved)
- **Integrity assurance** (checksums, verification)
- **Reproducibility guarantees** (re-generate exact copies)

---

## PHASE 2: 8-STAGE ROADMAP

### STAGE 1: REPORT LIFECYCLE INTEGRATION (1 week, 12h)

**Goal:** Integrate reports directly into calculation pipeline.

**Execution Plan:**

```
Calculation Result
    ↓ (validation + semantics)
Audit Trail (execution traces)
    ↓ (context building)
Report Context (structured data)
    ↓ (deterministic rendering)
Report Bytes (frozen DOCX)
    ↓ (checksum + metadata)
Stored Report (immutable + auditable)
```

**Deliverables:**

1. `src/engine/reporting/lifecycle.py` — ReportLifecycleManager
   - `generate()` — full pipeline orchestration
   - `attach_to_calculation()` — bidirectional link
   - `track_generation()` — timestamp, execution context

2. `src/engine/reporting/generation_context.py` — GenerationContext model
   - Generated timestamp (UTC)
   - Generator ID (system/user)
   - Calculation metadata reference
   - Template version
   - Engine version

3. Database schema update:
   - `reports` table (report_id, calculation_id, status, created_at, updated_at)
   - `report_generations` table (tracking each generation attempt)

4. Integration tests:
   - Calculate → Extract → Generate → Store
   - Verify bidirectional links (calculation → report, report → calculation)
   - Ensure audit trail completeness

5. State tracking:
   - Report states: GENERATED, CACHED, ERROR, ARCHIVED, SUPERSEDED
   - Lifecycle transitions: audit logging

**Key Files to Create:**
- `src/engine/reporting/lifecycle.py`
- `src/engine/reporting/generation_context.py`
- `src/database/schema_updates/reporting_lifecycle.sql`
- `tests/test_reporting_lifecycle.py`

**Success Criteria:**
- Full pipeline works end-to-end
- Every report has immutable generation context
- Calculation ↔ Report linkage verified
- 0 data loss during generation

---

### STAGE 2: REPORT REPRODUCIBILITY (1 week, 12h)

**Goal:** Ensure deterministic report generation (same input → same bytes).

**Execution Plan:**

1. **Timestamp Isolation** (`src/engine/reporting/determinism.py`)
   ```python
   class DeterministicReportBuilder:
       - Use frozen timestamp (passed in, not runtime)
       - Seed RNG for any formatting
       - Fix font rendering (no platform deps)
       - Deterministic ordering of all sections
   ```

2. **Deterministic Ordering**
   - Input variables: sorted by name
   - Formulas: sorted by ID
   - Validation results: sorted by rule_id
   - Warnings: sorted alphabetically
   - Execution traces: sorted by timestamp, then formula_id

3. **Stable Formatting**
   - Fixed font sizes (Calibri 11pt body, 14pt headings)
   - Fixed spacing (single line height, 0.5" margins)
   - Fixed table widths
   - No dynamic width calculations
   - Consistent page breaks

4. **Formula Rendering Stability**
   - SymPy expressions: normalize before rendering
   - Variable substitution: fixed order
   - Calculation steps: deterministic breakdown
   - No floating-point rounding artifacts

5. **Hash Computation**
   ```python
   def compute_report_hash(report_bytes: bytes, 
                          include_metadata: bool = False) -> str:
       """SHA256 of report content.
       
       Args:
           report_bytes: Raw DOCX bytes
           include_metadata: False = hash content only, 
                           True = include metadata in hash
       """
   ```

**Deliverables:**

1. `src/engine/reporting/determinism.py` — DeterministicReportBuilder
   - Inherits from DocxReportBuilder
   - Overrides all non-deterministic operations
   - Hash computation

2. `src/engine/reporting/normalization.py` — Expression normalization
   - Normalize SymPy expressions (canonical form)
   - Sort collections deterministically
   - Format numbers consistently (significant figures)

3. Integration:
   - Update `ReportGenerationResponse` to include content_hash
   - Add hash verification on read

4. Test suite:
   - Generate same report 100x, verify all hashes identical
   - Test with various floating-point values
   - Test timezone handling
   - Test formula rendering consistency

5. Reproducibility Benchmark:
   - Generate report 1000 times, measure hash distribution
   - Record execution time variance
   - Verify 100% hash match rate

**Success Criteria:**
- Same input data → identical SHA256 across 1000 generations
- Benchmark report: `REPRODUCIBILITY_REPORT.md`
- <5ms variance in generation time
- No platform-dependent artifacts

---

### STAGE 3: REPORT REVISION SYSTEM (1.5 weeks, 18h)

**Goal:** Track report versions with full revision metadata.

**Execution Plan:**

1. **Revision Model** (`src/engine/reporting/revisions.py`)
   ```python
   @dataclass
   class ReportRevision:
       revision_id: str              # unique per calculation
       calculation_id: str
       report_id: str
       revision_number: int          # 1, 2, 3, ...
       created_at: datetime
       created_by: Optional[str]     # user/system
       
       # What changed
       change_type: str              # "input_updated", "formula_corrected", ...
       change_description: str
       changed_fields: List[str]     # ["pressure", "temperature"]
       
       # Report content
       report_hash: str              # content hash
       engine_version: str
       
       # Metadata
       is_current: bool
       archived_at: Optional[datetime]
   
   @dataclass
   class RevisionDiff:
       revision_a: int
       revision_b: int
       changed_inputs: Dict[str, Tuple[Any, Any]]     # old → new
       changed_results: Dict[str, Tuple[Any, Any]]
       calculation_changes: List[str]
   ```

2. **Revision Tracking**
   - Automatic revision creation on input change
   - Compare prev_hash != new_hash → new revision
   - Keep revision history (immutable)
   - Mark "current" revision

3. **Database Schema**
   ```sql
   CREATE TABLE report_revisions (
       revision_id UUID PRIMARY KEY,
       calculation_id UUID NOT NULL,
       report_id UUID NOT NULL,
       revision_number INT NOT NULL,
       created_at TIMESTAMP NOT NULL,
       created_by TEXT,
       change_type TEXT,
       change_description TEXT,
       changed_fields JSONB,
       report_hash TEXT NOT NULL,
       engine_version TEXT NOT NULL,
       is_current BOOLEAN DEFAULT FALSE,
       archived_at TIMESTAMP,
       UNIQUE (calculation_id, revision_number)
   );
   ```

4. **Revision Diff Engine**
   - Compare consecutive revisions
   - Show what changed: inputs, formulas, results
   - Show impact analysis: which validations changed status

5. **Revision Browser UI** (future frontend work)
   - Timeline of revisions
   - Side-by-side diff view
   - Rollback to previous revision (archive current)

**Deliverables:**

1. `src/engine/reporting/revisions.py` — Revision management
2. `src/engine/reporting/revision_diff.py` — Diff engine
3. `src/database/schema_updates/report_revisions.sql` — Schema
4. `src/api/endpoints/revisions.py` — REST API
   - GET /api/reports/{report_id}/revisions
   - GET /api/reports/{report_id}/revisions/{rev_number}
   - GET /api/reports/{report_id}/revisions/{rev_a}/diff/{rev_b}
   - POST /api/reports/{report_id}/revisions/{rev_number}/restore

5. Tests:
   - Revision creation on input change
   - Diff computation accuracy
   - Immutability of old revisions
   - Current revision tracking

6. Example: `examples/revision_tracking_example.md`
   ```markdown
   Revision 1 (2026-05-08 14:30)
   - Pressure: 5.0 MPa
   - Results: hoop_stress = 45 MPa ⚠️
   
   Revision 2 (2026-05-08 15:15) [CURRENT]
   - Pressure: 4.5 MPa (updated)
   - Results: hoop_stress = 40.5 MPa ✓
   ```

**Success Criteria:**
- Full revision history maintained
- Diffs accurate and complete
- API endpoints working
- Example demonstrates real-world revision scenario

---

### STAGE 4: NORMATIVE TRACEABILITY (1.5 weeks, 18h)

**Goal:** Link reports to engineering standards (GOST, ASME, SNiP, ISO, etc.).

**Execution Plan:**

1. **Normative Reference Model** (`src/engine/reporting/normative_framework.py`)
   ```python
   @dataclass
   class NormativeReference:
       reference_id: str             # "ASME_B31.4_2019"
       organization: str             # "ASME", "API", "GOST", "SNiP"
       standard_code: str            # "B31.4", "5L", "20295-85"
       edition: str                  # "2019", "2018"
       section: Optional[str]        # "2.3.1"
       equation: Optional[str]       # "Equation 5"
       title: str
       url: Optional[str]
       
   @dataclass
   class NormativeAssumption:
       assumption_id: str
       category: str                 # "load_type", "material", "environment"
       statement: str
       references: List[NormativeReference]
   
   @dataclass
   class SectionNormativity:
       section_id: str               # "inputs", "formulas", "validation"
       normative_basis: List[NormativeReference]
       assumptions: List[NormativeAssumption]
   ```

2. **Normative Database** (`src/database/normative_standards.json`)
   - Curated list of engineering standards
   - ASME B31.x series (piping)
   - API 5L, 1104 (pipeline)
   - GOST 20295-85, СТ РК ISO 3183 (materials)
   - ISO 13842, 14732 (welding)
   - NACE MR0175, SP0169 (corrosion)
   - SNiP 2.05.06-85 (pipelines, Russian)

3. **Traceability Tracking**
   - Each formula → normative reference
   - Each validation rule → normative reference
   - Each assumption → normative basis
   - Engineering notes on why standard applies

4. **Report Sections Integration**
   ```
   NORMATIVE REFERENCES SECTION
   1. ASME B31.4-2019: Pipeline Transportation Systems for Liquids and Slurries
      - Used for: hoop stress calculation (Eq. 2.3)
      - Used for: design pressure validation
   
   2. API 5L-2018: Specifications for Line Pipe
      - Used for: material grade selection (X65, X80)
   
   ASSUMPTIONS SECTION
   Static Loading:
      Basis: ASME B31.4-2019, Section 2.1 (design loading)
      Assumption: No dynamic or cyclic loading
      Impact: Simplified stress analysis (no fatigue check)
   ```

5. **Validation Rule → Standard Mapping**
   ```python
   VALIDATION_RULES_STANDARDS = {
       "hoop_stress_limit": NormativeReference(
           organization="ASME",
           standard_code="B31.4",
           edition="2019",
           section="2.3.1",
           equation="5",
           title="Hoop Stress Calculation"
       ),
       "pressure_range": NormativeReference(
           organization="ASME",
           standard_code="B31.4",
           edition="2019",
           section="2.2",
           title="Design Pressure Range"
       ),
   }
   ```

**Deliverables:**

1. `src/engine/reporting/normative_framework.py` — Models
2. `src/database/normative_standards.json` — Standard definitions (150+ entries)
3. `src/engine/reporting/normative_mapper.py` — Maps rules to standards
4. `src/database/schema_updates/normative_references.sql` — Schema
5. Updated `ReportContext` to include normative traceability
6. Updated DOCX rendering to show normative references
7. Tests:
   - Standard mapping completeness
   - Rendering accuracy
   - Validation rule → standard linkage
8. Example: `examples/normative_traceability_example.md`
   - Real report with ASME/API/GOST references
   - Show formula → standard mapping

**Success Criteria:**
- 150+ standards in database
- Each validation rule mapped to standard
- Report shows normative basis clearly
- DOCX includes reference section with links

---

### STAGE 5: ENGINEERING SIGNATURE CHAIN FOUNDATION (1.5 weeks, 18h)

**Goal:** Foundation for engineering review workflow (no auth yet, architecture only).

**Execution Plan:**

1. **Signature Model** (`src/engine/reporting/signatures.py`)
   ```python
   @dataclass
   class EngineeringSignature:
       signature_id: str
       report_id: str
       action: str                   # "generated", "reviewed", "approved"
       performed_by: Optional[str]   # user_id/system
       performed_at: datetime
       
       # Metadata
       role: str                      # "engineer", "lead", "approver"
       title: str
       organization: Optional[str]
       
       # Notes
       notes: Optional[str]
       review_findings: Optional[str]
       approval_conditions: Optional[str]
       
       # Verification
       signature_hash: str            # HMAC of (report_hash + action + performed_at)
       is_verified: bool
   
   @dataclass
   class SignatureChain:
       report_id: str
       signatures: List[EngineeringSignature]
       
       def add_signature(self, sig: EngineeringSignature) -> bool:
           """Append signature (only forward, no revision)."""
       
       def is_complete(self, required_roles: List[str]) -> bool:
           """Check if all required signatures present."""
       
       def verify_chain(self, report_bytes: bytes) -> bool:
           """Verify signature chain integrity."""
   ```

2. **Signature Chain Rules**
   - Generated → (Reviewed) → Approved
   - Each step leaves immutable record
   - Can add notes but not modify previous signatures
   - Chain validates against report content hash

3. **API Foundation** (`src/api/endpoints/signatures.py`)
   ```python
   POST /api/reports/{report_id}/signatures/generated
   - Auto-called by report generation
   - Records: report_hash, timestamp, system version
   
   POST /api/reports/{report_id}/signatures/review
   - Called by reviewer
   - Payload: findings, notes, approval_recommendation
   - Records: reviewer, timestamp, findings
   
   POST /api/reports/{report_id}/signatures/approve
   - Called by approver
   - Payload: approval_conditions, notes
   - Records: approver, timestamp, conditions
   
   GET /api/reports/{report_id}/signature-chain
   - Returns: full chain with all signatures
   
   POST /api/reports/{report_id}/signature-chain/verify
   - Verifies: signatures valid, report not tampered
   - Returns: verification status
   ```

4. **Database Schema**
   ```sql
   CREATE TABLE report_signatures (
       signature_id UUID PRIMARY KEY,
       report_id UUID NOT NULL,
       action TEXT NOT NULL,
       performed_by TEXT,
       performed_at TIMESTAMP NOT NULL,
       role TEXT,
       title TEXT,
       organization TEXT,
       notes TEXT,
       review_findings TEXT,
       approval_conditions TEXT,
       signature_hash TEXT NOT NULL,
       is_verified BOOLEAN DEFAULT FALSE
   );
   ```

5. **Integrity Verification**
   - Signature hash = HMAC(report_hash || action || timestamp || role)
   - Validates against original calculation
   - Detects tampering (report modified → hash mismatch → signatures invalid)

**Deliverables:**

1. `src/engine/reporting/signatures.py` — Models
2. `src/api/endpoints/signatures.py` — REST API (foundation only)
3. `src/database/schema_updates/signatures.sql` — Schema
4. `src/engine/reporting/signature_verification.py` — Verification logic
5. Tests:
   - Chain creation
   - Signature verification
   - Tampering detection
   - Role tracking
6. Example: `examples/engineering_signature_example.md`
   ```markdown
   Report: pipe_stress_001_rev1
   
   Generated: 2026-05-08 14:30 UTC
   - System: calculation-engine/0.3.0
   - Hash: sha256:abc123...
   
   Reviewed: 2026-05-08 15:00 UTC
   - Reviewer: john.doe (Lead Engineer)
   - Findings: Formula verified, assumptions valid
   - Recommendation: Approve pending approval conditions
   
   Approved: 2026-05-08 16:00 UTC
   - Approver: jane.smith (Principal Engineer)
   - Conditions: Use in design only with factor=1.5
   - Notes: Approved for production use
   
   Verification: ✓ VALID (signatures match report hash)
   ```

**Success Criteria:**
- Signature chain model complete
- API endpoints defined (no auth logic yet)
- Verification logic working
- Example demonstrates real workflow
- Foundation ready for auth integration (future)

---

### STAGE 6: REPORT INTEGRITY VERIFICATION (1 week, 12h)

**Goal:** Detect modified, stale, or invalid reports.

**Execution Plan:**

1. **Checksum System** (`src/engine/reporting/integrity.py`)
   ```python
   class ReportIntegrityChecker:
       def compute_checksums(self, report: Report) -> ReportChecksums:
           """Compute all integrity checksums."""
           return ReportChecksums(
               content_hash=sha256(report_bytes),
               formula_hash=sha256(formula_definitions),
               template_hash=sha256(template_version),
               audit_hash=sha256(audit_trail),
               signature_chain_hash=sha256(signatures),
               metadata_hash=sha256(metadata)
           )
       
       def verify_report(self, report: Report) -> VerificationResult:
           """Verify all checksums."""
           current = self.compute_checksums(report)
           stored = report.checksums
           
           return VerificationResult(
               content_valid=(current.content_hash == stored.content_hash),
               formulas_valid=(current.formula_hash == stored.formula_hash),
               template_valid=(current.template_hash == stored.template_hash),
               audit_valid=(current.audit_hash == stored.audit_hash),
               signatures_valid=(current.signature_chain_hash == stored.signature_chain_hash),
               metadata_valid=(current.metadata_hash == stored.metadata_hash),
               overall_valid=all([...]),
               modified_at=None if valid else self._detect_modification_time(report)
           )
       
       def detect_stale_report(self, report: Report) -> bool:
           """Check if report is stale (calculation updated, report not)."""
           calc = self.get_calculation(report.calculation_id)
           return calc.metadata.last_updated > report.generated_at
       
       def verify_calculation_match(self, report: Report, 
                                   calculation: Calculation) -> bool:
           """Verify report matches current calculation."""
           return (
               report.calculation_hash == self.compute_hash(calculation) and
               report.inputs_hash == self.compute_hash(calculation.inputs)
           )
   ```

2. **Integrity Metadata** (`src/engine/reporting/models.py` update)
   ```python
   @dataclass
   class ReportChecksums:
       content_hash: str             # SHA256 of report bytes
       formula_hash: str             # SHA256 of formulas
       template_hash: str            # SHA256 of template version
       audit_hash: str               # SHA256 of audit trail
       signature_chain_hash: str     # SHA256 of signatures
       metadata_hash: str            # SHA256 of metadata
       calculation_hash: str         # SHA256 of source calculation
       inputs_hash: str              # SHA256 of input values
       computed_at: datetime
   
   @dataclass
   class VerificationResult:
       content_valid: bool
       formulas_valid: bool
       template_valid: bool
       audit_valid: bool
       signatures_valid: bool
       metadata_valid: bool
       overall_valid: bool
       
       # Diagnostics
       issues: List[str]
       modified_at: Optional[datetime]
       stale: bool
       calculation_match: bool
   ```

3. **Verification Rules**
   - Content hash mismatch → report modified (potential tampering)
   - Formula hash mismatch → formulas changed
   - Template hash mismatch → template version changed
   - Signature mismatch → signatures don't match report
   - Stale detection → calculation changed, report not regenerated

4. **API Endpoints**
   ```python
   POST /api/reports/{report_id}/verify
   - Full verification of all checksums
   - Returns: VerificationResult
   
   GET /api/reports/{report_id}/integrity-status
   - Quick status check
   
   POST /api/reports/{report_id}/detect-tampering
   - Detailed tampering analysis
   - Returns: list of detected changes
   ```

5. **Audit Logging**
   - Every verification attempt logged
   - Tampering attempts flagged
   - Stale reports tracked

**Deliverables:**

1. `src/engine/reporting/integrity.py` — Integrity checker
2. `src/engine/reporting/models.py` — Updated with checksums
3. `src/api/endpoints/integrity.py` — Verification API
4. `src/database/schema_updates/integrity.sql` — Store checksums
5. Tests:
   - Checksum computation consistency
   - Modification detection
   - Stale detection
   - Tampering simulation and detection
6. Example: `examples/integrity_verification_example.md`
   ```markdown
   Report: pipe_stress_001_rev1
   
   Checksums (original):
   - Content: sha256:abc123...
   - Formulas: sha256:def456...
   - Template: sha256:ghi789...
   - Signatures: sha256:jkl012...
   
   Verification: ✓ ALL VALID
   
   Stale check: ✗ STALE
   - Calculation updated: 2026-05-08 15:30
   - Report generated: 2026-05-08 14:30
   - Recommendation: Regenerate report
   ```

**Success Criteria:**
- All checksums computed and verified
- Tampering detected reliably
- Stale detection working
- API endpoints operational
- Example shows real-world verification

---

### STAGE 7: REPORT SERIALIZATION HARDENING (1 week, 12h)

**Goal:** Handle large, complex reports without loss of data or corruption.

**Execution Plan:**

1. **Large Report Testing** (`tests/test_large_reports.py`)
   - Generate progressively larger reports:
     - Small: 50KB (typical calculation)
     - Medium: 500KB (complex multi-step)
     - Large: 5MB (10+ formulas, extensive audit)
     - Extreme: 50MB (streaming test)
   
   - Test matrix:
     - Nested audit appendices
     - Large execution traces (10K+ steps)
     - Large formula definitions
     - Unicode/special characters
     - Image insertion (future)

2. **Serialization Stability**
   - DOCX stream handling (not load entire file)
   - Memory-efficient rendering
   - Chunked writing for large sections
   - Verify no data loss (checksum before/after)

3. **Formula Rendering at Scale**
   - 100+ formulas in single report
   - Deeply nested expressions
   - Mixed Unicode (Latin/Cyrillic/Greek)
   - MathML rendering stability

4. **Audit Appendix Scaling**
   - 10K+ execution traces
   - 1K+ validation results
   - Efficient table rendering (not all rows load)
   - Pagination/sectioning

5. **DOCX Consistency**
   - Verify DOCX integrity after generation
   - Test opening in Word, LibreOffice, Google Docs
   - Check formatting preservation
   - Verify all cross-references valid

**Deliverables:**

1. `tests/test_large_reports.py` — Large report suite
2. `src/engine/reporting/streaming.py` — Streaming builder for large reports
3. `src/engine/reporting/unicode_handling.py` — Multilingual support
4. Performance benchmarks:
   - Time vs. report size
   - Memory usage vs. report size
   - Generate 50MB report without OOM
5. Compatibility tests:
   - Word 2016+
   - LibreOffice 7+
   - Google Docs
   - PDF conversion (via pandoc)
6. Test reports:
   - `examples/large_report_10MB.docx`
   - `examples/audit_appendix_10K_traces.docx`
   - `examples/unicode_mixed_formulas.docx`

**Success Criteria:**
- Handle 50MB reports without crashes
- <5min generation time for large reports
- 0 data loss in serialization
- All formatting preserved in DOCX
- Opens correctly in Word/LibreOffice/Google

---

### STAGE 8: REPORT TESTING COMPREHENSIVE SUITE (1.5 weeks, 18h)

**Goal:** Comprehensive test coverage for all reporting features.

**Execution Plan:**

1. **Unit Tests** (800+ assertions)
   - `test_data_extraction.py` — Data structure accuracy
   - `test_formula_rendering.py` — SymPy → LaTeX pipeline
   - `test_determinism.py` — Hash reproducibility
   - `test_normative_mapping.py` — Standard linkage
   - `test_signatures.py` — Signature chain logic
   - `test_integrity.py` — Checksum verification
   - `test_revisions.py` — Revision tracking

2. **Integration Tests** (100+ scenarios)
   - End-to-end: Calculate → Report → Verify
   - Revision workflow: Initial → Update → Diff
   - Signature workflow: Generate → Review → Approve → Verify
   - Integrity: Generate → Modify → Detect tampering
   - Stale detection: Update calculation → Verify report stale

3. **Property-Based Testing** (using Hypothesis)
   - For any valid input, report generation succeeds
   - Report hash is stable (generate 100x → same hash)
   - Revision diffs are accurate
   - Integrity checks are deterministic

4. **Edge Cases**
   - Zero values in calculations
   - Missing/null metadata
   - Extremely large numbers (1e20)
   - Extremely small numbers (1e-20)
   - Negative results
   - NaN/Inf values
   - Cyclic formula dependencies
   - Unicode edge cases (emoji, RTL, combining chars)

5. **Regression Tests**
   - Locked set of 50 calculations
   - Generate reports, hash them
   - Future runs: verify hash matches (detect any regression)

6. **Performance Tests**
   - Report generation time <500ms (typical)
   - Hash computation <50ms
   - Revision diff <100ms
   - Integrity verification <100ms

7. **Stress Tests**
   - Generate 1000 reports in sequence
   - 100 parallel generations
   - Database integrity under load
   - No hash collisions (1M+ reports)

**Deliverables:**

1. `tests/test_reporting_unit.py` — 350+ unit tests
2. `tests/test_reporting_integration.py` — 100+ integration tests
3. `tests/test_reporting_edge_cases.py` — Edge case coverage
4. `tests/test_reporting_regression.py` — Regression suite
5. `tests/test_reporting_performance.py` — Performance benchmarks
6. `tests/test_reporting_stress.py` — Stress testing
7. Test coverage report: >95% code coverage
8. Performance baseline: `PERFORMANCE_REPORT.md`
9. Test results summary: `TEST_RESULTS.md`

**Test Success Criteria:**
- All 1200+ tests passing
- >95% code coverage
- No memory leaks
- No data loss
- Performance targets met

---

## CROSS-STAGE DELIVERABLES

### Documentation (Ongoing)

1. **REPORT_INTEGRITY_REPORT.md** (after Stage 6)
   - Integrity verification framework
   - Checksum strategies
   - Tampering detection
   - Best practices

2. **REVISION_SYSTEM_REPORT.md** (after Stage 3)
   - Revision tracking design
   - Diff algorithms
   - Version history management
   - Use case examples

3. **NORMATIVE_TRACEABILITY_REPORT.md** (after Stage 4)
   - Standards database structure
   - Mapping strategy
   - Compliance verification
   - Standard updates process

4. **REPRODUCIBILITY_REPORT.md** (after Stage 2)
   - Deterministic generation strategies
   - Hash benchmarks
   - Variance analysis (1000+ runs)
   - Reproducibility guarantees

5. **REMAINING_WEAK_POINTS.md** (final)
   - Known limitations
   - Future enhancements
   - Performance optimization opportunities
   - Scalability considerations

### Example Reports

1. **Deterministic Report Example**
   - Same input, generated multiple times
   - Show identical hashes
   - Timeline of generations

2. **Revision Tracking Example**
   - Initial report
   - Input modification
   - Formula correction
   - Revision timeline + diffs

3. **Checksum Validation Example**
   - Report generated
   - Verify all checksums
   - Simulate tampering
   - Detection + analysis

4. **Normative Reference Example**
   - Real calculation (piping pressure)
   - Show ASME B31.4 references
   - Formula → standard mapping
   - Normative assumptions

5. **Engineering Signature Example**
   - Generated signature
   - Review signature (with findings)
   - Approval signature (with conditions)
   - Verification chain

6. **Integrity Verification Example**
   - Report generated + checksummed
   - Verify all checks pass
   - Show stale detection
   - Demonstrate tampering detection

7. **Report Lifecycle Diagram**
   ```
   Calculation Input
        ↓ [Validate]
   Audit Trail
        ↓ [Extract → Context]
   Report Context
        ↓ [Normalize → Render]
   Report Bytes
        ↓ [Hash → Store]
   Stored Report [Immutable]
        ↓ [Track Revisions]
   Report with Versions
        ↓ [Review → Approve]
   Report with Signatures
        ↓ [Verify → Archive]
   Archived Report [Auditable]
   ```

8. **Reproducibility Benchmark**
   - 1000 identical generations
   - Hash distribution analysis
   - Execution time variance
   - Platform independence verification

---

## IMPLEMENTATION STRATEGY

### Recommended Pace

| Week | Stage | Hours | Status |
|------|-------|-------|--------|
| 1 | Stage 1: Lifecycle | 12h | Foundation |
| 2 | Stage 2: Reproducibility | 12h | Core guarantee |
| 3 | Stage 3: Revisions | 18h | Version control |
| 4 | Stage 4: Normative | 18h | Traceability |
| 5 | Stage 5: Signatures | 18h | Auth foundation |
| 6 | Stage 6: Integrity | 12h | Verification |
| 7 | Stage 7: Serialization | 12h | Scale testing |
| 8 | Stage 8: Testing | 18h | Quality assurance |
| **Total** | | **120h** | |

### Dependencies & Critical Path

```
Stage 1 (Lifecycle)
    ↓
Stage 2 (Reproducibility) ← Prerequisite for integrity
    ↓
Stages 3, 4, 5 (Parallel)
    ├→ Stage 3 (Revisions)
    ├→ Stage 4 (Normative)
    └→ Stage 5 (Signatures)
    ↓
Stage 6 (Integrity) ← Depends on Stages 2, 3, 5
    ↓
Stage 7 (Serialization)
    ↓
Stage 8 (Testing) ← Integrates all stages
```

### Parallel Work Possible
- Stages 3, 4, 5 can run in parallel (independent features)
- Stage 7 can start after Stage 2 (determinism locked)
- Stage 8 can run concurrently with later stages (test-driven)

---

## SUCCESS CRITERIA (PHASE 2 COMPLETE)

**Architecture:**
- [ ] 8 stages implemented
- [ ] All core models designed
- [ ] All APIs defined and working
- [ ] Database schema updated

**Quality:**
- [ ] 1200+ tests passing
- [ ] >95% code coverage
- [ ] 0 data loss in any operation
- [ ] <5min to generate 50MB report

**Documentation:**
- [ ] 5 comprehensive reports
- [ ] 8 example demonstrations
- [ ] API reference complete
- [ ] Architecture locked (ready for production)

**Deliverables:**
1. ✅ Deterministic report example
2. ✅ Revision tracking example
3. ✅ Checksum validation example
4. ✅ Normative reference example
5. ✅ Engineering signature example
6. ✅ Integrity verification example
7. ✅ Report lifecycle diagram
8. ✅ Reproducibility benchmark

---

## RISK MITIGATION

| Risk | Mitigation |
|------|-----------|
| DOCX format corruption | Verify in Word/LibreOffice after each change |
| Hash collisions | Test with 1M+ reports, use SHA256 (cryptographic) |
| Performance regression | Benchmark each stage, track execution time |
| Data loss on serialize | Test large reports (50MB), verify checksums |
| Signature tampering | Use HMAC with salt, verify against report hash |
| Schema migration | Create/test migrations before production |
| Platform dependencies | Test on Windows/Linux/Mac |

---

## NEXT STEPS

1. **Confirm this plan** with user feedback
2. **Create detailed task breakdown** for each stage
3. **Estimate hours per task** more precisely
4. **Set up git branch** for Phase 2
5. **Begin Stage 1** (Lifecycle Integration)

---

**Plan Status:** Ready for implementation  
**Estimated Completion:** 8 weeks from start  
**Priority:** HIGH (critical path for production readiness)
