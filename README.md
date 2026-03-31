# EngHub — Инженерная платформа проектного института

> Единый документ: текущее состояние системы + полный план эволюции.
> Любой агент может продолжить работу с любого момента, используя этот файл.

---

## ТЕКУЩЕЕ СОСТОЯНИЕ (v6.8)

### Что это

Веб-платформа управления инженерными проектами. React + Supabase + Vercel.
4 роли: Администратор, ГИП, Руководитель отдела, Инженер.

### Стек технологий

| Компонент | Технология |
|-----------|-----------|
| Фронтенд | React 18 + TypeScript |
| Хостинг | Vercel |
| БД / Auth | Supabase (PostgreSQL + pgvector) |
| Стили | Vanilla CSS (Figma Tokens) |
| AI поиск | OpenAI Embeddings + Claude (Anthropic) |
| Векторизация | Supabase Edge Functions (Deno) |
| Экспорт | docx v9.6.1 (Word), SpreadsheetML (Excel) |

### Структура проекта

```
/
├── README.md                          # ЭТО ВОТ ЭТОТ ФАЙЛ (единственный README)
├── package.json                       # Корневой (делегирует в enghub-main)
├── vercel.json                        # Конфигурация деплоя
├── supabase/
│   ├── functions/
│   │   ├── vectorize-doc/index.ts     # Edge Function: PDF/DOCX -> pgvector
│   │   └── search-normative/index.ts  # Edge Function: семантический поиск
│   └── migrations/
│       └── 001_rag_setup.sql          # pgvector + normative_chunks + search_normative()
└── enghub-main/
    ├── api/
    │   └── orchestrator.js            # Vercel serverless: AI агенты + RAG
    ├── src/
    │   ├── api/
    │   │   └── supabase.ts            # REST-обертка (get/post/patch/del, auth)
    │   ├── components/
    │   │   ├── ui.tsx                 # Modal, Field, AvatarComp, BadgeComp, ThemeToggle
    │   │   ├── Notifications.tsx      # Toast-уведомления
    │   │   └── CopilotPanel.tsx       # AI Copilot: чат + ai_actions polling
    │   ├── pages/
    │   │   ├── LoginPage.tsx          # Email/password -> Supabase Auth
    │   │   ├── AdminPanel.tsx         # Управление пользователями/отделами
    │   │   └── ConferenceRoom.tsx     # Чат внутри проекта
    │   ├── calculations/
    │   │   ├── CalculationView.tsx    # Split-pane UI расчетов
    │   │   ├── registry.ts           # 90+ инженерных шаблонов
    │   │   ├── DocxExporter.ts       # Экспорт расчетов в Word
    │   │   └── types.ts              # CalculationTemplate interface
    │   ├── App.tsx                    # Главный компонент (~1500 строк)
    │   ├── constants.ts              # statusMap, roleLabels, темы DARK/LIGHT
    │   ├── styles.css                # Дизайн-система
    │   └── index.tsx                 # React entry point
    └── .env.local                    # Локальные ключи (НЕ в git)
```

---

## ТЕКУЩАЯ БАЗА ДАННЫХ

> Таблицы существуют в Supabase. В git только миграция для RAG (001_rag_setup.sql).
> Остальные таблицы были созданы через Supabase Dashboard.

### Таблица: projects

| Поле | Тип | Описание |
|------|-----|----------|
| id | integer PK | Автоинкремент |
| name | text | Название проекта |
| code | text | Код (напр. "ТЭЦ-2025-01") |
| deadline | text | ISO дата дедлайна |
| status | text | "active" или "review" |
| depts | jsonb | Массив ID отделов [1, 3, 5] |
| archived | boolean | По умолчанию false |
| progress | integer | 0-100, автоматически из задач |

### Таблица: tasks

