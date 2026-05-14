# 🤖 СИСТЕМНЫЙ ОРКЕСТРАТОР - СОСТОЯНИЕ

**Последнее обновление:** 14.05.2026 07:20
**Статус:** ⚠️ Нужен аудит и тестирование

---

## 📋 Текущее состояние

### ✅ Реализовано

#### 1. State Machine
- **Файл:** `src/services/state-machine.ts`
- **Статусы задач:**
  - CREATED → IN_PROGRESS → REVIEW_LEAD → REVIEW_GIP → APPROVED
  - CREATED → AWAITING_DATA (при зависимостях)
  - REVIEW_LEAD/REVIEW_GIP → REWORK → REVIEW_LEAD/REVIEW_GIP
  - AWAITING_DATA → IN_PROGRESS (при разрешении зависимости)
- **Валидации:**
  - `validateSubmit()` - проверка перед отправкой на проверку
  - `validateReturn()` - проверка перед возвратом на доработку
  - `validateApprove()` - проверка перед утверждением
  - `isTerminalStatus()` - финальный статус
  - `isBlockingStatus()` - статусы блокировки

#### 2. Event Handlers
**Основные:**
- ✅ `task-created.ts` - создание задачи
- ✅ `task-submitted.ts` - отправка на проверку
- ✅ `task-review-returned.ts` - возврат на доработку
- ✅ `task-approved.ts` - утверждение задачи
- ✅ `deadline-approaching.ts` - приближение дедлайна

**Дополнительные:**
- ✅ `agsk-standard-uploaded.ts` - загрузка ГОСТов
- ✅ `agsk-standard-ready.ts` - ГОСТы готовы
- ✅ `drawing-submitted.ts` - чертеж отправлен
- ✅ `drawing-approved.ts` - чертеж утвержден
- ✅ `meeting-recorded.ts` - встреча записана
- ✅ `calculation-completed.ts` - расчет завершен

#### 3. Основной цикл
- **Файл:** `src/index.ts`
- **Архитектура:** Redis Streams + Event Loop
- **Retry logic:** с максимальным количеством попыток
- **Graceful shutdown:** обработка SIGTERM/SIGINT
- **Logger:** Pino structured logging

#### 4. Уведомления
- **Service:** `src/services/notifications.ts`
- **Каналы:** IN-APP, EMAIL, TELEGRAM
- **Срочность:** info, warning, error, critical

---

### ⚠️ Не реализовано (из документации)

#### Критические:
1. ❌ **Автоматические проверки (heartbeat)**
   - Блокировки > 24h, 48h, 72h не проверяются автоматически
   - Нужно: cron job или scheduled task

2. ❌ **Эскалация по времени проверки**
   - Lead > 24h, 48h не проверяется
   - ГИП > 24h, 48h не проверяется
   - Нужно: cron job для проверки времени в статусе

3. ❌ **Контроль дедлайнов**
   - Дедлайны обновляются только по событию `deadline_approaching`
   - Нет фонового сканирования всех задач

4. ❌ **Зависимости задач (blocking logic)**
   - `task_dependencies` таблица не проверяется
   - Автоматическое разблокирование не работает

5. ❌ **Автоматические действия**
   - `auto-unblock` при утверждении зависимой задачи не реализован
   - Нужно: триггер или handler в `task-approved.ts`

#### Средние:
6. ❌ **Фильтрация уведомлений**
   - Нет правил "важное → Telegram + IN-APP"
   - Нет правил "информационное → IN-APP"

7. ❌ **Шаблоны уведомлений**
   - Уведомления hardcoded в коде
   - Нет извлечения в отдельный config

---

### 🔴 Проблемы в реализации

#### 1. Deadline Handler Не Полный
**Файл:** `handlers/deadline-approaching.ts`

**Проблемы:**
- Обновляет цвет в БД, но не проверяет фоном
- Нет автоматического запуска для всех задач
- Только реакция на событие

**Нужно:**
- Cron job для ежечасного сканирования
- Проверка всех активных задач
- Автоматическая отправка уведомлений

#### 2. Task Approved Handler Неполный
**Проблемы:**
- Нет логики разблокировки зависимых задач
- Нет поиска `task_dependencies`
- Нет создания уведомлений для инженеров разблокированных задач

**Нужно:**
- Добавить логику разблокировки
- Обновить зависимые задачи из `AWAITING_DATA` → `IN_PROGRESS`

#### 3. Отсутствует Heartbeat Checker
**Проблемы:**
- Нет фонового процесса для проверки времени
- Нет cron job или scheduler
- Блокировки и просрочки не обнаруживаются автоматически

**Нужно:**
- Создать `services/scheduler.ts`
- Реализовать cron jobs для разных проверок
- Интегрировать с Redis Streams

#### 4. Нет Автоматической Эскалации
**Проблемы:**
- Лестница эскалации определена в документации, но не в коде
- Нет автоматической отправки уведомлений Lead > 24h, 48h
- Нет alert ГИПу при проблемах

**Нужно:**
- Создать `handlers/escalation-checker.ts`
- Реализовать правила эскалации
- Добавить в cron scheduler

---

## 🎯 Что нужно протестировать

### Приоритет 1: Критический функционал
1. ✅ State Machine переходы
   - Все возможные переходы
   - Валидация на каждом этапе
   - Блокировка неверных переходов

2. ✅ Event Handlers
   - Все 11 типов событий обрабатываются
   - Уведомления отправляются
   - БД обновляется корректно

3. ❌ **Автоматические проверки (НЕ ИСПЫТАНО)**
   - Блокировки > 24h
   - Блокировки > 48h
   - Дедлайны приближаются
   - Дедлайны просрочены

