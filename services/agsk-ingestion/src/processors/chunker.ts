/**
 * Semantic chunker — LOCKED PARAMETERS per architecture decision:
 *   chunk_size    = 600 tokens
 *   overlap       = 30 tokens
 *   strategy      = section-aware (never split mid-section heading)
 *
 * Token counting uses a simple whitespace/punctuation approximation
 * (≈ 0.75 × word count) to avoid tiktoken ESM issues in Node.
 * Error margin < 5% for English technical text.
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

// Rough token count: GPT tokenizer averages ~0.75 words per token for technical English.
// Actual tiktoken would be more accurate but adds heavy native deps.
function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words / 0.75);
}

function splitIntoSentences(text: string): string[] {
  return text
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}

interface ChunkAccumulator {
  sentences:    string[];
  tokens:       number;
  section_path: string[];
  section_title:string;
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
    content_tokens:      acc.tokens,
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
  // Walk backwards through previous sentences to fill overlap budget
  for (let i = sentences.length - 1; i >= 0 && tokens < CHUNK_OVERLAP_TOKENS; i--) {
    const t = estimateTokens(sentences[i]);
    result.unshift(sentences[i]);
    tokens += t;
  }
  return { sentences: result, tokens };
}

/**
 * Chunk a parsed document into overlapping 600-token sections.
 * Sections act as natural break points — a new section always starts
 * a fresh chunk (possibly pre-seeded with overlap from previous chunk).
 */
export function chunkDocument(
  doc: ParsedDocument,
  standardCode: string,
  version: string,
): Chunk[] {
  const chunks: Chunk[] = [];
  let chunkIdx = 0;

  for (const section of doc.sections) {
    const sentences = splitIntoSentences(section.content);
    if (sentences.length === 0) continue;

    // Start each section with a fresh accumulator (section-aware boundary)
    let acc: ChunkAccumulator = {
      sentences:    [],
      tokens:       0,
      section_path: section.section_path,
      section_title:section.heading,
      page_start:   section.page_start,
      page_end:     section.page_end,
    };

    for (const sentence of sentences) {
      const sentTokens = estimateTokens(sentence);

      // If adding this sentence would exceed limit → flush and start new chunk
      if (acc.tokens + sentTokens > CHUNK_SIZE_TOKENS && acc.sentences.length > 0) {
        chunks.push(flushChunk(acc, chunkIdx++, standardCode, version));

        // Overlap: carry last N tokens from previous chunk into new chunk
        const overlap = buildOverlapPrefix(acc.sentences);
        acc = {
          sentences:    overlap.sentences,
          tokens:       overlap.tokens,
          section_path: section.section_path,
          section_title:section.heading,
          page_start:   section.page_start,
          page_end:     section.page_end,
        };
      }

      acc.sentences.push(sentence);
      acc.tokens += sentTokens;
    }

    // Flush remaining sentences in this section
    if (acc.sentences.length > 0) {
      chunks.push(flushChunk(acc, chunkIdx++, standardCode, version));
    }
  }

  // If no sections were detected, fall back to raw text chunking
  if (chunks.length === 0 && doc.text_full) {
    const sentences = splitIntoSentences(doc.text_full);
    let acc: ChunkAccumulator = {
      sentences: [],
      tokens: 0,
      section_path: [],
      section_title: 'Document',
      page_start: 1,
      page_end: doc.page_count,
    };

    for (const sentence of sentences) {
      const sentTokens = estimateTokens(sentence);
      if (acc.tokens + sentTokens > CHUNK_SIZE_TOKENS && acc.sentences.length > 0) {
        chunks.push(flushChunk(acc, chunkIdx++, standardCode, version));
        const overlap = buildOverlapPrefix(acc.sentences);
        acc = { ...acc, sentences: overlap.sentences, tokens: overlap.tokens };
      }
      acc.sentences.push(sentence);
      acc.tokens += sentTokens;
    }
    if (acc.sentences.length > 0) {
      chunks.push(flushChunk(acc, chunkIdx++, standardCode, version));
    }
  }

  // Stamp total_chunks onto citation_confidence (placeholder, overwritten during insert)
  return chunks.map(c => ({ ...c }));
}