| Поле | Тип | Описание |
|------|-----|----------|
| id | integer PK | Автоинкремент |
| name | text | Название задачи |
| project_id | integer FK | -> projects.id |
| dept | text | Название отдела (текст, НЕ id) |
| assigned_to | integer FK | -> app_users.id (nullable) |
| status | text | todo/inprogress/review_lead/review_gip/revision/done |
| priority | text | low/medium/high/critical |
| deadline | text | ISO дата |
| comment | text | Замечания при ревизии (nullable) |
| revision_num | integer | Номер ревизии (0, 1, 2...) |
| parent_task_id | integer FK | -> tasks.id (предыдущая ревизия) |
| revision_count | integer | Общее количество ревизий |
| is_assignment | boolean | Задание смежникам |
| source_dept | integer | ID отдела-источника |
| assignment_status | text | pending_accept/accepted/rejected |

### Таблица: app_users

| Поле | Тип | Описание |
|------|-----|----------|
| id | integer PK | Автоинкремент |
| email | text UNIQUE | Email для входа |
| full_name | text | ФИО |
| role | text | gip/lead/engineer |
| position | text | Должность (nullable) |
| dept_id | integer FK | -> departments.id (nullable) |
| supabase_uid | uuid | -> auth.users.id |

### Таблица: departments

| Поле | Тип | Описание |
|------|-----|----------|
| id | integer PK | Автоинкремент |
| name | text | Название (ОВ, ВК, ЭО и т.д.) |

### Таблица: messages

| Поле | Тип | Описание |
|------|-----|----------|
| id | integer PK | Автоинкремент |
| text | text | Текст сообщения |
| user_id | integer FK | -> app_users.id |
| project_id | integer FK | -> projects.id |
| task_id | integer FK | -> tasks.id (nullable = project-level) |
| type | text | "text" / "call_start" |
| created_at | timestamptz | Время создания |

### Таблица: normative_docs

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | UUID |
| name | text | Имя файла |
| file_type | text | MIME тип |
| file_path | text | Путь в Supabase Storage |
| status | text | pending/processing/ready/error |
| content | text | Первые 500 символов (preview) |

### Таблица: normative_chunks (миграция в git)

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | UUID |
| doc_id | uuid FK | -> normative_docs.id |
| doc_name | text | Имя документа (денормализованно) |
| chunk_index | integer | Порядок в документе |
| content | text | Текст чанка (~800 символов) |
| embedding | vector(1536) | OpenAI text-embedding-3-small |
| created_at | timestamptz | |

### Таблица: ai_actions

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | UUID |
| project_id | uuid FK | -> projects.id |
| user_id | uuid FK | -> app_users.id |
| action_type | text | "create_tasks" (расширяемо) |
| agent_type | text | "task_manager" / "rag_assistant" / "router" |
| payload | jsonb | Данные действия |
| status | text | pending/approved/rejected |
| created_at | timestamptz | |

### Функция: search_normative (в git)

```sql
search_normative(query_embedding vector(1536), match_count int = 5)
RETURNS TABLE (id, doc_id, doc_name, content, similarity float)
-- Косинусное сходство через pgvector
```

---

## ТЕКУЩИЙ WORKFLOW ЗАДАЧ

```
todo -> inprogress -> review_lead -> review_gip -> done
                                  \-> revision -> inprogress (новый цикл)
```

Роли:
- **Engineer**: todo -> inprogress, inprogress -> review_lead, revision -> inprogress
- **Lead**: review_lead -> review_gip ИЛИ review_lead -> revision
- **GIP**: review_gip -> done ИЛИ review_gip -> revision

---

## ТЕКУЩИЙ ORCHESTRATOR (api/orchestrator.js)

3 обработчика:

1. **action='search_normative'** — семантический поиск по нормативке (embed query -> pgvector -> результаты)
2. **use_rag=true** — RAG: embed query -> pgvector -> Claude haiku ответ с контекстом
3. **Intent "задачи"** — regex `/задач|сделай|создай|task|план|график/` -> генерация задач -> ai_actions (pending)

### API формат запроса

```json
POST /api/orchestrator
{
  "user_id": "uuid",
  "project_id": "uuid",
  "message": "текст",
  "use_rag": true/false,
  "action": "search_normative",
  "query": "текст для поиска",
  "match_count": 20
}
```

