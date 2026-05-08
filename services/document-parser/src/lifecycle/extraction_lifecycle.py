"""Extraction lifecycle management - orchestrates document extraction pipeline.

Adapted from calculation-engine/reporting/lifecycle.py for extraction system.
"""

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class ExtractionLifecycleStage(str, Enum):
    """Stages in extraction lifecycle."""

    DOCUMENT_INGESTION = "document_ingestion"  # Parsing and raw extraction
    SECTION_PARSING = "section_parsing"  # Section hierarchy building
    FORMULA_DETECTION = "formula_detection"  # Formula candidate identification
    VARIABLE_EXTRACTION = "variable_extraction"  # Variable and unit extraction
    TRACEABILITY_LINKING = "traceability_linking"  # Source reference linking
    VALIDATION = "validation"  # Formula and unit validation
    AUDIT_TRAIL = "audit_trail"  # Audit entry creation
    EXTRACTION_COMPLETE = "extraction_complete"  # Ready for review/storage


@dataclass
class ExtractionLifecycleEvent:
    """Single event in extraction lifecycle."""

    stage: ExtractionLifecycleStage
    timestamp: str  # ISO format, UTC
    duration_ms: float  # Time spent in this stage
    generator_id: Optional[str] = None
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ExtractionContext:
    """Context for document extraction."""

    document_id: str
    document_code: str
    document_type: str

    # Extraction metadata
    extraction_method: str  # pdfplumber, ocr, docx_xml, openpyxl, etc.
    parser_version: str  # Parser version
    engine_version: str  # Extraction engine version

    # Timing
    started_timestamp: str  # When extraction started (UTC)
    generator_id: str  # Who triggered: "api", "batch_job", "manual", etc.

    # Configuration
    formula_confidence_threshold: float = 0.5
    include_audit_trail: bool = True
    validate_units: bool = True


@dataclass
class ExtractionLifecycleMetadata:
    """Complete lifecycle metadata for extraction."""

    extraction_id: str
    document_id: str

    # Generation context
    context: ExtractionContext

    # Lifecycle events (chronological)
    events: list[ExtractionLifecycleEvent] = field(default_factory=list)

    # Current state
    current_stage: ExtractionLifecycleStage = ExtractionLifecycleStage.DOCUMENT_INGESTION
    total_extraction_time_ms: float = 0.0

    # Counts
    formulas_detected: int = 0
    formulas_validated: int = 0
    variables_extracted: int = 0
    errors_encountered: int = 0

    # Flags
    is_verified: bool = False


