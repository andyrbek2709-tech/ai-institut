"""Unified reporting pipeline - orchestrates calculation → deterministic identity → report generation → lifecycle persistence."""

import logging
import time
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from dataclasses import asdict

from src.schemas import CalculationResult
from .models import ReportContext, ReportTemplateType, ReportGenerationResponse, ReportStatus, ReportMetadata
from .data_extractor import ReportDataExtractor
from .report_identity import ReportIdentityGenerator, ReportIdentity
from .lifecycle import (
    ReportLifecycleManager,
    ReportGenerationContext,
    ReportLifecycleStage,
    get_lifecycle_manager,
)
from .lifecycle_persistence import get_persistence_store
from .docx_builder import DocxReportBuilder
from .templates import TemplateRegistry
from .deterministic_hashing import DeterministicHasher

logger = logging.getLogger(__name__)


class UnifiedReportingPipeline:
    """
    Orchestrates complete report generation pipeline.

    Flow:
    1. Initialize from CalculationResult + template metadata
    2. Extract data → ReportContext
    3. Generate deterministic identity (integrated)
    4. Record lifecycle: CONTEXT_BUILDING
    5. Build DOCX document
    6. Record lifecycle: DOCUMENT_RENDERING
    7. Persist to storage + register in database
    8. Record lifecycle: LIFECYCLE_REGISTERED

    Identity and lifecycle are NOT separate concerns — they're embedded in the pipeline.
    """

    def __init__(
        self,
        lifecycle_manager: Optional[ReportLifecycleManager] = None,
        persistence_store=None
    ):
        """Initialize pipeline with optional custom lifecycle manager and persistence store."""
        self.lifecycle_manager = lifecycle_manager or get_lifecycle_manager()
        self.persistence_store = persistence_store or get_persistence_store()
        self.identity_generator = ReportIdentityGenerator()

    def execute(
        self,
        calculation_id: str,
        calculation_result: CalculationResult,
        template_type: str = "generic",
        generator_id: str = "api_v1",
        template_version: str = "1.0",
        engine_version: str = "0.3.0",
        template_data: Optional[Dict[str, Any]] = None,
    ) -> tuple[ReportGenerationResponse, ReportIdentity, ReportContext]:
        """
        Execute complete reporting pipeline.

        Args:
            calculation_id: Source calculation ID
            calculation_result: CalculationResult from runner
            template_type: Report template ("piping", "structural", "thermal", "generic")
            generator_id: Who initiated ("runner", "api_v1", "batch_job")
            template_version: Template format version
            engine_version: Reporting engine version
            template_data: Optional template-specific data

        Returns:
            (ReportGenerationResponse, ReportIdentity, ReportContext)

        Raises:
            ValueError: If calculation_result is invalid
            RuntimeError: If pipeline stages fail
        """
        pipeline_start = time.time()

        logger.info(
            f"[PIPELINE START] Calculation {calculation_id}, "
            f"template {template_type}, generator {generator_id}"
        )

        try:
            # STAGE 1: Initialize generation context
            # ======================================
            context_start = time.time()

            generation_context = self.lifecycle_manager.initialize_generation(
                calculation_id=calculation_id,
                calculation_result=calculation_result,
                template_type=template_type,
                generator_id=generator_id,
                template_version=template_version,
                engine_version=engine_version,
            )

            logger.debug(f"[STAGE: CONTEXT_INIT] Initialized generation context")

            # STAGE 2: Extract report context from calculation
            # ================================================
            extraction_start = time.time()

            report_context = ReportDataExtractor.extract_context(
                calculation_result=calculation_result,
                calculation_id=calculation_id,
                template_data=template_data or {},
            )

            # Store generation metadata in context
            report_context.generation_timestamp = generation_context.generated_timestamp
            report_context.generator_id = generator_id
            report_context.runner_version = generation_context.runner_version
            report_context.template_version = template_version

            logger.debug(
                f"[STAGE: DATA_EXTRACTION] "
                f"Extracted {len(report_context.inputs)} inputs, "
                f"{len(report_context.formulas)} formulas, "
                f"{len(report_context.results)} results"
            )

            # STAGE 3: Generate deterministic identity (INTEGRATED)
            # =====================================================
            identity_start = time.time()

            identity = self.identity_generator.generate_identity(
                calculation_id=calculation_id,
                calculation_result=calculation_result,
                context=generation_context,
                template_definition=None,  # Optional template spec
            )

            # Attach identity to context
            report_context.report_id = identity.report_id
            report_context.inputs_hash = identity.inputs_hash
            report_context.formula_hash = identity.formula_hash
            report_context.identity_hash = identity.identity_hash

            logger.info(
                f"[STAGE: IDENTITY_GENERATION] "
                f"Generated report_id={identity.report_id}, "
                f"identity_hash={identity.identity_hash[:16]}..."
            )

            # STAGE 4: Record lifecycle event - context building complete
            # ===========================================================
            lifecycle_context_end = self.lifecycle_manager.end_stage(
                report_id=identity.report_id,
                calculation_id=calculation_id,
                stage=ReportLifecycleStage.CONTEXT_BUILDING,
                start_time=context_start,
                context=generation_context,
                metadata={
                    "inputs_count": len(report_context.inputs),
                    "formulas_count": len(report_context.formulas),
                    "results_count": len(report_context.results),
                },
            )

            # STAGE 5: Mark identity as generated in lifecycle
            # ===============================================
            lifecycle_identity_end = self.lifecycle_manager.end_stage(
                report_id=identity.report_id,
                calculation_id=calculation_id,
                stage=ReportLifecycleStage.IDENTITY_GENERATED,
                start_time=identity_start,
                context=generation_context,
                metadata={
                    "identity_hash": identity.identity_hash,
                    "inputs_hash": identity.inputs_hash,
                    "formula_hash": identity.formula_hash,
                    "is_deterministic": identity.is_deterministic,
                },
            )

            logger.debug(f"[STAGE: LIFECYCLE_IDENTITY] Identity generation recorded")

            # STAGE 6: Build DOCX document
            # ============================
            rendering_start = time.time()

            template = TemplateRegistry.get_template(template_type)
            if not template:
                template = TemplateRegistry.get_template("generic")

            docx_builder = DocxReportBuilder()
            report_bytes = docx_builder.build_report(report_context, template)

            logger.debug(
                f"[STAGE: DOCX_GENERATION] "
                f"Built DOCX document ({len(report_bytes)} bytes)"
            )

            # STAGE 7: Record lifecycle event - document rendering complete
            # ============================================================
            lifecycle_rendering_end = self.lifecycle_manager.end_stage(
                report_id=identity.report_id,
                calculation_id=calculation_id,
                stage=ReportLifecycleStage.DOCUMENT_RENDERING,
                start_time=rendering_start,
                context=generation_context,
                metadata={
                    "docx_size_bytes": len(report_bytes),
                    "template_used": template.template_id,
                },
            )

            logger.debug(f"[STAGE: LIFECYCLE_RENDERING] Document rendering recorded")

            # STAGE 8: Register report in lifecycle + persistence
            # ==================================================
            persistence_start = time.time()

            lifecycle_final = self.lifecycle_manager.mark_complete(
                report_id=identity.report_id,
                context=generation_context,
            )

            logger.info(
                f"[STAGE: LIFECYCLE_REGISTRATION] "
                f"Report registered, total generation time: {lifecycle_final.total_generation_time_ms:.1f}ms"
            )

            # TODO: Persist report to database
            # - Store ReportMetadata
            # - Store lifecycle events
            # - Store identity
            # - Create database record linking calculation_id → report_id

            # STAGE 9: Persist lifecycle metadata
            # ===================================
            lifecycle_metadata = self.lifecycle_manager.get_lifecycle_metadata(identity.report_id)
            if lifecycle_metadata:
                self.persistence_store.save_lifecycle_metadata(
                    report_id=identity.report_id,
                    calculation_id=calculation_id,
                    lifecycle_metadata=lifecycle_metadata,
                )
                logger.debug(
                    f"[STAGE: PERSISTENCE] "
                    f"Saved lifecycle metadata for {identity.report_id}"
                )

            # STAGE 10: Create response
            # =========================
            metadata = ReportMetadata(
                report_id=identity.report_id,
                calculation_id=calculation_id,
                template_type=template_type,
                version="1.0",
                generated=generation_context.generated_timestamp,
                hash=identity.identity_hash,
                engine_version=engine_version,
                file_size_bytes=len(report_bytes),
            )

            response = ReportGenerationResponse(
                report_id=identity.report_id,
                status=ReportStatus.GENERATED,
                download_url=f"/api/reports/{identity.report_id}/download",
                metadata=metadata,
            )

            pipeline_duration_ms = (time.time() - pipeline_start) * 1000
            logger.info(
                f"[PIPELINE COMPLETE] "
                f"report_id={identity.report_id}, "
                f"total_duration={pipeline_duration_ms:.1f}ms"
            )

            return response, identity, report_context

        except Exception as e:
            logger.error(f"[PIPELINE ERROR] {str(e)}", exc_info=True)
            raise RuntimeError(f"Report generation pipeline failed: {str(e)}") from e

    def verify_determinism(
        self,
        calculation_id: str,
        calculation_result: CalculationResult,
        original_identity: ReportIdentity,
        generation_context: ReportGenerationContext,
    ) -> tuple[bool, Optional[str]]:
        """
        Verify that re-running with same inputs produces same identity.

        Used for determinism testing and reproducibility verification.
        """
        is_valid, error = self.identity_generator.verify_identity(
            identity=original_identity,
            calculation_result=calculation_result,
            context=generation_context,
        )

        if not is_valid:
            logger.warning(f"Determinism verification failed: {error}")
            return False, error

        logger.info(f"Determinism verified for {calculation_id}")
        return True, None

    def get_pipeline_stats(self) -> Dict[str, Any]:
        """Get current pipeline statistics."""
        return {
            "total_reports_generated": len(self.lifecycle_manager.lifecycle_metadata),
            "total_lifecycle_events": len(self.lifecycle_manager.events_log),
        }