---

## ТЕКУЩИЙ COPILOT (CopilotPanel.tsx)

- Чат-интерфейс (user/ai bubbles)
- Переключатель "База знаний" (RAG mode)
- Отправка message -> /api/orchestrator
- Polling ai_actions каждые 3 секунды
- Карточки pending actions с кнопками Approve/Reject
- При approve create_tasks -> POST tasks для каждой задачи -> onTaskCreated() callback

---

## ТЕКУЩИЕ ЭКРАНЫ UI

| Screen | Значение | Описание |
|--------|----------|----------|
| dashboard | "dashboard" | Обзор: статистика, прогресс проектов |
| projects_list | "projects_list" | Список проектов |
| project | "project" | Детали проекта (табы: tasks/assignments/conference) |
| tasks | "tasks" | Канбан-доска задач |
| calculations | "calculations" | Модуль расчетов (90+ шаблонов) |
| normative | "normative" | Нормативная база (RAG) |

Навигация в сайдбаре. Мобильная нижняя навигация на <480px.

---

## ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ

### Файл enghub-main/.env.local (локально)

```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
REACT_APP_SUPABASE_SERVICE_KEY=your-service-key
```

### Vercel Dashboard -> Settings -> Environment Variables

| Переменная | Где используется |
|-----------|-----------------|
| REACT_APP_SUPABASE_URL | Frontend (React) |
| REACT_APP_SUPABASE_ANON_KEY | Frontend (React) |
| REACT_APP_SUPABASE_SERVICE_KEY | Frontend (admin ops) |
| SUPABASE_URL | orchestrator.js |
| SUPABASE_SERVICE_KEY | orchestrator.js |
| OPENAI_API_KEY | orchestrator.js + Edge Functions |
| ANTHROPIC_API_KEY | orchestrator.js (Claude) |

---

## ЛОКАЛЬНЫЙ ЗАПУСК

```bash
cd enghub-main
npm install
npm start         # Dev server на порту 3000
npm run build     # Production build
```

## ДЕПЛОЙ

```bash
git push origin main   # Vercel автоматически соберет
```

Edge Functions:
```bash
supabase functions deploy vectorize-doc --project-ref <ref>
supabase secrets set OPENAI_API_KEY=... --project-ref <ref>
```

---

# ПЛАН ЭВОЛЮЦИИ: ОТ ЗАДАЧ К ЧЕРТЕЖАМ

> Цель: превратить EngHub в полноценную операционную среду проектного института.
> Центральная сущность = ЧЕРТЕЖ. Иерархия: Проект -> Раздел -> Чертеж -> Задача.
> AI помогает, но НЕ принимает решений.

## ПРИНЦИПЫ

1. НЕ ломать существующий функционал
2. НЕ усложнять архитектуру (без микросервисов, MCP, n8n)
3. ВСЕ строить вокруг чертежей
4. ВСЕ AI через orchestrator.js
5. Каждый агент = функция внутри orchestrator
6. Инкрементальный деплой (каждая фаза работает самостоятельно)

---

## ФАЗА 1: Таблица drawings + базовый UI

### Статус: НЕ НАЧАТО

### 1.1 SQL миграция (002_drawings.sql)

```sql
-- Таблица дисциплин (разделов проекта)
-- Дисциплины привязаны к отделам (departments)
-- Не создаем отдельную таблицу, используем departments.name как discipline

-- Главная таблица: чертежи
CREATE TABLE IF NOT EXISTS drawings (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number TEXT NOT NULL,                          -- Номер чертежа: "ОВ-001"
  title TEXT NOT NULL,                           -- Название: "План 1 этажа. Отопление"
  discipline TEXT NOT NULL,                      -- Раздел/марка: "ОВ", "ВК", "ЭО"
  status TEXT NOT NULL DEFAULT 'in_progress',    -- in_progress/review/gip/approved
  current_revision TEXT NOT NULL DEFAULT 'R0',   -- Текущая ревизия
  assigned_to INTEGER REFERENCES app_users(id),  -- Ответственный инженер
  created_by INTEGER REFERENCES app_users(id),   -- Кто создал
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Уникальность номера в рамках проекта
  UNIQUE(project_id, number)
);

-- Индексы
CREATE INDEX idx_drawings_project ON drawings(project_id);
CREATE INDEX idx_drawings_discipline ON drawings(discipline);
CREATE INDEX idx_drawings_status ON drawings(status);
CREATE INDEX idx_drawings_assigned ON drawings(assigned_to);
```

