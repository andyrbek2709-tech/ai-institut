# REQUIRED FIXES FOR STAGE 2 READINESS

**Date:** 2026-05-08  
**Target:** Unblock progress from Revalidation Gate to Stage 2  
**Total Effort:** ~25-30 hours  
**Blockers:** Fixes 7-8 (persistent storage must be in place)

---

## FIX 1: Remove Generator_ID from Identity Hash

**File:** `services/calculation-engine/src/engine/reporting/report_identity.py`  
**Lines:** 154-179

**Current Code:**
```python
@staticmethod
def compute_generation_hash(
    engine_version: str,
    runner_version: str,
    template_version: str,
    generator_id: str,  # ← REMOVE
) -> str:
    generation_data = {
        "engine_version": engine_version,
        "runner_version": runner_version,
        "template_version": template_version,
        "generator_id": generator_id,  # ← REMOVE
    }
    return ReportIdentityGenerator._hash_dict(generation_data)
```

**Required Change:**
```python
@staticmethod
def compute_generation_hash(
    engine_version: str,
    runner_version: str,
    template_version: str,
    # generator_id: str,  ← REMOVE parameter
) -> str:
    generation_data = {
        "engine_version": engine_version,
        "runner_version": runner_version,
        "template_version": template_version,
        # "generator_id": generator_id,  ← REMOVE from hash
    }
    return ReportIdentityGenerator._hash_dict(generation_data)
```

**Also update:**
```python
# Line 286-291
generation_hash = ReportIdentityGenerator.compute_generation_hash(
    engine_version=context.engine_version,
    runner_version=context.runner_version,
    template_version=context.template_version,
    # generator_id=context.generator_id,  ← REMOVE
)
```

**Rationale:**
- Generator ID is operational context, not semantic content
- Same calculation should have same identity regardless of who runs it
- Prevents "different generator → different hash" problem

**Testing:**
```python
# Test: Same inputs, different generators → same identity
gen1 = pipeline.execute(calc_id="c1", generator_id="api_v1")
gen2 = pipeline.execute(calc_id="c1", generator_id="batch_job")
assert gen1.identity.identity_hash == gen2.identity.identity_hash  # Must pass
```

---

## FIX 2: Remove Execution Time from Identity Hash

**File:** `services/calculation-engine/src/engine/reporting/report_identity.py`  
**Lines:** 88-113

**Current Code:**
```python
@staticmethod
def compute_execution_hash(
    execution_time_ms: Optional[float],
    validation_status: str,
    num_validations: int
) -> str:
    context = {
        "validation_status": validation_status,
        "num_validations": num_validations,
    }
    if execution_time_ms is not None:
        # Round to nearest millisecond for reproducibility
        context["execution_time_ms"] = round(execution_time_ms)  # ← REMOVE

    return ReportIdentityGenerator._hash_dict(context)
```

**Required Change:**
```python
@staticmethod
def compute_execution_hash(
    execution_time_ms: Optional[float],  # Keep parameter for compatibility
    validation_status: str,
    num_validations: int
) -> str:
    """
    Compute execution context hash (deterministic parts only).
    
    Note: execution_time_ms is deliberately NOT included because:
    - Execution time varies with system load
    - It's operational context, not semantic
    - Including it breaks determinism guarantee
    """
    context = {
        "validation_status": validation_status,
        "num_validations": num_validations,
        # execution_time_ms removed (not deterministic)
    }
    return ReportIdentityGenerator._hash_dict(context)
```

**Rationale:**
- System load varies → execution time varies
- Execution time is not part of calculation semantics
- Prevents "same inputs, different load → different hash" problem

**Testing:**
```python
# Test: Same inputs, different execution times → same identity
hash1 = compute_execution_hash(execution_time_ms=45.2, validation_status="success", num_validations=5)
hash2 = compute_execution_hash(execution_time_ms=67.8, validation_status="success", num_validations=5)
assert hash1 == hash2  # Must pass
```

---

## FIX 3: Compute Lifecycle Hash After Full Generation

**File:** `services/calculation-engine/src/engine/reporting/pipeline.py`  
**Lines:** 129-181

