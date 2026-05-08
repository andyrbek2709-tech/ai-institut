# TRACEABILITY & CONSISTENCY REVIEW — Report Lifecycle Audit Trail

**Focus:** Ensuring audit trail integrity, event linkage, reproducibility verification  
**Status:** ⚠️ **SIGNIFICANT GAPS FOUND**

---

## EXECUTIVE SUMMARY

**Traceability Status:** 🔴 **INCOMPLETE**

**Current State:**
- ✅ Calculation audit trail is captured (from runner)
- ✅ Audit appendix is generated for DOCX
- ❌ Report lifecycle events are NOT recorded
- ❌ No linkage between report_id and audit events
- ❌ No reproducibility verification flow

**Critical Gap:**
Report generation has audit trail from *calculation*, but NOT from *report generation itself*. This breaks reproducibility verification in Stage 3.

---

## PART 1: AUDIT TRAIL ARCHITECTURE

### What We Have

**CalculationResult.audit_trail (from Runner)**
```python
# From calculation executor:
audit_trail = {
    "events": [
        {
            "event_type": "input_captured",
            "timestamp": "2026-05-08T14:00:00Z",
            "value": 5.0,
        },
        {
            "event_type": "formula_executed",
            "timestamp": "2026-05-08T14:00:00Z",
            "formula": "(P * (D - 2*t)) / (2 * t)",
            "result": 45.2,
        },
        {
            "event_type": "validation_checked",
            "timestamp": "2026-05-08T14:00:00Z",
            "rule": "hoop_stress_limit",
            "status": "FAILED",
        }
    ]
}
```

**Copied to ReportContext (data_extractor.py:85)**
```python
context.audit_trail = calculation_result.audit_trail  # ✅ Direct copy
```

**Rendered in DOCX (audit_appendix.py)**
```python
# AuditAppendixBuilder._build_execution_traces(context):
for trace in context.execution_traces:  # Uses context.execution_traces
    # ... render to DOCX ...
```

### What We're Missing

**ReportLifecycleMetadata (lifecycle.py)**
```python
@dataclass
class ReportLifecycleMetadata:
    report_id: str
    calculation_id: str
    context: ReportGenerationContext
    events: list[ReportLifecycleEvent] = field(default_factory=list)  # ← Empty!
    audit_events: list[str] = field(default_factory=list)  # ← Empty!
```

**Should Contain:**
```python
events = [
    ReportLifecycleEvent(
        stage=ReportLifecycleStage.CONTEXT_BUILDING,
        timestamp="2026-05-08T14:30:00Z",
        duration_ms=125.3,
        generator_id="runner",
    ),
    ReportLifecycleEvent(
        stage=ReportLifecycleStage.IDENTITY_GENERATED,
        timestamp="2026-05-08T14:30:01Z",
        duration_ms=45.2,
        generator_id="runner",
        metadata={
            "report_id": "rpt_calc_001_abc123_def456_piping",
            "inputs_hash": "abc123...",
            "identity_hash": "xyz789...",
        }
    ),
    # ... more events ...
]
```

**But NEVER POPULATED because:**
- ❌ ReportLifecycleManager is never called from data_extractor
- ❌ No start_stage() called when extraction begins
- ❌ No end_stage() called when extraction completes
- ❌ No link_audit_events() called

---

## PART 2: TRACEABILITY GAPS ANALYSIS

### Gap 1: Report Generation Timeline Lost

