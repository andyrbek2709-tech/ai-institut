"""Lifecycle persistence layer - saves report lifecycle events to database.

Minimal foundation for deterministic persistence without enterprise workflow DB.
Uses PostgreSQL (Supabase) as primary storage, with in-memory fallback.
"""

import logging
import json
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from dataclasses import asdict

from .lifecycle import ReportLifecycleMetadata, ReportLifecycleEvent, ReportLifecycleStage
from .database import get_database_client

logger = logging.getLogger(__name__)


class LifecyclePersistenceStore:
    """
    Stores and retrieves report lifecycle metadata.

    Primary: PostgreSQL (Supabase) via DatabaseClient
    Fallback: In-memory dict (if database unavailable)
    """

    def __init__(self):
        """Initialize persistence store."""
        self._db = get_database_client()
        # In-memory fallback storage
        self._storage: Dict[str, Dict[str, Any]] = {}

    def save_lifecycle_metadata(
        self,
        report_id: str,
        calculation_id: str,
        lifecycle_metadata: ReportLifecycleMetadata
    ) -> bool:
        """
        Save lifecycle metadata for a report.

        Primary: PostgreSQL (Supabase)
        Fallback: In-memory storage

        Args:
            report_id: Report identifier
            calculation_id: Source calculation identifier
            lifecycle_metadata: Complete lifecycle metadata

        Returns:
            True if saved successfully
        """
        try:
            # Convert to serializable format
            serialized = {
                "report_id": lifecycle_metadata.report_id,
                "calculation_id": lifecycle_metadata.calculation_id,
                "current_stage": lifecycle_metadata.current_stage.value,
                "total_generation_time_ms": lifecycle_metadata.total_generation_time_ms,
                "is_stale": lifecycle_metadata.is_stale,
                "is_verified": lifecycle_metadata.is_verified,
                "parent_report_id": lifecycle_metadata.parent_report_id,
                "audit_events": lifecycle_metadata.audit_events,
                "events": [
                    {
                        "stage": event.stage.value,
                        "timestamp": event.timestamp,
                        "duration_ms": event.duration_ms,
                        "generator_id": event.generator_id,
                        "error_message": event.error_message,
                        "metadata": event.metadata,
                    }
                    for event in lifecycle_metadata.events
                ],
                "context": {
                    "calculation_id": lifecycle_metadata.context.calculation_id,
                    "calculation_timestamp": lifecycle_metadata.context.calculation_timestamp,
                    "template_type": lifecycle_metadata.context.template_type,
                    "template_version": lifecycle_metadata.context.template_version,
                    "engine_version": lifecycle_metadata.context.engine_version,
                    "runner_version": lifecycle_metadata.context.runner_version,
                    "generated_timestamp": lifecycle_metadata.context.generated_timestamp,
                    "generator_id": lifecycle_metadata.context.generator_id,
                    "execution_time_ms": lifecycle_metadata.context.execution_time_ms,
                    "validation_status": lifecycle_metadata.context.validation_status,
                    "audit_trail_present": lifecycle_metadata.context.audit_trail_present,
                    "semantic_validation_enabled": lifecycle_metadata.context.semantic_validation_enabled,
                },
                "persisted_at": datetime.now(timezone.utc).isoformat(),
            }

            # Try to save to database first
            db_saved = self._db.save_lifecycle_metadata(
                report_id=report_id,
                calculation_id=calculation_id,
                metadata=serialized,
            )

            # Always also save to in-memory fallback
            self._storage[report_id] = serialized

            logger.info(
                f"[LIFECYCLE PERSISTENCE] Saved metadata for report {report_id} "
                f"({len(lifecycle_metadata.events)} events) "
                f"(db: {'✓' if db_saved else '✗'})"
            )

            return True

        except Exception as e:
            logger.error(f"[LIFECYCLE PERSISTENCE ERROR] Failed to save {report_id}: {e}")
            return False

    def get_lifecycle_metadata(self, report_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve lifecycle metadata for a report.

        Primary: PostgreSQL (Supabase)
        Fallback: In-memory storage

        Args:
            report_id: Report identifier

        Returns:
            Serialized lifecycle metadata, or None if not found
        """
        # Try database first
        db_result = self._db.get_lifecycle_metadata(report_id)
        if db_result:
            return db_result

        # Fallback to in-memory
        if report_id not in self._storage:
            logger.debug(f"[LIFECYCLE PERSISTENCE] No metadata found for {report_id}")
            return None

        return self._storage[report_id]

    def get_lifecycle_events(self, report_id: str) -> List[Dict[str, Any]]:
        """
        Retrieve events for a report.

        Args:
            report_id: Report identifier

        Returns:
            List of lifecycle events
        """
        metadata = self.get_lifecycle_metadata(report_id)
        if not metadata:
            return []

        return metadata.get("events", [])

    def get_events_by_stage(self, report_id: str, stage: str) -> List[Dict[str, Any]]:
        """
        Retrieve events at specific stage.

        Args:
            report_id: Report identifier
            stage: Stage name (e.g., "context_building", "document_rendering")

        Returns:
            List of events at this stage
        """
        events = self.get_lifecycle_events(report_id)
        return [e for e in events if e.get("stage") == stage]

    def get_reports_by_calculation(self, calculation_id: str) -> List[str]:
        """
        Find all reports for a calculation.

        Args:
            calculation_id: Calculation identifier

        Returns:
            List of report IDs
        """
        reports = []
        for report_id, metadata in self._storage.items():
            if metadata.get("calculation_id") == calculation_id:
                reports.append(report_id)
        return reports

    def mark_verified(self, report_id: str) -> bool:
        """
        Mark report as verified (integrity checks passed).

        Args:
            report_id: Report identifier

        Returns:
            True if marked successfully
        """
        if report_id not in self._storage:
            logger.warning(f"[LIFECYCLE PERSISTENCE] Cannot verify unknown report {report_id}")
            return False

        self._storage[report_id]["is_verified"] = True
        logger.debug(f"[LIFECYCLE PERSISTENCE] Marked {report_id} as verified")
        return True

    def mark_stale(self, report_id: str) -> bool:
        """
        Mark report as stale (source calculation changed).

        Args:
            report_id: Report identifier

        Returns:
            True if marked successfully
        """
        if report_id not in self._storage:
            return False

        self._storage[report_id]["is_stale"] = True
        logger.debug(f"[LIFECYCLE PERSISTENCE] Marked {report_id} as stale")
        return True

    def link_revision(self, original_report_id: str, revision_report_id: str) -> bool:
        """
        Link report revision to original.

        Args:
            original_report_id: Original report ID
            revision_report_id: Revision report ID

        Returns:
            True if linked successfully
        """
        if revision_report_id not in self._storage:
            return False

        self._storage[revision_report_id]["parent_report_id"] = original_report_id
        logger.debug(f"[LIFECYCLE PERSISTENCE] Linked {revision_report_id} → {original_report_id}")
        return True

    def get_generation_timeline(self, report_id: str) -> Dict[str, float]:
        """
        Get stage durations for report generation.

        Useful for performance analysis.

        Args:
            report_id: Report identifier

        Returns:
            {stage_name: duration_ms}
        """
        events = self.get_lifecycle_events(report_id)
        timeline = {}
        for event in events:
            stage = event.get("stage")
            duration = event.get("duration_ms", 0)
            timeline[stage] = duration
        return timeline

    def cleanup_old_reports(self, days_old: int = 30) -> int:
        """
        Clean up old report metadata (for scalability).

        Args:
            days_old: Remove reports older than this

        Returns:
            Number of reports removed
        """
        cutoff = datetime.now(timezone.utc)
        from datetime import timedelta
        cutoff_iso = (cutoff - timedelta(days=days_old)).isoformat()

        removed = 0
        to_remove = []

        for report_id, metadata in self._storage.items():
            persisted_at = metadata.get("persisted_at")
            if persisted_at and persisted_at < cutoff_iso:
                to_remove.append(report_id)
                removed += 1

        for report_id in to_remove:
            del self._storage[report_id]

        logger.info(f"[LIFECYCLE PERSISTENCE] Cleaned up {removed} old reports")
        return removed

    def get_stats(self) -> Dict[str, Any]:
        """Get persistence statistics."""
        return {
            "total_reports": len(self._storage),
            "total_events": sum(len(m.get("events", [])) for m in self._storage.values()),
        }


# Global persistence store
_persistence_store: Optional[LifecyclePersistenceStore] = None


def get_persistence_store() -> LifecyclePersistenceStore:
    """Get global lifecycle persistence store."""
    global _persistence_store
    if _persistence_store is None:
        _persistence_store = LifecyclePersistenceStore()
    return _persistence_store
