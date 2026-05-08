# AGSK Week 2 — Real Ingestion/Retrieval Validation Report

**Date:** 2026-05-08  
**PDF tested:** `AGSK-3(po_sost.na_13.03.26).pdf` (34 MB, 8 375 pages)  
**Validation scripts:**
- `services/agsk-ingestion/tests/week2/validate-pipeline.ts` — offline PDF + chunk analysis
- `services/agsk-ingestion/tests/week2/validate-retrieval.ts` — retrieval logic + eval dataset
- Raw results: `services/week2-validation-results.json`

---

## Executive Summary

| Area | Status | Key Finding |
|------|--------|-------------|
| PDF text extraction | ✅ PASS | Digital PDF, no OCR needed, 96.9% Cyrillic |
| Section detection | 🔴 FAIL | 0/8375 pages → sections detected (heading regex language mismatch) |
| Chunking (quantity) | ✅ PASS | 7 418 chunks, avg 582 tokens (97% of target) |
| Chunking (size limit) | ⚠️ WARN | 13.6% (1 010) chunks exceed 650-token limit |
| Citation section | 🔴 FAIL | 100% of chunks have empty `citation_section` |
| Metadata extraction | ⚠️ WARN | 1/4 fields (year only); no GOST/Kazakh patterns |
| Duplicate chunks | ✅ PASS | 0 duplicates |
| OCR / encoding | ✅ PASS | No issues, clean digital PDF |
| Retrieval logic | ✅ PASS | RRF, dedup, routing all correct |
| Unit tests | ⚠️ WARN | 20/22 passing (2 chunker bugs found) |

**Production blockers: 2 (P0)**  
**Warnings: 5**  
**Passing: 6**

---

## 1. Real PDF Ingestion Results

### Document Profile

| Metric | Value |
|--------|-------|
| File | AGSK-3(po_sost.na_13.03.26).pdf |
| Size | 34 MB |
| Pages | 8 375 |
| Words | 2 227 453 |
| Language | Russian + Kazakh (96.9% Cyrillic) |
| PDF origin | FastReport (digital, not scanned) |
| PDF title | Сәулет, қала құрылысы және құрылыс каталогы / Архитектурный, градостроительный и строительный каталог |
| Document type | Construction materials catalog |
| Section structure | Отдел → Раздел → Подраздел (Cyrillic hierarchy) |

### Parse Performance

| Metric | Value |
|--------|-------|
| PDF parse time | 25 643 ms (~3 pages/ms) |
| Chunk time | 364 ms for 7 418 chunks |
| Total pipeline | 26 774 ms |
| OCR issues | None |
| Encoding issues | None |

---

## 2. Section Integrity — CRITICAL FAILURE 🔴

**Result: 1 section detected out of expected ~500+**

### Root Cause 1 — pdf-parse newline loss

`pdf-parser.ts` uses:
```typescript
const text = content.items.map((item: any) => item.str).join(' ');
```

This joins all text items on a page with spaces. When `extractSections` later does `p.text.split('\n')`, each page becomes ONE line. The heading regex tests `^(pattern)` against the start of that line — but the first character is always the first word on the page (TOC entry, not a heading).

**Fix required:** Detect Y-position jumps between PDF text items and insert `\n` when the vertical position changes significantly. Example:
```typescript
content.items.reduce((acc, item, i, arr) => {
  const prevY = i > 0 ? arr[i-1].transform[5] : item.transform[5];
  const sep = Math.abs(item.transform[5] - prevY) > 5 ? '\n' : '';
  return acc + sep + item.str;
}, '');
```

### Root Cause 2 — English-only heading regex

```typescript
const HEADING_REGEX = /^(?:(?:\d+(?:\.\d+){0,3}\.?\s+[A-Z])|
  (?:(?:SECTION|APPENDIX|CHAPTER|ANNEX)\s+[\dA-Z]+))/;
```

The AGSK-3 uses Cyrillic section markers:
- `Отдел 22.` — Division
- `Раздел 221.` — Section  
- `Подраздел 221-1.` — Subsection
- `Приложение А.` — Appendix

None of these are matched. Also the numeric headings require the next char to be `[A-Z]` — Cyrillic headings start with `[А-Я]`.

