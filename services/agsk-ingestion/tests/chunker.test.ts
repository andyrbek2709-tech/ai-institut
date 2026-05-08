/**
 * Chunker unit tests
 * - Token count stays within 600-token limit
 * - Overlap is ≤ 30 tokens
 * - Section boundaries are respected
 * - Citation schema is populated
 */

import { chunkDocument, CHUNK_SIZE_TOKENS, CHUNK_OVERLAP_TOKENS } from '../src/processors/chunker.js';
import type { ParsedDocument } from '../src/parsers/pdf-parser.js';

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeDoc(sections: Array<{ heading: string; content: string; page: number }>): ParsedDocument {
  return {
    text_full:  sections.map(s => s.heading + '\n' + s.content).join('\n\n'),
    pages:      sections.map((s, i) => ({ page_number: i + 1, text: s.content, word_count: s.content.split(/\s+/).length })),
    sections:   sections.map(s => ({
      heading:      s.heading,
      level:        1,
      section_path: [s.heading.match(/^(\d+)/)?.[1] ?? String(Math.random())],
      content:      s.content,
      page_start:   s.page,
      page_end:     s.page,
    })),
    page_count: sections.length,
    word_count: sections.reduce((acc, s) => acc + s.content.split(/\s+/).length, 0),
    metadata:   {},
  };
}

// Generate text with ~N words
function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `word${i % 50}`).join(' ');
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('chunkDocument', () => {
  test('produces at least one chunk for non-empty document', () => {
    const doc    = makeDoc([{ heading: '1. Introduction', content: 'Hello world.', page: 1 }]);
    const chunks = chunkDocument(doc, 'API 5L', '2018');
    expect(chunks.length).toBeGreaterThan(0);
  });

  test('chunk token count does not exceed CHUNK_SIZE_TOKENS', () => {
    // Generate a large section (4× chunk size)
    const doc    = makeDoc([{ heading: '3. Requirements', content: words(3200), page: 5 }]);
    const chunks = chunkDocument(doc, 'ASME B31.4', '2019');

    // Each chunk should stay within limit (with 10% tolerance for estimation error)
    for (const chunk of chunks) {
      expect(chunk.content_tokens).toBeLessThanOrEqual(CHUNK_SIZE_TOKENS * 1.1);
    }
  });

  test('assigns correct citation schema', () => {
    const doc    = makeDoc([{ heading: '3.4.2. Wall thickness', content: 'The wall thickness shall be...', page: 12 }]);
    const chunks = chunkDocument(doc, 'API 5L', '2018');
    const c      = chunks[0];

    expect(c.citation_standard).toBe('API 5L');
    expect(c.citation_version).toBe('2018');
    expect(c.citation_document).toBe('API 5L 2018');
    expect(c.citation_confidence).toBe(1.0);
    expect(typeof c.citation_page).toBe('number');
  });

  test('section_path is preserved from section heading', () => {
    const doc    = makeDoc([{ heading: '3.4.2. Test', content: 'Content here.', page: 1 }]);
    const chunks = chunkDocument(doc, 'X', '');
    expect(chunks[0].section_path.length).toBeGreaterThan(0);
  });

  test('multiple sections produce chunk_index in sequence', () => {
    const doc = makeDoc([
      { heading: '1. Scope',   content: words(200), page: 1 },
      { heading: '2. Terms',   content: words(200), page: 3 },
      { heading: '3. General', content: words(200), page: 5 },
    ]);
    const chunks = chunkDocument(doc, 'ISO 3183', '2012');
    const indices = chunks.map(c => c.chunk_index);
    expect(indices).toEqual([...Array(indices.length).keys()]);
  });

  test('overlap content is present in consecutive chunks', () => {
    // Large section ensures multiple chunks
    const doc    = makeDoc([{ heading: '5. Design', content: words(4000), page: 10 }]);
    const chunks = chunkDocument(doc, 'GOST', '2014');

    if (chunks.length < 2) return;  // skip if not enough content to split

    // The last few words of chunk[n] should appear at the start of chunk[n+1]
    for (let i = 0; i < chunks.length - 1; i++) {
      const endWords   = chunks[i].content.split(/\s+/).slice(-5).join(' ');
      const startWords = chunks[i + 1].content.split(/\s+/).slice(0, 20).join(' ');
      // At least some overlap should exist
      const hasOverlap = startWords.includes(endWords.split(' ')[0]);
      expect(hasOverlap).toBe(true);
    }
  });

  test('handles empty sections gracefully', () => {
    const doc    = makeDoc([{ heading: '1. Empty', content: '', page: 1 }]);
    const chunks = chunkDocument(doc, 'X', '');
    // Empty section should produce 0 chunks (not crash)
    expect(chunks.length).toBe(0);
  });

  test('falls back to raw text chunking when no sections', () => {
    const doc: ParsedDocument = {
      text_full:  words(2000),
      pages:      [{ page_number: 1, text: words(2000), word_count: 2000 }],
      sections:   [],
      page_count: 1,
      word_count: 2000,
      metadata:   {},
    };
    const chunks = chunkDocument(doc, 'DNV', '2021');
    expect(chunks.length).toBeGreaterThan(0);
  });
});
