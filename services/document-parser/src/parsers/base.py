"""Abstract base parser class enforcing deterministic contract.

All concrete parsers MUST:
- Be deterministic (same input → same output)
- Be stateless (no shared state between parses)
- Be runtime-independent (no timestamps, machine IDs in extraction_hash)
- Implement the determinism contract
"""

from abc import ABC, abstractmethod
from typing import Optional, List
import hashlib
import logging
from ..models.payload import (
    DeterministicPayload,
    RuntimeMetadata,
    LogicalChunk,
)
from ..hashing.deterministic import DeterministicHasher

logger = logging.getLogger(__name__)


class BaseParser(ABC):
    """Abstract deterministic parser.

    Subclasses must implement parse_deterministic() which produces
    DeterministicPayload without runtime leakage.
    """

    PARSER_VERSION = "0.1.0"
    PARSER_NAME: str = "BaseParser"

    @abstractmethod
    def parse_deterministic(
        self, file_bytes: bytes, document_id: str
    ) -> DeterministicPayload:
        """Extract deterministic payload from file.

        Args:
            file_bytes: Raw file content
            document_id: SHA256 of file_bytes (precomputed for determinism)

        Returns:
            DeterministicPayload with no runtime context

        Contract:
        - Must be deterministic: f(x) = f(x) for identical inputs
        - Must be stateless: parser has no state between calls
        - Must be runtime-independent: no timestamps, randomness, machine IDs
        - Must validate normalization is applied correctly
        - Must have chunks in stable order
        """
        pass

    def parse(
        self,
        file_bytes: bytes,
        document_id: Optional[str] = None,
        generator_id: str = "system",
    ) -> tuple[DeterministicPayload, RuntimeMetadata]:
        """Parse file and return both deterministic payload and runtime metadata.

        Args:
            file_bytes: Raw file bytes
            document_id: Optional pre-computed SHA256. If None, computed here.
            generator_id: Who triggered this parsing (api, batch_job, etc.)

        Returns:
            (DeterministicPayload, RuntimeMetadata)

        Timing:
        - Deterministic payload is reproducible across runs
        - Runtime metadata tracks execution context only
        """
        import time
        from datetime import datetime, timezone
        import platform
        import sys

        # Compute document ID if not provided (deterministic from file)
        if document_id is None:
            document_id = hashlib.sha256(file_bytes).hexdigest()

        start_time = time.time()

        # Parse to deterministic payload
        payload = self.parse_deterministic(file_bytes, document_id)

        # Verify determinism contract
        is_valid, error = payload.validate_determinism()
        if not is_valid:
            raise ValueError(f"Payload determinism violation: {error}")

        # Build runtime metadata (NOT in extraction hash)
        duration_ms = (time.time() - start_time) * 1000

        # Generate extraction ID (unique to this extraction attempt)
        extraction_id = f"{document_id[:16]}_{int(time.time() * 1000) % 100000}"

        metadata = RuntimeMetadata(
            extraction_id=extraction_id,
            extraction_timestamp=datetime.now(timezone.utc).isoformat(),
            extraction_duration_ms=duration_ms,
            generator_id=generator_id,
            parser_version=self.PARSER_VERSION,
            engine_version="0.1.0",
            python_version=f"{sys.version_info.major}.{sys.version_info.minor}",
            extraction_method=self._get_extraction_method(),
        )

        logger.info(
            f"{self.PARSER_NAME} parsed {document_id[:16]}: "
            f"{payload.page_count} pages, {payload.word_count} words, "
            f"{len(payload.logical_chunks)} chunks in {duration_ms:.1f}ms"
        )

        return payload, metadata

    @abstractmethod
    def _get_extraction_method(self) -> str:
        """Return extraction method name (e.g., 'docx_xml', 'openpyxl')."""
        pass

    def verify_determinism(
        self, file_bytes: bytes, document_id: str, num_runs: int = 5
    ) -> tuple[bool, Optional[str]]:
        """Verify parser is deterministic by running multiple times.

        Args:
            file_bytes: File to parse
            document_id: Document ID
            num_runs: Number of repeated parses

        Returns:
            (is_deterministic, error_message)
        """
        hashes = []

        for i in range(num_runs):
            payload = self.parse_deterministic(file_bytes, document_id)
            extraction_hash = payload.extraction_hash()
            hashes.append(extraction_hash)

        # All hashes should be identical
        unique_hashes = set(hashes)
        if len(unique_hashes) != 1:
            return (
                False,
                f"Non-deterministic: {len(unique_hashes)} different hashes in {num_runs} runs",
            )

        logger.info(f"{self.PARSER_NAME} determinism verified: {hashes[0][:16]}...")
        return True, None

    def _normalize_text(self, text: str) -> str:
        """Apply deterministic text normalization (shared across parsers).

        Per PARSER_DETERMINISM_CONTRACT:
        - Unicode NFC normalization
        - Whitespace normalization
        - Line ending normalization
        - Control character removal
        """
        import unicodedata
        import re

        # Unicode NFC
        text = unicodedata.normalize("NFC", text)

        # Whitespace normalization (per contract)
        lines = []
        for line in text.split("\n"):
            # Strip trailing whitespace
            line = line.rstrip()
            # Collapse consecutive spaces
            line = re.sub(r"  +", " ", line)
            # Convert tabs to 4 spaces
            line = line.replace("\t", "    ")
            lines.append(line)

        text = "\n".join(lines)

        # Collapse excessive blank lines (max 2 newlines)
        text = re.sub(r"\n{3,}", "\n\n", text)

        # Remove control characters (except newline, tab)
        text = "".join(c for c in text if ord(c) >= 0x20 or c in "\n\t")

        # Final trim
        text = text.strip()

        return text

    def _create_logical_chunks(
        self, text: str, chunks: List[dict]
    ) -> List[LogicalChunk]:
        """Convert parsed chunks to LogicalChunk objects with stable ordering.

        Args:
            text: Full normalized text
            chunks: List of dicts with keys:
                - content: str
                - chunk_type: str
                - source_page_start: int (or -1)
                - source_page_end: int (or -1)
                - hierarchy_level: int
                - hierarchy_path: List[str]

        Returns:
            Sorted list of LogicalChunk objects
        """
        logical_chunks = []

        for i, chunk_data in enumerate(chunks):
            # Generate deterministic chunk ID
            content_hash = hashlib.sha256(
                chunk_data["content"].encode("utf-8")
            ).hexdigest()
            chunk_id = f"{content_hash[:8]}_{i:05d}"

            chunk = LogicalChunk(
                chunk_id=chunk_id,
                content=chunk_data["content"],
                chunk_type=chunk_data.get("chunk_type", "paragraph"),
                source_page_start=chunk_data.get("source_page_start", -1),
                source_page_end=chunk_data.get("source_page_end", -1),
                source_offset_start=chunk_data.get("source_offset_start", 0),
                source_offset_end=chunk_data.get("source_offset_end", 0),
                hierarchy_level=chunk_data.get("hierarchy_level", 0),
                hierarchy_path=chunk_data.get("hierarchy_path", []),
                metadata=chunk_data.get("metadata", {}),
            )
            logical_chunks.append(chunk)

        # Sort by stable order: (page_start, offset_start)
        logical_chunks.sort(
            key=lambda c: (c.source_page_start, c.source_offset_start)
        )

        return logical_chunks