**Current Code:**
```python
# STAGE 3: Generate deterministic identity (early, incomplete)
identity_start = time.time()
identity = self.identity_generator.generate_identity(
    calculation_id=calculation_id,
    calculation_result=calculation_result,
    context=generation_context,
    template_definition=None,
)

# ... document rendering ...

# STAGE 7: Record lifecycle - no re-computation of identity
lifecycle_rendering_end = self.lifecycle_manager.end_stage(
    report_id=identity.report_id,
    calculation_id=calculation_id,
    stage=ReportLifecycleStage.DOCUMENT_RENDERING,
    # ... no identity update ...
)
```

**Required Change:**
```python
# STAGE 3: Generate preliminary identity
identity_start = time.time()
identity = self.identity_generator.generate_identity(
    calculation_id=calculation_id,
    calculation_result=calculation_result,
    context=generation_context,
    template_definition=None,
)

# Store preliminary lifecycle hash for comparison
preliminary_lifecycle_hash = identity.lifecycle_hash

# ... document rendering ...

# STAGE 7: Record lifecycle AND re-compute identity
lifecycle_rendering_end = self.lifecycle_manager.end_stage(
    report_id=identity.report_id,
    calculation_id=calculation_id,
    stage=ReportLifecycleStage.DOCUMENT_RENDERING,
    start_time=rendering_start,
    context=generation_context,
    metadata={"docx_size_bytes": len(report_bytes)},
)

# STAGE 8: RE-COMPUTE lifecycle hash with actual event count
lifecycle_metadata = self.lifecycle_manager.get_lifecycle_metadata(identity.report_id)
if lifecycle_metadata and len(lifecycle_metadata.events) > 0:
    # Recompute with actual lifecycle structure
    actual_lifecycle_hash = ReportIdentityGenerator.compute_lifecycle_hash(
        num_stages=len(lifecycle_metadata.events),
        num_events=len(lifecycle_metadata.events),
        final_stage=lifecycle_metadata.current_stage.value,
    )
    
    # Update identity with actual hash
    identity.lifecycle_hash = actual_lifecycle_hash
    
    # Recompute combined identity hash
    all_hashes = [
        identity.inputs_hash,
        identity.formula_hash,
        identity.execution_hash,
        identity.semantic_hash,
        identity.template_hash,
        identity.generation_hash,
        actual_lifecycle_hash,
    ]
    identity_components = "".join(all_hashes)
    identity.identity_hash = hashlib.sha256(identity_components.encode()).hexdigest()
    
    logger.info(
        f"[STAGE: LIFECYCLE_HASH_RECOMPUTED] "
        f"Updated lifecycle_hash from {preliminary_lifecycle_hash[:16]}... "
        f"to {actual_lifecycle_hash[:16]}..."
    )
```

**Rationale:**
- Lifecycle is not complete when identity computed
- Identity hash must reflect actual generated state
- Prevents "stale hash" problem

**Testing:**
```python
# Test: Lifecycle hash changes after full generation
identity_before = identity.lifecycle_hash
# ... full pipeline execution ...
identity_after = identity.lifecycle_hash
# They should differ (before is placeholder, after is actual)
assert identity_before != identity_after
```

---

## FIX 4: Normalize Optional Values in Canonical Serialization

**File:** `services/calculation-engine/src/engine/reporting/deterministic_hashing.py`  
**Lines:** 43-77

**Current Code:**
```python
@staticmethod
def canonicalize_value(value: Any) -> Any:
    if value is None:
        return DeterministicHasher.NONE_MARKER

    if isinstance(value, float):
        normalized = DeterministicHasher.normalize_float(value)
        return normalized if normalized is not None else DeterministicHasher.NONE_MARKER

    if isinstance(value, dict):
        if not value:
            return DeterministicHasher.EMPTY_DICT_MARKER
        return {k: DeterministicHasher.canonicalize_value(v) for k, v in sorted(value.items())}
    
    # ... rest
```