**Fix required:**
```typescript
const HEADING_REGEX = /^(?:
  (?:\d+(?:\.\d+){0,3}\.?\s+[A-ZА-ЯЁ])  |   // numbered + capital
  (?:(?:SECTION|APPENDIX|CHAPTER|ANNEX|
        РАЗДЕЛ|ПОДРАЗДЕЛ|ОТДЕЛ|ЧАСТЬ|ГЛАВА|
        ПРИЛОЖЕНИЕ|Раздел|Подраздел|Отдел
    )\s+[\dA-ZА-ЯЁ-]+)
)/x;
```

### Impact

- All 7 418 chunks: `section_path = []`
- All 7 418 chunks: `citation_section = ""`
- Section-level filtering via `p_standard_code` and discipline will work, but section-level accuracy = 0%
- Acceptance criterion `Citation Accuracy ≥ 0.90` cannot be met

---

## 3. Citation Integrity

| Field | Status | Value |
|-------|--------|-------|
| `citation_document` | ✅ | "AGSK-3(PO SOST.NA 13.03.26) 2026" |
| `citation_standard` | ✅ | "AGSK-3(PO SOST.NA 13.03.26)" |
| `citation_section` | 🔴 | "" (empty on all 7 418 chunks) |
| `citation_page` | ⚠️ | 1 (all chunks stuck at page 1 — no section page tracking) |
| `citation_version` | ✅ | "2026" |
| `citation_confidence` | ✅ | 1.0 |

**Sample citations (as produced today):**
```
chunk[0]: "AGSK-3(...) 2026" | section="" | p.1 | v=2026 | conf=1.0
chunk[1]: "AGSK-3(...) 2026" | section="" | p.1 | v=2026 | conf=1.0
```

**Expected citations (after fix):**
```
chunk[N]: "AGSK-3 2026" | section="221-1" | p.152 | v=2026 | conf=1.0
```

---

## 4. Chunk Quality Analysis

### Distribution

| Range | Count | % |
|-------|-------|----|
| 0–100 tokens | 0 | 0% |
| 101–300 tokens | 44 | 0.6% |
| 301–500 tokens | 1 355 | 18.3% |
| 501–600 tokens | 4 843 | 65.3% |
| 601+ tokens | 1 176 | 15.9% |

**Good:** 65% of chunks are in the target 501–600 range.  
**Bad:** 15.9% exceed 600 tokens. Max = 1 511 tokens (2.5× limit).

### Root Cause of Oversized Chunks

AGSK-3 catalog entries look like:
```
221-1-1 Сваи железобетонные забивные цельные квадратного сечения...
по ГОСТ 19804.1-79, ГОСТ 19804.2-79, ГОСТ 19804.6-83 ... СТ РК EN 12699
```

This is a single line with no `.!?` sentence-ending punctuation. `splitIntoSentences` returns it as one sentence. If it exceeds 600 tokens, the chunker has no way to split it (it only flushes when `acc.sentences.length > 0`).

### Duplicate Detection
- **0 duplicates** — content SHA-256 hashes are all unique. ✅

### Tiny Chunks
- **0 tiny chunks** (< 20 tokens). ✅

### Table Detection
- **0 table-like chunks** detected — catalog tables appear as sequential text lines, not pipe-separated. Detection heuristic needs updating for Cyrillic catalog format.

---

## 5. Metadata Quality

| Field | Status | Result |
|-------|--------|--------|
| `standard_code` | ⚠️ | "AGSK-3(PO SOST.NA 13.03.26)" — derived from filename, uppercase |
| `title` | ✅ | Correctly extracted from first text line |
| `organization` | 🔴 | null — no GOST/CIS/КМК pattern in extractor |
| `discipline` | 🔴 | null — "construction" discipline not mapped |
| `year` | ✅ | 2026 (detected from "13.03.26") |
| `version` | 🔴 | null — ГОСТ version format not supported |
| `keywords` | 🔴 | [] — keyword regex `[A-Z][A-Za-z-]{3+}` only matches Latin |

**Completeness: 1/4 (25%)**  
**Required for production: ≥3/4**

### What metadata-extractor needs for CIS standards

