"""Deterministic text file parser.

Handles plain text files with encoding detection and normalization.
"""

from typing import List
from .base import BaseParser
from ..models.payload import DeterministicPayload, LogicalChunk
import logging

logger = logging.getLogger(__name__)


class TextParser(BaseParser):
    """Deterministic text file parser."""

    PARSER_VERSION = "0.1.0"
    PARSER_NAME = "TextParser"

    # Try these encodings in order
    ENCODINGS = ["utf-8", "utf-8-sig", "latin-1", "cp1252", "iso-8859-1"]

    def parse_deterministic(
        self, file_bytes: bytes, document_id: str
    ) -> DeterministicPayload:
        """Extract deterministic payload from text file.

        Args:
            file_bytes: Raw text file bytes
            document_id: SHA256 of file

        Returns:
            DeterministicPayload with normalized text
        """
        # Try to decode with various encodings
        text = self._decode_text(file_bytes)

        # Normalize text
        normalized_text = self._normalize_text(text)

        # Split into logical chunks (paragraphs separated by blank lines)
        chunks = self._split_into_chunks(normalized_text)

        # Create logical chunks
        logical_chunks = self._create_logical_chunks(normalized_text, chunks)

        # Count statistics
        page_count = 1  # Text files don't have pages
        word_count = len(normalized_text.split())

        # Create deterministic payload
        payload = DeterministicPayload(
            document_id=document_id,
            source_format="TEXT",
            parser_version=self.PARSER_VERSION,
            normalization_version="1.0",
            raw_text=normalized_text,
            logical_chunks=logical_chunks,
            page_count=page_count,
            word_count=word_count,
            chunk_count=len(logical_chunks),
            encoding="utf-8",
        )

        return payload

    def _decode_text(self, file_bytes: bytes) -> str:
        """Detect encoding and decode text."""
        for encoding in self.ENCODINGS:
            try:
                text = file_bytes.decode(encoding)
                logger.debug(f"TextParser: Successfully decoded with {encoding}")
                return text
            except (UnicodeDecodeError, AttributeError):
                continue

        # Fallback: UTF-8 with error replacement
        logger.warning("TextParser: Falling back to UTF-8 with error replacement")
        return file_bytes.decode("utf-8", errors="replace")

    def _split_into_chunks(self, text: str) -> List[dict]:
        """Split text into logical chunks (paragraphs)."""
        chunks = []

        # Split by double newlines (paragraph separator)
        paragraphs = text.split("\n\n")

        for para in paragraphs:
            para = para.strip()
            if para:  # Skip empty paragraphs
                chunk = {
                    "content": para,
                    "chunk_type": "paragraph",
                    "source_page_start": -1,
                    "source_page_end": -1,
                    "hierarchy_level": 0,
                    "hierarchy_path": [],
                    "metadata": {},
                }
                chunks.append(chunk)

        return chunks

    def _get_extraction_method(self) -> str:
        return "text"
