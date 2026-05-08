"""Report lifecycle management - orchestrates report generation as part of calculation pipeline."""

import logging
import time
from typing import Optional, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

from src.schemas import CalculationResult

logger = logging.getLogger(__name__)


class ReportLifecycleStage(str, Enum):
    """Stages in report lifecycle."""
    CONTEXT_BUILDING = "context_building"      # Building ReportContext from CalculationResult
    IDENTITY_GENERATED = "identity_generated"  # Report identity computed (deterministic)
    DOCUMENT_RENDERING = "document_rendering"  # DOCX being generated
    LIFECYCLE_REGISTERED = "lifecycle_registered"  # Report stored + registered
    VERIFICATION_READY = "verification_ready"  # Ready for integrity checks


@dataclass
class ReportLifecycleEvent:
    """Single event in report lifecycle."""
    stage: ReportLifecycleStage
    timestamp: str  # ISO format, UTC
    duration_ms: float  # Time spent in this stage
    generator_id: Optional[str] = None  # Who/what generated (e.g., "runner", "api_v1")
    error_message: Optional[str] = None  # If failed
    metadata: Dict[str, Any] = field(default_factory=dict)  # Stage-specific data


@dataclass
class ReportGenerationContext:
    """Context for report generation - ties calculation to report."""
    # Calculation linkage
    calculation_id: str  # Unique calculation identifier
    calculation_timestamp: str  # When calculation was executed

    # Template & engine versions
    template_type: str  # "piping", "structural", "thermal", "generic"
    template_version: str  # Template format version (e.g., "1.0")
    engine_version: str  # Reporting engine version (e.g., "0.3.0")
    runner_version: str  # Calculation runner version

    # Generation context
    generated_timestamp: str  # When report generation started (UTC)
    generator_id: str  # Who initiated: "runner", "api_endpoint", "batch_job", etc.

    # Execution context (from CalculationResult)
    execution_time_ms: Optional[float] = None  # How long calculation took
    validation_status: str = "unknown"  # "success", "warning", "error"

    # Audit context
    audit_trail_present: bool = False  # Has audit trail from calculation
    semantic_validation_enabled: bool = True  # Semantic checks were run


@dataclass
class ReportLifecycleMetadata:
    """Complete lifecycle metadata for a report."""
    # Identification
    report_id: str
    calculation_id: str

    # Generation context
    context: ReportGenerationContext

    # Lifecycle events (chronological)
    events: list[ReportLifecycleEvent] = field(default_factory=list)

    # Current state
    current_stage: ReportLifecycleStage = ReportLifecycleStage.CONTEXT_BUILDING
    total_generation_time_ms: float = 0.0

    # Flags
    is_stale: bool = False  # True if calculation was modified after report generation
    is_verified: bool = False  # True if integrity verified

    # Links
    audit_events: list[str] = field(default_factory=list)  # References to audit events
    parent_report_id: Optional[str] = None  # If this is revision of previous report


