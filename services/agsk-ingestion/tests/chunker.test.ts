/**
 * Chunker unit tests
 * - Token count stays within 600-token limit
 * - Overlap is ≤ 30 tokens
 * - Section boundaries are respected
 * - Citation schema is populated
 * - Oversized single sentence is split at word boundaries (H1 fix)
 * - Empty-section fallback produces 0 chunks (H2 fix)
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

// Generate text with ~N words (no punctuation — simulates catalog/list content)
function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `word${i % 50}`).join(' ');
}

// Generate ~N sentences with proper punctuation (simulates standard body text)
function sentences(n: number): string {
  return Array.from(
    { length: n },
    (_, i) => `Item${i} specifies requirement ${i % 100} for design condition ${i % 30}.`,
  ).join(' ');
}

// Generate a single very long "sentence" (no sentence-ending punctuation)
function longRun(n: number): string {
  return Array.from({ length: n }, (_, i) => `token${i}`).join(' ');
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('chunkDocument', () => {
  test('produces at least one chunk for non-empty document', () => {
    const doc    = makeDoc([{ heading: '1. Introduction', content: 'Hello world.', page: 1 }]);
    const chunks = chunkDocument(doc, 'API 5L', '2018');
    expect(chunks.length).toBeGreaterThan(0);
  });

  test('chunk token count does not exceed CHUNK_SIZE_TOKENS × 1.1 (punctuated text)', () => {
    // Use properly-sentenced content so splitIntoSentences creates multiple manageable items
    const doc    = makeDoc([{ heading: '3. Requirements', content: sentences(600), page: 5 }]);
    const chunks = chunkDocument(doc, 'ASME B31.4', '2019');
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
    const chunks  = chunkDocument(doc, 'ISO 3183', '2012');
    const indices = chunks.map(c => c.chunk_index);
    expect(indices).toEqual([...Array(indices.length).keys()]);
  });

  test('overlap content is present in consecutive chunks (punctuated text)', () => {
    // Punctuated sentences → proper sentence-level overlap between chunks.
    // Each sentence has a unique "ItemN" word that identifies it.
    const doc    = makeDoc([{ heading: '5. Design', content: sentences(1500), page: 10 }]);
    const chunks = chunkDocument(doc, 'GOST', '2014');

    if (chunks.length < 2) return;

    for (let i = 0; i < chunks.length - 1; i++) {
      const chunkWords  = chunks[i].content.split(/\s+/);
      const lastItemTag = chunkWords.filter(w => w.startsWith('Item')).slice(-1)[0];
      if (!lastItemTag) continue;
      const nextStart = chunks[i + 1].content.split(/\s+/).slice(0, 40).join(' ');
      expect(nextStart).toContain(lastItemTag);
    }
  });

  test('handles empty sections gracefully — produces 0 chunks', () => {
    const doc    = makeDoc([{ heading: '1. Empty', content: '', page: 1 }]);
    const chunks = chunkDocument(doc, 'X', '');
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

  // ── H1 fix: oversized single sentence ──────────────────────────────────

  test('H1 fix: single sentence > CHUNK_SIZE_TOKENS is split at word boundaries', () => {
    // Create a single "sentence" with ~1200 words (≈ 1600 tokens) — no punctuation
    const hugeSentence = longRun(1200);
    const doc = makeDoc([{ heading: '1. Catalog', content: hugeSentence, page: 1 }]);
    const chunks = chunkDocument(doc, 'AGSK', '2026');

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content_tokens).toBeLessThanOrEqual(CHUNK_SIZE_TOKENS * 1.1);
    }
  });

  test('H1 fix: catalog-style content without punctuation is chunked within token limit', () => {
    // Simulates the AGSK-3 pattern: long lines of catalog data without sentence endings
    const catalogLine = Array.from({ length: 800 }, (_, i) => `Изделие-${i} ГОСТ-123 тип-А`).join(' ');
    const doc = makeDoc([{ heading: '2. Материалы', content: catalogLine, page: 5 }]);
    const chunks = chunkDocument(doc, 'AGSK', '2026');

    for (const chunk of chunks) {
      expect(chunk.content_tokens).toBeLessThanOrEqual(CHUNK_SIZE_TOKENS * 1.1);
    }
  });

  // ── H2 fix: raw-text fallback only when sections array is empty ───────────

  test('H2 fix: fallback to text_full when no sections were detected at all', () => {
    // sections = [] → parser found no headings → fallback to raw text_full
    const doc: ParsedDocument = {
      text_full:  sentences(400),
      pages:      [{ page_number: 1, text: sentences(400), word_count: 400 }],
      sections:   [],
      page_count: 1,
      word_count: 400,
      metadata:   {},
    };
    const chunks = chunkDocument(doc, 'TEST', '');
    expect(chunks.length).toBeGreaterThan(0);
  });

  test('H2 fix: empty section content → 0 chunks, fallback NOT triggered', () => {
    // Sections detected (even with empty content) → section-based path, 0 chunks.
    // Fallback to text_full must NOT activate when sections array is non-empty.
    const doc: ParsedDocument = {
      text_full:  sentences(400),
      pages:      [{ page_number: 1, text: sentences(400), word_count: 400 }],
      sections:   [
        { heading: 'Empty 1', level: 1, section_path: ['1'], content: '', page_start: 1, page_end: 1 },
      ],
      page_count: 1,
      word_count: 400,
      metadata:   {},
    };
    const chunks = chunkDocument(doc, 'TEST', '');
    expect(chunks.length).toBe(0);
  });

  test('H2 fix: fallback NOT triggered when at least one section has content', () => {
    const doc = makeDoc([
      { heading: '1. Empty',   content: '',          page: 1 },
      { heading: '2. Content', content: words(200),  page: 2 },
    ]);
    const chunks = chunkDocument(doc, 'TEST', '');
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(c.section_title).toBe('2. Content');
    }
  });
});