class ExtractionLifecycleManager:
    """Manages extraction lifecycle stages and traceability."""

    def __init__(self) -> None:
        """Initialize lifecycle manager."""
        self.lifecycle_metadata: Dict[str, ExtractionLifecycleMetadata] = {}
        self.events_log: list[ExtractionLifecycleEvent] = []

    def initialize_extraction(
        self,
        extraction_id: str,
        document_id: str,
        document_code: str,
        document_type: str,
        extraction_method: str,
        generator_id: str = "system",
        parser_version: str = "0.1.0",
        engine_version: str = "0.1.0",
    ) -> ExtractionContext:
        """Initialize extraction context.

        Args:
            extraction_id: Unique extraction identifier
            document_id: Document being extracted
            document_code: Document code (e.g., ГОСТ 21.110-2013)
            document_type: Document type (ГОСТ, СНиП, ASME, etc.)
            extraction_method: How document was parsed
            generator_id: Who triggered extraction
            parser_version: Parser version
            engine_version: Extraction engine version

        Returns:
            ExtractionContext for downstream use
        """
        context = ExtractionContext(
            document_id=document_id,
            document_code=document_code,
            document_type=document_type,
            extraction_method=extraction_method,
            parser_version=parser_version,
            engine_version=engine_version,
            started_timestamp=datetime.now(timezone.utc).isoformat(),
            generator_id=generator_id,
        )

        logger.info(
            f"Initialized extraction context for document {document_code} "
            f"(method: {extraction_method})"
        )
        return context

    def start_stage(
        self,
        extraction_id: str,
        stage: ExtractionLifecycleStage,
        generator_id: str = "system",
    ) -> float:
        """Mark start of extraction stage.

        Args:
            extraction_id: Extraction identifier
            stage: Which stage starting
            generator_id: Who initiated

        Returns:
            Start timestamp (for duration measurement)
        """
        return time.time()

    def end_stage(
        self,
        extraction_id: str,
        document_id: str,
        stage: ExtractionLifecycleStage,
        start_time: float,
        context: ExtractionContext,
        metadata: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> ExtractionLifecycleMetadata:
        """Mark end of extraction stage and record event.

        Args:
            extraction_id: Extraction identifier
            document_id: Document identifier
            stage: Which stage completed
            start_time: When stage started (from start_stage)
            context: ExtractionContext
            metadata: Stage-specific metadata
            error: Error message if failed

        Returns:
            Updated ExtractionLifecycleMetadata
        """
        duration_ms = (time.time() - start_time) * 1000

        event = ExtractionLifecycleEvent(
            stage=stage,
            timestamp=datetime.now(timezone.utc).isoformat(),
            duration_ms=duration_ms,
            generator_id=context.generator_id,
            error_message=error,
            metadata=metadata or {},
        )

        # Get or create lifecycle metadata
        if extraction_id not in self.lifecycle_metadata:
            self.lifecycle_metadata[extraction_id] = ExtractionLifecycleMetadata(
                extraction_id=extraction_id,
                document_id=document_id,
                context=context,
            )

        lifecycle = self.lifecycle_metadata[extraction_id]
        lifecycle.events.append(event)
        lifecycle.current_stage = stage
        lifecycle.total_extraction_time_ms += duration_ms

        # Update error count
        if error:
            lifecycle.errors_encountered += 1

        # Log event
        self.events_log.append(event)

        log_level = logging.ERROR if error else logging.INFO
        logger.log(
            log_level,
            f"Extraction {extraction_id} stage {stage.value}: {duration_ms:.1f}ms"
            + (f" - ERROR: {error}" if error else ""),
        )

        return lifecycle

    def mark_complete(
        self, extraction_id: str, context: ExtractionContext
    ) -> ExtractionLifecycleMetadata:
        """Mark extraction complete and ready for storage."""
        if extraction_id not in self.lifecycle_metadata:
            raise ValueError(f"No lifecycle metadata for extraction {extraction_id}")

        lifecycle = self.lifecycle_metadata[extraction_id]
        lifecycle.current_stage = ExtractionLifecycleStage.EXTRACTION_COMPLETE

        logger.info(
            f"Extraction {extraction_id} complete "
            f"(total: {lifecycle.total_extraction_time_ms:.1f}ms, "
            f"stages: {len(lifecycle.events)}, "
            f"formulas: {lifecycle.formulas_detected}, "
            f"errors: {lifecycle.errors_encountered})"
        )

        return lifecycle

    def get_lifecycle_metadata(
        self, extraction_id: str
    ) -> Optional[ExtractionLifecycleMetadata]:
        """Retrieve lifecycle metadata for extraction."""
        return self.lifecycle_metadata.get(extraction_id)

    def get_stage_durations(self, extraction_id: str) -> Dict[str, float]:
        """Get duration breakdown by stage."""
        lifecycle = self.get_lifecycle_metadata(extraction_id)
        if not lifecycle:
            return {}

        return {event.stage.value: event.duration_ms for event in lifecycle.events}


# Global instance for extraction lifecycle management
_extraction_lifecycle_manager = ExtractionLifecycleManager()


def get_lifecycle_manager() -> ExtractionLifecycleManager:
    """Get global extraction lifecycle manager instance."""
    return _extraction_lifecycle_manager
