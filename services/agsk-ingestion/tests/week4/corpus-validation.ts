/**
 * Week 4 — Full Corpus Validation
 *
 * Uses the ACTUAL production parser (Week 3 fixes applied):
 *   - P0.1: Y-position aware line reconstruction
 *   - P0.2: Multilingual heading scorer (Latin + Cyrillic)
 *   - H1/H2: Word-level split + fallback fixes
 *   - M1/M2: CIS/ГОСТ metadata + Cyrillic keyword extraction
 *
 * Offline: no Supabase, no OpenAI, no Redis.
 * Run: npx tsx tests/week4/corpus-validation.ts [--pages N]
 */

// ── Stub env vars BEFORE any production module imports ──────────────────────
process.env.SUPABASE_URL         = 'http://stub';
process.env.SUPABASE_SERVICE_KEY = 'stub';
process.env.OPENAI_API_KEY       = 'stub';
process.env.REDIS_URL            = 'redis://stub';
process.env.NODE_ENV             = 'test';
process.env.LOG_LEVEL            = 'silent';

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { performance } from 'perf_hooks';

// ── Production parser imports (Week 3 code path) ─────────────────────────────
import { parsePDF } from '../../src/parsers/pdf-parser.js';
import { chunkDocument, CHUNK_SIZE_TOKENS } from '../../src/processors/chunker.js';
import { extractMetadata } from '../../src/processors/metadata-extractor.js';
import { buildParserDiagnostics } from '../../src/utils/parser-diagnostics.js';
import { scoreHeading } from '../../src/utils/heading-scorer.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DocumentCorpusResult {
  filename:     string;
  pdf_path:     string;
  pdf_size_mb:  number;
  parsed_at:    string;

  parsing: {
    parse_ms:       number;
    page_count:     number;
    word_count:     number;
    section_count:  number;
    empty_pages:    number;
    cyrillic_pct:   number;
    encoding_issues: number;
    ocr_anomaly_pages: number;
  };

  headings: {
    total:          number;
    by_level:       Record<number, number>;
    by_type:        Record<string, number>;
    avg_confidence: number;
    sample:         Array<{ text: string; level: number; type: string; confidence: number; page: number }>;
  };

  sections: {
    total:          number;
    depth_1:        number;
    depth_2:        number;
    depth_3plus:    number;
    orphan_count:   number;
    empty_count:    number;
    avg_words:      number;
    sample_headings: string[];
  };

  metadata: {
    standard_code:  string;
    title:          string;
    organization:   string | null;
    discipline:     string | null;
    year:           number | null;
    version:        string | null;
    keywords:       string[];
    completeness:   number;  // 0-4
  };

  chunks: {
    total:            number;
    chunk_ms:         number;
    avg_tokens:       number;
    median_tokens:    number;
    min_tokens:       number;
    max_tokens:       number;
    oversized_count:  number;
    oversized_pct:    number;
    tiny_count:       number;
    duplicate_count:  number;
    distribution:     Record<string, number>;
  };

  citations: {
    section_fill_rate: number;  // 0-1
    page_fill_rate:    number;
    orphan_chunks:     number;
    unique_sections:   number;
    unique_pages:      number;
    avg_confidence:    number;
    sample:            Array<{
      chunk_idx: number;
      document:  string;
      section:   string;
      page:      number;
      version:   string;
      confidence: number;
    }>;
  };

  vs_week2: {
    section_detection_improvement: string;
    citation_fill_improvement:     string;
    oversized_chunk_improvement:   string;
    metadata_completeness_change:  string;
  };

  diagnostics_summary: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cyrillicPct(text: string): number {
  const sample = text.slice(0, 100_000);
  const cyr = (sample.match(/[Ѐ-ӿ]/g) ?? []).length;
  const alpha = (sample.match(/[a-zA-ZЀ-ӿ]/g) ?? []).length;
  return alpha > 0 ? parseFloat(((cyr / alpha) * 100).toFixed(1)) : 0;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[m - 1] + sorted[m]) / 2)
    : sorted[m];
}