### Приоритет 2: Дедлайны и уведомления
4. ❌ **Контроль дедлайнов (НЕ ИСПЫТАНО)**
   - Обновление цвета задачи
   - Отправка уведомлений инженеру
   - Отправка уведомлений Lead
   - Alert ГИПу о просрочке

5. ❌ **Эскалация (НЕ ИСПЫТАНО)**
   - Lead не проверяет > 24h, 48h
   - ГИП не утверждает > 24h, 48h
   - Инженер не работает > 48h, 72h

### Приоритет 3: Зависимости и блокировки
6. ❌ **Зависимости задач (НЕ ИСПЫТАНО)**
   - Создание зависимостей
   - Автоматическая блокировка
   - Автоматическое разблокирование
   - Уведомления при разблокировке

---

## 📊 Метрики для мониторинга

### Текущие (в документации, но не в коде):
- ❌ Среднее время на проверку Lead
- ❌ Среднее время на утверждение ГИП
- ❌ Количество возвратов на доработку
- ❌ Процент просроченных задач
- ❌ Среднее время разблокировки

### Нужно добавить:
- ✅ Processed events per minute
- ✅ Failed events with retry
- ✅ Average processing time per event
- ✅ Notification delivery rate
- ✅ Deadlines missed rate

---

## 🔧 Улучшения

### Срочные (внедрить сейчас):

1. **Добавить heartbeat checker**
   - Создать `services/scheduler.ts`
   - Реализовать cron jobs
   - Запускать каждый час

2. **Добавить автоматическую разблокировку**
   - В `task-approved.ts` добавить логику
   - Проверять `task_dependencies`
   - Обновлять зависимые задачи

3. **Добавить эскалацию**
   - Создать `handlers/escalation-checker.ts`
   - Проверять время в статусах
   - Отправлять уведомления

### Среднесрочные:

4. **Extract notification templates**
   - Создать `config/notifications.yaml`
   - Вынести все сообщения из кода
   - Поддержка i18n

5. **Добавить метрики**
   - Использовать Prometheus
   - Экспортировать метрики по Orchestrator
   - Дашборды в Grafana

6. **Улучшить logging**
   - Добавить correlation ID
   - Структурировать логи лучше
   - Добавить tracing (OpenTelemetry)

### Долгосрочные:

7. **Event Sourcing**
   - Хранить все события в event store
   - Возможность replay
   - Отладка и аудит

8. **Saga Pattern**
   - Для сложных процессов
   - Дистрибьютированные транзакции
   - Компенсирующие транзакции

---

## 📝 Тестовый план

### Тест 1: State Machine Transitions
```typescript
Тестовые сценарии:
1. CREATED → IN_PROGRESS (start_work) ✅
2. IN_PROGRESS → REVIEW_LEAD (submit_for_review) ✅
3. REVIEW_LEAD → REVIEW_GIP (lead_approves) ✅
4. REVIEW_GIP → APPROVED (gip_approves) ✅
5. REVIEW_LEAD → REWORK (lead_returns) ✅
6. REWORK → REVIEW_LEAD (resubmit) ✅
7. APPROVED → любая (должно быть невозможно) ✅

Ожидаемый результат:
- Все валидные переходы работают
- Неверные переходы блокируются
- Валидации работают корректно
```

### Тест 2: Event Processing
```typescript
Тестовые события:
1. TASK_CREATED → уведомление Lead
2. SUBMITTED_FOR_REVIEW → уведомление Lead
3. TASK_RETURNED_BY_LEAD → уведомление инженеру
4. TASK_APPROVED_BY_GIP → уведомление инженеру + разблокировка

Ожидаемый результат:
- Все события обработаны
- Уведомления отправлены
- БД обновлена корректно
```

### Тест 3: Dependencies (Нужна реализация)
```typescript
Тестовый сценарий:
1. Создать Task A (зависит от Task B)
2. Task A → AWAITING_DATA
3. Task B → APPROVED
4. Task A → IN_PROGRESS (автоматически)

Ожидаемый результат:
- Task A автоматически разблокирована
- Инженер Task A получил уведомление
- Запись в истории Task A
```

### Тест 4: Deadlines (Нужна реализация heartbeat)
```typescript
Тестовый сценарий:
1. Создать задачу с дедлайном через 1 час
2. Запустить heartbeat checker
3. Ждать 2 часа

Ожидаемый результат:
- Через 2 дня: желтое уведомление
- Через 1 день: красное уведомление
- После дедлайна: black + alert ГИПу
```

---

## 🔗 Связанные файлы

### Код:
- `services/orchestrator/src/index.ts` - Main entry point
- `services/orchestrator/src/services/state-machine.ts` - State Machine
- `services/orchestrator/src/handlers/` - Event handlers
- `services/orchestrator/src/services/database.ts` - Database service
- `services/orchestrator/src/services/notifications.ts` - Notification service
- `services/orchestrator/railway.json` - Deployment config

### Документация:
- `core/system-orchestrator.md` - Полная документация (923 строки)
- `services/api-server/src/routes/orchestrator.ts` - API routes

---

## 📝 Записи изменений

### 2026-05-14 07:20
- ✅ Изучен код оркестратора
- ✅ Проверены все event handlers
- ✅ Определены критические проблемы:
  - Нет heartbeat checker
  - Нет автоматической разблокировки зависимостей
  - Нет эскалации по времени
  - Дедлайны проверяются только по событиям
- ✅ Создан план тестирования
- ✅ Предложены улучшения

### Следующие шаги:
1. Создать план проверок в Markdown
2. Добавить улучшения в память
3. Запушить изменения в GitHub
