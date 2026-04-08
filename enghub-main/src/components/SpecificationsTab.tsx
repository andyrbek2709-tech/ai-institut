import React, { useEffect, useMemo, useState } from 'react';
import { del, get, patch, post } from '../api/supabase';
import { exportSpecificationXls } from '../utils/export';

interface Props {
  C: any;
  token: string;
  project: any;
  currentUser: any;
  isGip: boolean;
  isLead: boolean;
}

type Stamp = {
  projectCode: string;
  objectName: string;
  systemName: string;
  stage: string;
  sheet: string;
  sheets: string;
  developedBy: string;
  checkedBy: string;
  normControlBy: string;
  approvedBy: string;
  date: string;
};

const emptyStamp: Stamp = {
  projectCode: '',
  objectName: '',
  systemName: '',
  stage: 'РП',
  sheet: '1',
  sheets: '1',
  developedBy: '',
  checkedBy: '',
  normControlBy: '',
  approvedBy: '',
  date: new Date().toISOString().slice(0, 10),
};

function inferUnitFromText(name: string, typeMark: string, currentUnit?: string): string {
  const u = String(currentUnit || '').trim();
  if (u) return u;
  const txt = `${name || ''} ${typeMark || ''}`.toLowerCase();
  if (txt.includes('бетон')) return 'м3';
  if (txt.includes('труб')) return 'м';
  if (txt.includes('кабел')) return 'м';
  if (txt.includes('краск') || txt.includes('грунт')) return 'кг';
  // default for piece goods and unknowns
  return 'шт';
}

function inferPlantFromCatalog(name: string, typeMark: string, code: string, currentPlant?: string): string {
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
  // Final fallback from catalog code so column is never empty.
  return String(code || '').trim() || '—';
}

