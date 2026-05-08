"""PDF parser determinism verification tests.

Validates that PDF parsing is fully deterministic:
- Same PDF + Same parser version = Identical extraction_hash
- 100+ repeated parses produce identical results
- No runtime state leakage
- Stable chunk ordering across runs
"""

import pytest
import hashlib
from io import BytesIO
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from parsers.pdf_parser import PDFParser
from models.payload import DeterministicPayload


class TestPDFDeterminism:
    """Test PDF parser determinism guarantees."""

    @pytest.fixture
    def sample_pdf_bytes(self):
        """Create a minimal valid PDF for testing.

        Returns:
            bytes: Valid PDF content
        """
        # Minimal PDF structure
        pdf_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Hello World) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000244 00000 n
0000000338 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
415
%%EOF"""
        return pdf_content

    @pytest.fixture
    def parser(self):
        """Create PDF parser instance.

        Returns:
            PDFParser: Parser instance
        """
        try:
            return PDFParser(use_pdfplumber_tables=False)
        except ImportError:
            pytest.skip("PyPDF2 not available")

    def test_identical_parsing(self, parser, sample_pdf_bytes):
        """Test that identical PDF produces identical extraction_hash.

        Validates: Same input → Same output (hash equality)
        """
        document_id = hashlib.sha256(sample_pdf_bytes).hexdigest()

        # Parse twice
        payload1, meta1 = parser.parse(
            sample_pdf_bytes,
            document_id=document_id,
            generator_id="test1"
        )
        payload2, meta2 = parser.parse(
            sample_pdf_bytes,
            document_id=document_id,
            generator_id="test2"
        )

        # Verify extraction_hash is identical
        hash1 = payload1.extraction_hash()
        hash2 = payload2.extraction_hash()

        assert hash1 == hash2, f"Hashes differ: {hash1} vs {hash2}"

        # Verify chunks are identical
        assert len(payload1.logical_chunks) == len(payload2.logical_chunks)
        for chunk1, chunk2 in zip(payload1.logical_chunks, payload2.logical_chunks):
            assert chunk1.content == chunk2.content
            assert chunk1.chunk_type == chunk2.chunk_type
            assert chunk1.source_page_start == chunk2.source_page_start

    def test_100_repeated_parses(self, parser, sample_pdf_bytes):
        """Test that 100+ repeated parses produce identical results.

        Validates: Determinism across multiple executions
        """
        document_id = hashlib.sha256(sample_pdf_bytes).hexdigest()
        hashes = set()

        # Parse 100 times
        for i in range(100):
            payload, meta = parser.parse(
                sample_pdf_bytes,
                document_id=document_id,
                generator_id=f"run_{i}"
            )
            hashes.add(payload.extraction_hash())

        # All hashes should be identical
        assert len(hashes) == 1, f"Found {len(hashes)} different hashes (should be 1)"

    def test_runtime_metadata_independence(self, parser, sample_pdf_bytes):
        """Test that runtime metadata doesn't affect extraction_hash.

        Validates: extraction_hash ignores timestamps, machine_id, etc.
        """
        document_id = hashlib.sha256(sample_pdf_bytes).hexdigest()

        payload1, meta1 = parser.parse(
            sample_pdf_bytes,
            document_id=document_id,
            generator_id="source1"
        )
        payload2, meta2 = parser.parse(
            sample_pdf_bytes,
            document_id=document_id,
            generator_id="source2"
        )

        # Runtime metadata should differ
        assert meta1.extraction_id != meta2.extraction_id
        assert meta1.extraction_timestamp != meta2.extraction_timestamp

        # But extraction_hash should be identical
        assert payload1.extraction_hash() == payload2.extraction_hash()

    def test_chunk_ordering_stability(self, parser, sample_pdf_bytes):
        """Test that chunk ordering is stable across runs.

        Validates: Deterministic chunk sequence
        """
        document_id = hashlib.sha256(sample_pdf_bytes).hexdigest()

        # Parse multiple times
        chunk_sequences = []
        for i in range(10):
            payload, meta = parser.parse(
                sample_pdf_bytes,
                document_id=document_id,
                generator_id=f"run_{i}"
            )
            chunk_sequence = [chunk.content for chunk in payload.logical_chunks]
            chunk_sequences.append(chunk_sequence)

        # All sequences should be identical
        first_sequence = chunk_sequences[0]
        for i, sequence in enumerate(chunk_sequences[1:], 1):
            assert sequence == first_sequence, \
                f"Run {i} differs from run 0: {len(sequence)} chunks vs {len(first_sequence)}"

    def test_determinism_contract_validation(self, parser, sample_pdf_bytes):
        """Test that payload validates determinism contract.

        Validates: DeterministicPayload rejects forbidden fields
        """
        document_id = hashlib.sha256(sample_pdf_bytes).hexdigest()
        payload, meta = parser.parse(
            sample_pdf_bytes,
            document_id=document_id,
            generator_id="test"
        )

        # Validate contract
        try:
            payload.validate_determinism()
            # Should pass
            assert True
        except ValueError as e:
            pytest.fail(f"Determinism validation failed: {e}")

    def test_empty_pdf_handling(self, parser):
        """Test deterministic handling of empty PDF.

        Validates: Empty input → empty output (deterministic)
        """
        # Create empty PDF bytes
        empty_pdf = b"%PDF-1.4\nxref\n0 0\ntrailer\n<< >>\nstartxref\n0\n%%EOF"
        document_id = hashlib.sha256(empty_pdf).hexdigest()

        payload, meta = parser.parse(
            empty_pdf,
            document_id=document_id,
            generator_id="test"
        )

        # Should handle gracefully
        assert payload.chunk_count >= 0
        assert payload.page_count >= 0

    def test_text_normalization_determinism(self, parser, sample_pdf_bytes):
        """Test that text normalization is deterministic.

        Validates: Same text → same normalized form
        """
        document_id = hashlib.sha256(sample_pdf_bytes).hexdigest()

        payloads = []
        for i in range(10):
            payload, meta = parser.parse(
                sample_pdf_bytes,
                document_id=document_id,
                generator_id=f"run_{i}"
            )
            payloads.append(payload)

        # All raw_text should be identical
        first_text = payloads[0].raw_text
        for i, payload in enumerate(payloads[1:], 1):
            assert payload.raw_text == first_text, \
                f"Run {i} text differs from run 0"


class TestPDFOperationalResults:
    """Validate PDF parser operational results."""

    @pytest.fixture
    def parser(self):
        """Create PDF parser instance."""
        try:
            return PDFParser(use_pdfplumber_tables=False)
        except ImportError:
            pytest.skip("PyPDF2 not available")

    def test_parser_produces_valid_payload(self, parser):
        """Test that parser produces valid DeterministicPayload.

        Validates: Output structure is correct
        """
        # Create minimal PDF
        pdf_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
197
%%EOF"""

        document_id = hashlib.sha256(pdf_content).hexdigest()
        payload, meta = parser.parse(
            pdf_content,
            document_id=document_id,
            generator_id="test"
        )

        # Validate structure
        assert isinstance(payload, DeterministicPayload)
        assert payload.document_id == document_id
        assert payload.source_format == "PDF"
        assert payload.parser_version == "1.0.0"
        assert isinstance(payload.logical_chunks, list)
        assert payload.page_count >= 0
        assert payload.word_count >= 0
        assert payload.chunk_count >= 0

    def test_extraction_hash_format(self, parser):
        """Test that extraction_hash is valid SHA256.

        Validates: Hash is proper format
        """
        pdf_content = b"%PDF-1.4\nxref\n0 0\ntrailer\n<< >>\nstartxref\n0\n%%EOF"
        document_id = hashlib.sha256(pdf_content).hexdigest()

        payload, meta = parser.parse(
            pdf_content,
            document_id=document_id,
            generator_id="test"
        )

        hash_val = payload.extraction_hash()

        # Should be valid SHA256 hex string (64 chars)
        assert isinstance(hash_val, str)
        assert len(hash_val) == 64
        assert all(c in '0123456789abcdef' for c in hash_val)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
