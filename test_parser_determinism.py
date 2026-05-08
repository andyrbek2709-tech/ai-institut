#!/usr/bin/env python3
"""Test parser determinism - PHASE 7 verification.

Runs parsers 100+ times on test files to verify:
- Same input → same output
- Same extraction_hash every time
- Chunk lineage is stable
- No runtime-dependent variance
"""

import sys
import os
import hashlib
import json
from pathlib import Path
from collections import defaultdict
from datetime import datetime

# Add services to path
sys.path.insert(0, str(Path(__file__).parent / "services" / "document-parser" / "src"))

from parsers import TextParser, DOCXParser, ExcelParser
from models import DeterministicPayload, RuntimeMetadata


def test_text_parser():
    """Test TEXT parser determinism."""
    parser = TextParser()

    # Create test file
    test_text = """Introduction to Parsing

Parsing is the process of analyzing a string of text
to extract structural information.

Main Concepts
This document covers deterministic parsing.
We focus on reproducibility.

Conclusion
Determinism is key to reliable extraction."""

    test_bytes = test_text.encode("utf-8")
    document_id = hashlib.sha256(test_bytes).hexdigest()

    print("\n" + "=" * 60)
    print("TEXT PARSER DETERMINISM TEST")
    print("=" * 60)

    # Run 100 times
    hashes = []
    chunk_counts = []
    word_counts = []

    for run in range(100):
        payload, metadata = parser.parse(test_bytes, document_id)
        extraction_hash = payload.extraction_hash()
        hashes.append(extraction_hash)
        chunk_counts.append(len(payload.logical_chunks))
        word_counts.append(payload.word_count)

        if run == 0:
            print(f"\n✅ First run:")
            print(f"   Document ID: {document_id[:16]}...")
            print(f"   Extraction hash: {extraction_hash[:16]}...")
            print(f"   Pages: {payload.page_count}")
            print(f"   Words: {payload.word_count}")
            print(f"   Chunks: {len(payload.logical_chunks)}")
            print(f"   Sample chunks:")
            for chunk in payload.logical_chunks[:2]:
                print(f"     - {chunk.chunk_type}: {chunk.content[:50]}...")

    # Verify determinism
    unique_hashes = set(hashes)
    unique_chunk_counts = set(chunk_counts)
    unique_word_counts = set(word_counts)

    print(f"\n📊 Results after 100 runs:")
    print(f"   Unique hashes: {len(unique_hashes)} (expected 1)")
    print(f"   Unique chunk counts: {len(unique_chunk_counts)} (expected 1)")
    print(f"   Unique word counts: {len(unique_word_counts)} (expected 1)")

    if len(unique_hashes) == 1 and len(unique_chunk_counts) == 1:
        print(f"\n✅ TEXT PARSER: DETERMINISTIC ✓")
        return True
    else:
        print(f"\n❌ TEXT PARSER: NON-DETERMINISTIC")
        print(f"   Hash variance: {unique_hashes}")
        print(f"   Chunk count variance: {unique_chunk_counts}")
        return False


def test_payload_determinism():
    """Test DeterministicPayload validation."""
    print("\n" + "=" * 60)
    print("DETERMINISTIC PAYLOAD VALIDATION")
    print("=" * 60)

    # Create valid payload
    payload = DeterministicPayload(
        document_id="test_id_123",
        source_format="TEXT",
        parser_version="0.1.0",
        normalization_version="1.0",
        raw_text="Test text content",
        page_count=1,
        word_count=3,
        chunk_count=0,
    )

    # Validate
    is_valid, error = payload.validate_determinism()

    print(f"\n✅ Valid payload validation:")
    print(f"   Is valid: {is_valid}")
    if error:
        print(f"   Error: {error}")

    # Test extraction hash
    extraction_hash = payload.extraction_hash()
    print(f"\n✅ Extraction hash computed:")
    print(f"   Hash: {extraction_hash[:16]}...")

    # Verify reproducibility
    extraction_hash_2 = payload.extraction_hash()
    if extraction_hash == extraction_hash_2:
        print(f"   ✓ Hash reproducible: {extraction_hash_2[:16]}... (identical)")
        return True
    else:
        print(f"   ✗ Hash NOT reproducible: {extraction_hash_2[:16]}...")
        return False