export function SpecificationsTab({ C, token, project, currentUser, isGip, isLead }: Props) {
  const [catalogs, setCatalogs] = useState<any[]>([]);
  const [activeCatalogId, setActiveCatalogId] = useState<string>('');
  const [sections, setSections] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);

  const [search, setSearch] = useState('');
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
  const [status, setStatus] = useState('');

  const canManage = isGip || isLead;
  const inp = {
    width: '100%',
    background: C.surface2,
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 12,
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  const filteredItems = items;
  const groupedOptions = useMemo(() => {
    return groups
      .filter((g: any) => !sectionId || String(g.section_id) === String(sectionId))
      .map((g: any) => ({ id: String(g.id), label: String(g.name || '') }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [groups, sectionId]);

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
      setStamp({ ...emptyStamp, ...(rows[0].stamp || {}) });
    }
  };

  const loadCatalogTree = async (catalogId: string) => {
    if (!catalogId) return;
    const s = await get(`sections?catalog_id=eq.${catalogId}&order=sort_order.asc,id.asc`, token);
    const allSections = Array.isArray(s) ? s : [];
    setSections(allSections);
    if (!allSections.length) {
      setGroups([]);
      setItems([]);
      return;
    }
    const secIds = allSections.map((x: any) => x.id).join(',');
    const g = await get(`groups?section_id=in.(${secIds})&order=name.asc,id.asc`, token);
    setGroups(Array.isArray(g) ? g : []);
  };

  const loadItems = async () => {
    if (!activeCatalogId) return;
    setItemsLoading(true);
    try {
      const q = search.trim();
      const isGlobalSearch = q.length > 0;
      if (isGlobalSearch) {
        // Global search across full active catalog, independent from selected filters.
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

        // Fallback: find by readable section/group names, then fetch their items.
        const ql = q.toLowerCase();
        const matchedSectionIds = sections
          .filter((s: any) => String(s.name || '').toLowerCase().includes(ql))
          .map((s: any) => String(s.id));
        const matchedGroupIds = groups
          .filter((g: any) =>
            String(g.name || '').toLowerCase().includes(ql) ||
            matchedSectionIds.includes(String(g.section_id))
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
  }, [activeCatalogId, sectionId, groupId, search, groups.length]);

  useEffect(() => {
    if (specId) loadSpecRows(specId);
  }, [specId]);

  const ensureSpec = async (): Promise<string | null> => {
    if (specId) return specId;
    if (!project?.id) return null;
    const created = await post('specifications', {
      project_id: project.id,
      name: specName || 'Спецификация оборудования',
      catalog_id: activeCatalogId ? Number(activeCatalogId) : null,
      created_by: currentUser?.id || null,
      stamp,
    }, token);
    const id = String((Array.isArray(created) ? created[0] : created)?.id || '');
    if (!id) return null;
    setSpecId(id);
    await loadSpecs();
    return id;
  };

  const addItemToSpec = async (itemIdArg?: string) => {
    const itemId = itemIdArg || selectedItemId;
    if (!itemId) return;
    const sid = await ensureSpec();
    if (!sid) return;
    const item = items.find((x: any) => String(x.id) === String(itemId));
    if (!item) return;
    const inferredUnit = inferUnitFromText(String(item.name || ''), String(item.standard || ''), String(item.unit || ''));
    const nextLine = (specRows[specRows.length - 1]?.line_no || 0) + 1;
    await post('specification_items', {
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
    }, token);
    setSelectedItemId('');
    await loadSpecRows(sid);
  };

  const updateRow = async (row: any, data: any) => {
    await patch(`specification_items?id=eq.${row.id}`, data, token);
    await loadSpecRows(specId);
  };

  const removeRow = async (row: any) => {
    await del(`specification_items?id=eq.${row.id}`, token);
    await loadSpecRows(specId);
  };

  const saveSpecMeta = async () => {
    if (!specId) return;
    setSaving(true);
    try {
      await patch(`specifications?id=eq.${specId}`, { name: specName, stamp }, token);
      setStatus('Сохранено');
      setTimeout(() => setStatus(''), 1200);
    } finally {
      setSaving(false);
    }
  };

  const createNewSpec = async () => {
    const created = await post('specifications', {
      project_id: project.id,
      name: `Спецификация ${new Date().toLocaleDateString('ru-RU')}`,
      catalog_id: activeCatalogId ? Number(activeCatalogId) : null,
      created_by: currentUser?.id || null,
      stamp: { ...stamp, projectCode: project?.code || stamp.projectCode },
    }, token);
    const id = String((Array.isArray(created) ? created[0] : created)?.id || '');
    if (id) {
      setSpecId(id);
      await loadSpecs();
      await loadSpecRows(id);
    }
  };

  const onExport = () => {
    exportSpecificationXls(specName || 'Спецификация', stamp, specRows.map((r: any) => ({
      line_no: r.line_no,
      name: r.name,
      type_mark: r.type_mark,
      code: r.code,
      plant: r.plant,
      unit: r.unit,
      qty: Number(r.qty || 0),
    })));
  };

  if (!project) return <div className="empty-state">Выберите проект</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 14 }}>
      <div className="card" style={{ padding: 14, alignSelf: 'start', borderRadius: 14 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Спецификация</div>
        <button className="btn btn-primary" style={{ width: '100%', marginBottom: 8, height: 36, fontWeight: 700 }} onClick={onExport}>Сформировать спецификацию</button>
        <button className="btn btn-secondary" style={{ width: '100%', marginBottom: 8, height: 32 }} onClick={() => setSpecRows([])}>Очистить все</button>
        <button className="btn btn-secondary" style={{ width: '100%', marginBottom: 10, height: 32 }} onClick={createNewSpec}>Новая спецификация</button>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
          Статус: <span style={{ color: status ? C.green : C.text }}>{status || (specId ? 'Заполняется' : 'Не создана')}</span>
        </div>

        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Штамп</div>
        <div style={{ display: 'grid', gap: 6 }}>
          <input style={inp} placeholder="Шифр проекта" value={stamp.projectCode} onChange={(e) => setStamp({ ...stamp, projectCode: e.target.value })} />
          <input style={inp} placeholder="Наименование объекта" value={stamp.objectName} onChange={(e) => setStamp({ ...stamp, objectName: e.target.value })} />
          <input style={inp} placeholder="Наименование системы" value={stamp.systemName} onChange={(e) => setStamp({ ...stamp, systemName: e.target.value })} />
          <input style={inp} placeholder="Стадия (РП)" value={stamp.stage} onChange={(e) => setStamp({ ...stamp, stage: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <input style={inp} placeholder="Лист" value={stamp.sheet} onChange={(e) => setStamp({ ...stamp, sheet: e.target.value })} />
            <input style={inp} placeholder="Листов" value={stamp.sheets} onChange={(e) => setStamp({ ...stamp, sheets: e.target.value })} />
          </div>
          <input style={inp} placeholder="Разработал" value={stamp.developedBy} onChange={(e) => setStamp({ ...stamp, developedBy: e.target.value })} />
          <input style={inp} placeholder="Проверил" value={stamp.checkedBy} onChange={(e) => setStamp({ ...stamp, checkedBy: e.target.value })} />
          <input style={inp} placeholder="Н. контроль" value={stamp.normControlBy} onChange={(e) => setStamp({ ...stamp, normControlBy: e.target.value })} />
          <input style={inp} placeholder="Утвердил" value={stamp.approvedBy} onChange={(e) => setStamp({ ...stamp, approvedBy: e.target.value })} />
          <input style={inp} placeholder="Дата" value={stamp.date} onChange={(e) => setStamp({ ...stamp, date: e.target.value })} />
          <button className="btn btn-secondary" style={{ height: 32 }} onClick={saveSpecMeta} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить штамп'}</button>
        </div>
      </div>

      <div className="card" style={{ padding: 14, borderRadius: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr 1.2fr 1.2fr 1.5fr', gap: 8, marginBottom: 8 }}>
          <input
            style={inp}
            placeholder="Искать в каталоге AGSK-3 по коду и названию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={activeCatalogId} onChange={(e) => setActiveCatalogId(e.target.value)} style={inp}>
            <option value="">Каталог</option>
            {catalogs.map((c: any) => <option key={c.id} value={c.id}>{c.version} ({c.catalog_date}){c.is_active ? ' *' : ''}</option>)}
          </select>
          <select value={sectionId} onChange={(e) => { setSectionId(e.target.value); setGroupId(''); }} style={inp}>
            <option value="">Раздел</option>
            {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={inp}>
            <option value="">Группа</option>
            {groupedOptions.map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
          <select
            value={selectedItemId}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedItemId(v);
              if (v) void addItemToSpec(v);
            }}
            style={inp}
          >
            <option value="">Выбрать позицию из каталога...</option>
            {filteredItems.slice(0, 1000).map((it: any) => (
              <option key={it.id} value={it.id}>{it.code} — {it.name}</option>
            ))}
          </select>
        </div>
        {itemsLoading && <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>Загрузка позиций...</div>}

        <div style={{ marginBottom: 10 }}>
          <input style={inp} value={specName} onChange={(e) => setSpecName(e.target.value)} placeholder="Название спецификации" />
        </div>

        <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '50px 1.8fr 1fr 130px 130px 60px 100px 50px', fontSize: 12, fontWeight: 700, background: C.surface2, padding: '10px 10px' }}>
            <div>№</div><div>Наименование</div><div>Тип/марка</div><div>Код</div><div>Завод</div><div>Ед.</div><div>Кол-во</div><div />
          </div>
          {specRows.length === 0 && <div style={{ padding: 18, color: C.textMuted }}>Позиции не добавлены</div>}
          {specRows.map((r: any, idx: number) => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '50px 1.8fr 1fr 130px 130px 60px 100px 50px', gap: 6, alignItems: 'center', padding: '9px 10px', borderTop: `1px solid ${C.border}`, background: idx % 2 === 0 ? 'transparent' : C.surface + '80' }}>
              <div>{idx + 1}</div>
              <div style={{ lineHeight: 1.25 }}>{r.name}</div>
              <div>{r.type_mark || ''}</div>
              <div>{r.code || ''}</div>
              <input
                value={inferPlantFromCatalog(
                  String(r.name || ''),
                  String(r.type_mark || ''),
                  String(r.code || ''),
                  String(r.plant || '')
                )}
                onChange={(e) => updateRow(r, { plant: e.target.value })}
                style={{ ...inp, padding: '6px 8px' }}
              />
              <div>{inferUnitFromText(String(r.name || ''), String(r.type_mark || ''), String(r.unit || ''))}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 28px', gap: 4 }}>
                <button className="btn btn-secondary" style={{ padding: 0, height: 28 }} onClick={() => updateRow(r, { qty: Math.max(0, Number(r.qty || 0) - 1) })}>-</button>
                <input value={String(r.qty || 0)} onChange={(e) => updateRow(r, { qty: Number(e.target.value || 0) })} style={{ ...inp, textAlign: 'center', padding: '5px 6px' }} />
                <button className="btn btn-secondary" style={{ padding: 0, height: 28 }} onClick={() => updateRow(r, { qty: Number(r.qty || 0) + 1 })}>+</button>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => removeRow(r)}>×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
