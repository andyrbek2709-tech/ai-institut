/**
 * Week 4 — Retrieval Benchmark
 *
 * Runs all 80 evaluation queries against an in-memory BM25 index
 * built from the corpus validation chunks.
 *
 * Metrics:
 *   - Recall@5 (keyword-based relevance proxy)
 *   - Precision@5
 *   - Citation accuracy (section fill, page fill, confidence)
 *   - Retrieval latency (p50 / p95)
 *   - False positive analysis (API ambiguity, acronym collisions, version confusion)
 *   - Score distribution
 *   - Domain coverage analysis
 *
 * Offline: no Supabase, no OpenAI.
 * Run: npx tsx tests/week4/retrieval-benchmark.ts
 */

// ── Stub env vars ────────────────────────────────────────────────────────────
process.env.SUPABASE_URL         = 'http://stub';
process.env.SUPABASE_SERVICE_KEY = 'stub';
process.env.OPENAI_API_KEY       = 'stub';
process.env.REDIS_URL            = 'redis://stub';
process.env.NODE_ENV             = 'test';
process.env.LOG_LEVEL            = 'silent';

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

// ── Production imports ────────────────────────────────────────────────────────
import { parsePDF } from '../../src/parsers/pdf-parser.js';
import { chunkDocument } from '../../src/processors/chunker.js';
import { extractMetadata } from '../../src/processors/metadata-extractor.js';
import type { Chunk } from '../../src/processors/chunker.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EvalQuery {
  query_id:           string;
  query_text:         string;
  difficulty:         'simple' | 'medium' | 'complex';
  discipline:         string;
  topics:             string[];
  expected_standards: Array<{
    standard:        string;
    version:         string;
    sections:        string[];
    relevance_score: number;
    reason:          string;
  }>;
  expected_keywords:   string[];
  ground_truth_answer: string;
  confidence:          number;
  notes?:              string;
}

interface QueryResult {
  query_id:        string;
  query_text:      string;
  difficulty:      string;
  discipline:      string;
  expected_standards: string[];
  top5_chunks:     Array<{
    chunk_idx:   number;
    score:       number;
    section:     string;
    page:        number;
    tokens:      number;
    preview:     string;
    has_section: boolean;
    keyword_hits: number;
  }>;
  recall_hit:      boolean;  // ≥1 expected keyword in top-5
  precision_hits:  number;   // # top-5 with ≥1 keyword hit
  citation_complete: boolean;
  latency_ms:      number;
  false_positive_risk: string | null;
}

interface BenchmarkSummary {
  total_queries:      number;
  by_difficulty:      Record<string, { total: number; recall_hits: number; recall_pct: number }>;
  by_discipline:      Record<string, { total: number; recall_hits: number; recall_pct: number }>;
  recall_at5:         number;   // fraction 0-1
  precision_at5:      number;   // avg precision across queries
  citation_accuracy:  number;   // fraction with complete citations
  false_positive_cases: number;
  domain_mismatch_queries: number;  // queries targeting standards not in corpus

  latency: {
    p50_ms:   number;
    p95_ms:   number;
    min_ms:   number;
    max_ms:   number;
    avg_ms:   number;
  };

  score_distribution: {
    min:    number;
    max:    number;
    p25:    number;
    median: number;
    p75:    number;
  };

  false_positive_report: Array<{
    type:     string;
    query_id: string;
    query_text: string;
    risk_desc:  string;
  }>;

  domain_coverage: {
    standards_in_corpus:   string[];
    standards_in_eval:     string[];
    coverage_pct:          number;
    missing_standards:     string[];
  };

  retrieval_quality: {
    avg_top5_keyword_hits: number;
    avg_chunk_tokens:      number;
    orphan_chunk_rate:     number;
    section_coverage:      number;
  };
}

export interface BenchmarkResults {
  generated_at:    string;
  corpus_source:   string;
  eval_dataset:    string;
  total_chunks:    number;
  total_queries:   number;
  query_results:   QueryResult[];
  summary:         BenchmarkSummary;
}

// ── BM25-style In-Memory Index ────────────────────────────────────────────────

interface IndexedChunk {
  chunk:    Chunk;
  terms:    Map<string, number>;   // term → frequency
  total_terms: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zа-яёa-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2);
}

