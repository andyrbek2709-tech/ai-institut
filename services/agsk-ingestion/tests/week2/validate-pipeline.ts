/**
 * Week 2 Validation — Real PDF Ingestion Pipeline
 * Offline script: no Supabase, no OpenAI, no Redis required.
 *
 * Tests:
 *   1. Real AGSK-3 PDF parsing (pdf-parse)
 *   2. Section detection and hierarchy
 *   3. Chunker quality (sizes, overlap, section integrity)
 *   4. Metadata extraction quality
 *   5. Citation integrity
 *   6. OCR / Cyrillic encoding analysis
 *   7. Broken / orphan / duplicate chunk detection
 *
 * Run: npx tsx tests/week2/validate-pipeline.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

// ------------------------------------------------------------------
// Direct imports — NO environment.ts, NO logger
// ------------------------------------------------------------------
import { chunkDocument, CHUNK_SIZE_TOKENS, CHUNK_OVERLAP_TOKENS } from '../../src/processors/chunker.js';
import { extractMetadata } from '../../src/processors/metadata-extractor.js';
import type { ParsedDocument, ParsedPage, ParsedSection } from '../../src/parsers/pdf-parser.js';

// ------------------------------------------------------------------
// Re-implement PDF parsing inline (avoids logger/env dependencies)
// ------------------------------------------------------------------

const HEADING_REGEX = /^(?:(?:\d+(?:\.\d+){0,3}\.?\s+[A-Z])|(?:(?:SECTION|APPENDIX|CHAPTER|ANNEX|РАЗДЕЛ|ПРИЛОЖЕНИЕ|ГЛАВА)\s+[\dA-ZА-Я]+))/;
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
        heading: trimmed,
        level: path.length || 1,
        section_path: path,
        content: '',
        page_start: page,
        page_end: page,
      };
    } else if (current) {
      current.content += (current.content ? '\n' : '') + trimmed;
      current.page_end = page;
    } else {
      current = {
        heading: 'Preamble',
        level: 1,
        section_path: [],
        content: trimmed,
        page_start: page,
        page_end: page,
      };
    }
  }

  if (current) sections.push(current);
  return sections;
}

async function parsePDFOffline(pdfPath: string): Promise<ParsedDocument> {
  const pdfParse = (await import('pdf-parse')).default;
  const buffer = readFileSync(pdfPath);

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

  if (pages.length === 0 && result.text) {
    pages.push({ page_number: 1, text: result.text, word_count: result.text.split(/\s+/).length });
  }

  const sections = extractSections(pages);

  return {
    text_full: result.text,
    pages,
    sections,
    page_count: result.numpages,
    word_count: result.text.split(/\s+/).filter(Boolean).length,
    metadata: {
      title: result.info?.Title,
      author: result.info?.Author,
      subject: result.info?.Subject,
    },
  };
}

// ------------------------------------------------------------------
// Analysis helpers
// ------------------------------------------------------------------

function cyrillicRatio(text: string): number {
  if (!text) return 0;
  const cyrillic = (text.match(/[Ѐ-ӿ]/g) || []).length;
  const alpha = (text.match(/[a-zA-ZЀ-ӿ]/g) || []).length;
  return alpha > 0 ? cyrillic / alpha : 0;
}

function detectGarbledText(text: string): string[] {
  const issues: string[] = [];
  // Replacement chars (U+FFFD)
  if (/�/.test(text)) issues.push('unicode_replacement_char');
  // Repeated nonsense characters
  if (/([^\w\s])\1{4,}/.test(text)) issues.push('repeated_non_word_chars');
  // Very long "words" without spaces (often from bad OCR)
  const words = text.split(/\s+/);
  const longWordCount = words.filter(w => w.length > 50).length;
  if (longWordCount > 5) issues.push(`long_words_without_spaces:${longWordCount}`);
  // Missing spaces after periods (merged lines)
  const mergedSentences = (text.match(/[a-zа-яё]\.[A-ZА-ЯЁ]/g) || []).length;
  if (mergedSentences > 10) issues.push(`merged_sentences:${mergedSentences}`);
  return issues;
}

function isTableLike(text: string): boolean {
  // Look for table indicators: many numbers in rows, pipe chars, tab-separated data
  const hasPipes = (text.match(/\|/g) || []).length > 3;
  const hasTabs = (text.match(/\t/g) || []).length > 3;
  const hasNumericRows = (text.match(/^\s*[\d.,]+\s+[\d.,]+/gm) || []).length > 2;
  return hasPipes || hasTabs || hasNumericRows;
}

function findBrokenRequirements(chunks: ReturnType<typeof chunkDocument>): string[] {
  const broken: string[] = [];
  for (const chunk of chunks) {
    // Requirement that starts but doesn't complete (no period at end)
    if (/shall\s+\w+\s*$/i.test(chunk.content) || /must\s+\w+\s*$/i.test(chunk.content)) {
      broken.push(`chunk_${chunk.chunk_index}: requirement seems truncated`);
    }
    // Section number at the end of a chunk (section heading split across chunks)
    if (/\b\d+\.\d+\.\d*\s*$/.test(chunk.content)) {
      broken.push(`chunk_${chunk.chunk_index}: possible section heading at end`);
    }
  }
  return broken;
}

// ------------------------------------------------------------------
// Main validation
// ------------------------------------------------------------------

async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const PDF_PATH = resolve(__dirname, '../../../../AGSK-3(po_sost.na_13.03.26).pdf');

  console.log('='.repeat(70));
  console.log('AGSK Week 2 — Real PDF Ingestion Validation');
  console.log('='.repeat(70));
  console.log(`PDF: ${PDF_PATH}`);

  const startTotal = Date.now();

  // ------------------------------------------------------------------
  // 1. PDF Parsing
  // ------------------------------------------------------------------
  console.log('\n[1/6] Parsing PDF...');
  const parseStart = Date.now();
  const doc = await parsePDFOffline(PDF_PATH);
  const parseMs = Date.now() - parseStart;

  const sample2000 = doc.text_full.slice(0, 2000);
  const fullCyrRatio = cyrillicRatio(doc.text_full.slice(0, 50000));
  const garbled = detectGarbledText(doc.text_full.slice(0, 100000));

  console.log(`  ✓ Pages:      ${doc.page_count}`);
  console.log(`  ✓ Words:      ${doc.word_count}`);
  console.log(`  ✓ Sections:   ${doc.sections.length}`);
  console.log(`  ✓ Parse time: ${parseMs}ms`);
  console.log(`  ✓ Cyrillic ratio: ${(fullCyrRatio * 100).toFixed(1)}%`);
  console.log(`  ✓ OCR issues: ${garbled.length === 0 ? 'NONE' : garbled.join(', ')}`);
  if (doc.metadata.title) console.log(`  ✓ PDF Title: "${doc.metadata.title}"`);

  // ------------------------------------------------------------------
  // 2. Section Analysis
  // ------------------------------------------------------------------
  console.log('\n[2/6] Section Analysis...');

  const depthCounts = [0, 0, 0, 0];
  const orphanSections: string[] = [];
  const shortSections: string[] = [];
  const sampleSections = doc.sections.slice(0, 10);

  for (const s of doc.sections) {
    const depth = Math.min(s.level, 3);
    depthCounts[depth]++;
    if (s.section_path.length === 0 && s.heading !== 'Preamble') {
      orphanSections.push(`"${s.heading.slice(0, 60)}"`);
    }
    if (s.content.split(/\s+/).length < 5) {
      shortSections.push(`"${s.heading.slice(0, 60)}"`);
    }
  }

  console.log(`  ✓ Depth-1 sections: ${depthCounts[1]}`);
  console.log(`  ✓ Depth-2 sections: ${depthCounts[2]}`);
  console.log(`  ✓ Depth-3 sections: ${depthCounts[3]}`);
  console.log(`  ✓ Orphan sections (no path): ${orphanSections.length}`);
  console.log(`  ✓ Near-empty sections (<5 words): ${shortSections.length}`);

  console.log('\n  Sample section headings (first 10):');
  for (const s of sampleSections) {
    console.log(`    [L${s.level}] ${s.heading.slice(0, 80)} (p.${s.page_start}, words:${s.content.split(/\s+/).length})`);
  }

  // ------------------------------------------------------------------
  // 3. Metadata Extraction
  // ------------------------------------------------------------------
  console.log('\n[3/6] Metadata Extraction...');

  const meta = extractMetadata(doc.text_full, 'AGSK-3(po_sost.na_13.03.26).pdf', doc.metadata);

  console.log(`  standard_code: "${meta.standard_code}"`);
  console.log(`  title:         "${meta.title?.slice(0, 80)}"`);
  console.log(`  organization:  "${meta.organization ?? 'NOT DETECTED'}"`);
  console.log(`  discipline:    "${meta.discipline ?? 'NOT DETECTED'}"`);
  console.log(`  year:          ${meta.year ?? 'NOT DETECTED'}`);
  console.log(`  version:       "${meta.version ?? 'NOT DETECTED'}"`);
  console.log(`  keywords (${meta.keywords.length}): ${meta.keywords.slice(0, 10).join(', ')}`);

  const metadataScore = [
    meta.organization ? 1 : 0,
    meta.discipline ? 1 : 0,
    meta.year ? 1 : 0,
    meta.version ? 1 : 0,
  ].reduce((a, b) => a + b, 0);
  console.log(`  Metadata completeness: ${metadataScore}/4`);

  // ------------------------------------------------------------------
  // 4. Chunking
  // ------------------------------------------------------------------
  console.log('\n[4/6] Chunking...');

  const chunkStart = Date.now();
  const standardCode = meta.standard_code || 'AGSK-3';
  const version = String(meta.year || '2026');
  const chunks = chunkDocument(doc, standardCode, version);
  const chunkMs = Date.now() - chunkStart;

  const tokenSizes = chunks.map(c => c.content_tokens);
  const avgTokens = tokenSizes.reduce((a, b) => a + b, 0) / (tokenSizes.length || 1);
  const minTokens = Math.min(...tokenSizes);
  const maxTokens = Math.max(...tokenSizes);
  const overLimitChunks = chunks.filter(c => c.content_tokens > CHUNK_SIZE_TOKENS + 50);
  const tinyChunks = chunks.filter(c => c.content_tokens < 20);
  const tableLikeChunks = chunks.filter(c => isTableLike(c.content));

  console.log(`  ✓ Total chunks:   ${chunks.length}`);
  console.log(`  ✓ Chunk time:     ${chunkMs}ms`);
  console.log(`  ✓ Avg tokens:     ${avgTokens.toFixed(1)} (target: ~${CHUNK_SIZE_TOKENS})`);
  console.log(`  ✓ Min tokens:     ${minTokens}`);
  console.log(`  ✓ Max tokens:     ${maxTokens}`);
  console.log(`  ✓ Over-limit (>${CHUNK_SIZE_TOKENS+50}): ${overLimitChunks.length}`);
  console.log(`  ✓ Tiny (<20 tok): ${tinyChunks.length}`);
  console.log(`  ✓ Table-like:     ${tableLikeChunks.length}`);

  // Token distribution histogram
  const buckets = { '0-100': 0, '101-300': 0, '301-500': 0, '501-600': 0, '601+': 0 };
  for (const t of tokenSizes) {
    if (t <= 100) buckets['0-100']++;
    else if (t <= 300) buckets['101-300']++;
    else if (t <= 500) buckets['301-500']++;
    else if (t <= 600) buckets['501-600']++;
    else buckets['601+']++;
  }
  console.log('  Token distribution:', buckets);

  // ------------------------------------------------------------------
  // 5. Chunk Quality Issues
  // ------------------------------------------------------------------
  console.log('\n[5/6] Chunk Quality Analysis...');

  // Duplicates
  const contentHashes = new Map<string, number[]>();
  for (const c of chunks) {
    const hash = createHash('sha256').update(c.content).digest('hex').slice(0, 16);
    if (!contentHashes.has(hash)) contentHashes.set(hash, []);
    contentHashes.get(hash)!.push(c.chunk_index);
  }
  const duplicates = [...contentHashes.entries()].filter(([, idxs]) => idxs.length > 1);

  // Orphan chunks (no section_path)
  const orphanChunks = chunks.filter(c => c.section_path.length === 0 && c.section_title !== 'Document' && c.section_title !== 'Preamble');

  // Broken requirements (requirement text mid-sentence)
  const brokenReqs = findBrokenRequirements(chunks);

  // Citation quality
  const missingSection = chunks.filter(c => !c.citation_section);
  const missingPage = chunks.filter(c => c.citation_page === 0 || c.citation_page == null);
  const zeroConfidence = chunks.filter(c => c.citation_confidence < 1.0);

  console.log(`  Duplicate content chunks:  ${duplicates.length}`);
  console.log(`  Orphan chunks (no section): ${orphanChunks.length}`);
  console.log(`  Broken requirements:       ${brokenReqs.length}`);
  console.log(`  Chunks missing section:    ${missingSection.length}`);
  console.log(`  Chunks missing page:       ${missingPage.length}`);
  console.log(`  Chunks low confidence:     ${zeroConfidence.length}`);

  // ------------------------------------------------------------------
  // 6. Citation Integrity
  // ------------------------------------------------------------------
  console.log('\n[6/6] Citation Integrity...');

  const sampleCitations = chunks.slice(0, 5).map(c => ({
    idx: c.chunk_index,
    document: c.citation_document,
    standard: c.citation_standard,
    section: c.citation_section || '(empty)',
    page: c.citation_page,
    version: c.citation_version,
    confidence: c.citation_confidence,
  }));

  console.log('  Sample citations (first 5 chunks):');
  for (const cit of sampleCitations) {
    console.log(`    chunk[${cit.idx}]: "${cit.document}" | section="${cit.section}" | p.${cit.page} | v=${cit.version} | conf=${cit.confidence}`);
  }

  const uniqueSections = new Set(chunks.map(c => c.citation_section)).size;
  const uniquePages = new Set(chunks.map(c => c.citation_page)).size;
  console.log(`  Unique cited sections: ${uniqueSections}`);
  console.log(`  Unique cited pages:    ${uniquePages}`);

  // ------------------------------------------------------------------
  // Sample chunks for manual review
  // ------------------------------------------------------------------
  console.log('\n--- Sample Chunks (first 3) ---');
  for (const chunk of chunks.slice(0, 3)) {
    console.log(`\n  [chunk_${chunk.chunk_index}] section="${chunk.section_title.slice(0, 50)}" tokens=${chunk.content_tokens}`);
    console.log(`  path=${JSON.stringify(chunk.section_path)} page=${chunk.page_start}`);
    console.log(`  content: "${chunk.content.slice(0, 200)}..."`);
  }

  // ------------------------------------------------------------------
  // Build report object
  // ------------------------------------------------------------------
  const totalMs = Date.now() - startTotal;

  const report = {
    generated_at: new Date().toISOString(),
    pdf_file: 'AGSK-3(po_sost.na_13.03.26).pdf',
    pdf_size_mb: Math.round(readFileSync(PDF_PATH).length / 1024 / 1024),
    total_validation_ms: totalMs,

    parsing: {
      page_count: doc.page_count,
      word_count: doc.word_count,
      section_count: doc.sections.length,
      parse_ms: parseMs,
      cyrillic_ratio_pct: parseFloat((fullCyrRatio * 100).toFixed(1)),
      ocr_issues: garbled,
      pdf_title: doc.metadata.title ?? null,
      pdf_author: doc.metadata.author ?? null,
    },

    sections: {
      depth1: depthCounts[1],
      depth2: depthCounts[2],
      depth3: depthCounts[3],
      orphan_count: orphanSections.length,
      short_count: shortSections.length,
      sample_headings: doc.sections.slice(0, 20).map(s => ({
        heading: s.heading.slice(0, 100),
        level: s.level,
        path: s.section_path,
        page: s.page_start,
        word_count: s.content.split(/\s+/).length,
      })),
    },

    metadata: {
      standard_code: meta.standard_code,
      title: meta.title?.slice(0, 200),
      organization: meta.organization ?? null,
      discipline: meta.discipline ?? null,
      year: meta.year ?? null,
      version: meta.version ?? null,
      keywords: meta.keywords,
      completeness_score: `${metadataScore}/4`,
    },

    chunking: {
      total_chunks: chunks.length,
      chunk_ms: chunkMs,
      avg_tokens: parseFloat(avgTokens.toFixed(1)),
      min_tokens: minTokens,
      max_tokens: maxTokens,
      over_limit_count: overLimitChunks.length,
      tiny_count: tinyChunks.length,
      table_like_count: tableLikeChunks.length,
      token_distribution: buckets,
    },

    quality_issues: {
      duplicate_chunks: duplicates.length,
      orphan_chunks: orphanChunks.length,
      broken_requirements: brokenReqs.length,
      missing_section_citation: missingSection.length,
      missing_page_citation: missingPage.length,
      low_confidence_citations: zeroConfidence.length,
    },

    citation_integrity: {
      unique_sections: uniqueSections,
      unique_pages: uniquePages,
      sample_citations: sampleCitations,
    },

    sample_chunks: chunks.slice(0, 10).map(c => ({
      chunk_index: c.chunk_index,
      section_title: c.section_title.slice(0, 100),
      section_path: c.section_path,
      page_start: c.page_start,
      content_tokens: c.content_tokens,
      content_preview: c.content.slice(0, 300),
      citation_document: c.citation_document,
      citation_section: c.citation_section,
    })),

    recommendations: [] as string[],
  };

  // ------------------------------------------------------------------
  // Generate recommendations
  // ------------------------------------------------------------------
  if (fullCyrRatio < 0.1 && doc.word_count > 1000) {
    report.recommendations.push('WARN: Low Cyrillic ratio on a Russian standard — possible encoding issue');
  }
  if (garbled.length > 0) {
    report.recommendations.push(`BLOCKER: OCR issues detected: ${garbled.join(', ')}`);
  }
  if (doc.sections.length < 5) {
    report.recommendations.push('WARN: Very few sections detected — heading regex may need Cyrillic patterns');
  }
  if (orphanSections.length > doc.sections.length * 0.3) {
    report.recommendations.push('WARN: >30% orphan sections — section path extraction needs improvement');
  }
  if (metadataScore < 3) {
    report.recommendations.push('WARN: Metadata completeness low — metadata-extractor needs GOST/Russian patterns');
  }
  if (overLimitChunks.length > chunks.length * 0.05) {
    report.recommendations.push('WARN: >5% over-limit chunks — sentence splitter may be too aggressive');
  }
  if (tinyChunks.length > chunks.length * 0.1) {
    report.recommendations.push('WARN: >10% tiny chunks — consider merging short section tails');
  }
  if (duplicates.length > 0) {
    report.recommendations.push(`WARN: ${duplicates.length} duplicate chunks detected — dedup before indexing`);
  }
  if (missingSection.length > chunks.length * 0.2) {
    report.recommendations.push('WARN: >20% chunks missing section citation — section detection incomplete');
  }
  if (avgTokens < 200) {
    report.recommendations.push('WARN: Average chunk size very low — may need larger chunk_size or merge strategy');
  }
  if (report.recommendations.length === 0) {
    report.recommendations.push('OK: No critical issues detected');
  }

  // ------------------------------------------------------------------
  // Save results
  // ------------------------------------------------------------------
  const outPath = resolve(__dirname, '../../../week2-validation-results.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('\n' + '='.repeat(70));
  console.log('RECOMMENDATIONS:');
  for (const r of report.recommendations) {
    const icon = r.startsWith('BLOCKER') ? '🚨' : r.startsWith('WARN') ? '⚠️' : '✅';
    console.log(`  ${icon} ${r}`);
  }
  console.log('='.repeat(70));
  console.log(`Total time: ${totalMs}ms`);
  console.log(`Results saved to: ${outPath}`);
  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
