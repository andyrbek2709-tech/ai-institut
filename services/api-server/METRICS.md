# API Metrics System

Система мониторинга метрик для контроля безопасного rollout с Vercel на Railway.

## Архитектура

```
Все API запросы
    ↓ metricsMiddleware (middleware/metrics.ts)
    ↓ Ловит: endpoint, status_code, response_time, user_id
    ↓
Supabase api_metrics таблица
    ↓ INSERT с timestamp
    ↓
api_metrics_summary VIEW (материализованный вид)
    ↓ GROUP BY provider, endpoint
    ↓
GET /metrics/summary, /metrics/:provider, /metrics/recommendation
    ↓
Frontend Dashboard: ApiRolloutDashboard.tsx
```

## Таблица: api_metrics

```sql
api_metrics (
  id BIGSERIAL,
  timestamp TIMESTAMP,
  provider TEXT ('vercel' | 'railway'),
  endpoint TEXT,
  status_code INTEGER,
  response_time INTEGER (milliseconds),
  error TEXT (nullable),
  user_id UUID (nullable)
)
```

**Индексы:**
- `timestamp DESC` (основной — для Realtime запросов)
- `provider` (фильтр по провайдеру)
- `endpoint` (фильтр по эндпоинту)
- `status_code` (фильтр по ошибкам)
- `(provider, timestamp DESC)` (сложный — для быстрого фильтра "Railway за последний час")

## API Endpoints

### GET /metrics/summary
Получить агрегированные метрики для обоих провайдеров.

**Параметры:**
- `hours` (optional, default=1): Временной диапазон в часах

**Ответ:**
```json
{
  "vercel": [
    {
      "provider": "vercel",
      "endpoint": "/api/tasks/:projectId",
      "requests_count": 1234,
      "error_rate": 0.5,
      "avg_latency": 150.25,
      "max_latency": 2100,
      "min_latency": 45,
      "last_error": "timeout",
      "last_request_at": "2026-05-05T19:30:00Z"
    }
  ],
  "railway": [
    {
      "provider": "railway",
      "endpoint": "/api/tasks/:projectId",
      "requests_count": 234,
      "error_rate": 1.2,
      "avg_latency": 200.15,
      "max_latency": 1800,
      "min_latency": 60,
      "last_error": "connection refused",
      "last_request_at": "2026-05-05T19:35:00Z"
    }
  ],
  "aggregated": {
    "total_requests": 1468,
    "error_rate": 0.61,
    "avg_latency": 157.3
  },
  "timestamp": "2026-05-05T19:36:00Z"
}
```

### GET /metrics/:provider
Получить метрики для конкретного провайдера.

**Параметры:**
- `provider` (required): "vercel" или "railway"

**Ответ:**
```json
{
  "provider": "railway",
  "metrics": [
    {
      "provider": "railway",
      "endpoint": "/api/tasks/:projectId",
      "requests_count": 234,
      "error_rate": 1.2,
      ...
    }
  ],
  "timestamp": "2026-05-05T19:36:00Z"
}
```

### GET /metrics/error-rate/:provider
Получить процент ошибок за последние N минут.

**Параметры:**
- `provider` (required): "vercel" или "railway"
- `minutes` (optional, default=5): Временной диапазон в минутах

**Ответ:**
```json
{
  "provider": "railway",
  "error_rate": 1.5,
  "minutes": 5,
  "timestamp": "2026-05-05T19:36:00Z"
}
```

### GET /metrics/recommendation
Получить рекомендацию: безопасно ли увеличивать процент трафика на Railway.

**Ответ:**
```json
{
  "safe": true,
  "reason": "✅ Safe to increase traffic",
  "metrics": {
    "error_rate": 0.8,
    "avg_latency": 195.2,
    "status": "good"
  }
}
```

