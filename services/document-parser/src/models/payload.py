"""Deterministic payload and runtime metadata models.

Separates deterministic content (hashed, reproducible) from runtime context
(timestamps, execution environment, non-deterministic metadata).

Key principle: extraction_hash is computed ONLY from DeterministicPayload.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
import unicodedata
import re
from enum import Enum


class TextNormalizationRule(str, Enum):
    """Text normalization rules (locked per parser version)."""
    NFC_UNICODE = "nfc_unicode"
    COLLAPSE_SPACES = "collapse_spaces"
    NORMALIZE_LINEENDINGS = "normalize_lineendings"
    REMOVE_CONTROL_CHARS = "remove_control_chars"


@dataclass
class LogicalChunk:
    """Logical chunk extracted from document (stateless, deterministic)."""

    chunk_id: str  # Unique within document
    content: str  # Normalized text content
    chunk_type: str  # paragraph, heading, table, list_item, code_block, etc.
    source_page_start: int  # Page where chunk starts (1-indexed, -1 if no pages)
    source_page_end: int  # Page where chunk ends (-1 if single-page)
    source_offset_start: int  # Character offset in raw document
    source_offset_end: int  # Character offset in raw document
    hierarchy_level: int  # 0 = document, 1 = section, 2 = subsection, etc.
    hierarchy_path: List[str] = field(
        default_factory=list
    )  # e.g., ['1', '1.2', '1.2.3']
    metadata: Dict[str, Any] = field(default_factory=dict)  # Optional: heading_level, etc.

    def content_hash(self) -> str:
        """SHA256 of normalized content."""
        import hashlib

        normalized = unicodedata.normalize("NFC", self.content)
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


@dataclass
class DeterministicPayload:
    """Content extracted from document - deterministic, reproducible, hashable.

    This is the ONLY data used to compute extraction_hash.
    No timestamps, no runtime context, no machine-specific data.
    """

    # Document identification (from source file, not runtime)
    document_id: str  # SHA256(file_bytes) - deterministic from file content
    source_format: str  # DOCX, PDF, TEXT, EXCEL, etc.
    parser_version: str  # e.g., "0.1.0" - exact parser that produced this
    normalization_version: str  # e.g., "1.0" - exact normalization rules applied

    # Extracted content (deterministic)
    raw_text: str  # Complete normalized text
    logical_chunks: List[LogicalChunk] = field(
        default_factory=list
    )  # Structural decomposition

    # Metadata about extraction (deterministic parts only)
    page_count: int  # Total pages in document
    word_count: int  # Total words in normalized text
    chunk_count: int  # Total chunks extracted
    encoding: str = "utf-8"  # Encoding used for text

    # Normalization configuration (locked per version)
    applied_normalizations: List[TextNormalizationRule] = field(
        default_factory=list
    )

    def validate_determinism(self) -> tuple[bool, Optional[str]]:
        """Check that payload is deterministic (no runtime-dependent data).

        Returns:
            (is_valid, error_message)
        """
        # Check for forbidden fields (would indicate runtime leakage)
        forbidden_patterns = [
            "timestamp",
            "execution_time",
            "machine_id",
            "generator_id",
            "random",
        ]

        for key in self.__dict__.keys():
            for pattern in forbidden_patterns:
                if pattern.lower() in key.lower():
                    return (
                        False,
                        f"Forbidden runtime field '{key}' in DeterministicPayload",
                    )

        # Check that chunks are properly ordered
        if self.logical_chunks:
            prev_offset = -1
            for chunk in self.logical_chunks:
                if chunk.source_offset_start <= prev_offset:
                    return (
                        False,
                        f"Chunks not in stable order: {chunk.source_offset_start} <= {prev_offset}",
                    )
                prev_offset = chunk.source_offset_end

        return True, None

    def extraction_hash(self) -> str:
        """Compute extraction hash from deterministic payload.

        This is the canonical hash for this extraction.
        Same input + same parser version = identical hash.
        """
        from ..hashing.deterministic import DeterministicHasher

        data = {
            "document_id": self.document_id,
            "source_format": self.source_format,
            "parser_version": self.parser_version,
            "normalization_version": self.normalization_version,
            "raw_text": self.raw_text,
            "page_count": self.page_count,
            "word_count": self.word_count,
            "chunk_count": self.chunk_count,
            "chunks": [
                {
                    "chunk_id": c.chunk_id,
                    "content": c.content,
                    "chunk_type": c.chunk_type,
                    "source_page_start": c.source_page_start,
                    "source_page_end": c.source_page_end,
                    "source_offset_start": c.source_offset_start,
                    "source_offset_end": c.source_offset_end,
                    "hierarchy_level": c.hierarchy_level,
                    "hierarchy_path": c.hierarchy_path,
                }
                for c in self.logical_chunks
            ],
        }

        return DeterministicHasher.hash_canonical(data)


@dataclass
class RuntimeMetadata:
    """Runtime context for extraction - NOT used in extraction_hash.

    Tracks execution context, versions, timing, etc.
    Useful for debugging, audit trails, but doesn't affect reproducibility.
    """

    # Execution context
    extraction_id: str  # Unique extraction session
    extraction_timestamp: str  # ISO UTC when extraction happened
    extraction_duration_ms: float  # How long extraction took
    generator_id: str  # "api", "batch_job", "manual", etc.

    # Execution environment (informational only)
    parser_version: str  # Parser version at extraction time
    engine_version: str  # Extraction engine version
    python_version: str  # Python version used
    machine_id: Optional[str] = None  # For debugging, not in hash

    # Parser-specific metadata
    extraction_method: str = "native"  # pdfplumber, ocr, docx_xml, openpyxl, text
    parser_config: Dict[str, Any] = field(default_factory=dict)

    # OCR metadata (if applicable)
    ocr_used: bool = False
    ocr_engine: Optional[str] = None  # tesseract, paddleocr, etc.
    ocr_version: Optional[str] = None

    def as_dict(self) -> Dict[str, Any]:
        """Convert to dict for storage/display."""
        return {
            "extraction_id": self.extraction_id,
            "extraction_timestamp": self.extraction_timestamp,
            "extraction_duration_ms": self.extraction_duration_ms,
            "generator_id": self.generator_id,
            "parser_version": self.parser_version,
            "engine_version": self.engine_version,
            "python_version": self.python_version,
            "machine_id": self.machine_id,
            "extraction_method": self.extraction_method,
            "ocr_used": self.ocr_used,
            "ocr_engine": self.ocr_engine,
            "ocr_version": self.ocr_version,
        }
