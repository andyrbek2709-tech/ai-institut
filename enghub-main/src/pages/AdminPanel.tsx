import { useState, useEffect, useRef } from 'react';
import { DARK, LIGHT, roleLabels, roleOptions } from '../constants';
import { get } from '../api/supabase';
import { apiPost, apiPatch, apiGet, apiDelete, apiFetch } from '../api/http';
import { ThemeToggle, Modal, Field, AvatarComp, getInp } from '../components/ui';

interface AdminPanelProps {
  token: string;
  onLogout: () => void;
  dark: boolean;
  setDark: (v: boolean) => void;
}

// ─── small utility ───────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 6,
      color, background: color + "18", border: `1px solid ${color}30`,
      textTransform: "uppercase", letterSpacing: "0.5px",
    }}>{label}</span>
  );
}

function roleColor(role: string) {
  const map: Record<string, string> = {
    admin: "#ef4444",
    gip: "#f5a623",
    lead: "#a855f7",
    lead_engineer: "#8b5cf6",
    engineer: "#4a9eff",
    reviewer: "#06b6d4",
    observer: "#8896a8",
  };
  return map[role] || "#8896a8";
}

// ─── component ───────────────────────────────────────────────────────────────

export function AdminPanel({ token, onLogout, dark, setDark }: AdminPanelProps) {
  const C = dark ? DARK : LIGHT;
  const [tab, setTab] = useState(localStorage.getItem('enghub_admin_tab') || "users");

  // data
  const [users, setUsers] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<any[]>([]);
  const [orgSettings, setOrgSettings] = useState<any>({ company_name: 'EngHub', logo_url: null, primary_color: '#2b5bb5' });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // user modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const emptyUser = { full_name: "", email: "", password: "", role: "engineer", position: "", dept_id: "" };
  const [form, setForm] = useState<any>(emptyUser);

  // password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUser, setPasswordUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  // dept modal
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editDept, setEditDept] = useState<any>(null);
  const [deptForm, setDeptForm] = useState({ name: "", description: "", head_id: "" });

  // delete confirm (3-step for projects)
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [deleteStep, setDeleteStep] = useState(0);

  // branding
  const [brandingForm, setBrandingForm] = useState({ company_name: 'EngHub', primary_color: '#2b5bb5' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingMsg, setBrandingMsg] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  // loading
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); }, []);
  useEffect(() => { document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => { localStorage.setItem('enghub_admin_tab', tab); }, [tab]);

  const load = async () => {
    loadUsers();
    loadDepts();
    loadArchived();
    loadOrgSettings();
  };

  const loadUsers = async () => {
    const data = await get("app_users?order=id", token);
    if (Array.isArray(data)) setUsers(data);
  };
  const loadDepts = async () => {
    const data = await get("departments?order=name", token);
    if (Array.isArray(data)) setDepts(data);
  };
  const loadArchived = async () => {
    const data = await get("projects?archived=eq.true&order=id", token);
    if (Array.isArray(data)) setArchivedProjects(data);
  };
  const loadOrgSettings = async () => {
    try {
      const data = await apiGet('/api/admin/organization');
      if (data) {
        setOrgSettings(data);
        setBrandingForm({ company_name: data.company_name || 'EngHub', primary_color: data.primary_color || '#2b5bb5' });
        setLogoPreview(data.logo_url || null);
      }
    } catch {
      // use defaults
    }
  };
  const loadAuditLogs = async () => {
    try {
      const data = await apiGet('/api/admin/audit-logs?limit=50');
      if (Array.isArray(data)) setAuditLogs(data);
    } catch {}
  };

  // ─── User actions ───────────────────────────────────────────────────────────

  const saveUser = async () => {
    if (!form.full_name || !form.email || !form.role) return;
    setSaving(true);
    setMsg("");
    try {
      if (editUser) {
        await apiPost('/api/admin-users', {
          action: 'update',
          user_id: editUser.id,
          full_name: form.full_name,
          position: form.position,
          role: form.role,
          dept_id: form.dept_id || null,
        });
      } else {
        await apiPost('/api/admin-users', {
          action: 'create',
          email: form.email,
          password: form.password || "Enghub2025!",
          full_name: form.full_name,
          role: form.role,
          dept_id: form.dept_id || null,
        });
      }
      setForm(emptyUser);
      setEditUser(null);
      setShowUserModal(false);
      loadUsers();
    } catch (e: any) {
      setMsg("✗ " + (e?.message || "Ошибка"));
    }
    setSaving(false);
  };

  const toggleUserActive = async (u: any) => {
    await apiPost('/api/admin-users', { action: 'disable', user_id: u.id, is_active: !u.is_active });
    loadUsers();
  };

  const deleteUser = async (u: any) => {
    if (!window.confirm(`Удалить ${u.full_name}? Это действие необратимо.`)) return;
    await apiPost('/api/admin-users', { action: 'delete', user_id: u.id, supabase_uid: u.supabase_uid });
    loadUsers();
  };

  // ─── Dept actions ───────────────────────────────────────────────────────────

  const saveDept = async () => {
    if (!deptForm.name.trim()) return;
    setSaving(true);
    setMsg("");
    try {
      if (editDept) {
        await apiFetch(`/api/admin/departments/${editDept.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: deptForm.name.trim(),
            description: deptForm.description,
            head_id: deptForm.head_id || null,
          }),
        });
      } else {
        await apiFetch('/api/admin/departments', {
          method: 'POST',
          body: JSON.stringify({
            name: deptForm.name.trim(),
            description: deptForm.description,
            head_id: deptForm.head_id || null,
          }),
        });
      }
      setDeptForm({ name: "", description: "", head_id: "" });
      setEditDept(null);
      setShowDeptModal(false);
      loadDepts();
      loadUsers(); // dept head info changes
    } catch (e: any) {
      setMsg("✗ " + (e?.message || "Ошибка"));
    }
    setSaving(false);
  };

  const archiveDept = async (d: any) => {
    await apiFetch(`/api/admin/departments/${d.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_archived: !d.is_archived }),
    });
    loadDepts();
  };

  const deleteDept = async (id: number) => {
    try {
      await apiFetch(`/api/admin/departments/${id}`, { method: 'DELETE' });
      loadDepts();
    } catch (e: any) {
      alert(e?.message || "Ошибка удаления");
    }
  };

  // ─── Archive actions ─────────────────────────────────────────────────────────

  const restoreProject = async (id: number) => {
    await apiPost(`/api/admin/projects/${id}/restore`);
    loadArchived();
    setMsg("✓ Проект восстановлен");
    setTimeout(() => setMsg(""), 3000);
  };

  const permanentDeleteProject = async (id: number) => {
    await apiDelete(`/api/admin/projects/${id}`);
    setDeleteConfirm(null);
    setDeleteStep(0);
    loadArchived();
  };

  // ─── Branding actions ────────────────────────────────────────────────────────

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const saveBranding = async () => {
    setBrandingSaving(true);
    setBrandingMsg("");
    try {
      if (logoFile) {
        const reader = new FileReader();
        await new Promise<void>((resolve, reject) => {
          reader.onload = async () => {
            try {
              const base64 = (reader.result as string).split(',')[1];
              await apiPost('/api/admin/branding/logo', {
                fileBase64: base64,
                mimeType: logoFile.type,
                fileName: logoFile.name,
              });
              resolve();
            } catch (e) { reject(e); }
          };
          reader.onerror = reject;
          reader.readAsDataURL(logoFile);
        });
      }
      await apiPatch('/api/admin/organization', {
        company_name: brandingForm.company_name,
        primary_color: brandingForm.primary_color,
      });
      setLogoFile(null);
      setBrandingMsg("✓ Брендинг сохранён");
      loadOrgSettings();
    } catch (e: any) {
      setBrandingMsg("✗ " + (e?.message || "Ошибка"));
    }
    setBrandingSaving(false);
  };

  // ─── UI helpers ──────────────────────────────────────────────────────────────

  const getDeptName = (id: any) => depts.find(d => d.id === id)?.name || "—";
  const deptUsers = (deptId: number) => users.filter(u => u.dept_id === deptId);

  const navTabs = [
    { id: "org", icon: "🏛", label: "Организация" },
    { id: "users", icon: "👥", label: "Пользователи" },
    { id: "depts", icon: "🏢", label: "Отделы" },
    { id: "archive", icon: "📦", label: "Архив" },
    { id: "audit", icon: "📋", label: "Аудит" },
  ];

  const accentColor = orgSettings.primary_color || '#2b5bb5';

  return (
    <div className="app-root">

      {/* ── 3-step delete confirm ── */}
      {deleteConfirm && (
        <div className="delete-overlay">
          <div className="delete-box">
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8, color: C.red }}>
              {deleteStep === 0 && "Удалить проект навсегда?"}
              {deleteStep === 1 && "Вы уверены?"}
              {deleteStep === 2 && "Последнее предупреждение!"}
            </div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 24 }}>
              {deleteStep === 0 && `«${deleteConfirm.name}» — будет удалён из архива`}
              {deleteStep === 1 && "Все данные проекта (задачи, файлы, чертежи) будут уничтожены"}
              {deleteStep === 2 && "Нажмите УДАЛИТЬ — отменить будет невозможно"}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn btn-secondary" onClick={() => { setDeleteConfirm(null); setDeleteStep(0); }}>Отмена</button>
              <button className="btn" style={{ background: C.red, color: "#fff" }}
                onClick={() => {
                  if (deleteStep < 2) setDeleteStep(s => s + 1);
                  else permanentDeleteProject(deleteConfirm.id);
                }}>
                {deleteStep === 2 ? "УДАЛИТЬ НАВСЕГДА" : `Продолжить (${deleteStep + 1}/3)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── User modal ── */}
      {showUserModal && (
        <Modal
          key={`user-${editUser?.id || 'new'}`}
          title={editUser ? "Редактировать пользователя" : "Новый пользователь"}
          onClose={() => { setShowUserModal(false); setEditUser(null); setForm(emptyUser); setMsg(""); }}
          C={C}
        >
          <div className="form-stack">
            {msg && <div style={{ fontSize: 13, color: C.red, padding: "8px 12px", background: C.red + "10", borderRadius: 8 }}>{msg}</div>}
            <Field label="ФИО *" C={C}>
              <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Иванов Иван Иванович" style={getInp(C)} />
            </Field>
            {!editUser && (
              <Field label="EMAIL *" C={C}>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="ivanov@company.com" style={getInp(C)} />
              </Field>
            )}
            {!editUser && (
              <Field label="ПАРОЛЬ" C={C}>
                <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} type="password" placeholder="Enghub2025!" style={getInp(C)} />
              </Field>
            )}
            <Field label="РОЛЬ *" C={C}>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={getInp(C)}>
                {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
            <Field label="ДОЛЖНОСТЬ" C={C}>
              <input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="Ведущий инженер" style={getInp(C)} />
            </Field>
            {["lead", "lead_engineer", "engineer", "reviewer", "observer"].includes(form.role) && (
              <Field label="ОТДЕЛ" C={C}>
                <select value={form.dept_id} onChange={e => setForm({ ...form, dept_id: e.target.value })} style={getInp(C)}>
                  <option value="">— Выбрать отдел —</option>
                  {depts.filter(d => !d.is_archived).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
            )}
            <button className="btn btn-primary" onClick={saveUser}
              disabled={saving || !form.full_name || !form.email}
              style={{ width: "100%", opacity: (!form.full_name || !form.email) ? 0.5 : 1 }}>
              {saving ? "Сохраняется..." : editUser ? "Сохранить изменения" : "Создать пользователя"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Password modal ── */}
      {showPasswordModal && passwordUser && (
        <Modal
          title={`Сменить пароль — ${passwordUser.full_name}`}
          onClose={() => { setShowPasswordModal(false); setPasswordUser(null); setNewPassword(""); setPasswordMsg(""); }}
          C={C}
        >
          <div className="form-stack">
            <div style={{ fontSize: 13, color: C.textMuted }}>{passwordUser.email}</div>
            <Field label="НОВЫЙ ПАРОЛЬ *" C={C}>
              <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" placeholder="Минимум 6 символов" style={getInp(C)} />
            </Field>
            {passwordMsg && (
              <div style={{ fontSize: 13, fontWeight: 500, padding: "8px 12px", borderRadius: 8,
                color: passwordMsg.startsWith("✓") ? C.green : C.red,
                background: (passwordMsg.startsWith("✓") ? C.green : C.red) + "10"
              }}>{passwordMsg}</div>
            )}
            <button className="btn btn-primary" disabled={saving || newPassword.length < 6}
              style={{ width: "100%", opacity: newPassword.length < 6 ? 0.5 : 1 }}
              onClick={async () => {
                if (newPassword.length < 6) return;
                setSaving(true); setPasswordMsg("");
                try {
                  if (!passwordUser.supabase_uid) { setPasswordMsg("✗ Нет Supabase UID"); setSaving(false); return; }
                  await apiPost('/api/admin-users', { action: 'reset_password', supabase_uid: passwordUser.supabase_uid, new_password: newPassword });
                  setPasswordMsg("✓ Пароль изменён!"); setNewPassword("");
                } catch (e: any) { setPasswordMsg(`✗ ${e?.message || 'Ошибка'}`); }
                setSaving(false);
              }}>
              {saving ? "Сохраняется..." : "Сменить пароль"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Dept modal ── */}
      {showDeptModal && (
        <Modal
          key={`dept-${editDept?.id || 'new'}`}
          title={editDept ? "Редактировать отдел" : "Новый отдел"}
          onClose={() => { setShowDeptModal(false); setEditDept(null); setDeptForm({ name: "", description: "", head_id: "" }); setMsg(""); }}
          C={C}
        >
          <div className="form-stack">
            {msg && <div style={{ fontSize: 13, color: C.red, padding: "8px 12px", background: C.red + "10", borderRadius: 8 }}>{msg}</div>}
            <Field label="НАЗВАНИЕ ОТДЕЛА *" C={C}>
              <input value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} placeholder="ВК, ЭМ, КЖ..." style={getInp(C)} />
            </Field>
            <Field label="ОПИСАНИЕ" C={C}>
              <input value={deptForm.description} onChange={e => setDeptForm({ ...deptForm, description: e.target.value })} placeholder="Отдел водоснабжения и канализации" style={getInp(C)} />
            </Field>
            <Field label="РУКОВОДИТЕЛЬ" C={C}>
              <select value={deptForm.head_id} onChange={e => setDeptForm({ ...deptForm, head_id: e.target.value })} style={getInp(C)}>
                <option value="">— Не назначен —</option>
                {users.filter(u => ["lead", "lead_engineer", "gip"].includes(u.role)).map(u => (
                  <option key={u.id} value={u.id}>{u.full_name} ({roleLabels[u.role] || u.role})</option>
                ))}
              </select>
            </Field>
            <button className="btn btn-primary" onClick={saveDept}
              disabled={saving || !deptForm.name.trim()}
              style={{ width: "100%", opacity: !deptForm.name.trim() ? 0.5 : 1 }}>
              {saving ? "Сохраняется..." : editDept ? "Сохранить" : "Создать отдел"}
            </button>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════ SIDEBAR ══════════════════════════════════ */}
      <div className="sidebar">
        <div className="sidebar-logo">
          {orgSettings.logo_url ? (
            <img src={orgSettings.logo_url} alt="logo"
              style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 6 }} />
          ) : (
            <div className="sidebar-logo-icon" style={{ background: accentColor }}>⬡</div>
          )}
          <div className="sidebar-logo-text">{orgSettings.company_name || 'EngHub'}</div>
        </div>
        <div className="sidebar-nav">
          <div className="sidebar-section-label">Администрирование</div>
          {navTabs.map(t => (
            <button key={t.id} type="button"
              className={`sidebar-btn ${tab === t.id ? "active" : ""}`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTab(t.id); }}>
              <span className="sidebar-btn-icon">{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div style={{ padding: "8px 12px", fontSize: 12, color: C.textMuted }}>
            {users.length} польз. · {depts.length} отд.
          </div>
          <button className="sidebar-btn" onClick={onLogout} style={{ color: "#ef4444" }}>
            <span className="sidebar-btn-icon">⏻</span><span>Выйти</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════ MAIN AREA ════════════════════════════════ */}
      <div className="main-area">
        <div className="topbar">
          <div className="topbar-left">
            <div className="topbar-title">Администрирование</div>
            <Badge label="ADMIN" color={C.red} />
          </div>
          <div className="topbar-right">
            <ThemeToggle dark={dark} setDark={setDark} C={C} />
            {tab === "users" && (
              <button className="btn btn-primary btn-sm"
                onClick={() => { setForm(emptyUser); setEditUser(null); setMsg(""); setShowUserModal(true); }}>
                + Пользователь
              </button>
            )}
            {tab === "depts" && (
              <button className="btn btn-primary btn-sm"
                onClick={() => { setDeptForm({ name: "", description: "", head_id: "" }); setEditDept(null); setMsg(""); setShowDeptModal(true); }}>
                + Отдел
              </button>
            )}
            {tab === "audit" && (
              <button className="btn btn-sm" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
                onClick={loadAuditLogs}>
                Обновить
              </button>
            )}
          </div>
        </div>

        <div className="content">
          {msg && tab !== "org" && (
            <div style={{ marginBottom: 16, fontSize: 13, padding: "10px 16px", borderRadius: 10,
              color: msg.startsWith("✓") ? C.green : C.red,
              background: (msg.startsWith("✓") ? C.green : C.red) + "12" }}>
              {msg}
            </div>
          )}

          {/* ════════════════ ORGANIZATION / BRANDING ════════════════════════ */}
          {tab === "org" && (
            <div>
              <div className="page-header">
                <div>
                  <div className="page-label">Настройки</div>
                  <div className="page-title">Организация и брендинг</div>
                </div>
              </div>

              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 32 }}>
                {[
                  { label: "Пользователей", value: users.length, color: C.accent },
                  { label: "Активных", value: users.filter(u => u.is_active !== false).length, color: C.green },
                  { label: "Отделов", value: depts.filter(d => !d.is_archived).length, color: C.blue },
                  { label: "В архиве", value: archivedProjects.length, color: C.orange },
                ].map(s => (
                  <div key={s.label} className="card" style={{ padding: "16px 20px" }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Branding settings */}
              <div className="card" style={{ padding: 28, maxWidth: 560 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 20 }}>
                  Брендинг организации
                </div>
                <div className="form-stack">
                  <Field label="НАЗВАНИЕ КОМПАНИИ" C={C}>
                    <input
                      value={brandingForm.company_name}
                      onChange={e => setBrandingForm({ ...brandingForm, company_name: e.target.value })}
                      placeholder="EngHub"
                      style={getInp(C)}
                    />
                  </Field>

                  <Field label="ОСНОВНОЙ ЦВЕТ (HEX)" C={C}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="color"
                        value={brandingForm.primary_color}
                        onChange={e => setBrandingForm({ ...brandingForm, primary_color: e.target.value })}
                        style={{ width: 44, height: 36, border: "none", borderRadius: 8, cursor: "pointer", background: "transparent" }}
                      />
                      <input
                        value={brandingForm.primary_color}
                        onChange={e => setBrandingForm({ ...brandingForm, primary_color: e.target.value })}
                        placeholder="#2b5bb5"
                        style={{ ...getInp(C), flex: 1 }}
                      />
                    </div>
                  </Field>

                  <Field label="ЛОГОТИП" C={C}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      {logoPreview && (
                        <img src={logoPreview} alt="logo preview"
                          style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 8,
                            background: C.surface2, border: `1px solid ${C.border}`, padding: 4 }} />
                      )}
                      <div>
                        <button className="btn btn-sm" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
                          onClick={() => logoInputRef.current?.click()}>
                          {logoPreview ? "Сменить логотип" : "Загрузить логотип"}
                        </button>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>PNG, SVG, JPG — до 2 МБ</div>
                        <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          style={{ display: "none" }} onChange={handleLogoSelect} />
                      </div>
                    </div>
                  </Field>

                  {/* Live preview */}
                  <div style={{ background: C.surface2, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>Предпросмотр сайдбара</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {logoPreview ? (
                        <img src={logoPreview} alt="preview"
                          style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 6 }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: brandingForm.primary_color,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, color: "#fff" }}>⬡</div>
                      )}
                      <span style={{ fontWeight: 700, fontSize: 14, color: brandingForm.primary_color }}>
                        {brandingForm.company_name || 'EngHub'}
                      </span>
                    </div>
                  </div>

                  {brandingMsg && (
                    <div style={{ fontSize: 13, fontWeight: 500, padding: "8px 12px", borderRadius: 8,
                      color: brandingMsg.startsWith("✓") ? C.green : C.red,
                      background: (brandingMsg.startsWith("✓") ? C.green : C.red) + "10" }}>
                      {brandingMsg}
                    </div>
                  )}

                  <button className="btn btn-primary" onClick={saveBranding} disabled={brandingSaving}
                    style={{ opacity: brandingSaving ? 0.7 : 1 }}>
                    {brandingSaving ? "Сохраняется..." : "Сохранить брендинг"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════ USERS ═══════════════════════════════════ */}
          {tab === "users" && (
            <div>
              <div className="page-header">
                <div>
                  <div className="page-label">Управление</div>
                  <div className="page-title">Пользователи системы</div>
                </div>
              </div>

              {/* Group by role */}
              {(["admin", "gip", "lead", "lead_engineer", "engineer", "reviewer", "observer"] as string[]).map(role => {
                const roleUsers = users.filter(u => u.role === role);
                if (roleUsers.length === 0) return null;
                return (
                  <div key={role} style={{ marginBottom: 28 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <Badge label={roleLabels[role] || role} color={roleColor(role)} />
                      <span style={{ fontSize: 12, color: C.textMuted }}>{roleUsers.length} чел.</span>
                    </div>
                    <div className="task-list">
                      {roleUsers.map(u => (
                        <div key={u.id} className="task-row" style={{
                          cursor: "default",
                          opacity: u.is_active === false ? 0.5 : 1,
                        }}>
                          <AvatarComp user={u} size={40} C={C} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
                              {u.full_name}
                              {u.is_active === false && <Badge label="Отключён" color={C.textMuted} />}
                            </div>
                            <div style={{ fontSize: 12, color: C.textMuted }}>
                              {u.position || roleLabels[u.role] || u.role}
                              {u.dept_id ? ` · ${getDeptName(u.dept_id)}` : ""}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: C.textMuted, flexShrink: 0 }}>{u.email}</div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button className="btn btn-sm"
                              style={{ background: C.accent + "15", border: `1px solid ${C.accent}30`, color: C.accent }}
                              onClick={() => { setPasswordUser(u); setNewPassword(""); setPasswordMsg(""); setShowPasswordModal(true); }}>
                              🔑
                            </button>
                            <button className="btn btn-sm"
                              style={{ background: C.blue + "15", border: `1px solid ${C.blue}30`, color: C.blue }}
                              onClick={() => { setEditUser(u); setForm({ ...u, password: "" }); setMsg(""); setShowUserModal(true); }}>
                              Изменить
                            </button>
                            <button className="btn btn-sm"
                              style={{
                                background: (u.is_active === false ? C.green : C.orange) + "15",
                                border: `1px solid ${(u.is_active === false ? C.green : C.orange)}30`,
                                color: u.is_active === false ? C.green : C.orange,
                              }}
                              onClick={() => toggleUserActive(u)}>
                              {u.is_active === false ? "Включить" : "Откл."}
                            </button>
                            <button className="btn btn-danger btn-sm"
                              onClick={() => deleteUser(u)}>
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {users.length === 0 && <div className="empty-state">Нет пользователей</div>}
            </div>
          )}

          {/* ════════════════════════ DEPARTMENTS ════════════════════════════ */}
          {tab === "depts" && (
            <div>
              <div className="page-header">
                <div>
                  <div className="page-label">Управление</div>
                  <div className="page-title">Отделы</div>
                </div>
              </div>

              {/* Active depts */}
              <div style={{ marginBottom: 8, fontSize: 12, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Активные отделы — {depts.filter(d => !d.is_archived).length}
              </div>
              <div className="dept-grid" style={{ marginBottom: 32 }}>
                {depts.filter(d => !d.is_archived).map(d => {
                  const members = deptUsers(d.id);
                  const head = users.find(u => u.id === d.head_id);
                  return (
                    <div key={d.id} className="card" style={{ padding: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                        <div style={{ fontWeight: 700, fontSize: 20, color: C.text }}>{d.name}</div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-sm"
                            style={{ background: C.blue + "15", border: `1px solid ${C.blue}30`, color: C.blue }}
                            onClick={() => {
                              setEditDept(d);
                              setDeptForm({ name: d.name, description: d.description || "", head_id: d.head_id ? String(d.head_id) : "" });
                              setMsg(""); setShowDeptModal(true);
                            }}>
                            ✎
                          </button>
                          <button className="btn btn-sm"
                            style={{ background: C.orange + "15", border: `1px solid ${C.orange}30`, color: C.orange }}
                            onClick={() => archiveDept(d)} title="Архивировать отдел">
                            📦
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteDept(d.id)}>✕</button>
                        </div>
                      </div>
                      {d.description && <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>{d.description}</div>}
                      {head && (
                        <div style={{ fontSize: 12, color: C.blue, marginBottom: 10 }}>
                          👤 Рук.: {head.full_name}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
                        {members.length} сотрудников
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {members.slice(0, 5).map(u => (
                          <div key={u.id} style={{ fontSize: 13, color: u.is_active === false ? C.textMuted : C.textDim,
                            opacity: u.is_active === false ? 0.6 : 1 }}>
                            {u.full_name}
                            <span style={{ color: C.textMuted }}> ({roleLabels[u.role] || u.role})</span>
                          </div>
                        ))}
                        {members.length > 5 && (
                          <div style={{ fontSize: 12, color: C.textMuted }}>...ещё {members.length - 5}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Archived depts */}
              {depts.filter(d => d.is_archived).length > 0 && (
                <>
                  <div style={{ marginBottom: 8, fontSize: 12, color: C.textMuted, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Архивные отделы — {depts.filter(d => d.is_archived).length}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {depts.filter(d => d.is_archived).map(d => (
                      <div key={d.id} className="card" style={{ padding: "14px 20px", display: "flex",
                        alignItems: "center", gap: 12, opacity: 0.7 }}>
                        <div style={{ flex: 1, fontWeight: 600, color: C.textMuted }}>{d.name}</div>
                        <Badge label="Архив" color={C.textMuted} />
                        <button className="btn btn-sm"
                          style={{ background: C.green + "15", border: `1px solid ${C.green}30`, color: C.green }}
                          onClick={() => archiveDept(d)}>
                          Восстановить
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteDept(d.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {depts.length === 0 && <div className="empty-state">Нет отделов</div>}
            </div>
          )}

          {/* ════════════════════════ ARCHIVE ════════════════════════════════ */}
          {tab === "archive" && (
            <div>
              <div className="page-header">
                <div>
                  <div className="page-label">Архив</div>
                  <div className="page-title">Архивные проекты</div>
                </div>
              </div>
              {archivedProjects.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📦</div>
                  Архив пуст — здесь появляются проекты, переданные в архив ГИПом
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {archivedProjects.map(p => (
                    <div key={p.id} className="card" style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 15, color: C.text }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>
                          {p.code}
                          {p.deadline ? ` · до ${p.deadline}` : ""}
                          {p.archived_at ? ` · архив. ${new Date(p.archived_at).toLocaleDateString('ru-RU')}` : ""}
                        </div>
                      </div>
                      <Badge label="В архиве" color={C.textMuted} />
                      <button className="btn btn-sm"
                        style={{ background: C.green + "15", border: `1px solid ${C.green}30`, color: C.green }}
                        onClick={() => restoreProject(p.id)}>
                        ↩ Восстановить
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => { setDeleteConfirm(p); setDeleteStep(0); }}>
                        🗑 Удалить
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════ AUDIT LOG ══════════════════════════════ */}
          {tab === "audit" && (
            <div>
              <div className="page-header">
                <div>
                  <div className="page-label">Журнал</div>
                  <div className="page-title">Аудит действий</div>
                </div>
              </div>
              {auditLogs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <div>Журнал пуст</div>
                  <button className="btn btn-sm" style={{ marginTop: 12, background: C.accent, color: "#fff" }}
                    onClick={loadAuditLogs}>
                    Загрузить журнал
                  </button>
                </div>
              ) : (
                <div className="task-list">
                  {auditLogs.map(log => (
                    <div key={log.id} className="task-row" style={{ cursor: "default" }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, background: C.surface2,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0
                      }}>
                        {log.action.startsWith("user") ? "👤"
                          : log.action.startsWith("dept") ? "🏢"
                          : log.action.startsWith("project") ? "📁"
                          : log.action.startsWith("org") ? "🏛"
                          : "📋"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{log.action}</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>
                          {log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ""}
                          {log.actor_email ? ` · ${log.actor_email}` : ""}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted, flexShrink: 0 }}>
                        {new Date(log.created_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
