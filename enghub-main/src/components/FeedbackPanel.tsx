import React, { useState } from 'react';

interface SearchResult {
  id: string;
  standard_id: string;
  standard_code: string;
  standard_version: string;
  section_title: string;
  page_number: number;
  content_snippet: string;
}

interface FeedbackPanelProps {
  result: SearchResult;
  onFeedback: (feedback: {
    type: 'relevant' | 'irrelevant' | 'partially_relevant';
    citation_correct?: boolean;
    false_positive?: boolean;
    comments?: string;
  }) => void;
  onClose: () => void;
}

export default function FeedbackPanel({ result, onFeedback, onClose }: FeedbackPanelProps) {
  const [relevance, setRelevance] = useState<'relevant' | 'irrelevant' | 'partially_relevant' | null>(null);
  const [citationCorrect, setCitationCorrect] = useState<boolean | null>(null);
  const [isFalsePositive, setIsFalsePositive] = useState(false);
  const [comments, setComments] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!relevance) {
      alert('Please select relevance level');
      return;
    }

    onFeedback({
      type: relevance,
      citation_correct: citationCorrect,
      false_positive: isFalsePositive,
      comments: comments || undefined,
    });

    setSubmitted(true);
    setTimeout(() => {
      onClose();
      // Reset
      setRelevance(null);
      setCitationCorrect(null);
      setIsFalsePositive(false);
      setComments('');
      setSubmitted(false);
    }, 500);
  };

  return (
    <div
      style={{
        width: 320,
        background: '#fff',
        borderLeft: '1px solid #e0e6ed',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-2px 0 8px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid #e0e6ed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#1a1a1a' }}>
          💬 Feedback
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: 18,
            cursor: 'pointer',
            color: '#999',
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Result Summary */}
        <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Selected Result</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', fontFamily: 'monospace' }}>
            {result.standard_code} v{result.standard_version}
          </div>
          <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>
            {result.section_title}
          </div>
        </div>

        {/* Relevance */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
            Is this result relevant?
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              onClick={() => setRelevance('relevant')}
              style={{
                padding: '10px 12px',
                border: `1px solid ${relevance === 'relevant' ? '#3b82f6' : '#d0d7e3'}`,
                borderRadius: 6,
                background: relevance === 'relevant' ? '#eff6ff' : '#fff',
                color: relevance === 'relevant' ? '#3b82f6' : '#374151',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: 13,
                textAlign: 'left',
              }}
            >
              👍 Relevant — directly answers my query
            </button>
            <button
              onClick={() => setRelevance('partially_relevant')}
              style={{
                padding: '10px 12px',
                border: `1px solid ${relevance === 'partially_relevant' ? '#3b82f6' : '#d0d7e3'}`,
                borderRadius: 6,
                background: relevance === 'partially_relevant' ? '#eff6ff' : '#fff',
                color: relevance === 'partially_relevant' ? '#3b82f6' : '#374151',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: 13,
                textAlign: 'left',
              }}
            >
              🤔 Partially — somewhat related
            </button>
            <button
              onClick={() => setRelevance('irrelevant')}
              style={{
                padding: '10px 12px',
                border: `1px solid ${relevance === 'irrelevant' ? '#3b82f6' : '#d0d7e3'}`,
                borderRadius: 6,
                background: relevance === 'irrelevant' ? '#eff6ff' : '#fff',
                color: relevance === 'irrelevant' ? '#3b82f6' : '#374151',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: 13,
                textAlign: 'left',
              }}
            >
              👎 Irrelevant — wrong topic
            </button>
          </div>
        </div>

        {/* Citation Correctness */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
            Citation Accuracy
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setCitationCorrect(true)}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: `1px solid ${citationCorrect === true ? '#3b82f6' : '#d0d7e3'}`,
                borderRadius: 6,
                background: citationCorrect === true ? '#eff6ff' : '#fff',
                color: citationCorrect === true ? '#3b82f6' : '#374151',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: 12,
              }}
            >
              ✅ Correct
            </button>
            <button
              onClick={() => setCitationCorrect(false)}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: `1px solid ${citationCorrect === false ? '#3b82f6' : '#d0d7e3'}`,
                borderRadius: 6,
                background: citationCorrect === false ? '#eff6ff' : '#fff',
                color: citationCorrect === false ? '#3b82f6' : '#374151',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: 12,
              }}
            >
              ❌ Wrong
            </button>
          </div>
        </div>

        {/* False Positive */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
            <input
              type="checkbox"
              checked={isFalsePositive}
              onChange={(e) => setIsFalsePositive(e.target.checked)}
              style={{ cursor: 'pointer', width: 16, height: 16 }}
            />
            <span>🚫 False positive (wrong discipline)</span>
          </label>
        </div>

        {/* Comments */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>
            Additional Comments (optional)
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="e.g., Section not found in standard, outdated information..."
            style={{
              width: '100%',
              minHeight: 80,
              padding: '10px 12px',
              border: '1px solid #d0d7e3',
              borderRadius: 6,
              fontSize: 13,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              resize: 'vertical',
              color: '#374151',
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #e0e6ed', display: 'flex', gap: 8 }}>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            padding: '10px 12px',
            border: '1px solid #d0d7e3',
            borderRadius: 6,
            background: '#fff',
            color: '#374151',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: 13,
          }}
        >
          Skip
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitted}
          style={{
            flex: 1,
            padding: '10px 12px',
            border: 'none',
            borderRadius: 6,
            background: submitted ? '#d1d5db' : '#3b82f6',
            color: '#fff',
            cursor: submitted ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {submitted ? '✅ Submitted' : '📤 Submit'}
        </button>
      </div>
    </div>
  );
}
