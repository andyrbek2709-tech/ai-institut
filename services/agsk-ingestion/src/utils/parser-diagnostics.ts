/**
 * Parser diagnostics — collects per-PDF metrics after parsing + chunking.
 * Used by the ingestion handler to log quality signals before embedding.
 */

import { ParsedDocument } from '../parsers/pdf-parser.js';
import { scoreHeading } from './heading-scorer.js';
import { Chunk, CHUNK_SIZE_TOKENS } from '../processors/chunker.js';

export interface HeadingDetection {
  text:       string;
  page:       number;
  confidence: number;
  level:      number;
  type:       string;
}

export interface TextSnapshot {
  page:   number;
  lines:  number;
  sample: string;  // first 300 chars of reconstructed page text
}

export interface ChunkQuality {
  total_chunks:    number;
  avg_tokens:      number;
  min_tokens:      number;
  max_tokens:      number;
  oversized:       number;   // chunks > CHUNK_SIZE_TOKENS * 1.1
  undersized:      number;   // chunks < 50 tokens
  orphan_chunks:   number;   // citation_section = "" (no section detected)
  section_coverage: number;  // 0–1: fraction of chunks with non-empty citation_section
}

export interface ParserDiagnostics {
  // Source info
  filename:       string;
  parsed_at:      string;   // ISO datetime
  parser_used:    'pdf-parse' | 'mineru';

  // Page-level
  total_pages:     number;
  total_words:     number;
  avg_words_per_page: number;
  empty_pages:     number;

  // Heading detection
  heading_count:          number;
  heading_detections:     HeadingDetection[];
  avg_heading_confidence: number;
  headings_by_level:      Record<number, number>;
  heading_types:          Record<string, number>;

  // Chunk quality
  chunk_quality: ChunkQuality;

  // OCR / encoding signals
  ocr_anomaly_pages:  number[];   // pages where avg word length > 15 (likely OCR failure)
  encoding_issues:    number;     // pages with non-UTF-8 replacement chars

  // Table hints
  table_hints_detected: number;   // lines matching |col|col| or tab-separated patterns

  // Text snapshots (first 3 pages)
  text_snapshots: TextSnapshot[];
}

// ── Collection helpers ─────────────────────────────────────────────────────

function detectOcrAnomalies(pages: ParsedDocument['pages']): number[] {
  const anomalyPages: number[] = [];
  for (const page of pages) {
    if (!page.text) continue;
    const words = page.text.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    const avgLen = words.reduce((s, w) => s + w.length, 0) / words.length;
    if (avgLen > 15) anomalyPages.push(page.page_number); // garbled OCR produces very long "words"
  }
  return anomalyPages;
}

function countEncodingIssues(pages: ParsedDocument['pages']): number {
  let count = 0;
  for (const page of pages) {
    if (page.text.includes('�')) count++;
  }
  return count;
}

function detectTableHints(pages: ParsedDocument['pages']): number {
  let hints = 0;
  const tablePattern = /(\|[^|]+){2,}\||\t[^\t]+\t[^\t]+/;
  for (const page of pages) {
    for (const line of page.text.split('\n')) {
      if (tablePattern.test(line)) hints++;
    }
  }
  return hints;
}

function buildHeadingDetections(doc: ParsedDocument): HeadingDetection[] {
  const detections: HeadingDetection[] = [];
  for (const page of doc.pages) {
    for (const line of page.text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const h = scoreHeading(trimmed);
      if (h.score >= 40) {
        detections.push({
          text:       trimmed.slice(0, 120),
          page:       page.page_number,
          confidence: h.confidence,
          level:      h.level,
          type:       h.type,
        });
      }
    }
  }
  return detections;
}

