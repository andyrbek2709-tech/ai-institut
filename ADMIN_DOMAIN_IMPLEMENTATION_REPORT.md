# ADMIN DOMAIN IMPLEMENTATION REPORT

**Date:** 2026-05-08
**Commit:** `1e247f6`
**Status:** ✅ Deployed to Railway

---

## 1. Business Model Implemented

```
ADMIN role manages:
  ├── Organization branding (name, logo, color)
  ├── Users (create, edit, disable, delete, reset password)
  ├── Departments (CRUD, head, archive)
  ├── Project Archive (soft-delete lifecycle, restore, permanent delete)
  └── Audit Log (all admin actions)

GIP role manages:
  ├── Projects (active, archive, workflows)
  └── Engineering process (tasks, reviews, drawings, specs)

Separation: Admin statistics about projects REMOVED from admin panel.
```

---

## 2. New Database Tables

### `organization_settings`
```sql
id bigint PRIMARY KEY DEFAULT 1        -- singleton row enforced by CHECK
company_name text NOT NULL DEFAULT 'EngHub'
logo_url text                          -- Supabase Storage public URL
primary_color text DEFAULT '#2b5bb5'   -- hex accent color
updated_at timestamptz
CONSTRAINT org_settings_singleton CHECK (id = 1)
```
RLS: authenticated/anon can read; only admin role can write.

### `audit_logs`
```sql
id bigserial PRIMARY KEY
action text NOT NULL                   -- user.create, dept.archive, org.update, etc.
entity_type text NOT NULL              -- app_users, departments, projects, etc.
entity_id text                         -- numeric or UUID of the affected record
actor_id bigint → app_users(id)
actor_email text
payload jsonb                          -- action-specific metadata
created_at timestamptz
```
RLS: only admin role can read/write.
Indexes: `actor_id`, `created_at DESC`.

---

## 3. New Columns

### `app_users`
- `is_active boolean DEFAULT true` — soft-disable without deleting auth account

### `departments`
- `head_id bigint → app_users(id)` — department head (nullable)
- `is_archived boolean DEFAULT false` — soft-archive
- `description text` — optional description

### `projects`
- `archived_at timestamptz` — timestamp of archival (set by GIP workflow)

---

## 4. Backend API Routes

All routes in `services/api-server/src/routes/admin.ts`, registered at `/api/`.

### Auth enforcement
Every protected route calls `verifyAdmin(token)` which:
1. Calls `supabase.auth.getUser(token)` to verify JWT signature
2. Queries `app_users` by `supabase_uid` and checks `role = 'admin'`
3. Returns `{ appUserId, email }` for audit logging

### User Management `POST /api/admin-users`

| action | params | description |
|--------|--------|-------------|
| `create` | email, password, full_name, role, dept_id | Creates Supabase Auth user + app_users record atomically. Rollback on failure. |
| `update` | user_id, full_name?, position?, role?, dept_id?, is_active? | Partial update of app_users |
| `reset_password` | supabase_uid, new_password | Calls `auth.admin.updateUserById` |
| `disable` | user_id, is_active | Toggles `is_active` (does NOT delete auth user) |
| `delete` | user_id, supabase_uid? | Deletes app_users + auth user. Cannot delete yourself. |
| `update_role` | user_id, role, dept_id? | Role-only update |

### Organization Settings

```
GET  /api/admin/organization       — returns organization_settings row
PATCH /api/admin/organization      — update company_name, logo_url, primary_color
POST /api/admin/branding/logo      — upload logo (base64 → Storage), update logo_url
GET  /api/admin/org-public         — public branding (no auth required, used by login page)
```

### Departments

```
GET    /api/admin/departments       — list with joined head user info
POST   /api/admin/departments       — create (name, description?, head_id?)
PATCH  /api/admin/departments/:id   — update name/description/head/is_archived
DELETE /api/admin/departments/:id   — hard delete (blocked if dept has users)
```

### Archive (Project Lifecycle)

```
POST   /api/admin/projects/:id/restore  — set archived=false, archived_at=null
DELETE /api/admin/projects/:id          — permanent delete (only if archived=true)
```

### Audit

```
GET /api/admin/audit-logs?limit=50     — recent admin actions (max 200)
```

---

## 5. Frontend — AdminPanel.tsx (Full Rewrite)

### Navigation tabs

| Tab | Section | Description |
|-----|---------|-------------|
| 🏛 Организация | org | Stats, branding settings, live preview |
| 👥 Пользователи | users | Full user management, grouped by role |
| 🏢 Отделы | depts | CRUD with heads, archive/restore |
| 📦 Архив | archive | Archived projects, restore, permanent delete |
| 📋 Аудит | audit | Admin action log |

### Removed from Admin panel
- "Хранилище" tab (storage stats) — not admin concern
- Project analytics/statistics — admin ≠ GIP
- Irrelevant metrics