### 1.2 Добавить в constants.ts

```typescript
// Статусы чертежей
export const drawingStatusMap = {
  in_progress: { label: "В работе", color: "#4a9eff", bg: "#4a9eff15" },
  review:      { label: "Проверка", color: "#a855f7", bg: "#a855f715" },
  gip:         { label: "ГИП",     color: "#f5a623", bg: "#f5a62315" },
  approved:    { label: "Выпущен", color: "#2ac769", bg: "#2ac76915" }
}

// Дисциплины (разделы проекта)
export const disciplines = [
  { code: "АР", name: "Архитектурные решения" },
  { code: "КР", name: "Конструктивные решения" },
  { code: "ОВ", name: "Отопление и вентиляция" },
  { code: "ВК", name: "Водоснабжение и канализация" },
  { code: "ЭО", name: "Электрооборудование" },
  { code: "ЭС", name: "Электроснабжение" },
  { code: "СС", name: "Слаботочные системы" },
  { code: "ТМ", name: "Теплоснабжение" },
  { code: "НВ", name: "Наружные сети" },
  { code: "ГП", name: "Генплан" },
  { code: "ПОС", name: "Организация строительства" },
  { code: "ПБ", name: "Пожарная безопасность" }
]
```

### 1.3 Новый экран UI в App.tsx

Добавить screen = "drawings" в навигацию:
```typescript
navItems.push({ id: "drawings", icon: "▣", label: "Чертежи" })
```

Новый таб внутри проекта:
```typescript
// sideTab: "tasks" | "assignments" | "conference" | "drawings"
```

### 1.4 Компонент DrawingsPanel

Создать файл: `enghub-main/src/components/DrawingsPanel.tsx`

Функционал:
- Таблица чертежей проекта с фильтрацией по discipline
- Статус-бейджи (drawingStatusMap)
- Кнопка "Новый чертеж" (ГИП/Lead)
- Автогенерация номера: `{discipline}-{NNN}` (напр. "ОВ-001")
- Модалка создания: title, discipline (select), assigned_to (select)

### 1.5 Функции в supabase.ts

```typescript
// Загрузка чертежей проекта
get(`drawings?project_id=eq.${pid}&order=number`, token)

// Создание чертежа
post("drawings", { project_id, number, title, discipline, assigned_to, created_by, status: "in_progress" }, token)

// Обновление статуса
patch(`drawings?id=eq.${id}`, { status, updated_at: new Date().toISOString() }, token)
```

### 1.6 Проверка

- [ ] Таблица drawings создана в Supabase
- [ ] Чертежи отображаются в UI (таб "Чертежи" в проекте)
- [ ] Можно создать чертеж с автономером
- [ ] Фильтрация по дисциплине работает
- [ ] Существующие задачи НЕ сломаны

---

## ФАЗА 2: Drawing Agent (orchestrator)

### Статус: НЕ НАЧАТО

### 2.1 Новые функции в orchestrator.js

