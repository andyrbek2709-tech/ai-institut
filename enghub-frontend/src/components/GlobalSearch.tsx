import { useState, useEffect, useRef } from 'react';
import { globalSearch } from '../api/supabase';

interface GlobalSearchProps {
  token: string;
  C: any;
  onSelect: (type: string, item: any) => void;
  projects?: any[];
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'В очереди', inprogress: 'В работе', review_lead: 'Проверка',
  review_gip: 'Проверка ГИПа', revision: 'Доработка', done: 'Готово',
  active: 'Активный', archived: 'Архив', draft: 'Черновик',
  open: 'Открыто', closed: 'Закрыто', rejected: 'Отклонено',
};

function dedup<T extends { id: any }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter(item => {
    const key = String(item.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function GlobalSearch({ token, C, onSelect, projects = [] }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const RECENT_KEY = 'enghub_recent_searches';

  const readRecentSearches = () => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setRecentSearches(parsed.filter(Boolean).slice(0, 8));
    } catch {
      setRecentSearches([]);
    }
  };

  const saveRecentSearch = (value: string) => {
    const next = [value, ...recentSearches.filter((s) => s !== value)].slice(0, 8);
    setRecentSearches(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    readRecentSearches();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setSelectedIndex(-1);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(false);
      try {
        const raw = await globalSearch(query, token);
        const data = {
          projects: dedup(Array.isArray(raw.projects) ? raw.projects : []),
          tasks: dedup(Array.isArray(raw.tasks) ? raw.tasks : []),
          drawings: dedup(Array.isArray(raw.drawings) ? raw.drawings : []),
          reviews: dedup(Array.isArray(raw.reviews) ? raw.reviews : []),
        };
        setResults(data);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (e) {
        console.error(e);
        setSearchError(true);
        setResults(null);
      }
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query, token]);

  const groupedItems = !results
    ? []
    : (Object.entries(results) as Array<[string, any[]]>).flatMap(([type, items]) =>
        (Array.isArray(items) ? items : []).map((item) => ({ type, item }))
      );

  const handleEnterSelect = () => {
    if (selectedIndex < 0 || selectedIndex >= groupedItems.length) return;
    const selected = groupedItems[selectedIndex];
    if (!selected) return;
    if (selected.type === 'reviews') {
      onSelect('drawings', { project_id: selected.item.project_id });
    } else {
      onSelect(selected.type, selected.item);
    }
    if (query.trim()) saveRecentSearch(query.trim());
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(-1);
  };

  return (
    <div className="global-search-container" ref={containerRef} style={{ position: 'relative', width: 280 }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: C.textMuted }}>🔍</span>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (!isOpen) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelectedIndex((prev) => (groupedItems.length === 0 ? -1 : Math.min(prev + 1, groupedItems.length - 1)));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelectedIndex((prev) => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              handleEnterSelect();
            } else if (e.key === 'Escape') {
              setQuery('');
              setIsOpen(false);
              setSelectedIndex(-1);
            }
          }}
          placeholder="Поиск везде..."
          style={{
            width: '100%',
            padding: '10px 12px 10px 36px',
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.surface2,
            color: C.text,
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
        {searching && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.accent }}>●</span>}
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '120%',
          left: 0,
          right: 0,
          background: C.surface,
          borderRadius: 12,
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          border: `1px solid ${C.border}`,
          zIndex: 1000,
          maxHeight: 400,
          overflow: 'auto',
          padding: 8
        }}>
          {!query.trim() && recentSearches.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, padding: '4px 10px', textTransform: 'uppercase' }}>Недавние запросы</div>
              {recentSearches.map((q) => (
                <div
                  key={q}
                  onClick={() => { setQuery(q); inputRef.current?.focus(); }}
                  style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: C.text }}
                  onMouseEnter={(e) => e.currentTarget.style.background = C.surface2}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {q}
                </div>
              ))}
            </div>
          )}

          {query.trim() && results && Object.entries(results).map(([type, items]: [string, any]) => {
            if (!items || items.length === 0) return null;
            const labels: any = { projects: "Проекты", tasks: "Задачи", drawings: "Чертежи", reviews: "Замечания" };
            return (
              <div key={type} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, padding: '4px 10px', textTransform: 'uppercase' }}>{labels[type]}</div>
                {items.map((item: any) => {
                  const flatIndex = groupedItems.findIndex((it) => it.type === type && String(it.item.id) === String(item.id));
                  const isActive = flatIndex === selectedIndex;
                  const line1 = item.name || item.title || item.code || item.id;
                  const projCode = projects.find((p: any) => p.id === item.project_id)?.code || `#${item.project_id || '—'}`;
                  const line2 = type === 'projects'
                    ? `${item.code || '—'} • ${STATUS_LABELS[item.status] || item.status || 'Активный'}`
                    : type === 'tasks'
                      ? `${item.dept || 'Без отдела'} • ${STATUS_LABELS[item.status] || item.status} • ${projCode}`
                      : type === 'drawings'
                        ? `${item.code || '—'} • ${item.discipline || '—'} • ${projCode}`
                        : `${STATUS_LABELS[item.status] || item.status || 'Открыто'} • ${item.severity || 'major'} • ${projCode}`;
                  return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (type === 'reviews') {
                        onSelect('drawings', { project_id: item.project_id });
                      } else {
                        onSelect(type, item);
                      }
                      if (query.trim()) saveRecentSearch(query.trim());
                      setIsOpen(false);
                      setQuery("");
                      setSelectedIndex(-1);
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      background: isActive ? C.surface2 : 'transparent',
                      transition: 'background 0.2s',
                      textDecoration: 'none'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = C.surface2}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{line1}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={line2}>
                      {line2}
                    </div>
                  </div>
                )})}
              </div>
            );
          })}
          {query.trim() && results && Object.values(results).every((arr: any) => arr.length === 0) && (
            <div style={{ padding: 20, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Ничего не найдено</div>
          )}
          {query.trim() && searchError && (
            <div style={{ padding: 20, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Ошибка поиска</div>
          )}
          {!query.trim() && recentSearches.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Введите запрос для глобального поиска</div>
          )}
        </div>
      )}
    </div>
  );
}