### Branding system
1. Admin uploads logo → base64 → `POST /api/admin/branding/logo` → stored in Supabase Storage `project-files/branding/`
2. Admin sets company_name and primary_color → `PATCH /api/admin/organization`
3. Live preview: mini sidebar with logo + name + color
4. All users load branding via `GET /api/admin/org-public` (public, cached)
5. Sidebar in App.tsx shows org logo + name from `loadBranding()`

### User management
- Roles: admin, gip, lead, lead_engineer, engineer, reviewer, observer (7 roles)
- Grouped list by role with color badges
- Inline actions: 🔑 Password | Edit | Disable/Enable | Delete
- Disabled users shown at 50% opacity with "Отключён" badge

### Department management
- Active / Archived separation
- Assign department head from lead/gip users
- Archive dept (users not affected)
- Blocking delete if dept has users (backend enforced)

### Archive lifecycle
```
GIP archives project → archived=true, archived_at=timestamp
Admin sees in Archive tab
Admin can RESTORE → archived=false (returns to active projects)
Admin can PERMANENT DELETE → triple confirmation flow → hard delete
```

---

## 6. RBAC Matrix

| Action | admin | gip | lead | engineer | reviewer | observer |
|--------|-------|-----|------|----------|----------|---------|
| View org settings | ✓ | - | - | - | - | - |
| Update branding | ✓ | - | - | - | - | - |
| Create user | ✓ | - | - | - | - | - |
| Disable user | ✓ | - | - | - | - | - |
| Delete user | ✓ | - | - | - | - | - |
| Manage departments | ✓ | - | - | - | - | - |
| Restore archived project | ✓ | - | - | - | - | - |
| Permanent delete project | ✓ | - | - | - | - | - |
| View audit log | ✓ | - | - | - | - | - |

Enforcement: Backend `verifyAdmin()` on all `/api/admin/*` routes.

---

## 7. Audit Logging

All admin actions write to `audit_logs`:

| Action name | Trigger |
|-------------|---------|
| `user.create` | New user created |
| `user.update` | User profile updated |
| `user.update_role` | Role changed |
| `user.reset_password` | Password reset by admin |
| `user.disable` | User deactivated |
| `user.enable` | User reactivated |
| `user.delete` | User permanently deleted |
| `dept.create` | Department created |
| `dept.update` | Department renamed/updated |
| `dept.archive` | Department archived |
| `dept.restore` | Department restored |
| `dept.delete` | Department deleted |
| `org.update` | Org settings updated |
| `org.upload_logo` | Logo uploaded |
| `project.restore` | Project restored from archive |
| `project.permanent_delete` | Project permanently deleted |

---

## 8. Branding Architecture

```
Admin Panel (Org tab)
  ↓ uploads PNG/SVG/JPG (< 2MB)
POST /api/admin/branding/logo
  ↓ base64 decode → Buffer
  ↓ supabase.storage.from('project-files').upload('branding/logo_timestamp.ext')
  ↓ getPublicUrl() → https://...supabase.co/storage/v1/object/public/project-files/branding/logo.png
  ↓ UPDATE organization_settings SET logo_url = public_url

All frontends load branding:
GET /api/admin/org-public (no auth) → { company_name, logo_url, primary_color }
  ↓
Sidebar: logo img or default hexagon
App title: company_name
Accent: primary_color (for future theme tokens)
```

---

## 9. Remaining Gaps / Future Work

1. **Login page branding** — LoginPage.tsx doesn't yet call `/api/admin/org-public`. Branding on login screen would require a separate `useEffect` there.
2. **Primary color propagation** — The `primary_color` is stored but not yet applied to CSS variables dynamically (sidebar accent is hardcoded). Future: inject `--accent` CSS variable from org settings.
3. **observer/reviewer roles** — These roles exist in the data model and can be assigned, but the main App.tsx currently only has routing logic for admin/gip/lead/engineer. An observer would see the engineer view until observer-specific UI is added.
4. **Dept-scoped RLS** — Currently departments have open anon-read RLS (needed for user assignments). Could be tightened to authenticated-only.
5. **Bulk user import** — Not implemented (CSV upload of users).

---

## 10. Files Changed

```
services/api-server/src/routes/admin.ts    NEW — 340 lines
services/api-server/src/index.ts           +2 lines (import + register)
enghub-main/src/pages/AdminPanel.tsx       REWRITE — 650 lines (was 275)
enghub-main/src/constants.ts              +13 lines (roles expanded)
enghub-main/src/api/http.ts               +2 lines (apiPatch)
enghub-main/src/App.tsx                   +5 lines (branding + archived_at)
STATE.md                                   +60 lines (changelog entry)
```

Supabase migration: `admin_domain_foundation` (applied to `inachjylaqelysiwtsux`)
