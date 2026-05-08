"""Report traceability - tracks report lineage, revisions, and regeneration history."""

import logging
from typing import Optional, Dict, List, Any
from datetime import datetime, timezone
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class RevisionHistory:
    """Single entry in report revision history."""
    original_report_id: str
    revision_number: int
    revision_report_id: str
    created_at: str  # ISO format, UTC
    reason: str  # e.g., "calculation_updated", "template_updated", "manual_revision"
    changed_fields: List[str] = field(default_factory=list)  # e.g., ["inputs", "formulas"]


@dataclass
class ReportLineage:
    """Lineage tracking for a report."""
    report_id: str
    calculation_id: str

    # Original creation
    original_generation_timestamp: str
    original_generator_id: str

    # Revision history
    revisions: List[RevisionHistory] = field(default_factory=list)
    is_current_revision: bool = True

    # Regeneration tracking
    regeneration_count: int = 0
    last_regeneration_timestamp: Optional[str] = None
    regeneration_reasons: List[str] = field(default_factory=list)

    # Parent linkage
    parent_report_id: Optional[str] = None
    child_reports: List[str] = field(default_factory=list)


class TraceabilityManager:
    """Manages report traceability, lineage, and revision history."""

    def __init__(self):
        """Initialize traceability manager."""
        # {report_id: ReportLineage}
        self.lineage_store: Dict[str, ReportLineage] = {}
        # {calculation_id: [report_ids]} for efficient lookup
        self.calculation_reports: Dict[str, List[str]] = {}

    def create_lineage(
        self,
        report_id: str,
        calculation_id: str,
        generator_id: str = "unknown",
    ) -> ReportLineage:
        """
        Create initial lineage entry for a report.

        Args:
            report_id: Report identifier
            calculation_id: Source calculation ID
            generator_id: Who generated (e.g., "api_v1", "batch_job")

        Returns:
            ReportLineage entry
        """
        lineage = ReportLineage(
            report_id=report_id,
            calculation_id=calculation_id,
            original_generation_timestamp=datetime.now(timezone.utc).isoformat(),
            original_generator_id=generator_id,
        )

        self.lineage_store[report_id] = lineage

        # Track calculation → reports mapping
        if calculation_id not in self.calculation_reports:
            self.calculation_reports[calculation_id] = []
        self.calculation_reports[calculation_id].append(report_id)

        logger.info(f"[TRACEABILITY] Created lineage for report {report_id}")
        return lineage

    def record_revision(
        self,
        original_report_id: str,
        new_report_id: str,
        reason: str,
        changed_fields: Optional[List[str]] = None,
    ) -> Optional[ReportLineage]:
        """
        Record report revision (updated report with same calculation).

        Args:
            original_report_id: Original report ID
            new_report_id: New revision report ID
            reason: Why revision was created
            changed_fields: Which fields changed

        Returns:
            Updated ReportLineage for new report
        """
        if original_report_id not in self.lineage_store:
            logger.warning(f"[TRACEABILITY] Original report {original_report_id} not found")
            return None

        original_lineage = self.lineage_store[original_report_id]

        # Mark original as not current
        original_lineage.is_current_revision = False

        # Create new revision lineage
        new_lineage = ReportLineage(
            report_id=new_report_id,
            calculation_id=original_lineage.calculation_id,
            original_generation_timestamp=original_lineage.original_generation_timestamp,
            original_generator_id=original_lineage.original_generator_id,
            parent_report_id=original_report_id,
        )

        # Record revision in original lineage
        revision_entry = RevisionHistory(
            original_report_id=original_report_id,
            revision_number=len(original_lineage.revisions) + 1,
            revision_report_id=new_report_id,
            created_at=datetime.now(timezone.utc).isoformat(),
            reason=reason,
            changed_fields=changed_fields or [],
        )
        original_lineage.revisions.append(revision_entry)
        original_lineage.child_reports.append(new_report_id)

        # Copy revision history to new lineage
        new_lineage.revisions = original_lineage.revisions.copy()

        self.lineage_store[new_report_id] = new_lineage

        # Update calculation → reports mapping
        if original_lineage.calculation_id not in self.calculation_reports:
            self.calculation_reports[original_lineage.calculation_id] = []
        self.calculation_reports[original_lineage.calculation_id].append(new_report_id)

        logger.info(
            f"[TRACEABILITY] Recorded revision: {original_report_id} → {new_report_id} "
            f"(reason: {reason})"
        )

        return new_lineage

    def record_regeneration(
        self,
        report_id: str,
        reason: str,
    ) -> bool:
        """
        Record regeneration of a report (same report ID, re-executed).

        Occurs when calculation is updated after report was generated,
        and report is regenerated with same ID.

        Args:
            report_id: Report that was regenerated
            reason: Why regeneration occurred

        Returns:
            True if recorded successfully
        """
        if report_id not in self.lineage_store:
            logger.warning(f"[TRACEABILITY] Report {report_id} not found")
            return False

        lineage = self.lineage_store[report_id]
        lineage.regeneration_count += 1
        lineage.last_regeneration_timestamp = datetime.now(timezone.utc).isoformat()
        lineage.regeneration_reasons.append(reason)

        logger.info(
            f"[TRACEABILITY] Regeneration recorded for {report_id} "
            f"(count: {lineage.regeneration_count}, reason: {reason})"
        )

        return True

    def get_lineage(self, report_id: str) -> Optional[ReportLineage]:
        """Retrieve lineage for a report."""
        return self.lineage_store.get(report_id)

    def get_reports_for_calculation(self, calculation_id: str) -> List[str]:
        """Get all report IDs for a calculation (all revisions)."""
        return self.calculation_reports.get(calculation_id, [])

    def get_current_report(self, calculation_id: str) -> Optional[str]:
        """Get the current (latest) report for a calculation."""
        reports = self.get_reports_for_calculation(calculation_id)
        if not reports:
            return None

        # Find the current revision (is_current_revision=True)
        for report_id in reports:
            lineage = self.get_lineage(report_id)
            if lineage and lineage.is_current_revision:
                return report_id

        # Fallback: return last one
        return reports[-1]

    def get_revision_chain(self, report_id: str) -> List[str]:
        """Get chain of report IDs: original → revision1 → revision2 → ..."""
        lineage = self.get_lineage(report_id)
        if not lineage:
            return []

        chain = [report_id]

        # Add all revisions in order
        for revision in lineage.revisions:
            chain.append(revision.revision_report_id)

        return chain

    def is_stale(
        self,
        report_id: str,
        calculation_update_time: str,  # ISO format
    ) -> bool:
        """
        Check if report is stale (source calculation changed after report generation).

        Args:
            report_id: Report to check
            calculation_update_time: When calculation was last updated

        Returns:
            True if report is older than calculation update
        """
        lineage = self.get_lineage(report_id)
        if not lineage:
            return False

        # Check original generation time vs calculation update
        if lineage.original_generation_timestamp < calculation_update_time:
            return True

        # Check latest regeneration time
        if lineage.last_regeneration_timestamp:
            if lineage.last_regeneration_timestamp < calculation_update_time:
                return True

        return False

    def get_traceability_summary(self, report_id: str) -> Dict[str, Any]:
        """Get human-readable traceability summary."""
        lineage = self.get_lineage(report_id)
        if not lineage:
            return {}

        summary = {
            "report_id": report_id,
            "calculation_id": lineage.calculation_id,
            "created_at": lineage.original_generation_timestamp,
            "generator_id": lineage.original_generator_id,
            "is_current_revision": lineage.is_current_revision,
            "parent_report_id": lineage.parent_report_id,
            "revision_count": len(lineage.revisions),
            "regeneration_count": lineage.regeneration_count,
            "last_regeneration": lineage.last_regeneration_timestamp,
            "regeneration_reasons": lineage.regeneration_reasons,
            "child_reports": lineage.child_reports,
        }

        return summary


# Global traceability manager
_traceability_manager: Optional[TraceabilityManager] = None


def get_traceability_manager() -> TraceabilityManager:
    """Get global traceability manager instance."""
    global _traceability_manager
    if _traceability_manager is None:
        _traceability_manager = TraceabilityManager()
    return _traceability_manager