```typescript
// Add to STANDARD_PATTERNS:
[/ГОСТ\s*[\d.]+/i,                   'GOST', 'general'],
[/СТ\s*РК\s*[\d.]+/i,               'KZ',   'general'],    // Kazakhstan
[/СП\s*\d+/i,                        'RUS',  'construction'],
[/СНиП\s*[\d.-]+/i,                  'RUS',  'construction'],
[/ТР\s*ЕАЭС\s*[\d/]+/i,             'EAEU', 'general'],

// Add discipline mapping:
[/(?:строи|конструк|бетон|армат)/i,  'RUS', 'structural'],
[/(?:трубо|трубопровод)/i,           'RUS', 'pipeline'],

// Keyword pattern (Cyrillic):
const CYR_TERM_REGEX = /\b[А-ЯЁ][А-Яа-яЁё-]{3,}\b/g;
```

---

## 6. OCR + Scanned PDF Validation

| Check | Result |
|-------|--------|
| Document type | Digital PDF (FastReport) — OCR not needed |
| Cyrillic ratio | 96.9% — encoding correct |
| Unicode replacement chars (U+FFFD) | 0 — no corruption |
| Repeated garbled chars | 0 |
| Long words without spaces | 0 |
| Merged sentences (period-capital) | 0 |

**Conclusion:** The AGSK-3 PDF does not require OCR. Text extraction via pdf-parse is clean. For scanned/rotated PDFs, the MinerU fallback path exists but has not been tested (no scanned sample available).

---

## 7. Retrieval Log Analysis

### Offline Logic Validation

| Test | Result |
|------|--------|
| Citation deduplication (5→4 unique) | ✅ PASS |
| RRF score: vector-only rank1 = 0.011475 | ✅ PASS |
| RRF score: bm25-only rank1 = 0.004918 | ✅ PASS |
| Vector weight 0.7 > BM25 weight 0.3 confirmed | ✅ PASS |
| Retrieval mode routing (hybrid/vector/bm25) | ✅ PASS |
| Evaluation dataset loaded (80 queries) | ✅ PASS |

### Live Retrieval Metrics — NOT YET AVAILABLE

**Reason:** No documents have been indexed in production Supabase. To run Recall@5 / Precision@5 measurements, we need:
1. At least one real engineering standard indexed (API 5L, ASME B31.4, or similar)
2. `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` + `OPENAI_API_KEY` env vars

**Expected flow after first indexing:**
```
POST /api/agsk/upload (admin) → queue job → ingest → index in pgvector
POST /api/agsk/search { query: "...", retrieval_type: "hybrid" }
→ measure: latency, Recall@5, Precision@5, citation accuracy
```

### Evaluation Dataset Profile

| Metric | Value |
|--------|-------|
| Total queries | 80 |
| Simple | 19 (24%) |
| Medium | 45 (56%) |
| Complex | 16 (20%) |
| Avg query length | 10.8 words |
| Standards referenced | API 5L, ASME B31.8/B31.4, NACE MR0175, AWS D1.1, ACI 318, etc. |
| Edge case: version conflicts | 3 queries (Q010, Q018, Q019) |
| Edge case: acronym collisions | 1 query (Q079) |
| Queries mentioning "API" | 20 (25%) |

**Note:** The evaluation dataset targets individual engineering standards (API 5L, ASME, NACE etc.), not the AGSK-3 catalog. For proper Recall@5 benchmarking, individual standard PDFs are needed.

---

## 8. Unit Test Results

```
Test Suites: 1 failed, 1 passed, 2 total
Tests:       2 failed, 20 passed, 22 total
```

### Failing Tests

**Test 1: `chunk token count does not exceed CHUNK_SIZE_TOKENS`**
```
Expected: content_tokens ≤ 660 (CHUNK_SIZE_TOKENS * 1.1)
Received: chunk with 4267 tokens
```
Root cause: `words(3200)` generates text without sentence-ending punctuation. `splitIntoSentences` returns one sentence of 3200 words (≈4267 tokens). The chunker's flush condition requires `acc.sentences.length > 0`, so a single oversized sentence is never split.

**Test 2: `handles empty sections gracefully`**
```
Expected: chunks.length = 0
Received: chunks.length = 1
```
Root cause: `makeDoc([{ heading: '1. Empty', content: '' }])` sets `text_full = "1. Empty\n"`. When all sections are empty (no chunks produced), the fallback path activates on `doc.text_full` which is non-empty, producing 1 chunk.

### Passing Tests (20/22)
All smoke tests pass, all other chunker tests pass. Section boundary, citation schema, overlap, sequential index — all correct.

---

## 9. False Positive Cases

Without live retrieval, we cannot measure false positives empirically. However, from code analysis:

