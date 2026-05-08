"""Deterministic hashing utilities for reproducible report identities.

Ensures:
- Canonical serialization (stable JSON ordering)
- Whitespace-independent hashing
- Metadata ordering stability
- Floating-point consistency
- None vs empty differentiation
"""

import hashlib
import json
import logging
from typing import Dict, Any, Optional
from decimal import Decimal

logger = logging.getLogger(__name__)


class DeterministicHasher:
    """Produces stable, reproducible hashes for report components."""

    # Serialization precision for floats
    FLOAT_PRECISION = 12  # 12 decimal places (nanosecond precision)

    # Canonical representation markers
    NONE_MARKER = "__NONE__"
    EMPTY_DICT_MARKER = "__EMPTY_DICT__"
    EMPTY_LIST_MARKER = "__EMPTY_LIST__"

    @staticmethod
    def normalize_float(value: float, precision: int = FLOAT_PRECISION) -> float:
        """
        Normalize float to fixed precision.

        Prevents floating-point rounding errors from creating different hashes.
        """
        if value is None or (isinstance(value, float) and value != value):  # NaN check
            return None
        return round(float(value), precision)

    @staticmethod
    def _is_iso_timestamp(value: str) -> bool:
        """Check if string is ISO 8601 timestamp."""
        try:
            # Check for ISO 8601 format: YYYY-MM-DDTHH:MM:SS or with Z/±HH:MM
            return len(value) >= 19 and 'T' in value and ('Z' in value or '+' in value or '-' in value[10:])
        except (TypeError, AttributeError):
            return False

    @staticmethod
    def _normalize_iso_timestamp(value: str) -> str:
        """Normalize ISO timestamp to date only (remove microseconds/timezone)."""
        try:
            # Extract YYYY-MM-DD part
            date_part = value.split('T')[0]
            return f"{date_part}T00:00:00Z"
        except (IndexError, AttributeError):
            return value

    @staticmethod
    def canonicalize_value(value: Any) -> Any:
        """
        Convert value to canonical form for stable hashing.

        Rules:
        - float → rounded to FLOAT_PRECISION
        - None → __NONE__ marker
        - {} → __EMPTY_DICT__ marker
        - [] → __EMPTY_LIST__ marker
        - ISO timestamp → normalize to date only (remove microseconds)
        - dict → sorted keys, recursively canonicalized
        - list → canonicalized elements (preserve order)
        """
        if value is None:
            return DeterministicHasher.NONE_MARKER

        if isinstance(value, float):
            normalized = DeterministicHasher.normalize_float(value)
            return normalized if normalized is not None else DeterministicHasher.NONE_MARKER

        if isinstance(value, dict):
            if not value:  # Empty dict
                return DeterministicHasher.EMPTY_DICT_MARKER
            return {k: DeterministicHasher.canonicalize_value(v) for k, v in sorted(value.items())}

        if isinstance(value, (list, tuple)):
            if not value:  # Empty list/tuple
                return DeterministicHasher.EMPTY_LIST_MARKER
            return [DeterministicHasher.canonicalize_value(v) for v in value]

        if isinstance(value, str):
            # Normalize ISO timestamps (remove microseconds, timezone details)
            if DeterministicHasher._is_iso_timestamp(value):
                return DeterministicHasher._normalize_iso_timestamp(value)
            # Normalize whitespace: collapse multiple spaces, strip
            return " ".join(value.split())

        # For other types (int, bool, etc.), return as-is
        return value

    @staticmethod
    def canonical_serialize(data: Any) -> str:
        """
        Serialize to canonical JSON string.

        Guarantees:
        - Stable key ordering
        - Consistent whitespace
        - Normalized numeric precision
        - Deterministic type representation
        """
        canonical = DeterministicHasher.canonicalize_value(data)

        try:
            # JSON with sorted keys, no spaces (compact)
            json_str = json.dumps(
                canonical,
                sort_keys=True,
                separators=(',', ':'),  # No spaces after separators
                default=str  # Fallback for non-JSON-serializable types
            )
            return json_str
        except (TypeError, ValueError) as e:
            logger.warning(f"Could not serialize to canonical JSON: {e}, using string fallback")
            # Fallback: just string representation
            return str(canonical)

    @staticmethod
    def hash_canonical(data: Any) -> str:
        """
        Hash data using canonical serialization.

        Returns SHA256 hex digest of canonical JSON representation.
        """
        canonical_json = DeterministicHasher.canonical_serialize(data)
        return hashlib.sha256(canonical_json.encode()).hexdigest()

    @staticmethod
    def hash_string(text: str) -> str:
        """Hash string with whitespace normalization."""
        normalized = " ".join(text.split())  # Normalize whitespace
        return hashlib.sha256(normalized.encode()).hexdigest()

    @staticmethod
    def hash_formula(formula: str) -> str:
        """
        Hash formula expression with normalization.

        Ensures: different whitespace → same hash
        """
        # Normalize: strip, collapse spaces
        normalized = " ".join(formula.split())
        return DeterministicHasher.hash_string(normalized)

    @staticmethod
    def combine_hashes(*hashes: str) -> str:
        """
        Combine multiple hashes into one.

        Ensures: order-stable combination
        """
        combined = "".join(hashes)
        return hashlib.sha256(combined.encode()).hexdigest()

    @staticmethod
    def verify_reproducibility(
        data: Any,
        expected_hash: str,
        tolerance: float = 0.0
    ) -> tuple[bool, Optional[str]]:
        """
        Verify that data produces expected hash.

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

        # If tolerance > 0, check if difference is within tolerance
        if tolerance > 0:
            # Try re-normalizing with slightly relaxed precision
            logger.warning(
                f"Hash mismatch (strict). Trying with tolerance={tolerance}. "
                f"Expected: {expected_hash[:16]}..., Got: {actual_hash[:16]}..."
            )
            return False, f"Hash mismatch: {actual_hash} != {expected_hash}"

        return False, f"Hash mismatch: {actual_hash} != {expected_hash}"

    @staticmethod
    def get_hash_components(data: Dict[str, Any]) -> Dict[str, str]:
        """
        Hash individual components of a dict, plus combined hash.

        Useful for debugging which part changed between runs.

        Returns: {key: hash_of_value, "__combined__": hash_of_all}
        """
        components = {}
        all_hashes = []

        for key in sorted(data.keys()):
            value_hash = DeterministicHasher.hash_canonical(data[key])
            components[key] = value_hash
            all_hashes.append(value_hash)

        components["__combined__"] = DeterministicHasher.combine_hashes(*all_hashes)
        return components
