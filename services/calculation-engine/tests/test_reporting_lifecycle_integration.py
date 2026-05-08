"""Stage 1: Report Lifecycle Integration Tests.

Tests verify:
1. Report lifecycle model integration with calculation pipeline
2. Deterministic report identity generation and reproducibility
3. Lifecycle stage tracking and event logging
4. Audit trail linkage (Calculation ↔ Report ↔ Audit)
5. Report staleness detection
6. End-to-end lifecycle pipeline

Key test scenarios:
- Same calculation inputs → Same report identity (determinism)
- Different inputs → Different report identity (sensitivity)
- Report generation lifecycle complete
- Audit events properly linked
- Staleness detection working
"""

import pytest
import time
from datetime import datetime, timezone
from typing import Dict, Any

from src.schemas import CalculationResult, CalcTemplate, CalcInput
from src.engine.reporting.lifecycle import (
    ReportLifecycleManager,
    ReportGenerationContext,
    ReportLifecycleStage,
    get_lifecycle_manager,
)
from src.engine.reporting.report_identity import (
    ReportIdentityGenerator,
    get_identity_generator,
)


# Test fixtures
@pytest.fixture
def sample_calculation_result() -> CalculationResult:
    """Create a sample calculation result for testing."""
    return CalculationResult(
        template_id="test_template",
        status="success",
        results={"pressure_drop": {"value": 15.5, "unit": "kPa"}},
        warnings=[],
        metadata={
            "execution_time_ms": 42.5,
            "inputs": {
                "flow_rate": 1000,
                "diameter": 50,
                "length": 100
            },
            "formula": "pressure_drop = flow_rate * length / (diameter ** 2)",
            "semantic_rules": {
                "flow_rate_range": {"min": 100, "max": 10000},
                "diameter_range": {"min": 10, "max": 500}
            }
        },
        validation_results=[],
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@pytest.fixture
def sample_generation_context() -> ReportGenerationContext:
    """Create a sample report generation context."""
    return ReportGenerationContext(
        calculation_id="calc_001",
        calculation_timestamp=datetime.now(timezone.utc).isoformat(),
        template_type="piping",
        template_version="1.0",
        engine_version="0.3.0",
        runner_version="0.3.0",
        generated_timestamp=datetime.now(timezone.utc).isoformat(),
        generator_id="runner",
        execution_time_ms=42.5,
        validation_status="success",
        audit_trail_present=True,
        semantic_validation_enabled=True,
    )


class TestReportIdentityDeterminism:
    """Test deterministic report identity generation."""

    def test_same_inputs_same_identity(self, sample_calculation_result):
        """Same calculation inputs should produce same report identity."""
        gen = get_identity_generator()

        context1 = ReportGenerationContext(
            calculation_id="calc_001",
            calculation_timestamp="2026-05-08T10:00:00Z",
            template_type="piping",
            template_version="1.0",
            engine_version="0.3.0",
            runner_version="0.3.0",
            generated_timestamp="2026-05-08T10:00:00Z",
            generator_id="runner",
        )

        context2 = ReportGenerationContext(
            calculation_id="calc_001",
            calculation_timestamp="2026-05-08T10:00:00Z",
            template_type="piping",
            template_version="1.0",
            engine_version="0.3.0",
            runner_version="0.3.0",
            generated_timestamp="2026-05-08T10:00:00Z",
            generator_id="runner",
        )

        identity1 = gen.generate_identity("calc_001", sample_calculation_result, context1)
        identity2 = gen.generate_identity("calc_001", sample_calculation_result, context2)

        # Same inputs, formula, execution → same identity
        assert identity1.report_id == identity2.report_id
        assert identity1.identity_hash == identity2.identity_hash
        assert identity1.inputs_hash == identity2.inputs_hash
        assert identity1.formula_hash == identity2.formula_hash

    def test_different_inputs_different_identity(self, sample_calculation_result):
        """Different inputs should produce different report identity."""
        gen = get_identity_generator()

        context = ReportGenerationContext(
            calculation_id="calc_001",
            calculation_timestamp="2026-05-08T10:00:00Z",
            template_type="piping",
            template_version="1.0",
            engine_version="0.3.0",
            runner_version="0.3.0",
            generated_timestamp="2026-05-08T10:00:00Z",
            generator_id="runner",
        )

        identity1 = gen.generate_identity("calc_001", sample_calculation_result, context)

        # Modify inputs
        modified_result = CalculationResult(
            template_id="test_template",
            status="success",
            results={"pressure_drop": {"value": 20.0, "unit": "kPa"}},
            metadata={
                "inputs": {
                    "flow_rate": 1500,  # Changed from 1000
                    "diameter": 50,
                    "length": 100
                },
                "formula": "pressure_drop = flow_rate * length / (diameter ** 2)",
            },
            warnings=[],
            validation_results=[],
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

        identity2 = gen.generate_identity("calc_001", modified_result, context)

        # Different inputs → different identity
        assert identity1.report_id != identity2.report_id
        assert identity1.inputs_hash != identity2.inputs_hash

    def test_inputs_hash_stability(self):
        """Inputs hash should be stable across multiple calls."""
        gen = get_identity_generator()

        inputs = {
            "flow_rate": 1000.0,
            "diameter": 50.5,
            "length": 100.0,
        }

        hash1 = gen.compute_inputs_hash(inputs)
        hash2 = gen.compute_inputs_hash(inputs)
        hash3 = gen.compute_inputs_hash(inputs)

        assert hash1 == hash2 == hash3

    def test_formula_hash_ignores_whitespace(self):
        """Formula hash should ignore whitespace differences."""
        gen = get_identity_generator()

        formula1 = "pressure_drop = flow_rate * length / (diameter ** 2)"
        formula2 = "pressure_drop=flow_rate*length/(diameter**2)"
        formula3 = "pressure_drop  =  flow_rate  *  length  /  (diameter  **  2)"

        hash1 = gen.compute_formula_hash(formula1)
        hash2 = gen.compute_formula_hash(formula2)
        hash3 = gen.compute_formula_hash(formula3)

        # Normalized formula hashes should all be equal
        assert hash1 == hash2 == hash3


class TestReportLifecycleStages:
    """Test report lifecycle stage tracking."""

    def test_lifecycle_initialization(self, sample_calculation_result, sample_generation_context):
        """Test initializing report generation context."""
        manager = get_lifecycle_manager()

        context = manager.initialize_generation(
            calculation_id="calc_001",
            calculation_result=sample_calculation_result,
            template_type="piping",
            generator_id="runner",
        )

        assert context.calculation_id == "calc_001"
        assert context.template_type == "piping"
        assert context.generator_id == "runner"
        assert context.execution_time_ms == 42.5

    def test_stage_event_recording(self, sample_generation_context):
        """Test recording lifecycle stage events."""
        manager = get_lifecycle_manager()

        report_id = "rpt_test_001"
        context = sample_generation_context

        # Simulate stage progression
        for stage in [
            ReportLifecycleStage.CONTEXT_BUILDING,
            ReportLifecycleStage.IDENTITY_GENERATED,
            ReportLifecycleStage.DOCUMENT_RENDERING,
            ReportLifecycleStage.LIFECYCLE_REGISTERED,
        ]:
            start = manager.start_stage(report_id, stage)
            time.sleep(0.01)  # Simulate work
            lifecycle = manager.end_stage(
                report_id=report_id,
                calculation_id="calc_001",
                stage=stage,
                start_time=start,
                context=context,
                metadata={"data": "test"},
            )

        # Verify all stages recorded
        metadata = manager.get_lifecycle_metadata(report_id)
        assert metadata is not None
        assert len(metadata.events) == 4
        assert metadata.current_stage == ReportLifecycleStage.LIFECYCLE_REGISTERED

    def test_stage_duration_tracking(self, sample_generation_context):
        """Test that stage durations are accurately tracked."""
        manager = get_lifecycle_manager()
        report_id = "rpt_test_duration"
        context = sample_generation_context

        start = manager.start_stage(report_id, ReportLifecycleStage.CONTEXT_BUILDING)
        time.sleep(0.05)  # Simulate 50ms of work
        manager.end_stage(
            report_id=report_id,
            calculation_id="calc_001",
            stage=ReportLifecycleStage.CONTEXT_BUILDING,
            start_time=start,
            context=context,
        )

        metadata = manager.get_lifecycle_metadata(report_id)
        assert metadata.events[0].duration_ms >= 50

    def test_error_recording(self, sample_generation_context):
        """Test recording errors in lifecycle stages."""
        manager = get_lifecycle_manager()
        report_id = "rpt_test_error"
        context = sample_generation_context

        start = manager.start_stage(report_id, ReportLifecycleStage.DOCUMENT_RENDERING)
        manager.end_stage(
            report_id=report_id,
            calculation_id="calc_001",
            stage=ReportLifecycleStage.DOCUMENT_RENDERING,
            start_time=start,
            context=context,
            error="DOCX generation failed: memory limit exceeded",
        )

        metadata = manager.get_lifecycle_metadata(report_id)
        assert len(metadata.events) == 1
        assert metadata.events[0].error_message is not None
        assert "memory limit" in metadata.events[0].error_message


class TestAuditTrailLinkage:
    """Test bidirectional audit trail linkage."""

    def test_audit_event_linking(self, sample_generation_context):
        """Test linking audit events to reports."""
        manager = get_lifecycle_manager()
        report_id = "rpt_audit_test"

        # Initialize lifecycle
        start = manager.start_stage(report_id, ReportLifecycleStage.CONTEXT_BUILDING)
        manager.end_stage(
            report_id=report_id,
            calculation_id="calc_001",
            stage=ReportLifecycleStage.CONTEXT_BUILDING,
            start_time=start,
            context=sample_generation_context,
        )

        # Link audit events
        audit_event_ids = ["audit_evt_001", "audit_evt_002", "audit_evt_003"]
        manager.link_audit_events(report_id, audit_event_ids)

        metadata = manager.get_lifecycle_metadata(report_id)
        assert len(metadata.audit_events) == 3
        assert "audit_evt_001" in metadata.audit_events

    def test_multiple_audit_linkages(self, sample_generation_context):
        """Test linking multiple batches of audit events."""
        manager = get_lifecycle_manager()
        report_id = "rpt_multi_audit"

        start = manager.start_stage(report_id, ReportLifecycleStage.CONTEXT_BUILDING)
        manager.end_stage(
            report_id=report_id,
            calculation_id="calc_001",
            stage=ReportLifecycleStage.CONTEXT_BUILDING,
            start_time=start,
            context=sample_generation_context,
        )

        # Link multiple batches
        manager.link_audit_events(report_id, ["audit_001", "audit_002"])
        manager.link_audit_events(report_id, ["audit_003", "audit_004"])

        metadata = manager.get_lifecycle_metadata(report_id)
        assert len(metadata.audit_events) == 4


class TestStalenessDetection:
    """Test report staleness detection."""

    def test_stale_detection_false(self, sample_generation_context):
        """Report is not stale if calculation not modified after generation."""
        manager = get_lifecycle_manager()
        report_id = "rpt_fresh"

        report_timestamp = "2026-05-08T10:00:00Z"
        calc_timestamp = "2026-05-08T09:59:00Z"  # Before report

        context = ReportGenerationContext(
            calculation_id="calc_001",
            calculation_timestamp=calc_timestamp,
            template_type="piping",
            template_version="1.0",
            engine_version="0.3.0",
            runner_version="0.3.0",
            generated_timestamp=report_timestamp,
            generator_id="runner",
        )

        start = manager.start_stage(report_id, ReportLifecycleStage.CONTEXT_BUILDING)
        manager.end_stage(
            report_id=report_id,
            calculation_id="calc_001",
            stage=ReportLifecycleStage.CONTEXT_BUILDING,
            start_time=start,
            context=context,
        )

        is_stale = manager.is_report_stale(report_id, calc_timestamp)
        assert is_stale == False

    def test_stale_detection_true(self, sample_generation_context):
        """Report is stale if calculation modified after generation."""
        manager = get_lifecycle_manager()
        report_id = "rpt_stale"

        report_timestamp = "2026-05-08T10:00:00Z"

        context = ReportGenerationContext(
            calculation_id="calc_001",
            calculation_timestamp="2026-05-08T09:59:00Z",
            template_type="piping",
            template_version="1.0",
            engine_version="0.3.0",
            runner_version="0.3.0",
            generated_timestamp=report_timestamp,
            generator_id="runner",
        )

        start = manager.start_stage(report_id, ReportLifecycleStage.CONTEXT_BUILDING)
        manager.end_stage(
            report_id=report_id,
            calculation_id="calc_001",
            stage=ReportLifecycleStage.CONTEXT_BUILDING,
            start_time=start,
            context=context,
        )

        # Calculation updated AFTER report generated
        updated_calc_timestamp = "2026-05-08T10:05:00Z"

        is_stale = manager.is_report_stale(report_id, updated_calc_timestamp)
        assert is_stale == True


class TestEndToEndLifecycle:
    """Test complete end-to-end report lifecycle pipeline."""

    def test_complete_lifecycle_pipeline(self, sample_calculation_result):
        """Test full lifecycle from calculation to registered report."""
        manager = get_lifecycle_manager()
        gen = get_identity_generator()

        calculation_id = "calc_complete_001"

        # Step 1: Initialize generation context
        context = manager.initialize_generation(
            calculation_id=calculation_id,
            calculation_result=sample_calculation_result,
            template_type="piping",
            generator_id="runner",
        )

        # Step 2: Generate deterministic identity
        identity = gen.generate_identity(
            calculation_id=calculation_id,
            calculation_result=sample_calculation_result,
            context=context,
        )

        report_id = identity.report_id

        # Step 3: Track lifecycle stages
        start = manager.start_stage(report_id, ReportLifecycleStage.CONTEXT_BUILDING)
        manager.end_stage(
            report_id=report_id,
            calculation_id=calculation_id,
            stage=ReportLifecycleStage.CONTEXT_BUILDING,
            start_time=start,
            context=context,
        )

        start = manager.start_stage(report_id, ReportLifecycleStage.IDENTITY_GENERATED)
        manager.end_stage(
            report_id=report_id,
            calculation_id=calculation_id,
            stage=ReportLifecycleStage.IDENTITY_GENERATED,
            start_time=start,
            context=context,
            metadata={"identity_hash": identity.identity_hash},
        )

        start = manager.start_stage(report_id, ReportLifecycleStage.DOCUMENT_RENDERING)
        manager.end_stage(
            report_id=report_id,
            calculation_id=calculation_id,
            stage=ReportLifecycleStage.DOCUMENT_RENDERING,
            start_time=start,
            context=context,
        )

        # Step 4: Link audit trail
        manager.link_audit_events(report_id, ["audit_evt_001", "audit_evt_002"])

        # Step 5: Complete registration
        lifecycle = manager.mark_complete(report_id, context)

        # Verify complete lifecycle
        assert lifecycle.report_id == report_id
        assert lifecycle.calculation_id == calculation_id
        assert lifecycle.current_stage == ReportLifecycleStage.LIFECYCLE_REGISTERED
        assert len(lifecycle.events) == 3
        assert len(lifecycle.audit_events) == 2
        assert lifecycle.total_generation_time_ms > 0

    def test_reproducible_report_identity(self):
        """Test that same calculation always produces same report ID."""
        gen = get_identity_generator()

        calc_result1 = CalculationResult(
            template_id="test",
            status="success",
            results={"out": {"value": 10}},
            metadata={
                "inputs": {"x": 5, "y": 2},
                "formula": "out = x * y",
            },
            warnings=[],
            validation_results=[],
            timestamp="2026-05-08T10:00:00Z",
        )

        calc_result2 = CalculationResult(
            template_id="test",
            status="success",
            results={"out": {"value": 10}},
            metadata={
                "inputs": {"x": 5, "y": 2},
                "formula": "out = x * y",
            },
            warnings=[],
            validation_results=[],
            timestamp="2026-05-08T10:00:00Z",
        )

        context = ReportGenerationContext(
            calculation_id="calc_001",
            calculation_timestamp="2026-05-08T10:00:00Z",
            template_type="piping",
            template_version="1.0",
            engine_version="0.3.0",
            runner_version="0.3.0",
            generated_timestamp="2026-05-08T10:00:00Z",
            generator_id="runner",
        )

        identity1 = gen.generate_identity("calc_001", calc_result1, context)
        identity2 = gen.generate_identity("calc_001", calc_result2, context)

        # Same calculation should produce identical report ID
        assert identity1.report_id == identity2.report_id
        assert identity1.identity_hash == identity2.identity_hash


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