```javascript
// === DRAWING AGENT ===

async function handleDrawingAction(body, supabaseUrl, serviceKey) {
  const { sub_action, data } = body;

  switch (sub_action) {
    case 'create_drawing':
      return await createDrawing(data, supabaseUrl, serviceKey);
    case 'update_status':
      return await updateDrawingStatus(data, supabaseUrl, serviceKey);
    case 'create_revision':
      return await createRevision(data, supabaseUrl, serviceKey);
    default:
      return { error: 'Unknown drawing sub_action' };
  }
}

async function createDrawing({ project_id, title, discipline, assigned_to, created_by }, url, key) {
  // 1. Получить последний номер чертежа для этой дисциплины в проекте
  // 2. Сгенерировать следующий: ОВ-001, ОВ-002...
  // 3. INSERT в drawings
  // 4. Вернуть созданный чертеж
}

async function updateDrawingStatus({ drawing_id, new_status, user_id }, url, key) {
  // 1. Получить текущий чертеж
  // 2. Валидировать переход (через Workflow Agent)
  // 3. UPDATE статус
  // 4. Записать в историю (reviews)
}

async function createRevision({ drawing_id, file_url, user_id }, url, key) {
  // 1. Получить текущую ревизию (R0, R1...)
  // 2. Инкрементировать: R0 -> R1
  // 3. INSERT в revisions
  // 4. UPDATE drawings.current_revision
  // 5. Сбросить статус в in_progress
}
```

### 2.2 Новый intent в orchestrator

```javascript
// Добавить в основной handler:
if (/чертеж|чертёж|drawing|лист|выпуск/i.test(message)) {
  intent = 'drawing_action';
}
```

### 2.3 Copilot команды

Примеры:
- "создай чертеж ОВ План 1 этажа" -> create_drawing
- "статус чертежа ОВ-001" -> get_drawing_status

### 2.4 Проверка

- [ ] Можно создать чертеж через Copilot
- [ ] Copilot понимает команды про чертежи
- [ ] Создание через UI тоже работает

---

## ФАЗА 3: Workflow Agent (валидация переходов)

### Статус: НЕ НАЧАТО

### 3.1 Правила переходов

```javascript
const DRAWING_TRANSITIONS = {
  in_progress: {
    next: ['review'],
    required_role: ['engineer', 'lead'],  // кто может отправить на проверку
    checks: ['has_revision_file']          // должен быть файл ревизии
  },
  review: {
    next: ['gip', 'in_progress'],          // lead утверждает или возвращает
    required_role: ['lead'],
    checks: []
  },
  gip: {
    next: ['approved', 'in_progress'],     // ГИП утверждает или возвращает
    required_role: ['gip'],
    checks: []
  },
  approved: {
    next: ['in_progress'],                 // Новая ревизия = возврат в работу
    required_role: ['gip'],
    checks: []
  }
}
```

### 3.2 Функция валидации

```javascript
function validateTransition(drawing, newStatus, userRole) {
  const current = DRAWING_TRANSITIONS[drawing.status];
  if (!current) return { valid: false, error: 'Неизвестный статус' };
  if (!current.next.includes(newStatus))
    return { valid: false, error: `Нельзя перейти из "${drawing.status}" в "${newStatus}"` };
  if (!current.required_role.includes(userRole))
    return { valid: false, error: `Роль "${userRole}" не может выполнить этот переход` };
  return { valid: true };
}
```

### 3.3 Проверка

- [ ] Инженер НЕ может утвердить чертеж (только отправить на проверку)
- [ ] Lead НЕ может перескочить через проверку ГИПа
- [ ] ГИП может вернуть чертеж на доработку
- [ ] Нельзя выпустить чертеж без статуса approved

---

## ФАЗА 4: Привязка задач к чертежам

### Статус: НЕ НАЧАТО

### 4.1 SQL миграция

```sql
-- Добавить FK в tasks (nullable для обратной совместимости)
ALTER TABLE tasks ADD COLUMN drawing_id INTEGER REFERENCES drawings(id);
CREATE INDEX idx_tasks_drawing ON tasks(drawing_id);
```

### 4.2 Изменения в UI

- В форме создания задачи: опциональный select "Привязать к чертежу"
- В карточке задачи: отображать номер чертежа если привязана
- В панели чертежа: список привязанных задач

### 4.3 Изменения в App.tsx

```typescript
// При создании задачи:
await post("tasks", {
  ...existingFields,
  drawing_id: selectedDrawingId || null  // nullable
}, token)
```

### 4.4 Проверка

- [ ] Старые задачи (без drawing_id) работают как раньше
- [ ] Новые задачи можно привязать к чертежу
- [ ] В карточке чертежа видны его задачи

