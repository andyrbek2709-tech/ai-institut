import { useState, useEffect, useMemo } from 'react';
import { get } from '../api/supabase';

// ── G1: Risk Dashboard ────────────────────────────────────────────────────────
function RiskDashboard({ tasks, reviews, project, C }: any) {
  const now = new Date();
  const overdueTasks = tasks.filter((t: any) => t.deadline && new Date(t.deadline) < now && t.status !== 'done');
  const criticalReviews = reviews.filter((r: any) => r.status === 'open' && (r.severity === 'critical' || r.severity === 'major'));
  const blockedTasks = tasks.filter((t: any) => t.status === 'revision');
  const daysLeft = project?.deadline ? Math.ceil((new Date(project.deadline).getTime() - now.getTime()) / 86400000) : null;
  const riskScore = Math.min(100, overdueTasks.length * 15 + criticalReviews.length * 10 + blockedTasks.length * 8 + (daysLeft !== null && daysLeft < 14 ? 30 : 0));
  const riskLevel = riskScore >= 60 ? { label: '🔴 Высокий', color: '#ef4444' } : riskScore >= 30 ? { label: '🟡 Средний', color: '#f5a623' } : { label: '🟢 Низкий', color: '#2ac769' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>⚠️ Риск-Дашборд</div>
        <div style={{ background: riskLevel.color + '20', color: riskLevel.color, borderRadius: 8, padding: '4px 12px', fontWeight: 700, fontSize: 13 }}>{riskLevel.label} ({riskScore}/100)</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { icon: '🔴', label: 'Просроченных задач', value: overdueTasks.length, color: overdueTasks.length > 0 ? '#ef4444' : '#2ac769' },
          { icon: '📝', label: 'Критич. замечаний', value: criticalReviews.length, color: criticalReviews.length > 0 ? '#f5a623' : '#2ac769' },
          { icon: '🔒', label: 'На доработке', value: blockedTasks.length, color: blockedTasks.length > 0 ? '#a855f7' : '#2ac769' },
          { icon: '📅', label: 'Дней до дедлайна', value: daysLeft !== null ? daysLeft : '—', color: daysLeft !== null && daysLeft < 14 ? '#ef4444' : daysLeft !== null && daysLeft < 30 ? '#f5a623' : '#2ac769' },
        ].map(({ icon, label, value, color }) => (
          <div key={label} className="panel-surface" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{label}</div>
          </div>
        ))}
      </div>

      {overdueTasks.length > 0 && (
        <div className="panel-surface" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>Просроченные задачи</div>
          {overdueTasks.slice(0, 5).map((t: any) => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
              <span style={{ color: C.text }}>{t.name}</span>
              <span style={{ color: '#ef4444', fontWeight: 600 }}>{new Date(t.deadline).toLocaleDateString('ru-RU')}</span>
            </div>
          ))}
          {overdueTasks.length > 5 && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>...и ещё {overdueTasks.length - 5}</div>}
        </div>
      )}

      {criticalReviews.length > 0 && (
        <div className="panel-surface" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#f5a623', marginBottom: 8 }}>Критические замечания</div>
          {criticalReviews.slice(0, 4).map((r: any) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
              <span style={{ color: C.text }}>{r.title}</span>
              <span style={{ color: r.severity === 'critical' ? '#ef4444' : '#f5a623', fontWeight: 600 }}>{r.severity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── G2: S-Curve ───────────────────────────────────────────────────────────────
function SCurve({ tasks, C }: any) {
  const points = useMemo(() => {
    const withDates = tasks.filter((t: any) => t.deadline);
    if (withDates.length === 0) return [];
    const sorted = [...withDates].sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    const minMs = new Date(sorted[0].deadline).getTime();
    const maxMs = new Date(sorted[sorted.length - 1].deadline).getTime();
    const range = maxMs - minMs || 1;
    const total = tasks.length;
    let cum = 0;
    const pts: { x: number; y: number; label: string }[] = [];
    const byMonth: Record<string, number> = {};
    tasks.forEach((t: any) => {
      if (!t.deadline) return;
      const key = t.deadline.slice(0, 7);
      byMonth[key] = (byMonth[key] || 0) + 1;
    });
    const months = Object.keys(byMonth).sort();
    months.forEach(m => {
      cum += byMonth[m];
      const ms = new Date(m + '-15').getTime();
      pts.push({ x: Math.min(95, ((ms - minMs) / range) * 100), y: Math.round((cum / total) * 100), label: m });
    });
    return pts;
  }, [tasks]);

  const doneCum = useMemo(() => {
    const done = tasks.filter((t: any) => t.status === 'done' && t.deadline);
    const sorted = [...done].sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    if (sorted.length === 0 || points.length === 0) return [];
    const withDates = tasks.filter((t: any) => t.deadline);
    const minMs = new Date([...withDates].sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0].deadline).getTime();
    const maxMs = new Date([...withDates].sort((a: any, b: any) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime())[0].deadline).getTime();
    const range = maxMs - minMs || 1;
    const total = tasks.length;
    let cum = 0;
    const byMonth: Record<string, number> = {};
    done.forEach((t: any) => { const key = t.deadline.slice(0, 7); byMonth[key] = (byMonth[key] || 0) + 1; });
    return Object.keys(byMonth).sort().map(m => {
      cum += byMonth[m];
      const ms = new Date(m + '-15').getTime();
      return { x: Math.min(95, ((ms - minMs) / range) * 100), y: Math.round((cum / total) * 100) };
    });
  }, [tasks, points]);

  if (points.length < 2) return <div style={{ padding: 32, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Недостаточно данных для S-кривой</div>;

  const W = 560, H = 200;
  const toSVG = (x: number, y: number) => `${(x / 100) * W},${H - (y / 100) * H}`;
  const planPath = 'M ' + points.map(p => toSVG(p.x, p.y)).join(' L ');
  const factPath = doneCum.length > 1 ? 'M ' + doneCum.map(p => toSVG(p.x, p.y)).join(' L ') : '';

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>📈 S-кривая прогресса (план vs факт)</div>
      <div className="panel-surface" style={{ padding: 16, overflowX: 'auto' }}>
        <svg width={W} height={H + 30} style={{ display: 'block' }}>
          {/* Grid */}
          {[0, 25, 50, 75, 100].map(y => (
            <g key={y}>
              <line x1={0} y1={H - (y / 100) * H} x2={W} y2={H - (y / 100) * H} stroke={C.border} strokeWidth={0.5} />
              <text x={-4} y={H - (y / 100) * H + 4} fontSize={9} fill={C.textMuted} textAnchor="end">{y}%</text>
            </g>
          ))}
          {/* Plan curve */}
          <path d={planPath} fill="none" stroke="#4a9eff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {/* Fact curve */}
          {factPath && <path d={factPath} fill="none" stroke="#2ac769" strokeWidth={2.5} strokeDasharray="none" strokeLinecap="round" strokeLinejoin="round" />}
          {/* Today line */}
          <line x1={W * 0.5} y1={0} x2={W * 0.5} y2={H} stroke="#ef4444" strokeWidth={1} strokeDasharray="4,3" opacity={0.6} />
        </svg>
        <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 11, color: C.textMuted }}>
          <span><span style={{ display: 'inline-block', width: 18, height: 2, background: '#4a9eff', verticalAlign: 'middle', marginRight: 4 }} />План</span>
          <span><span style={{ display: 'inline-block', width: 18, height: 2, background: '#2ac769', verticalAlign: 'middle', marginRight: 4 }} />Факт</span>
          <span><span style={{ display: 'inline-block', width: 2, height: 12, background: '#ef4444', verticalAlign: 'middle', marginRight: 4 }} />Сегодня</span>
        </div>
      </div>
    </div>
  );
}

// ── G4: RACI Matrix ───────────────────────────────────────────────────────────
function RACIMatrix({ appUsers, depts, C, token, projectId }: any) {
  const [raci, setRaci] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get(`raci?project_id=eq.${projectId}&select=*`, token).then(d => {
      if (Array.isArray(d)) setRaci(d);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);

  const leads = appUsers.filter((u: any) => u.role === 'lead' || u.role === 'gip');
  const ROLES = ['R', 'A', 'C', 'I'];
  const ROLE_COLORS: Record<string, string> = { R: '#4a9eff', A: '#ef4444', C: '#f5a623', I: '#8896a8' };
  const ROLE_LABELS: Record<string, string> = { R: 'Responsible', A: 'Accountable', C: 'Consulted', I: 'Informed' };

  const getCell = (discipline: string, userId: string) => raci.find(r => r.discipline === discipline && String(r.user_id) === String(userId))?.role || '';

  const setCell = async (discipline: string, userId: string, role: string) => {
    const existing = raci.find(r => r.discipline === discipline && String(r.user_id) === String(userId));
    if (role === '') {
      if (existing) {
        await fetch(`${process.env.REACT_APP_SUPABASE_URL}/rest/v1/raci?id=eq.${existing.id}`, {
          method: 'DELETE',
          headers: { apikey: process.env.REACT_APP_SUPABASE_ANON_KEY || '', Authorization: `Bearer ${token}` },
        });
        setRaci(prev => prev.filter(r => r.id !== existing.id));
      }
      return;
    }
    const body = { project_id: projectId, discipline, user_id: userId, role };
    if (existing) {
      await fetch(`${process.env.REACT_APP_SUPABASE_URL}/rest/v1/raci?id=eq.${existing.id}`, {
        method: 'PATCH',
        headers: { apikey: process.env.REACT_APP_SUPABASE_ANON_KEY || '', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ role }),
      });
      setRaci(prev => prev.map(r => r.id === existing.id ? { ...r, role } : r));
    } else {
      const res = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/rest/v1/raci`, {
        method: 'POST',
        headers: { apikey: process.env.REACT_APP_SUPABASE_ANON_KEY || '', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(body),
      });
      const inserted = await res.json();
      if (Array.isArray(inserted)) setRaci(prev => [...prev, ...inserted]);
    }
  };

  const disciplines = depts?.length > 0 ? depts : ['АР', 'КМ', 'ОВ', 'ЭО', 'ВК'];

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>📊 Матрица RACI</div>
      <div className="panel-surface" style={{ overflowX: 'auto', padding: 0 }}>
        {loading ? <div style={{ padding: 24, textAlign: 'center', color: C.textMuted }}>Загрузка...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.surface2 }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>Дисциплина</th>
                {leads.map((u: any) => (
                  <th key={u.id} style={{ padding: '10px 12px', textAlign: 'center', color: C.textMuted, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap', fontWeight: 400 }}>
                    {(u.full_name || '').split(' ')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {disciplines.map((d: string) => (
                <tr key={d}>
                  <td style={{ padding: '9px 14px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, color: C.text }}>{d}</td>
                  {leads.map((u: any) => {
                    const v = getCell(d, u.id);
                    return (
                      <td key={u.id} style={{ padding: '6px 10px', borderBottom: `1px solid ${C.border}`, textAlign: 'center' }}>
                        <select
                          value={v}
                          onChange={e => setCell(d, u.id, e.target.value)}
                          style={{ background: v ? ROLE_COLORS[v] + '20' : C.surface2, color: v ? ROLE_COLORS[v] : C.textMuted, border: `1px solid ${v ? ROLE_COLORS[v] + '50' : C.border}`, borderRadius: 6, padding: '3px 6px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: v ? 700 : 400 }}
                          title={v ? ROLE_LABELS[v] : 'Не назначено'}
                        >
                          <option value="">—</option>
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ padding: '10px 14px', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {ROLES.map(r => (
            <span key={r} style={{ fontSize: 11, color: ROLE_COLORS[r] }}><b>{r}</b> — {ROLE_LABELS[r]}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── G5: Budget / Hours ────────────────────────────────────────────────────────
function BudgetHours({ tasks, appUsers, C, token, projectId }: any) {
  const [timeEntries, setTimeEntries] = useState<any[]>([]);

  useEffect(() => {
    get(`time_entries?project_id=eq.${projectId}&select=user_id,hours,dept`, token).then(d => {
      if (Array.isArray(d)) setTimeEntries(d);
    }).catch(() => {});
  }, [projectId]);

  const deptActual: Record<string, number> = {};
  timeEntries.forEach(e => {
    const dept = e.dept || 'Прочее';
    deptActual[dept] = (deptActual[dept] || 0) + (e.hours || 0);
  });

  const deptPlanned: Record<string, number> = {};
  tasks.forEach((t: any) => {
    if (t.dept && t.planned_hours) {
      deptPlanned[t.dept] = (deptPlanned[t.dept] || 0) + t.planned_hours;
    }
  });

  const allDepts = [...new Set([...Object.keys(deptActual), ...Object.keys(deptPlanned)])];
  const totalActual = Object.values(deptActual).reduce((a, b) => a + b, 0);
  const totalPlanned = Object.values(deptPlanned).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>⏱ Бюджет человеко-часов</div>
      <div className="panel-surface" style={{ padding: 14 }}>
        {allDepts.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Нет данных по трудозатратам</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {[{ label: 'Фактические часы', value: totalActual.toFixed(1), color: '#4a9eff' }, { label: 'Плановые часы', value: totalPlanned > 0 ? totalPlanned.toFixed(1) : '—', color: '#a855f7' }].map(({ label, value, color }) => (
                <div key={label} style={{ background: C.surface2, borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{label}</div>
                </div>
              ))}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Отдел', 'Факт (ч)', 'План (ч)', 'Загрузка'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: C.textMuted, borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allDepts.map(dept => {
                  const actual = deptActual[dept] || 0;
                  const planned = deptPlanned[dept] || 0;
                  const pct = planned > 0 ? Math.round((actual / planned) * 100) : null;
                  return (
                    <tr key={dept}>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, color: C.text }}>{dept}</td>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, color: '#4a9eff', fontWeight: 600 }}>{actual.toFixed(1)}</td>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, color: '#a855f7' }}>{planned > 0 ? planned.toFixed(1) : '—'}</td>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}` }}>
                        {pct !== null ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 8, background: C.border, borderRadius: 4, overflow: 'hidden', minWidth: 60 }}>
                              <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct > 100 ? '#ef4444' : pct > 80 ? '#f5a623' : '#4a9eff' }} />
                            </div>
                            <span style={{ fontSize: 11, color: pct > 100 ? '#ef4444' : C.textMuted }}>{pct}%</span>
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

// ── R1: Team Workload Calendar ────────────────────────────────────────────────
function TeamWorkload({ tasks, appUsers, C }: any) {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const engineers = appUsers.filter((u: any) => u.role === 'engineer' || u.role === 'lead');
  const activeTasks = tasks.filter((t: any) => !['done', 'todo'].includes(t.status) && t.deadline);

  const getHeat = (userId: string, day: Date) => {
    return activeTasks.filter((t: any) => {
      if (String(t.assigned_to) !== String(userId)) return false;
      const dl = new Date(t.deadline);
      const start = new Date(dl.getTime() - 7 * 86400000);
      return day >= start && day <= dl;
    }).length;
  };

  const heatColor = (n: number) => {
    if (n === 0) return C.surface2;
    if (n === 1) return '#4a9eff30';
    if (n === 2) return '#4a9eff60';
    if (n === 3) return '#f5a62380';
    return '#ef444480';
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>👥 Загруженность команды (текущая неделя)</div>
      <div className="panel-surface" style={{ overflowX: 'auto', padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: C.surface2 }}>
              <th style={{ padding: '9px 12px', textAlign: 'left', color: C.textMuted, borderBottom: `1px solid ${C.border}`, minWidth: 120 }}>Сотрудник</th>
              {days.map((d, i) => (
                <th key={i} style={{ padding: '9px 10px', textAlign: 'center', color: d.toDateString() === today.toDateString() ? C.accent : C.textMuted, borderBottom: `1px solid ${C.border}`, fontWeight: d.toDateString() === today.toDateString() ? 700 : 400 }}>
                  {DAY_LABELS[i]}<br />{d.getDate()}.{String(d.getMonth() + 1).padStart(2, '0')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {engineers.slice(0, 12).map((u: any) => (
              <tr key={u.id}>
                <td style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, color: C.text, fontWeight: 500 }}>
                  {(u.full_name || '').split(' ').slice(0, 2).join(' ')}
                </td>
                {days.map((d, i) => {
                  const n = getHeat(u.id, d);
                  return (
                    <td key={i} title={n > 0 ? `${n} задач в работе` : 'Свободен'} style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'center', background: heatColor(n) }}>
                      {n > 0 && <span style={{ fontSize: 11, color: n >= 3 ? '#ef4444' : '#4a9eff', fontWeight: 600 }}>{n}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '8px 12px', display: 'flex', gap: 14, fontSize: 11, color: C.textMuted, flexWrap: 'wrap' }}>
          {[['🟦', '1 задача'], ['🟧', '2-3 задачи'], ['🟥', '4+ задачи']].map(([icon, label]) => (
            <span key={label}>{icon} {label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main GipDashboard export ──────────────────────────────────────────────────
interface GipDashboardProps {
  project: any;
  tasks: any[];
  reviews: any[];
  drawings: any[];
  appUsers: any[];
  depts: string[];
  C: any;
  token: string;
}

export function GipDashboard({ project, tasks, reviews, drawings, appUsers, depts, C, token }: GipDashboardProps) {
  const [tab, setTab] = useState<'risks' | 'scurve' | 'raci' | 'budget' | 'workload'>('risks');

  const TABS = [
    { id: 'risks', label: '⚠️ Риски' },
    { id: 'scurve', label: '📈 S-кривая' },
    { id: 'raci', label: '📊 RACI' },
    { id: 'budget', label: '⏱ Бюджет' },
    { id: 'workload', label: '👥 Команда' },
  ] as const;

  return (
    <div className="screen-fade">
      {/* Tab strip */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, background: tab === t.id ? C.accent : C.surface2, color: tab === t.id ? '#fff' : C.textMuted, transition: 'all 0.15s' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'risks' && <RiskDashboard tasks={tasks} reviews={reviews} project={project} C={C} />}
      {tab === 'scurve' && <SCurve tasks={tasks} C={C} />}
      {tab === 'raci' && <RACIMatrix appUsers={appUsers} depts={depts} C={C} token={token} projectId={project?.id} />}
      {tab === 'budget' && <BudgetHours tasks={tasks} appUsers={appUsers} C={C} token={token} projectId={project?.id} />}
      {tab === 'workload' && <TeamWorkload tasks={tasks} appUsers={appUsers} C={C} />}
    </div>
  );
}
