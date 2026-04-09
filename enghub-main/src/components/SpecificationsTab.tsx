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

export function SpecificationsTab({ C, token, project, currentUser, isGip, isLead }: Props) {
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

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutosave = useRef(true);
  const prevProjectId = useRef<string | null>(null);

  const inp = useMemo(
    () => ({
      width: '100%',
      background: C.surface2,
      color: C.text,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: '8px 10px',
      fontSize: 12,
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
      // Если пользователь не заполнил систему, подставляем имя проекта как безопасный fallback.
      system_name: String(stampWithSheets.system_name || project?.name || '').trim(),
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
    if (!project?.id) return;
    const rows = await get(`specifications?project_id=eq.${project.id}&order=created_at.desc`, token);
    setSpecs(Array.isArray(rows) ? rows : []);
    if (Array.isArray(rows) && rows[0] && !specId) {
      setSpecId(String(rows[0].id));
      setSpecName(rows[0].name || 'Спецификация оборудования');
      setStamp(normalizeStamp(rows[0].stamp));
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
    const rows = await get(`specification_items?specification_id=eq.${id}&order=line_no.asc,id.asc`, token);
    setSpecRows(Array.isArray(rows) ? rows : []);
  };

  useEffect(() => {
    loadCatalogData();
    loadSpecs();
  }, [project?.id]);

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
    const rows = await get(`specification_items?specification_id=eq.${sid}&order=line_no.asc,id.asc`, token);
    if (!Array.isArray(rows)) return;
    await Promise.all(
      rows.map((r: any, i: number) => patch(`specification_items?id=eq.${r.id}`, { line_no: i + 1 }, token))
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
      'specification_items',
      {
        specification_id: Number(sid),
        line_no: nextLine,
        item_id: item.id,
        name: item.name,
        code: item.code,
        unit: inferredUnit,
        type_mark: item.standard || '',
        plant: inferPlantFromCatalog(
          String(item.name || ''),
          String(item.standard || ''),
          String(item.code || ''),
          String((item as any).plant || '')
        ),
        qty: 1,
      },
      token
    );
    setSelectedItemId('');
    await loadSpecRows(sid);
  };

  const updateRow = async (row: any, data: any) => {
    await patch(`specification_items?id=eq.${row.id}`, data, token);
    await loadSpecRows(specId);
  };

  const removeRow = async (row: any) => {
    if (!specId) return;
    await del(`specification_items?id=eq.${row.id}`, token);
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
        await del(`specification_items?id=eq.${r.id}`, token);
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
      unit: inferUnitFromText(String(r.name || ''), String(r.type_mark || ''), String(r.unit || '')),
      plant: inferPlantFromCatalog(
        String(r.name || ''),
        String(r.type_mark || ''),
        String(r.code || ''),
        String(r.plant || '')
      ),
    }));
  }, [specRows]);

  const validateBeforePrepare = (): string[] => {
    const errors: string[] = [];
    const hasEmptyName = rowsForExport.some((r: any) => !String(r.name || '').trim());
    if (hasEmptyName) errors.push('Есть пустые строки: заполните поле "Наименование".');
    const hasZeroQty = rowsForExport.some((r: any) => Number(r.qty || 0) <= 0);
    if (hasZeroQty) errors.push('Есть позиции с количеством 0.');
    if (!String(effectiveStamp.project_code || '').trim()) errors.push('Не заполнен шифр проекта в штампе.');
    if (!String(effectiveStamp.object_name || '').trim()) errors.push('Не заполнено наименование объекта в штампе.');
    if (!String(effectiveStamp.system_name || '').trim()) errors.push('Не заполнено наименование системы в штампе.');
    if (!String(effectiveStamp.author || '').trim()) errors.push('Не заполнено поле "Разработал".');
    if (!String(effectiveStamp.checker || '').trim()) errors.push('Не заполнено поле "Проверил".');
    return errors;
  };

  const warningCount = useMemo(() => {
    return rowsForExport.filter(
      (r: any) =>
        String(r.name || '').length > SPEC_LIMITS.name ||
        String(r.type_mark || '').length > SPEC_LIMITS.typeMark ||
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
    const safe = (specName || 'spec').replace(/[^\w.-]+/g, '_');
    setExcelLoading(true);
    try {
      const resp = await fetch('/api/spec-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      saveAs(blob, `${safe}.xlsx`);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 12, color: C.textMuted }}>
        <span style={{ color: C.text }}>Спецификации</span> → Создание
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: 16, alignItems: 'start' }}>
        {/* Блок 1 — штамп */}
        <div className="card" style={{ padding: 16, borderRadius: 14, position: 'sticky', top: 12 }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Штамп
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ fontSize: 11, color: C.textMuted }}>Шифр проекта</label>
            <input
              style={{
                ...inp,
                borderColor: stampEmpty('project_code') ? '#c0392b' : C.border,
              }}
              value={stamp.project_code}
              onChange={(e) => setStamp({ ...stamp, project_code: e.target.value })}
            />
            <label style={{ fontSize: 11, color: C.textMuted }}>Наименование объекта</label>
            <input
              style={{
                ...inp,
                borderColor: stampEmpty('object_name') ? '#c0392b' : C.border,
              }}
              value={stamp.object_name}
              onChange={(e) => setStamp({ ...stamp, object_name: e.target.value })}
            />
            <label style={{ fontSize: 11, color: C.textMuted }}>Наименование системы</label>
            <input
              style={{
                ...inp,
                borderColor: stampEmpty('system_name') ? '#c0392b' : C.border,
              }}
              value={stamp.system_name}
              onChange={(e) => setStamp({ ...stamp, system_name: e.target.value })}
            />
            <label style={{ fontSize: 11, color: C.textMuted }}>Стадия</label>
            <select
              style={inp}
              value={stamp.stage}
              onChange={(e) => setStamp({ ...stamp, stage: e.target.value })}
            >
              <option value="РП">РП</option>
            </select>
            <label style={{ fontSize: 11, color: C.textMuted }}>Лист / Листов</label>
            <input
              style={{ ...inp, opacity: 0.85, cursor: 'not-allowed' }}
              readOnly
              value={`${stampWithSheets.sheet} / ${stampWithSheets.total_sheets}`}
            />
            <label style={{ fontSize: 11, color: C.textMuted }}>Разработал</label>
            <input
              style={{
                ...inp,
                borderColor: stampEmpty('author') ? '#c0392b' : C.border,
              }}
              value={stamp.author}
              onChange={(e) => setStamp({ ...stamp, author: e.target.value })}
            />
            <label style={{ fontSize: 11, color: C.textMuted }}>Проверил</label>
            <input
              style={{ ...inp, borderColor: stampEmpty('checker') ? '#c0392b' : C.border }}
              value={stamp.checker}
              onChange={(e) => setStamp({ ...stamp, checker: e.target.value })}
            />
            <label style={{ fontSize: 11, color: C.textMuted }}>Н. контроль</label>
            <input
              style={inp}
              value={stamp.control}
              onChange={(e) => setStamp({ ...stamp, control: e.target.value })}
            />
            <label style={{ fontSize: 11, color: C.textMuted }}>Утвердил</label>
            <input
              style={inp}
              value={stamp.approver}
              onChange={(e) => setStamp({ ...stamp, approver: e.target.value })}
            />
            <label style={{ fontSize: 11, color: C.textMuted }}>Дата</label>
            <input
              style={inp}
              type="date"
              value={stamp.date}
              onChange={(e) => setStamp({ ...stamp, date: e.target.value })}
            />
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 12 }}>
            Автосохранение штампа и названия (2 с). Статус:{' '}
            <span style={{ color: status ? C.green : C.text }}>{status || (specId ? 'В работе' : 'Черновик')}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {/* Блок 2 — каталог */}
          <div className="card" style={{ padding: 14, borderRadius: 14 }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Каталог
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 8,
                marginBottom: 10,
                alignItems: 'end',
              }}
            >
              <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
                <label style={{ fontSize: 11, color: C.textMuted, display: 'block', marginBottom: 4 }}>Поиск</label>
                <input
                  style={inp}
                  placeholder="Код или наименование (глобально по каталогу)…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.textMuted, display: 'block', marginBottom: 4 }}>Каталог</label>
                <select value={activeCatalogId} onChange={(e) => setActiveCatalogId(e.target.value)} style={inp}>
                  <option value="">—</option>
                  {catalogs.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.version} ({c.catalog_date}){c.is_active ? ' *' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.textMuted, display: 'block', marginBottom: 4 }}>Раздел</label>
                <select
                  value={sectionId}
                  onChange={(e) => {
                    setSectionId(e.target.value);
                    setGroupId('');
                  }}
                  style={inp}
                >
                  <option value="">—</option>
                  {sections.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.textMuted, display: 'block', marginBottom: 4 }}>Группа</label>
                <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={inp}>
                  <option value="">—</option>
                  {groupedOptions.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
                <label style={{ fontSize: 11, color: C.textMuted, display: 'block', marginBottom: 4 }}>Позиция</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  style={inp}
                >
                  <option value="">Выберите позицию…</option>
                  {items.slice(0, 1000).map((it: any) => (
                    <option key={it.id} value={it.id}>
                      {it.code} — {it.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ height: 38, fontWeight: 600, width: '100%' }}
                  disabled={!selectedItemId}
                  onClick={() => void addItemToSpec()}
                >
                  Добавить
                </button>
              </div>
            </div>
            {itemsLoading && <div style={{ fontSize: 12, color: C.textMuted }}>Загрузка позиций…</div>}
          </div>

          {/* Название + кнопки */}
          <div className="card" style={{ padding: 14, borderRadius: 14 }}>
            <input
              style={{ ...inp, marginBottom: 12 }}
              value={specName}
              onChange={(e) => setSpecName(e.target.value)}
              placeholder="Название спецификации"
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontWeight: 700 }}
                onClick={() => void onDownloadExcel()}
                disabled={excelLoading}
              >
                {excelLoading ? 'Формирование Excel…' : 'Скачать Excel'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => void clearAllRows()} disabled={saving || !specRows.length}>
                Очистить
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => void saveSpecMeta()} disabled={saving || !specId}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setPreviewOpen(true)}>
                Предпросмотр листов
              </button>
              {canManage && (
                <button type="button" className="btn btn-secondary" onClick={() => void createNewSpec()}>
                  Новая спецификация
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12, color: C.text }}>
              <span>
                Строк: <b>{specRows.length}</b> / {ROWS_PER_PAGE}
              </span>
              <span>
                Листов будет: <b>{previewPages.length}</b>
              </span>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 10 }}>
              Excel формируется на сервере по шаблону ГОСТ, фронтенд отправляет только структуру данных.
            </div>
          </div>

          {/* Блок 3 — таблица */}
          <div className="card" style={{ padding: 0, borderRadius: 14, overflow: 'hidden' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '44px minmax(120px, 1.4fr) minmax(80px, 0.9fr) 110px minmax(70px, 0.7fr) 52px 88px 44px',
                gap: 6,
                fontSize: 11,
                fontWeight: 700,
                background: C.surface2,
                padding: '10px 12px',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <div>№</div>
              <div>Наименование</div>
              <div>Тип/марка</div>
              <div>Код</div>
              <div>Завод</div>
              <div>Ед.</div>
              <div>Кол-во</div>
              <div />
            </div>
            {specRows.length === 0 && (
              <div style={{ padding: 24, color: C.textMuted, fontSize: 13 }}>Добавьте позиции из каталога</div>
            )}
            {[...specRows]
              .sort((a: any, b: any) => (a.line_no || 0) - (b.line_no || 0))
              .map((r: any, idx: number) => {
                const u = inferUnitFromText(String(r.name || ''), String(r.type_mark || ''), String(r.unit || ''));
                const nameLen = String(r.name || '').length;
                const typeLen = String(r.type_mark || '').length;
                const plantLen = String(
                  inferPlantFromCatalog(String(r.name || ''), String(r.type_mark || ''), String(r.code || ''), String(r.plant || ''))
                ).length;
                return (
                  <div
                    key={r.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '44px minmax(120px, 1.4fr) minmax(80px, 0.9fr) 110px minmax(70px, 0.7fr) 52px 88px 44px',
                      gap: 6,
                      alignItems: 'start',
                      padding: '10px 12px',
                      borderTop: `1px solid ${C.border}`,
                      background: idx % 2 === 0 ? 'transparent' : C.surface + '80',
                    }}
                  >
                    <div style={{ fontSize: 12, paddingTop: 8 }}>{idx + 1}</div>
                    <div>
                      <AutoTextarea
                        value={String(r.name || '')}
                        onChange={(v) => updateRow(r, { name: v })}
                        invalid={!String(r.name || '').trim()}
                        style={{ ...inp, padding: '8px 10px', fontSize: 12, width: '100%' }}
                      />
                      {nameLen > SPEC_LIMITS.name && (
                        <div style={{ fontSize: 10, color: '#c0392b' }}>Превышен лимит {SPEC_LIMITS.name} симв.</div>
                      )}
                    </div>
                    <div>
                      <input
                        value={String(r.type_mark || '')}
                        onChange={(e) => updateRow(r, { type_mark: e.target.value })}
                        style={{ ...inp, padding: '8px 10px', fontSize: 12, width: '100%' }}
                      />
                      {typeLen > SPEC_LIMITS.typeMark && (
                        <div style={{ fontSize: 10, color: '#c0392b' }}>Превышен лимит {SPEC_LIMITS.typeMark} симв.</div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, paddingTop: 8, wordBreak: 'break-all' }}>{r.code || ''}</div>
                    <div>
                      <input
                        value={inferPlantFromCatalog(
                          String(r.name || ''),
                          String(r.type_mark || ''),
                          String(r.code || ''),
                          String(r.plant || '')
                        )}
                        onChange={(e) => updateRow(r, { plant: e.target.value })}
                        style={{
                          ...inp,
                          padding: '8px 10px',
                          fontSize: 12,
                          width: '100%',
                          borderColor: plantLen > SPEC_LIMITS.factory ? '#c0392b' : C.border,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 12, paddingTop: 8 }}>{u}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 28px', gap: 4 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: 0, height: 28 }}
                        onClick={() => updateRow(r, { qty: Math.max(0, Number(r.qty || 0) - 1) })}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={String(r.qty ?? 0)}
                        onChange={(e) => updateRow(r, { qty: Number(e.target.value || 0) })}
                        style={{ ...inp, textAlign: 'center', padding: '5px 6px' }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: 0, height: 28 }}
                        onClick={() => updateRow(r, { qty: Number(r.qty || 0) + 1 })}
                      >
                        +
                      </button>
                    </div>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => void removeRow(r)}>
                      ×
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
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
                        <div>{inferUnitFromText(String(row.name || ''), String(row.type_mark || ''), String(row.unit || ''))}</div>
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