---

## ФАЗА 5: Ревизии чертежей

### Статус: НЕ НАЧАТО

### 5.1 SQL миграция

```sql
CREATE TABLE IF NOT EXISTS revisions (
  id SERIAL PRIMARY KEY,
  drawing_id INTEGER NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  rev TEXT NOT NULL,                   -- "R0", "R1", "R2"...
  file_url TEXT,                       -- Ссылка на файл в Supabase Storage
  comment TEXT,                        -- Комментарий к ревизии
  created_by INTEGER REFERENCES app_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(drawing_id, rev)
);

CREATE INDEX idx_revisions_drawing ON revisions(drawing_id);
```

### 5.2 UI: Компонент RevisionHistory

Внутри карточки чертежа:
- Список ревизий (R0, R1, R2...) с датами
- Кнопка загрузки файла
- Кнопка "Новая ревизия" (создает R(N+1), сбрасывает статус чертежа в in_progress)

### 5.3 Логика

```typescript
// Создание ревизии
const currentRev = drawing.current_revision; // "R0"
const nextRev = `R${parseInt(currentRev.substring(1)) + 1}`; // "R1"

await post("revisions", {
  drawing_id: drawing.id,
  rev: nextRev,
  file_url: uploadedFileUrl,
  created_by: currentUserData.id
}, token);

await patch(`drawings?id=eq.${drawing.id}`, {
  current_revision: nextRev,
  status: "in_progress",
  updated_at: new Date().toISOString()
}, token);
```

### 5.4 Проверка

- [ ] При создании чертежа автоматически создается ревизия R0
- [ ] Можно загрузить файл к ревизии
- [ ] Новая ревизия сбрасывает статус чертежа
- [ ] История ревизий отображается хронологически

---

## ФАЗА 6: Замечания (reviews)

### Статус: НЕ НАЧАТО

### 6.1 SQL миграция

```sql
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  drawing_id INTEGER NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  revision_id INTEGER REFERENCES revisions(id),  -- К какой ревизии замечание
  comment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',  -- open/fixed/closed
  author INTEGER NOT NULL REFERENCES app_users(id),
  fixed_by INTEGER REFERENCES app_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_drawing ON reviews(drawing_id);
CREATE INDEX idx_reviews_status ON reviews(status);
```

### 6.2 UI: ReviewsPanel

- Список замечаний к чертежу
- Фильтр: open / fixed / closed
- Кнопка "Добавить замечание" (Lead, GIP)
- Кнопка "Исправлено" (Engineer -> fixed)
- Кнопка "Закрыть" (Lead/GIP -> closed)

### 6.3 Логика перед переходом статуса

```javascript
// Перед переходом review -> gip:
// Проверить что все замечания в статусе fixed или closed
const openReviews = await get(
  `reviews?drawing_id=eq.${id}&status=eq.open`, token
);
if (openReviews.length > 0) {
  alert("Нельзя отправить на ГИП: есть открытые замечания");
  return;
}
```

### 6.4 Review Agent (orchestrator)

```javascript
async function handleReviewAction(body, url, key) {
  const { sub_action, data } = body;
  switch (sub_action) {
    case 'add_review':     // Добавить замечание
    case 'fix_review':     // Отметить как исправленное
    case 'close_review':   // Закрыть замечание
    case 'list_reviews':   // Список замечаний
  }
}
```

### 6.5 Проверка

- [ ] Lead/GIP могут добавлять замечания
- [ ] Engineer может отметить замечание как исправленное
- [ ] Нельзя продвинуть чертеж с открытыми замечаниями
- [ ] Счетчик open/fixed/closed в карточке чертежа

---

## ФАЗА 7: Transmittals (ведомости выпуска)

### Статус: НЕ НАЧАТО

### 7.1 SQL миграция

```sql
CREATE TABLE IF NOT EXISTS transmittals (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number TEXT NOT NULL,                   -- Номер ведомости: "ВЧ-001"
  discipline TEXT,                        -- Фильтр по дисциплине (nullable = все)
  drawing_ids INTEGER[] NOT NULL,         -- Массив ID чертежей
  created_by INTEGER REFERENCES app_users(id),
  pdf_url TEXT,                           -- Ссылка на сгенерированный PDF
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id, number)
);
```

