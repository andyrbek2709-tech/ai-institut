"""Deterministic DOCX parser using python-docx.

Extracts text, paragraphs, headings, tables in stable order.
No approximation of pages (Word uses virtual paging).
"""

from typing import List, Optional
from .base import BaseParser
from ..models.payload import DeterministicPayload, LogicalChunk
from lxml import etree
import logging

logger = logging.getLogger(__name__)


class DOCXParser(BaseParser):
    """Deterministic DOCX parser."""

    PARSER_VERSION = "0.1.0"
    PARSER_NAME = "DOCXParser"

    def parse_deterministic(
        self, file_bytes: bytes, document_id: str
    ) -> DeterministicPayload:
        """Extract deterministic payload from DOCX file.

        Args:
            file_bytes: Raw DOCX file (ZIP archive)
            document_id: SHA256 of file

        Returns:
            DeterministicPayload with normalized text and logical chunks
        """
        import tempfile
        import os
        from docx import Document
        from docx.oxml.shared import OxmlElement

        # Write to temp file (python-docx needs file path)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as f:
            f.write(file_bytes)
            temp_path = f.name

        try:
            # Parse DOCX
            doc = Document(temp_path)

            # Extract all elements in document order
            chunks = []
            full_text_parts = []

            for element in doc.element.body:
                # Handle paragraphs
                if element.tag.endswith("p"):
                    para_text = self._extract_paragraph_text(element)
                    if para_text.strip():
                        # Detect if this is a heading
                        style = element.pStyle.val if element.pStyle is not None else None
                        is_heading = style and "Heading" in style

                        chunk = {
                            "content": para_text,
                            "chunk_type": "heading" if is_heading else "paragraph",
                            "source_page_start": -1,
                            "source_page_end": -1,
                            "hierarchy_level": self._heading_level(style)
                            if is_heading
                            else 0,
                            "hierarchy_path": [],
                            "metadata": {"style": style} if style else {},
                        }
                        chunks.append(chunk)
                        full_text_parts.append(para_text)

                # Handle tables
                elif element.tag.endswith("tbl"):
                    table_text = self._extract_table_text(element)
                    if table_text.strip():
                        chunk = {
                            "content": table_text,
                            "chunk_type": "table",
                            "source_page_start": -1,
                            "source_page_end": -1,
                            "hierarchy_level": 0,
                            "hierarchy_path": [],
                            "metadata": {},
                        }
                        chunks.append(chunk)
                        full_text_parts.append(table_text)

            # Normalize all text
            full_text = "\n\n".join(full_text_parts)
            normalized_text = self._normalize_text(full_text)

            # Create logical chunks
            logical_chunks = self._create_logical_chunks(normalized_text, chunks)

            # Count statistics
            page_count = 1  # DOCX doesn't have explicit pages
            word_count = len(normalized_text.split())

            # Create deterministic payload
            payload = DeterministicPayload(
                document_id=document_id,
                source_format="DOCX",
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

        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def _extract_paragraph_text(self, para_element) -> str:
        """Extract text from paragraph element."""
        texts = []
        for run in para_element.findall(".//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}r"):
            text_elements = run.findall(
                ".//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t"
            )
            for t in text_elements:
                if t.text:
                    texts.append(t.text)

        return "".join(texts)

    def _extract_table_text(self, table_element) -> str:
        """Extract text from table element in stable order."""
        rows = []
        for row in table_element.findall(
            ".//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tr"
        ):
            cells = []
            for cell in row.findall(
                ".//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tc"
            ):
                cell_text = self._extract_cell_text(cell)
                cells.append(cell_text)

            rows.append(" | ".join(cells))

        return "\n".join(rows)

    def _extract_cell_text(self, cell_element) -> str:
        """Extract text from table cell."""
        texts = []
        for para in cell_element.findall(
            ".//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"
        ):
            para_text = self._extract_paragraph_text(para)
            if para_text.strip():
                texts.append(para_text)

        return " ".join(texts)

    def _heading_level(self, style: Optional[str]) -> int:
        """Extract heading level from style name."""
        if not style or "Heading" not in style:
            return 0

        # Extract number: "Heading1" -> 1, "Heading 2" -> 2
        import re

        match = re.search(r"Heading\s*(\d+)", style)
        if match:
            return int(match.group(1))

        return 1  # Default to level 1 if we can't parse

    def _get_extraction_method(self) -> str:
        return "docx_xml"
