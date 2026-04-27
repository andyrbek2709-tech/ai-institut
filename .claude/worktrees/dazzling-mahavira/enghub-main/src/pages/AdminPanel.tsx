import { useState, useEffect } from 'react';
import { DARK, LIGHT, roleLabels } from '../constants';
import { get, post, patch, del, createAuthUser, updateUserPassword } from '../api/supabase';
import { ThemeToggle, Modal, Field, AvatarComp, getInp } from '../components/ui';

interface AdminPanelProps { token: string; onLogout: () => void; dark: boolean; setDark: (v: boolean) => void; }

export function AdminPanel({ token, onLogout, dark, setDark }: AdminPanelProps) {
  const C = dark ? DARK : LIGHT;
  const [tab, setTab] = useState(localStorage.getItem('enghub_admin_tab') || "users");
  const [users, setUsers] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [newDept, setNewDept] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [deleteStep, setDeleteStep] = useState(0);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUser, setPasswordUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  const emptyUser = { full_name: "", email: "", password: "", role: "engineer", position: "", dept_id: "" };
  const [form, setForm] = useState<any>(emptyUser);

  useEffect(() => { loadUsers(); loadDepts(); loadArchived(); }, []);
  useEffect(() => { document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => { localStorage.setItem('enghub_admin_tab', tab); }, [tab]);

  const loadUsers = async () => { const data = await get("app_users?order=id", token); if (Array.isArray(data)) setUsers(data); };
  const loadDepts = async () => { const data = await get("departments?order=name", token); if (Array.isArray(data)) setDepts(data); };
  const loadArchived = async () => { const data = await get("projects?archived=eq.true&order=id", token); if (Array.isArray(data)) setArchivedProjects(data); };

  const saveUser = async () => {
    if (!form.full_name || !form.email || !form.role) return;
    setSaving(true);
    try {
      if (editUser) { await patch(`app_users?id=eq.${editUser.id}`, { full_name: form.full_name, position: form.position, role: form.role, dept_id: form.dept_id || null }, token); }
      else { const authData = await createAuthUser(form.email, form.password || "Enghub2025!"); await post("app_users", { email: form.email, full_name: form.full_name, position: form.position, role: form.role, dept_id: form.dept_id || null, supabase_uid: authData.user?.id || null }, token); }
      setForm(emptyUser); setEditUser(null); setShowUserModal(false); loadUsers();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const deleteUser = async (u: any) => { await del(`app_users?id=eq.${u.id}`, token); loadUsers(); };
  const saveDept = async () => { if (!newDept.trim()) return; await post("departments", { name: newDept.trim() }, token); setNewDept(""); loadDepts(); };
  const deleteDept = async (id: number) => { await del(`departments?id=eq.${id}`, token); loadDepts(); };
  const deleteProject = async (id: number) => { await del(`projects?id=eq.${id}`, token); setDeleteConfirm(null); setDeleteStep(0); loadArchived(); };
  const getDeptName = (id: any) => depts.find(d => d.id === id)?.name || "—";

  const navTabs = [
    { id: "users", icon: "👥", label: "Пользователи" },
    { id: "depts", icon: "🏢", label: "Отделы" },
    { id: "archive", icon: "📦", label: "Архив проектов" },
  ];

  return (
    <div className="app-root">
      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="delete-overlay">
          <div className="delete-box">
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8, color: C.red }}>
              {deleteStep === 0 && "Удалить проект?"}{deleteStep === 1 && "Вы уверены?"}{deleteStep === 2 && "Это действие необратимо!"}
            </div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 24 }}>
              {deleteStep === 0 && `"${deleteConfirm.name}" будет удалён из архива`}{deleteStep === 1 && "Все данные проекта будут уничтожены"}{deleteStep === 2 && "Нажмите УДАЛИТЬ чтобы подтвердить окончательно"}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn btn-secondary" onClick={() => { setDeleteConfirm(null); setDeleteStep(0); }}>Отмена</button>
              <button className="btn" style={{ background: C.red, color: "#fff" }} onClick={() => { if (deleteStep < 2) setDeleteStep(s => s + 1); else deleteProject(deleteConfirm.id); }}>
                {deleteStep === 2 ? "УДАЛИТЬ НАВСЕГДА" : "Удалить →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUserModal && (
        <Modal title={editUser ? "Редактировать" : "Новый пользователь"} onClose={() => { setShowUserModal(false); setEditUser(null); setForm(emptyUser); }} C={C}>
          <div className="form-stack">
            <Field label="ФИО *" C={C}><input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Иванов Иван Иванович" style={getInp(C)} /></Field>
            {!editUser && <Field label="EMAIL *" C={C}><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="ivanov@company.com" style={getInp(C)} /></Field>}
            {!editUser && <Field label="ПАРОЛЬ" C={C}><input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} type="password" placeholder="Enghub2025!" style={getInp(C)} /></Field>}
            <Field label="РОЛЬ *" C={C}><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={getInp(C)}><option value="gip">ГИП</option><option value="lead">Руководитель отдела</option><option value="engineer">Инженер</option></select></Field>
            <Field label="ДОЛЖНОСТЬ" C={C}><input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="Ведущий инженер" style={getInp(C)} /></Field>
            {(form.role === "lead" || form.role === "engineer") && (
              <Field label="ОТДЕЛ" C={C}><select value={form.dept_id} onChange={e => setForm({ ...form, dept_id: e.target.value })} style={getInp(C)}><option value="">— Выбрать отдел —</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
            )}
            <button className="btn btn-primary" onClick={saveUser} disabled={saving || !form.full_name || !form.email} style={{ width: "100%", opacity: (!form.full_name || !form.email) ? 0.5 : 1 }}>
              {saving ? "Сохраняется..." : editUser ? "Сохранить изменения" : "Создать пользователя"}
            </button>
          </div>
        </Modal>
      )}

      {showDeptModal && (
        <Modal title="Управление отделами" onClose={() => setShowDeptModal(false)} C={C}>
          <div className="form-stack">
            <div style={{ display: "flex", gap: 8 }}>
              <input value={newDept} onChange={e => setNewDept(e.target.value)} placeholder="Название отдела (напр. ВК)" onKeyDown={e => e.key === "Enter" && saveDept()} style={{ ...getInp(C), flex: 1 }} />
              <button className="btn btn-primary btn-sm" onClick={saveDept}>+ Добавить</button>
            </div>
            {depts.map(d => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.surface2, borderRadius: 10, padding: "12px 16px" }}>
                <span style={{ fontWeight: 600, color: C.text }}>{d.name}</span>
                <button className="btn btn-danger btn-sm" onClick={() => deleteDept(d.id)}>Удалить</button>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {showPasswordModal && passwordUser && (
        <Modal title={`Сменить пароль — ${passwordUser.full_name}`} onClose={() => { setShowPasswordModal(false); setPasswordUser(null); setNewPassword(""); setPasswordMsg(""); }} C={C}>
          <div className="form-stack">
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>{passwordUser.email}</div>
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
                  if (!passwordUser.supabase_uid) { setPasswordMsg("✗ У пользователя нет Supabase UID"); setSaving(false); return; }
                  const res = await updateUserPassword(passwordUser.supabase_uid, newPassword);
                  if (res.id) { setPasswordMsg("✓ Пароль успешно изменён!"); setNewPassword(""); }
                  else { setPasswordMsg(`✗ Ошибка: ${res.msg || res.error_description || "Неизвестная ошибка"}`); }
                } catch (e) { setPasswordMsg("✗ Ошибка сети"); }
                setSaving(false);
              }}>
              {saving ? "Сохраняется..." : "Сменить пароль"}
            </button>
          </div>
        </Modal>
      )}

      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon" style={{ background: C.red }}>⬡</div>
          <div className="sidebar-logo-text">EngHub</div>
        </div>
        <div className="sidebar-nav">
          <div className="sidebar-section-label">Администрирование</div>
          {navTabs.map(t => (
            <button key={t.id} className={`sidebar-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <span className="sidebar-btn-icon">{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <button className="sidebar-btn" onClick={onLogout} style={{ color: "#ef4444" }}>
            <span className="sidebar-btn-icon">⏻</span><span>Выйти</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div className="main-area">
        <div className="topbar">
          <div className="topbar-left">
            <div className="topbar-title">Администрирование</div>
            <span style={{ fontSize: 11, color: C.red, background: C.red + "15", padding: "3px 10px", borderRadius: 6, fontWeight: 700 }}>ADMIN</span>
          </div>
          <div className="topbar-right">
            <ThemeToggle dark={dark} setDark={setDark} C={C} />
            {tab === "users" && <button className="btn btn-primary btn-sm" onClick={() => { setForm(emptyUser); setEditUser(null); setShowUserModal(true); }}>+ Новый пользователь</button>}
            {tab === "depts" && <button className="btn btn-primary btn-sm" onClick={() => setShowDeptModal(true)}>+ Новый отдел</button>}
          </div>
        </div>

        <div className="content">
          {tab === "users" && (
            <div>
              <div className="page-header"><div><div className="page-label">Управление</div><div className="page-title">Пользователи системы</div></div></div>
              {(["gip", "lead", "engineer"] as string[]).map(role => {
                const roleUsers = users.filter(u => u.role === role);
                if (roleUsers.length === 0) return null;
                return (
                  <div key={role} style={{ marginBottom: 24 }}>
                    <div className="page-label" style={{ marginBottom: 10 }}>{roleLabels[role].toUpperCase()} — {roleUsers.length}</div>
                    <div className="task-list">
                      {roleUsers.map(u => (
                        <div key={u.id} className="task-row" style={{ cursor: "default" }}>
                          <AvatarComp user={u} size={40} C={C} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{u.full_name}</div>
                            <div style={{ fontSize: 12, color: C.textMuted }}>{u.position || roleLabels[role]}{u.dept_id ? ` · ${getDeptName(u.dept_id)}` : ""}</div>
                          </div>
                          <div style={{ fontSize: 12, color: C.textMuted }}>{u.email}</div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn-sm" style={{ background: C.accent + "15", border: `1px solid ${C.accent}30`, color: C.accent }} onClick={() => { setPasswordUser(u); setNewPassword(""); setPasswordMsg(""); setShowPasswordModal(true); }}>🔑 Пароль</button>
                            <button className="btn btn-sm" style={{ background: C.blue + "15", border: `1px solid ${C.blue}30`, color: C.blue }} onClick={() => { setEditUser(u); setForm({ ...u, password: "" }); setShowUserModal(true); }}>Изменить</button>
                            <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm(`Удалить ${u.full_name}?`)) deleteUser(u); }}>Удалить</button>
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

          {tab === "depts" && (
            <div>
              <div className="page-header"><div><div className="page-label">Управление</div><div className="page-title">Отделы</div></div></div>
              <div className="dept-grid">
                {depts.map(d => {
                  const deptUsers = users.filter(u => u.dept_id === d.id);
                  return (
                    <div key={d.id} className="card" style={{ padding: 20 }}>
                      <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4, color: C.text }}>{d.name}</div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>{deptUsers.length} сотрудников</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {deptUsers.map(u => (<div key={u.id} style={{ fontSize: 13, color: C.textDim }}>{u.full_name} <span style={{ color: C.textMuted }}>({u.position || roleLabels[u.role]})</span></div>))}
                      </div>
                      <button className="btn btn-danger btn-sm" style={{ marginTop: 14 }} onClick={() => deleteDept(d.id)}>Удалить отдел</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "archive" && (
            <div>
              <div className="page-header"><div><div className="page-label">Архив</div><div className="page-title">Архивные проекты</div></div></div>
              {archivedProjects.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">📦</div>Архив пуст</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {archivedProjects.map(p => (
                    <div key={p.id} className="card" style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 15, color: C.text }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>{p.code} · до {p.deadline}</div>
                      </div>
                      <span style={{ fontSize: 11, color: C.textMuted, background: C.surface2, padding: "5px 12px", borderRadius: 8 }}>В архиве</span>
                      <button className="btn btn-danger btn-sm" onClick={() => { setDeleteConfirm(p); setDeleteStep(0); }}>🗑 Удалить навсегда</button>
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
