# 🚀 ПЛАН РЕАЛИЗАЦИИ BACKEND — EngHub

**Дата:** 2026-05-05  
**Статус:** ✅ ГОТОВ К РАЗРАБОТКЕ  
**Разработка на основе:** `/core/system-orchestrator.md` + `/infra/api-contract.md`

---

## 📋 ОГЛАВЛЕНИЕ

1. [Рекомендуемый стек](#1-рекомендуемый-стек)
2. [Структура проекта](#2-структура-проекта)
3. [Порядок разработки (7 этапов)](#3-порядок-разработки-7-этапов)
4. [Реализация event-driven системы](#4-реализация-event-driven-системы)
5. [Критические риски](#5-критические-риски)
6. [Интеграция с Frontend](#6-интеграция-с-frontend)
7. [Тестовая стратегия](#7-тестовая-стратегия)
8. [Чеклист deployment](#8-чеклист-deployment)

---

## 1. РЕКОМЕНДУЕМЫЙ СТЕК

### Backend Runtime & Framework

```
RUNTIME:     Node.js 20+ (LTS)
FRAMEWORK:   Fastify или NestJS
  
  Fastify (↓ 50% faster):
  - Для: быстрой MVP с минимумом зависимостей
  - Плюсы: 10x быстрее Express, встроенный request validation
  - Минусы: меньше ecosystem
  
  NestJS (↑ лучше для масштабирования):
  - Для: долгосрочного проекта с сложной архитектурой
  - Плюсы: TypeScript-first, встроенные decorators, DI контейнер
  - Минусы: больше boilerplate
  
  📌 ВЫБОР ДЛЯ MVP: Fastify (быстрее запустить production)
```

### Database

```
PRIMARY:     PostgreSQL 15+ (Supabase)
  - RLS (Row-Level Security) в БД для авторизации
  - Встроенная Realtime для WebSocket (Supabase Realtime)
  - Простое управление БД + миграции через `supabase migration`

AUDIT LOG:   task_history таблица (существует, использовать)
```

### Event Queue

```
QUEUE:       Redis Streams (XADD / XREAD)
  
  ТРЕБУЕТСЯ ДЛЯ:
  ✓ Decoupling backend от orchestrator (асинхронность)
  ✓ Гарантия доставки событий (stream != queue)
  ✓ Consumer groups для масштабирования
  
  ПОТОМ МОЖЕТ БЫТЬ:
  → Kafka для миллионов задач/день
  → RabbitMQ для сложных маршрутов
  
  📌 НАЧАТЬ С: Redis Streams (в Vercel просто Deploy Redis add-on)
```

### Real-time

```
WEBSOCKET:   ws (Node.js WebSocket library)
  - встроенная в Fastify
  - или Socket.io (если нужна совместимость с legacy браузерами)
  
  INTEGRATION:
  ✓ WebSocket слушает Redis XREAD события
  ✓ При событии → broadcast всем подписчикам на room
  ✓ Подписка: project:uuid, team:uuid, user:uuid
```

---

## 2. СТРУКТУРА ПРОЕКТА

### Layout

```
backend/
├── src/
│   ├── modules/
│   │   ├── tasks/
│   │   │   ├── tasks.controller.ts        [POST/GET/PATCH endpoints]
│   │   │   ├── tasks.service.ts           [CRUD + status transitions]
│   │   │   ├── tasks.validators.ts        [валидация бизнес-правил]
│   │   │   └── tasks.routes.ts
│   │   │
│   │   ├── reviews/
│   │   │   ├── reviews.controller.ts
│   │   │   ├── reviews.service.ts         [add comment + resolve]
│   │   │   └── reviews.routes.ts
│   │   │
│   │   ├── dependencies/
│   │   │   ├── dependencies.controller.ts
│   │   │   ├── dependencies.service.ts    [create + manual unblock]
│   │   │   └── dependencies.routes.ts
│   │   │
│   │   ├── notifications/
│   │   │   ├── notifications.controller.ts[GET list + mark read]
│   │   │   ├── notifications.service.ts   [create + send channels]
│   │   │   └── notifications.routes.ts
│   │   │
│   │   └── files/
│   │       ├── files.controller.ts        [upload + list]
│   │       ├── files.service.ts           [storage integration]
│   │       └── files.routes.ts
│   │
│   ├── orchestrator/
│   │   ├── orchestrator.listener.ts       [XREAD события]
│   │   ├── orchestrator.rules.ts          [state machine + validators]
│   │   ├── orchestrator.actions.ts        [DB updates + notifications]
│   │   ├── orchestrator.timers.ts         [deadline checks, escalations]
│   │   └── index.ts                       [main loop]
│   │
│   ├── events/
│   │   ├── events.service.ts              [XADD в Redis]
│   │   ├── events.types.ts                [TypeScript interfaces]
│   │   └── events.constants.ts
│   │
│   ├── ws/
│   │   ├── ws.gateway.ts                  [WebSocket server]
│   │   ├── ws.service.ts                  [broadcast logic]
│   │   └── ws.rooms.ts                    [room management]
│   │
│   ├── db/
│   │   ├── supabase.client.ts             [Supabase SDK setup]
│   │   ├── migrations/                    [SQL миграции]
│   │   └── seeds/
│   │
│   ├── auth/
│   │   ├── jwt.strategy.ts                [JWT validation]
│   │   └── rbac.middleware.ts             [role checks]
│   │
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── errors.ts                      [HTTP error codes]
│   │   └── validators.ts
│   │
│   └── app.ts                             [main Fastify app]
│
├── tests/
│   ├── unit/
│   │   ├── tasks.service.test.ts
│   │   └── orchestrator.rules.test.ts
│   │
│   ├── integration/
│   │   ├── task-flow.test.ts              [engineer → submit → lead]
│   │   ├── blocking.test.ts               [dependency scenarios]
│   │   └── orchestrator.test.ts           [event handling]
│   │
│   └── e2e/
│       ├── full-pipeline.test.ts          [engineer → lead → GIP → approve]
│       └── websocket.test.ts              [real-time updates]
│
├── env.ts                                  [environment config]
├── server.ts                               [entry point]
└── package.json
```

### Database Schema (существует, но актуализировать)

```sql
-- Main tables (уже должны быть):
tasks (id, project_id, assignee_id, assigned_by_gip_id, status, 
       title, description, deadline_at, created_at, updated_at,
       approved_at, rework_count, dependency_resolved, unblocked_at, team_id)

reviews (id, task_id, created_by_id, created_by_role, severity, 
         location, text, tag, resolved, resolved_by_id, resolved_at,
         resolution_comment, created_at, updated_at)

task_dependencies (id, parent_task_id, dependent_task_id, 
                  required_data_description, deadline_at, 
                  created_at, resolved_at, project_id)

notifications (id, user_id, type, title, message, related_entity_type,
              related_entity_id, read, read_at, channels, created_at)

app_users (id, email, first_name, last_name, role, team_id, 
          notification_channels, created_at, last_login_at)

task_files (id, task_id, name, size, mime_type, url, uploaded_by_id,
           uploaded_at)

task_history (id, task_id, changed_at, changed_by_id, action,
             old_status, new_status, message)

-- Это же должны добавить:
None (миграции готовы, схема полная)
```

---

## 3. ПОРЯДОК РАЗРАБОТКИ (7 ЭТАПОВ)

### ШАГ 1: DATABASE + MIGRATIONS

**Цель:** подготовить БД к API (проверить все таблицы, RLS, triggers)

**Задачи:**

```bash
# 1.1 Убедиться, что все таблицы существуют
→ Review: /infra/api-contract.md Section 2 (Entities)
→ Запустить миграции (если не запущены):
  supabase migration up

# 1.2 RLS policies (если не установлены)
→ CREATE POLICY "engineer_view_own" ON tasks
  FOR SELECT USING (auth.uid() = assignee_id);
→ CREATE POLICY "lead_view_team" ON tasks
  FOR SELECT USING (team_id = (SELECT team_id FROM app_users WHERE id = auth.uid()));
→ Смотри: /infra/api-contract.md Section 6.3

# 1.3 Trigger для task_history (при любом UPDATE tasks)
→ CREATE TRIGGER task_history_trigger
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_change();

# 1.4 Trigger для event stream (XADD в Redis)
→ AFTER INSERT/UPDATE на tasks, reviews, task_dependencies
  CALL redis.XADD('events:*', '*', ...)

# 1.5 Проверить indexes (для быстрых queries)
→ CREATE INDEX idx_tasks_status ON tasks(status);
→ CREATE INDEX idx_tasks_deadline ON tasks(deadline_at);
→ CREATE INDEX idx_reviews_task_id ON reviews(task_id);
```

**Deliverables:**
- [ ] Все таблицы существуют и валидны
- [ ] RLS policies установлены
- [ ] Triggers для audit log работают
- [ ] Indexes оптимизированы

**Время:** 3-4 часа

---

### ШАГ 2: BASIC CRUD ENDPOINTS

**Цель:** реализовать базовые REST операции для всех сущностей

**Задачи:**

```bash
# 2.1 Tasks
→ POST   /v1/tasks               [create task]
→ GET    /v1/tasks               [list with filters]
→ GET    /v1/tasks/:id           [full card + nested data]
→ PATCH  /v1/tasks/:id           [update fields only]

# 2.2 Reviews
→ POST   /v1/reviews             [add comment]
→ PATCH  /v1/reviews/:id         [resolve]

# 2.3 Dependencies
→ POST   /v1/dependencies        [create dependency]
→ PATCH  /v1/dependencies/:id    [manual unblock]

# 2.4 Notifications
→ GET    /v1/notifications       [list]
→ PATCH  /v1/notifications/:id   [mark read]
→ DELETE /v1/notifications/:id   [delete]

# 2.5 Files
→ POST   /v1/tasks/:id/files     [upload]
→ GET    /v1/tasks/:id/files     [list]
```

**Код outline (Fastify):**

```typescript
// src/modules/tasks/tasks.controller.ts
export class TasksController {
  constructor(private tasksService: TasksService) {}

  async create(request: FastifyRequest, reply: FastifyReply) {
    const { project_id, assignee_id, title, deadline_at, dependency } = request.body;
    
    // Validate (see Step 3)
    // Create in DB
    const task = await this.tasksService.create({ ... });
    
    // Emit event (see Step 4)
    // Return 201
    reply.code(201).send(task);
  }

  async getList(request: FastifyRequest, reply: FastifyReply) {
    const { status, project_id, page = 1, limit = 20 } = request.query;
    const tasks = await this.tasksService.list({ status, project_id, page, limit });
    reply.send(tasks);
  }

  // ... get, patch, ...
}
```

**Validation:** пока БЕЗ бизнес-логики (только типы)

```typescript
// POST /tasks validation
interface CreateTaskRequest {
  project_id: string;           // UUID, required
  assignee_id: string;          // UUID, required
  title: string;                // 1-255 chars, required
  description?: string;         // 0-5000 chars
  deadline_at: string;          // ISO 8601, future, required
  dependency?: {...};           // optional
}
```

**Deliverables:**
- [ ] Все 13 endpoints работают
- [ ] RLS автоматически ограничивает доступ
- [ ] Response format соответствует /infra/api-contract.md
- [ ] Error handling (400, 403, 404, 500)

**Время:** 8-10 часов

---

### ШАГ 3: STATUS TRANSITIONS + VALIDATION

**Цель:** реализовать state machine и бизнес-правила для изменения статуса

**Задачи:**

```bash
# 3.1 Endpoint для смены статуса (отдельно от других полей)
→ PATCH /v1/tasks/:id/status
  { new_status, comment? }

# 3.2 State machine validation
→ created         → [in_progress]           (любой)
→ in_progress     → [review_lead]           (если есть файл)
→ review_lead     → [review_gip, rework]    (если Lead)
→ review_gip      → [approved, rework]      (если ГИП)
→ rework          → [review_lead]           (если инженер + файл)
→ awaiting_data   → [in_progress]           (если ГИП или зависимость разрешена)
→ approved        → (финальный, архивируемый)

# 3.3 Бизнес-правила (см. /infra/api-contract.md Section 6.2)
Правило 1: Нельзя отправить на review без файла
  IF status='in_progress' → 'review_lead'
    AND COUNT(files) = 0
  THEN: 400 "Прикрепите файл перед отправкой"

Правило 2: Нельзя отправить ГИПу с blocker замечанием
  IF status='review_lead' → 'review_gip'
    AND EXISTS (reviews WHERE severity='blocker' AND resolved=false)
  THEN: 409 "Нельзя отправить с блокирующими замечаниями"

Правило 3: Нельзя утвердить с blocker замечанием
  IF status='review_gip' → 'approved'
    AND EXISTS (reviews WHERE severity='blocker' AND resolved=false)
  THEN: 409 "Нельзя утвердить с блокирующими замечаниями"

Правило 4: Нельзя вернуть без замечания
  IF status → 'rework'
    AND NOT EXISTS (unresolved reviews)
  THEN: 400 "Добавьте замечание перед возвратом"

Правило 5: Роль должна соответствовать
  IF user.role = 'engineer' AND trying new_status = 'review_gip'
  THEN: 403 Forbidden

(Остальные 3 правила про dependencies, deadline, assignee — в Step 4)
```

**Код outline:**

```typescript
// src/modules/tasks/tasks.validators.ts
export class TaskStatusValidator {
  canTransitionTo(currentStatus: string, newStatus: string, userRole: string): {
    allowed: boolean;
    reason?: string;
  } {
    const rules = {
      'created': ['in_progress'],
      'in_progress': ['review_lead'],
      'review_lead': ['review_gip', 'rework'],
      // ...
    };
    
    if (!rules[currentStatus]?.includes(newStatus)) {
      return { allowed: false, reason: 'Invalid transition' };
    }
    
    // Role check
    if (newStatus === 'review_gip' && userRole !== 'lead') {
      return { allowed: false, reason: 'Only Lead can send to GIP' };
    }
    
    return { allowed: true };
  }

  async validateBusinessRules(
    task: Task, 
    newStatus: string, 
    db: SupabaseClient
  ): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors = [];

    // Правило 1: файл при отправке
    if (newStatus === 'review_lead') {
      const fileCount = await db
        .from('task_files')
        .select('id', { count: 'exact' })
        .eq('task_id', task.id);
      if (fileCount.count === 0) {
        errors.push('Прикрепите файл перед отправкой');
      }
    }

    // Правило 2: blocker замечания
    if (newStatus === 'review_gip') {
      const blockers = await db
        .from('reviews')
        .select('id')
        .eq('task_id', task.id)
        .eq('severity', 'blocker')
        .eq('resolved', false);
      if (blockers.data && blockers.data.length > 0) {
        errors.push('Нельзя отправить с блокирующими замечаниями');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

**Deliverables:**
- [ ] Status transition валидирована для всех 7 статусов
- [ ] 5 бизнес-правил реализованы
- [ ] Роль (role) проверяется для каждого перехода
- [ ] 409 Conflict для нарушений (не 400)
- [ ] Тесты для state machine (все 21 переход)

**Время:** 6-8 часов

---

### ШАГ 4: EVENT SYSTEM (Redis Streams)

**Цель:** реализовать async event emission для оркестратора

**Задачи:**

```bash
# 4.1 Redis connection + client
→ src/events/redis.client.ts (Ioredis или redis package)
→ Config: REDIS_URL из env (Vercel Redis)

# 4.2 Event emission service
→ src/events/events.service.ts (EventsService)
  - XADD в Redis поток при всех критических действиях

# 4.3 Какие события отправлять
  1. tasks.status_changed       (любой переход)
  2. tasks.approved             (специальное событие)
  3. tasks.returned             (возврат на доработку)
  4. reviews.created            (новое замечание)
  5. reviews.resolved           (замечание разрешено)
  6. files.uploaded             (файл загружен)
  7. dependencies.created       (зависимость создана)
  8. dependencies.resolved      (зависимость разрешена)

# 4.4 Event payload structure
{
  event_type: "tasks.status_changed",
  task_id: 4,
  old_status: "review_lead",
  new_status: "review_gip",
  triggered_by: {
    user_id: "lead-uuid-1",
    role: "lead"
  },
  timestamp: "2026-05-05T14:15:00Z",
  metadata: { ... }
}

# 4.5 Emit в каждом endpoint (после успешного UPDATE)
→ POST   /tasks               → tasks.created
→ PATCH  /tasks/:id/status    → tasks.status_changed (+ tasks.approved/returned if needed)
→ POST   /reviews             → reviews.created
→ PATCH  /reviews/:id         → reviews.resolved
→ POST   /tasks/:id/files     → files.uploaded
→ POST   /dependencies        → dependencies.created
→ PATCH  /dependencies/:id    → dependencies.resolved
```

**Код outline:**

```typescript
// src/events/events.service.ts
export class EventsService {
  constructor(private redis: Redis) {}

  async emit(event: DomainEvent): Promise<void> {
    const stream = `events:*`;  // Суффикс * = auto-ID в Redis
    
    await this.redis.xadd(
      stream,
      '*',  // Auto-generate ID (timestamp-sequence)
      ...Object.entries({
        event_type: event.type,
        task_id: event.taskId?.toString(),
        old_status: event.oldStatus,
        new_status: event.newStatus,
        triggered_by_user_id: event.triggeredByUserId,
        triggered_by_role: event.triggeredByRole,
        timestamp: event.timestamp.toISOString(),
        metadata: JSON.stringify(event.metadata),
      }).flat()
    );
  }
}

// В TasksController:
async updateStatus(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params;
  const { new_status, comment } = request.body;
  
  // Валидация (Step 3)
  const task = await db.from('tasks').select('*').eq('id', id).single();
  const validation = await validator.validateBusinessRules(task, new_status, db);
  
  if (!validation.valid) {
    reply.code(409).send({ error: validation.errors[0] });
    return;
  }
  
  // Update БД
  const updated = await db
    .from('tasks')
    .update({
      status: new_status,
      submitted_to_lead_at: new_status === 'review_lead' ? new Date() : undefined,
      submitted_to_gip_at: new_status === 'review_gip' ? new Date() : undefined,
      approved_at: new_status === 'approved' ? new Date() : undefined,
      rework_count: new_status === 'rework' ? task.rework_count + 1 : undefined,
      updated_at: new Date(),
    })
    .eq('id', id)
    .select()
    .single();
  
  // 🔥 EMIT EVENT
  await this.eventsService.emit({
    type: 'tasks.status_changed',
    taskId: id,
    oldStatus: task.status,
    newStatus: new_status,
    triggeredByUserId: request.user.id,
    triggeredByRole: request.user.role,
    timestamp: new Date(),
    metadata: { comment, ...updated }
  });
  
  // Если одобрено, дополнительное событие:
  if (new_status === 'approved') {
    await this.eventsService.emit({
      type: 'tasks.approved',
      taskId: id,
      triggeredByUserId: request.user.id,
      ...
    });
  }
  
  reply.send(updated);
}
```

**Deliverables:**
- [ ] Redis Streams подключен и работает
- [ ] 8 событий эмитятся после каждого действия
- [ ] Event payload соответствует schema
- [ ] Логирование (какие события отправлены)

**Время:** 4-6 часов

---

### ШАГ 5: ORCHESTRATOR LISTENER

**Цель:** реализовать фоновый процесс, слушающий события и применяющий правила

**Задачи:**

```bash
# 5.1 Main listener loop (фоновый процесс)
→ src/orchestrator/orchestrator.listener.ts
  - XREAD из Redis с блокировкой (поймёт новые события в real-time)
  - Обработка batch событий (не одно за раз)
  - Graceful shutdown (при завершении процесса)

# 5.2 Event handler switch (какой handler для какого события)
switch(event.type) {
  case 'tasks.status_changed':
    await this.handleStatusChanged(event);
    break;
  case 'tasks.approved':
    await this.handleTaskApproved(event);
    break;
  case 'reviews.created':
    await this.handleReviewCreated(event);
    break;
  // ...
}

# 5.3 Обработчик для tasks.approved (ключевой для блокировок)
handleTaskApproved:
  1. Загрузить полное состояние task из БД
  2. SELECT * FROM task_dependencies WHERE dependent_id = :task_id
  3. Для каждой parent_id:
     IF parent.status = 'awaiting_data':
       → UPDATE parent SET status = 'in_progress', unblocked_at = NOW()
       → INSERT INTO task_history (action='auto_unblock', ...)
       → Emit event 'tasks.unblocked'
       → Emit event 'notification.created' (для инженера)

# 5.4 Обработчик для reviews.created (проверка severity)
handleReviewCreated:
  1. Если severity = 'blocker':
     → Отправить уведомление ГИПу (IN-APP, высокий приоритет)
  2. Если severity = 'major' или 'minor':
     → Отправить уведомление инженеру (IN-APP)

# 5.5 Обработчик для reviews.resolved (просто логирование)
handleReviewResolved:
  1. INSERT INTO task_history (action='review_resolved', ...)

# 5.6 Обработчик для files.uploaded (разблокировка кнопки)
handleFileUploaded:
  1. Emit event 'file.uploaded' (WebSocket → UI разблокирует кнопку ОТПРАВИТЬ)

# 5.7 Error handling + retry
→ Если обработка события упала:
  - Логирует ошибку с event_id
  - НЕ удаляет событие из потока (XACK только после успеха)
  - Re-delivery через 5 секунд (XREAD с последней успешной позиции)
```

**Код outline:**

```typescript
// src/orchestrator/orchestrator.listener.ts
export class OrchestratorListener {
  constructor(
    private redis: Redis,
    private db: SupabaseClient,
    private eventsService: EventsService,
    private notificationsService: NotificationsService,
    private wsService: WebSocketService,
    private logger: Logger
  ) {}

  async start() {
    const STREAM = 'events:*';
    const CONSUMER_GROUP = 'orchestrator_group';
    let lastId = '0';  // Start from beginning, or use Redis XINFO

    try {
      // Создать consumer group (если не существует)
      try {
        await this.redis.xgroupCreate(STREAM, CONSUMER_GROUP, '0', { MKSTREAM: true });
      } catch (e) {
        if (!e.message.includes('already exists')) throw e;
      }

      while (true) {  // Main loop
        // XREADGROUP: читай как консьюмер
        const events = await this.redis.xreadgroup(
          'GROUP',
          CONSUMER_GROUP,
          'orchestrator_worker_1',  // Consumer ID
          'BLOCK',
          '1000',  // Block 1 sec если нет событий
          'STREAMS',
          STREAM,
          '>'  // '>' = только новые для этой группы
        );

        if (events && events.length > 0) {
          const [streamName, messages] = events[0];
          
          for (const [messageId, data] of messages) {
            try {
              await this.handleEvent({
                id: messageId,
                ...Object.fromEntries(data)  // [key, val, key, val] → { key: val }
              });
              
              // SUCCESS: acknowledge
              await this.redis.xack(STREAM, CONSUMER_GROUP, messageId);
              this.logger.info(`✓ Event processed: ${messageId}`);
            } catch (error) {
              this.logger.error(`✗ Event failed: ${messageId}`, error);
              // Не ackнуем → будет retry позже
            }
          }
        }
      }
    } catch (error) {
      this.logger.fatal('Orchestrator crashed:', error);
      process.exit(1);
    }
  }

  private async handleEvent(event: any) {
    const { event_type, task_id, triggered_by_user_id, ...metadata } = event;
    
    switch (event_type) {
      case 'tasks.status_changed':
        await this.handleStatusChanged({
          taskId: parseInt(task_id),
          oldStatus: metadata.old_status,
          newStatus: metadata.new_status,
          ...
        });
        break;

      case 'tasks.approved':
        await this.handleTaskApproved({ taskId: parseInt(task_id) });
        break;

      case 'reviews.created':
        await this.handleReviewCreated({
          taskId: parseInt(task_id),
          severity: metadata.severity,
          ...
        });
        break;

      // ...
    }
  }

  private async handleTaskApproved(event: { taskId: number }) {
    const { taskId } = event;
    
    // Найти зависимости где dependent_id = taskId
    const { data: dependencies } = await this.db
      .from('task_dependencies')
      .select('parent_task_id')
      .eq('dependent_task_id', taskId);

    if (!dependencies || dependencies.length === 0) {
      this.logger.debug(`No dependencies for task ${taskId}`);
      return;
    }

    // Для каждой parent
    for (const dep of dependencies) {
      const parentId = dep.parent_task_id;
      
      // Загрузить parent
      const { data: parent } = await this.db
        .from('tasks')
        .select('*')
        .eq('id', parentId)
        .single();

      if (parent.status === 'awaiting_data') {
        // РАЗБЛОКИРОВАТЬ
        await this.db
          .from('tasks')
          .update({
            status: 'in_progress',
            unblocked_at: new Date().toISOString(),
            dependency_resolved: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', parentId);

        // История
        await this.db
          .from('task_history')
          .insert({
            task_id: parentId,
            changed_at: new Date().toISOString(),
            changed_by_id: 'system',
            action: 'auto_unblock',
            old_status: 'awaiting_data',
            new_status: 'in_progress',
            message: `Автоматически разблокирована: зависимая задача #${taskId} утверждена`,
          });

        // EMIT для WebSocket
        await this.eventsService.emit({
          type: 'tasks.unblocked',
          taskId: parentId,
          triggeredByUserId: 'system',
          triggeredByRole: 'system',
          timestamp: new Date(),
          metadata: { dependent_task_id: taskId }
        });

        // NOTIFY инженеру
        await this.notificationsService.createAndSend({
          userId: parent.assignee_id,
          type: 'dependency_resolved',
          title: '🎉 Блокировка снята!',
          message: `Данные от зависимой задачи готовы. Вы можете продолжить работу над "${parent.title}"`,
          relatedEntityType: 'task',
          relatedEntityId: parentId,
          channels: ['telegram', 'in_app'],
        });

        this.logger.info(`✓ Task ${parentId} unblocked (dependent ${taskId} approved)`);
      }
    }
  }

  private async handleReviewCreated(event: any) {
    const { taskId, severity } = event;
    const { data: task } = await this.db
      .from('tasks')
      .select('assignee_id, project_id')
      .eq('id', taskId)
      .single();

    // Notify инженеру
    await this.notificationsService.createAndSend({
      userId: task.assignee_id,
      type: 'review_comment',
      title: `💬 Новое замечание в задаче`,
      message: event.text,
      relatedEntityType: 'review',
      relatedEntityId: event.review_id,
      channels: ['in_app'],  // Только in-app для review
    });

    // Если blocker → notify ГИПу
    if (severity === 'blocker') {
      const { data: gip } = await this.db
        .from('app_users')
        .select('id')
        .eq('role', 'gip')
        .eq('projects', `[${task.project_id}]`)  // JSONB contains
        .single();

      if (gip) {
        await this.notificationsService.createAndSend({
          userId: gip.id,
          type: 'blocking_review',
          title: '🚨 BLOCKING замечание',
          message: `Task #${taskId} имеет блокирующее замечание`,
          relatedEntityType: 'task',
          relatedEntityId: taskId,
          channels: ['in_app'],
        });
      }
    }
  }

  // ... остальные handlers
}
```

**Deliverables:**
- [ ] Listener loop постоянно читает события из Redis
- [ ] handleTaskApproved корректно разблокирует зависимые задачи
- [ ] handleReviewCreated отправляет уведомления
- [ ] Consumer group + offset tracking (no duplicate processing)
- [ ] Graceful shutdown (SIGTERM)
- [ ] Логирование каждого события

**Время:** 10-12 часов

---

### ШАГ 6: NOTIFICATIONS + CHANNELS

**Цель:** реализовать отправку уведомлений по разным каналам (in-app, Telegram, Email)

**Задачи:**

```bash
# 6.1 Notification сущность (уже в БД)
→ Таблица notifications (id, user_id, type, title, message, read, channels, ...)

# 6.2 Каналы отправки (rules из system-orchestrator.md)
ПРАВИЛО 1: ВАЖНОЕ → Telegram + IN-APP
  • Задача утверждена ✓
  • Задача возвращена ✓
  • Дедлайн прошёл
  • Блокировка > 48ч
  • Lead не проверяет > 48ч

ПРАВИЛО 2: ИНФОРМАЦИОННОЕ → IN-APP только
  • Добавлено замечание (в Step 5)
  • Замечание разрешено
  • На проверке < 4ч
  • Новая задача

ПРАВИЛО 3: НАПОМИНАНИЕ → IN-APP или Telegram (по выбору)
  • Дедлайн - 2 дня
  • На проверке > 4ч
  • Ожидание данные > 12ч

# 6.3 Основные типы уведомлений (из api-contract.md Section 2.4)
task_created
submitted_for_review
task_returned
task_approved ✓
review_comment ✓
blocking_alert
deadline_warning
dependency_resolved ✓
review_timeout
rework_cycle_alert

# 6.4 Integration с внешними сервисами
Telegram: Supabase Edge Function или node-telegram-bot-api
  → user.notification_channels.telegram_enabled
  → user.notification_channels.telegram_chat_id
  → Отправить markdown сообщение с ссылкой

Email: SendGrid или Supabase Edge Function
  → user.email
  → HTML template
  → Отправить

# 6.5 User preferences (настройка каналов)
→ GET  /v1/users/me/notifications/settings
→ PATCH /v1/users/me/notifications/settings
  {
    "telegram_enabled": true,
    "email_enabled": false
  }
```

**Код outline:**

```typescript
// src/modules/notifications/notifications.service.ts
export class NotificationsService {
  constructor(
    private db: SupabaseClient,
    private telegram: TelegramService,
    private email: EmailService,
    private logger: Logger
  ) {}

  async createAndSend(options: {
    userId: string;
    type: string;
    title: string;
    message: string;
    relatedEntityType: string;
    relatedEntityId: string;
    channels: ('in_app' | 'telegram' | 'email')[];
  }): Promise<void> {
    const {
      userId, type, title, message, relatedEntityType, relatedEntityId, channels
    } = options;

    // 1. Сохранить в БД
    const { data: notification } = await this.db
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        read: false,
        channels,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    // 2. Загрузить user preferences
    const { data: user } = await this.db
      .from('app_users')
      .select('email, notification_channels')
      .eq('id', userId)
      .single();

    if (!user) {
      this.logger.warn(`User ${userId} not found`);
      return;
    }

    // 3. Отправить по каналам
    for (const channel of channels) {
      try {
        switch (channel) {
          case 'telegram':
            if (user.notification_channels?.telegram_enabled) {
              await this.telegram.send({
                chatId: user.notification_channels.telegram_chat_id,
                message: this.formatTelegramMessage(notification, relatedEntityType, relatedEntityId),
              });
              this.logger.info(`✓ Telegram sent to ${userId}`);
            }
            break;

          case 'email':
            if (user.notification_channels?.email_enabled) {
              await this.email.send({
                to: user.email,
                subject: title,
                html: this.formatEmailTemplate(notification, relatedEntityType),
              });
              this.logger.info(`✓ Email sent to ${user.email}`);
            }
            break;

          case 'in_app':
            // Уже в БД, WebSocket передаст в UI
            this.logger.info(`✓ In-app notification created for ${userId}`);
            break;
        }
      } catch (error) {
        this.logger.error(`✗ Failed to send ${channel} to ${userId}:`, error);
        // Не падаем — пытаемся отправить по другим каналам
      }
    }
  }

  private formatTelegramMessage(notification: any, entityType: string, entityId: string): string {
    const baseUrl = 'https://enghub.example.com';
    const link = `${baseUrl}/${entityType}/${entityId}`;

    return `${notification.title}\n\n${notification.message}\n\n[Посмотреть](${link})`;
  }

  private formatEmailTemplate(notification: any, entityType: string): string {
    return `
      <h2>${notification.title}</h2>
      <p>${notification.message}</p>
      <p><a href="https://enghub.example.com">Открыть в EngHub</a></p>
    `;
  }
}

// src/services/telegram.service.ts
export class TelegramService {
  constructor(private bot: TelegramBot) {}

  async send(options: { chatId: string; message: string }): Promise<void> {
    await this.bot.sendMessage(options.chatId, options.message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  }
}
```

**Deliverables:**
- [ ] Notifications сохраняются в БД
- [ ] Telegram интеграция (если enabled)
- [ ] Email интеграция (если enabled)
- [ ] IN-APP уведомления через WebSocket
- [ ] User preferences (settings endpoint)
- [ ] Graceful error handling (не падает если один канал недоступен)

**Время:** 6-8 часов

---

### ШАГ 7: WEBSOCKET + REAL-TIME UPDATES

**Цель:** реализовать live-update UI при событиях

**Задачи:**

```bash
# 7.1 WebSocket server (встроено в Fastify через fastify-websocket)
→ wss://api.enghub.com/ws?token=<JWT>

# 7.2 Rooms/Subscriptions (для ограничения broadcast)
Каждый клиент подписывается на:
  - project:uuid-123          (ГИП этого проекта)
  - team:uuid-team-kj         (Lead этого отдела)
  - user:uuid-engineer-1      (только эта инженер)

# 7.3 События что транслировать по WebSocket
  1. task.status_changed      → room project + team + user
  2. task.approved            → room project + team
  3. task.unblocked           → room user (инженеру)
  4. review.added             → room user (инженеру) + project
  5. file.uploaded            → room project
  6. notification.created     → room user
  7. dependency.created       → room project
  8. dependency.resolved      → room user (инженеру)

# 7.4 Heartbeat (ping/pong каждые 30 сек)
→ Проверить что соединение живо
→ Клиент отправляет { type: "ping" }
→ Сервер отвечает { type: "pong", timestamp }

# 7.5 Connection lifecycle
→ client connects → subscribe to rooms
→ server broadcasts events → client receives
→ client updates UI
→ client disconnect → unsubscribe

# 7.6 Error recovery
→ Если подключение упало — реконнект с exponential backoff
→ При реконнекте передать last_event_id для синхронизации
```

**Код outline:**

```typescript
// src/ws/ws.gateway.ts
import fastifyWebsocket from '@fastify/websocket';

export class WebSocketGateway {
  constructor(
    private app: FastifyInstance,
    private wsService: WebSocketService
  ) {}

  async register() {
    this.app.register(fastifyWebsocket, { errorHandler: (error, socket) => {
      this.app.log.error('WS error:', error);
    }});

    this.app.get('/ws', { websocket: true }, async (connection, request) => {
      try {
        const token = request.query.token;
        const user = await this.validateToken(token);
        
        // Determine rooms
        const rooms = this.determineRooms(user);
        
        // Subscribe
        await this.wsService.subscribe(connection, user.id, rooms);
        
        // Message handler
        connection.socket.on('message', async (data: string) => {
          try {
            const message = JSON.parse(data);
            
            if (message.type === 'ping') {
              connection.socket.send(JSON.stringify({
                type: 'pong',
                timestamp: new Date().toISOString(),
              }));
            }
            // Можно добавить другие сообщения (например, для RPC)
          } catch (error) {
            this.app.log.error('WS message parse error:', error);
          }
        });

        connection.socket.on('close', async () => {
          await this.wsService.unsubscribe(user.id);
        });
      } catch (error) {
        this.app.log.error('WS auth failed:', error);
        connection.socket.close(1008, 'Unauthorized');
      }
    });
  }

  private determineRooms(user: User): string[] {
    const rooms: string[] = [`user:${user.id}`];

    if (user.role === 'lead') {
      rooms.push(`team:${user.team_id}`);
    }

    if (user.role === 'gip') {
      user.projects.forEach(projectId => {
        rooms.push(`project:${projectId}`);
      });
    }

    return rooms;
  }

  private async validateToken(token: string): Promise<User> {
    // JWT validation
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data: user } = await this.db
      .from('app_users')
      .select('*')
      .eq('id', decoded.sub)
      .single();
    return user;
  }
}

// src/ws/ws.service.ts
export class WebSocketService {
  private connections = new Map<string, Set<WebSocket>>();
  private roomSubscriptions = new Map<string, Set<string>>();  // room → user_ids

  async subscribe(socket: WebSocket, userId: string, rooms: string[]) {
    // Track connection
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(socket);

    // Subscribe to rooms
    for (const room of rooms) {
      if (!this.roomSubscriptions.has(room)) {
        this.roomSubscriptions.set(room, new Set());
      }
      this.roomSubscriptions.get(room)!.add(userId);
    }
  }

  async unsubscribe(userId: string) {
    this.connections.delete(userId);
    // Remove from all rooms
    for (const subscribers of this.roomSubscriptions.values()) {
      subscribers.delete(userId);
    }
  }

  async broadcast(event: DomainEvent, targetRooms: string[]) {
    const message = JSON.stringify({
      type: 'event',
      event: event.type,
      data: event.metadata,
      timestamp: new Date().toISOString(),
    });

    // Найти всех пользователей в этих rooms
    const userIds = new Set<string>();
    for (const room of targetRooms) {
      const subscribers = this.roomSubscriptions.get(room);
      if (subscribers) {
        subscribers.forEach(userId => userIds.add(userId));
      }
    }

    // Отправить всем в нужных rooms
    for (const userId of userIds) {
      const userSockets = this.connections.get(userId);
      if (userSockets) {
        for (const socket of userSockets) {
          socket.send(message);
        }
      }
    }
  }
}

// В OrchestratorListener:
// Когда обработали событие → broadcast через WebSocket
async handleTaskApproved(event: any) {
  // ... apply changes to DB ...
  
  // Broadcast to WebSocket
  await this.wsService.broadcast(
    {
      type: 'task.approved',
      metadata: { id: taskId, status: 'approved', ... }
    },
    [
      `project:${task.project_id}`,
      `team:${task.team_id}`,  // Lead видит
      `user:${task.assignee_id}`,  // Инженер видит
    ]
  );
}
```

**Deliverables:**
- [ ] WebSocket server поднялся и принимает JWT
- [ ] Room subscriptions работают (project, team, user)
- [ ] Все 8 событий транслируются по WebSocket
- [ ] Heartbeat (ping/pong) каждые 30 сек
- [ ] Graceful disconnect
- [ ] Frontend может подписаться и получить updates

**Время:** 8-10 часов

---

## 4. РЕАЛИЗАЦИЯ EVENT-DRIVEN СИСТЕМЫ

### Flow: Инженер → Submit → Lead → Comment → GIP → Approve → Auto-Unblock

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. ИНЖЕНЕР ОТПРАВЛЯЕТ НА ПРОВЕРКУ                               │
├─────────────────────────────────────────────────────────────────┤

Client:  PATCH /v1/tasks/4/status
         { new_status: "review_lead", comment?: "Готово" }

Backend:
  1. Validate status transition (in_progress → review_lead) ✓
  2. Check: COUNT(files) > 0 ✓
  3. UPDATE tasks SET status='review_lead', submitted_to_lead_at=NOW()
  4. INSERT task_history
  5. EMIT EVENT → Redis:
     {
       event_type: "tasks.status_changed",
       task_id: 4,
       old_status: "in_progress",
       new_status: "review_lead",
       triggered_by: { user_id: "engineer-1", role: "engineer" },
       timestamp: "2026-05-05T14:15:00Z"
     }

Response: { id: 4, status: "review_lead", ... }

WebSocket:
  server broadcasts to rooms ["project:uuid", "team:lead-team"]
  {
    event: "task.status_changed",
    data: { id: 4, status: "review_lead", ... }
  }

UI Updates:
  - Инженер видит задачу как "На проверке Lead"
  - Lead видит в своей очереди новую задачу (notification bell + list)

┌─────────────────────────────────────────────────────────────────┐
│ 2. LEAD ДОБАВЛЯЕТ ЗАМЕЧАНИЕ                                     │
├─────────────────────────────────────────────────────────────────┤

Client:  POST /v1/reviews
         {
           task_id: 4,
           severity: "major",
           location: "Узел A5",
           text: "Потеря обозначения кабеля",
           tag: "dimensioning"
         }

Backend:
  1. Validate (severity valid, text not empty) ✓
  2. Check: task.status = "review_lead" (можно добавлять) ✓
  3. INSERT reviews
  4. INSERT task_history
  5. EMIT EVENT:
     {
       event_type: "reviews.created",
       review_id: 1,
       task_id: 4,
       severity: "major",
       triggered_by: { user_id: "lead-1", role: "lead" },
       timestamp: "..."
     }

Response: { id: 1, task_id: 4, severity: "major", resolved: false, ... }

Orchestrator Listener (Step 5):
  receive event "reviews.created"
  → handleReviewCreated(taskId: 4, severity: "major")
  → Send NOTIFICATION to engineer:
    type: "review_comment"
    title: "💬 Новое замечание в задаче"
    message: "Потеря обозначения кабеля"
    channels: ["in_app"]
    → INSERT notifications
    → EMIT EVENT:
      {
        event_type: "notification.created",
        user_id: "engineer-1",
        type: "review_comment",
        ...
      }

UI Updates:
  - Инженер видит RED BADGE (1 замечание)
  - Инженер видит NOTIFICATION в центре уведомлений

┌─────────────────────────────────────────────────────────────────┐
│ 3. ИНЖЕНЕР ИСПРАВЛЯЕТ И ПЕРЕОТПРАВЛЯЕТ                          │
├─────────────────────────────────────────────────────────────────┤

Client:  PATCH /v1/tasks/4/status
         { new_status: "review_lead" }  ← откат в rework → review_lead

Backend:
  1. Validate: rework → review_lead (инженер, есть файл) ✓
  2. UPDATE tasks SET status='review_lead'
  3. EMIT EVENT → Redis

Инженер мог внести правки → PATCH /v1/reviews/1
                           { resolved: true, resolution_comment: "Исправлено в v2" }

Orchestrator:
  → handleReviewResolved → история

┌─────────────────────────────────────────────────────────────────┐
│ 4. LEAD ОДОБРЯЕТ И ОТПРАВЛЯЕТ ГИПу                              │
├─────────────────────────────────────────────────────────────────┤

Client:  PATCH /v1/tasks/4/status
         { new_status: "review_gip" }

Backend:
  1. Validate: review_lead → review_gip (Lead может) ✓
  2. Check: NO unresolved blocker замечания ✓
  3. UPDATE tasks SET status='review_gip', submitted_to_gip_at=NOW()
  4. EMIT EVENT → Redis:
     { event_type: "tasks.status_changed", ..., new_status: "review_gip" }

Orchestrator:
  → Create NOTIFICATION for ГИП:
    type: "submitted_for_review"
    title: "✅ Готово к утверждению"
    message: "Lead проверил задачу КЖ-2026-Fase-1-СЭ_Расчёты"
    channels: ["telegram", "in_app"]
    → Supabase function отправляет Telegram

WebSocket:
  broadcast to ["project:uuid", "user:gip-uuid"]

UI:
  - ГИП видит в своей очереди новую задачу
  - Telegram push к ГИПу

┌─────────────────────────────────────────────────────────────────┐
│ 5. ГИП УТВЕРЖДАЕТ → АВТОМАТИЧЕСКАЯ РАЗБЛОКИРОВКА                │
├─────────────────────────────────────────────────────────────────┤

Client:  PATCH /v1/tasks/4/status
         { new_status: "approved" }

Backend:
  1. Validate: review_gip → approved (ГИП может) ✓
  2. Check: NO unresolved blocker ✓
  3. UPDATE tasks SET status='approved', approved_at=NOW(), approved_by_gip_id=...
  4. EMIT TWO EVENTS:
     a) { event_type: "tasks.status_changed", ..., new_status: "approved" }
     b) { event_type: "tasks.approved", task_id: 4, ... }

Orchestrator Listener (КЛЮЧЕВОЙ МОМЕНТ):
  receive event "tasks.approved"
  → handleTaskApproved(taskId: 4)
  
  → SELECT * FROM task_dependencies WHERE dependent_id = 4
    → result: parent_task_id = 5
  
  → SELECT * FROM tasks WHERE id = 5
    → result: status = "awaiting_data" ✓
  
  → UPDATE tasks SET status = 'in_progress', unblocked_at = NOW()
    WHERE id = 5
  
  → INSERT task_history (task_id=5, action='auto_unblock', ...)
  
  → EMIT EVENT:
    {
      event_type: "tasks.unblocked",
      task_id: 5,
      triggered_by: "system",
      unblocked_reason: "зависимая задача #4 утверждена"
    }
  
  → Create NOTIFICATION for инженера #5:
    type: "dependency_resolved"
    title: "🎉 Блокировка снята!"
    message: "Данные от КЖ готовы. Вы можете продолжить работу"
    channels: ["telegram", "in_app"]

WebSocket (двойной broadcast):
  1. broadcast to ["project:uuid", "team:lead-team", "user:engineer-1"]
     { event: "task.approved", data: { id: 4, status: "approved" } }
  
  2. broadcast to ["project:uuid", "team:es-lead-team", "user:engineer-5"]
     { event: "task.unblocked", data: { id: 5, status: "in_progress" } }
  
  3. broadcast to ["user:engineer-5"]
     { event: "notification.created", data: { type: "dependency_resolved", ... } }

UI Updates:
  - Инженер #4 видит задачу как "✅ Утверждено"
  - Инженер #5 видит свою задачу:
    • Статус изменился с 🔴 БЛОКИРОВАНА на 🟢 В РАБОТЕ
    • Карточка обновилась
    • NOTIFICATION bell красная + всплывающее сообщение
    • Может нажать [НАЧАТЬ РАБОТУ]

┌─────────────────────────────────────────────────────────────────┐
│ ИТОГО: CHAIN ЗАКОНЧЕНА                                          │
├─────────────────────────────────────────────────────────────────┤

✓ 8 событий пройдено
✓ 3 задачи обновлены (4: утверждена, 5: разблокирована)
✓ 5 уведомлений отправлено
✓ WebSocket синхронизировал UI в реальном времени
✓ Инженер #5 может начать работу сразу же
✓ История записана
✓ Метрики обновлены (если нужны)
```

---

## 5. КРИТИЧЕСКИЕ РИСКИ

### RISK 1: Race Conditions (конфликтующие операции параллельно)

**Сценарий:**
```
t=0: Lead A начинает проверку task #4
     UPDATE tasks SET status='review_gip' (Lead A)
     
t=1: Одновременно инженер нажимает откат [ВЕРНУТЬ В РАБОТУ]
     UPDATE tasks SET status='in_progress' (Engineer)
     
Результат: одно из обновлений потеряется (LOST UPDATE)
```

**Решение:**
```
→ Использовать optimistic locking (version/revision column)
  UPDATE tasks 
  SET status='review_gip', revision=revision+1
  WHERE id=4 AND revision=5  ← проверить что никто не менял

→ Если revision не совпадает → 409 Conflict
  "Задача изменилась, перезагрузите и попробуйте снова"

→ Альтернатива: Pessimistic locking (SELECT FOR UPDATE)
  BEGIN;
  SELECT * FROM tasks WHERE id=4 FOR UPDATE;
  UPDATE ...
  COMMIT;
  (медленнее, но гарантирует последовательность)
```

### RISK 2: Дублирование событий (same event processed twice)

**Сценарий:**
```
Orchestrator получил event "tasks.approved" с id "1234567890-0"
Обработал, разблокировал зависимую задачу
Но при сохранении XACK упал (сбой сети)

Через 5 сек: Orchestrator переподключился, прочитал "1234567890-0" снова
Обработал снова → разблокировка #2

Результат: зависимая задача разблокирована ДВА РАЗА
```

**Решение:**
```
→ Idempotent operations (операция безопасна при повторе)
  
  Плохо:
  INSERT INTO task_history (...)  ← каждый вызов добавляет запись
  
  Хорошо:
  INSERT INTO task_history (...)
    ON CONFLICT (task_id, event_id) DO NOTHING
  ← event_id = уникальный ID события, повтор не добавит дубль

→ Или: check перед обработкой
  IF EXISTS (SELECT 1 FROM processed_events WHERE event_id = '1234567890-0')
    RETURN  ← пропустить
  ELSE
    INSERT INTO processed_events (event_id)
    ... обработка ...

→ Или: transaction + XACK только в конце
  BEGIN;
  ... apply changes ...
  redis.XACK(stream, group, messageId)
  COMMIT;
  
  Если упал → отката, нет XACK → переобработка
```

### RISK 3: Lost Events (событие потеряется в очереди)

**Сценарий:**
```
Инженер отправил на review → INSERT in DB OK
Trigger пытается XADD в Redis → Redis down (перезагрузка)

Результат: Backend думает всё OK, но event не в очереди
Orchestrator не знает о задаче на review
Lead ждёт задачу, которая не пришла
```

**Решение:**
```
→ Используй Redis Streams persistence (не памяти)
  redis.acl setuser ... +@stream  (ACL для streams)
  
→ Или: transactional outbox pattern
  
  В ОДНОЙ TRANSACTION:
  1. INSERT task
  2. INSERT outbox (待处理 событие в БД)
  COMMIT;
  
  Фоновый процесс читает outbox:
  FOR EACH event IN outbox WHERE processed=false:
    redis.XADD(...)
    UPDATE outbox SET processed=true

→ Результат: если Redis down → события будут в outbox
  При восстановлении Redis → re-push все непроцессанные
```

### RISK 4: Задача заблокирована вечно (impossible unblock)

**Сценарий:**
```
Задача A зависит от B
B утверждена → A разблокируется ✓

Но: допустим, ГИП удалил B или сменил зависимость
Теперь A в статусе awaiting_data, но B не существует
Дедлайн A прошёл, A остаётся красной

Результат: ГИП не видит, что происходит
```

**Решение:**
```
→ Фоновая проверка (heartbeat из system-orchestrator.md)
  КАЖДЫЙ ЧАС:
  FOR EACH task WHERE status='awaiting_data':
    CHECK: dependent_id существует и не archived?
    CHECK: dependent.status = 'approved'?
    
    IF YES → разблокировать (даже если ГИП не заметил)
    IF NO → Alert ГИПу: "Зависимость поломана или потеряна"

→ ГИП может вручную разблокировать:
  PATCH /v1/dependencies/:id
  { resolved: true, comment: "Получены данные по почте" }
```

### RISK 5: WebSocket переполнен сообщениями (DDoS)

**Сценарий:**
```
Orchestrator испускает события очень быстро (bulk update)
WebSocket broadcast загружает сеть
Клиент не может разобраться в потоке сообщений
```

**Решение:**
```
→ Batch events (собрать события и отправить одним пакетом)
  Instead of:
    emit event → broadcast
    emit event → broadcast
    emit event → broadcast
  
  Do:
    collect events (100ms timeout)
    batch broadcast { events: [...] }

→ Throttle broadcast (не чаще чем 1 раз в N сек)
  next_broadcast = now + 500ms
  IF event received AND now >= next_broadcast:
    broadcast → reset next_broadcast

→ Use delta updates (отправлять только что изменилось)
  Instead of: { task: { id, status, title, ... } }
  Send: { task_id: 4, status: "approved" }
```

### RISK 6: Гонка в счётчиках (rework_count, revision_count)

**Сценарий:**
```
Lead A нажимает [ВЕРНУТЬ] → rework_count + 1
Lead B одновременно нажимает [ВЕРНУТЬ] → rework_count + 1

Expected: rework_count = 2
Actual: rework_count = 1 (LOST UPDATE)

Причина: SELECT, затем UPDATE по старому значению
```

**Решение:**
```
→ Используй UPDATE с выражением, не значением
  Плохо:
  current = SELECT rework_count WHERE id=4;
  UPDATE rework_count = current + 1;  ← race condition
  
  Хорошо:
  UPDATE rework_count = rework_count + 1 WHERE id=4;
  ← atomic operation в БД

→ Или: distributed counter (Redis)
  redis.INCR(`task:4:rework_count`)
  ... но потом синхронизировать в БД при архивировании
```

---

## 6. ИНТЕГРАЦИЯ С FRONTEND

### Что делает Frontend

```
LOGIN FLOW:
  1. Пользователь логинится (Supabase Auth)
  2. Получает JWT + refresh token
  3. Сохраняет в localStorage / sessionStorage

API CALLS:
  1. При загрузке страницы → GET /v1/tasks
  2. При клике [ОТПРАВИТЬ] → PATCH /v1/tasks/:id/status
  3. При добавлении замечания → POST /v1/reviews
  4. Периодическая синхронизация (если нет WebSocket)

WEBSOCKET CONNECTION:
  1. После логина → connect к wss://api.enghub.com/ws?token=JWT
  2. Frontend отправляет подписку:
     { type: "subscribe", channels: ["project:uuid-123"] }
  3. Слушает сообщения
  4. Обновляет UI при получении event

UI UPDATES:
  1. Когда статус изменился → refresh task card
  2. Когда добавилось замечание → добавить в список + badge
  3. Когда задача разблокирована → зелёный флаг + notification
```

### Когда дергать API vs когда слушать WS

```
ВСЕГДА ДЕРГАТЬ API (REST):
  ✓ POST   /tasks             (создание)
  ✓ GET    /tasks             (initial load, не на каждый event)
  ✓ PATCH  /tasks/:id/status  (смена статуса)
  ✓ POST   /reviews           (добавление замечания)
  ✓ PATCH  /reviews/:id       (разрешение)
  
  Почему: эти операции требуют подтверждения server, не fire-and-forget

ТОЛЬКО СЛУШАТЬ WEBSOCKET (для live updates):
  ✓ task.status_changed  → update UI (список + карточка)
  ✓ review.added         → добавить замечание + badge
  ✓ task.approved        → зелёный флаг + notification
  ✓ task.unblocked       → убрать красный флаг + notification
  ✓ file.uploaded        → обновить список файлов
  
  Почему: это изменения от других пользователей, UI должна обновиться live

API + WEBSOCKET (hybrid):
  1. User нажимает [ОТПРАВИТЬ] → POST /tasks/:id/status
  2. Backend обновляет БД + отправляет event в Redis
  3. WebSocket получает event → broadcast
  4. UI обновляется (для всех, кто слушает)
  5. Response приходит на клиента → финальное подтверждение

Example frontend flow (React):

  const [task, setTask] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Initial load
  useEffect(() => {
    fetch('/api/v1/tasks/4').then(r => r.json()).then(setTask);
  }, []);

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocket('wss://api.enghub.com/ws?token=' + token);
    
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      
      if (msg.type === 'pong') return;  // heartbeat
      
      if (msg.event === 'task.status_changed' && msg.data.id === task.id) {
        setTask(prev => ({ ...prev, status: msg.data.status }));
      }
      
      if (msg.event === 'review.added' && msg.data.task_id === task.id) {
        setTask(prev => ({
          ...prev,
          reviews: [...prev.reviews, msg.data]
        }));
      }
      
      if (msg.event === 'notification.created') {
        setNotifications(prev => [msg.data, ...prev]);
        showBell(true);  // красная точка
      }
    };
    
    return () => ws.close();
  }, [task.id]);

  // User action: change status
  const handleStatusChange = async (newStatus) => {
    const res = await fetch(`/api/v1/tasks/4/status`, {
      method: 'PATCH',
      body: JSON.stringify({ new_status: newStatus })
    });
    const updated = await res.json();
    
    // Frontend уже получит update через WebSocket,
    // но можно и сразу обновить для UX
    setTask(prev => ({ ...prev, status: updated.status }));
  };
```

---

## 7. ТЕСТОВАЯ СТРАТЕГИЯ

### UNIT TESTS

**Что тестировать:** Pure functions, validators, rules

```typescript
// tests/unit/tasks.validators.test.ts
describe('TaskStatusValidator', () => {
  let validator: TaskStatusValidator;

  beforeEach(() => {
    validator = new TaskStatusValidator();
  });

  describe('canTransitionTo', () => {
    it('allows engineer to transition from created to in_progress', () => {
      const result = validator.canTransitionTo('created', 'in_progress', 'engineer');
      expect(result.allowed).toBe(true);
    });

    it('rejects engineer transitioning to review_gip', () => {
      const result = validator.canTransitionTo('review_lead', 'review_gip', 'engineer');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Only Lead');
    });

    it('rejects invalid transitions (e.g., from approved)', () => {
      const result = validator.canTransitionTo('approved', 'in_progress', 'gip');
      expect(result.allowed).toBe(false);
    });
  });

  describe('validateBusinessRules', () => {
    it('requires file before submitting to review', async () => {
      const task = { id: 4, status: 'in_progress' };
      const errors = await validator.validateBusinessRules(
        task,
        'review_lead',
        mockDb
      );
      expect(errors.valid).toBe(false);
      expect(errors.errors[0]).toContain('file');
    });

    it('allows submit if file exists', async () => {
      // mock DB to return 1 file
      const errors = await validator.validateBusinessRules(task, 'review_lead', mockDb);
      expect(errors.valid).toBe(true);
    });
  });
});

// tests/unit/orchestrator.rules.test.ts
describe('OrchestratorRules', () => {
  describe('auto-unblock logic', () => {
    it('unblocks parent task when dependent is approved', async () => {
      // Given: parent task is awaiting_data, dependent is in review_gip
      // When: dependent status changes to approved
      // Then: parent should transition to in_progress
      
      const result = await rules.shouldUnblockParent(
        { id: 4, status: 'approved' },  // dependent
        { id: 5, status: 'awaiting_data', dependent_task_id: 4 }  // parent
      );
      
      expect(result).toBe(true);
    });

    it('does not unblock if parent not in awaiting_data', async () => {
      const result = await rules.shouldUnblockParent(
        { id: 4, status: 'approved' },
        { id: 5, status: 'in_progress', dependent_task_id: 4 }
      );
      expect(result).toBe(false);
    });
  });
});
```

**Coverage target:** 80%+ (rules, validators, services)

### INTEGRATION TESTS

**Что тестировать:** API endpoints, DB transactions, RLS

```typescript
// tests/integration/task-flow.test.ts
describe('Task Full Flow', () => {
  let task: Task;
  let engineerClient: SupabaseClient;  // authenticated as engineer
  let leadClient: SupabaseClient;      // authenticated as lead

  beforeAll(async () => {
    // Setup: create test task
    task = await createTestTask({
      assignee_id: engineerId,
      status: 'created',
    });
  });

  test('engineer can submit to lead', async () => {
    // Attach file first
    await engineerClient
      .from('task_files')
      .insert({ task_id: task.id, ... });

    // Submit
    const { data: updated, error } = await engineerClient
      .rpc('update_task_status', {
        task_id: task.id,
        new_status: 'review_lead'
      });

    expect(error).toBeNull();
    expect(updated.status).toBe('review_lead');
  });

  test('lead can add blocker comment', async () => {
    const { data: review } = await leadClient
      .from('reviews')
      .insert({
        task_id: task.id,
        severity: 'blocker',
        text: 'Fix this!',
        tag: 'critical'
      })
      .select()
      .single();

    expect(review.resolved).toBe(false);
  });

  test('lead cannot send to GIP with unresolved blocker', async () => {
    const { error } = await leadClient
      .rpc('update_task_status', {
        task_id: task.id,
        new_status: 'review_gip'
      });

    expect(error).toBeTruthy();
    expect(error.message).toContain('blocker');
  });

  test('after resolving blocker, lead can send to GIP', async () => {
    // Resolve
    await leadClient
      .from('reviews')
      .update({ resolved: true })
      .eq('id', blockingReviewId);

    // Send to GIP
    const { error } = await leadClient
      .rpc('update_task_status', {
        task_id: task.id,
        new_status: 'review_gip'
      });

    expect(error).toBeNull();
  });

  test('GIP can approve', async () => {
    const { data: approved } = await gipClient
      .rpc('update_task_status', {
        task_id: task.id,
        new_status: 'approved'
      })
      .select()
      .single();

    expect(approved.status).toBe('approved');
    expect(approved.approved_at).toBeTruthy();
  });
});

// tests/integration/blocking.test.ts
describe('Task Dependencies & Blocking', () => {
  test('creating task with dependency blocks it', async () => {
    const task = await createTestTask({
      deadline: futureDate,
      dependency: { dependent_from_team: teamKjId }
    });

    expect(task.status).toBe('awaiting_data');
  });

  test('unblocking dependency auto-unblocks parent', async () => {
    // Given: parent in awaiting_data
    const parent = await createTestTask({
      status: 'awaiting_data',
      dependency: { dependent_id: childTaskId }
    });

    // When: child is approved
    await gipClient.rpc('update_task_status', {
      task_id: childTaskId,
      new_status: 'approved'
    });

    // Then: parent should be in_progress (with delay for event processing)
    await wait(100);  // дать time для orchestrator

    const { data: updated } = await engineerClient
      .from('tasks')
      .select('status')
      .eq('id', parent.id)
      .single();

    expect(updated.status).toBe('in_progress');
  });

  test('manual unblock by GIP works', async () => {
    const parent = await createTestTask({ status: 'awaiting_data' });

    await gipClient
      .from('task_dependencies')
      .update({ resolved: true })
      .eq('id', parent.dependency_id);

    // Orchestrator обработает event
    await wait(100);

    const { data: updated } = await gipClient
      .from('tasks')
      .select('status')
      .eq('id', parent.id)
      .single();

    expect(updated.status).toBe('in_progress');
  });
});

// tests/integration/orchestrator.test.ts
describe('Orchestrator Event Processing', () => {
  test('processes tasks.approved event', async () => {
    // Emit event manually (или через API)
    const event = {
      event_type: 'tasks.approved',
      task_id: testTaskId,
      ...
    };

    // Listen for result
    const listener = new OrchestratorListener(redis, db, ...);
    listener.start();  // фоновый процесс

    // Emit
    await redis.xadd('events:*', '*', ...event);

    // Wait for processing
    await wait(500);

    // Verify: history logged
    const { data: history } = await db
      .from('task_history')
      .select('*')
      .eq('task_id', dependentTaskId)
      .order('changed_at', { ascending: false })
      .limit(1);

    expect(history[0].action).toBe('auto_unblock');
  });
});
```

**Coverage target:** 70%+ (happy path + error cases)

### E2E TESTS

**Что тестировать:** Full pipeline в production-like окружении

```typescript
// tests/e2e/full-pipeline.test.ts
describe('End-to-End: Engineer → Lead → GIP Approval', () => {
  // Setup: создать реальные accounts и задачу

  test('complete approval flow with notifications', async () => {
    // 1. Engineer creates and starts task
    const task = await gipClient.post('/v1/tasks', {
      project_id: projectId,
      assignee_id: engineerId,
      title: 'E2E Test Task',
      deadline_at: futureDate.toISOString(),
    });
    expect(task.status).toBe(201);

    // 2. Engineer uploads file and submits
    await engineerClient.post(`/v1/tasks/${task.body.id}/files`, {
      file: testFile
    });

    const submitRes = await engineerClient.patch(
      `/v1/tasks/${task.body.id}/status`,
      { new_status: 'review_lead' }
    );
    expect(submitRes.status).toBe(200);

    // 3. Wait for WebSocket notification to Lead
    const leadNotif = await waitForNotification(leadWs, 'submitted_for_review');
    expect(leadNotif).toBeTruthy();

    // 4. Lead reviews and adds comment
    await leadClient.post('/v1/reviews', {
      task_id: task.body.id,
      severity: 'major',
      text: 'Needs revision'
    });

    // 5. Wait for WebSocket notification to Engineer
    const engineerNotif = await waitForNotification(engineerWs, 'review_comment');
    expect(engineerNotif).toBeTruthy();

    // 6. Engineer resolves and resubmits
    const reviews = await engineerClient.get(
      `/v1/tasks/${task.body.id}?include=reviews`
    );
    await engineerClient.patch(
      `/v1/reviews/${reviews.body.reviews[0].id}`,
      { resolved: true }
    );

    await engineerClient.patch(
      `/v1/tasks/${task.body.id}/status`,
      { new_status: 'review_lead' }
    );

    // 7. Lead accepts and sends to GIP
    await leadClient.patch(
      `/v1/tasks/${task.body.id}/status`,
      { new_status: 'review_gip' }
    );

    // 8. Wait for GIP notification
    const gipNotif = await waitForNotification(gipWs, 'submitted_for_review');
    expect(gipNotif).toBeTruthy();

    // 9. GIP approves
    await gipClient.patch(
      `/v1/tasks/${task.body.id}/status`,
      { new_status: 'approved' }
    );

    // 10. Engineer should see task approved
    const approval = await waitForWebSocketEvent(
      engineerWs,
      'task.approved'
    );
    expect(approval.data.status).toBe('approved');

    // 11. Verify history
    const history = await engineerClient.get(
      `/v1/tasks/${task.body.id}/history`
    );
    expect(history.body).toContainEqual({
      action: 'submitted_for_review',
      ...
    });
  });
});

// tests/e2e/blocking.test.ts
describe('End-to-End: Blocking & Auto-Unblock', () => {
  test('dependent task unblocks when parent approved', async () => {
    // 1. Create parent task with dependency
    const parent = await gipClient.post('/v1/tasks', {
      project_id: projectId,
      assignee_id: parentEngineerId,
      title: 'Parent Task',
      deadline_at: futureDate.toISOString(),
      dependency: {
        required_from_team_id: teamKjId,
        required_data_description: 'Schema',
        deadline_for_dependency: nearFutureDate.toISOString()
      }
    });

    expect(parent.body.status).toBe('awaiting_data');

    // 2. Child task should be created automatically
    const childTasks = await gipClient.get('/v1/tasks', {
      filters: { title: 'Schema' }
    });
    const child = childTasks.body.data[0];

    // 3. Child engineer works on it
    const childEng = await getClientAs(childEngineerId);
    await childEng.post(`/v1/tasks/${child.id}/files`, { file: testFile });
    await childEng.patch(`/v1/tasks/${child.id}/status`, {
      new_status: 'review_lead'
    });

    // 4. Lead and GIP approve
    await getClientAs(childLeadId).patch(
      `/v1/tasks/${child.id}/status`,
      { new_status: 'review_gip' }
    );

    await gipClient.patch(
      `/v1/tasks/${child.id}/status`,
      { new_status: 'approved' }
    );

    // 5. Wait for orchestrator processing
    await wait(500);

    // 6. Parent should be unblocked
    const parentEng = await getClientAs(parentEngineerId);
    const unblocked = await parentEng.get(`/v1/tasks/${parent.body.id}`);
    expect(unblocked.body.status).toBe('in_progress');

    // 7. Parent engineer should see notification
    const notif = await waitForNotification(parentEngWs, 'dependency_resolved');
    expect(notif.message).toContain('ready');
  });
});
```

**Coverage target:** All critical flows, happy path + 2-3 error scenarios per flow

### Test Data Strategy

```typescript
// tests/fixtures/test-data.ts
export const testData = {
  users: {
    engineer1: { id: 'eng1', email: 'eng1@test.com', role: 'engineer' },
    lead1: { id: 'lead1', email: 'lead1@test.com', role: 'lead' },
    gip1: { id: 'gip1', email: 'gip1@test.com', role: 'gip' },
  },
  
  tasks: {
    simple: {
      title: 'Simple Task',
      deadline_at: futureDate(7),  // 7 days from now
      assignee_id: 'eng1',
    },
    withDependency: {
      title: 'Task with Dependency',
      deadline_at: futureDate(10),
      assignee_id: 'eng1',
      dependency: { ... }
    }
  },
  
  projects: {
    project1: { id: 'proj1', name: 'Project 1' }
  }
};

// Before each test:
beforeEach(async () => {
  await seedTestData(testData);
});

afterEach(async () => {
  await cleanupTestData();  // truncate tables
});
```

---

## 8. ЧЕКЛИСТ DEPLOYMENT

### Pre-deployment

```
DATABASE:
  ☐ Все миграции успешно запущены
  ☐ Индексы созданы (tasks.status, tasks.deadline_at)
  ☐ RLS policies установлены (engineer, lead, gip)
  ☐ Triggers для history и events работают
  ☐ Backup сделан

BACKEND:
  ☐ Все 7 этапов разработки завершены
  ☐ Unit tests: 80%+ coverage, все зелёные
  ☐ Integration tests: 70%+ coverage, все зелёные
  ☐ E2E tests: все критические flows пройдены
  ☐ Linting: 0 errors, warnings resolved
  ☐ Security: нет SQL injection, XSS, CSRF уязвимостей
  ☐ Rate limiting: настроено (100 req/min на API)
  ☐ Error logging: Sentry / CloudWatch интегрирован
  ☐ Env vars: все установлены (Redis, Supabase keys, JWT secret)

ORCHESTRATOR:
  ☐ Listener loop тестирован (обработка 100+ событий)
  ☐ Graceful shutdown реализован (SIGTERM)
  ☐ Re-delivery mechanism работает (retry на ошибки)
  ☐ Idempotent operations проверены (no duplicate processing)

WEBSOCKET:
  ☐ WebSocket server поднялся без ошибок
  ☐ Heartbeat работает (ping/pong)
  ☐ Room broadcasting протестировано
  ☐ Graceful disconnect обработан
```

### Deployment steps

```
1. STAGE env (тестовое окружение)
  ☐ Deploy backend на Vercel (или Railway)
  ☐ Поднять Redis (Vercel Redis или Redis Cloud)
  ☐ Запустить Orchestrator listener
  ☐ Smoke tests (create task, submit, review, approve)
  
2. CANARY deployment (1% трафика)
  ☐ Роутировать 1% запросов на новый backend
  ☐ Мониторить errors, latency
  ☐ После 1 часа без инцидентов → 10%

3. FULL deployment (100%)
  ☐ Перенести весь трафик на новый backend
  ☐ Мониторить metrics (response time, error rate, p95/p99 latencies)
  ☐ Если проблемы → rollback на старую версию

4. CLEANUP
  ☐ Деактивировать старый backend
  ☐ Удалить temp resources
```

### Post-deployment monitoring

```
KEY METRICS:
  ✓ API response time (target: < 200ms for GET, < 500ms for POST)
  ✓ WebSocket connections (count, memory usage)
  ✓ Event processing latency (target: < 100ms от event до UI update)
  ✓ Error rate (target: < 0.1%)
  ✓ Orchestrator lag (target: < 1s от event эмиссии до обработки)
  
ALERTS:
  🚨 API latency > 1s
  🚨 Error rate > 1%
  🚨 WebSocket connections drop suddenly
  🚨 Event processing lag > 5s
  🚨 Database connection pool exhausted
  
LOGS TO CHECK:
  • /var/log/backend.log (info, warning, error)
  • Supabase logs (RLS violations, slow queries)
  • Redis logs (memory usage, evictions)
  • Sentry (errors + stack traces)
```

---

## РЕЗЮМЕ

| Этап | Время | Deliverables |
|------|-------|--------------|
| 1. DB + Migrations | 3-4ч | Все таблицы, RLS, triggers |
| 2. CRUD Endpoints | 8-10ч | 13 endpoints работают |
| 3. Status + Validation | 6-8ч | State machine + 5 правил |
| 4. Events (Redis) | 4-6ч | 8 событий эмитятся |
| 5. Orchestrator Listener | 10-12ч | Auto-unblock, notifications |
| 6. Notifications | 6-8ч | Telegram + Email + In-app |
| 7. WebSocket | 8-10ч | Real-time updates |
| **TOTAL** | **45-58ч** | **Fully functional backend** |

### Риски + Решения

| Риск | Решение |
|------|---------|
| Race conditions | Optimistic locking (revision) |
| Дублирование событий | Idempotent ops + processed_events |
| Lost events | Transactional outbox pattern |
| Вечная блокировка | Hourly heartbeat check + manual unblock |
| DDoS WebSocket | Batch events + throttle |
| Гонка в счётчиках | UPDATE with expressions (не SELECT+UPDATE) |

### Next Steps

```
1. ✅ Согласовать стек (Fastify / NestJS)
2. ✅ Согласовать Redis provider (Vercel Redis / Redis Cloud)
3. 👉 НАЧАТЬ Step 1 (DB migrations)
4. 👉 Параллельно: Setup CI/CD (GitHub Actions или Vercel)
5. 👉 Параллельно: Setup monitoring (Sentry, CloudWatch)
6. После Step 3: Начать Step 5 (Orchestrator) + Step 6 (Notifications)
7. После Step 7: E2E testing + production deployment
```

---

**Документ готов к разработке.** Следуйте пунктам по порядку, не пропускайте validation на каждом этапе. Успехов! 🚀

**Версия:** 1.0  
**Дата:** 2026-05-05  
**Статус:** ✅ READY FOR DEVELOPMENT
