# Metrics System Deployment Checklist

## Система метрик для контроля Vercel → Railway rollout

### Что было создано (2026-05-06)

- ✅ Таблица `api_metrics` в Supabase (миграция 024)
- ✅ Middleware для автоматического логирования всех запросов
- ✅ Backend API endpoints для получения метрик
- ✅ Frontend API для интеграции в dashboard
- ✅ Документация (METRICS.md)

---

## 📋 Deployment Steps

### Шаг 1: Применить миграцию БД

```bash
cd enghub-main
supabase migration up --project-id jbdljdwlfimvmqybzynv
```

**Проверка:** 
```sql
SELECT tablename FROM pg_tables WHERE tablename = 'api_metrics';
-- Должна вернуть: api_metrics
```

### Шаг 2: Обновить API Server на Railway

```bash
cd services/api-server
npm install
npm run build
```

**Убедиться, что файлы присутствуют:**
- ✅ `src/middleware/metrics.ts` — middleware
- ✅ `src/services/metrics.ts` — сервис
- ✅ `src/routes/metrics.ts` — endpoints
- ✅ `src/index.ts` — подключены middleware и routes

**Развернуть:**
```bash
railway up
```

### Шаг 3: Проверить, что метрики пишутся

```bash
# Отправить тестовый запрос к API
curl https://api-server.railway.app/api/metrics/summary

# Проверить в Supabase (можно через Dashboard)
SELECT COUNT(*) as metric_count FROM api_metrics;

# Если > 0 — всё работает ✅
```

### Шаг 4: Интегрировать в AdminDashboard (опционально)

В существующий компонент `ApiRolloutDashboard.tsx` уже можно подключить новые метрики:

```typescript
import { getDashboardData, getRolloutRecommendation } from '@/api/metrics';

// Получить данные
const data = await getDashboardData();
const recommendation = await getRolloutRecommendation();

// Использовать в UI
console.log(data.aggregated.error_rate); // % ошибок
console.log(recommendation.safe); // Безопасно ли увеличивать?
```

---

## 🔍 Monitoring in Production

### Когда проверять метрики

1. **Перед увеличением % Railway traffic** — убедиться что `recommendation.safe === true`
2. **При обнаружении ошибок** — смотреть `error_rate` и `last_error`
3. **Регулярно** — следить за `avg_latency` Railway vs Vercel

### Быстрые SQL запросы для анализа

```sql
-- Текущий статус обоих провайдеров
SELECT provider, COUNT(*) as requests, 
       ROUND(100.0 * SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) / COUNT(*), 2) as error_rate,
       ROUND(AVG(response_time)::numeric, 2) as avg_latency
FROM api_metrics
WHERE timestamp > now() - interval '30 minutes'
GROUP BY provider;

-- Ошибки за последний час
SELECT timestamp, endpoint, status_code, error
FROM api_metrics
WHERE status_code >= 400
  AND timestamp > now() - interval '1 hour'
ORDER BY timestamp DESC;

-- Самые медленные эндпоинты
SELECT endpoint, ROUND(AVG(response_time)::numeric, 2) as avg_latency
FROM api_metrics
WHERE timestamp > now() - interval '1 hour'
GROUP BY endpoint
ORDER BY avg_latency DESC
LIMIT 10;
```

---

## ⚡ API Endpoints Reference

### GET /metrics/summary
```json
{
  "vercel": [ /* metrics */ ],
  "railway": [ /* metrics */ ],
  "aggregated": {
    "total_requests": 1000,
    "error_rate": 0.5,
    "avg_latency": 150.25
  },
  "timestamp": "2026-05-06T12:00:00Z"
}
```

### GET /metrics/recommendation
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

**Пороги для "Safe to increase":**
- Error rate < 1%
- Avg latency < 1000ms

---

## 🛠 Troubleshooting

### Проблема: Метрики не пишутся в БД

**Решение:**
1. Проверить, что миграция была применена
2. Проверить в Railway логи: `railway logs`
3. Убедиться что SUPABASE_SERVICE_KEY установлена в Railway env

### Проблема: Медленное писание метрик

**Решение:**
- Это нормально — метрики пишутся асинхронно в фоне
- Не блокируют основной запрос
- На high-load проекте может быть очередь

### Проблема: Старые метрики занимают много места

**Решение (Future):**
- Добавить retention policy (удалять метрики старше 30 дней)
- Или архивировать в отдельную таблицу

---

## 📊 Metrics Dashboard Usage

**Интеграция в `ApiRolloutDashboard.tsx`:**

```typescript
// Получить метрики
const data = await getDashboardData();
const recommendation = await getRolloutRecommendation();

// Сравнить Vercel vs Railway
const vercelErrorRate = data.vercel[0]?.error_rate || 0;
const railwayErrorRate = data.railway[0]?.error_rate || 0;

// Принять решение
if (recommendation.safe) {
  // Можно увеличивать процент Railway
  await setRolloutPercentage(railwayPercentage + 10);
} else {
  // Нужно устранять проблемы
  console.warn(recommendation.reason);
}
```

---

## ✅ Checklist для go-live

- [ ] Миграция БД применена в Supabase
- [ ] API Server обновлен на Railway
- [ ] Тестовый запрос к /metrics/summary работает
- [ ] Метрики видны в Supabase dashboard
- [ ] Dashboard интегрирован или готов к интеграции
- [ ] Документация прочитана (services/api-server/METRICS.md)
- [ ] Пороги ошибок и latency подходят под требования

---

## 📚 More Info

- **Полная документация:** `services/api-server/METRICS.md`
- **Код сервиса:** `services/api-server/src/services/metrics.ts`
- **Middleware:** `services/api-server/src/middleware/metrics.ts`
- **API endpoints:** `services/api-server/src/routes/metrics.ts`
- **Frontend API:** `enghub-main/src/api/metrics.ts`