**Required Change:**
```python
@staticmethod
def canonicalize_value(value: Any) -> Any:
    """
    Convert value to canonical form for stable hashing.
    
    Ensures:
    - None, {}, [] are handled consistently
    - Optional fields don't change dict structure
    - Nested values are recursively canonicalized
    """
    if value is None:
        return DeterministicHasher.NONE_MARKER

    if isinstance(value, float):
        normalized = DeterministicHasher.normalize_float(value)
        return normalized if normalized is not None else DeterministicHasher.NONE_MARKER

    if isinstance(value, dict):
        if not value:  # Empty dict
            return DeterministicHasher.EMPTY_DICT_MARKER
        # Always sort keys and recursively canonicalize all values
        canonical_dict = {}
        for k in sorted(value.keys()):
            canonical_dict[k] = DeterministicHasher.canonicalize_value(value[k])
        return canonical_dict

    if isinstance(value, (list, tuple)):
        if not value:  # Empty list/tuple
            return DeterministicHasher.EMPTY_LIST_MARKER
        # Recursively canonicalize all elements, preserve order
        return [DeterministicHasher.canonicalize_value(v) for v in value]

    if isinstance(value, str):
        # Normalize whitespace: collapse multiple spaces, strip
        return " ".join(value.split())
    
    if isinstance(value, bool):
        # Explicit handling for bool (before int check)
        return value
    
    if isinstance(value, int):
        return value

    # For other types, convert to string
    return str(value)
```

**Also update execution_hash computation:**
```python
@staticmethod
def compute_execution_hash(
    execution_time_ms: Optional[float],
    validation_status: str,
    num_validations: int
) -> str:
    context = {
        "validation_status": validation_status,
        "num_validations": num_validations,
        # Always include execution_time_ms (even if None) for consistent dict structure
        "execution_time_ms": round(execution_time_ms) if execution_time_ms else "__NONE__",
    }
    return ReportIdentityGenerator._hash_dict(context)
```

**Rationale:**
- Optional fields should NOT change dict structure
- Explicit None markers ensure consistent hashing
- Nested canonicalization prevents hidden issues

**Testing:**
```python
# Test: Different structures hash identically
h1 = DeterministicHasher.hash_canonical({"rules": None})
h2 = DeterministicHasher.hash_canonical({"rules": "__NONE__"})
assert h1 == h2  # Must pass

# Test: Optional field presence doesn't change hash
context1 = {"status": "ok", "time": 50}
context2 = {"status": "ok", "time": "__NONE__"}
h1 = DeterministicHasher.hash_canonical(context1)
h2 = DeterministicHasher.hash_canonical(context2)
# Different values are OK (they should hash differently)
# But same structure is guaranteed
```

---

## FIX 5: Fail Fast on Input Extraction Errors

**File:** `services/calculation-engine/src/engine/reporting/report_identity.py`  
**Lines:** 237-268

**Current Code:**
```python
# Extract inputs from calculation result
inputs = {}
if hasattr(calculation_result, 'metadata') and isinstance(calculation_result.metadata, dict):
    inputs = calculation_result.metadata.get('inputs', {})
    
# ... no error if inputs are missing ...
```

**Required Change:**
```python
# Extract inputs from calculation result - FAIL FAST if missing
try:
    if not hasattr(calculation_result, 'metadata'):
        raise ValueError(
            f"[IDENTITY] CalculationResult {calculation_id} missing 'metadata' attribute"
        )
    
    if not isinstance(calculation_result.metadata, dict):
        raise ValueError(
            f"[IDENTITY] CalculationResult {calculation_id} metadata is not a dict, "
            f"got {type(calculation_result.metadata)}"
        )
    
    inputs = calculation_result.metadata.get('inputs')
    if inputs is None:
        raise ValueError(
            f"[IDENTITY] CalculationResult {calculation_id} missing 'inputs' in metadata"
        )
    
    if not isinstance(inputs, dict):
        raise ValueError(
            f"[IDENTITY] CalculationResult {calculation_id} inputs is not a dict, "
            f"got {type(inputs)}"
        )
    
except (AttributeError, TypeError, ValueError) as e:
    logger.error(f"[IDENTITY] Critical: Failed to extract inputs: {e}")
    raise RuntimeError(f"Cannot generate identity for {calculation_id}: {e}") from e
```