**Expected (Design):**
```
2026-05-08T14:30:00.000Z: CONTEXT_BUILDING starts
  ├─ Extract inputs
  ├─ Extract results
  ├─ Extract validation
  └─ Build ReportContext
2026-05-08T14:30:00.125Z: CONTEXT_BUILDING completes (125ms)

2026-05-08T14:30:00.200Z: IDENTITY_GENERATED starts
  ├─ Compute inputs_hash
  ├─ Compute formula_hash
  ├─ Compute identity_hash
  └─ Generate report_id
2026-05-08T14:30:00.245Z: IDENTITY_GENERATED completes (45ms)

2026-05-08T14:30:00.300Z: DOCUMENT_RENDERING starts
  ├─ Build DOCX structure
  ├─ Render formulas
  ├─ Render audit appendix
  └─ Save to bytes
2026-05-08T14:30:00.450Z: DOCUMENT_RENDERING completes (150ms)

2026-05-08T14:30:00.450Z: LIFECYCLE_REGISTERED
  └─ Report stored and indexed
```

**Actual (Reality):**
```
2026-05-08T14:30:00.000Z: ReportDataExtractor.extract_context() called
  # No event recorded
  # No timing tracked
  # No stage marker

2026-05-08T14:30:00.200Z: DocxReportBuilder.build_report() called
  # No event recorded
  # No timing tracked
  # No stage marker

# No ReportLifecycleMetadata at all! ❌
```

**Impact:**
- Cannot answer: "When was this report generated?"
- Cannot answer: "How long did report generation take?"
- Cannot answer: "Which stage had a problem if generation failed?"
- Cannot debug performance issues

### Gap 2: No Linkage Between Calculation and Report

**Current State:**

```python
# CalculationResult (from runner)
├─ calculation_id: "calc_001"
├─ audit_trail: {...events from calculation...}
└─ metadata: {...execution details...}

# ReportContext (generated)
├─ calculation_id: "calc_001"  (✅ Same)
├─ report_id: None  (❌ Should be generated!)
├─ audit_trail: {...same as CalculationResult...}  (✅ Copied)
└─ generated_timestamp: None  (❌ Should be set!)

# ReportLifecycleMetadata (should exist but doesn't)
├─ report_id: None  (❌ Never set!)
├─ calculation_id: None  (❌ Never set!)
├─ events: []  (❌ Never populated!)
└─ audit_events: []  (❌ Never linked!)
```

**Problem:** Multiple representations of same data with no linking:
- Can't query: "Which reports were generated from calculation X?"
- Can't query: "What was the timeline of report generation for calculation X?"
- Can't verify: "Is this report the original or a revised version?"

### Gap 3: No Reproducibility Verification Path

**Stage 3 Will Need:**
> "Verify that report matches original calculation and template"

**Current Architecture Cannot Support This Because:**

1. ❌ report_id is not available to verification code
2. ❌ identity_hash is not stored in DOCX metadata
3. ❌ No way to extract report_id from DOCX
4. ❌ No way to get ReportLifecycleMetadata for verification
5. ❌ No verification trail (verify_identity in report_identity.py exists but never called)

**Verification Flow (Designed in Stage 3):**

```
DOCX file with embedded identity metadata
  ├─ Extract report_id from metadata
  ├─ Extract identity_hash from metadata
  ├─ Query ReportLifecycleMetadata(report_id)
  ├─ Get original CalculationResult(calculation_id)
  ├─ Recompute identity_hash from original
  ├─ Compare: stored_hash == computed_hash → VALID/INVALID
  └─ Check ReportLifecycleMetadata for integrity markers
```

**Current Implementation:**
- ✅ ReportIdentityGenerator.verify_identity() exists
- ✅ Hashing logic is sound
- ❌ BUT: No lifecycle metadata stored → verification impossible!

---

## PART 3: DETAILED TRACEABILITY FLOW DIAGRAMS

### Missing Flow 1: Event Recording

