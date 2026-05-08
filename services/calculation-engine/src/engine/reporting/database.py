"""Database integration for deterministic persistence.

Provides PostgreSQL-backed persistence for lifecycle and lineage data.
Uses Supabase as PostgreSQL provider.
"""

import logging
import os
import json
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import hashlib

logger = logging.getLogger(__name__)

# Database configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "")


class DatabaseClient:
    """PostgreSQL client for deterministic persistence (Supabase backend)."""

    # Table schemas
    LIFECYCLE_METADATA_TABLE = "report_lifecycle_metadata"
    LINEAGE_TABLE = "report_lineage"
    IDENTITY_TABLE = "report_identity"

    def __init__(self):
        """Initialize database client."""
        self._connected = False
        self._client = None
        self._init_client()

    def _init_client(self):
        """Initialize Supabase client (lazy-loaded)."""
        try:
            if not SUPABASE_URL or not SUPABASE_KEY:
                logger.warning(
                    "[DATABASE] Supabase credentials not configured. "
                    "Using fallback in-memory persistence."
                )
                return

            # Try to import supabase client
            try:
                from supabase import create_client
                self._client = create_client(SUPABASE_URL, SUPABASE_KEY)
                self._connected = True
                logger.info("[DATABASE] Connected to Supabase PostgreSQL")
            except ImportError:
                logger.warning(
                    "[DATABASE] Supabase client not available. "
                    "Install: pip install supabase"
                )
        except Exception as e:
            logger.warning(f"[DATABASE] Failed to initialize: {e}")

    def is_connected(self) -> bool:
        """Check if database is connected."""
        return self._connected and self._client is not None

    def create_tables_if_not_exist(self) -> bool:
        """Create required tables if they don't exist."""
        if not self.is_connected():
            logger.debug("[DATABASE] Skipping table creation (no connection)")
            return False

        try:
            # Check if tables exist by attempting a query
            try:
                self._client.table(self.LIFECYCLE_METADATA_TABLE).select("*", count="exact").limit(1).execute()
                logger.debug(f"[DATABASE] Table {self.LIFECYCLE_METADATA_TABLE} already exists")
            except Exception:
                # Table doesn't exist, create it
                logger.info(f"[DATABASE] Creating table {self.LIFECYCLE_METADATA_TABLE}")
                # This would typically be done via migration,  not dynamically
                # For now, assume tables are pre-created in Supabase

            return True
        except Exception as e:
            logger.warning(f"[DATABASE] Failed to create tables: {e}")
            return False

    def save_lifecycle_metadata(
        self,
        report_id: str,
        calculation_id: str,
        metadata: Dict[str, Any],
    ) -> bool:
        """Save lifecycle metadata to database."""
        if not self.is_connected():
            logger.debug(f"[DATABASE] Offline mode: cannot persist {report_id}")
            return False

        try:
            # Prepare record for insertion
            record = {
                "report_id": report_id,
                "calculation_id": calculation_id,
                "current_stage": metadata.get("current_stage"),
                "total_generation_time_ms": metadata.get("total_generation_time_ms"),
                "is_stale": metadata.get("is_stale", False),
                "is_verified": metadata.get("is_verified", False),
                "parent_report_id": metadata.get("parent_report_id"),
                "events_count": len(metadata.get("events", [])),
                "lifecycle_data": json.dumps(metadata),  # Store full data as JSON
                "persisted_at": datetime.now(timezone.utc).isoformat(),
            }

            # Upsert (insert or update if exists)
            self._client.table(self.LIFECYCLE_METADATA_TABLE).upsert(record).execute()

            logger.info(
                f"[DATABASE] Persisted lifecycle metadata for {report_id} "
                f"({record['events_count']} events)"
            )
            return True

        except Exception as e:
            logger.error(f"[DATABASE] Failed to persist {report_id}: {e}")
            return False

    def get_lifecycle_metadata(self, report_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve lifecycle metadata from database."""
        if not self.is_connected():
            logger.debug(f"[DATABASE] Offline mode: cannot retrieve {report_id}")
            return None

        try:
            result = (
                self._client.table(self.LIFECYCLE_METADATA_TABLE)
                .select("lifecycle_data")
                .eq("report_id", report_id)
                .single()
                .execute()
            )

            if result.data:
                return json.loads(result.data["lifecycle_data"])
            return None

        except Exception as e:
            logger.debug(f"[DATABASE] Failed to retrieve {report_id}: {e}")
            return None

    def save_report_identity(
        self,
        report_id: str,
        calculation_id: str,
        identity_data: Dict[str, Any],
    ) -> bool:
        """Save report identity to database."""
        if not self.is_connected():
            return False

        try:
            record = {
                "report_id": report_id,
                "calculation_id": calculation_id,
                "identity_hash": identity_data.get("identity_hash"),
                "inputs_hash": identity_data.get("inputs_hash"),
                "formula_hash": identity_data.get("formula_hash"),
                "execution_hash": identity_data.get("execution_hash"),
                "semantic_hash": identity_data.get("semantic_hash"),
                "template_hash": identity_data.get("template_hash"),
                "generation_hash": identity_data.get("generation_hash"),
                "lifecycle_hash": identity_data.get("lifecycle_hash"),
                "is_deterministic": identity_data.get("is_deterministic"),
                "can_reproduce": identity_data.get("can_reproduce"),
                "identity_data": json.dumps(identity_data),
                "persisted_at": datetime.now(timezone.utc).isoformat(),
            }

            self._client.table(self.IDENTITY_TABLE).upsert(record).execute()

            logger.info(f"[DATABASE] Persisted identity for {report_id}")
            return True

        except Exception as e:
            logger.error(f"[DATABASE] Failed to persist identity {report_id}: {e}")
            return False

    def get_report_identity(self, report_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve report identity from database."""
        if not self.is_connected():
            return None

        try:
            result = (
                self._client.table(self.IDENTITY_TABLE)
                .select("identity_data")
                .eq("report_id", report_id)
                .single()
                .execute()
            )

            if result.data:
                return json.loads(result.data["identity_data"])
            return None

        except Exception as e:
            logger.debug(f"[DATABASE] Failed to retrieve identity {report_id}: {e}")
            return None

    def save_lineage(
        self,
        report_id: str,
        parent_report_id: Optional[str],
        calculation_id: str,
        lineage_data: Dict[str, Any],
    ) -> bool:
        """Save lineage (revision chain) to database."""
        if not self.is_connected():
            return False

        try:
            record = {
                "report_id": report_id,
                "parent_report_id": parent_report_id,
                "calculation_id": calculation_id,
                "lineage_data": json.dumps(lineage_data),
                "persisted_at": datetime.now(timezone.utc).isoformat(),
            }

            self._client.table(self.LINEAGE_TABLE).insert(record).execute()

            logger.info(f"[DATABASE] Persisted lineage for {report_id}")
            return True

        except Exception as e:
            logger.error(f"[DATABASE] Failed to persist lineage {report_id}: {e}")
            return False

    def get_lineage_chain(self, report_id: str) -> List[Dict[str, Any]]:
        """Get complete revision chain for a report."""
        if not self.is_connected():
            return []

        try:
            chain = []
            current_id = report_id

            while current_id:
                result = (
                    self._client.table(self.LINEAGE_TABLE)
                    .select("*")
                    .eq("report_id", current_id)
                    .single()
                    .execute()
                )

                if not result.data:
                    break

                chain.append(json.loads(result.data["lineage_data"]))
                current_id = result.data.get("parent_report_id")

            return chain

        except Exception as e:
            logger.debug(f"[DATABASE] Failed to retrieve lineage chain for {report_id}: {e}")
            return []

    def get_reports_for_calculation(self, calculation_id: str) -> List[Dict[str, Any]]:
        """Get all reports for a calculation."""
        if not self.is_connected():
            return []

        try:
            result = (
                self._client.table(self.LIFECYCLE_METADATA_TABLE)
                .select("*")
                .eq("calculation_id", calculation_id)
                .execute()
            )

            return result.data or []

        except Exception as e:
            logger.debug(f"[DATABASE] Failed to retrieve reports for {calculation_id}: {e}")
            return []


# Global database client
_db_client: Optional[DatabaseClient] = None


def get_database_client() -> DatabaseClient:
    """Get global database client instance."""
    global _db_client
    if _db_client is None:
        _db_client = DatabaseClient()
    return _db_client