**Also apply to formula and semantic_rules extraction:**
```python
# Formula extraction
try:
    formula = calculation_result.metadata.get('formula')
    if not formula or not isinstance(formula, str):
        raise ValueError(
            f"[IDENTITY] CalculationResult {calculation_id} has invalid formula: {formula}"
        )
except Exception as e:
    logger.error(f"[IDENTITY] Critical: Failed to extract formula: {e}")
    raise RuntimeError(f"Cannot generate identity for {calculation_id}: {e}") from e
```

**Rationale:**
- Silent failures hide bugs
- Identity errors should fail fast, not silently wrong
- Prevents undetectable data corruption

**Testing:**
```python
# Test: Missing inputs raises error
bad_result = CalculationResult(metadata={})  # No 'inputs'
try:
    identity = generate_identity("test", bad_result, context)
    assert False, "Should have raised error"
except RuntimeError as e:
    assert "inputs" in str(e)  # Must pass
```

---

## FIX 6: Verify Identity After Full Generation

**File:** `services/calculation-engine/src/engine/reporting/pipeline.py`  
**Lines:** 250-278

**Current Code:**
```python
# STAGE 10: Create response (no verification)
metadata = ReportMetadata(
    report_id=identity.report_id,
    ...
)

response = ReportGenerationResponse(
    report_id=identity.report_id,
    ...
)

return response, identity, report_context
```

**Required Change:**
```python
# STAGE 9: Verify identity stability
verification_start = time.time()

is_valid, verification_error = self.verify_determinism(
    calculation_id=calculation_id,
    calculation_result=calculation_result,
    original_identity=identity,
    generation_context=generation_context,
)

if not is_valid:
    logger.error(
        f"[PIPELINE] Identity verification FAILED: {verification_error} "
        f"for report {identity.report_id}"
    )
    # Record verification failure in lifecycle
    self.lifecycle_manager.end_stage(
        report_id=identity.report_id,
        calculation_id=calculation_id,
        stage=ReportLifecycleStage.VERIFICATION_READY,
        start_time=verification_start,
        context=generation_context,
        error=verification_error,
    )
    raise RuntimeError(
        f"Report identity verification failed: {verification_error}. "
        f"This indicates non-deterministic generation."
    )

logger.info(
    f"[STAGE: VERIFICATION_COMPLETE] Identity verified for {identity.report_id}"
)

# Record verification success
self.lifecycle_manager.end_stage(
    report_id=identity.report_id,
    calculation_id=calculation_id,
    stage=ReportLifecycleStage.VERIFICATION_READY,
    start_time=verification_start,
    context=generation_context,
)

# STAGE 10: Create response
metadata = ReportMetadata(
    report_id=identity.report_id,
    ...
)

response = ReportGenerationResponse(
    report_id=identity.report_id,
    ...
)

return response, identity, report_context
```

**Rationale:**
- Verification gate ensures identity is stable
- Catches bugs early (before persistence)
- Prevents unreproducible reports from being saved

**Testing:**
```python
# Test: Verification catches non-determinism
# (Should fail if Fix 1-4 not applied)
try:
    response, identity, context = pipeline.execute(...)
    # Should only reach here if verification passed
    assert identity.identity_hash is not None
except RuntimeError as e:
    assert "verification failed" in str(e)
```

---

## FIX 7: Implement Persistent Storage (PostgreSQL)

**File:** Create `services/calculation-engine/src/engine/reporting/lifecycle_persistence_postgres.py`

