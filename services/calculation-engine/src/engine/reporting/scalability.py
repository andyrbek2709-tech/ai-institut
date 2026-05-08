"""Scalability management for reporting system - bounded storage, cleanup, archival."""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class StorageQuota:
    """Storage quota configuration."""
    max_reports_in_memory: int = 1000  # Max concurrent reports
    max_lifecycle_events_per_report: int = 100  # Max events per report lifecycle
    max_traceability_entries: int = 10000  # Max revision/lineage entries
    max_persistence_store_size: int = 50000  # Max metadata records
    retention_days: int = 30  # How long to keep old reports
    cleanup_threshold_percent: float = 90.0  # Trigger cleanup at 90% capacity


class ScalabilityManager:
    """Manages storage limits, cleanup, and archival for reporting system."""

    def __init__(self, quota: Optional[StorageQuota] = None):
        """
        Initialize scalability manager.

        Args:
            quota: Storage quota configuration (defaults to StorageQuota())
        """
        self.quota = quota or StorageQuota()
        self.stats = {
            "total_reports_generated": 0,
            "total_archived": 0,
            "total_cleaned": 0,
            "last_cleanup": None,
        }

    def check_capacity(
        self,
        current_size: int,
        quota_limit: int,
    ) -> tuple[bool, float]:
        """
        Check if current usage is near quota limit.

        Args:
            current_size: Current usage
            quota_limit: Maximum allowed

        Returns:
            (is_healthy, percent_used)
        """
        percent = (current_size / quota_limit) * 100 if quota_limit > 0 else 0
        is_healthy = percent < self.quota.cleanup_threshold_percent
        return is_healthy, percent

    def should_cleanup(self, current_size: int, quota_limit: int) -> bool:
        """Determine if cleanup is needed."""
        is_healthy, percent = self.check_capacity(current_size, quota_limit)
        should_clean = not is_healthy
        if should_clean:
            logger.warning(
                f"[SCALABILITY] Storage at {percent:.1f}% capacity "
                f"({current_size}/{quota_limit}), cleanup recommended"
            )
        return should_clean

    def cleanup_old_reports(
        self,
        reports: Dict[str, Dict[str, Any]],
        days_old: Optional[int] = None,
    ) -> int:
        """
        Remove reports older than retention period.

        Args:
            reports: Report dict {report_id: metadata}
            days_old: Remove reports older than this (defaults to quota.retention_days)

        Returns:
            Number of reports removed
        """
        days_old = days_old or self.quota.retention_days
        cutoff = datetime.now(timezone.utc) - timedelta(days=days_old)
        cutoff_iso = cutoff.isoformat()

        removed = 0
        to_remove = []

        for report_id, metadata in reports.items():
            persisted_at = metadata.get("persisted_at")
            generated_at = metadata.get("generated_at")

            # Check persisted time first, fall back to generated time
            check_time = persisted_at or generated_at
            if check_time and check_time < cutoff_iso:
                to_remove.append(report_id)

        for report_id in to_remove:
            del reports[report_id]
            removed += 1

        if removed > 0:
            self.stats["total_cleaned"] += removed
            self.stats["last_cleanup"] = datetime.now(timezone.utc).isoformat()
            logger.info(
                f"[SCALABILITY] Cleaned up {removed} reports "
                f"(older than {days_old} days)"
            )

        return removed

    def archive_old_reports(
        self,
        reports: Dict[str, Dict[str, Any]],
        days_old: Optional[int] = None,
    ) -> List[str]:
        """
        Identify reports ready for archival (old but might be needed).

        Args:
            reports: Report dict
            days_old: Archive reports older than this (defaults to quota.retention_days * 2)

        Returns:
            List of report IDs ready for archival
        """
        days_old = days_old or (self.quota.retention_days * 2)
        cutoff = datetime.now(timezone.utc) - timedelta(days=days_old)
        cutoff_iso = cutoff.isoformat()

        archive_candidates = []

        for report_id, metadata in reports.items():
            persisted_at = metadata.get("persisted_at")
            generated_at = metadata.get("generated_at")
            check_time = persisted_at or generated_at

            if check_time and check_time < cutoff_iso:
                archive_candidates.append(report_id)

        logger.debug(
            f"[SCALABILITY] Identified {len(archive_candidates)} reports "
            f"for archival (older than {days_old} days)"
        )

        return archive_candidates

    def get_storage_pressure(self) -> Dict[str, Any]:
        """
        Get current storage pressure metrics.

        Returns:
            {component: {current, limit, percent, healthy}}
        """
        return {
            "quota_config": {
                "max_reports": self.quota.max_reports_in_memory,
                "max_events_per_report": self.quota.max_lifecycle_events_per_report,
                "max_traceability": self.quota.max_traceability_entries,
                "max_persistence": self.quota.max_persistence_store_size,
                "retention_days": self.quota.retention_days,
                "cleanup_threshold": self.quota.cleanup_threshold_percent,
            },
            "stats": self.stats.copy(),
        }

    def get_recommendations(
        self,
        reports_count: int,
        events_total: int,
        traceability_count: int,
    ) -> List[str]:
        """
        Get scalability recommendations based on current usage.

        Args:
            reports_count: Current number of reports in memory
            events_total: Total lifecycle events across all reports
            traceability_count: Total traceability entries

        Returns:
            List of recommendations
        """
        recommendations = []

        # Check reports
        reports_percent = (reports_count / self.quota.max_reports_in_memory) * 100
        if reports_percent > 80:
            recommendations.append(
                f"Reports at {reports_percent:.0f}% capacity ({reports_count}/{self.quota.max_reports_in_memory}). "
                f"Clean up old reports or increase quota."
            )

        # Check events
        avg_events = events_total / max(reports_count, 1)
        if avg_events > self.quota.max_lifecycle_events_per_report:
            recommendations.append(
                f"Average {avg_events:.1f} events per report exceeds quota "
                f"({self.quota.max_lifecycle_events_per_report}). Archive old events or increase quota."
            )

        # Check traceability
        traceability_percent = (traceability_count / self.quota.max_traceability_entries) * 100
        if traceability_percent > 80:
            recommendations.append(
                f"Traceability at {traceability_percent:.0f}% capacity. "
                f"Archive or consolidate revision history."
            )

        if not recommendations:
            recommendations.append("Storage usage healthy. No immediate action needed.")

        return recommendations


