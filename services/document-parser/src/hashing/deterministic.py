"""Deterministic hashing for extraction reproducibility.

Adapted from calculation-engine/reporting/deterministic_hashing.py for extraction system.

Ensures:
- Canonical serialization (stable JSON ordering)
- Whitespace-independent hashing
- Floating-point consistency
- None vs empty differentiation
"""

import hashlib
import json
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class DeterministicHasher:
    """Produces stable, reproducible hashes for extraction components."""

    FLOAT_PRECISION = 12  # 12 decimal places
    NONE_MARKER = "__NONE__"
    EMPTY_DICT_MARKER = "__EMPTY_DICT__"
    EMPTY_LIST_MARKER = "__EMPTY_LIST__"

    @staticmethod
    def normalize_float(value: float, precision: int = FLOAT_PRECISION) -> float:
        """Normalize float to fixed precision."""
        if value is None or (isinstance(value, float) and value != value):  # NaN check
            return None
        return round(float(value), precision)

    @staticmethod
    def _is_iso_timestamp(value: str) -> bool:
        """Check if string is ISO 8601 timestamp."""
        try:
            return (
                len(value) >= 19
                and "T" in value
                and ("Z" in value or "+" in value or "-" in value[10:])
            )
        except (TypeError, AttributeError):
            return False

    @staticmethod
    def _normalize_iso_timestamp(value: str) -> str:
        """Normalize ISO timestamp to date only (remove microseconds/timezone)."""
        try:
            date_part = value.split("T")[0]
            return f"{date_part}T00:00:00Z"
        except (IndexError, AttributeError):
            return value

    @staticmethod
    def canonicalize_value(value: Any) -> Any:
        """Convert value to canonical form for stable hashing.

        Rules:
        - float → rounded to FLOAT_PRECISION
        - None → __NONE__ marker
        - {} → __EMPTY_DICT__ marker
        - [] → __EMPTY_LIST__ marker
        - ISO timestamp → normalize to date only
        - dict → sorted keys, recursively canonicalized
        - list → canonicalized elements (preserve order)
        """
        if value is None:
            return DeterministicHasher.NONE_MARKER

        if isinstance(value, float):
            normalized = DeterministicHasher.normalize_float(value)
            return (
                normalized
                if normalized is not None
                else DeterministicHasher.NONE_MARKER
            )

        if isinstance(value, dict):
            if not value:
                return DeterministicHasher.EMPTY_DICT_MARKER
            return {
                k: DeterministicHasher.canonicalize_value(v)
                for k, v in sorted(value.items())
            }

        if isinstance(value, (list, tuple)):
            if not value:
                return DeterministicHasher.EMPTY_LIST_MARKER
            return [DeterministicHasher.canonicalize_value(v) for v in value]

        if isinstance(value, str):
            if DeterministicHasher._is_iso_timestamp(value):
                return DeterministicHasher._normalize_iso_timestamp(value)
            return " ".join(value.split())

        return value

    @staticmethod
    def canonical_serialize(data: Any) -> str:
        """Serialize to canonical JSON string with stable ordering."""
        canonical = DeterministicHasher.canonicalize_value(data)

        try:
            json_str = json.dumps(
                canonical,
                sort_keys=True,
                separators=(",", ":"),
                default=str,
            )
            return json_str
        except (TypeError, ValueError) as e:
            logger.warning(
                f"Could not serialize to canonical JSON: {e}, using string fallback"
            )
            return str(canonical)

    @staticmethod
    def hash_canonical(data: Any) -> str:
        """Hash data using canonical serialization. Returns SHA256 hex."""
        canonical_json = DeterministicHasher.canonical_serialize(data)
        return hashlib.sha256(canonical_json.encode()).hexdigest()

    @staticmethod
    def hash_string(text: str) -> str:
        """Hash string with whitespace normalization."""
        normalized = " ".join(text.split())
        return hashlib.sha256(normalized.encode()).hexdigest()

    @staticmethod
    def hash_formula(formula: str) -> str:
        """Hash formula expression with whitespace normalization."""
        normalized = " ".join(formula.split())
        return DeterministicHasher.hash_string(normalized)

    @staticmethod
    def combine_hashes(*hashes: str) -> str:
        """Combine multiple hashes into one with order stability."""
        combined = "".join(hashes)
        return hashlib.sha256(combined.encode()).hexdigest()

    @staticmethod
    def verify_reproducibility(
        data: Any, expected_hash: str, tolerance: float = 0.0
    ) -> tuple[bool, Optional[str]]:
        """Verify that data produces expected hash.

        Args:
            data: Data to hash
            expected_hash: Expected SHA256 hash
            tolerance: Allowed floating-point difference (0 = exact)

        Returns:
            (is_valid, error_message)
        """
        actual_hash = DeterministicHasher.hash_canonical(data)

        if actual_hash == expected_hash:
            return True, None

        if tolerance > 0:
            logger.warning(
                f"Hash mismatch (strict). Trying with tolerance={tolerance}. "
                f"Expected: {expected_hash[:16]}..., Got: {actual_hash[:16]}..."
            )
            return False, f"Hash mismatch: {actual_hash} != {expected_hash}"

        return False, f"Hash mismatch: {actual_hash} != {expected_hash}"

    @staticmethod
    def get_hash_components(data: Dict[str, Any]) -> Dict[str, str]:
        """Hash individual components of a dict plus combined hash.

        Useful for debugging which part changed between runs.

        Returns: {key: hash_of_value, "__combined__": hash_of_all}
        """
        components = {}
        all_hashes = []

        for key in sorted(data.keys()):
            value_hash = DeterministicHasher.hash_canonical(data[key])
            components[key] = value_hash
            all_hashes.append(value_hash)

        components["__combined__"] = DeterministicHasher.combine_hashes(
            *all_hashes
        )
        return components