**Should Happen:**
```python
# In report generation pipeline:

def generate_report(calculation_result, calculation_id, template_data):
    manager = get_lifecycle_manager()
    
    # Initialize generation
    lifecycle_context = manager.initialize_generation(
        calculation_id=calculation_id,
        calculation_result=calculation_result,
        template_type="piping",
        generator_id="runner",
    )
    
    # Extract context (track this stage)
    t0 = manager.start_stage(
        report_id="TBD_will_compute_during_extraction",  # ← Problem: don't have ID yet!
        stage=ReportLifecycleStage.CONTEXT_BUILDING,
    )
    context = ReportDataExtractor.extract_context(
        calculation_result=calculation_result,
        calculation_id=calculation_id,
        template_data=template_data,
    )
    manager.end_stage(
        report_id=context.report_id,  # ← Now have ID
        calculation_id=calculation_id,
        stage=ReportLifecycleStage.CONTEXT_BUILDING,
        start_time=t0,
        context=lifecycle_context,
    )
    
    # ... more stages ...
    
    return context
```

**Current Reality:**
```python
def generate_report(calculation_result, calculation_id, template_data):
    context = ReportDataExtractor.extract_context(
        calculation_result=calculation_result,
        calculation_id=calculation_id,
        template_data=template_data,
    )
    # ← No lifecycle tracking at all
    
    report_bytes = DocxReportBuilder().build_report(context)
    # ← No lifecycle tracking at all
    
    return report_bytes
```

**Problem:** Chicken-and-egg - need report_id before tracking starts, but report_id not generated until extraction completes.

### Missing Flow 2: Audit Event Linkage

**Should Happen:**
```python
# After report generation completes:

manager = get_lifecycle_manager()
lifecycle_metadata = manager.get_lifecycle_metadata(report_id)

# Link calculation audit events to report
audit_event_ids = [
    f"{calculation_id}:event_0",
    f"{calculation_id}:event_1",
    f"{calculation_id}:event_2",
    # ... etc ...
]
manager.link_audit_events(report_id, audit_event_ids)

# Result: lifecycle_metadata.audit_events contains references to calculation events
```

**Current Reality:**
- ❌ lifecycle_manager.link_audit_events() exists but is NEVER called
- ❌ No mechanism to store references between report and calculation audit events

---

## PART 4: CONSISTENCY ANALYSIS

### Consistency Issue 1: Timestamp Consistency

**CalculationResult:**
```python
calculation_result.timestamp = "2026-05-08T14:00:00Z"  # When calculation was executed
calculation_result.metadata["execution_time_ms"] = 45.2  # How long it took
```

**ReportContext (during extraction):**
```python
context.timestamp = datetime.now(timezone.utc).isoformat()  # When report was generated
# ← Different timestamp than calculation!
```

**ReportLifecycleMetadata (if existed):**
```python
context.generated_timestamp = "2026-05-08T14:30:00Z"  # When report was generated
```

**Problem:** Multiple timestamps, unclear which is "truth":
- calculation.timestamp (calculation execution)
- context.timestamp (report extraction time)
- lifecycle.generated_timestamp (report generation start)
- lifecycle_event.timestamp (individual stage time)

**In Stage 3 Audit:**
- Should report be locked to calculation timestamp?
- Or tracked separately from calculation?
- Current: Ambiguous

### Consistency Issue 2: Validation Status Tracking

**CalculationResult:**
```python
calculation_result.status = "success"  # OR "warning" OR "error"
calculation_result.validation_results = [...]  # List of ValidationResult objects
```

**ReportContext:**
```python
context.validation_status = calculation_result.status  # ✅ Copied
context.validation_results = [...]  # ✅ Extracted
```

**ReportLifecycleMetadata:**
```python
context.validation_status = "unknown"  # ❌ Hardcoded default, never set!
```

**Problem:** Lifecycle metadata doesn't track validation status, breaking consistency checks.

---

## PART 5: FAILURE SCENARIO ANALYSIS

### Scenario 1: Report Generation Fails During DOCX Building

