# API Rollout Guide

Управляемый переход с Vercel на Railway через feature flag с постепенным увеличением процента пользователей.

## 🎯 Цель

**Безопасный переход без downtime**, начиная с 0% (все Vercel) и постепенно увеличивая до 100% (все Railway).

```
0%   → All Vercel (baseline, safe)
 ↓
10%  → 10% Railway (canary, test)
 ↓
50%  → 50% Railway (ramp up)
 ↓
100% → All Railway (complete migration)
```

## 📊 Как это работает

### Stable Hash Distribution

Каждый пользователь стабильно назначается на API на основе своего `userId`:

```
hash(userId) % 100 >= (100 - rolloutPercentage) → Railway
hash(userId) % 100 <  (100 - rolloutPercentage) → Vercel

Пример: rolloutPercentage = 10
- hash(user1) = 95 ≥ 90 → Railway (в топ 10%)
- hash(user2) = 42 <  90 → Vercel (в нижних 90%)
- Каждый раз одно и то же!
```

Это гарантирует:
- ✅ Каждый пользователь всегда использует один API
- ✅ При увеличении % Railway, все Vercel-пользователи переходят в Railway плавно
- ✅ Нет скачков, нет путаницы кеша

### Monitoring & Metrics

Система отслеживает для каждого API:
- Request count
- Error rate
- Average latency
- Last error (message + timestamp)

На основе этого дает рекомендацию:
- ✅ "Safe to increase rollout" — если Railway ошибок ≤ Vercel + 10%, latency ≤ + 20%
- ⚠️ "Reduce rollout" — если Railway хуже на 50%+

## 🚀 Как управлять rollout'ом

### 1. Установить процент через Environment Variable

```bash
# .env.local (development)
REACT_APP_RAILWAY_ROLLOUT_PERCENTAGE=0

# Vercel (production)
# Go to Settings → Environment Variables
# Set: REACT_APP_RAILWAY_ROLLOUT_PERCENTAGE = 0
```

### 2. Установить процент через Vercel Dashboard

```
Project Settings → Environment Variables
REACT_APP_RAILWAY_ROLLOUT_PERCENTAGE = 0

Deploy → Push to main → Vercel rebuilds
```

### 3. Тестировать локально с override

```javascript
// Browser Console
localStorage.setItem('RAILWAY_ROLLOUT_PERCENTAGE', 50)
location.reload()

// Или через query param
// http://localhost:3000?rollout=50
```

### 4. Force конкретного API (для тестирования)

```javascript
// Browser Console — заставить Railway
localStorage.setItem('FORCE_API_PROVIDER', 'railway')
location.reload()

// Или query param
// http://localhost:3000?api=railway

// Отключить override
localStorage.removeItem('FORCE_API_PROVIDER')
```

## 📈 Rollout процесс (Recommended)

### Stage 0: Baseline (0% Railway)

**Duration:** 1-2 дней

```javascript
// .env
REACT_APP_RAILWAY_ROLLOUT_PERCENTAGE=0
```

- Все пользователи → Vercel
- Проверить: все работает нормально
- Мониторить: нет нестабильности

**Checklist:**
- [ ] Frontend работает стабильно
- [ ] Нет новых ошибок
- [ ] Railway API готова и здорова

### Stage 1: Canary (10% Railway)

**Duration:** 2-4 дней

```javascript
// .env
REACT_APP_RAILWAY_ROLLOUT_PERCENTAGE=10
```

- 10% случайных пользователей → Railway
- Мониторить metrics Dashboard
- Alert если Railway error rate > 20%

**Checklist:**
- [ ] Railway получает трафик
- [ ] Error rate ≤ 15%
- [ ] Latency OK (≤ Vercel + 20%)
- [ ] Нет критических ошибок

### Stage 2: Ramp Up (50% Railway)

**Duration:** 3-7 дней

```javascript
// .env
REACT_APP_RAILWAY_ROLLOUT_PERCENTAGE=50
```

- 50% пользователей → Railway
- Мониторить больше use-cases
- Проверить production hotspots

**Checklist:**
- [ ] Metrics stable (no degradation)
- [ ] Error rate still acceptable
- [ ] Database performance OK
- [ ] Redis Streams working
- [ ] Orchestrator processing events

