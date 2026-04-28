import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import { del, get, patch, post } from '../api/supabase';
import {
  buildSpecificationPayload,
  computeSheetTotals,
  DEFAULT_ROWS_PER_PAGE,
  SPEC_LIMITS,
} from '../specifications/specificationPayload';

interface Props {
  C: any;
  token: string;
  project: any;
  projects: any[];
  onProjectChange: (project: any) => void;
  currentUser: any;
  isGip: boolean;
  isLead: boolean;
}

type Stamp = {
  project_code: string;
  object_name: string;
  system_name: string;
  stage: string;
  sheet: string;
  total_sheets: string;
  author: string;
  checker: string;
  control: string;
  approver: string;
  date: string;
};

const emptyStamp = (): Stamp => ({
  project_code: '',
  object_name: '',
  system_name: '',
  stage: 'РП',
  sheet: '1',
  total_sheets: '1',
  author: '',
  checker: '',
  control: '',
  approver: '',
  date: new Date().toISOString().slice(0, 10),
});

function normalizeStamp(raw: any): Stamp {
  const s = raw || {};
  return {
    project_code: String(s.project_code ?? s.projectCode ?? ''),
    object_name: String(s.object_name ?? s.objectName ?? ''),
    system_name: String(s.system_name ?? s.systemName ?? ''),
    stage: String(s.stage ?? 'РП') || 'РП',
    sheet: String(s.sheet ?? '1') || '1',
    total_sheets: String(s.total_sheets ?? s.sheets ?? '1') || '1',
    author: String(s.author ?? s.developedBy ?? ''),
    checker: String(s.checker ?? s.checkedBy ?? ''),
    control: String(s.control ?? s.normControlBy ?? ''),
    approver: String(s.approver ?? s.approvedBy ?? ''),
    date: String(s.date ?? new Date().toISOString().slice(0, 10)),
  };
}

function inferUnitFromText(name: string, typeMark: string, currentUnit?: string): string {
  const u = String(currentUnit || '').trim();
  if (u) return u;
  const txt = `${name || ''} ${typeMark || ''}`.toLowerCase();
  if (txt.includes('бетон')) return 'м3';
  if (txt.includes('труб')) return 'м';
  if (txt.includes('кабел')) return 'м';
  if (txt.includes('краск') || txt.includes('грунт')) return 'кг';
  return 'шт';
}

function inferPlantFromCatalog(name: string, typeMark: string, _code: string, currentPlant?: string): string {
  const existing = String(currentPlant || '').trim();
  if (existing) return existing;
  const txt = `${name || ''} ${typeMark || ''}`;
  const lower = txt.toLowerCase();
  const markers = ['завод', 'производитель', 'изготовитель'];
  for (const m of markers) {
    const idx = lower.indexOf(m);
    if (idx >= 0) {
      const tail = txt.slice(idx).replace(/^[^:]*:\s*/i, '').trim();
      if (tail) return tail.slice(0, 80);
    }
  }
  return '';
}

const ROWS_PER_PAGE = DEFAULT_ROWS_PER_PAGE;

function AutoTextarea({
  value,
  onChange,
  style,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  style: React.CSSProperties;
  invalid?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(40, el.scrollHeight)}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...style,
        resize: 'none',
        overflow: 'hidden',
        minHeight: 40,
        border: invalid ? '1px solid #c0392b' : style.border,
      }}
    />
  );
}