function buildIndex(chunks: Chunk[]): IndexedChunk[] {
  return chunks.map(c => {
    const tokens = tokenize(c.content + ' ' + c.section_title);
    const terms  = new Map<string, number>();
    for (const t of tokens) {
      terms.set(t, (terms.get(t) ?? 0) + 1);
    }
    return { chunk: c, terms, total_terms: tokens.length };
  });
}

function bm25Score(
  indexed:    IndexedChunk[],
  queryTerms: string[],
  k1 = 1.5,
  b  = 0.75,
): Array<{ chunk: Chunk; score: number; keyword_hits: number }> {
  const N = indexed.length;
  if (N === 0) return [];

  // Document frequency per term
  const df = new Map<string, number>();
  for (const term of queryTerms) {
    let count = 0;
    for (const doc of indexed) {
      if (doc.terms.has(term)) count++;
    }
    df.set(term, count);
  }

  const avgDL = indexed.reduce((s, d) => s + d.total_terms, 0) / N;

  const scored = indexed.map(doc => {
    let score = 0;
    let kw_hits = 0;
    const dl = doc.total_terms;

    for (const term of queryTerms) {
      const tf  = doc.terms.get(term) ?? 0;
      if (tf === 0) continue;
      kw_hits++;

      const docFreq = df.get(term) ?? 0;
      const idf = Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1);
      const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / avgDL)));
      score += idf * tfNorm;
    }

    return { chunk: doc.chunk, score, keyword_hits: kw_hits };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p / 100);
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}

// ── False positive risk detector ──────────────────────────────────────────────