function buildChunkQuality(chunks: Chunk[]): ChunkQuality {
  if (!chunks.length) {
    return {
      total_chunks: 0, avg_tokens: 0, min_tokens: 0, max_tokens: 0,
      oversized: 0, undersized: 0, orphan_chunks: 0, section_coverage: 0,
    };
  }
  const tokens      = chunks.map(c => c.content_tokens);
  const oversized   = chunks.filter(c => c.content_tokens > CHUNK_SIZE_TOKENS * 1.1).length;
  const undersized  = chunks.filter(c => c.content_tokens < 50).length;
  const orphans     = chunks.filter(c => !c.citation_section).length;
  const avg         = Math.round(tokens.reduce((s, t) => s + t, 0) / tokens.length);

  return {
    total_chunks:     chunks.length,
    avg_tokens:       avg,
    min_tokens:       Math.min(...tokens),
    max_tokens:       Math.max(...tokens),
    oversized,
    undersized,
    orphan_chunks:    orphans,
    section_coverage: parseFloat(((chunks.length - orphans) / chunks.length).toFixed(3)),
  };
}

function buildTextSnapshots(pages: ParsedDocument['pages']): TextSnapshot[] {
  return pages.slice(0, 3).map(p => ({
    page:   p.page_number,
    lines:  p.text.split('\n').filter(Boolean).length,
    sample: p.text.slice(0, 300),
  }));
}

// ── Public API ─────────────────────────────────────────────────────────────

export function buildParserDiagnostics(
  doc:        ParsedDocument,
  chunks:     Chunk[],
  filename:   string,
  parserUsed: 'pdf-parse' | 'mineru' = 'pdf-parse',
): ParserDiagnostics {
  const headingDetections = buildHeadingDetections(doc);
  const headingsByLevel   = headingDetections.reduce<Record<number, number>>((acc, h) => {
    acc[h.level] = (acc[h.level] ?? 0) + 1;
    return acc;
  }, {});
  const headingTypes      = headingDetections.reduce<Record<string, number>>((acc, h) => {
    acc[h.type] = (acc[h.type] ?? 0) + 1;
    return acc;
  }, {});
  const avgConf = headingDetections.length
    ? parseFloat((headingDetections.reduce((s, h) => s + h.confidence, 0) / headingDetections.length).toFixed(3))
    : 0;

  const emptyPages = doc.pages.filter(p => !p.text.trim()).length;

  return {
    filename,
    parsed_at:   new Date().toISOString(),
    parser_used: parserUsed,

    total_pages:      doc.page_count,
    total_words:      doc.word_count,
    avg_words_per_page: doc.page_count
      ? Math.round(doc.word_count / doc.page_count)
      : 0,
    empty_pages:      emptyPages,

    heading_count:          headingDetections.length,
    heading_detections:     headingDetections.slice(0, 50), // cap at 50 for log size
    avg_heading_confidence: avgConf,
    headings_by_level:      headingsByLevel,
    heading_types:          headingTypes,

    chunk_quality: buildChunkQuality(chunks),

    ocr_anomaly_pages:    detectOcrAnomalies(doc.pages),
    encoding_issues:      countEncodingIssues(doc.pages),
    table_hints_detected: detectTableHints(doc.pages),

    text_snapshots: buildTextSnapshots(doc.pages),
  };
}

export function logDiagnosticsSummary(diag: ParserDiagnostics, log: (msg: string) => void): void {
  log(`[Parser Diagnostics] ${diag.filename}`);
  log(`  Pages: ${diag.total_pages}  Words: ${diag.total_words}  Empty pages: ${diag.empty_pages}`);
  log(`  Headings detected: ${diag.heading_count}  Avg confidence: ${diag.avg_heading_confidence}`);
  log(`  Chunks: ${diag.chunk_quality.total_chunks}  Avg tokens: ${diag.chunk_quality.avg_tokens}`);
  log(`  Oversized: ${diag.chunk_quality.oversized}  Orphan: ${diag.chunk_quality.orphan_chunks}  Section coverage: ${(diag.chunk_quality.section_coverage * 100).toFixed(1)}%`);
  if (diag.ocr_anomaly_pages.length) {
    log(`  OCR anomaly pages: ${diag.ocr_anomaly_pages.slice(0, 10).join(', ')}${diag.ocr_anomaly_pages.length > 10 ? '...' : ''}`);
  }
  if (diag.encoding_issues) {
    log(`  Encoding issues: ${diag.encoding_issues} pages`);
  }
  log(`  Table hints: ${diag.table_hints_detected}`);
}
