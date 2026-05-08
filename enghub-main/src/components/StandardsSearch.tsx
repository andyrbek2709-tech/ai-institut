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
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setSelectedResult(null);

    try {
      const user = await supabase.auth.getUser();
      const userId = user.data.user?.id;

      // Log query to telemetry
      const telRes = await apiPost('/api/telemetry/query', {
        query_text: query,
        discipline: filters.discipline,
      });
      const newQueryLogId = telRes?.id;
      setQueryLogId(newQueryLogId);

      // Execute search
      const searchRes = await apiPost('/api/agsk/search', {
        query: query,
        org_id: 'default',
        ...filters,
      });

      if (Array.isArray(searchRes)) {
        setResults(searchRes);
      } else {
        setError('Invalid response format');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [query, filters, supabase.auth]);

  const handleResultClick = useCallback(async (result: SearchResult, rank: number) => {
    setSelectedResult(result);
    setShowFeedback(true);

    if (queryLogId) {
      try {
        await apiPost('/api/telemetry/click', {
          query_log_id: queryLogId,
          result_rank: rank,
          chunk_id: result.id,
          standard_id: result.standard_id,
          section_title: result.section_title,
        });
      } catch (err) {
        console.error('Click telemetry failed:', err);
      }
    }
  }, [queryLogId]);

  const handleFeedback = useCallback(async (feedback: {
    type: 'relevant' | 'irrelevant' | 'partially_relevant';
    citation_correct?: boolean;
    false_positive?: boolean;
    comments?: string;
  }) => {
    if (!selectedResult || !queryLogId) return;

    try {
      await apiPost('/api/telemetry/feedback', {
        query_log_id: queryLogId,
        result_id: selectedResult.id,
        feedback_type: feedback.type,
        citation_correct: feedback.citation_correct ?? null,
        false_positive: feedback.false_positive ?? false,
        comments: feedback.comments || null,
      });
      setShowFeedback(false);
      setSelectedResult(null);
    } catch (err) {
      console.error('Feedback submission failed:', err);
    }
  }, [selectedResult, queryLogId]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f5f7fa' }}>
      {/* Left Panel - Search & Results */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e0e6ed' }}>
        {/* Header */}
        <div style={{ padding: '20px', background: '#fff', borderBottom: '1px solid #e0e6ed' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px 0', color: '#1a1a1a' }}>
            🔍 Standards Retrieval
          </h1>

          {/* Search Form */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Search standards, sections, requirements..."
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
              <option value="">All Disciplines</option>
              <option value="pipeline">Pipeline</option>
              <option value="welding">Welding</option>
              <option value="corrosion">Corrosion</option>
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
              <option value="">All Types</option>
              <option value="normative">Normative</option>
              <option value="catalog">Catalog</option>
              <option value="reference">Reference</option>
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
              <div>Enter a search query to get started</div>
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
