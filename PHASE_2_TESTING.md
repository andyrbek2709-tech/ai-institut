# Phase 2 Testing Guide

Инструкция для тестирования плавной миграции API с Vercel на Railway.

## 📋 Что нужно протестировать

1. **Proxy слой** — убедиться, что запросы пробрасываются к Supabase через API Server
2. **Tasks CRUD** — создание, обновление, удаление задач через новый API
3. **Event publishing** — автоматическая публикация событий в Redis
4. **Frontend routing** — переключение между Vercel и Railway API

## 🚀 Локальное тестирование

### Шаг 1: Запустить API Server + Redis

```bash
cd services/api-server
npm install
docker-compose up -d
```

Проверить здоровье:
```bash
curl http://localhost:3001/health
# Response: { "status": "ok", "timestamp": "..." }

curl http://localhost:3001/ready
# Response: { "status": "ready", "redis": "ok", ... }
```

### Шаг 2: Тестировать tasks endpoints

#### 2.1 GET /api/tasks/:projectId (список задач)
```bash
# Требует JWT token в Authorization header
# Для тестирования без auth, временно закомментировать проверку в middleware

curl -X GET http://localhost:3001/api/tasks/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 2.2 POST /api/tasks (создание задачи)
```bash
curl -X POST http://localhost:3001/api/tasks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "name": "Test Task",
    "status": "created",
    "assigned_to": 2,
    "dept": "eng",
    "priority": "high"
  }'

# Response: task object + published task.created event to Redis
```

#### 2.3 PATCH /api/tasks/:id (обновление задачи)
```bash
curl -X PATCH http://localhost:3001/api/tasks/123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "review_lead"
  }'

# Response: updated task + published task.status_changed event to Redis
```

### Шаг 3: Тестировать event publishing

Проверить, что события идут в Redis Streams:

```bash
# Войти в Redis контейнер
docker exec -it <redis-container> redis-cli

# Проверить stream
XLEN task-events
# Должно быть > 0 сообщений после создания/обновления задач

# Читать последние события
XRANGE task-events - +
```

### Шаг 4: Тестировать frontend routing

#### 4.1 Включить Railway API в браузере (локальное тестирование)

1. Открить DevTools → Console
2. Выполнить:
```javascript
// Переключиться на Railway API
localStorage.setItem('API_PROVIDER', 'railway');
location.reload();
```

3. Теперь фронтенд будет обращаться к http://localhost:3001

#### 4.2 Протестировать операции через фронтенд

1. Создать задачу в UI → проверить, что она создана через Railway API
2. Обновить статус задачи → проверить, что событие опубликовано в Redis
3. Проверить, что эркестратор обработал событие (смотреть логи api-server)

#### 4.3 Вернуться на Vercel API
```javascript
localStorage.removeItem('API_PROVIDER');
location.reload();
```

## 🧪 Полный сценарий e2e

1. **Запустить локально:** API Server + Redis + Frontend (Vercel)
2. **Переключить на Railway:** через localStorage в браузере
3. **Создать задачу:** через UI
4. **Проверить:**
   - Задача в Supabase (через Vercel как baseline)
   - Событие в Redis (через redis-cli)
   - Оркестратор обработал событие (логи)
5. **Обновить задачу:** изменить статус
6. **Проверить цепочку:** Frontend → Railway API → Supabase + Redis → Orchestrator

## 📊 Метрики успеха

- ✅ GET /api/tasks возвращает список задач
- ✅ POST /api/tasks создает задачу + публикует event в Redis
- ✅ PATCH /api/tasks обновляет задачу + публикует event
- ✅ Frontend переключается между API providers без ошибок
- ✅ Orchestrator получает события и обновляет БД
- ✅ Никаких 401/403 ошибок (authorization works)
- ✅ CORS headers OK (фронтенд может обращаться к api-server)

## 🔧 Troubleshooting

### API Server не запускается
```bash
# Проверить все зависимости
cd services/api-server
npm ci
npm run build

# Проверить порт
lsof -i :3001
```

### Redis не подключается
```bash
# Проверить redis контейнер
docker ps | grep redis
docker logs <redis-container>

# Проверить env vars в api-server
cat .env.test
```

### Frontend видит ошибку "Unauthorized"
- Проверить, что Authorization header передается правильно
- Временно отключить auth middleware для тестирования (см. src/middleware/auth.ts)
- Убедиться, что token в localStorage правильный

### Что-то не работает?
1. Проверить логи:
```bash
docker logs -f <api-server-container>
docker logs -f <redis-container>
```

2. Проверить HTTP requests в DevTools Network tab
3. Проверить что proxy.ts и tasks.ts подключены в index.ts
4. Убедиться что импорты правильные (.js extensions)

## 📝 Что дальше?

После успешного тестирования Phase 2:

1. **Phase 3:** Добавить оставшиеся endpoints (drawings, reviews, revisions, transmittals)
2. **Phase 4:** Развернуть на Railway
3. **Phase 5:** Постепенно переключить фронтенд на Railway (сначала 10%, потом 50%, потом 100%)
4. **Phase 6:** Отключить старые Vercel endpoints

## Контакты

- Architecture: см. `/core/system-orchestrator.md` и `/infra/api-contract.md`
- State: см. `STATE.md` раздел "Последние изменения"
- Questions: обратиться к архитектору backend'а