function tokenDist(tokens: number[]): Record<string, number> {
  const d = { '0-99': 0, '100-299': 0, '300-499': 0, '500-600': 0, '601+': 0 };
  for (const t of tokens) {
    if (t < 100)       d['0-99']++;
    else if (t < 300)  d['100-299']++;
    else if (t < 500)  d['300-499']++;
    else if (t <= 600) d['500-600']++;
    else               d['601+']++;
  }
  return d;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function validateDocument(pdfPath: string, filename: string): Promise<DocumentCorpusResult> {
  const statBuf = readFileSync(pdfPath);
  const sizeMB = parseFloat((statBuf.length / 1024 / 1024).toFixed(1));
  const pdfBuf = Buffer.from(statBuf);

  // ── Parse ────────────────────────────────────────────────────────────────
  console.log(`\n  [PARSE] ${filename} (${sizeMB} MB)...`);
  const parseStart = performance.now();
  const doc = await parsePDF(pdfBuf);
  const parseMs = Math.round(performance.now() - parseStart);
  console.log(`    → ${doc.page_count} pages, ${doc.word_count} words, ${doc.sections.length} sections — ${parseMs}ms`);

  // ── Metadata ─────────────────────────────────────────────────────────────
  const meta = extractMetadata(doc.text_full, filename, doc.metadata);
  const metaScore = [meta.organization, meta.discipline, meta.year, meta.version]
    .filter(Boolean).length;

  // ── Heading analysis ─────────────────────────────────────────────────────
  const headingDetections: Array<{ text: string; level: number; type: string; confidence: number; page: number }> = [];
  for (const page of doc.pages) {
    for (const line of page.text.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      const h = scoreHeading(t);
      if (h.score >= 40) {
        headingDetections.push({
          text:       t.slice(0, 100),
          level:      h.level,
          type:       h.type,
          confidence: parseFloat(h.confidence.toFixed(3)),
          page:       page.page_number,
        });
      }
    }
  }

  const headingByLevel = headingDetections.reduce<Record<number, number>>((acc, h) => {
    acc[h.level] = (acc[h.level] ?? 0) + 1;
    return acc;
  }, {});
  const headingByType = headingDetections.reduce<Record<string, number>>((acc, h) => {
    acc[h.type] = (acc[h.type] ?? 0) + 1;
    return acc;
  }, {});
  const avgHeadingConf = headingDetections.length
    ? parseFloat((headingDetections.reduce((s, h) => s + h.confidence, 0) / headingDetections.length).toFixed(3))
    : 0;

  console.log(`    → ${headingDetections.length} headings detected (L1:${headingByLevel[1] ?? 0} L2:${headingByLevel[2] ?? 0} L3:${headingByLevel[3] ?? 0})`);

  // ── Section analysis ─────────────────────────────────────────────────────
  const depth1 = doc.sections.filter(s => s.level === 1).length;
  const depth2 = doc.sections.filter(s => s.level === 2).length;
  const depth3 = doc.sections.filter(s => s.level >= 3).length;
  const orphanSections = doc.sections.filter(s => s.section_path.length === 0 && s.heading !== 'Introduction').length;
  const emptySections  = doc.sections.filter(s => !s.content.trim()).length;
  const sectionWordCounts = doc.sections.map(s => s.content.split(/\s+/).filter(Boolean).length);
  const avgSectionWords = sectionWordCounts.length
    ? Math.round(sectionWordCounts.reduce((a, b) => a + b, 0) / sectionWordCounts.length)
    : 0;

  // ── Chunk ────────────────────────────────────────────────────────────────
  console.log(`    Chunking ${doc.sections.length} sections...`);
  const chunkStart = performance.now();
  const chunks = chunkDocument(doc, meta.standard_code || filename, String(meta.year || ''));
  const chunkMs = Math.round(performance.now() - chunkStart);
  console.log(`    → ${chunks.length} chunks — ${chunkMs}ms`);

  const tokenArr = chunks.map(c => c.content_tokens);
  const avgTokens = tokenArr.length
    ? parseFloat((tokenArr.reduce((a, b) => a + b, 0) / tokenArr.length).toFixed(1))
    : 0;
  const oversized = chunks.filter(c => c.content_tokens > CHUNK_SIZE_TOKENS * 1.1);
  const tiny      = chunks.filter(c => c.content_tokens < 30);

  // Dedup check
  const hashSet = new Set<string>();
  let dupCount = 0;
  for (const c of chunks) {
    const h = createHash('sha256').update(c.content).digest('hex');
    if (hashSet.has(h)) dupCount++;
    else hashSet.add(h);
  }

  // ── Citation analysis ────────────────────────────────────────────────────
  const withSection  = chunks.filter(c => c.citation_section && c.citation_section.length > 0);
  const withPage     = chunks.filter(c => c.citation_page > 0);
  const orphanChunks = chunks.filter(c => !c.citation_section);
  const uniqueSections = new Set(chunks.map(c => c.citation_section).filter(Boolean)).size;
  const uniquePages    = new Set(chunks.map(c => c.citation_page).filter(p => p > 0)).size;
  const avgCitConf = chunks.length
    ? parseFloat((chunks.reduce((s, c) => s + c.citation_confidence, 0) / chunks.length).toFixed(3))
    : 0;
  const sectionFillRate = chunks.length
    ? parseFloat((withSection.length / chunks.length).toFixed(3))
    : 0;
  const pageFillRate = chunks.length
    ? parseFloat((withPage.length / chunks.length).toFixed(3))
    : 0;

  const sampleCitations = chunks.slice(0, 10).map(c => ({
    chunk_idx:  c.chunk_index,
    document:   c.citation_document,
    section:    c.citation_section || '',
    page:       c.citation_page,
    version:    c.citation_version || '',
    confidence: c.citation_confidence,
  }));

  // ── OCR / encoding ────────────────────────────────────────────────────────
  const emptyPages = doc.pages.filter(p => !p.text.trim()).length;
  const encodingIssues = doc.pages.filter(p => p.text.includes('�')).length;
  const ocrAnomalies = doc.pages.filter(p => {
    const words = p.text.split(/\s+/).filter(Boolean);
    if (!words.length) return false;
    const avgLen = words.reduce((s, w) => s + w.length, 0) / words.length;
    return avgLen > 15;
  }).length;

  // ── Week 2 comparison ─────────────────────────────────────────────────────
  const week2 = {
    sections: 0,    // 0 sections before P0.1/P0.2 fixes
    citFill: 0.0,   // 0% citation fill
    oversized: 0.136, // 13.6% oversized
    metaScore: 1,   // 1/4 metadata fields
  };

  const vs_week2 = {
    section_detection_improvement: `${week2.sections} → ${doc.sections.length} sections (+${doc.sections.length})`,
    citation_fill_improvement:     `${(week2.citFill * 100).toFixed(0)}% → ${(sectionFillRate * 100).toFixed(1)}%`,
    oversized_chunk_improvement:   `${(week2.oversized * 100).toFixed(1)}% → ${chunks.length ? ((oversized.length / chunks.length) * 100).toFixed(1) : 'N/A'}%`,
    metadata_completeness_change:  `${week2.metaScore}/4 → ${metaScore}/4`,
  };

  // ── Diagnostics summary ──────────────────────────────────────────────────
  const diag: string[] = [];
  if (doc.sections.length === 0)       diag.push('🔴 BLOCKER: 0 sections detected — heading detection still failing');
  else if (doc.sections.length < 20)   diag.push(`⚠️  WARN: Only ${doc.sections.length} sections — below expected ~100+`);
  else                                  diag.push(`✅ PASS: ${doc.sections.length} sections detected`);

  if (sectionFillRate < 0.3)           diag.push(`🔴 BLOCKER: Citation section fill rate ${(sectionFillRate * 100).toFixed(1)}% — below 30% threshold`);
  else if (sectionFillRate < 0.6)      diag.push(`⚠️  WARN: Citation fill rate ${(sectionFillRate * 100).toFixed(1)}% — below target 60%`);
  else                                  diag.push(`✅ PASS: Citation fill rate ${(sectionFillRate * 100).toFixed(1)}%`);

  const oversizedPct = chunks.length ? oversized.length / chunks.length : 0;
  if (oversizedPct > 0.05)             diag.push(`⚠️  WARN: ${(oversizedPct * 100).toFixed(1)}% oversized chunks (target <5%)`);
  else                                  diag.push(`✅ PASS: Oversized chunks ${(oversizedPct * 100).toFixed(1)}%`);

  if (metaScore < 2)                   diag.push(`⚠️  WARN: Metadata completeness ${metaScore}/4 — low`);
  else                                  diag.push(`✅ PASS: Metadata completeness ${metaScore}/4`);

  if (encodingIssues > 0)              diag.push(`⚠️  WARN: ${encodingIssues} pages with encoding issues`);
  else                                  diag.push(`✅ PASS: No encoding issues`);

  if (dupCount > 0)                    diag.push(`⚠️  WARN: ${dupCount} duplicate chunks detected`);
  else                                  diag.push(`✅ PASS: No duplicate chunks`);

  return {
    filename,
    pdf_path:    pdfPath,
    pdf_size_mb: sizeMB,
    parsed_at:   new Date().toISOString(),

    parsing: {
      parse_ms:         parseMs,
      page_count:       doc.page_count,
      word_count:       doc.word_count,
      section_count:    doc.sections.length,
      empty_pages:      emptyPages,
      cyrillic_pct:     cyrillicPct(doc.text_full),
      encoding_issues:  encodingIssues,
      ocr_anomaly_pages: ocrAnomalies,
    },

    headings: {
      total:          headingDetections.length,
      by_level:       headingByLevel,
      by_type:        headingByType,
      avg_confidence: avgHeadingConf,
      sample:         headingDetections.slice(0, 20),
    },

    sections: {
      total:           doc.sections.length,
      depth_1:         depth1,
      depth_2:         depth2,
      depth_3plus:     depth3,
      orphan_count:    orphanSections,
      empty_count:     emptySections,
      avg_words:       avgSectionWords,
      sample_headings: doc.sections.slice(0, 20).map(s =>
        `[L${s.level}] ${s.heading.slice(0, 80)} (p.${s.page_start})`
      ),
    },

    metadata: {
      standard_code:  meta.standard_code,
      title:          (meta.title ?? '').slice(0, 200),
      organization:   meta.organization ?? null,
      discipline:     meta.discipline ?? null,
      year:           meta.year ?? null,
      version:        meta.version ?? null,
      keywords:       meta.keywords,
      completeness:   metaScore,
    },

    chunks: {
      total:           chunks.length,
      chunk_ms:        chunkMs,
      avg_tokens:      avgTokens,
      median_tokens:   median(tokenArr),
      min_tokens:      tokenArr.length ? Math.min(...tokenArr) : 0,
      max_tokens:      tokenArr.length ? Math.max(...tokenArr) : 0,
      oversized_count: oversized.length,
      oversized_pct:   parseFloat((oversizedPct * 100).toFixed(2)),
      tiny_count:      tiny.length,
      duplicate_count: dupCount,
      distribution:    tokenDist(tokenArr),
    },

    citations: {
      section_fill_rate: sectionFillRate,
      page_fill_rate:    pageFillRate,
      orphan_chunks:     orphanChunks.length,
      unique_sections:   uniqueSections,
      unique_pages:      uniquePages,
      avg_confidence:    avgCitConf,
      sample:            sampleCitations,
    },

    vs_week2,
    diagnostics_summary: diag,
  };
}

async function main() {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const ROOT  = resolve(__dir, '../../../..');  // d:\ai-institut

  const OUT_PATH = resolve(__dir, 'corpus-validation-results.json');

  console.log('═'.repeat(72));
  console.log('AGSK WEEK 4 — Full Corpus Validation (Production Parser)');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('═'.repeat(72));

  const docs: Array<{ path: string; name: string }> = [];

  // Known PDFs in corpus root
  const candidates = [
    { path: resolve(ROOT, 'AGSK-3(po_sost.na_13.03.26).pdf'), name: 'AGSK-3' },
    { path: resolve(ROOT, 'test_document.pdf'),               name: 'test_document' },
  ];

  for (const c of candidates) {
    if (existsSync(c.path)) {
      docs.push(c);
      console.log(`  ✓ Found: ${c.name} (${c.path})`);
    } else {
      console.log(`  ✗ Missing: ${c.name}`);
    }
  }

  if (docs.length === 0) {
    console.error('\nFATAL: No PDF documents found. Expected AGSK-3(po_sost.na_13.03.26).pdf in root.');
    process.exit(1);
  }

  const results: DocumentCorpusResult[] = [];
  const totalStart = performance.now();

  for (const doc of docs) {
    try {
      const result = await validateDocument(doc.path, doc.name);
      results.push(result);
    } catch (err: any) {
      console.error(`\n  ERROR processing ${doc.name}:`, err?.message ?? err);
    }
  }

  const totalMs = Math.round(performance.now() - totalStart);

  // ── Aggregate summary ──────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(72));
  console.log('CORPUS VALIDATION SUMMARY');
  console.log('═'.repeat(72));

  for (const r of results) {
    console.log(`\n  Document: ${r.filename} (${r.pdf_size_mb} MB)`);
    console.log(`  ─────────────────────────────────────────`);
    console.log(`  Parse:    ${r.parsing.parse_ms}ms  Pages: ${r.parsing.page_count}  Words: ${r.parsing.word_count}`);
    console.log(`  Sections: ${r.sections.total}  (L1:${r.sections.depth_1} L2:${r.sections.depth_2} L3+:${r.sections.depth_3plus})`);
    console.log(`  Headings: ${r.headings.total}  avg_conf: ${r.headings.avg_confidence}`);
    console.log(`  Chunks:   ${r.chunks.total}  avg: ${r.chunks.avg_tokens}t  median: ${r.chunks.median_tokens}t`);
    console.log(`  Citations: fill=${(r.citations.section_fill_rate * 100).toFixed(1)}%  orphan=${r.citations.orphan_chunks}`);
    console.log(`  Metadata: ${r.metadata.completeness}/4  (${r.metadata.organization ?? '-'}/${r.metadata.discipline ?? '-'})`);
    console.log(`  Week 2 → Week 4 improvements:`);
    console.log(`    Sections: ${r.vs_week2.section_detection_improvement}`);
    console.log(`    Citations: ${r.vs_week2.citation_fill_improvement}`);
    console.log(`    Oversized: ${r.vs_week2.oversized_chunk_improvement}`);
    console.log(`    Metadata: ${r.vs_week2.metadata_completeness_change}`);
    console.log(`  Diagnostics:`);
    for (const d of r.diagnostics_summary) {
      console.log(`    ${d}`);
    }
  }

  console.log(`\n  Total validation time: ${totalMs}ms`);

  // Save results
  const output = {
    generated_at:  new Date().toISOString(),
    total_docs:    results.length,
    total_ms:      totalMs,
    documents:     results,
  };
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\n  Results saved to: ${OUT_PATH}`);
  console.log('═'.repeat(72));
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
