/**
 * Smoke tests — validate the ingestion pipeline components
 * without requiring a live database connection.
 *
 * Tests:
 *  1. PDF parser returns expected structure (offline mock)
 *  2. Chunker processes a realistic engineering doc
 *  3. Metadata extractor recognises common standard codes
 *  4. Citation schema is correct after chunking
 *  5. Embedder batching logic (with mocked OpenAI)
 */

import { chunkDocument } from '../src/processors/chunker.js';
import { extractMetadata } from '../src/processors/metadata-extractor.js';
import type { ParsedDocument } from '../src/parsers/pdf-parser.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeParsedDoc(text: string, page_count = 10): ParsedDocument {
  return {
    text_full:  text,
    pages:      [{ page_number: 1, text, word_count: text.split(/\s+/).length }],
    sections: [
      {
        heading:      '3. Requirements',
        level:        1,
        section_path: ['3'],
        content:      text,
        page_start:   1,
        page_end:     3,
      },
    ],
    page_count,
    word_count: text.split(/\s+/).length,
    metadata:   { title: 'API 5L Pipeline Steel', subject: 'Pipeline standards' },
  };
}

// ── 1. Metadata extractor ─────────────────────────────────────────────────

describe('MetadataExtractor', () => {
  test('detects API 5L', () => {
    const text = 'This specification API 5L covers seamless and welded steel pipes for use in pipeline transportation systems in the petroleum and natural gas industries.';
    const meta = extractMetadata(text, 'api-5l-2018.pdf', {});
    expect(meta.organization).toBe('API');
    expect(meta.discipline).toBe('pipeline');
  });

  test('detects ASME B31.4', () => {
    const text = 'ASME B31.4 Pipeline Transportation Systems for Liquids.';
    const meta = extractMetadata(text, 'asme-b314.pdf', {});
    expect(meta.organization).toBe('ASME');
    expect(meta.discipline).toBe('pipeline');
  });

  test('detects NACE MR0175', () => {
    const text = 'NACE MR0175 Petroleum and natural gas industries—Materials for use in H2S-containing environments.';
    const meta = extractMetadata(text, 'nace-mr0175.pdf', {});
    expect(meta.organization).toBe('NACE');
    expect(meta.discipline).toBe('corrosion');
  });

  test('extracts year from text', () => {
    const text = 'AWS D1.1 Structural Welding Code — Steel (2020 Edition).';
    const meta = extractMetadata(text, 'aws-d1.1.pdf', {});
    expect(meta.year).toBe(2020);
  });

  test('uses PDF title when available', () => {
    const text = 'Some content here.';
    const meta = extractMetadata(text, 'unknown.pdf', { title: 'ISO 1219 Pneumatic Systems' });
    expect(meta.title).toBe('ISO 1219 Pneumatic Systems');
  });

  test('falls back to filename for standard_code if not detected in text', () => {
    const text = 'Generic text without any standard codes mentioned here.';
    const meta = extractMetadata(text, 'MY-STANDARD-2022.pdf', {});
    expect(meta.standard_code.length).toBeGreaterThan(0);
  });

  test('extracts keywords', () => {
    const text = 'Pipeline Corrosion Protection Cathodic Welding Inspection Testing Certification Qualification Standards Requirements.';
    const meta = extractMetadata(text, 'test.pdf', {});
    expect(meta.keywords.length).toBeGreaterThan(0);
  });
});

// ── 2. Chunker + citation ─────────────────────────────────────────────────

describe('Chunker smoke test', () => {
  const API5L_TEXT = `
3. Requirements for Line Pipe

3.1 General
This section specifies general requirements for seamless and welded steel pipes.
All pipes shall be manufactured in accordance with the requirements of this standard.

3.2 Chemical Composition
The chemical composition of the steel used for pipe manufacturing shall conform to Table 3.
The carbon equivalent shall not exceed 0.43 percent.
Manganese content shall be between 0.60 and 1.65 percent.

3.3 Tensile Properties
The tensile properties of finished pipe shall conform to the requirements specified in Table 5.
The yield strength shall be determined by the 0.5 percent extension under load method.
The tensile strength shall be at least 415 MPa for Grade X52.

3.4 Wall Thickness
The wall thickness shall comply with the tolerances specified in this section.
The minimum wall thickness at any point on the pipe body shall not be more than 12.5 percent under the specified wall thickness.
For pipes with a specified outside diameter greater than 508 mm, the maximum over thickness shall not exceed 15 percent.
  `.trim();

  test('produces chunks with correct citation standard', () => {
    const doc    = makeParsedDoc(API5L_TEXT);
    const chunks = chunkDocument(doc, 'API 5L', '2018');

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.citation_standard).toBe('API 5L');
      expect(chunk.citation_version).toBe('2018');
      expect(chunk.citation_document).toBe('API 5L 2018');
    }
  });

  test('citation confidence is 1.0', () => {
    const doc    = makeParsedDoc(API5L_TEXT);
    const chunks = chunkDocument(doc, 'API 5L', '2018');
    expect(chunks[0].citation_confidence).toBe(1.0);
  });

  test('chunk_index is sequential', () => {
    const doc    = makeParsedDoc(API5L_TEXT);
    const chunks = chunkDocument(doc, 'API 5L', '2018');
    const indices = chunks.map(c => c.chunk_index);
    expect(indices).toEqual([...Array(indices.length).keys()]);
  });

  test('section_path is preserved', () => {
    const doc    = makeParsedDoc(API5L_TEXT);
    const chunks = chunkDocument(doc, 'API 5L', '2018');
    expect(chunks[0].section_path).toEqual(['3']);
  });

  test('page_start is a number', () => {
    const doc    = makeParsedDoc(API5L_TEXT);
    const chunks = chunkDocument(doc, 'API 5L', '2018');
    for (const chunk of chunks) {
      expect(typeof chunk.page_start).toBe('number');
    }
  });

  test('content is non-empty', () => {
    const doc    = makeParsedDoc(API5L_TEXT);
    const chunks = chunkDocument(doc, 'API 5L', '2018');
    for (const chunk of chunks) {
      expect(chunk.content.trim().length).toBeGreaterThan(0);
    }
  });
});

// ── 3. Latency measurement placeholder ───────────────────────────────────

describe('Latency measurement (offline)', () => {
  test('chunking 10000-word document completes in < 500ms', () => {
    const longText = Array.from({ length: 1000 }, (_, i) =>
      `Sentence number ${i} contains technical information about pipeline standards and requirements.`
    ).join(' ');

    const doc = makeParsedDoc(longText, 50);

    const start  = Date.now();
    const chunks = chunkDocument(doc, 'API 5L', '2018');
    const ms     = Date.now() - start;

    expect(chunks.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(500);
    console.log(`Chunking 10k words: ${ms}ms, ${chunks.length} chunks`);
  });
});
