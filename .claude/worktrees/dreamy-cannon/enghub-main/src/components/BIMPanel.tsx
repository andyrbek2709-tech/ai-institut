import { useState, useRef } from 'react';

interface BIMElement {
  id: string;
  type: string;
  name: string;
  globalId: string;
}

interface BIMPanelProps {
  C: any;
  drawings: any[];
  onLinkDrawing?: (bimElementId: string, drawingId: string) => void;
}

// Simple IFC text parser — extracts IFCSPACE, IFCBEAM, IFCCOLUMN, IFCWALL, IFCSLAB, IFCDOOR, IFCWINDOW
function parseIFC(text: string): BIMElement[] {
  const elements: BIMElement[] = [];
  const TYPES = ['IFCSPACE', 'IFCBEAM', 'IFCCOLUMN', 'IFCWALL', 'IFCSLAB', 'IFCDOOR', 'IFCWINDOW', 'IFCSTAIR', 'IFCROOF', 'IFCPILE'];
  const lines = text.split('\n');
  for (const line of lines) {
    const upper = line.toUpperCase();
    for (const type of TYPES) {
      if (upper.includes(type + '(')) {
        // Extract: #123=IFCWALL('GlobalId',...,'Name',...);
        const idMatch = line.match(/^#(\d+)=/);
        const guidMatch = line.match(/'([0-9A-Za-z$_]{22})'/);
        const nameMatch = line.match(/'([^']{2,60})'/g);
        if (idMatch) {
          const name = nameMatch && nameMatch.length > 1 ? nameMatch[1].replace(/'/g, '') : type.replace('IFC', '');
          elements.push({
            id: idMatch[1],
            type: type.replace('IFC', ''),
            globalId: guidMatch ? guidMatch[1] : idMatch[1],
            name: name || type.replace('IFC', ''),
          });
        }
        break;
      }
    }
    if (elements.length >= 200) break; // cap for performance
  }
  return elements;
}

const TYPE_COLORS: Record<string, string> = {
  SPACE: '#4a9eff', BEAM: '#f5a623', COLUMN: '#a855f7',
  WALL: '#8896a8', SLAB: '#2ac769', DOOR: '#ef4444',
  WINDOW: '#06b6d4', STAIR: '#fbbf24', ROOF: '#10b981', PILE: '#6366f1',
};

export function BIMPanel({ C, drawings, onLinkDrawing }: BIMPanelProps) {
  const [elements, setElements] = useState<BIMElement[]>([]);
  const [filename, setFilename] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [links, setLinks] = useState<Record<string, string>>({}); // bimId → drawingId
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setLoading(true);
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const parsed = parseIFC(text);
      setElements(parsed);
      setLoading(false);
    };
    reader.onerror = () => setLoading(false);
    reader.readAsText(file);
  };

  const setLink = (bimId: string, drawingId: string) => {
    setLinks(prev => ({ ...prev, [bimId]: drawingId }));
    if (onLinkDrawing) onLinkDrawing(bimId, drawingId);
  };

  const filtered = elements.filter(el =>
    !search || el.name.toLowerCase().includes(search.toLowerCase()) || el.type.toLowerCase().includes(search.toLowerCase())
  );

  const summary = elements.reduce((acc, el) => { acc[el.type] = (acc[el.type] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="screen-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>🏗 BIM-интеграция (T7)</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={fileRef}
            type="file"
            accept=".ifc"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
          <button
            className="btn btn-primary"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
          >
            {loading ? '⏳ Парсинг...' : '📂 Загрузить IFC'}
          </button>
        </div>
      </div>

      {filename && (
        <div style={{ background: C.surface2, borderRadius: 8, padding: '8px 14px', fontSize: 12, color: C.textMuted, marginBottom: 14 }}>
          📄 {filename} — {elements.length} элементов обнаружено
        </div>
      )}

      {elements.length === 0 && !loading && (
        <div className="empty-state" style={{ padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏗</div>
          <div style={{ fontSize: 14, color: C.textMuted }}>Загрузите IFC-файл для просмотра элементов модели</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>Поддерживаются форматы IFC 2x3 и IFC 4</div>
        </div>
      )}

      {elements.length > 0 && (
        <>
          {/* Summary chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {Object.entries(summary).map(([type, count]) => (
              <div key={type} style={{ background: (TYPE_COLORS[type] || '#8896a8') + '20', color: TYPE_COLORS[type] || '#8896a8', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
                {type}: {count}
              </div>
            ))}
          </div>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск элемента..."
            style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 13, outline: 'none', width: '100%', marginBottom: 14, fontFamily: 'inherit' }}
          />

          <div className="panel-surface" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.surface2 }}>
                  {['#', 'Тип', 'Наименование', 'GlobalID', 'Связь с чертежом'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: C.textMuted, borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map(el => (
                  <tr key={el.id}>
                    <td style={{ padding: '7px 12px', borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontFamily: 'monospace' }}>#{el.id}</td>
                    <td style={{ padding: '7px 12px', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ background: (TYPE_COLORS[el.type] || '#8896a8') + '20', color: TYPE_COLORS[el.type] || '#8896a8', borderRadius: 5, padding: '2px 6px', fontWeight: 600 }}>{el.type}</span>
                    </td>
                    <td style={{ padding: '7px 12px', borderBottom: `1px solid ${C.border}`, color: C.text }}>{el.name}</td>
                    <td style={{ padding: '7px 12px', borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontFamily: 'monospace', fontSize: 10 }}>{el.globalId.slice(0, 12)}…</td>
                    <td style={{ padding: '7px 12px', borderBottom: `1px solid ${C.border}` }}>
                      <select
                        value={links[el.id] || ''}
                        onChange={e => setLink(el.id, e.target.value)}
                        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 8px', fontSize: 11, color: links[el.id] ? C.accent : C.textMuted, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        <option value="">— Без привязки —</option>
                        {drawings.map(d => <option key={d.id} value={d.id}>{d.code} — {d.title}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
                {filtered.length > 50 && (
                  <tr><td colSpan={5} style={{ padding: '8px 12px', color: C.textMuted, fontStyle: 'italic' }}>...и ещё {filtered.length - 50} элементов (уточните поиск)</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
