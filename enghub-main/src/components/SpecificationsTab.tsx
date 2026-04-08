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

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (sectionId && String(it.section_id) !== String(sectionId)) return false;
      if (groupId && String(it.group_id) !== String(groupId)) return false;
      if (!q) return true;
      return String(it.code || '').toLowerCase().includes(q) || String(it.name || '').toLowerCase().includes(q);
    });
  }, [items, search, sectionId, groupId]);

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
    const secIds = allSections.map((x: any) => x.id).join(',');
    if (!secIds) {
      setGroups([]);
      setItems([]);
      return;
    }
    const g = await get(`groups?section_id=in.(${secIds})&order=sort_order.asc,id.asc`, token);
    const allGroups = Array.isArray(g) ? g : [];
    setGroups(allGroups);
    const grpIds = allGroups.map((x: any) => x.id).join(',');
    if (!grpIds) {
      setItems([]);
      return;
    }
    const i = await get(`catalog_items?group_id=in.(${grpIds})&order=code.asc&limit=200000`, token);
    const secByGroup = new Map(allGroups.map((gr: any) => [String(gr.id), gr.section_id]));
    const withRefs = (Array.isArray(i) ? i : []).map((it: any) => ({
      ...it,
      section_id: secByGroup.get(String(it.group_id)),
    }));
    setItems(withRefs);
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

  const addItemToSpec = async () => {
    if (!selectedItemId) return;
    const sid = await ensureSpec();
    if (!sid) return;
    const item = items.find((x: any) => String(x.id) === String(selectedItemId));
    if (!item) return;
    const nextLine = (specRows[specRows.length - 1]?.line_no || 0) + 1;
    await post('specification_items', {
      specification_id: Number(sid),
      line_no: nextLine,
      item_id: item.id,
      name: item.name,
      code: item.code,
      unit: item.unit,
      type_mark: item.standard || '',
      plant: '',
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

  const parseCatalogFile = async (file: File) => {
    setUploading(true);
    setStatus('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result || ''));
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      const base64 = dataUrl.split(',')[1] || '';
      const url = window.location.hostname === 'localhost'
        ? 'https://enghub-three.vercel.app/api/catalog-parse'
        : '/api/catalog-parse';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_base64: base64 }),
      });
      const parsed = await res.json();
      if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
        setStatus(parsed.warning || 'Парсинг не дал структурированных данных');
        return;
      }

      // New catalog version inferred from date + original filename
      const now = new Date();
      const version = file.name.replace(/\.pdf$/i, '').slice(0, 120);
      await patch('catalogs?is_active=eq.true', { is_active: false }, token).catch(() => null);
      const catalogResp = await post('catalogs', {
        version,
        catalog_date: now.toISOString().slice(0, 10),
        is_active: true,
        source_file: file.name,
        created_by: currentUser?.id || null,
      }, token);
      const catalogId = (Array.isArray(catalogResp) ? catalogResp[0] : catalogResp)?.id;
      if (!catalogId) return;

      let sectionOrder = 1;
      for (const sec of parsed.sections) {
        const secResp = await post('sections', {
          catalog_id: catalogId,
          name: sec.name || `Раздел ${sectionOrder}`,
          sort_order: sectionOrder++,
        }, token);
        const secId = (Array.isArray(secResp) ? secResp[0] : secResp)?.id;
        if (!secId) continue;
        let groupOrder = 1;
        for (const gr of sec.groups || []) {
          const grResp = await post('groups', {
            section_id: secId,
            name: gr.name || `Группа ${groupOrder}`,
            sort_order: groupOrder++,
          }, token);
          const grId = (Array.isArray(grResp) ? grResp[0] : grResp)?.id;
          if (!grId) continue;
          for (const it of gr.items || []) {
            await post('catalog_items', {
              group_id: grId,
              code: it.code || '',
              name: it.name || '',
              unit: it.unit || '',
              standard: it.standard || '',
            }, token);
          }
        }
      }
      await loadCatalogData();
      setStatus('Каталог загружен и распарсен');
    } catch (e: any) {
      setStatus(`Ошибка парсинга: ${e?.message || 'unknown'}`);
    } finally {
      setUploading(false);
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
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
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
            {groups.filter((g: any) => !sectionId || String(g.section_id) === String(sectionId)).map((g: any) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr auto auto', gap: 8, marginBottom: 8 }}>
          <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} style={inp}>
            <option value="">Выбрать позицию из каталога...</option>
            {filteredItems.slice(0, 1000).map((it: any) => (
              <option key={it.id} value={it.id}>{it.code} — {it.name}</option>
            ))}
          </select>
          <button className="btn btn-primary" style={{ height: 36, minWidth: 110 }} onClick={addItemToSpec} disabled={!selectedItemId || !canManage}>Добавить</button>
          {canManage && (
            <label className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 36, minWidth: 170 }}>
              {uploading ? 'Загрузка...' : 'Загрузить PDF каталог'}
              <input
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void parseCatalogFile(file);
                }}
              />
            </label>
          )}
        </div>

        <div style={{ marginBottom: 10, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 8 }}>
          <input style={inp} value={specName} onChange={(e) => setSpecName(e.target.value)} placeholder="Название спецификации" />
          <select value={specId} onChange={(e) => setSpecId(e.target.value)} style={inp}>
            <option value="">Выбрать спецификацию...</option>
            {specs.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
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
              <input value={r.plant || ''} onChange={(e) => updateRow(r, { plant: e.target.value })} style={{ ...inp, padding: '6px 8px' }} />
              <div>{r.unit || ''}</div>
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