**New Implementation:**
```python
"""Persistent lifecycle storage using PostgreSQL."""

import logging
from typing import Optional, Dict, List, Any
from datetime import datetime, timezone
from src.database import get_supabase_client
from .lifecycle import ReportLifecycleMetadata, ReportLifecycleEvent

logger = logging.getLogger(__name__)

class PostgresLifecyclePersistenceStore:
    """Stores and retrieves report lifecycle metadata using PostgreSQL."""
    
    def __init__(self, db_client=None):
        """Initialize with Supabase client."""
        self._db = db_client or get_supabase_client()
        self._ensure_tables_exist()
    
    def _ensure_tables_exist(self):
        """Create tables if they don't exist."""
        # SQL would be in a migration file
        # Tables:
        # - report_lifecycle_metadata
        # - report_lifecycle_events
        pass
    
    def save_lifecycle_metadata(
        self,
        report_id: str,
        calculation_id: str,
        lifecycle_metadata: ReportLifecycleMetadata
    ) -> bool:
        """Persist lifecycle metadata to database."""
        try:
            # Insert metadata record
            self._db.table('report_lifecycle_metadata').insert({
                'report_id': lifecycle_metadata.report_id,
                'calculation_id': lifecycle_metadata.calculation_id,
                'current_stage': lifecycle_metadata.current_stage.value,
                'total_generation_time_ms': lifecycle_metadata.total_generation_time_ms,
                'is_stale': lifecycle_metadata.is_stale,
                'is_verified': lifecycle_metadata.is_verified,
                'parent_report_id': lifecycle_metadata.parent_report_id,
                'persisted_at': datetime.now(timezone.utc).isoformat(),
            }).execute()
            
            # Insert individual events
            for event in lifecycle_metadata.events:
                self._db.table('report_lifecycle_events').insert({
                    'report_id': lifecycle_metadata.report_id,
                    'stage': event.stage.value,
                    'timestamp': event.timestamp,
                    'duration_ms': event.duration_ms,
                    'generator_id': event.generator_id,
                    'error_message': event.error_message,
                    'metadata': event.metadata,
                }).execute()
            
            logger.info(f"[PERSISTENCE] Saved lifecycle for {report_id}")
            return True
        
        except Exception as e:
            logger.error(f"[PERSISTENCE] Failed to save {report_id}: {e}")
            return False
    
    def get_lifecycle_metadata(self, report_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve lifecycle metadata from database."""
        try:
            response = self._db.table('report_lifecycle_metadata').select('*').eq(
                'report_id', report_id
            ).execute()
            
            if not response.data:
                return None
            
            metadata = response.data[0]
            
            # Load events
            events_response = self._db.table('report_lifecycle_events').select('*').eq(
                'report_id', report_id
            ).execute()
            
            metadata['events'] = events_response.data or []
            return metadata
        
        except Exception as e:
            logger.error(f"[PERSISTENCE] Failed to retrieve {report_id}: {e}")
            return None
    
    # ... implement other methods similarly ...
```

**Database Schema Migration:**

```sql
-- Create lifecycle metadata table
CREATE TABLE IF NOT EXISTS report_lifecycle_metadata (
    report_id TEXT PRIMARY KEY,
    calculation_id TEXT NOT NULL,
    current_stage TEXT NOT NULL,
    total_generation_time_ms FLOAT NOT NULL,
    is_stale BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    parent_report_id TEXT,
    persisted_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    FOREIGN KEY (calculation_id) REFERENCES calculations(id)
);

-- Create lifecycle events table
CREATE TABLE IF NOT EXISTS report_lifecycle_events (
    id BIGSERIAL PRIMARY KEY,
    report_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    duration_ms FLOAT NOT NULL,
    generator_id TEXT,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT now(),
    FOREIGN KEY (report_id) REFERENCES report_lifecycle_metadata(report_id)
);

CREATE INDEX idx_lifecycle_report ON report_lifecycle_metadata(report_id);
CREATE INDEX idx_events_report ON report_lifecycle_events(report_id);
```

**Update pipeline.py:**
```python
from .lifecycle_persistence_postgres import PostgresLifecyclePersistenceStore

def __init__(self, lifecycle_manager=None, persistence_store=None):
    self.persistence_store = persistence_store or PostgresLifecyclePersistenceStore()
```

**Rationale:**
- Database persistence survives process restarts
- Durability for critical metadata
- Enables long-term lineage tracking

---

## FIX 8: Database-Backed Lifecycle Manager

**File:** `services/calculation-engine/src/engine/reporting/lifecycle_db.py`