**Пороги:**
- `error_rate > 1.0%` → `⚠️ Warning`
- `avg_latency > 1000ms` → `⚠️ Warning`
- `error_rate > 5%` OR `avg_latency > 2000ms` → `❌ Critical`

## Использование в Frontend

```typescript
import { getDashboardData, getRolloutRecommendation } from '@/api/metrics';

// Получить метрики для dashboard
const data = await getDashboardData();

// Проверить, безопасно ли увеличивать трафик
const recommendation = await getRolloutRecommendation();

if (recommendation.safe) {
  // Увеличить процент Railroad
} else {
  console.warn(recommendation.reason);
}
```

## Middleware: Автоматическое логирование

В API server используется `metricsMiddleware()` (middleware/metrics.ts):

```typescript
app.use(metricsMiddleware());
```

**Что логируется:**
- Все запросы кроме `/health`, `/ready`, `/metrics`
- `endpoint` (path)
- `status_code` (HTTP code)
- `response_time` (milliseconds)
- `error` (message if status >= 400)
- `user_id` (if authenticated)

**Пример логирования:**
```
POST /api/tasks/abc123
  → 201 Created, 85ms
  → Recorded: provider=railway, endpoint=/api/tasks/:projectId, response_time=85

POST /api/tasks/xyz789 (failed)
  → 500 Internal Server Error, 2500ms
  → Recorded: provider=railway, endpoint=/api/tasks/:projectId, response_time=2500, error='...'
```

## Инструменты для анализа

### Прямые запросы в Supabase

```sql
-- Список ошибок за последний час
SELECT timestamp, endpoint, status_code, error
FROM api_metrics
WHERE status_code >= 400
  AND timestamp > now() - interval '1 hour'
ORDER BY timestamp DESC;

-- Медленные эндпоинты
SELECT endpoint, avg(response_time) as avg_latency
FROM api_metrics
WHERE timestamp > now() - interval '1 hour'
GROUP BY endpoint
HAVING avg(response_time) > 500
ORDER BY avg_latency DESC;

-- Сравнение провайдеров
SELECT provider, count(*) as total, 
       round(100.0 * sum(case when status_code >= 400 then 1 else 0 end) / count(*), 2) as error_rate,
       round(avg(response_time)::numeric, 2) as avg_latency
FROM api_metrics
WHERE timestamp > now() - interval '1 hour'
GROUP BY provider;
```

## Production Deployment

### 1. Применить миграцию

```bash
cd enghub-main
supabase migration up --project-id jbdljdwlfimvmqybzynv
```

### 2. Убедиться, что API server включает metrics

```bash
# api-server/src/index.ts
import { metricsMiddleware } from './middleware/metrics.js';
import metricsRouter from './routes/metrics.js';

app.use(metricsMiddleware()); // добавить до других middleware
app.use('/api', metricsRouter); // добавить в routes
```

### 3. Развернуть на Railway

```bash
cd services/api-server
railway up
```

### 4. Проверить, что метрики пишутся

```bash
# Отправить тестовый запрос
curl https://api-server.railway.app/api/metrics/summary

# Проверить в Supabase
SELECT * FROM api_metrics ORDER BY timestamp DESC LIMIT 10;
```

## Мониторинг в Production

**Когда смотреть метрики:**
1. Перед увеличением процента трафика на Railway
2. При обнаружении проблем в production
3. Для мониторинга здоровья обоих провайдеров

**Автоматический мониторинг в ApiRolloutDashboard:**
- Обновляется каждые 2 секунды
- Показывает рекомендацию: "✅ Safe" vs "⚠️ Reduce"
- Сравнивает Vercel и Railway по ошибкам и задержкам

## Развиток (Future)

- [ ] Alerts на критические метрики (email, Telegram)
- [ ] Retention policy (удалять метрики старше 30 дней)
- [ ] Более детальная аналитика (p95, p99 latency)
- [ ] Per-user tracking для выявления паттернов ошибок
- [ ] WebSocket realtime updates для dashboard
