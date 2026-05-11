import React, { useEffect, useRef, useState } from 'react';

const API = 'https://api-server-production-8157.up.railway.app';

type Section = {
  id: string;
  section_number: number;
  section_title: string;
  section_text: string;
  discipline: string | null;
};

type Assignment = {
  id: string;
  version: number;
  file_name: string;
  signed_url: string | null;
  notes: string | null;
  uploaded_at: string;
};

type Citation = {
  document: string;
  standard: string;
  section: string;
  page: number;
  version: string;
  confidence: number;
};

type DisciplineAnalysis = {
  discipline: string;
  title: string;
  sections: Section[];
  citations: Citation[];
  summary: string | null;
  error: string | null;
};

type AnalysisResult = {
  assignment_id: string;
  version?: number;
  analyses: DisciplineAnalysis[];
  warning?: string;
  generated_at: string;
};

type Props = {
  C: any;
  token: string;
  project: { id: string; name: string };
  isGip: boolean;
  isAdmin?: boolean;
};

const DISC_COLORS: Record<string, string> = {
  ЭС: '#3b82f6',
  КИПиА: '#f59e0b',
  ООС: '#22c55e',
  ПОС: '#8b5cf6',
  Смета: '#ef4444',
  ПБ: '#f97316',
  ПромБ: '#ec4899',
  КР: '#14b8a6',
  ОПД: '#6366f1',
  АКЗ: '#84cc16',
};

const DISC_ORDER = ['ЭС','КИПиА','КР','ПОС','ООС','ПБ','ПромБ','АКЗ','Смета','ОПД'];