function detectFalsePositiveRisk(query: EvalQuery): string | null {
  const q = query.query_text.toLowerCase();

  // API ambiguity: "API" used as American Petroleum Institute, could match software API
  if (/\bapi\b/.test(q) && /\b(endpoint|request|response|http|rest|function|call|method)\b/.test(q)) {
    return 'api_software_ambiguity';
  }
  // API + other acronyms that could collide
  if (/\bapi\b/.test(q) && /\b(asme|iso|astm|gost|iec)\b/.test(q)) {
    return 'api_acronym_collision';
  }
  // Year confusion: query contains a specific year that could match wrong version
  if (/\b(2015|2016|2017|2018|2019|2020|2021|2022|2023)\b/.test(q) &&
      query.expected_standards.length > 1) {
    return 'version_year_confusion';
  }
  // Cyrillic/Latin overlap: query uses technical terms present in both CIS and Western standards
  if (/\b(steel|pipe|welding|pressure|strength)\b/.test(q) && query.discipline === 'pipeline') {
    return 'cyrillic_latin_term_overlap';
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const ROOT  = resolve(__dir, '../../../..');

  const CORPUS_RESULTS = resolve(__dir, 'corpus-validation-results.json');
  const EVAL_PATH      = resolve(ROOT, 'evaluation_dataset.json');
  const OUT_PATH       = resolve(__dir, 'retrieval-benchmark-results.json');

  console.log('═'.repeat(72));
  console.log('AGSK WEEK 4 — Retrieval Benchmark (In-Memory BM25)');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('═'.repeat(72));

  // ── Load / build chunk index ───────────────────────────────────────────────
  let allChunks: Chunk[] = [];

  if (existsSync(CORPUS_RESULTS)) {
    console.log('\n[1/4] Loading corpus from saved validation results...');
    // Corpus validation only saves metrics, not chunks — re-parse
    console.log('  Note: Re-parsing AGSK-3 to build chunk index...');
  }

  const pdfPath = resolve(ROOT, 'AGSK-3(po_sost.na_13.03.26).pdf');
  if (!existsSync(pdfPath)) {
    console.error('FATAL: AGSK-3 PDF not found at', pdfPath);
    process.exit(1);
  }

  console.log('\n[1/4] Building chunk index from AGSK-3...');
  const parseStart = performance.now();
  const buf = readFileSync(pdfPath);
  const doc = await parsePDF(Buffer.from(buf));
  const meta = extractMetadata(doc.text_full, 'AGSK-3', doc.metadata);
  allChunks = chunkDocument(doc, meta.standard_code || 'AGSK-3', String(meta.year || ''));
  const parseMs = Math.round(performance.now() - parseStart);

  console.log(`  ✓ ${allChunks.length} chunks indexed from ${doc.page_count} pages — ${parseMs}ms`);
  console.log(`  ✓ Sections in corpus: ${doc.sections.length}`);
  console.log(`  ✓ Chunk section coverage: ${((allChunks.filter(c => c.citation_section).length / allChunks.length) * 100).toFixed(1)}%`);

  // ── Load evaluation dataset ───────────────────────────────────────────────
  console.log('\n[2/4] Loading evaluation dataset...');
  if (!existsSync(EVAL_PATH)) {
    console.error('FATAL: evaluation_dataset.json not found at', EVAL_PATH);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(EVAL_PATH, 'utf-8'));
  const queries: EvalQuery[] = Array.isArray(raw) ? raw : (raw.queries ?? []);
  console.log(`  ✓ ${queries.length} queries loaded`);

  const byDifficulty = queries.reduce<Record<string, number>>((acc, q) => {
    acc[q.difficulty] = (acc[q.difficulty] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`  ✓ Distribution: simple=${byDifficulty.simple ?? 0} medium=${byDifficulty.medium ?? 0} complex=${byDifficulty.complex ?? 0}`);

  // ── Build BM25 index ───────────────────────────────────────────────────────
  console.log('\n[3/4] Building BM25 index...');
  const indexStart = performance.now();
  const indexed = buildIndex(allChunks);
  const indexMs = Math.round(performance.now() - indexStart);
  console.log(`  ✓ Indexed ${indexed.length} documents — ${indexMs}ms`);

  // ── Run benchmark ──────────────────────────────────────────────────────────
  console.log('\n[4/4] Running 80-query benchmark...');
  const queryResults: QueryResult[] = [];
  const latencies: number[] = [];
  const allScores: number[] = [];

  // Collect all standard codes in corpus
  const corpusStandards = new Set(allChunks.map(c => c.citation_standard).filter(Boolean));

  // Collect all standard codes referenced in eval dataset
  const evalStandards = new Set<string>();
  for (const q of queries) {
    for (const es of q.expected_standards) {
      evalStandards.add(es.standard.split(' ')[0]);  // take prefix: "API 5L" → "API"
    }
  }

  let processed = 0;
  for (const query of queries) {
    const qStart = performance.now();

    // Tokenize query
    const queryTerms = tokenize(query.query_text);

    // Also add topic keywords
    for (const topic of query.topics ?? []) {
      tokenize(topic).forEach(t => queryTerms.push(t));
    }

    // BM25 search
    const ranked = bm25Score(indexed, [...new Set(queryTerms)]);
    const top5   = ranked.slice(0, 5);

    const latMs  = parseFloat((performance.now() - qStart).toFixed(2));
    latencies.push(latMs);

    // Score distribution
    for (const r of top5) allScores.push(r.score);

    // Recall: does any top-5 chunk contain ≥1 expected keyword?
    const expectedKws = query.expected_keywords.map(k => k.toLowerCase());
    let recallHit = false;
    let precisionHits = 0;

    const top5Mapped = top5.map(r => {
      const content = r.chunk.content.toLowerCase();
      const kwHits = expectedKws.filter(kw => content.includes(kw)).length;
      if (kwHits > 0) {
        recallHit = true;
        precisionHits++;
      }
      return {
        chunk_idx:    r.chunk.chunk_index,
        score:        parseFloat(r.score.toFixed(4)),
        section:      r.chunk.citation_section || '',
        page:         r.chunk.citation_page,
        tokens:       r.chunk.content_tokens,
        preview:      r.chunk.content.slice(0, 120),
        has_section:  !!r.chunk.citation_section,
        keyword_hits: kwHits,
      };
    });

    // Citation completeness: all top-5 have section + page?
    const citComplete = top5Mapped.length > 0 &&
      top5Mapped.every(c => c.has_section && c.page > 0);

    // False positive risk
    const fpRisk = detectFalsePositiveRisk(query);

    queryResults.push({
      query_id:        query.query_id,
      query_text:      query.query_text,
      difficulty:      query.difficulty,
      discipline:      query.discipline,
      expected_standards: query.expected_standards.map(s => s.standard),
      top5_chunks:     top5Mapped,
      recall_hit:      recallHit,
      precision_hits:  precisionHits,
      citation_complete: citComplete,
      latency_ms:      latMs,
      false_positive_risk: fpRisk,
    });

    processed++;
    if (processed % 20 === 0) {
      console.log(`  ... processed ${processed}/${queries.length}`);
    }
  }

  // ── Aggregate metrics ──────────────────────────────────────────────────────
  const recallAt5 = parseFloat(
    (queryResults.filter(r => r.recall_hit).length / queryResults.length).toFixed(4)
  );
  const avgPrecision = parseFloat(
    (queryResults.reduce((s, r) => s + r.precision_hits / 5, 0) / queryResults.length).toFixed(4)
  );
  const citAccuracy = parseFloat(
    (queryResults.filter(r => r.citation_complete).length / queryResults.length).toFixed(4)
  );
  const fpCases = queryResults.filter(r => r.false_positive_risk !== null).length;

  // Domain mismatch: queries targeting standards not in corpus
  const domainMismatch = queryResults.filter(r =>
    r.expected_standards.every(s => !corpusStandards.has(s.split(' ')[0]))
  ).length;

  // By difficulty
  const byDiffResult: Record<string, { total: number; recall_hits: number; recall_pct: number }> = {};
  for (const r of queryResults) {
    if (!byDiffResult[r.difficulty]) {
      byDiffResult[r.difficulty] = { total: 0, recall_hits: 0, recall_pct: 0 };
    }
    byDiffResult[r.difficulty].total++;
    if (r.recall_hit) byDiffResult[r.difficulty].recall_hits++;
  }
  for (const d of Object.values(byDiffResult)) {
    d.recall_pct = parseFloat(((d.recall_hits / d.total) * 100).toFixed(1));
  }

  // By discipline
  const byDiscResult: Record<string, { total: number; recall_hits: number; recall_pct: number }> = {};
  for (const r of queryResults) {
    if (!byDiscResult[r.discipline]) {
      byDiscResult[r.discipline] = { total: 0, recall_hits: 0, recall_pct: 0 };
    }
    byDiscResult[r.discipline].total++;
    if (r.recall_hit) byDiscResult[r.discipline].recall_hits++;
  }
  for (const d of Object.values(byDiscResult)) {
    d.recall_pct = parseFloat(((d.recall_hits / d.total) * 100).toFixed(1));
  }

  // Latency stats
  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);

  // Score distribution
  const scoreStats = allScores.length > 0 ? {
    min:    parseFloat(Math.min(...allScores).toFixed(4)),
    max:    parseFloat(Math.max(...allScores).toFixed(4)),
    p25:    parseFloat(percentile(allScores, 25).toFixed(4)),
    median: parseFloat(percentile(allScores, 50).toFixed(4)),
    p75:    parseFloat(percentile(allScores, 75).toFixed(4)),
  } : { min: 0, max: 0, p25: 0, median: 0, p75: 0 };

  // False positive report
  const fpReport = queryResults
    .filter(r => r.false_positive_risk)
    .slice(0, 20)
    .map(r => ({
      type:       r.false_positive_risk!,
      query_id:   r.query_id,
      query_text: r.query_text.slice(0, 100),
      risk_desc:  fpRiskDesc(r.false_positive_risk!),
    }));

  // Domain coverage
  const evalStdList = [...evalStandards].sort();
  const corpusStdList = [...corpusStandards].sort();
  const coveredStds = evalStdList.filter(s => corpusStandards.has(s));
  const missingStds = evalStdList.filter(s => !corpusStandards.has(s));

  // Retrieval quality
  const avgKwHits = queryResults.reduce((s, r) =>
    s + r.top5_chunks.reduce((a, c) => a + c.keyword_hits, 0) / Math.max(r.top5_chunks.length, 1), 0
  ) / queryResults.length;
  const avgChunkTokens = queryResults
    .flatMap(r => r.top5_chunks.map(c => c.tokens))
    .reduce((a, b, _, arr) => a + b / arr.length, 0);
  const orphanRate = queryResults
    .flatMap(r => r.top5_chunks)
    .filter(c => !c.has_section).length /
    Math.max(queryResults.flatMap(r => r.top5_chunks).length, 1);
  const sectionCoverage = queryResults
    .flatMap(r => r.top5_chunks)
    .filter(c => c.has_section).length /
    Math.max(queryResults.flatMap(r => r.top5_chunks).length, 1);

  const summary: BenchmarkSummary = {
    total_queries:     queryResults.length,
    by_difficulty:     byDiffResult,
    by_discipline:     byDiscResult,
    recall_at5:        recallAt5,
    precision_at5:     avgPrecision,
    citation_accuracy: citAccuracy,
    false_positive_cases: fpCases,
    domain_mismatch_queries: domainMismatch,
    latency: {
      p50_ms: p50,
      p95_ms: p95,
      min_ms: parseFloat(Math.min(...latencies).toFixed(2)),
      max_ms: parseFloat(Math.max(...latencies).toFixed(2)),
      avg_ms: parseFloat((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)),
    },
    score_distribution:  scoreStats,
    false_positive_report: fpReport,
    domain_coverage: {
      standards_in_corpus:  corpusStdList,
      standards_in_eval:    evalStdList,
      coverage_pct:         parseFloat(((coveredStds.length / Math.max(evalStdList.length, 1)) * 100).toFixed(1)),
      missing_standards:    missingStds,
    },
    retrieval_quality: {
      avg_top5_keyword_hits: parseFloat(avgKwHits.toFixed(3)),
      avg_chunk_tokens:      parseFloat(avgChunkTokens.toFixed(1)),
      orphan_chunk_rate:     parseFloat(orphanRate.toFixed(3)),
      section_coverage:      parseFloat(sectionCoverage.toFixed(3)),
    },
  };

  // ── Print summary ──────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(72));
  console.log('RETRIEVAL BENCHMARK RESULTS');
  console.log('═'.repeat(72));
  console.log(`\n  Total queries:       ${summary.total_queries}`);
  console.log(`  Recall@5:            ${(summary.recall_at5 * 100).toFixed(1)}%`);
  console.log(`  Precision@5:         ${(summary.precision_at5 * 100).toFixed(1)}%`);
  console.log(`  Citation accuracy:   ${(summary.citation_accuracy * 100).toFixed(1)}%`);
  console.log(`  False positive risk: ${summary.false_positive_cases} queries`);
  console.log(`  Domain mismatch:     ${summary.domain_mismatch_queries}/${summary.total_queries} queries`);
  console.log('\n  Latency (BM25 in-memory):');
  console.log(`    p50: ${summary.latency.p50_ms}ms  p95: ${summary.latency.p95_ms}ms  avg: ${summary.latency.avg_ms}ms`);
  console.log('\n  Retrieval quality:');
  console.log(`    Avg keyword hits/query: ${summary.retrieval_quality.avg_top5_keyword_hits}`);
  console.log(`    Orphan chunk rate:      ${(summary.retrieval_quality.orphan_chunk_rate * 100).toFixed(1)}%`);
  console.log(`    Section coverage:       ${(summary.retrieval_quality.section_coverage * 100).toFixed(1)}%`);
  console.log('\n  By difficulty:');
  for (const [diff, stats] of Object.entries(summary.by_difficulty)) {
    console.log(`    ${diff}: ${stats.recall_hits}/${stats.total} recall hits (${stats.recall_pct}%)`);
  }
  console.log('\n  Domain coverage:');
  console.log(`    Standards in eval:   ${summary.domain_coverage.standards_in_eval.length}`);
  console.log(`    Standards in corpus: ${summary.domain_coverage.standards_in_corpus.length}`);
  console.log(`    Coverage:            ${summary.domain_coverage.coverage_pct}%`);
  console.log(`    Missing standards:   ${summary.domain_coverage.missing_standards.join(', ')}`);
  console.log('\n  False positive report:');
  const fpByType = fpReport.reduce<Record<string, number>>((acc, fp) => {
    acc[fp.type] = (acc[fp.type] ?? 0) + 1;
    return acc;
  }, {});
  for (const [type, count] of Object.entries(fpByType)) {
    console.log(`    ${type}: ${count} cases`);
  }
  console.log('═'.repeat(72));

  const output: BenchmarkResults = {
    generated_at:  new Date().toISOString(),
    corpus_source: 'AGSK-3(po_sost.na_13.03.26).pdf',
    eval_dataset:  'evaluation_dataset.json (80 queries)',
    total_chunks:  allChunks.length,
    total_queries: queries.length,
    query_results: queryResults,
    summary,
  };

  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\n  Results saved to: ${OUT_PATH}`);
}

function fpRiskDesc(type: string): string {
  const map: Record<string, string> = {
    api_software_ambiguity:    'Query uses "API" near software terms — may retrieve software documentation instead of API 5L/API 650',
    api_acronym_collision:     'Query mixes API (petroleum) with other standards acronyms — ranking ambiguity',
    version_year_confusion:    'Query contains specific year that could match wrong standard version in multi-standard corpus',
    cyrillic_latin_term_overlap: 'Technical terms shared between CIS/GOST and Western standards — may retrieve wrong jurisdiction',
  };
  return map[type] ?? type;
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
