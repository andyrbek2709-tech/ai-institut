import React from 'react';

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

interface ResultCardProps {
  result: SearchResult;
  rank: number;
  isSelected: boolean;
  onSelect: () => void;
}

export default function ResultCard({ result, rank, isSelected, onSelect }: ResultCardProps) {
  const highlightSnippet = (text: string, maxLength: number = 200) => {
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text;
  };

  const corpusTypeLabel: Record<string, string> = {
    normative: '📋 Normative',
    catalog: '📦 Catalog',
    reference: '📚 Reference',
    material_registry: '🏭 Materials',
    project: '🗂️ Project',
  };

  const corpusTypeColor: Record<string, string> = {
    normative: '#059669',
    catalog: '#7c3aed',
    reference: '#0284c7',
    material_registry: '#ea580c',
    project: '#6b7280',
  };

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '16px',
        background: isSelected ? '#eff6ff' : '#fff',
        border: `1px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
        borderRadius: 8,
        marginBottom: 12,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = '#f9fafb';
          e.currentTarget.style.borderColor = '#d1d5db';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = '#fff';
          e.currentTarget.style.borderColor = '#e5e7eb';
        }
      }}
    >
      {/* Rank & Standard Info */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#3b82f6',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {rank}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#1a1a1a',
                fontFamily: 'monospace',
              }}
            >
              {result.standard_code}
            </span>
            <span
              style={{
                fontSize: 12,
                background: '#f3f4f6',
                padding: '2px 6px',
                borderRadius: 3,
                color: '#6b7280',
              }}
            >
              v{result.standard_version}
            </span>
            {result.corpus_type && (
              <span
                style={{
                  fontSize: 11,
                  background: corpusTypeColor[result.corpus_type] + '20',
                  padding: '2px 8px',
                  borderRadius: 3,
                  color: corpusTypeColor[result.corpus_type] || '#666',
                  fontWeight: 500,
                }}
              >
                {corpusTypeLabel[result.corpus_type] || result.corpus_type}
              </span>
            )}
          </div>

          {/* Section Info */}
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>
            <div style={{ fontWeight: 500 }}>
              {result.section_title}
              {result.subsection_title && ` → ${result.subsection_title}`}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              📄 Page {result.page_number}
            </div>
          </div>

          {/* Snippet */}
          <div
            style={{
              fontSize: 13,
              color: '#4b5563',
              lineHeight: 1.5,
              padding: '10px',
              background: '#f9fafb',
              borderRadius: 4,
              borderLeft: `3px solid ${corpusTypeColor[result.corpus_type] || '#d1d5db'}`,
            }}
          >
            "{highlightSnippet(result.content_snippet)}"
          </div>

          {/* Confidence */}
          {result.confidence > 0 && (
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
              🎯 Confidence: {(result.confidence * 100).toFixed(0)}%
            </div>
          )}
        </div>
      </div>

      {/* Citation Reference */}
      <div style={{ fontSize: 12, color: '#6b7280', padding: '8px 0 0 40px', borderTop: '1px solid #f3f4f6' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(
              `${result.standard_code} v${result.standard_version}, ${result.section_title}, p.${result.page_number}`
            );
            alert('Citation copied to clipboard');
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#3b82f6',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 500,
            padding: 0,
            textDecoration: 'underline',
          }}
        >
          📋 Copy Citation
        </button>
        {' · '}
        <button
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Open PDF at page number
            window.open(`#pdf/${result.standard_id}#page=${result.page_number}`, '_blank');
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#3b82f6',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 500,
            padding: 0,
            textDecoration: 'underline',
          }}
        >
          🔗 Open PDF
        </button>
      </div>
    </div>
  );
}
