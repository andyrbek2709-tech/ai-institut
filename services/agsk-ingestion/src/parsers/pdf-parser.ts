/**
 * PDF Parser — primary: pdf-parse (Node.js native)
 *               optional: MinerU via HTTP adapter (better for scanned/complex PDFs)
 *
 * Output: structured pages with headings and section hierarchy
 */

import { createHash } from 'crypto';
import { logger } from '../utils/logger.js';
import { env } from '../config/environment.js';

export interface ParsedPage {
  page_number:  number;
  text:         string;
  word_count:   number;
}

export interface ParsedSection {
  heading:      string;
  level:        number;         // 1 = top, 2 = sub, 3 = sub-sub
  section_path: string[];       // ['3', '3.4', '3.4.2']
  content:      string;
  page_start:   number;
  page_end:     number;
}

export interface ParsedDocument {
  text_full:    string;
  pages:        ParsedPage[];
  sections:     ParsedSection[];
  page_count:   number;
  word_count:   number;
  metadata: {
    title?:    string;
    author?:   string;
    subject?:  string;
  };
}

// ── Heading detection (common engineering standard patterns) ───────────────
// Matches: "3.", "3.4", "3.4.2", "SECTION 3", "APPENDIX A", etc.
const HEADING_REGEX = /^(?:(?:\d+(?:\.\d+){0,3}\.?\s+[A-Z])|(?:(?:SECTION|APPENDIX|CHAPTER|ANNEX)\s+[\dA-Z]+))/;
const NUMBERED_HEADING = /^(\d+(?:\.\d+){0,3})\.?\s+(.+)$/;

function detectSectionPath(heading: string): string[] {
  const m = NUMBERED_HEADING.exec(heading.trim());
  if (!m) return [];
  const nums = m[1].split('.');
  return nums.reduce<string[]>((acc, _, i) => {
    acc.push(nums.slice(0, i + 1).join('.'));
    return acc;
  }, []);
}

function extractSections(pages: ParsedPage[]): ParsedSection[] {
  const lines: Array<{ text: string; page: number }> = [];
  for (const p of pages) {
    for (const line of p.text.split('\n')) {
      lines.push({ text: line, page: p.page_number });
    }
  }

  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;

  for (const { text, page } of lines) {
    const trimmed = text.trim();
    if (!trimmed) continue;

    if (HEADING_REGEX.test(trimmed) && trimmed.length < 200) {
      if (current) {
        current.page_end = page;
        sections.push(current);
      }
      const path = detectSectionPath(trimmed);
      current = {
        heading:      trimmed,
        level:        path.length || 1,
        section_path: path,
        content:      '',
        page_start:   page,
        page_end:     page,
      };
    } else if (current) {
      current.content += (current.content ? '\n' : '') + trimmed;
      current.page_end = page;
    } else {
      // Text before first heading → treat as intro section
      current = {
        heading:      'Introduction',
        level:        1,
        section_path: [],
        content:      trimmed,
        page_start:   page,
        page_end:     page,
      };
    }
  }

  if (current) sections.push(current);
  return sections;
}

// ── Primary parser: pdf-parse ─────────────────────────────────────────────

async function parseWithPdfParse(buffer: Buffer): Promise<ParsedDocument> {
  // Dynamic import to handle ESM/CJS boundary
  const pdfParse = (await import('pdf-parse')).default;

  const pages: ParsedPage[] = [];
  let pageIndex = 0;

  const result = await pdfParse(buffer, {
    pagerender(pageData: any) {
      return pageData.getTextContent().then((content: any) => {
        const text = content.items.map((item: any) => item.str).join(' ');
        pageIndex++;
        pages.push({ page_number: pageIndex, text, word_count: text.split(/\s+/).length });
        return text;
      });
    },
  });

  // If custom page render didn't fire (some PDF versions), fall back to full text
  if (pages.length === 0 && result.text) {
    pages.push({ page_number: 1, text: result.text, word_count: result.text.split(/\s+/).length });
  }

  const sections = extractSections(pages);

  return {
    text_full:  result.text,
    pages,
    sections,
    page_count: result.numpages,
    word_count: result.text.split(/\s+/).filter(Boolean).length,
    metadata: {
      title:   result.info?.Title,
      author:  result.info?.Author,
      subject: result.info?.Subject,
    },
  };
}

// ── Optional: MinerU HTTP adapter (Python microservice) ───────────────────
// MinerU gives better accuracy for scanned PDFs and complex table extraction.
// If MINERU_URL env is set and the service is healthy, prefer it.

async function parseWithMinerU(buffer: Buffer): Promise<ParsedDocument | null> {
  if (!env.MINERU_URL) return null;

  try {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'application/pdf' });
    formData.append('file', blob, 'document.pdf');

    const response = await fetch(`${env.MINERU_URL}/parse`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'MinerU parse failed, falling back to pdf-parse');
      return null;
    }

    const data = await response.json() as {
      text_full: string;
      pages: ParsedPage[];
      sections: ParsedSection[];
      page_count: number;
      word_count: number;
      metadata: Record<string, string>;
    };

    return data;
  } catch (err) {
    logger.warn({ err }, 'MinerU unreachable, falling back to pdf-parse');
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export async function parsePDF(buffer: Buffer): Promise<ParsedDocument> {
  // Try MinerU first (better for complex PDFs), fall back to pdf-parse
  const mineru = await parseWithMinerU(buffer);
  if (mineru) {
    logger.debug('PDF parsed via MinerU');
    return mineru;
  }

  const result = await parseWithPdfParse(buffer);
  logger.debug({ pages: result.page_count, words: result.word_count }, 'PDF parsed via pdf-parse');
  return result;
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