**Expected (with proper lifecycle):**
```
1. CONTEXT_BUILDING: 125ms ✅
2. IDENTITY_GENERATED: 45ms ✅
3. DOCUMENT_RENDERING: starts 14:30:00.450Z
   │
   ├─ Add title page: OK
   ├─ Add normative references: OK
   ├─ Add inputs: OK
   ├─ Add formulas: CRASH ❌ (SymPy rendering failed)
   │
4. DOCUMENT_RENDERING: ends 14:30:00.523Z with ERROR
   Error: "ValueError: Invalid formula expression"
   
Lifecycle metadata shows:
- Which stage failed (DOCUMENT_RENDERING)
- How far it got (123ms before failure)
- What error occurred
- Calculation is still marked as successful (different from report failure)
```

**Actual (no lifecycle):**
```
report_bytes = DocxReportBuilder().build_report(context)
# → Raises ValueError
# No context about which stage, how long, etc.
```

### Scenario 2: Verification in Stage 3

**Expected (with proper lifecycle):**
```python
# Stage 3 integrity verification:

stored_identity_hash = extract_from_docx("identity_hash")  # "xyz789..."
report_id = extract_from_docx("report_id")  # "rpt_calc_001_..."

# Get lifecycle metadata
lifecycle = manager.get_lifecycle_metadata(report_id)
assert lifecycle.context.calculation_id == "calc_001"
assert lifecycle.current_stage == ReportLifecycleStage.LIFECYCLE_REGISTERED

# Recompute identity
original_result = get_calculation(lifecycle.context.calculation_id)
recomputed_identity = ReportIdentityGenerator.generate_identity(...)
assert recomputed_identity.identity_hash == stored_identity_hash  # Verified!
```

**Actual (no lifecycle metadata):**
```python
# Stage 3: Can't verify because:
# 1. report_id might not be in DOCX (context.report_id = None!)
# 2. No way to get lifecycle metadata
# 3. No verification trail
# 4. verification fails immediately
```

---

## PART 6: REPRODUCIBILITY VERIFICATION PATH

### Current Capability: NONE ❌

**Code to Support Reproducibility:**
- ✅ ReportIdentityGenerator.generate_identity() - implemented
- ✅ ReportIdentityGenerator.verify_identity() - implemented
- ❌ **NEVER CALLED** - no entry point

**Code to Support Traceability:**
- ✅ ReportLifecycleManager - implemented
- ✅ ReportLifecycleEvent - dataclass defined
- ❌ **NEVER USED** - no integration

### What's Needed

**1. Event Recording Entry Point:**
```python
# In data_extractor.py or wherever report generation starts:

def extract_context(...):
    manager = get_lifecycle_manager()
    
    # Start stage
    stage_start = manager.start_stage(
        report_id="temp_id",  # ← Problem: need ID first
        stage=ReportLifecycleStage.CONTEXT_BUILDING,
    )
    
    # ... build context ...
    
    manager.end_stage(
        report_id=final_id,
        # ... other params ...
    )
```

**2. Identity in DOCX Metadata:**
```python
# In docx_builder.py:

def build_report(context):
    doc = Document()
    
    # Embed identity in core properties (searchable)
    doc.core_properties.title = context.title
    doc.core_properties.subject = f"Report: {context.report_id}"
    doc.core_properties.comments = json.dumps({
        "report_id": context.report_id,
        "identity_hash": context.identity_hash,
        "inputs_hash": context.inputs_hash,
        "formula_hash": context.formula_hash,
        "calculation_id": context.calculation_id,
    })
    
    # ... rest of DOCX building ...
```

**3. Verification API:**
```python
# New module: report_verification.py

def verify_report_integrity(docx_bytes, original_calculation_result):
    """
    Verify that DOCX report matches original calculation.
    """
    # Extract identity from DOCX
    doc = Document(io.BytesIO(docx_bytes))
    metadata = json.loads(doc.core_properties.comments)
    stored_identity_hash = metadata["identity_hash"]
    
    # Recompute identity
    recomputed = ReportIdentityGenerator.generate_identity(
        calculation_id=metadata["calculation_id"],
        calculation_result=original_calculation_result,
        # ...
    )
    
    # Verify
    is_valid = stored_identity_hash == recomputed.identity_hash
    return {
        "valid": is_valid,
        "stored_hash": stored_identity_hash,
        "computed_hash": recomputed.identity_hash,
        "mismatch": not is_valid,
    }
```