class ArchivalStrategy:
    """Strategy for archiving old reports to external storage."""

    def __init__(self, archive_location: str = "s3://reports-archive/"):
        """
        Initialize archival strategy.

        Args:
            archive_location: Where to store archived reports (S3, file system, etc.)
        """
        self.archive_location = archive_location
        self.archived_reports = []

    def archive_report(
        self,
        report_id: str,
        metadata: Dict[str, Any],
        lifecycle_metadata: Dict[str, Any],
    ) -> bool:
        """
        Archive a report to external storage.

        Args:
            report_id: Report to archive
            metadata: Report metadata
            lifecycle_metadata: Lifecycle events

        Returns:
            True if archived successfully
        """
        try:
            # In production: write to S3 bucket
            # For now: just track archival
            archive_entry = {
                "report_id": report_id,
                "archived_at": datetime.now(timezone.utc).isoformat(),
                "archive_location": f"{self.archive_location}{report_id}",
                "metadata_size_kb": len(str(metadata)) / 1024,
                "lifecycle_size_kb": len(str(lifecycle_metadata)) / 1024,
            }
            self.archived_reports.append(archive_entry)

            logger.info(
                f"[ARCHIVAL] Archived report {report_id} to {archive_entry['archive_location']}"
            )
            return True

        except Exception as e:
            logger.error(f"[ARCHIVAL] Failed to archive {report_id}: {e}")
            return False

    def restore_report(self, report_id: str) -> Optional[Dict[str, Any]]:
        """
        Restore an archived report.

        Args:
            report_id: Report to restore

        Returns:
            Restored metadata, or None if not found
        """
        # In production: fetch from S3
        archive_entry = next(
            (r for r in self.archived_reports if r["report_id"] == report_id),
            None
        )

        if archive_entry:
            logger.info(f"[ARCHIVAL] Restored report {report_id}")
            return archive_entry

        logger.warning(f"[ARCHIVAL] Report {report_id} not found in archive")
        return None


# Global scalability manager
_scalability_manager: Optional[ScalabilityManager] = None


def get_scalability_manager(quota: Optional[StorageQuota] = None) -> ScalabilityManager:
    """Get global scalability manager instance."""
    global _scalability_manager
    if _scalability_manager is None:
        _scalability_manager = ScalabilityManager(quota)
    return _scalability_manager
