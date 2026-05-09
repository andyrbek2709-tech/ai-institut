import React, { useState, useCallback, useRef, useEffect } from 'react';
import { apiPost, apiGet } from '../api/http';
import { getSupabaseAnonClient } from '../api/supabaseClient';
import ResultCard from './ResultCard';
import FeedbackPanel from './FeedbackPanel';

interface SearchResult {
  id: string;
  standard_id: string;
  standard_code: string;
  standard_version: string;
  section_title: string;
  subsection_title?: string;
  page_number: number;
  content_snippet: string;
  corpus_type: string;
  confidence: number;
}

interface Filters {
  discipline?: string;
  standard?: string;
  version?: string;
  corpus_type?: string;
}

export default function StandardsSearch() {
  const supabase = getSupabaseAnonClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [queryLogId, setQueryLogId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[TRACE] handleSearch: START');

    if (!query.trim()) {
      console.log('[TRACE] handleSearch: EMPTY QUERY, RETURN');
      setResults([]);
      return;
    }

    console.log('[TRACE] handleSearch: QUERY=' + query);
    setLoading(true);
    setError(null);
    setResults([]);
    setSelectedResult(null);
    const searchStartTime = Date.now();

    try {
      console.log('[TRACE] handleSearch: SEARCH POST START');
      // Execute search
      const searchRes = await apiPost('/api/agsk/search', {
        query: query,
        org_id: 'default',
        ...filters,
      });
      const searchLatency = Date.now() - searchStartTime;
      console.log('[TRACE] handleSearch: SEARCH POST DONE:', Array.isArray(searchRes), 'latency=' + searchLatency);

      if (Array.isArray(searchRes)) {
        console.log('[TRACE] handleSearch: VALID RESPONSE, RESULTS=' + searchRes.length);
        setResults(searchRes);

        // Log query to telemetry (AFTER search, fire-and-forget, don't block retrieval)
        console.log('[TRACE] handleSearch: TELEMETRY POST START (async, fire-and-forget)');
        apiPost('/api/telemetry/query', {
          query_text: query,
          discipline: filters.discipline,
          result_count: searchRes.length,
          retrieval_latency_ms: searchLatency,
        }).then((telRes) => {
          console.log('[TRACE] handleSearch: TELEMETRY POST DONE:', telRes?.id);
          if (telRes?.id) setQueryLogId(telRes.id);
        }).catch((err) => {
          console.log('[TRACE] handleSearch: TELEMETRY POST ERROR (ignored):', err instanceof Error ? err.message : String(err));
          // Telemetry failure does not block retrieval
        });
      } else {
        console.log('[TRACE] handleSearch: INVALID RESPONSE TYPE:', typeof searchRes);
        setError('Invalid response format');
      }
    } catch (err) {
      console.log('[TRACE] handleSearch: ERROR CAUGHT:', err instanceof Error ? err.message : String(err));
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      console.log('[TRACE] handleSearch: FINALLY - setLoading(false)');
      setLoading(false);
    }
  }, [query, filters, supabase.auth]);

  const handleResultClick = useCallback(async (result: SearchResult, rank: number) => {
    setSelectedResult(result);
    setShowFeedback(true);

    if (queryLogId) {
      // Fire-and-forget: log click without blocking UI
      apiPost('/api/telemetry/click', {
        query_log_id: queryLogId,
        result_rank: rank,
        chunk_id: result.id,
        standard_id: result.standard_id,
        section_title: result.section_title,
      }).catch((err) => {
        console.warn('[TELEMETRY] Click logging failed (ignored):', err instanceof Error ? err.message : String(err));
      });
    }
  }, [queryLogId]);

  const handleFeedback = useCallback(async (feedback: {
    type: 'relevant' | 'irrelevant' | 'partially_relevant';
    citation_correct?: boolean;
    false_positive?: boolean;
    comments?: string;
  }) => {
    if (!selectedResult || !queryLogId) return;

    // Always close feedback panel (regardless of telemetry success)
    setShowFeedback(false);
    setSelectedResult(null);

    // Fire-and-forget: log feedback without blocking UI
    apiPost('/api/telemetry/feedback', {
      query_log_id: queryLogId,
      result_id: selectedResult.id,
      feedback_type: feedback.type,
      citation_correct: feedback.citation_correct ?? null,
      false_positive: feedback.false_positive ?? false,
      comments: feedback.comments || null,
    }).catch((err) => {
      console.warn('[TELEMETRY] Feedback logging failed (ignored):', err instanceof Error ? err.message : String(err));
    });
  }, [selectedResult, queryLogId]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f5f7fa' }}>
      {/* Left Panel - Search & Results */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e0e6ed' }}>
        {/* Header */}
        <div style={{ padding: '20px', background: '#fff', borderBottom: '1px solid #e0e6ed' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px 0', color: '#1a1a1a' }}>
            🔍 Поиск нормативов
          </h1>

          {/* Search Form */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Поиск стандартов, разделов, требований..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: '1px solid #d0d7e3',
                borderRadius: 6,
                fontSize: 14,
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '⏳' : '→'}
            </button>
          </form>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={filters.discipline || ''}
              onChange={(e) => setFilters({ ...filters, discipline: e.target.value || undefined })}
              style={{
                padding: '6px 10px',
                border: '1px solid #d0d7e3',
                borderRadius: 4,
                fontSize: 12,
                background: '#fff',
              }}
            >
              <option value="">Все дисциплины</option>
              <option value="pipeline">Трубопроводы</option>
              <option value="welding">Сварка</option>
              <option value="corrosion">Коррозия</option>
            </select>

            <select
              value={filters.corpus_type || ''}
              onChange={(e) => setFilters({ ...filters, corpus_type: e.target.value || undefined })}
              style={{
                padding: '6px 10px',
                border: '1px solid #d0d7e3',
                borderRadius: 4,
                fontSize: 12,
                background: '#fff',
              }}
            >
              <option value="">Все типы</option>
              <option value="normative">Нормативный документ</option>
              <option value="catalog">Каталог</option>
              <option value="reference">Справочный</option>
            </select>
          </div>
        </div>

        {/* Results */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {error && (
            <div style={{
              padding: 12,
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: 6,
              color: '#991b1b',
              fontSize: 13,
            }}>
              ⚠️ {error}
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
              <div style={{ fontSize: 14, color: '#999' }}>Searching...</div>
            </div>
          )}

          {!loading && results.length === 0 && query && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
              <div>No results found</div>
            </div>
          )}

          {!loading && results.length === 0 && !query && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔎</div>
              <div>Введите запрос для начала поиска</div>
            </div>
          )}

          {results.map((result, idx) => (
            <ResultCard
              key={result.id}
              result={result}
              rank={idx + 1}
              isSelected={selectedResult?.id === result.id}
              onSelect={() => handleResultClick(result, idx + 1)}
            />
          ))}
        </div>
      </div>

      {/* Right Panel - Feedback/Details */}
      {showFeedback && selectedResult && (
        <FeedbackPanel
          result={selectedResult}
          onFeedback={handleFeedback}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  );
}