### Stage 3: Complete (100% Railway)

**Duration:** Permanent

```javascript
// .env
REACT_APP_RAILWAY_ROLLOUT_PERCENTAGE=100
```

- Все пользователи → Railway
- Vercel Functions можно отключить (но оставить на месте для fallback)
- Мониторить как обычно

**Checklist:**
- [ ] All metrics green
- [ ] No errors related to migration
- [ ] Database scaling OK
- [ ] Ready to archive Vercel code

## 📊 Мониторинг

### DevTools (Frontend)

```javascript
// Get current selection reason
import { getApiSelectionReason } from './config/api'
getApiSelectionReason() // "rollout: 10% (railway @ hash=95)"

// Get metrics
import { apiMonitor } from './lib/api-monitoring'
apiMonitor.getAllMetrics()
// [{provider: 'vercel', ...}, {provider: 'railway', ...}]

apiMonitor.getComparison()
// {vercel: {...}, railway: {...}, recommendation: "..."}

// Export metrics as JSON
apiMonitor.export()
```

### Backend Logs (Railway)

```bash
# SSH into Railway
railway logs api-server

# Filter by API decision
docker logs -f api-server | grep "API selection"

# Check error rate
docker logs -f api-server | grep "error"
```

### Metrics Dashboard (Recommended)

Создать простой UI для отслеживания:

```typescript
import { getDashboardData } from './lib/api-monitoring'

export function RolloutDashboard() {
  const data = getDashboardData()
  
  return (
    <div>
      <h2>API Rollout Metrics</h2>
      <div>
        <div>Vercel: {data.vercelMetrics.errorRate}% errors, {data.vercelMetrics.avgLatency}ms</div>
        <div>Railway: {data.railwayMetrics.errorRate}% errors, {data.railwayMetrics.avgLatency}ms</div>
      </div>
      <div style={{ color: data.safeToIncreaseRollout ? 'green' : 'red' }}>
        {data.recommendation}
      </div>
    </div>
  )
}
```

## ⚠️ Что может пойти не так

### Railway error rate скачет

**Признак:** Railway ~ 50%+ ошибок, Vercel OK
**Действие:**
1. Reduce rollout to 0%
2. Investigate Railroad logs
3. Fix issue
4. Start from 0% again

### Railway slower than Vercel

**Признак:** Railway latency > Vercel в 2x раза
**Действие:**
1. Check database performance
2. Check Redis connection
3. Profile N+1 queries
4. Optimize hot paths

### Inconsistent behavior between APIs

**Признак:** Same operation gives different results depending on provider
**Действие:**
1. Check Supabase schema differences
2. Check RLS policies
3. Check auth token differences
4. Implement integration tests

### Users seeing errors after promotion

**Признак:** "API 500" errors appearing randomly
**Действие:**
1. Check Railway error logs immediately
2. Check Supabase connection
3. Check Redis availability
4. Consider rollback (set rollout back to 0%)

## 🚨 Emergency Rollback

Если что-то серьёзно пошло не так:

```javascript
// Immediate: Force all users to Vercel
REACT_APP_RAILWAY_ROLLOUT_PERCENTAGE=0
// Vercel redeploy → instant effect

// OR (faster)
// Vercel Dashboard → Environment Variables
// Change: REACT_APP_RAILWAY_ROLLOUT_PERCENTAGE = 0
// Trigger redeploy
```

## 📝 State.md Recording

Обновите STATE.md при каждом изменении rollout:

```markdown
### 2026-05-06 10:30 UTC — ROLLOUT: API migration to Railway started at 0%

**Baseline stage (0% Railway):**
- All users → Vercel API
- Monitoring: metrics baseline established
- Railway ready for canary

**Next step:** Increase to 10% after 2 days of stable baseline
```

## 🎯 Success Criteria

✅ Migration считается успешной, когда:

- 100% users on Railway without issues
- Error rate stable and acceptable (<1%)
- Latency comparable or better than Vercel
- All task workflows working (create → submit → review → approve)
- Orchestrator processing events correctly
- Database scaling handles load
- Monitoring dashboards green

## 📞 Contacts

- Architecture issues: @backend-architect
- Monitoring/metrics: check Railway dashboard
- Emergency: rollback to 0% immediately