| Risk | Severity | Description |
|------|----------|-------------|
| AGSK-3 as generic match | HIGH | 7418 chunks from a catalog will match many engineering queries due to broad vocabulary, causing false positives |
| All chunks lack section | HIGH | BM25 ranking without section context will score by word frequency, not relevance |
| Cyrillic/Latin mixing | MEDIUM | Queries in English may not match Cyrillic catalog entries even for same concept |
| Page 1 for all chunks | MEDIUM | Retrieval logs will show misleading `citation_page=1` for all results |

---

## 10. Recommended Fixes (Priority Order)

### P0 — Production Blockers (fix before first real indexing)

**P0.1 — Fix pdf-parse newline preservation** ([services/agsk-ingestion/src/parsers/pdf-parser.ts:116](services/agsk-ingestion/src/parsers/pdf-parser.ts#L116))
```typescript
// Replace join(' ') with Y-position-aware separator
const text = content.items.reduce((acc: string, item: any, i: number, arr: any[]) => {
  if (i === 0) return item.str;
  const prevY = arr[i-1].transform[5];
  const curY  = item.transform[5];
  return acc + (Math.abs(curY - prevY) > 5 ? '\n' : ' ') + item.str;
}, '');
```

**P0.2 — Add Cyrillic heading patterns** ([services/agsk-ingestion/src/parsers/pdf-parser.ts:42](services/agsk-ingestion/src/parsers/pdf-parser.ts#L42))
```typescript
const HEADING_REGEX = /^(?:
  (?:\d+(?:\.\d+){0,3}\.?\s+[A-ZА-ЯЁ])  |
  (?:(?:SECTION|APPENDIX|CHAPTER|ANNEX|Раздел|Подраздел|Отдел|Часть|Глава|Приложение)\s+[\dА-Яа-яA-Z-]+)
)/;
```

### High — Fix Before Week 3

**H1 — Fix oversized sentence handling in chunker** ([services/agsk-ingestion/src/processors/chunker.ts:124](services/agsk-ingestion/src/processors/chunker.ts#L124))
Add word-level splitting when a single sentence exceeds the token limit.

**H2 — Fix empty section fallback bug** ([services/agsk-ingestion/src/processors/chunker.ts:154](services/agsk-ingestion/src/processors/chunker.ts#L154))
Change fallback condition from `chunks.length === 0 && doc.text_full` to `doc.sections.length === 0 && doc.text_full`.

### Medium — Fix Before Production

**M1 — Add CIS/GOST standard patterns to metadata-extractor**  
Add: ГОСТ, СТ РК, СП, СНиП, ТР ЕАЭС, КМК (Казахстан)

**M2 — Add Cyrillic keyword extraction**  
Replace `[A-Z][A-Za-z-]{3+}` with Unicode-aware pattern for both Latin and Cyrillic technical terms.

**M3 — Update table detection for catalog format**  
Current heuristic (pipes, tabs) misses text-based table format from FastReport.

---

## 11. Production Readiness Assessment

| Criterion | Target | Current | Status |
|-----------|--------|---------|--------|
| Section detection | ≥80% sections found | 0% | 🔴 BLOCKER |
| Citation accuracy | ≥90% have section | 0% | 🔴 BLOCKER |
| Recall@5 | ≥0.85 | Not measurable | ⏳ PENDING |
| Precision@5 | ≥0.80 | Not measurable | ⏳ PENDING |
| Chunk size compliance | ≤5% over limit | 13.6% over limit | ⚠️ WARN |
| Duplicate chunks | 0% | 0% | ✅ |
| Text extraction | No corruption | Clean | ✅ |
| Metadata completeness | ≥3/4 fields | 1/4 | ⚠️ WARN |
| Unit tests | 100% pass | 91% pass (20/22) | ⚠️ WARN |
| Latency (parse) | p95 ≤ 60s | 25.6s | ✅ |

**Verdict: NOT PRODUCTION READY — 2 P0 blockers must be fixed.**

---

## Appendix — Files Created

| File | Purpose |
|------|---------|
| `services/agsk-ingestion/tests/week2/validate-pipeline.ts` | Offline PDF pipeline validator |
| `services/agsk-ingestion/tests/week2/validate-retrieval.ts` | Retrieval logic + eval dataset validator |
| `services/week2-validation-results.json` | Raw JSON results from AGSK-3 run |
| `AGSK_WEEK2_VALIDATION_REPORT.md` | This report |
