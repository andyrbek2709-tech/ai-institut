/**
 * PDF Parser — primary: pdf-parse (Node.js native)
 *               optional: MinerU via HTTP adapter (better for scanned/complex PDFs)
 *
 * Output: structured pages with headings and section hierarchy
 *
 * Week 3 fixes:
 *   P0.1 — Y-position aware line reconstruction (groups text items by Y coordinate)
 *   P0.2 — Multilingual heading detection with scoring (Latin + Cyrillic)
 */

import { createHash } from 'crypto';
import { logger } from '../utils/logger.js';
import { env } from '../config/environment.js';
import { scoreHeading, HEADING_MIN_SCORE } from '../utils/heading-scorer.js';

export interface ParsedPage {
  page_number: number;
  text:        string;
  word_count:  number;
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
  text_full:  string;
  pages:      ParsedPage[];
  sections:   ParsedSection[];
  page_count: number;
  word_count: number;
  metadata: {
    title?:   string;
    author?:  string;
    subject?: string;
  };
}

// ── P0.1: Y-position aware line reconstruction ─────────────────────────────

/**
 * PDF coordinate space: Y increases bottom-to-top.
 * Items within Y_LINE_THRESHOLD pts of each other are on the same line.
 * Items with a Y-gap > medianLineHeight * PARA_GAP_MULTIPLIER get a blank line between them.
 */
const Y_LINE_THRESHOLD   = 3.0;   // PDF points — items within this delta = same visual line
const PARA_GAP_MULTIPLIER = 1.8;  // gap exceeding medianLineHeight × this = paragraph break

function reconstructPageText(items: any[]): string {
  const textItems = (items as any[]).filter(
    (item) => typeof item.str === 'string' && item.str.length > 0,
  );
  if (!textItems.length) return '';

  // Sort: top-of-page first (descending Y), then left-to-right (ascending X)
  const sorted = [...textItems].sort((a, b) => {
    const yA = a.transform?.[5] ?? 0;
    const yB = b.transform?.[5] ?? 0;
    const yDiff = yB - yA;
    if (Math.abs(yDiff) > Y_LINE_THRESHOLD) return yDiff;
    return (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0);
  });

  // Group items into visual lines by Y coordinate
  const groups: { y: number; strs: string[] }[] = [];
  for (const item of sorted) {
    const y = item.transform?.[5] ?? 0;
    const last = groups[groups.length - 1];
    if (!last || Math.abs(last.y - y) > Y_LINE_THRESHOLD) {
      groups.push({ y, strs: [item.str] });
    } else {
      last.strs.push(item.str);
    }
  }

  if (!groups.length) return '';

  // Compute median line-height from consecutive Y-gaps
  const yGaps: number[] = [];
  for (let i = 0; i < groups.length - 1; i++) {
    yGaps.push(Math.abs(groups[i].y - groups[i + 1].y));
  }
  yGaps.sort((a, b) => a - b);
  const medianGap = yGaps.length ? yGaps[Math.floor(yGaps.length / 2)] : 12;
  const paraThreshold = medianGap * PARA_GAP_MULTIPLIER;

  const lines: string[] = [];
  for (let i = 0; i < groups.length; i++) {
    // Join items in line: keep trailing/leading spaces as-is, otherwise insert space
    const lineText = groups[i].strs
      .reduce<string>((acc, str) => {
        if (!acc) return str;
        const needsSpace = !acc.endsWith(' ') && !str.startsWith(' ') && !acc.endsWith('-');
        if (acc.endsWith('-')) return acc.slice(0, -1) + str; // de-hyphenate word-wrap
        return acc + (needsSpace ? ' ' : '') + str;
      }, '')
      .trim();

    if (lineText) lines.push(lineText);

    // Paragraph gap detection
    if (i < groups.length - 1) {
      const gap = Math.abs(groups[i].y - groups[i + 1].y);
      if (gap > paraThreshold) lines.push('');
    }
  }

  return lines.join('\n');
}

// ── P0.2: Heading detection (see src/utils/heading-scorer.ts for scoring) ─

export type { HeadingScore } from '../utils/heading-scorer.js';

function isHeading(line: string): boolean {
  return scoreHeading(line).score >= HEADING_MIN_SCORE;
}

// ── Section detection (uses heading scorer) ───────────────────────────────

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

    if (isHeading(trimmed)) {
      if (current) {
        current.page_end = page;
        sections.push(current);
      }
      const hScore = scoreHeading(trimmed);
      const path   = detectSectionPath(trimmed);
      current = {
        heading:      trimmed,
        level:        hScore.level || (path.length || 1),
        section_path: path,
        content:      '',
        page_start:   page,
        page_end:     page,
      };
    } else if (current) {
      current.content += (current.content ? '\n' : '') + trimmed;
      current.page_end = page;
    } else {
      // Text before first heading → intro section
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
  const pdfParse = (await import('pdf-parse')).default;

  const pages: ParsedPage[] = [];
  let pageIndex = 0;

  const result = await pdfParse(buffer, {
    pagerender(pageData: any) {
      return pageData.getTextContent().then((content: any) => {
        // P0.1: Y-position aware reconstruction instead of naive join
        const text = reconstructPageText(content.items ?? []);
        pageIndex++;
        pages.push({
          page_number: pageIndex,
          text,
          word_count: text.split(/\s+/).filter(Boolean).length,
        });
        return text;
      });
    },
  });

  // Fallback if custom pagerender didn't fire
  if (pages.length === 0 && result.text) {
    pages.push({
      page_number: 1,
      text:        result.text,
      word_count:  result.text.split(/\s+/).filter(Boolean).length,
    });
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

// ── Optional: MinerU HTTP adapter ─────────────────────────────────────────

async function parseWithMinerU(buffer: Buffer): Promise<ParsedDocument | null> {
  if (!env.MINERU_URL) return null;

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: 'application/pdf' });
    formData.append('file', blob, 'document.pdf');

    const response = await fetch(`${env.MINERU_URL}/parse`, {
      method: 'POST',
      body:   formData,
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'MinerU parse failed, falling back to pdf-parse');
      return null;
    }

    return response.json() as Promise<ParsedDocument>;
  } catch (err) {
    logger.warn({ err }, 'MinerU unreachable, falling back to pdf-parse');
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export async function parsePDF(buffer: Buffer): Promise<ParsedDocument> {
  const mineru = await parseWithMinerU(buffer);
  if (mineru) {
    logger.debug('PDF parsed via MinerU');
    return mineru;
  }

  const result = await parseWithPdfParse(buffer);
  logger.debug(
    { pages: result.page_count, sections: result.sections.length, words: result.word_count },
    'PDF parsed via pdf-parse',
  );
  return result;
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
