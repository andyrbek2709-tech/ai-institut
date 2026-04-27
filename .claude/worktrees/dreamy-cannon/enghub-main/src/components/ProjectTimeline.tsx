import { useMemo } from 'react';

interface ProjectTimelineProps {
  tasks: any[];
  project: any;
  C: any;
}

const STATUS_COLOR: Record<string, string> = {
  done: '#2ac769',
  review_gip: '#a855f7',
  review_lead: '#a855f7',
  inprogress: '#4a9eff',
  revision: '#f5a623',
  todo: '#8896a8',
};

export function ProjectTimeline({ tasks, project, C }: ProjectTimelineProps) {
  const today = new Date();

  const { lanes, minDate, maxDate, totalDays } = useMemo(() => {
    // Group tasks by dept
    const deptMap: Record<string, any[]> = {};
    tasks.forEach(t => {
      const dept = t.dept || 'Без отдела';
      if (!deptMap[dept]) deptMap[dept] = [];
      deptMap[dept].push(t);
    });

    const tasksWithDates = tasks.filter(t => t.deadline);
    const deadlines = tasksWithDates.map(t => new Date(t.deadline).getTime());

    let min = deadlines.length > 0 ? Math.min(...deadlines) : today.getTime();
    let max = deadlines.length > 0 ? Math.max(...deadlines) : today.getTime() + 30 * 86400000;

    // extend range: 2 weeks before min, 2 weeks after max
    min = Math.min(min, today.getTime()) - 14 * 86400000;
    max = max + 14 * 86400000;

    const total = Math.max((max - min) / 86400000, 1);

    const lanes = Object.entries(deptMap).map(([dept, dTasks]) => ({
      dept,
      tasks: dTasks,
    }));

    return { lanes, minDate: min, maxDate: max, totalDays: total };
  }, [tasks]);

  const pct = (ts: number) => Math.max(0, Math.min(100, ((ts - minDate) / (maxDate - minDate)) * 100));
  const todayPct = pct(today.getTime());

  // Generate month ticks
  const months: { label: string; pct: number }[] = [];
  const d = new Date(minDate);
  d.setDate(1);
  while (d.getTime() < maxDate) {
    months.push({
      label: d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
      pct: pct(d.getTime()),
    });
    d.setMonth(d.getMonth() + 1);
  }

  if (tasks.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 14 }}>
        Нет задач с дедлайнами для отображения Timeline
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', userSelect: 'none' }}>
      {/* Month axis */}
      <div style={{ position: 'relative', height: 24, marginLeft: 120, marginBottom: 4, borderBottom: `1px solid ${C.border}` }}>
        {months.map((m, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${m.pct}%`,
            fontSize: 10, color: C.textMuted, whiteSpace: 'nowrap',
            transform: 'translateX(-50%)',
          }}>
            {m.label}
          </div>
        ))}
      </div>

      {/* Lanes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lanes.map(lane => (
          <div key={lane.dept} style={{ display: 'flex', alignItems: 'center', gap: 0, minHeight: 36 }}>
            {/* Dept label */}
            <div style={{
              width: 120, minWidth: 120, fontSize: 11, fontWeight: 600,
              color: C.textMuted, paddingRight: 10, textAlign: 'right',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {lane.dept}
            </div>

            {/* Bar area */}
            <div style={{ flex: 1, position: 'relative', height: 36, background: C.surface2, borderRadius: 6, overflow: 'hidden' }}>
              {/* Today line */}
              <div style={{
                position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0,
                width: 2, background: '#ef4444', opacity: 0.8, zIndex: 10,
              }} />

              {/* Task bars */}
              {lane.tasks.filter(t => t.deadline).map(t => {
                const endTs = new Date(t.deadline).getTime();
                const startTs = endTs - 7 * 86400000; // estimated 7 days width
                const left = pct(startTs);
                const right = pct(endTs);
                const width = Math.max(right - left, 1.5);
                const color = STATUS_COLOR[t.status] || '#8896a8';
                const isOverdue = endTs < today.getTime() && t.status !== 'done';

                return (
                  <div
                    key={t.id}
                    title={`${t.name}\nДедлайн: ${new Date(t.deadline).toLocaleDateString('ru-RU')}\nСтатус: ${t.status}`}
                    style={{
                      position: 'absolute',
                      left: `${left}%`,
                      width: `${width}%`,
                      top: '20%',
                      height: '60%',
                      background: isOverdue ? '#ef4444' : color,
                      borderRadius: 4,
                      opacity: t.status === 'done' ? 0.5 : 0.85,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 4,
                      overflow: 'hidden',
                      minWidth: 4,
                    }}
                  >
                    {width > 8 && (
                      <span style={{ fontSize: 9, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                        {t.name}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Tasks without deadline - show as dots */}
              {lane.tasks.filter(t => !t.deadline).map((t, i) => (
                <div
                  key={t.id}
                  title={`${t.name} (нет дедлайна)`}
                  style={{
                    position: 'absolute',
                    right: 4 + i * 12,
                    top: '30%',
                    width: 8, height: 8,
                    borderRadius: '50%',
                    background: STATUS_COLOR[t.status] || '#8896a8',
                    opacity: 0.6,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        {[
          { color: '#2ac769', label: 'Готово' },
          { color: '#4a9eff', label: 'В работе' },
          { color: '#a855f7', label: 'На проверке' },
          { color: '#f5a623', label: 'Доработка' },
          { color: '#8896a8', label: 'В очереди' },
          { color: '#ef4444', label: 'Просрочено' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.textMuted }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            {label}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.textMuted }}>
          <div style={{ width: 2, height: 12, background: '#ef4444' }} />
          Сегодня
        </div>
      </div>
    </div>
  );
}
