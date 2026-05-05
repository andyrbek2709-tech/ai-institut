# 🔌 API КОНТРАКТ СИСТЕМЫ — EngHub Backend

**Дата:** 2026-05-05 | **Версия:** 1.0 | **Статус:** ✅ TECHNICAL SPEC

---

## 📋 ОГЛАВЛЕНИЕ

1. [Архитектура API](#1-архитектура-api)
2. [Сущности (Entities)](#2-сущности-entities)
3. [Endpoints](#3-endpoints)
4. [События и триггеры](#4-события-и-триггеры)
5. [Payload примеры](#5-payload-примеры)
6. [Правила валидации](#6-правила-валидации)
7. [Orchestrator Integration](#7-orchestrator-integration)
8. [Real-time (WebSocket)](#8-real-time-websocket)
9. [Коды ошибок](#9-коды-ошибок)
10. [Sequence diagrams](#10-sequence-diagrams)

---

## 1. АРХИТЕКТУРА API

### 1.1 Слои системы

```
┌──────────────────────────────┐
│         FRONTEND (UI)        │  ← React / Vue
│                              │
├──────────────────────────────┤
│    REST API / WebSocket      │  ← Node.js / Go / Python
│  (HTTP + Event-driven)       │
├──────────────────────────────┤
│       DATABASE (Supabase)    │  ← PostgreSQL + RLS
│                              │
├──────────────────────────────┤
│     ORCHESTRATOR ENGINE      │  ← Background Job Queue
│  (Event listener + rules)    │
└──────────────────────────────┘
```

### 1.2 Принципы API

```
1. RESTful для CRUD операций (создание, чтение, обновление)
2. Event-driven для реакции на события (оркестратор слушает)
3. WebSocket для real-time обновлений (UI получает live updates)
4. RLS (Row-Level Security) в БД для авторизации
5. Idempotent операции (можно отправить дважды, результат один)
```

### 1.3 Базовые параметры

```
BASE_URL: https://api.enghub.com/v1

HEADERS (все запросы):
  Authorization: Bearer <JWT_TOKEN>
  Content-Type: application/json
  X-Request-ID: <uuid>  (optional, для trace)

TIMESTAMPS:
  Всегда ISO 8601: 2026-05-05T14:30:00Z
  
PAGINATION (где применимо):
  ?page=1&limit=20
  Response включает: { data: [], total, page, limit }
```

---

## 2. СУЩНОСТИ (ENTITIES)

### 2.1 Task

```typescript
// Полная сущность
interface Task {
  // Идентификация
  id: bigint              // Primary key
  project_id: uuid        // Проект
  
  // Ответственность
  assignee_id: uuid       // Инженер (обязательно)
  assigned_by_gip_id: uuid // Кто назначил
  
  // Статус
  status: 'created' | 'in_progress' | 'review_lead' | 
          'review_gip' | 'rework' | 'awaiting_data' | 'approved'
  
  // Описание
  title: string           // Обязательно, ≤ 255 символов
  description: string     // Optional, ≤ 5000 символов
  
  // Сроки
  deadline_at: timestamp  // Обязательно, future date
  created_at: timestamp   // Auto
  updated_at: timestamp   // Auto
  approved_at: timestamp  // Когда утверждена (null если не утверждена)
  
  // История проверок
  rework_count: integer   // Сколько раз возвращена (0+)
  returned_by_lead_at: timestamp  // Последний возврат от Lead
  returned_by_gip_at: timestamp   // Последний возврат от ГИП
  
  // Блокировки
  dependency_resolved: boolean    // Зависимость разрешена?
  unblocked_at: timestamp         // Когда разблокирована
  
  // Привязка к документу
  drawing_id: uuid              // Optional
  revision_id: bigint           // Optional
  
  // RLS
  team_id: uuid            // Отдел (для Lead RLS)
}

// Сокращённая версия (для списков)
interface TaskShort {
  id: bigint
  title: string
  status: string
  deadline_at: timestamp
  assignee_id: uuid
  rework_count: integer
  team_id: uuid
}

// Для обновления
interface TaskUpdate {
  title?: string
  description?: string
  deadline_at?: timestamp
  assignee_id?: uuid
  status?: string  // INTERNAL ONLY, использовать /status endpoint
  dependency_resolved?: boolean
}
```

### 2.2 Review (Замечание)

```typescript
interface Review {
  // Идентификация
  id: bigint
  task_id: bigint         // Какой задаче относится
  
  // Кто добавил
  created_by_id: uuid
  created_by_role: 'lead' | 'gip'
  
  // Что за замечание
  severity: 'minor' | 'major' | 'blocker'
  location: string        // Optional, например "Лист 2, узел A3"
  text: string            // Обязательно, ≤ 2000 символов
  tag: 'dimensioning' | 'consistency' | 'calculation' | 'compliance' | 'other'
  
  // Статус разрешения
  resolved: boolean
  resolved_by_id: uuid    // Кто разрешил (если resolved=true)
  resolved_at: timestamp  // Когда разрешили
  
  // Опционально: комментарий при разрешении
  resolution_comment: string  // Optional
  
  // История
  created_at: timestamp
  updated_at: timestamp
}

// Для создания
interface ReviewCreate {
  task_id: bigint         // Обязательно
  severity: 'minor' | 'major' | 'blocker'  // Обязательно
  location?: string       // Optional
  text: string            // Обязательно
  tag: string             // Обязательно
}

// Для обновления (разрешение)
interface ReviewResolve {
  resolved: boolean
  resolution_comment?: string
}
```

### 2.3 TaskDependency

```typescript
interface TaskDependency {
  // Идентификация
  id: bigint
  
  // Связь задач
  parent_task_id: bigint      // Основная задача (ждёт данные)
  dependent_task_id: bigint   // Зависимая задача (поставляет)
  
  // Описание
  required_data_description: string  // Обязательно, что требуется
  
  // Сроки
  deadline_at: timestamp      // Когда нужны данные (≤ parent deadline)
  created_at: timestamp
  resolved_at: timestamp      // Когда разрешена (null если не разрешена)
  
  // RLS
  project_id: uuid
}

// Для создания
interface DependencyCreate {
  parent_task_id: bigint      // Обязательно
  dependent_task_id?: bigint  // Optional, если существует
  required_data_description: string  // Обязательно
  deadline_at: timestamp      // Обязательно
  required_from_team_id?: uuid // Optional, если создаём новую задачу
}
```

### 2.4 Notification

```typescript
interface Notification {
  // Идентификация
  id: uuid
  user_id: uuid           // Кому
  
  // Содержание
  type: 'task_created' | 'submitted_for_review' | 'task_returned' | 
        'task_approved' | 'review_comment' | 'blocking_alert' | 
        'deadline_warning' | 'dependency_resolved' | 'review_timeout' | 
        'rework_cycle_alert'
  
  title: string
  message: string
  
  // Связь с сущностью
  related_entity_type: 'task' | 'review' | 'project'
  related_entity_id: string  // ID (task_id / review_id / project_id)
  
  // Статус
  read: boolean
  read_at: timestamp
  
  // Каналы (какие использовать)
  channels: ('in_app' | 'telegram' | 'email')[]
  
  // История
  created_at: timestamp
}

// Для маркирования как прочитанное
interface NotificationUpdate {
  read: boolean
}
```

### 2.5 User

```typescript
interface User {
  // Идентификация
  id: uuid
  email: string
  first_name: string
  last_name: string
  
  // Роль в системе
  role: 'engineer' | 'lead' | 'gip' | 'admin'
  
  // Привязка к отделу/проекту
  team_id: uuid              // Отдел (для Lead)
  projects: uuid[]           // Проекты (для ГИП, может быть несколько)
  
  // Настройки уведомлений
  notification_channels: {
    telegram_enabled: boolean
    telegram_chat_id?: string
    email_enabled: boolean
    email: string
  }
  
  // История
  created_at: timestamp
  last_login_at: timestamp
}
```

---

## 3. ENDPOINTS

### 3.1 TASKS

#### POST /tasks
**Создание новой задачи**

```
Доступно:      ГИП
Требует:       project_id, assignee_id, deadline_at, title
Результат:     Задача создана, статус = "created"
                Если есть зависимость: статус = "awaiting_data"

Request:
{
  "project_id": "uuid-123",
  "assignee_id": "uuid-engineer-1",
  "title": "КЖ-2026-Fase-1_Схема подключения",
  "description": "Создать схему электроснабжения объекта",
  "deadline_at": "2026-05-07T17:00:00Z",
  
  // Optional: добавить зависимость при создании
  "dependency": {
    "required_from_team_id": "uuid-team-kj",
    "required_data_description": "Схема электроснабжения",
    "deadline_for_dependency": "2026-05-07T17:00:00Z"
  }
}

Response 201:
{
  "id": 4,
  "project_id": "uuid-123",
  "assignee_id": "uuid-engineer-1",
  "assigned_by_gip_id": "uuid-gip-1",
  "title": "КЖ-2026-Fase-1_Схема подключения",
  "status": "created",  // или "awaiting_data" если есть зависимость
  "deadline_at": "2026-05-07T17:00:00Z",
  "created_at": "2026-05-05T10:00:00Z",
  "rework_count": 0,
  "team_id": "uuid-team-kj",
  ...
}

Ошибки:
  400: assignee_id не найден
  400: deadline_at в прошлом
  403: у вас нет прав (только ГИП)
  409: в проекте нельзя создавать (заморожена)
```

---

#### GET /tasks
**Получить список задач (с фильтрацией)**

```
Доступно:      Все (но видит только свои благодаря RLS)
Query params:
  ?status=in_progress,review_lead  (mutable select)
  ?project_id=uuid-123
  ?assignee_id=uuid-engineer-1
  ?team_id=uuid-team-kj            (только для Lead/ГИП)
  ?deadline_before=2026-05-10
  ?deadline_after=2026-05-01
  ?page=1&limit=20
  ?sort=deadline_at:asc|desc

Response 200:
{
  "data": [
    {
      "id": 4,
      "title": "КЖ-2026-Fase-1_Схема",
      "status": "review_lead",
      "deadline_at": "2026-05-07T17:00:00Z",
      "assignee_id": "uuid-engineer-1",
      "rework_count": 1,
      "team_id": "uuid-team-kj",
      ...
    },
    ...
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}

Примеры:
  GET /tasks                          → все мои задачи (ролевой доступ)
  GET /tasks?status=awaiting_data     → только заблокированные
  GET /tasks?team_id=uuid&status=review_lead → очередь Lead
  GET /tasks?status=review_gip        → очередь ГИПа
```

---

#### GET /tasks/:id
**Получить полную карточку задачи**

```
Доступно:      Инженер (своя), Lead (отдела), ГИП (проекта)

Response 200:
{
  "id": 4,
  "project_id": "uuid-123",
  "title": "КЖ-2026-Fase-1_Схема подключения",
  "description": "...",
  "status": "review_lead",
  "assignee_id": "uuid-engineer-1",
  "assigned_by_gip_id": "uuid-gip-1",
  "deadline_at": "2026-05-07T17:00:00Z",
  "created_at": "2026-05-05T10:00:00Z",
  "updated_at": "2026-05-05T14:30:00Z",
  "rework_count": 1,
  "returned_by_lead_at": "2026-05-05T12:00:00Z",
  "returned_by_gip_at": null,
  "dependency_resolved": false,
  "unblocked_at": null,
  "team_id": "uuid-team-kj",
  
  // Nested данные (популяция):
  "reviews": [
    {
      "id": 1,
      "severity": "major",
      "location": "Узел A5",
      "text": "Потеря обозначения",
      "resolved": false,
      ...
    }
  ],
  
  "files": [
    {
      "id": "file-123",
      "name": "КЭС_КЖ-Fase1-v2.dwg",
      "size": 2400000,
      "uploaded_at": "2026-05-05T14:00:00Z",
      "url": "https://storage.enghub.com/..."
    }
  ],
  
  "dependencies": [
    {
      "id": 1,
      "parent_task_id": 4,
      "dependent_task_id": 3,
      "required_data_description": "Схема электроснабжения",
      "deadline_at": "2026-05-07T17:00:00Z",
      "resolved_at": null,
      "dependent_task": { ...Task... }  // Вложенная задача
    }
  ],
  
  "history": [
    {
      "changed_at": "2026-05-05T14:30:00Z",
      "changed_by_id": "uuid-lead-1",
      "action": "submitted_to_gip",
      "old_status": "review_lead",
      "new_status": "review_gip",
      "message": "Качество OK, отправляю"
    }
  ]
}

Ошибки:
  404: Задача не найдена
  403: У вас нет доступа к этой задаче
```

---

#### PATCH /tasks/:id/status
**Изменить статус задачи**

```
Доступно:      Зависит от текущего статуса и роли (см. таблицу)
Результат:     Статус изменён, отправлены события оркестратору

Request:
{
  "new_status": "in_progress",
  "comment": "Начинаю работу"  // Optional
}

Response 200:
{
  "id": 4,
  "status": "in_progress",
  "updated_at": "2026-05-05T10:30:00Z",
  ...
}

ТАБЛИЦА ДОСТУПА (кто может менять):

Текущий         | На какой          | Доступно                      | Условие
────────────────────────────────────────────────────────────────────────────
created         | in_progress       | Инженер                       | Любой
created         | awaiting_data     | Система (при создании)        | -
in_progress     | review_lead       | Инженер                       | Файл есть
in_progress     | awaiting_data     | ГИП                          | -
review_lead     | review_gip        | Lead                          | Нет blocker замечаний
review_lead     | rework            | Lead                          | Есть замечание
review_lead     | in_progress       | Инженер                       | Откат
review_gip      | approved          | ГИП                          | Нет blocker замечаний
review_gip      | rework            | ГИП                          | Есть замечание
rework          | review_lead       | Инженер                       | Файл есть
awaiting_data   | in_progress       | ГИП или Система             | Зависимость разрешена
awaiting_data   | in_progress       | Система (автоматически)     | dependent approved

Ошибки:
  400: new_status недопустимый
  400: недопустимый переход (текущий → new)
  400: условие не выполнено (например, нет файла)
  403: у вас нет прав для этого перехода
  409: есть unresolved blocker замечания
```

---

#### PATCH /tasks/:id
**Обновить поля задачи (не статус)**

```
Доступно:      ГИП (для своих полей)
Результат:     Задача обновлена

Request:
{
  "title": "Новое название",
  "description": "Новое описание",
  "deadline_at": "2026-05-10T17:00:00Z",
  "assignee_id": "uuid-engineer-2"  // переназначить
}

Response 200:
{
  "id": 4,
  "title": "Новое название",
  ...
}

Ошибки:
  403: только ГИП может обновлять
  400: deadline_at в прошлом
  400: assignee_id не найден
```

---

### 3.2 REVIEWS

#### POST /reviews
**Добавить замечание к задаче**

```
Доступно:      Lead (если задача на его проверке)
                ГИП (если задача на его проверке)
Требует:       task_id, severity, text, tag
Результат:     Замечание добавлено, отправлено инженеру

Request:
{
  "task_id": 4,
  "severity": "major",
  "location": "Лист 2, узел A3",  // Optional
  "text": "Сечение кабеля Al 16 мм² недостаточно для тока 45A, требуется 25 мм²",
  "tag": "calculation"
}

Response 201:
{
  "id": 1,
  "task_id": 4,
  "created_by_id": "uuid-lead-1",
  "created_by_role": "lead",
  "severity": "major",
  "location": "Лист 2, узел A3",
  "text": "Сечение кабеля Al 16 мм² недостаточно...",
  "tag": "calculation",
  "resolved": false,
  "created_at": "2026-05-05T12:00:00Z"
}

Ошибки:
  400: task_id не найдена
  400: severity не в списке (minor, major, blocker)
  400: text пустой или > 2000 символов
  403: задача не на вашей проверке
  409: задача уже утверждена
```

---

#### PATCH /reviews/:id
**Разрешить замечание**

```
Доступно:      Lead (если его замечание), Инженер (если свой возврат)
Результат:     Замечание отмечено как разрешённое

Request:
{
  "resolved": true,
  "resolution_comment": "Исправлено в v2"  // Optional
}

Response 200:
{
  "id": 1,
  "resolved": true,
  "resolved_by_id": "uuid-engineer-1",
  "resolved_at": "2026-05-05T14:00:00Z",
  "resolution_comment": "Исправлено в v2"
}

Ошибки:
  404: Замечание не найдено
  403: Вы не можете разрешать это замечание
```

---

### 3.3 DEPENDENCIES

#### POST /dependencies
**Создать зависимость между задачами**

```
Доступно:      ГИП (обычно при создании основной задачи)
Требует:       parent_task_id, dependent_task_id, description, deadline
Результат:     Основная задача → "awaiting_data"

Request:
{
  "parent_task_id": 5,
  "dependent_task_id": 4,
  "required_data_description": "Схема электроснабжения от КЖ",
  "deadline_at": "2026-05-07T17:00:00Z"
}

Response 201:
{
  "id": 1,
  "parent_task_id": 5,
  "dependent_task_id": 4,
  "required_data_description": "Схема электроснабжения от КЖ",
  "deadline_at": "2026-05-07T17:00:00Z",
  "created_at": "2026-05-05T10:00:00Z",
  "resolved_at": null
}

Ошибки:
  400: parent_task_id не найдена
  400: dependent_task_id не найдена
  400: deadline_at > parent deadline
  403: только ГИП может создавать
```

---

#### PATCH /dependencies/:id
**Разрешить зависимость вручную (ГИП)**

```
Доступно:      ГИП
Результат:     Основная задача → "in_progress"

Request:
{
  "resolved": true,
  "comment": "Получены данные по почте от..."  // Optional
}

Response 200:
{
  "id": 1,
  "resolved_at": "2026-05-05T15:00:00Z",
  "parent_task_id": 5
}

Действие в оркестраторе:
  → UPDATE tasks SET status = 'in_progress' WHERE id = parent_task_id
  → Отправить уведомление инженеру основной задачи
  → Добавить в историю
```

---

### 3.4 NOTIFICATIONS

#### GET /notifications
**Получить уведомления текущего пользователя**

```
Доступно:      Все
Query params:
  ?read=false              (только непрочитанные)
  ?type=task_approved      (по типу)
  ?page=1&limit=20

Response 200:
{
  "data": [
    {
      "id": "uuid-notif-1",
      "user_id": "uuid-engineer-1",
      "type": "task_returned",
      "title": "Задача возвращена на доработку",
      "message": "Lead вернул задачу КЖ-2026-Fase-1 с замечаниями",
      "related_entity_type": "task",
      "related_entity_id": "4",
      "read": false,
      "created_at": "2026-05-05T14:30:00Z"
    },
    ...
  ],
  "total": 5,
  "unread_count": 3
}
```

---

#### PATCH /notifications/:id
**Отметить уведомление как прочитанное**

```
Request:
{
  "read": true
}

Response 200:
{
  "id": "uuid-notif-1",
  "read": true,
  "read_at": "2026-05-05T14:45:00Z"
}
```

---

#### DELETE /notifications/:id
**Удалить уведомление**

```
Response 204: (no content)
```

---

### 3.5 FILES

#### POST /tasks/:id/files
**Загрузить файл к задаче**

```
Доступно:      Инженер (своя задача), ГИП
Content-Type:  multipart/form-data
Результат:     Файл загружен, сохранён на storage

Request:
  file: <binary>  (max 50 MB)

Response 201:
{
  "id": "file-uuid-1",
  "task_id": 4,
  "name": "КЭС_КЖ-Fase1-v2.dwg",
  "size": 2400000,
  "mime_type": "application/octet-stream",
  "uploaded_at": "2026-05-05T14:00:00Z",
  "url": "https://storage.enghub.com/task-4/file-uuid-1"
}

Ошибки:
  400: файл > 50 MB
  400: task_id не найдена
  403: не ваша задача
```

---

#### GET /tasks/:id/files
**Получить список файлов задачи**

```
Response 200:
{
  "data": [
    {
      "id": "file-uuid-1",
      "name": "КЭС_КЖ-Fase1-v2.dwg",
      "size": 2400000,
      "uploaded_at": "2026-05-05T14:00:00Z",
      "uploaded_by_id": "uuid-engineer-1",
      "url": "https://storage.enghub.com/task-4/file-uuid-1"
    }
  ]
}
```

---

## 4. СОБЫТИЯ И ТРИГГЕРЫ

### 4.1 Маппинг: UI Action → Backend Event → Orchestrator Action

```
┌─────────────────────────────────────────────────────────────┐
│ UI ACTION                                                   │
│ (что кликнул пользователь)                                  │
└────────┬────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│ ENDPOINT                                                    │
│ (какой API вызвать)                                         │
└────────┬────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│ BACKEND EVENT                                               │
│ (что произошло в БД)                                        │
└────────┬────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│ ORCHESTRATOR LISTENER                                       │
│ (оркестратор слушает и реагирует)                           │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Каталог событий

```
EVENT: submitted_for_review
─────────────────────────────
UI Action:       Инженер кликает [ОТПРАВИТЬ]
Endpoint:        PATCH /tasks/:id/status
Request:         { new_status: "review_lead" }
Response:        { status: "review_lead" }
Database:        UPDATE tasks SET status='review_lead', submitted_to_lead_at=NOW()
Event:           tasks.status_changed
Listener:        Оркестратор получает событие
Orchr Action:    
  → Проверить Lead статус (должен ли проверять)
  → Создать запись в истории
  → Отправить уведомление Lead (Telegram + IN-APP)
  → Запустить таймер: если Lead не проверит > 24ч, отправить напоминание
Real-time:       WebSocket подписчикам → { event: 'task.status_changed', data: {...} }

───────────────────────────────────────────────────────────────

EVENT: task_accepted_by_lead
──────────────────────────────
UI Action:       Lead кликает [ПРИНЯТЬ]
Endpoint:        PATCH /tasks/:id/status
Request:         { new_status: "review_gip" }
Validation:      Нет unresolved blocker замечаний?
Response:        { status: "review_gip" }
Database:        UPDATE tasks SET status='review_gip', submitted_to_gip_at=NOW()
Event:           tasks.status_changed
Listener:        Оркестратор получает событие
Orchr Action:
  → Проверить ГИП статус
  → Создать запись в истории
  → Отправить уведомление ГИП (Telegram + IN-APP)
  → Запустить таймер: если ГИП не утвердит > 24ч
Real-time:       WebSocket → { event: 'task.status_changed', data: {...} }

───────────────────────────────────────────────────────────────

EVENT: task_approved_by_gip
────────────────────────────
UI Action:       ГИП кликает [УТВЕРДИТЬ]
Endpoint:        PATCH /tasks/:id/status
Request:         { new_status: "approved" }
Validation:      Нет unresolved blocker замечаний?
Response:        { status: "approved" }
Database:        UPDATE tasks SET status='approved', approved_at=NOW()
Event:           tasks.status_changed (и специальный: tasks.approved)
Listener:        Оркестратор получает оба события
Orchr Action:
  → Создать запись в истории
  → ГЛАВНОЕ: Найти все task_dependencies WHERE dependent_id = этой задаче
  → Для каждой parent_id:
     IF parent.status = 'awaiting_data':
       → UPDATE parent SET status='in_progress', unblocked_at=NOW()
       → Создать запись в истории parent
       → Отправить уведомление инженеру parent (Telegram)
  → Отправить уведомление инженеру этой задачи (Telegram)
Real-time:       WebSocket → { event: 'task.approved', data: {...} }
                 WebSocket → { event: 'task.unblocked', data: {...parent...} }

───────────────────────────────────────────────────────────────

EVENT: review_comment_added
───────────────────────────
UI Action:       Lead / ГИП кликает [+ ДОБАВИТЬ ЗАМЕЧАНИЕ]
Endpoint:        POST /reviews
Request:         { task_id, severity, text, location, tag }
Response:        { id: 1, severity, text, resolved: false }
Database:        INSERT INTO reviews
Event:           reviews.created
Listener:        Оркестратор получает событие
Orchr Action:
  → Создать запись в истории задачи
  → Отправить уведомление инженеру (IN-APP)
  → Если severity = 'blocker': уведомить ГИПа (IN-APP)
Real-time:       WebSocket → { event: 'review.added', data: {...} }

───────────────────────────────────────────────────────────────

EVENT: task_returned
──────────────────────
UI Action:       Lead / ГИП кликает [ВЕРНУТЬ]
Endpoint:        PATCH /tasks/:id/status + обязательно замечание
Request:         { new_status: "rework" }
Validation:      Есть хотя бы одно unresolved замечание?
Response:        { status: "rework", rework_count: 2 }
Database:        UPDATE tasks SET status='rework', rework_count=rework_count+1
Event:           tasks.status_changed (и tasks.returned)
Listener:        Оркестратор получает события
Orchr Action:
  → Создать запись в истории (с причиной: список замечаний)
  → Отправить уведомление инженеру (Telegram + IN-APP, со всеми замечаниями)
  → Отправить уведомление Lead'ам в цепочке (IN-APP)
  → Если rework_count >= 3: Alert ГИПу "Проблема с инженером?"
  → Запустить новый таймер на дедлайн
Real-time:       WebSocket → { event: 'task.returned', data: {...} }

───────────────────────────────────────────────────────────────

EVENT: file_attached
───────────────────────
UI Action:       Инженер кликает [ЗАГРУЗИТЬ ФАЙЛ]
Endpoint:        POST /tasks/:id/files
Request:         multipart/form-data: file
Response:        { id, name, size, url }
Database:        INSERT INTO files
Event:           files.created
Listener:        Оркестратор получает событие
Orchr Action:
  → Создать запись в истории задачи
  → Проверить: есть ли уже файлы?
  → ГЛАВНОЕ: если задача в "in_progress" и нет файлов → разблокировать кнопку отправки
Real-time:       WebSocket → { event: 'file.uploaded', data: {...} }
                 (UI обновит статус кнопки [ОТПРАВИТЬ] с disabled → enabled)
```

---

## 5. PAYLOAD ПРИМЕРЫ

### 5.1 Полный цикл: Создание → Утверждение

#### Шаг 1: ГИП создаёт задачу с зависимостью

```http
POST /tasks
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "project_id": "12345678-1234-1234-1234-123456789012",
  "assignee_id": "87654321-4321-4321-4321-210987654321",
  "title": "КЖ-2026-Fase-1-СЭ_Расчёты",
  "description": "Расчёты сечения кабелей по методу МЭК 60364-5-52",
  "deadline_at": "2026-05-10T17:00:00Z",
  "dependency": {
    "required_from_team_id": "team-kj-uuid",
    "required_data_description": "Схема подключения от КЖ",
    "deadline_for_dependency": "2026-05-07T17:00:00Z"
  }
}

Response 201:
{
  "id": 5,
  "project_id": "12345678-1234-1234-1234-123456789012",
  "assignee_id": "87654321-4321-4321-4321-210987654321",
  "assigned_by_gip_id": "gip-uuid-1",
  "title": "КЖ-2026-Fase-1-СЭ_Расчёты",
  "description": "Расчёты сечения кабелей...",
  "status": "awaiting_data",
  "deadline_at": "2026-05-10T17:00:00Z",
  "created_at": "2026-05-05T10:00:00Z",
  "updated_at": "2026-05-05T10:00:00Z",
  "rework_count": 0,
  "dependency_resolved": false,
  "team_id": "team-es-uuid",
  ...
}

ОРКЕСТРАТОР:
  → Проверить зависимость
  → Создать вложенную задачу в КЖ отделе
  → Отправить уведомление Lead'у КЖ
```

---

#### Шаг 2: Lead КЖ добавляет замечание и принимает

```http
POST /reviews
{
  "task_id": 4,
  "severity": "major",
  "location": "Узел A5",
  "text": "Потеря обозначения кабеля",
  "tag": "dimensioning"
}

Response 201:
{
  "id": 1,
  "task_id": 4,
  "created_by_id": "lead-kj-uuid",
  "created_by_role": "lead",
  "severity": "major",
  "location": "Узел A5",
  "text": "Потеря обозначения кабеля",
  "tag": "dimensioning",
  "resolved": false,
  "created_at": "2026-05-05T12:00:00Z"
}

ОРКЕСТРАТОР:
  → Отправить IN-APP уведомление инженеру
  → Отметить задачу "есть замечания"
```

Инженер исправляет файл, переотправляет:

```http
PATCH /tasks/4/status
{
  "new_status": "review_lead",
  "comment": "Исправил узел A5"
}

Response 200:
{
  "id": 4,
  "status": "review_lead",
  "updated_at": "2026-05-05T14:00:00Z"
}
```

Lead отмечает замечание как разрешённое и принимает:

```http
PATCH /reviews/1
{
  "resolved": true,
  "resolution_comment": "Исправлено в v2"
}

Response 200:
{
  "id": 1,
  "resolved": true,
  "resolved_by_id": "lead-kj-uuid",
  "resolved_at": "2026-05-05T14:00:00Z"
}
```

```http
PATCH /tasks/4/status
{
  "new_status": "review_gip"
}

Response 200:
{
  "id": 4,
  "status": "review_gip",
  "submitted_to_gip_at": "2026-05-05T14:15:00Z"
}

ОРКЕСТРАТОР:
  → Отправить Telegram ГИПу
  → Запустить таймер (если ГИП не утвердит > 24ч)
```

---

#### Шаг 3: ГИП утверждает → Разблокировка основной задачи

```http
PATCH /tasks/4/status
{
  "new_status": "approved"
}

Response 200:
{
  "id": 4,
  "status": "approved",
  "approved_at": "2026-05-05T16:00:00Z"
}

ОРКЕСТРАТОР (КРИТИЧЕСКИ):
  → Выполнить поиск:
    SELECT * FROM task_dependencies WHERE dependent_id = 4
    → Найти parent_task_id = 5
  
  → Проверить:
    SELECT status FROM tasks WHERE id = 5
    → Статус = "awaiting_data" ✓
  
  → Действие:
    UPDATE tasks SET status = 'in_progress', unblocked_at = NOW()
    WHERE id = 5
  
  → Уведомить инженера задачи #5:
    "🎉 Блокировка снята! Данные от КЖ готовы (утверждены).
    Вы можете продолжить работу над КЖ-2026-Fase-1-СЭ_Расчёты"
    (Telegram + IN-APP)
```

**WebSocket обновления:**

```javascript
// Когда одобрена задача #4:
{
  event: 'task.approved',
  data: { id: 4, status: 'approved', ... }
}

// Когда разблокирована задача #5:
{
  event: 'task.unblocked',
  data: { id: 5, status: 'in_progress', ... }
}

// Подписчики (инженер, Lead, ГИП):
// - Инженер #5 получит уведомление
// - Его UI обновится (статус изменится с красного на зелёный)
// - Lead КЖ и ГИП ES видят в Dashboard что зависимость разрешена
```

---

## 6. ПРАВИЛА ВАЛИДАЦИИ

### 6.1 Обязательные поля

```
Task:
  ✓ assignee_id (инженер, не null)
  ✓ deadline_at (в будущем)
  ✓ title (не пусто, ≤ 255)
  ✓ project_id
  
Review:
  ✓ task_id
  ✓ severity (minor | major | blocker)
  ✓ text (не пусто, ≤ 2000)
  ✓ tag
  
Dependency:
  ✓ parent_task_id
  ✓ dependent_task_id
  ✓ required_data_description
  ✓ deadline_at (≤ parent deadline)
```

### 6.2 Бизнес-правила (валидируются на backend)

```
НЕЛЬЗЯ:

1. Отправить на проверку Lead без файла
   IF status = 'in_progress' → 'review_lead'
      AND COUNT(files) = 0
   THEN: 400 Bad Request "Прикрепите файл перед отправкой"

2. Отправить ГИПу с blocker замечанием
   IF status = 'review_lead' → 'review_gip'
      AND EXISTS (reviews WHERE severity='blocker' AND resolved=false)
   THEN: 409 Conflict "Нельзя отправить с блокирующими замечаниями"

3. Утвердить с blocker замечанием
   IF status = 'review_gip' → 'approved'
      AND EXISTS (reviews WHERE severity='blocker' AND resolved=false)
   THEN: 409 Conflict "Нельзя утвердить с блокирующими замечаниями"

4. Создать зависимость если parent уже в процессе
   IF parent.status IN ('in_progress', 'review_lead', 'review_gip')
   THEN: 409 Conflict "Нельзя добавить зависимость на задачу в процессе"

5. Менять статус без прав
   IF current_user.role = 'engineer'
      AND trying to do status = 'review_gip'
   THEN: 403 Forbidden

6. Дедлайн зависимой задачи > дедлайна основной
   IF dependency.deadline > parent.deadline
   THEN: 400 Bad Request "Дедлайн зависимой не может быть позже основной"

7. Вернуть без замечания
   IF status → 'rework'
      AND NOT EXISTS (unresolved reviews)
   THEN: 400 Bad Request "Добавьте замечание перед возвратом"

8. Задача без assignee
   IF assignee_id IS NULL
   THEN: 400 Bad Request "Каждая задача должна иметь ответственного"
```

### 6.3 RLS (Row-Level Security) — на уровне Supabase

```sql
-- Инженер видит только свои задачи
CREATE POLICY "engineer_view_own" ON tasks
  FOR SELECT USING (auth.uid() = assignee_id);

-- Lead видит задачи своего отдела
CREATE POLICY "lead_view_team" ON tasks
  FOR SELECT USING (
    team_id = (SELECT team_id FROM app_users WHERE id = auth.uid())
  );

-- ГИП видит все задачи своего проекта
CREATE POLICY "gip_view_project" ON tasks
  FOR SELECT USING (
    project_id IN (
      SELECT project_id FROM app_users WHERE id = auth.uid() AND role = 'gip'
    )
  );

-- Reviews (замечания) видны соответствующим ролям
CREATE POLICY "review_visibility" ON reviews
  FOR SELECT USING (
    task_id IN (SELECT id FROM tasks WHERE ... [RLS для tasks])
  );
```

---

## 7. ORCHESTRATOR INTEGRATION

### 7.1 Как Backend говорит с Orchestrator

```
МЕХАНИЗМ: Event Queue (Redis Streams или Kafka)

1. Backend действие происходит в БД
2. Trigger AFTER INSERT / UPDATE на таблице
3. Trigger отправляет событие в очередь:

   REDIS:
   XADD events:* * \
     event_type "tasks.status_changed" \
     task_id "4" \
     old_status "review_lead" \
     new_status "review_gip" \
     timestamp "2026-05-05T14:15:00Z" \
     triggered_by_user_id "lead-uuid-1"

4. Orchestrator слушает очередь:
   XREAD COUNT 1 STREAMS events:* 0

5. Для каждого события Orchestrator:
   → Загружает полное состояние из БД
   → Применяет правила (смотрит таблицу в system-orchestrator.md)
   → Выполняет действия (UPDATE, INSERT notification, отправляет WebSocket)
```

### 7.2 События что отправляет Orchestrator обратно

```
После обработки события Orchestrator может:

1. Обновить БД:
   UPDATE tasks SET status = 'in_progress', unblocked_at = NOW()
   UPDATE task_history SET action = 'auto_unblock', ...
   INSERT INTO notifications

2. Отправить WebSocket:
   broadcast({
     event: 'task.unblocked',
     room: 'project:uuid-123',  // только ГИП этого проекта
     data: { id: 5, status: 'in_progress', ... }
   })

3. Отправить Telegram:
   sendTelegram(user_id, "🎉 Блокировка снята!")

4. Запустить таймер (для future alerts):
   schedule({
     type: 'deadline_warning_24h',
     task_id: 5,
     delay: '24 hours',
     callback: 'notify_and_alert'
   })
```

### 7.3 Пример: Полная цепочка для утверждения

```
┌─────────────────────────────────────────┐
│ ГИП кликает [УТВЕРДИТЬ]                 │
└────────┬────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────┐
│ ENDPOINT: PATCH /tasks/4/status         │
│ { new_status: "approved" }              │
└────────┬────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────┐
│ BACKEND: Валидация + UPDATE БД          │
│ UPDATE tasks SET                        │
│   status = 'approved',                  │
│   approved_at = NOW(),                  │
│   approved_by_gip_id = 'gip-uuid'      │
└────────┬────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────┐
│ TRIGGER: AFTER UPDATE tasks             │
│ XADD events:* * event "tasks.approved"  │
│            task_id "4" ...              │
└────────┬────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────┐
│ ORCHESTRATOR LISTENER                   │
│ Получил событие "tasks.approved"        │
│ Загрузил task с id=4                    │
└────────┬────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────┐
│ ORCHESTRATOR LOGIC:                     │
│ 1. Найти зависимости (dependent_id=4)   │
│ 2. Для каждой parent_id:                │
│    IF status='awaiting_data'            │
│      → Разблокировать                   │
└────────┬────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────┐
│ ORCHESTRATOR ACTIONS:                   │
│ • UPDATE tasks SET status='in_progress' │
│   WHERE id = 5                          │
│ • INSERT notification                   │
│ • XADD events:* * event "tasks.unblocked│
│                                         │
└────────┬────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────┐
│ RESPONSE to FRONTEND:                   │
│ { id: 4, status: 'approved', ... }      │
│ { id: 5, status: 'in_progress', ... }   │
└────────┬────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────┐
│ WEBSOCKET BROADCASTS:                   │
│ room='project:uuid-123':                │
│  - task #4 approved (инженер, Lead)    │
│  - task #5 unblocked (инженер #5)      │
│ room='user:engineer-uuid-5':            │
│  - notification: "Данные готовы!"       │
└─────────────────────────────────────────┘
```

---

## 8. REAL-TIME (WebSocket)

### 8.1 WebSocket подключение

```
URL: wss://api.enghub.com/ws
AUTH: ?token=<JWT>

На подключении клиент отправляет:
{
  "type": "subscribe",
  "channels": [
    "project:uuid-123",      // ГИП получает обновления проекта
    "team:uuid-team-kj",     // Lead получает обновления отдела
    "user:uuid-engineer-1"   // Инженер получает личные уведомления
  ]
}

Server отвечает:
{
  "type": "subscribed",
  "channels": ["project:uuid-123", ...]
}
```

### 8.2 События что приходят по WebSocket

```
КОГДА ИЗМЕНИТСЯ СТАТУС ЗАДАЧИ:
────────────────────────────────
Все подписанные на project/team/user получают:

{
  "type": "event",
  "event": "task.status_changed",
  "room": "project:uuid-123",
  "data": {
    "id": 4,
    "status": "review_gip",
    "old_status": "review_lead",
    "changed_at": "2026-05-05T14:15:00Z",
    "changed_by": {
      "id": "lead-uuid-1",
      "name": "Бордокина",
      "role": "lead"
    }
  }
}

UI ОБНОВЛЯЕТ:
  • Карточку задачи (если открыта)
  • Канбан (переместить в другой столбец)
  • Таблицу (обновить строку)
  • Уведомления (добавить нотификацию)

───────────────────────────────────────────

КОГДА ДОБАВИТСЯ ЗАМЕЧАНИЕ:
───────────────────────────

{
  "type": "event",
  "event": "review.added",
  "room": "project:uuid-123",
  "data": {
    "id": 1,
    "task_id": 4,
    "severity": "major",
    "location": "Узел A5",
    "text": "Потеря обозначения",
    "created_by": { "id": "lead-uuid-1", "name": "Бордокина" }
  }
}

UI ОБНОВЛЯЕТ:
  • Список замечаний в карточке (добавить новое)
  • Счётчик замечаний (показать красный badge)
  • История (добавить запись)

───────────────────────────────────────────

КОГДА РАЗБЛОКИРУЕТСЯ ЗАДАЧА (AUTO-UNBLOCK):
──────────────────────────────────────────────

{
  "type": "event",
  "event": "task.unblocked",
  "room": "user:engineer-uuid-5",
  "data": {
    "id": 5,
    "status": "in_progress",
    "unblocked_by": "system",
    "unblocked_reason": "Зависимая задача #4 утверждена",
    "unblocked_at": "2026-05-05T16:00:00Z"
  }
}

UI ОБНОВЛЯЕТ:
  • Статус задачи (перестанет быть красной)
  • Показать нотификацию (🎉 Блокировка снята!)
  • Кнопка [НАЧАТЬ РАБОТУ] становится активной

───────────────────────────────────────────

УВЕДОМЛЕНИЕ (NOTIFICATION):
─────────────────────────────

{
  "type": "event",
  "event": "notification.created",
  "room": "user:engineer-uuid-5",
  "data": {
    "id": "notif-uuid-1",
    "type": "dependency_resolved",
    "title": "Блокировка снята!",
    "message": "Данные от КЖ готовы. Вы можете продолжить работу",
    "related_entity": { "type": "task", "id": 5 },
    "created_at": "2026-05-05T16:00:00Z"
  }
}

UI ОБНОВЛЯЕТ:
  • Bell icon (показать красную точку "непрочитано")
  • Notification center (добавить новое уведомление)
  • Toast notification (показать всплывающее сообщение)
```

### 8.3 Heartbeat (каждые 30 секунд)

```
Frontend отправляет:
{ "type": "ping" }

Backend отвечает:
{ "type": "pong", "timestamp": "2026-05-05T14:30:00Z" }
```

---

## 9. КОДЫ ОШИБОК

### 9.1 HTTP Status Codes

```
200 OK                 — успешно
201 Created            — создано
204 No Content         — удалено/обновлено без тела ответа
400 Bad Request        — невалидные параметры
401 Unauthorized       — нет JWT токена
403 Forbidden          — недостаточно прав (RLS, роль)
404 Not Found          — сущность не найдена
409 Conflict           — нарушение бизнес-правила
422 Unprocessable      — синтаксис валиден, но бизнес-ошибка
429 Too Many Requests  — rate limit
500 Internal Server    — ошибка сервера
503 Service Unavailable— maintenance
```

### 9.2 Примеры ошибок

```json
{
  "status": 400,
  "error": "VALIDATION_ERROR",
  "message": "Прикрепите файл перед отправкой",
  "fields": {
    "files": "не может быть пусто"
  }
}

{
  "status": 403,
  "error": "INSUFFICIENT_PERMISSIONS",
  "message": "Только Lead может принимать задачи",
  "required_role": "lead",
  "your_role": "engineer"
}

{
  "status": 409,
  "error": "BUSINESS_RULE_VIOLATION",
  "message": "Нельзя отправить с блокирующими замечаниями",
  "blocking_reviews": [
    { "id": 5, "severity": "blocker", "text": "..." }
  ]
}

{
  "status": 404,
  "error": "NOT_FOUND",
  "message": "Задача #999 не найдена"
}
```

---

## 10. SEQUENCE DIAGRAMS

### 10.1 Полный цикл: Инженер → Lead → ГИП

```
ИНЖЕНЕР                  BACKEND                ОРКЕСТРАТОР            UI
─────────────────────────────────────────────────────────────────────────

1. Загрузить файл
   POST /tasks/4/files ──→
                          ↓ INSERT file
                          ↓ TRIGGER → events:*
                                        ↓ files.uploaded
                                           ↓ Обновить history
                                           ↓ WebSocket broadcast
                          ←─────────────────────
   ← { id, url }

2. Отправить на проверку
   PATCH /tasks/4/status ──→
   { "new_status": "review_lead" }
                          ↓ VALIDATE (есть файл? ✓)
                          ↓ UPDATE status
                          ↓ TRIGGER → events:*
                                        ↓ tasks.status_changed
                                           ↓ Create notification
                                           ↓ SendTelegram (Lead)
                                           ↓ SetTimer (24h)
                          ← { status: "review_lead" }
                                                           ← WebSocket update
                                                           ← Notification bell
   ← { status: "review_lead" }

LEAD                     BACKEND                ОРКЕСТРАТОР            UI
─────────────────────────────────────────────────────────────────────────

3. Открыть очередь
   GET /tasks?status=review_lead ──→
                          ↓ RLS: где team_id = lead.team_id
                          ← { data: [task4, ...], total: 5 }

4. Добавить замечание
   POST /reviews ──→
   { task_id: 4, severity: "major", text: "..." }
                          ↓ VALIDATE (severity valid? ✓)
                          ↓ INSERT review
                          ↓ TRIGGER → events:*
                                        ↓ reviews.created
                                           ↓ Create notification (engineer)
                                           ↓ IN-APP only
                          ← { id: 1, resolved: false }
                                                           ← WebSocket update
                                                           ← IN-APP notification
   ← { id: 1 }

5. Принять результат
   PATCH /tasks/4/status ──→
   { "new_status": "review_gip" }
                          ↓ VALIDATE (no unresolved blocker? ✓)
                          ↓ UPDATE status
                          ↓ TRIGGER → events:*
                                        ↓ tasks.status_changed
                                           ↓ Create notification (GIP)
                                           ↓ SendTelegram (GIP)
                          ← { status: "review_gip" }
                                                           ← WebSocket update
   ← { status: "review_gip" }

GIP                      BACKEND                ОРКЕСТРАТОР            UI
─────────────────────────────────────────────────────────────────────────

6. Открыть очередь
   GET /tasks?status=review_gip ──→
                          ↓ RLS: где project_id in (gip.projects)
                          ← { data: [task4, ...], total: 8 }

7. Утвердить
   PATCH /tasks/4/status ──→
   { "new_status": "approved" }
                          ↓ VALIDATE (no unresolved blocker? ✓)
                          ↓ UPDATE status + approved_at
                          ↓ TRIGGER → events:*
                                        ↓ tasks.approved
                                        ↓ [ORCHESTRATOR LOGIC]
                                        ↓ SELECT dependencies WHERE dependent_id=4
                                        ↓ UPDATE parent (id=5) → in_progress
                                        ↓ TRIGGER on parent → events:*
                                           ↓ tasks.unblocked
                                           ↓ Create notification (engineer #5)
                                           ↓ SetTimer (deadline warning)
                          ← { id: 4, status: "approved" }
                          ← { id: 5, status: "in_progress" }
                                                           ← WebSocket: task.approved
                                                           ← WebSocket: task.unblocked
                                                           ← Notification: Engineer #5

ENGINEER #5              ← Получил уведомление о разблокировке
                         ← Может видеть task #5 как "in_progress"
                         ← Может начать работать
```

---

## РЕЗЮМЕ: АРХИТЕКТУРА ВЗАИМОДЕЙСТВИЯ

```
┌────────────────────────────────────────────────────────────┐
│                        FRONTEND                            │
│  (React / Vue: Tasks, Reviews, Notifications, Dashboard)   │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ↓
        ┌────────────────────────────┐
        │  REST API + WebSocket      │
        │  • CRUD операции           │
        │  • Event triggers          │
        │  • Real-time updates       │
        └────────────┬───────────────┘
                     │
    ┌────────────────┴─────────────────┐
    ↓                                  ↓
┌──────────────┐              ┌──────────────────┐
│  DATABASE    │              │  ORCHESTRATOR    │
│  (Supabase)  │              │  (Background)    │
│  • RLS       │◄─Event Queue─→• Event listener  │
│  • AUDIT LOG │ (Redis Stream)│ • Rules engine  │
│              │              │ • Timers        │
└──────────────┘              │ • Notifications │
                              └──────────────────┘
                                   │
                                   ↓
                        ┌─────────────────────┐
                        │  External Services  │
                        │  • Telegram         │
                        │  • Email            │
                        │  • Storage (S3)     │
                        └─────────────────────┘
```

---

**Версия:** 1.0  
**Дата:** 2026-05-05  
**Статус:** ✅ TECHNICAL SPEC READY  
**Для:** Backend-разработчиков (Node.js / Go / Python)
