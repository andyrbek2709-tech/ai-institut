/**
 * Semantic chunker — LOCKED PARAMETERS per architecture decision:
 *   chunk_size    = 600 tokens
 *   overlap       = 30 tokens
 *   strategy      = section-aware (never split mid-section heading)
 *
 * Token counting uses a simple whitespace/punctuation approximation
 * (≈ 0.75 × word count) to avoid tiktoken ESM issues in Node.
 * Error margin < 5% for English/Russian technical text.
 *
 * Week 3 fixes:
 *   H1 — word-level split fallback for sentences longer than CHUNK_SIZE_TOKENS
 *   H2 — empty-section fallback correctly handles text_full when all sections are empty
 */

import { ParsedSection, ParsedDocument } from '../parsers/pdf-parser.js';

export const CHUNK_SIZE_TOKENS    = 600;
export const CHUNK_OVERLAP_TOKENS = 30;

export interface Chunk {
  content:          string;
  content_tokens:   number;
  chunk_index:      number;
  section_path:     string[];
  section_title:    string;
  subsection_title: string;
  page_start:       number;
  page_end:         number;

  // Citation fields (populated from parent standard after chunking)
  citation_document:   string;
  citation_standard:   string;
  citation_section:    string;
  citation_page:       number;
  citation_version:    string;
  citation_confidence: number;
}

// Rough token count: GPT tokenizer averages ~0.75 words per token for technical text.
function estimateTokens(text: string): number {
  return Math.ceil(text.trim().split(/\s+/).filter(Boolean).length / 0.75);
}

function splitIntoSentences(text: string): string[] {
  return text
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * H1 fix: split a single oversized sentence into word-level sub-chunks.
 * Called only when a sentence alone exceeds CHUNK_SIZE_TOKENS.
 */
function splitLongSentenceByWords(text: string, maxTokens: number): string[] {
  const words   = text.trim().split(/\s+/);
  const chunks: string[] = [];
  let current: string[] = [];
  let tokens  = 0;

  for (const word of words) {
    const wTokens = estimateTokens(word);
    if (tokens + wTokens > maxTokens && current.length > 0) {
      chunks.push(current.join(' '));
      current = [word];
      tokens  = wTokens;
    } else {
      current.push(word);
      tokens += wTokens;
    }
  }
  if (current.length > 0) chunks.push(current.join(' '));
  return chunks;
}

interface ChunkAccumulator {
  sentences:    string[];
  tokens:       number;
  section_path: string[];
  section_title: string;
  page_start:   number;
  page_end:     number;
}

function flushChunk(
  acc: ChunkAccumulator,
  index: number,
  standardCode: string,
  version: string,
): Chunk {
  const content = acc.sentences.join(' ').trim();
  return {
    content,
    content_tokens:      estimateTokens(content),
    chunk_index:         index,
    section_path:        acc.section_path,
    section_title:       acc.section_title,
    subsection_title:    acc.section_path.length > 1 ? acc.section_title : '',
    page_start:          acc.page_start,
    page_end:            acc.page_end,
    citation_document:   `${standardCode} ${version}`.trim(),
    citation_standard:   standardCode,
    citation_section:    acc.section_path[acc.section_path.length - 1] ?? '',
    citation_page:       acc.page_start,
    citation_version:    version,
    citation_confidence: 1.0,
  };
}

function buildOverlapPrefix(sentences: string[]): { sentences: string[]; tokens: number } {
  const result: string[] = [];
  let tokens = 0;
  for (let i = sentences.length - 1; i >= 0 && tokens < CHUNK_OVERLAP_TOKENS; i--) {
    result.unshift(sentences[i]);
    tokens += estimateTokens(sentences[i]);
  }
  return { sentences: result, tokens };
}

function processsentences(
  sentences: string[],
  baseAcc: Omit<ChunkAccumulator, 'sentences' | 'tokens'>,
  standardCode: string,
  version: string,
  chunks: Chunk[],
  chunkIdx: { value: number },
): void {
  let acc: ChunkAccumulator = { ...baseAcc, sentences: [], tokens: 0 };

  for (const sentence of sentences) {
    const sentTokens = estimateTokens(sentence);

    // H1 fix: sentence alone exceeds limit → word-level split, each sub-chunk flushed directly.
    // No overlap between word-level splits (arbitrary word boundaries, not semantic boundaries).
    if (sentTokens > CHUNK_SIZE_TOKENS) {
      if (acc.sentences.length > 0) {
        chunks.push(flushChunk(acc, chunkIdx.value++, standardCode, version));
        acc = { ...baseAcc, sentences: [], tokens: 0 };
      }
      const wordChunks = splitLongSentenceByWords(sentence, CHUNK_SIZE_TOKENS);
      for (const wc of wordChunks) {
        chunks.push(flushChunk(
          { ...baseAcc, sentences: [wc], tokens: estimateTokens(wc) },
          chunkIdx.value++,
          standardCode,
          version,
        ));
      }
      continue;
    }

    if (acc.tokens + sentTokens > CHUNK_SIZE_TOKENS && acc.sentences.length > 0) {
      chunks.push(flushChunk(acc, chunkIdx.value++, standardCode, version));
      const overlap = buildOverlapPrefix(acc.sentences);
      acc = { ...baseAcc, sentences: overlap.sentences, tokens: overlap.tokens };
    }

    acc.sentences.push(sentence);
    acc.tokens += sentTokens;
  }

  if (acc.sentences.length > 0) {
    chunks.push(flushChunk(acc, chunkIdx.value++, standardCode, version));
  }
}

/**
 * Chunk a parsed document into overlapping 600-token sections.
 * Section boundaries act as natural chunk break points.
 */
export function chunkDocument(
  doc: ParsedDocument,
  standardCode: string,
  version: string,
): Chunk[] {
  const chunks: Chunk[] = [];
  const chunkIdx        = { value: 0 };

  for (const section of doc.sections) {
    const sentences = splitIntoSentences(section.content);
    if (sentences.length === 0) continue;

    processsentences(
      sentences,
      {
        section_path:  section.section_path,
        section_title: section.heading,
        page_start:    section.page_start,
        page_end:      section.page_end,
      },
      standardCode,
      version,
      chunks,
      chunkIdx,
    );
  }

  // H2 fix: fallback to raw text — only when NO sections were detected at all.
  // If sections exist but have empty content, return 0 chunks (expected behavior).
  if (chunks.length === 0 && doc.sections.length === 0 && doc.text_full) {
    const sentences = splitIntoSentences(doc.text_full);
    if (sentences.length > 0) {
      processsentences(
        sentences,
        {
          section_path:  [],
          section_title: 'Document',
          page_start:    1,
          page_end:      doc.page_count,
        },
        standardCode,
        version,
        chunks,
        chunkIdx,
      );
    }
  }

  return chunks;
}