export function SpecificationsTab({ C, token, project, projects, onProjectChange, currentUser, isGip, isLead }: Props) {
  const [catalogs, setCatalogs] = useState<any[]>([]);
  const [activeCatalogId, setActiveCatalogId] = useState<string>('');
  const [sections, setSections] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');

  const [specs, setSpecs] = useState<any[]>([]);
  const [specId, setSpecId] = useState<string>('');
  const [specRows, setSpecRows] = useState<any[]>([]);
  const [specName, setSpecName] = useState('Спецификация оборудования');
  const [stamp, setStamp] = useState<Stamp>(emptyStamp);

  const [saving, setSaving] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [specStatus, setSpecStatus] = useState<'Заполняется' | 'Сформировано' | 'Завершено'>('Заполняется');

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutosave = useRef(true);
  const prevProjectId = useRef<string | null>(null);

  const inp = useMemo(
    () => ({
      width: '100%',
      background: C.surface2,
      color: C.text,
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      padding: '6px 8px',
      fontSize: 11,
      outline: 'none',
      boxSizing: 'border-box' as const,
    }),
    [C]
  );

  const stampWithSheets = useMemo(() => {
    const t = computeSheetTotals(specRows.length, ROWS_PER_PAGE);
    return { ...stamp, sheet: t.sheet, total_sheets: t.total_sheets };
  }, [stamp, specRows.length]);

  const effectiveStamp = useMemo(
    () => ({
      ...stampWithSheets,
      project_code: String(stampWithSheets.project_code || project?.code || '').trim(),
      object_name: String(stampWithSheets.object_name || project?.name || '').trim(),
      system_name: String(stampWithSheets.system_name || '-').trim(),
    }),
    [stampWithSheets, project?.code, project?.name]
  );

  const groupedOptions = useMemo(() => {
    return groups
      .filter((g: any) => !sectionId || String(g.section_id) === String(sectionId))
      .map((g: any) => ({ id: String(g.id), label: String(g.name || '') }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [groups, sectionId]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const loadCatalogData = async () => {
    const c = await get('catalogs?order=catalog_date.desc', token);
    setCatalogs(Array.isArray(c) ? c : []);
    const active = Array.isArray(c) ? c.find((x: any) => x.is_active) : null;
    const nextCatalog = active || (Array.isArray(c) && c[0]);
    if (nextCatalog) setActiveCatalogId(String(nextCatalog.id));
  };

  const loadSpecs = async () => {
    if (!project?.id || !currentUser?.id) return;
    const rows = await get(
      `specifications?project_id=eq.${project.id}&user_id=eq.${currentUser.id}&order=created_at.desc`,
      token
    );
    const list = Array.isArray(rows) ? rows : [];
    setSpecs(list);
    if (list[0] && !specId) {
      setSpecId(String(list[0].id));
      setSpecName(list[0].name || 'Спецификация оборудования');
      setStamp(normalizeStamp(list[0].stamp));
    } else if (!list.length) {
      setSpecId('');
      setSpecRows([]);
      setSpecName('Спецификация оборудования');
    }
  };

  const loadCatalogTree = async (catalogId: string) => {
    if (!catalogId) return;
    const s = await get(`sections?catalog_id=eq.${catalogId}&order=sort_order.asc,id.asc&limit=500`, token);
    const allSections = Array.isArray(s) ? s : [];
    setSections(allSections);
    if (!allSections.length) {
      setGroups([]);
      setItems([]);
      return;
    }
    const secIds = allSections.map((x: any) => x.id).join(',');
    const g = await get(`groups?section_id=in.(${secIds})&order=name.asc,id.asc&limit=5000`, token);
    setGroups(Array.isArray(g) ? g : []);
  };

  const loadItems = async () => {
    if (!activeCatalogId) return;
    setItemsLoading(true);
    try {
      const q = debouncedSearch;
      const isGlobalSearch = q.length > 0;
      if (isGlobalSearch) {
        const v = encodeURIComponent(`*${q}*`);
        const i = await get(
          `catalog_items?select=id,group_id,code,name,unit,standard&or=(code.ilike.${v},name.ilike.${v})&order=code.asc&limit=600`,
          token
        );
        const found = Array.isArray(i) ? i : [];
        if (found.length > 0) {
          setItems(found);
          return;
        }
        const ql = q.toLowerCase();
        const matchedSectionIds = sections
          .filter((s: any) => String(s.name || '').toLowerCase().includes(ql))
          .map((s: any) => String(s.id));
        const matchedGroupIds = groups
          .filter(
            (g: any) =>
              String(g.name || '').toLowerCase().includes(ql) || matchedSectionIds.includes(String(g.section_id))
          )
          .map((g: any) => String(g.id));
        if (!matchedGroupIds.length) {
          setItems([]);
          return;
        }
        const fallback = await get(
          `catalog_items?group_id=in.(${matchedGroupIds.slice(0, 1500).join(',')})&select=id,group_id,code,name,unit,standard&order=code.asc&limit=600`,
          token
        );
        setItems(Array.isArray(fallback) ? fallback : []);
        return;
      }

      if (!sectionId) {
        setItems([]);
        return;
      }

      const scopedGroups = groups.filter((g: any) => String(g.section_id) === String(sectionId));
      const groupIds = groupId ? [groupId] : scopedGroups.map((g: any) => String(g.id));
      if (!groupIds.length) {
        setItems([]);
        return;
      }

      const i = await get(
        `catalog_items?group_id=in.(${groupIds.join(',')})&select=id,group_id,code,name,unit,standard&order=code.asc&limit=600`,
        token
      );
      setItems(Array.isArray(i) ? i : []);
    } finally {
      setItemsLoading(false);
    }
  };

  const loadSpecRows = async (id: string) => {
    if (!id) return;
    const rows = await get(`spec_items?spec_id=eq.${id}&order=line_no.asc,id.asc`, token);
    const normalized = Array.isArray(rows)
      ? rows.map((r: any) => ({
          ...r,
          type: String(r.type ?? r.type_mark ?? ''),
          factory: String(r.factory ?? r.plant ?? ''),
          note: String(r.note ?? ''),
        }))
      : [];
    setSpecRows(normalized);
  };

  useEffect(() => {
    loadCatalogData();
    loadSpecs();
  }, [project?.id, currentUser?.id]);

  useEffect(() => {
    if (activeCatalogId) loadCatalogTree(activeCatalogId);
  }, [activeCatalogId]);

  useEffect(() => {
    void loadItems();
  }, [activeCatalogId, sectionId, groupId, debouncedSearch, groups.length]);

  useEffect(() => {
    if (specId) loadSpecRows(specId);
  }, [specId]);

  useEffect(() => {
    if (!selectedItemId) return;
    void addItemToSpec();
  }, [selectedItemId]); // eslint-disable-line

  useEffect(() => {
    if (!project?.id) return;
    const pid = String(project.id);
    if (prevProjectId.current === null) {
      prevProjectId.current = pid;
      return;
    }
    if (prevProjectId.current !== pid) {
      prevProjectId.current = pid;
      setSpecId('');
      setSpecRows([]);
      setStamp({
        ...emptyStamp(),
        project_code: project.code || '',
        object_name: project.name || '',
        author: currentUser?.full_name || '',
        date: new Date().toISOString().slice(0, 10),
      });
    }
  }, [project?.id, project?.code, project?.name, currentUser?.full_name]);

  useEffect(() => {
    if (!project?.id || specId) return;
    setStamp((s) => ({
      ...s,
      project_code: s.project_code || project.code || '',
      object_name: s.object_name || project.name || '',
      author: s.author || currentUser?.full_name || '',
      date: s.date || new Date().toISOString().slice(0, 10),
    }));
  }, [project?.id, project?.code, project?.name, specId, currentUser?.full_name]);

  useEffect(() => {
    skipAutosave.current = true;
    const t = setTimeout(() => {
      skipAutosave.current = false;
    }, 500);
    return () => clearTimeout(t);
  }, [specId]);

  const saveSpecMeta = useCallback(async () => {
    if (!specId) return;
    setSaving(true);
    try {
      await patch(
        `specifications?id=eq.${specId}`,
        { name: specName, stamp: stampWithSheets },
        token
      );
      setStatus('Сохранено');
      setTimeout(() => setStatus(''), 1500);
    } finally {
      setSaving(false);
    }
  }, [specId, specName, stampWithSheets, token]);

  useEffect(() => {
    if (!specId || skipAutosave.current) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void saveSpecMeta();
    }, 2000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [specId, specName, stampWithSheets, saveSpecMeta]);

  const ensureSpec = async (): Promise<string | null> => {
    if (specId) return specId;
    if (!project?.id) return null;
    const created = await post(
      'specifications',
      {
        user_id: currentUser?.id || null,
        project_id: project.id,
        name: specName || 'Спецификация оборудования',
        catalog_id: activeCatalogId ? Number(activeCatalogId) : null,
        created_by: currentUser?.id || null,
        stamp: stampWithSheets,
      },
      token
    );
    const id = String((Array.isArray(created) ? created[0] : created)?.id || '');
    if (!id) return null;
    setSpecId(id);
    await loadSpecs();
    return id;
  };

  const renumberLines = async (sid: string) => {
    const rows = await get(`spec_items?spec_id=eq.${sid}&order=line_no.asc,id.asc`, token);
    if (!Array.isArray(rows)) return;
    await Promise.all(
      rows.map((r: any, i: number) => patch(`spec_items?id=eq.${r.id}`, { line_no: i + 1 }, token))
    );
    await loadSpecRows(sid);
  };

  const addItemToSpec = async () => {
    if (!selectedItemId) return;
    const sid = await ensureSpec();
    if (!sid) return;
    const item = items.find((x: any) => String(x.id) === String(selectedItemId));
    if (!item) return;
    const inferredUnit = inferUnitFromText(String(item.name || ''), String(item.standard || ''), String(item.unit || ''));
    const nextLine = (specRows[specRows.length - 1]?.line_no || 0) + 1;
    await post(
      'spec_items',
      {
        spec_id: Number(sid),
        line_no: nextLine,
        item_id: item.id ? Number(item.id) : null,
        name: item.name,
        type: item.standard || '',
        code: item.code,
        factory: inferPlantFromCatalog(
          String(item.name || ''),
          String(item.standard || ''),
          String(item.code || ''),
          String((item as any).plant || '')
        ),
        unit: inferredUnit,
        qty: 1,
        note: '',
      },
      token
    );
    setSelectedItemId('');
    await loadSpecRows(sid);
  };

  const updateRow = async (row: any, data: any) => {
    await patch(`spec_items?id=eq.${row.id}`, data, token);
    await loadSpecRows(specId);
  };

  const removeRow = async (row: any) => {
    if (!specId) return;
    await del(`spec_items?id=eq.${row.id}`, token);
    await renumberLines(specId);
  };

  const clearAllRows = async () => {
    if (!specId || specRows.length === 0) {
      setSpecRows([]);
      return;
    }
    setSaving(true);
    try {
      for (const r of specRows) {
        await del(`spec_items?id=eq.${r.id}`, token);
      }
      await loadSpecRows(specId);
      setStatus('Таблица очищена');
      setTimeout(() => setStatus(''), 1500);
    } finally {
      setSaving(false);
    }
  };

  const createNewSpec = async () => {
    const created = await post(
      'specifications',
      {
        user_id: currentUser?.id || null,
        project_id: project.id,
        name: `Спецификация ${new Date().toLocaleDateString('ru-RU')}`,
        catalog_id: activeCatalogId ? Number(activeCatalogId) : null,
        created_by: currentUser?.id || null,
        stamp: {
          ...stampWithSheets,
          project_code: project?.code || '',
          object_name: project?.name || '',
        },
      },
      token
    );
    const id = String((Array.isArray(created) ? created[0] : created)?.id || '');
    if (id) {
      setSpecId(id);
      await loadSpecs();
      await loadSpecRows(id);
    }
  };

  const rowsForExport = useMemo(() => {
    return specRows.map((r: any) => ({
      ...r,
      // Carry catalog reference all the way to the server so it can mark
      // catalog rows visually in Excel.
      item_id: r.item_id ?? r.itemId ?? null,
      type_mark: String(r.type || ''),
      plant: inferPlantFromCatalog(
        String(r.name || ''),
        String(r.type || ''),
        String(r.code || ''),
        String(r.factory || '')
      ),
      note: String(r.note || ''),
      unit: inferUnitFromText(String(r.name || ''), String(r.type || ''), String(r.unit || '')),
    }));
  }, [specRows]);

  const validateBeforePrepare = (): string[] => {
    const errors: string[] = [];
    const hasEmptyName = rowsForExport.some((r: any) => !String(r.name || '').trim());
    if (hasEmptyName) errors.push('Есть пустые строки: заполните поле "Наименование".');
    const hasZeroQty = rowsForExport.some((r: any) => Number(r.qty || 0) <= 0);
    if (hasZeroQty) errors.push('Есть позиции с количеством 0.');
    return errors;
  };

  const warningCount = useMemo(() => {
    return rowsForExport.filter(
      (r: any) =>
        String(r.name || '').length > SPEC_LIMITS.name ||
        String(r.type || '').length > SPEC_LIMITS.typeMark ||
        String(r.plant || '').length > SPEC_LIMITS.factory
    ).length;
  }, [rowsForExport]);

  const onDownloadExcel = async () => {
    const errors = validateBeforePrepare();
    if (errors.length) {
      window.alert(`Нельзя подготовить данные:\n\n- ${errors.join('\n- ')}`);
      return;
    }
    if (warningCount > 0) {
      const ok = window.confirm(
        `Есть предупреждения по длине текста в ${warningCount} строк(ах).\nПродолжить формирование Excel?`
      );
      if (!ok) return;
    }

    const payload = buildSpecificationPayload(effectiveStamp, rowsForExport, ROWS_PER_PAGE);
    const exportDate = String(effectiveStamp.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const exportCode = String(effectiveStamp.project_code || project?.code || 'SPEC').replace(/[^\wА-Яа-я.-]+/g, '_');
    const downloadName = `${exportCode}_Спец_${exportDate}.xlsx`;
    setExcelLoading(true);
    try {
      const resp = await fetch('/api/spec-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Server verifies this Bearer token against Supabase auth and looks
          // up the user's role/dept in app_users before generating the file.
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...payload,
          project_id: project?.id ?? null,
          catalog_id: activeCatalogId ? Number(activeCatalogId) : null,
          project: { id: project?.id ?? null, code: project?.code || '', name: project?.name || '' },
        }),
      });
      if (!resp.ok) {
        let detail = `HTTP ${resp.status}`;
        try {
          const text = await resp.text();
          if (text) {
            try {
              const parsed = JSON.parse(text);
              if (parsed?.error) detail = String(parsed.error);
              else detail = text.slice(0, 180);
            } catch {
              detail = text.slice(0, 180);
            }
          }
        } catch {
          // ignore parse error
        }
        throw new Error(detail);
      }
      const blob = await resp.blob();
      saveAs(blob, downloadName);
    } catch (e: any) {
      const msg = String(e?.message || '').trim();
      window.alert(`Не удалось сформировать Excel на сервере.\n${msg ? `Причина: ${msg}` : 'Попробуйте позже.'}`);
    } finally {
      setExcelLoading(false);
    }
  };

  const stampEmpty = (field: keyof Stamp) => !String(stamp[field] || '').trim();

  const previewPages = useMemo(() => {
    const sorted = [...specRows].sort((a: any, b: any) => (a.line_no || 0) - (b.line_no || 0));
    const pages: any[][] = [];
    for (let i = 0; i < sorted.length; i += ROWS_PER_PAGE) {
      pages.push(sorted.slice(i, i + ROWS_PER_PAGE));
    }
    if (!pages.length) pages.push([]);
    return pages;
  }, [specRows]);

  const canManage = isGip || isLead;

  if (!project) return <div className="empty-state">Выберите проект</div>;

  const shortDate = stamp.date ? stamp.date.slice(5, 7) + '.' + stamp.date.slice(2, 4) : '';
  const codeColor = (C as any).accent || '#5b9cf6';

  return (
    <div style={{ display: 'flex', minHeight: 0 }}>
      {/* ═══ ЛЕВАЯ ПАНЕЛЬ ═══ */}
      <div style={{
        width: 210,
        minWidth: 210,
        borderRight: `1px solid ${C.border}`,
        padding: '16px 12px',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        maxHeight: '100vh',
        overflowY: 'auto',
      }}>
        {/* Выбор проекта */}
        <select
          value={project?.id || ''}
          onChange={(e) => {
            const p = projects.find((x: any) => String(x.id) === String(e.target.value));
            if (p) onProjectChange(p);
          }}
          style={{ ...inp, marginBottom: 12, fontSize: 11 }}
        >
          {projects.map((p: any) => (
            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
          ))}
        </select>

        {/* ПРОЕКТ */}
        <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.8, marginBottom: 6, fontWeight: 600 }}>ПРОЕКТ</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 8px', fontSize: 12, marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
          <span style={{ color: C.textMuted }}>Дата</span>
          <span style={{ fontWeight: 600 }}>{new Date().toLocaleDateString('ru-RU')}</span>
          <span style={{ color: C.textMuted }}>Позиций</span>
          <span style={{ fontWeight: 600 }}>{specRows.length}</span>
          <span style={{ color: C.textMuted }}>Оборудование</span>
          <span style={{ fontWeight: 600 }}>{specRows.length}</span>
        </div>

        {/* Главная кнопка */}
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: '100%', fontWeight: 700, padding: '9px 8px', fontSize: 12, marginBottom: 6, borderRadius: 8, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}
          onClick={() => void onDownloadExcel()}
          disabled={excelLoading}
        >
          {excelLoading ? 'Формирование…' : 'Сформировать\nспецификацию'}
        </button>
        <button
          type="button"
          style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', marginBottom: 14, padding: '2px 0', textAlign: 'center', width: '100%' }}
          onClick={() => void clearAllRows()}
        >
          Очистить всё
        </button>

        {/* СТАТУС */}
        <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.8, marginBottom: 8, fontWeight: 600 }}>СТАТУС</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
          {(['Заполняется', 'Сформировано', 'Завершено'] as const).map((s) => (
            <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, cursor: 'pointer' }}>
              <input type="radio" name="specStatus" value={s} checked={specStatus === s} onChange={() => setSpecStatus(s)} />
              <span style={{ color: specStatus === s ? codeColor : C.text, fontWeight: specStatus === s ? 600 : 400 }}>{s}</span>
            </label>
          ))}
        </div>

        {/* ШТАМП СПЕЦИФИКАЦИИ */}
        <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.8, marginBottom: 8, fontWeight: 600 }}>ШТАМП СПЕЦИФИКАЦИИ</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5 }}>ШИФР ПРОЕКТА</div>
          <input style={{ ...inp, borderColor: stampEmpty('project_code') ? '#c0392b' : C.border }}
            value={stamp.project_code} onChange={(e) => setStamp({ ...stamp, project_code: e.target.value })} />

          <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5 }}>НАИМЕНОВАНИЕ ОБЪЕКТА</div>
          <input style={{ ...inp, borderColor: stampEmpty('object_name') ? '#c0392b' : C.border }}
            value={stamp.object_name} onChange={(e) => setStamp({ ...stamp, object_name: e.target.value })} />

          <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5 }}>НАИМЕНОВАНИЕ СИСТЕМЫ</div>
          <input style={{ ...inp, borderColor: stampEmpty('system_name') ? '#c0392b' : C.border }}
            value={stamp.system_name} onChange={(e) => setStamp({ ...stamp, system_name: e.target.value })} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div>
              <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5 }}>СТАДИЯ</div>
              <select style={inp} value={stamp.stage} onChange={(e) => setStamp({ ...stamp, stage: e.target.value })}>
                <option value="РП">РП</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5 }}>ЛИСТ / ЛИСТОВ</div>
              <input style={{ ...inp, opacity: 0.85, cursor: 'not-allowed' }} readOnly
                value={`${stampWithSheets.sheet} / ${stampWithSheets.total_sheets}`} />
            </div>
          </div>

          <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5 }}>РАЗРАБОТАЛ</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px', gap: 4 }}>
            <input style={{ ...inp, borderColor: stampEmpty('author') ? '#c0392b' : C.border }}
              value={stamp.author} placeholder="ФИО" onChange={(e) => setStamp({ ...stamp, author: e.target.value })} />
            <input style={{ ...inp, textAlign: 'center', fontSize: 10 }} value={shortDate} readOnly />
          </div>

          <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5 }}>ПРОВЕРИЛ</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px', gap: 4 }}>
            <input style={{ ...inp, borderColor: stampEmpty('checker') ? '#c0392b' : C.border }}
              value={stamp.checker} placeholder="ФИО" onChange={(e) => setStamp({ ...stamp, checker: e.target.value })} />
            <input style={{ ...inp, textAlign: 'center', fontSize: 10 }} value={shortDate} readOnly />
          </div>

          <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5 }}>Н. КОНТРОЛЬ</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px', gap: 4 }}>
            <input style={inp} value={stamp.control} placeholder="ФИО"
              onChange={(e) => setStamp({ ...stamp, control: e.target.value })} />
            <input style={{ ...inp, textAlign: 'center', fontSize: 10 }} value={shortDate} readOnly />
          </div>

          <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5 }}>УТВЕРДИЛ</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px', gap: 4 }}>
            <input style={inp} value={stamp.approver} placeholder="ФИО"
              onChange={(e) => setStamp({ ...stamp, approver: e.target.value })} />
            <input style={{ ...inp, textAlign: 'center', fontSize: 10 }} value={shortDate} readOnly />
          </div>
        </div>
      </div>

      {/* ═══ ОСНОВНАЯ ОБЛАСТЬ ═══ */}
      <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, overflowY: 'auto' }}>
        {/* Строка поиска */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textMuted, fontSize: 14, pointerEvents: 'none' }}>🔍</span>
            <input
              style={{ ...inp, paddingLeft: 32, fontSize: 13, height: 40, boxSizing: 'border-box' }}
              placeholder="Искать в каталоге АГСК-3 и добавить в спецификацию…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <select
            value={activeCatalogId}
            onChange={(e) => setActiveCatalogId(e.target.value)}
            style={{ ...inp, height: 40, width: 'auto', minWidth: 130, fontSize: 11, boxSizing: 'border-box' }}
          >
            <option value="">— Каталог —</option>
            {catalogs.map((c: any) => (
              <option key={c.id} value={c.id}>{c.version} ({c.catalog_date}){c.is_active ? ' *' : ''}</option>
            ))}
          </select>
        </div>

        {/* Строка дропдаунов */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <select
            value={sectionId}
            onChange={(e) => { setSectionId(e.target.value); setGroupId(''); setSelectedItemId(''); }}
            style={{ ...inp, fontSize: 12 }}
          >
            <option value="">— Раздел АГСК-3 —</option>
            {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            value={groupId}
            onChange={(e) => { setGroupId(e.target.value); setSelectedItemId(''); }}
            style={{ ...inp, fontSize: 12 }}
          >
            <option value="">— Группа —</option>
            {groupedOptions.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            style={{ ...inp, fontSize: 12 }}
          >
            <option value="">— Выбрать из каталога —</option>
            {items.slice(0, 1000).map((it: any) => (
              <option key={it.id} value={it.id}>{it.code} — {it.name}</option>
            ))}
          </select>
        </div>
        {itemsLoading && <div style={{ fontSize: 11, color: C.textMuted }}>Загрузка позиций…</div>}

        {/* Таблица спецификации */}
        {specRows.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: 13, padding: 60 }}>
            Спецификация пуста. Введите наименование оборудования в строке поиска выше.
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: C.text, marginBottom: 6 }}>
              ОБОРУДОВАНИЕ ({specRows.length})
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '44px minmax(120px, 1.4fr) minmax(80px, 0.9fr) 120px minmax(70px, 0.7fr) 52px 88px 44px',
              gap: 6, fontSize: 10, fontWeight: 700, color: C.textMuted,
              padding: '6px 8px', borderBottom: `1px solid ${C.border}`, letterSpacing: 0.4,
            }}>
              <div>№</div>
              <div>СТ.2 НАИМЕНОВАНИЕ</div>
              <div>СТ.3 ТИП, МАРКА</div>
              <div>СТ.4 КОД АГСК-3</div>
              <div>СТ.5 ЗАВОД</div>
              <div>ЕД.</div>
              <div>КОЛ-ВО</div>
              <div />
            </div>
            {[...specRows].sort((a: any, b: any) => (a.line_no || 0) - (b.line_no || 0)).map((r: any, idx: number) => {
              const u = inferUnitFromText(String(r.name || ''), String(r.type || ''), String(r.unit || ''));
              const nameLen = String(r.name || '').length;
              const typeLen = String(r.type || '').length;
              const plantVal = inferPlantFromCatalog(String(r.name || ''), String(r.type || ''), String(r.code || ''), String(r.factory || ''));
              const plantLen = plantVal.length;
              return (
                <div key={r.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '44px minmax(120px, 1.4fr) minmax(80px, 0.9fr) 120px minmax(70px, 0.7fr) 52px 88px 44px',
                  gap: 6, alignItems: 'start',
                  padding: '6px 8px',
                  borderBottom: `1px solid ${C.border}`,
                  background: idx % 2 === 0 ? 'transparent' : C.surface + '80',
                }}>
                  <div style={{ fontSize: 11, paddingTop: 6 }}>{idx + 1}</div>
                  <div>
                    <AutoTextarea value={String(r.name || '')} onChange={(v) => updateRow(r, { name: v })}
                      invalid={!String(r.name || '').trim()}
                      style={{ ...inp, padding: '6px 8px', fontSize: 11, width: '100%', minHeight: 32 }} />
                    {nameLen > SPEC_LIMITS.name && (
                      <div style={{ fontSize: 10, color: '#c0392b' }}>Превышен лимит {SPEC_LIMITS.name} симв.</div>
                    )}
                  </div>
                  <div>
                    <input value={String(r.type || '')} onChange={(e) => updateRow(r, { type: e.target.value })}
                      style={{ ...inp, padding: '6px 8px', fontSize: 11, width: '100%' }} />
                    {typeLen > SPEC_LIMITS.typeMark && (
                      <div style={{ fontSize: 10, color: '#c0392b' }}>Превышен лимит {SPEC_LIMITS.typeMark} симв.</div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, paddingTop: 6, wordBreak: 'break-all', color: codeColor }}>{r.code || ''}</div>
                  <div>
                    <input value={plantVal} onChange={(e) => updateRow(r, { factory: e.target.value })}
                      style={{ ...inp, padding: '6px 8px', fontSize: 11, width: '100%', borderColor: plantLen > SPEC_LIMITS.factory ? '#c0392b' : C.border }} />
                  </div>
                  <div style={{ fontSize: 11, paddingTop: 6 }}>{u}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 28px', gap: 4 }}>
                    <button type="button" className="btn btn-secondary" style={{ padding: 0, height: 28 }}
                      onClick={() => updateRow(r, { qty: Math.max(0, Number(r.qty || 0) - 1) })}>−</button>
                    <input type="number" min={0} value={String(r.qty ?? 0)}
                      onChange={(e) => updateRow(r, { qty: Number(e.target.value || 0) })}
                      style={{ ...inp, textAlign: 'center', padding: '5px 6px' }} />
                    <button type="button" className="btn btn-secondary" style={{ padding: 0, height: 28 }}
                      onClick={() => updateRow(r, { qty: Number(r.qty || 0) + 1 })}>+</button>
                  </div>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => void removeRow(r)}>×</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {previewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: 900,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: 20,
              borderRadius: 14,
              background: C.surface,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Предпросмотр листов</div>
              <button type="button" className="btn btn-secondary" onClick={() => setPreviewOpen(false)}>
                Закрыть
              </button>
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>
              Логическое разбиение: до {ROWS_PER_PAGE} строк на лист (для согласования с печатью). Не является точной копией ГОСТ-макета.
            </div>
            {previewPages.map((pageRows, pi) => (
              <div key={pi} style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
                  Лист {pi + 1} / {previewPages.length} · строки {pi * ROWS_PER_PAGE + 1}–
                  {Math.min((pi + 1) * ROWS_PER_PAGE, specRows.length || ROWS_PER_PAGE)}
                </div>
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1fr 80px 100px 60px',
                      gap: 8,
                      padding: '8px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      background: C.surface2,
                    }}
                  >
                    <div>№</div>
                    <div>Наименование</div>
                    <div>Код</div>
                    <div>Ед.</div>
                    <div>Кол-во</div>
                  </div>
                  {pageRows.map((row: any, ri: number) => {
                    const globalIdx = pi * ROWS_PER_PAGE + ri;
                    return (
                      <div
                        key={row.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '40px 1fr 80px 100px 60px',
                          gap: 8,
                          padding: '8px 10px',
                          fontSize: 12,
                          borderTop: `1px solid ${C.border}`,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        <div>{globalIdx + 1}</div>
                        <div>{row.name || ''}</div>
                        <div style={{ wordBreak: 'break-all' }}>{row.code || ''}</div>
                        <div>{inferUnitFromText(String(row.name || ''), String(row.type || ''), String(row.unit || ''))}</div>
                        <div>{row.qty ?? ''}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