---

## PART 7: RECOMMENDATIONS

### Immediate Fixes (Required for Stage 1)

**1. Integrate Lifecycle Tracking**

```python
# In data_extractor.py, refactor extract_context:

def extract_context(
    calculation_result: CalculationResult,
    calculation_id: str,
    template_data: Optional[Dict[str, Any]] = None,
    generator_id: str = "runner",
) -> ReportContext:
    
    manager = get_lifecycle_manager()
    
    # Initialize (this creates ReportGenerationContext)
    lifecycle_context = manager.initialize_generation(...)
    
    # Generate identity (needed for report_id before event recording)
    identity = ReportIdentityGenerator.generate_identity(...)
    
    # Record stages
    t_context = manager.start_stage(
        report_id=identity.report_id,
        stage=ReportLifecycleStage.CONTEXT_BUILDING,
    )
    # ... do extraction ...
    manager.end_stage(
        report_id=identity.report_id,
        calculation_id=calculation_id,
        stage=ReportLifecycleStage.CONTEXT_BUILDING,
        start_time=t_context,
        context=lifecycle_context,
    )
    
    # Build and populate context with identity
    context = ReportContext(
        # ... existing fields ...
        report_id=identity.report_id,
        identity_hash=identity.identity_hash,
    )
    
    return context
```

**2. Embed Identity in DOCX Metadata**

```python
# In docx_builder.py, add metadata section:

def _add_system_info(self, context: ReportContext):
    # ... existing code ...
    
    # Add report identity section
    self.doc.add_heading("Report Identity & Verification", level=3)
    self.doc.add_paragraph(f"Report ID: {context.report_id}")
    self.doc.add_paragraph(f"Identity Hash: {context.identity_hash}")
    
    # Store in core properties for machine readability
    self.doc.core_properties.comments = json.dumps({
        "report_id": context.report_id,
        "identity_hash": context.identity_hash,
        "inputs_hash": context.inputs_hash,
        "formula_hash": context.formula_hash,
        "calculation_id": context.calculation_id,
    })
```

**3. Link Audit Events**

```python
# After report generation:

def complete_report_generation(report_context, docx_bytes):
    manager = get_lifecycle_manager()
    
    # Link audit events from calculation to report
    if report_context.audit_trail:
        audit_event_ids = [
            f"{report_context.calculation_id}:audit_{i}"
            for i in range(len(report_context.audit_trail.get("events", [])))
        ]
        manager.link_audit_events(
            report_id=report_context.report_id,
            audit_event_ids=audit_event_ids,
        )
```

### Future Enhancements (Stage 2-3)

**1. Persistence Layer**
- Store ReportLifecycleMetadata in database
- Query API for lifecycle history
- Audit trail archive

**2. Verification API**
- verify_report_integrity(docx_bytes, original_result)
- Compare stored vs. recomputed identity hashes
- Detect tampering or modification

**3. Reproducibility Verification**
- Regenerate report from original calculation
- Compare reports (byte-for-byte or content-for-content)
- Mark revisions clearly in lifecycle

---

## SUMMARY

| Aspect | Current | Needed | Status |
|--------|---------|--------|--------|
| Calculation audit trail | ✅ Captured | ✅ | Good |
| Report lifecycle events | ❌ None | ✅ | Missing |
| Audit event linkage | ❌ None | ✅ | Missing |
| Timestamp consistency | ⚠️ Multiple | ✅ Standardized | Needs work |
| Report identity in DOCX | ❌ None | ✅ Embedded | Missing |
| Verification path | ❌ None | ✅ API ready | Missing integration |
| Reproducibility tracking | ❌ None | ✅ Design ready | Missing |

**Total Effort to Fix:** ~5 hours

**Criticality:** 🔴 **CRITICAL** for Stage 2-3 success