### 7.2 Register Agent (orchestrator)

```javascript
async function handleRegisterAction(body, url, key) {
  // Формирует ведомость чертежей
  // Фильтрует по проекту, дисциплине, статусу
  // Возвращает таблицу: номер, название, ревизия, статус
}
```

### 7.3 Transmittal Agent (orchestrator)

```javascript
async function handleTransmittalAction(body, url, key) {
  // 1. Получить все approved чертежи проекта (или по дисциплине)
  // 2. Сгенерировать PDF ведомости
  // 3. Сохранить в Supabase Storage
  // 4. Создать запись в transmittals
}
```

### 7.4 UI

- Экран "Ведомости" в проекте (новый таб или часть drawings)
- Кнопка "Сформировать ведомость" (ГИП)
- Выбор дисциплины
- Автоматически включает только approved чертежи
- Скачивание PDF

### 7.5 Проверка

- [ ] Ведомость содержит только approved чертежи
- [ ] PDF генерируется и скачивается
- [ ] Нельзя включить в ведомость не-approved чертежи

---

## ФАЗА 8: Усиление Copilot + Ролевые ассистенты

### Статус: НЕ НАЧАТО

### 8.1 Новые intents в orchestrator

```javascript
const INTENTS = {
  // Существующие
  create_tasks: /задач|сделай|создай|task|план|график/i,
  search_normative: /найди|поиск|норматив|ГОСТ|СНиП|СП/i,

  // Новые - чертежи
  create_drawing: /чертеж|чертёж|лист|создай чертеж/i,
  drawing_status: /статус чертеж|что по чертеж|прогресс/i,
  issue_drawing: /выпуск|выпусти|transmittal|ведомость/i,

  // Новые - аналитика
  project_report: /отчет|отчёт|что по проект|сводка|итог/i,
  workload: /загрузк|нагрузк|кто свободен|распредел/i,
  risks: /риск|отставан|просроч|проблем|предупрежд/i,

  // Новые - протоколы
  protocol: /протокол|совещан|решени|зафиксир/i,
}
```

### 8.2 Ролевые системные промпты

```javascript
function getRoleSystemPrompt(role, projectContext) {
  switch (role) {
    case 'gip':
      return `Ты — AI-ассистент ГИПа. Фокус: риски, отставания, проблемы, общая картина.
        Контекст проекта: ${projectContext}
        Показывай: % готовности, просроченные чертежи, чертежи без инженера.
        НЕ принимай решения за ГИПа, только предупреждай и анализируй.`;
    case 'lead':
      return `Ты — AI-ассистент руководителя отдела. Фокус: загрузка инженеров, перераспределение.
        Показывай: кто перегружен, у кого мало задач, дедлайны.
        Предлагай перераспределение, но НЕ делай его автоматически.`;
    case 'engineer':
      return `Ты — AI-ассистент инженера. Фокус: нормативы, расчёты, подсказки.
        Используй RAG для поиска по нормативной базе.
        Проверяй базовые ошибки, подсказывай решения.`;
  }
}
```

### 8.3 Уровни AI (экономия)

```javascript
// Уровень 1: Без AI (чистая логика)
// - Валидация workflow (validateTransition)
// - Автогенерация номеров чертежей
// - Проверка open reviews перед переходом
// - Расчет прогресса

// Уровень 2: Дешёвый AI (по умолчанию)
// - Claude Haiku для Copilot ответов
// - Простые текстовые ответы
// - Форматирование отчетов
const CHEAP_MODEL = "claude-haiku-4-5-20251001";

// Уровень 3: Сильный AI (по запросу)
// - RAG с нормативной базой
// - Сложный анализ проекта
// - Генерация протоколов совещаний
const STRONG_MODEL = "claude-sonnet-4-6-20250514";
```

### 8.4 Notification Agent