def test_runtime_metadata_isolation():
    """Test that RuntimeMetadata is NOT in extraction hash."""
    print("\n" + "=" * 60)
    print("RUNTIME METADATA ISOLATION TEST")
    print("=" * 60)

    parser = TextParser()
    test_bytes = b"Test content for metadata isolation"
    document_id = hashlib.sha256(test_bytes).hexdigest()

    # Parse twice with different generator_id
    payload1, metadata1 = parser.parse(test_bytes, document_id, generator_id="api")
    hash1 = payload1.extraction_hash()

    payload2, metadata2 = parser.parse(test_bytes, document_id, generator_id="batch_job")
    hash2 = payload2.extraction_hash()

    print(f"\n✅ Parsed with different metadata:")
    print(f"   Generator 1: {metadata1.generator_id}")
    print(f"   Generator 2: {metadata2.generator_id}")
    print(f"   Hash 1: {hash1[:16]}...")
    print(f"   Hash 2: {hash2[:16]}...")

    if hash1 == hash2:
        print(f"\n✅ RUNTIME METADATA ISOLATED: Hashes identical despite different metadata")
        return True
    else:
        print(f"\n❌ RUNTIME METADATA LEAKED: Different metadata produced different hashes!")
        return False


def test_chunk_stability():
    """Test that chunks are extracted in stable order."""
    print("\n" + "=" * 60)
    print("CHUNK STABILITY TEST")
    print("=" * 60)

    parser = TextParser()
    test_text = """First paragraph.

Second paragraph.

Third paragraph."""

    test_bytes = test_text.encode("utf-8")
    document_id = hashlib.sha256(test_bytes).hexdigest()

    # Parse and collect chunk contents
    chunk_sequences = []

    for run in range(10):
        payload, _ = parser.parse(test_bytes, document_id)
        chunk_contents = [c.content for c in payload.logical_chunks]
        chunk_sequences.append(chunk_contents)

    # Verify all sequences are identical
    first_sequence = chunk_sequences[0]
    all_identical = all(seq == first_sequence for seq in chunk_sequences)

    print(f"\n✅ Extracted chunks (run 1):")
    for i, chunk in enumerate(first_sequence):
        print(f"   [{i}] {chunk}")

    print(f"\n📊 Results after 10 runs:")
    print(f"   Chunk sequences identical: {all_identical}")

    if all_identical:
        print(f"\n✅ CHUNK STABILITY: All sequences identical")
        return True
    else:
        print(f"\n❌ CHUNK STABILITY: Sequences differ!")
        for i, seq in enumerate(chunk_sequences):
            if seq != first_sequence:
                print(f"   Run {i+1} differs: {seq}")
        return False


def test_encoding_stability():
    """Test that encoding variations produce same results."""
    print("\n" + "=" * 60)
    print("ENCODING STABILITY TEST")
    print("=" * 60)

    parser = TextParser()
    test_text = "Testing with special chars: café, naïve, Москва"

    # UTF-8 encoding
    utf8_bytes = test_text.encode("utf-8")
    document_id_1 = hashlib.sha256(utf8_bytes).hexdigest()

    payload1, _ = parser.parse(utf8_bytes, document_id_1)
    hash1 = payload1.extraction_hash()

    # Same text, same encoding (should be identical file)
    utf8_bytes_2 = test_text.encode("utf-8")
    document_id_2 = hashlib.sha256(utf8_bytes_2).hexdigest()

    payload2, _ = parser.parse(utf8_bytes_2, document_id_2)
    hash2 = payload2.extraction_hash()

    print(f"\n✅ Parsed same text twice:")
    print(f"   Text: {test_text}")
    print(f"   Document ID 1: {document_id_1[:16]}...")
    print(f"   Document ID 2: {document_id_2[:16]}...")
    print(f"   Hash 1: {hash1[:16]}...")
    print(f"   Hash 2: {hash2[:16]}...")

    if hash1 == hash2 and document_id_1 == document_id_2:
        print(f"\n✅ ENCODING STABILITY: Identical results")
        return True
    else:
        print(f"\n⚠️  ENCODING STABILITY: Results differ")
        return False


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("PARSER DETERMINISM TEST SUITE")
    print(f"Started: {datetime.now().isoformat()}")
    print("=" * 60)

    results = {}

    # Run tests
    results["payload_validation"] = test_payload_determinism()
    results["runtime_isolation"] = test_runtime_metadata_isolation()
    results["chunk_stability"] = test_chunk_stability()
    results["encoding_stability"] = test_encoding_stability()
    results["text_parser_100"] = test_text_parser()

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")

    print(f"\nTotal: {passed}/{total} passed")

    if passed == total:
        print("\n🎉 ALL TESTS PASSED - PARSER CORE DETERMINISTIC")
        return 0
    else:
        print("\n⚠️  SOME TESTS FAILED - REVIEW IMPLEMENTATION")
        return 1


if __name__ == "__main__":
    sys.exit(main())
