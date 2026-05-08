/**
 * AGSK Retrieval — canonical types.
 * Citation schema is FIXED per locked architecture decision — DO NOT CHANGE.
 */

// ── Citation (LOCKED SCHEMA) ───────────────────────────────────────────────
export interface Citation {
  document:   string;   // "API 5L 2018"
  standard:   string;   // "API 5L"
  section:    string;   // "3.4.2"
  page:       number;
  version:    string;   // "2018"
  confidence: number;   // 0.0 – 1.0
}

// ── Retrieved chunk ────────────────────────────────────────────────────────
export interface RetrievedChunk {
  id:           string;
  standard_id:  string;
  content:      string;
  section_path: string[];
  section_title: string;
  page_start:   number;
  citation:     Citation;
  scores: {
    rrf?:    number;
    vector?: number;
    bm25?:   number;
  };
  vector_rank?: number;
  bm25_rank?:   number;
}

// ── Search request ─────────────────────────────────────────────────────────
export interface SearchRequest {
  query:        string;
  org_id:       string;
  user_id?:     string;
  limit?:       number;          // default 5, max 20
  discipline?:  string;
  standard_code?: string;
  retrieval_type?: 'hybrid' | 'vector' | 'bm25';
  min_similarity?: number;       // for vector-only mode
}

// ── Search response ────────────────────────────────────────────────────────
export interface SearchResponse {
  chunks:         RetrievedChunk[];
  citations:      Citation[];
  query:          string;
  retrieval_type: string;
  latency_ms:     number;
  result_count:   number;
  embedding_cache_hit: boolean;
}