export function AssignmentTab({ C, token, project, isGip, isAdmin }: Props) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showPdf, setShowPdf] = useState(false);
  const [expandedDisc, setExpandedDisc] = useState<string | null>(null);
  const [expandedSec, setExpandedSec] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [openAnalysisDisc, setOpenAnalysisDisc] = useState<string | null>(null);

  const canUpload = isGip || isAdmin;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/assignment?project_id=${project.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 404) { setAssignment(null); setSections([]); return; }
      if (!r.ok) { const j = await r.json(); setError(j.error || 'Ошибка загрузки'); return; }
      const j = await r.json();
      setAssignment(j.assignment);
      setSections(j.sections || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [project.id]); // eslint-disable-line

  // Сбрасываем результат анализа при смене проекта / новой загрузке ТЗ
  useEffect(() => {
    setAnalysis(null);
    setAnalysisError(null);
    setOpenAnalysisDisc(null);
  }, [project.id, assignment?.id, assignment?.version]);

  const handleAnalyze = async () => {
    if (!assignment) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysis(null);
    try {
      const r = await fetch(`${API}/api/assignment/analyze`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assignment_id: assignment.id }),
      });
      const j = await r.json();
      if (!r.ok) {
        setAnalysisError(j.error || 'Ошибка анализа');
        return;
      }
      setAnalysis(j);
      // Авто-раскрытие первой дисциплины
      const first = j.analyses?.find((a: DisciplineAnalysis) => a.summary || a.error);
      if (first) setOpenAnalysisDisc(first.discipline);
    } catch (e: any) {
      setAnalysisError(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Только PDF файлы'); return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('project_id', project.id);
      fd.append('file', file, file.name);
      if (notes.trim()) fd.append('notes', notes.trim());
      const r = await fetch(`${API}/api/assignment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const j = await r.json();
      if (!r.ok) { setUploadError(j.error || 'Ошибка загрузки'); return; }
      setShowUploadForm(false);
      setNotes('');
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (e: any) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
    }
  };

  // Group sections by discipline, then "Без дисциплины"
  const grouped = React.useMemo(() => {
    const map: Record<string, Section[]> = {};
    for (const s of sections) {
      const key = s.discipline || '—';
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    // Sort keys by DISC_ORDER then alpha
    return Object.entries(map).sort(([a], [b]) => {
      const ia = DISC_ORDER.indexOf(a), ib = DISC_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b, 'ru');
    });
  }, [sections]);

  const inp: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
    color: C.text, padding: '7px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box',
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 14 }}>
      Загрузка задания на проектирование…
    </div>
  );

  return (
    <div className="screen-fade" style={{ padding: 20, maxWidth: 900 }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="page-label">ТЗ</div>
          <div className="page-title">Задание на проектирование</div>
          {assignment && (
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
              v{assignment.version} · {assignment.file_name} · загружено {new Date(assignment.uploaded_at).toLocaleDateString('ru-RU')}
            </div>
          )}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {assignment?.signed_url && (
            <button
              className="btn"
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
              onClick={() => setShowPdf(!showPdf)}
            >
              {showPdf ? '✕ Закрыть PDF' : '📄 Открыть PDF'}
            </button>
          )}
          {assignment && sections.length > 0 && (
            <button
              className="btn"
              style={{
                background: analyzing ? C.surface : (C.accent || '#3b82f6'),
                color: analyzing ? C.textMuted : '#fff',
                border: `1px solid ${analyzing ? C.border : (C.accent || '#3b82f6')}`,
                padding: '6px 14px', borderRadius: 6, cursor: analyzing ? 'wait' : 'pointer', fontSize: 13,
                opacity: analyzing ? 0.7 : 1,
              }}
              onClick={handleAnalyze}
              disabled={analyzing}
              title="Подобрать применимые нормы по разделам ТЗ"
            >
              {analyzing ? '⏳ Анализирую…' : '🤖 Анализ ТЗ'}
            </button>
          )}
          {canUpload && (
            <button
              className="btn btn-primary"
              style={{ padding: '6px 14px', borderRadius: 6, fontSize: 13 }}
              onClick={() => setShowUploadForm(!showUploadForm)}
            >
              {assignment ? '↑ Обновить ТЗ' : '+ Загрузить ТЗ'}
            </button>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>⚠ {error}</div>}

      {/* ── Upload form ── */}
      {showUploadForm && canUpload && (
        <div className="panel-surface" style={{ padding: 16, marginBottom: 16, borderRadius: 8, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>
            {assignment ? `Загрузить новую версию (текущая v${assignment.version})` : 'Загрузить задание на проектирование'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input ref={fileRef} type="file" accept=".pdf" style={{ ...inp, padding: '6px 8px' }} />
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Примечание (необязательно)"
              rows={2}
              style={{ ...inp, resize: 'vertical' }}
            />
            {uploadError && <div style={{ color: C.red, fontSize: 12 }}>⚠ {uploadError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                style={{ padding: '6px 16px', borderRadius: 6, fontSize: 13 }}
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'Загружаю…' : '↑ Загрузить'}
              </button>
              <button
                className="btn"
                style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMuted, padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                onClick={() => { setShowUploadForm(false); setUploadError(null); }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── No assignment yet ── */}
      {!assignment && !loading && (
        <div className="empty-state" style={{ padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ color: C.textMuted, fontSize: 14 }}>
            Задание на проектирование не загружено.
            {canUpload ? ' Нажмите «+ Загрузить ТЗ» выше.' : ' Обратитесь к ГИПу.'}
          </div>
        </div>
      )}

      {assignment && (
        <>
          {/* ── Notes ── */}
          {assignment.notes && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13, color: C.textMuted }}>
              💬 {assignment.notes}
            </div>
          )}

          {/* ── Analyze result ── */}
          {analysisError && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: `1px solid ${C.red}`, color: C.red,
              borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13,
            }}>
              ⚠ {analysisError}
            </div>
          )}
          {analysis && (
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: 14, marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: C.text }}>
                  🤖 Применимые нормы по разделам ТЗ
                </span>
                <span style={{ fontSize: 11, color: C.textMuted }}>
                  · v{analysis.version} · {new Date(analysis.generated_at).toLocaleString('ru-RU')}
                </span>
              </div>
              {analysis.warning && (
                <div style={{ color: C.textMuted, fontSize: 13, padding: '6px 0' }}>
                  {analysis.warning}
                </div>
              )}
              {analysis.analyses.map(a => {
                const color = DISC_COLORS[a.discipline] || C.textMuted;
                const isOpen = openAnalysisDisc === a.discipline;
                return (
                  <div key={a.discipline} style={{ marginBottom: 6 }}>
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                        background: 'transparent', border: `1px solid ${C.border}`,
                        borderRadius: isOpen ? '6px 6px 0 0' : 6,
                        cursor: 'pointer', userSelect: 'none',
                      }}
                      onClick={() => setOpenAnalysisDisc(isOpen ? null : a.discipline)}
                    >
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <div style={{ fontWeight: 600, fontSize: 12.5, color: C.text }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>
                        {a.sections.length} разд. · {a.citations.length} цит.{a.error ? ' · ⚠' : ''}
                      </div>
                      <div style={{ marginLeft: 'auto', color: C.textMuted, fontSize: 11 }}>
                        {isOpen ? '▲' : '▼'}
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{
                        border: `1px solid ${C.border}`, borderTop: 'none',
                        borderRadius: '0 0 6px 6px', padding: '10px 12px',
                      }}>
                        {a.error ? (
                          <div style={{ color: C.red, fontSize: 12.5 }}>⚠ {a.error}</div>
                        ) : (
                          <>
                            <div style={{
                              whiteSpace: 'pre-wrap', fontSize: 12.5, color: C.text,
                              lineHeight: 1.6, marginBottom: a.citations.length > 0 ? 10 : 0,
                            }}>
                              {a.summary}
                            </div>
                            {a.citations.length > 0 && (
                              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
                                  Источники:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: C.textMuted, lineHeight: 1.7 }}>
                                  {a.citations.map((c, i) => (
                                    <li key={i}>
                                      <strong style={{ color: C.text }}>{c.standard || '—'}</strong>
                                      {c.section && <> · §{c.section}</>}
                                      {c.page > 0 && <> · стр. {c.page}</>}
                                      {c.version && <> · {c.version}</>}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 10, fontStyle: 'italic' }}>
                ⓘ Сгенерировано AI на основе АГСК. Проверьте цитаты по первоисточникам.
              </div>
            </div>
          )}

          {/* ── Inline PDF viewer ── */}
          {showPdf && assignment.signed_url && (
            <div style={{ marginBottom: 16, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
              <iframe
                src={assignment.signed_url}
                title="Задание на проектирование"
                style={{ width: '100%', height: 600, border: 'none', background: '#fff' }}
              />
            </div>
          )}

          {/* ── Sections grouped by discipline ── */}
          {sections.length === 0 && (
            <div style={{ color: C.textMuted, fontSize: 13, padding: '20px 0' }}>
              Разделы ТЗ не распознаны. Откройте PDF для ознакомления.
            </div>
          )}

          {grouped.map(([disc, secs]) => {
            const color = DISC_COLORS[disc] || C.textMuted;
            const isOpen = expandedDisc === disc;
            return (
              <div key={disc} style={{ marginBottom: 8 }}>
                {/* Discipline header */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    background: C.surface, border: `1px solid ${C.border}`, borderRadius: isOpen ? '8px 8px 0 0' : 8,
                    cursor: 'pointer', userSelect: 'none',
                  }}
                  onClick={() => setExpandedDisc(isOpen ? null : disc)}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
                  }} />
                  <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>
                    {disc === '—' ? 'Общие / без дисциплины' : disc}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>
                    {secs.length} {secs.length === 1 ? 'раздел' : 'разделов'}
                  </div>
                  <div style={{ marginLeft: 'auto', color: C.textMuted, fontSize: 12 }}>
                    {isOpen ? '▲' : '▼'}
                  </div>
                </div>

                {/* Sections list */}
                {isOpen && (
                  <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                    {secs.map(sec => {
                      const secKey = sec.id;
                      const secOpen = expandedSec === secKey;
                      return (
                        <div key={secKey} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <div
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
                              background: secOpen ? (C.surfaceHover || C.surface) : 'transparent',
                              cursor: 'pointer',
                            }}
                            onClick={() => setExpandedSec(secOpen ? null : secKey)}
                          >
                            <div style={{
                              fontSize: 11, fontWeight: 700, color: color,
                              minWidth: 22, paddingTop: 1,
                            }}>
                              {sec.section_number ?? '—'}
                            </div>
                            <div style={{ fontSize: 13, color: C.text, flex: 1 }}>
                              {sec.section_title}
                            </div>
                            <div style={{ color: C.textMuted, fontSize: 11, flexShrink: 0 }}>
                              {secOpen ? '▲' : '▼'}
                            </div>
                          </div>
                          {secOpen && (
                            <div style={{
                              padding: '0 14px 14px 46px', fontSize: 12.5, color: C.textMuted,
                              lineHeight: 1.65, whiteSpace: 'pre-wrap',
                            }}>
                              {sec.section_text}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