```javascript
// Фаза 1: внутри приложения (Supabase Realtime, уже есть)
// Расширить каналы:
// - drawing:status_changed -> уведомление assigned_to
// - review:created -> уведомление assigned_to
// - transmittal:created -> уведомление всем участникам

// Фаза 2 (позже): Telegram/email
// Отдельный Edge Function с webhook
```

### 8.5 Copilot команды (полный список после эволюции)

| Команда | Agent | Описание |
|---------|-------|----------|
| "создай чертеж ОВ План 1 этажа" | Drawing | Создает чертеж |
| "статус ОВ-001" | Drawing | Показывает статус чертежа |
| "отправь ОВ-001 на проверку" | Workflow | Меняет статус |
| "замечание к ОВ-001: проверить размеры" | Review | Создает замечание |
| "что по проекту" | Report | Сводка по проекту |
| "кто свободен" | Workload | Анализ загрузки |
| "выпусти ОВ" | Transmittal | Ведомость выпуска |
| "найди СП по отоплению" | RAG | Поиск в нормативке |
| "риски по дедлайнам" | Risk | Анализ рисков |
| "протокол совещания" | Protocol | Из чата -> протокол |

### 8.6 Проверка

- [ ] Copilot понимает все новые команды
- [ ] Ролевой промпт меняется в зависимости от роли пользователя
- [ ] GIP видит риски и отставания
- [ ] Lead видит загрузку инженеров
- [ ] Engineer получает подсказки из RAG

---

## ЖИЗНЕННЫЙ ЦИКЛ ПРОЕКТА (ИТОГОВЫЙ)

```
1. Загрузка ТЗ (файлы в normative_docs)
2. ГИП создает проект + структуру разделов
3. AI предлагает чертежи по разделам (через Copilot)
4. ГИП назначает инженеров на чертежи
5. Инженеры работают (status: in_progress)
   - Создают задачи привязанные к чертежам
   - Используют AI для расчетов и нормативки
6. Инженер отправляет на проверку (-> review)
   - Lead проверяет, оставляет замечания
   - Инженер исправляет (-> in_progress, новая ревизия)
7. Lead утверждает (-> gip)
   - ГИП проверяет
   - При необходимости возвращает на доработку
8. ГИП утверждает (-> approved)
9. Формирование ведомости (transmittal)
10. Выпуск документации
11. Замечания заказчика -> новая ревизия -> новый цикл
```

---

## ПОРЯДОК РЕАЛИЗАЦИИ (ЧЕКЛИСТ)

- [ ] **Фаза 1**: drawings таблица + UI (DrawingsPanel)
- [ ] **Фаза 2**: Drawing Agent в orchestrator
- [ ] **Фаза 3**: Workflow Agent (валидация переходов)
- [ ] **Фаза 4**: drawing_id в tasks (привязка)
- [ ] **Фаза 5**: revisions таблица + UI
- [ ] **Фаза 6**: reviews таблица + Review Agent
- [ ] **Фаза 7**: transmittals таблица + Transmittal Agent
- [ ] **Фаза 8**: Copilot + ролевые ассистенты

---

## ИСТОРИЯ ВЕРСИЙ

### v6.8 — Мобильный адаптивный layout с нижней навигацией
### v6.7 — Экспорт проекта в Excel (SpreadsheetML)
### v6.6 — Supabase Realtime для уведомлений о задачах (замена polling)
### v6.5 — Аналитика для ГИП и руководителей отделов
### v6.4 — Нормативка: исправлена векторизация документов
### v6.3 — Умный конвертер единиц для расчетов
### v6.2 — Каталог расчетов: полный список + поиск (90+)
### v6.1 — Семантический поиск в нормативной базе
### v6.0 — RAG + Безопасность + Vercel деплой
### v5.1 — Фикс переходов и высоты
### v5.0 — Глобальный редизайн (Figma Make)
### v4.0 — Конференц-зал и чат

---

## ССЫЛКИ

- **Live**: https://enghub.vercel.app
- **GitHub**: https://github.com/andyrbek2709-tech/enghub
