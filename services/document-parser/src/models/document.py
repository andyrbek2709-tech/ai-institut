"""Document and regulatory model classes."""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional


class DocumentFormat(str, Enum):
    """Supported document formats."""

    PDF = "PDF"
    SCANNED_PDF = "SCANNED_PDF"
    DOCX = "DOCX"
    EXCEL = "EXCEL"
    TEXT = "TEXT"


@dataclass
class ParsedPage:
    """Extracted page from document."""

    page_number: int
    text: str
    word_count: int


@dataclass
class DocumentSection:
    """Section within a regulatory document with optional hierarchy."""

    section_id: str
    section_path: List[str]  # e.g., ['3', '3.4', '3.4.2']
    title: str
    level: int  # nesting depth
    content: str
    page_start: int
    page_end: int
    parent_section_id: Optional[str] = None


@dataclass
class DocumentNote:
    """Note, assumption, or remark in document."""

    note_id: str
    content: str
    note_type: str  # assumption, warning, note, restriction
    section_id: Optional[str] = None
    page: Optional[int] = None


@dataclass
class ParsedDocument:
    """Output of parser stage: raw extracted content with metadata."""

    document_id: str  # SHA256(file_bytes)
    source_path: str
    format: DocumentFormat
    extraction_method: str  # pdfplumber, ocr, docx_xml, openpyxl, text
    pages: List[ParsedPage]
    raw_text: str
    extraction_hash: str  # SHA256(raw_text)
    extraction_timestamp: str  # ISO UTC
    page_count: int = 0
    word_count: int = 0

    def __post_init__(self) -> None:
        """Calculate counts from pages if not provided."""
        if self.page_count == 0:
            self.page_count = len(self.pages)
        if self.word_count == 0:
            self.word_count = sum(p.word_count for p in self.pages)


@dataclass
class RegulatoryDocument:
    """Structured regulatory document with extracted elements."""

    document_id: str
    document_code: str  # e.g., "ГОСТ 21.110-2013"
    document_type: str  # ГОСТ, СНиП, ASME, СП, РД, ТУ, etc.
    title: str
    year: int
    organization: str  # e.g., "Госстандарт", "ASME"
    language: str  # en, ru, kk
    sections: List[DocumentSection] = field(default_factory=list)
    notes: List[DocumentNote] = field(default_factory=list)
    parsed_from: Optional[ParsedDocument] = None
    extraction_timestamp: str = ""

    # Extracted elements (filled by extractors)
    formulas: List["ExtractedFormula"] = field(default_factory=list)  # type: ignore
    tables: List[dict] = field(default_factory=list)
    normative_references: List["NormativeReference"] = field(  # type: ignore
        default_factory=list
    )

    # Traceability
    extraction_lineage: Optional["ExtractionLineage"] = None  # type: ignore


@dataclass
class NormativeReference:
    """Reference to another normative document."""

    reference_id: str
    source_document: str  # e.g., "ГОСТ 21.110-2013"
    clause: str  # e.g., "3.4.2"
    page: Optional[int] = None
    text: Optional[str] = None