class ReportLifecycleManager:
    """Manages report lifecycle stages and ensures traceability."""

    def __init__(self):
        """Initialize lifecycle manager."""
        self.lifecycle_metadata: Dict[str, ReportLifecycleMetadata] = {}
        self.events_log: list[ReportLifecycleEvent] = []

    def initialize_generation(
        self,
        calculation_id: str,
        calculation_result: CalculationResult,
        template_type: str,
        generator_id: str = "runner",
        template_version: str = "1.0",
        engine_version: str = "0.3.0",
    ) -> ReportGenerationContext:
        """
        Initialize report generation context from calculation result.

        Args:
            calculation_id: Unique calculation identifier
            calculation_result: CalculationResult from runner
            template_type: Which template to use
            generator_id: Who triggered generation
            template_version: Template format version
            engine_version: Reporting engine version

        Returns:
            ReportGenerationContext for downstream use
        """
        execution_time = None
        if hasattr(calculation_result, 'metadata') and isinstance(calculation_result.metadata, dict):
            execution_time = calculation_result.metadata.get('execution_time_ms')

        context = ReportGenerationContext(
            calculation_id=calculation_id,
            calculation_timestamp=getattr(calculation_result, 'timestamp', datetime.now(timezone.utc).isoformat()),
            template_type=template_type,
            template_version=template_version,
            engine_version=engine_version,
            runner_version="0.3.0",  # From CalculationResult
            generated_timestamp=datetime.now(timezone.utc).isoformat(),
            generator_id=generator_id,
            execution_time_ms=execution_time,
            validation_status=getattr(calculation_result, 'status', 'unknown'),
            audit_trail_present=bool(getattr(calculation_result, 'audit_trail', None)),
        )

        logger.info(f"Initialized report generation context for calculation {calculation_id}")
        return context

    def start_stage(
        self,
        report_id: str,
        stage: ReportLifecycleStage,
        generator_id: str = "system"
    ) -> float:
        """
        Mark start of lifecycle stage.

        Args:
            report_id: Report identifier
            stage: Which stage starting
            generator_id: Who initiated

        Returns:
            Start timestamp (for duration measurement)
        """
        return time.time()

    def end_stage(
        self,
        report_id: str,
        calculation_id: str,
        stage: ReportLifecycleStage,
        start_time: float,
        context: ReportGenerationContext,
        metadata: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> ReportLifecycleMetadata:
        """
        Mark end of lifecycle stage and record event.

        Args:
            report_id: Report identifier
            calculation_id: Calculation identifier
            stage: Which stage completed
            start_time: When stage started (from start_stage)
            context: ReportGenerationContext
            metadata: Stage-specific metadata
            error: Error message if failed

        Returns:
            Updated ReportLifecycleMetadata
        """
        duration_ms = (time.time() - start_time) * 1000

        event = ReportLifecycleEvent(
            stage=stage,
            timestamp=datetime.now(timezone.utc).isoformat(),
            duration_ms=duration_ms,
            generator_id=context.generator_id,
            error_message=error,
            metadata=metadata or {}
        )

        # Get or create lifecycle metadata
        if report_id not in self.lifecycle_metadata:
            self.lifecycle_metadata[report_id] = ReportLifecycleMetadata(
                report_id=report_id,
                calculation_id=calculation_id,
                context=context,
            )

        lifecycle = self.lifecycle_metadata[report_id]
        lifecycle.events.append(event)
        lifecycle.current_stage = stage
        lifecycle.total_generation_time_ms += duration_ms

        # Log event
        self.events_log.append(event)

        level = "ERROR" if error else "INFO"
        logger.log(
            logging.ERROR if error else logging.INFO,
            f"Report {report_id} stage {stage.value}: {duration_ms:.1f}ms" +
            (f" - ERROR: {error}" if error else "")
        )

        return lifecycle

    def mark_complete(
        self,
        report_id: str,
        context: ReportGenerationContext
    ) -> ReportLifecycleMetadata:
        """Mark report generation complete and ready for storage."""
        if report_id not in self.lifecycle_metadata:
            raise ValueError(f"No lifecycle metadata for report {report_id}")

        lifecycle = self.lifecycle_metadata[report_id]
        lifecycle.current_stage = ReportLifecycleStage.LIFECYCLE_REGISTERED

        logger.info(
            f"Report {report_id} generation complete "
            f"(total: {lifecycle.total_generation_time_ms:.1f}ms, "
            f"stages: {len(lifecycle.events)})"
        )

        return lifecycle

    def get_lifecycle_metadata(self, report_id: str) -> Optional[ReportLifecycleMetadata]:
        """Retrieve lifecycle metadata for a report."""
        return self.lifecycle_metadata.get(report_id)

    def is_report_stale(
        self,
        report_id: str,
        calculation_updated_timestamp: str
    ) -> bool:
        """
        Check if report is stale (calculation modified after report generated).

        Args:
            report_id: Report to check
            calculation_updated_timestamp: When calculation was last modified

        Returns:
            True if report is older than calculation update
        """
        lifecycle = self.get_lifecycle_metadata(report_id)
        if not lifecycle:
            return False

        # Compare ISO timestamps
        report_time = lifecycle.context.generated_timestamp
        return report_time < calculation_updated_timestamp

    def link_audit_events(
        self,
        report_id: str,
        audit_event_ids: list[str]
    ):
        """Link audit trail events to report."""
        if report_id in self.lifecycle_metadata:
            self.lifecycle_metadata[report_id].audit_events.extend(audit_event_ids)
            logger.debug(f"Linked {len(audit_event_ids)} audit events to report {report_id}")

    def get_stage_durations(self, report_id: str) -> Dict[str, float]:
        """Get duration breakdown by stage."""
        lifecycle = self.get_lifecycle_metadata(report_id)
        if not lifecycle:
            return {}

        return {event.stage.value: event.duration_ms for event in lifecycle.events}


# Global instance for report lifecycle management
_report_lifecycle_manager = ReportLifecycleManager()


def get_lifecycle_manager() -> ReportLifecycleManager:
    """Get global report lifecycle manager instance."""
    return _report_lifecycle_manager
