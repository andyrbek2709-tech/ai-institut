import React, { useState, useEffect } from 'react';
import { getDashboardData } from '../lib/api-monitoring';
import { getRolloutConfig, setRolloutPercentage } from '../config/api-rollout';
import { getSelectionMetrics, getApiSelectionReason } from '../lib/api-selection';
import { getApiProvider } from '../config/api';

export function ApiRolloutDashboard() {
  const [data, setData] = useState(getDashboardData());
  const [percentage, setPercentage] = useState(getRolloutConfig().railwayPercentage);
  const [isEditing, setIsEditing] = useState(false);
  const [tempPercentage, setTempPercentage] = useState(String(percentage));

  // Refresh metrics every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setData(getDashboardData());
      setPercentage(getRolloutConfig().railwayPercentage);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleSavePercentage = () => {
    const num = Math.min(100, Math.max(0, parseInt(tempPercentage, 10) || 0));
    setRolloutPercentage(num);
    setPercentage(num);
    setTempPercentage(String(num));
    setIsEditing(false);
    // Reload to apply new percentage
    window.location.reload();
  };

  const handleQuickSet = (value: number) => {
    setRolloutPercentage(value);
    setPercentage(value);
    setTempPercentage(String(value));
    window.location.reload();
  };

  const metrics = getSelectionMetrics();
  const provider = getApiProvider();
  const reason = getApiSelectionReason();

  const vercelMetrics = data.vercelMetrics;
  const railwayMetrics = data.railwayMetrics;

  const getRecommendationColor = () => {
    if (data.recommendation.includes('✅')) return '#10b981';
    if (data.recommendation.includes('⚠️')) return '#f59e0b';
    return '#6b7280';
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>API Rollout Monitor</h2>
        <div style={styles.currentProvider}>
          Current: <strong>{provider.toUpperCase()}</strong>
          <div style={styles.reason}>{reason}</div>
        </div>
      </div>

      {/* Rollout Percentage Control */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Rollout Percentage</div>
        <div style={styles.percentageControl}>
          <div style={styles.currentPercentage}>
            <div style={styles.percentageValue}>{percentage}%</div>
            <div style={styles.percentageLabel}>Railway Traffic</div>
          </div>

          {isEditing ? (
            <div style={styles.editContainer}>
              <input
                type="number"
                min="0"
                max="100"
                value={tempPercentage}
                onChange={(e) => setTempPercentage(e.target.value)}
                style={styles.percentageInput}
              />
              <button onClick={handleSavePercentage} style={styles.buttonPrimary}>
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setTempPercentage(String(percentage));
                }}
                style={styles.buttonSecondary}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={styles.quickButtons}>
              <button onClick={() => setIsEditing(true)} style={styles.buttonSecondary}>
                Edit
              </button>
              <div style={styles.quickButtonsGroup}>
                <button
                  onClick={() => handleQuickSet(0)}
                  style={{
                    ...styles.quickButton,
                    ...(percentage === 0 ? styles.quickButtonActive : {}),
                  }}
                >
                  0%
                </button>
                <button
                  onClick={() => handleQuickSet(10)}
                  style={{
                    ...styles.quickButton,
                    ...(percentage === 10 ? styles.quickButtonActive : {}),
                  }}
                >
                  10%
                </button>
                <button
                  onClick={() => handleQuickSet(50)}
                  style={{
                    ...styles.quickButton,
                    ...(percentage === 50 ? styles.quickButtonActive : {}),
                  }}
                >
                  50%
                </button>
                <button
                  onClick={() => handleQuickSet(100)}
                  style={{
                    ...styles.quickButton,
                    ...(percentage === 100 ? styles.quickButtonActive : {}),
                  }}
                >
                  100%
                </button>
              </div>
            </div>
          )}
        </div>
        <div style={styles.stageLabel}>Stage: {metrics.stage}</div>
      </div>

      {/* Metrics Comparison */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Metrics Comparison</div>
        <div style={styles.metricsGrid}>
          {/* Vercel Metrics */}
          <div style={styles.metricCard}>
            <div style={styles.metricProviderName}>VERCEL</div>
            <div style={styles.metricRow}>
              <span>Requests:</span>
              <strong>{vercelMetrics.requestCount}</strong>
            </div>
            <div style={styles.metricRow}>
              <span>Errors:</span>
              <strong>{vercelMetrics.errorCount}</strong>
            </div>
            <div style={styles.metricRow}>
              <span>Error Rate:</span>
              <strong>{vercelMetrics.errorRate}%</strong>
            </div>
            <div style={styles.metricRow}>
              <span>Avg Latency:</span>
              <strong>{vercelMetrics.avgLatency}ms</strong>
            </div>
            {vercelMetrics.lastError && (
              <div style={styles.lastError}>
                <div style={styles.errorLabel}>Last Error:</div>
                <div style={styles.errorMessage}>{vercelMetrics.lastError.message}</div>
                <div style={styles.errorTime}>
                  {new Date(vercelMetrics.lastError.timestamp).toLocaleTimeString()}
                </div>
              </div>
            )}
          </div>

          {/* Railway Metrics */}
          <div style={styles.metricCard}>
            <div style={styles.metricProviderName}>RAILWAY</div>
            <div style={styles.metricRow}>
              <span>Requests:</span>
              <strong>{railwayMetrics.requestCount}</strong>
            </div>
            <div style={styles.metricRow}>
              <span>Errors:</span>
              <strong>{railwayMetrics.errorCount}</strong>
            </div>
            <div style={styles.metricRow}>
              <span>Error Rate:</span>
              <strong>{railwayMetrics.errorRate}%</strong>
            </div>
            <div style={styles.metricRow}>
              <span>Avg Latency:</span>
              <strong>{railwayMetrics.avgLatency}ms</strong>
            </div>
            {railwayMetrics.lastError && (
              <div style={styles.lastError}>
                <div style={styles.errorLabel}>Last Error:</div>
                <div style={styles.errorMessage}>{railwayMetrics.lastError.message}</div>
                <div style={styles.errorTime}>
                  {new Date(railwayMetrics.lastError.timestamp).toLocaleTimeString()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div
        style={{
          ...styles.section,
          borderLeft: `4px solid ${getRecommendationColor()}`,
        }}
      >
        <div style={styles.sectionTitle}>Recommendation</div>
        <div
          style={{
            ...styles.recommendation,
            color: getRecommendationColor(),
          }}
        >
          {data.recommendation}
        </div>
        {data.safeToIncreaseRollout && percentage < 100 && (
          <div style={styles.recommendationHint}>
            Railway metrics look good. Consider increasing rollout to the next stage.
          </div>
        )}
      </div>

      {/* Debug Info */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Debug Info</div>
        <div style={styles.debugInfo}>
          <div>
            <strong>Monitoring:</strong> {metrics.enableMonitoring ? '✅ Enabled' : '❌ Disabled'}
          </div>
          <div>
            <strong>Verbose Logging:</strong> {metrics.verboseLogging ? '✅ Enabled' : '❌ Disabled'}
          </div>
          <div style={styles.debugHint}>
            Open browser DevTools Console and run:
            <code>apiMonitor.export()</code>
            to see full metrics export.
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    maxWidth: '900px',
    margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    color: '#1f2937',
  } as React.CSSProperties,

  header: {
    marginBottom: '24px',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '16px',
  } as React.CSSProperties,

  title: {
    margin: '0 0 12px 0',
    fontSize: '24px',
    fontWeight: 'bold',
  } as React.CSSProperties,

  currentProvider: {
    fontSize: '14px',
    color: '#6b7280',
  } as React.CSSProperties,

  reason: {
    fontSize: '12px',
    marginTop: '4px',
    fontFamily: 'monospace',
    color: '#9ca3af',
  } as React.CSSProperties,

  section: {
    marginBottom: '20px',
    padding: '16px',
    backgroundColor: 'white',
    borderRadius: '6px',
    border: '1px solid #e5e7eb',
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '12px',
    textTransform: 'uppercase',
    color: '#374151',
  } as React.CSSProperties,

  percentageControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '12px',
  } as React.CSSProperties,

  currentPercentage: {
    textAlign: 'center',
    minWidth: '80px',
  } as React.CSSProperties,

  percentageValue: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#0066cc',
  } as React.CSSProperties,

  percentageLabel: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px',
  } as React.CSSProperties,

  editContainer: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  } as React.CSSProperties,

  percentageInput: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '14px',
    width: '80px',
  } as React.CSSProperties,

  quickButtons: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  } as React.CSSProperties,

  quickButtonsGroup: {
    display: 'flex',
    gap: '4px',
  } as React.CSSProperties,

  quickButton: {
    padding: '6px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    color: '#6b7280',
    transition: 'all 0.2s',
  } as React.CSSProperties,

  quickButtonActive: {
    backgroundColor: '#0066cc',
    color: 'white',
    borderColor: '#0066cc',
  } as React.CSSProperties,

  buttonPrimary: {
    padding: '8px 16px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  } as React.CSSProperties,

  buttonSecondary: {
    padding: '8px 16px',
    backgroundColor: 'white',
    color: '#6b7280',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  } as React.CSSProperties,

  stageLabel: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '8px',
  } as React.CSSProperties,

  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  } as React.CSSProperties,

  metricCard: {
    padding: '12px',
    backgroundColor: '#f3f4f6',
    borderRadius: '4px',
    border: '1px solid #e5e7eb',
  } as React.CSSProperties,

  metricProviderName: {
    fontSize: '12px',
    fontWeight: '600',
    marginBottom: '8px',
    color: '#374151',
    textTransform: 'uppercase',
  } as React.CSSProperties,

  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    marginBottom: '6px',
    padding: '4px 0',
    borderBottom: '1px solid #d1d5db',
  } as React.CSSProperties,

  lastError: {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: '#fee2e2',
    borderRadius: '3px',
    fontSize: '12px',
  } as React.CSSProperties,

  errorLabel: {
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: '2px',
  } as React.CSSProperties,

  errorMessage: {
    color: '#991b1b',
    marginBottom: '2px',
    wordBreak: 'break-word',
  } as React.CSSProperties,

  errorTime: {
    color: '#9ca3af',
    fontSize: '11px',
  } as React.CSSProperties,

  recommendation: {
    fontSize: '14px',
    fontWeight: '500',
    padding: '8px 0',
  } as React.CSSProperties,

  recommendationHint: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '8px',
    padding: '8px',
    backgroundColor: '#f3f4f6',
    borderRadius: '3px',
  } as React.CSSProperties,

  debugInfo: {
    fontSize: '13px',
    lineHeight: '1.6',
    color: '#6b7280',
  } as React.CSSProperties,

  debugHint: {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: '#f3f4f6',
    borderRadius: '3px',
    fontSize: '12px',
  } as React.CSSProperties,
};