**Implementation:**
```python
"""Database-backed lifecycle manager with durability."""

from .lifecycle import ReportLifecycleManager, ReportLifecycleMetadata
from src.database import get_supabase_client

class DatabaseReportLifecycleManager(ReportLifecycleManager):
    """Extended manager with database persistence."""
    
    def __init__(self, db_client=None):
        super().__init__()
        self._db = db_client or get_supabase_client()
    
    def get_lifecycle_metadata(self, report_id: str) -> Optional[ReportLifecycleMetadata]:
        """
        Get metadata from database first, then in-memory.
        
        This ensures data survives process restarts.
        """
        # Try in-memory first (faster)
        if report_id in self.lifecycle_metadata:
            return self.lifecycle_metadata[report_id]
        
        # Fall back to database
        try:
            response = self._db.table('report_lifecycle_metadata').select('*').eq(
                'report_id', report_id
            ).execute()
            
            if response.data:
                # Load from database and cache in-memory
                metadata_dict = response.data[0]
                # Reconstruct ReportLifecycleMetadata from dict
                # ...
                self.lifecycle_metadata[report_id] = reconstructed_metadata
                return reconstructed_metadata
        
        except Exception as e:
            logger.error(f"Failed to load from database: {e}")
        
        return None
```

**Rationale:**
- Managers survive process restarts
- In-memory cache for performance
- Database as source of truth

---

## FIX 9: Add Timestamp Normalization

**File:** `services/calculation-engine/src/engine/reporting/deterministic_hashing.py`

**Add helper function:**
```python
@staticmethod
def is_iso_timestamp(value: str) -> bool:
    """Check if string is ISO 8601 timestamp."""
    if not isinstance(value, str):
        return False
    # Check pattern: YYYY-MM-DDTHH:MM:SS
    import re
    return bool(re.match(
        r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}',
        value
    ))

@staticmethod
def normalize_timestamp(value: str) -> str:
    """Normalize ISO timestamp to day-level precision."""
    if DeterministicHasher.is_iso_timestamp(value):
        # Extract date part only: 2026-05-08
        return value.split('T')[0]
    return value
```

**Update canonicalize_value:**
```python
if isinstance(value, str):
    # Check if it's a timestamp
    if DeterministicHasher.is_iso_timestamp(value):
        value = DeterministicHasher.normalize_timestamp(value)
    # Normalize whitespace
    return " ".join(value.split())
```

**Rationale:**
- Timestamps vary by microseconds
- Normalize to meaningful precision (day level)
- Prevents hidden timing leaks

---

## SUMMARY OF CHANGES

| Fix | Priority | Files | Lines | Effort | Status |
|-----|----------|-------|-------|--------|--------|
| 1. Remove generator_id | 🔴 Critical | 1 | 15 | 1h | Ready |
| 2. Remove execution_time | 🔴 Critical | 1 | 10 | 1h | Ready |
| 3. Lifecycle hash post-gen | 🔴 Critical | 1 | 35 | 2h | Ready |
| 4. Normalize optional values | 🔴 Critical | 1 | 25 | 1.5h | Ready |
| 5. Fail fast on errors | 🔴 Critical | 1 | 30 | 1h | Ready |
| 6. Verify identity post-gen | 🟡 High | 1 | 40 | 2h | Ready |
| 7. Persistent storage (PG) | 🔴 Critical | 1 new | 100 | 8h | Needs design review |
| 8. DB-backed managers | 🔴 Critical | 1 new | 80 | 6h | Needs design review |
| 9. Timestamp normalization | 🟡 High | 1 | 20 | 1h | Ready |

**Total Lines Changed:** ~350  
**Total Files Changed:** 9 (2 new, 7 modified)  
**Total Estimated Effort:** 25-30 hours

---

## IMPLEMENTATION ORDER

1. **Fixes 1-2** (2 hours): Remove non-deterministic components
2. **Fix 4** (1.5 hours): Improve canonicalization
3. **Fix 5** (1 hour): Add error handling
4. **Fix 9** (1 hour): Timestamp normalization
5. **Fix 3** (2 hours): Lifecycle hash recomputation
6. **Fix 6** (2 hours): Verification gate
7. **Fixes 7-8** (14 hours): Database persistence (blocking Stage 2)
8. **Regression testing** (6 hours): 100+ determinism tests
9. **Revalidation review** (2 hours): Independent audit

**Parallel Work:**
- Fixes 1-6 can proceed in parallel
- Fixes 7-8 require coordination (schema design)
- Testing starts after Fixes 1-6 merged

---

**Report Generated:** Independent Architecture Auditor  
**Date:** 2026-05-08  
**Status:** Ready for Implementation
