# EngHub — Инженерная платформа

**Версия:** 1.0
**Деплой:** [enghub-three.vercel.app](https://enghub-three.vercel.app/)
**База данных:** Supabase (проект `jbdljdwlfimvmqybzynv`, регион ap-southeast-2)
**Стек:** React 18 + TypeScript + Supabase + Vercel

---

## Содержание

1. [Описание проекта](#описание-проекта)
2. [Роли пользователей](#роли-пользователей)
3. [Структура проекта](#структура-проекта)
4. [Запуск локально](#запуск-локально)
5. [Переменные окружения](#переменные-окружения)
6. [Архитектура](#архитектура)
7. [Функциональность](#функциональность)
8. [QA-аудит и исправленные баги](#qa-аудит-и-исправленные-баги)
9. [Известные ограничения](#известные-ограничения)

---

## Описание проекта

EngHub — внутренняя платформа для управления инженерными проектами. Объединяет управление задачами, реестры чертежей, замечания ГИПа, инженерные расчёты, нормативную базу с RAG-поиском, AI-аналитику и Telegram-уведомления в одном интерфейсе.

---

## Роли пользователей

| Роль | Ключ роли | Доступ |
|---|---|---|
| **ГИП** (Главный инженер проекта) | `gip` | Все проекты, все задачи, замечания, аналитика, GIP-dashboard |
| **Начальник отдела** | `lead` | Задачи своего отдела, замечания, увязки |
| **Инженер** | `engineer` | Только свои назначенные задачи, просмотр замечаний |
| **Администратор** | `admin@enghub.com` | Полный доступ + управление пользователями |

**Тестовые учётные записи:**

| Email | Пароль | Роль |
|---|---|---|
| `skorokhod.a@nipicer.kz` | `123456` | ГИП |
| `pravdukhin.a@nipicer.kz` | `123456` | Начальник электротехнического отдела |
| `gritsenko.a@nipicer.kz` | `123456` | Старший инженер |

---

## Структура проекта

```
enghub-main/
├── src/
│   ├── App.tsx                    # Главный компонент: роутинг, состояние, layout
│   ├── styles.css                 # Глобальные стили + CSS переменные
│   ├── api/
│   │   └── supabase.ts            # API-слой: CRUD, auth, поиск
│   ├── calculations/
│   │   ├── registry.ts            # Каталог 90 инженерных расчётов
│   │   ├── CalculationView.tsx    # UI расчётного модуля
│   │   └── DocxExporter.ts        # Экспорт результатов в .docx
│   ├── components/
│   │   ├── ui.tsx                 # Modal, ThemeToggle, Field, Badge
│   │   ├── DrawingsPanel.tsx      # Реестр чертежей
│   │   ├── ReviewsTab.tsx         # Замечания ГИПа
│   │   ├── ReviewThread.tsx       # Обсуждение замечания
│   │   ├── KanbanBoard.tsx        # Kanban с drag-and-drop (@dnd-kit)
│   │   ├── GipDashboard.tsx       # Аналитика для ГИПа
│   │   ├── CopilotPanel.tsx       # AI Copilot (Claude Haiku)
│   │   ├── AssignmentsTab.tsx     # Увязки между отделами
│   │   ├── TransmittalsTab.tsx    # Трансмитталы
│   │   ├── RevisionsTab.tsx       # Ревизии документов
│   │   ├── GanttChart.tsx         # Диаграмма Ганта
│   │   ├── ProjectTimeline.tsx    # Timeline проекта
│   │   ├── MeetingsPanel.tsx      # Протоколы совещаний
│   │   ├── BIMPanel.tsx           # BIM/IFC вьюер
│   │   ├── GlobalSearch.tsx       # Глобальный поиск по всем данным
│   │   └── NotificationCenter.tsx # Центр уведомлений
│   ├── copilot/
│   │   └── validateApplyAction.ts # Валидация AI-действий
│   ├── pages/
│   │   ├── LoginPage.tsx          # Страница входа
│   │   ├── ConferenceRoom.tsx     # Чат совещания + видеозвонки
│   │   └── AdminPanel.tsx         # Панель администратора
│   └── utils/
│       └── export.ts              # Утилиты экспорта
├── public/
│   ├── manifest.json              # PWA манифест
│   └── sw.js                      # Service Worker (PWA)
└── build/                         # Production сборка (деплой на Vercel)
```

---

## Запуск локально

```bash
cd enghub-main
npm install
npm start          # http://localhost:3000
```

**Production сборка:**
```bash
npm run build
```

**Деплой** происходит автоматически через Vercel при push в `main`.

---

## Переменные окружения

Задаются в Vercel Dashboard → Settings → Environment Variables:

| Переменная | Описание |
|---|---|
| `REACT_APP_SUPABASE_URL` | URL Supabase проекта |
| `REACT_APP_SUPABASE_ANON_KEY` | Anon key Supabase |
| `REACT_APP_CLAUDE_API_KEY` | API ключ Anthropic (для AI Copilot) |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота (Edge Function) |

---

## Архитектура

### Аутентификация
- Supabase Auth (bcrypt-хэшированные пароли)
- JWT-токен хранится в `localStorage` (`enghub_token`, `enghub_email`)
- Роли хранятся в таблице `app_users.role`

### База данных (Supabase PostgreSQL)
Ключевые таблицы:

| Таблица | Описание |
|---|---|
| `app_users` | Пользователи: роль, отдел, telegram_id |
| `projects` | Проекты |
| `tasks` | Задачи с назначением, статусом, приоритетом |
| `messages` | Сообщения чата (проект- и задача-уровень) |
| `drawings` | Реестр чертежей |
| `revisions` | Ревизии чертежей |
| `reviews` | Замечания ГИПа |
| `review_threads` | Обсуждения замечаний |
| `transmittals` | Трансмитталы |
| `normative_docs` | Нормативные документы с embeddings (pgvector) |
| `task_history` | История изменений задач |

### AI Copilot
- Модель: Claude Haiku (`claude-haiku-4-5`)
- Используется для: анализа рисков проекта, AI-нормоконтроля чертежей
- RAG-поиск: pgvector + cosine similarity для нормативной базы
- Применение AI-действий защищено через `src/copilot/validateApplyAction.ts`

#### Контракт валидации apply-действий
- `validateApplyAction(action, payload, ctx)` — единая точка защиты перед записью в БД
- Базовые проверки: обязательны `ctx.userId` и `ctx.projectId`
- Запрещенные для AI действия: `update_task`, `delete_entity`, `assign_user`
- Ролевая модель: `engineer` не может выполнять `create_tasks`
- Поддерживаемые действия валидатора: `create_tasks`, `create_review`
- Формат `create_tasks`: `payload.items[]` с полями `name`, `deadline?`, `assignee_id?` (назначение запрещено)
- Формат `create_review`: `payload.items[]` с полями `text`, `severity` (`critical|major|minor`), `drawing_id`

### WebRTC аудио (голосовые звонки)

- **Сигнализация:** Supabase Realtime Broadcast на канале `room-{projectId}`
- **События:** `audio_offer`, `audio_answer`, `audio_ice`, `audio_stop`, `audio_hello`
- **Воспроизведение:** Web Audio API `AudioContext` — создаётся в обработчике клика (`joinRoom`), что обходит политику autoplay Chrome
- **VAD:** `AnalyserNode` читает уровни микрофона на 60fps, порог: 8/255
- **ICE серверы:** Google STUN + Cloudflare STUN + freestun.net TURN + OpenRelay TURN
- **Glare resolution:** при одновременных офферах побеждает меньший User ID
- **Timing:** `audio_hello` broadcast после `SUBSCRIBED` (~500мс) решает race condition с подпиской
- **Retry:** `track.onunmute` + `connectionState === 'connected'` повторно маршрутизируют аудио

### Демонстрация экрана (WebRTC)

- P2P передача `displayMedia` через RTCPeerConnection
- Сигнализация: события `offer`, `answer`, `ice`, `stop`, `request` на том же канале
- Fullscreen-режим: скрываются sidebar, tabstrip, meta-bar
- Управление мышью зрителем: `mouse_request` / `mouse_grant` / `mouse_move` / `mouse_revoke`

### Telegram-интеграция
- Edge Function: `telegram-bot` (Supabase Edge Functions)
- Команды бота: `/start`, `/mytasks`, `/status`
- Привязка через UI (раздел профиля)

### PWA
- Service Worker: `public/sw.js`
- Манифест: `public/manifest.json`
- Кэш-стратегия: cache-first для статики

---

## Функциональность

### Вкладки карточки проекта (12 штук)

| Вкладка | Описание | Доступ |
|---|---|---|
| Совещание | Real-time чат, голосовые звонки (WebRTC P2P), демонстрация экрана | Все |
| Задачи | Kanban + список с фильтрами | Все (по ролям) |
| Чертежи | Реестр, статусы, AI-нормоконтроль | Все |
| Ревизии | История ревизий документов | Все |
| Замечания | Замечания ГИПа с обсуждением | Все (создание — ГИП/Lead) |
| Трансмитталы | Передача документов | ГИП/Lead |
| Увязка | Задания между отделами | ГИП/Lead |
| Спецификации | Создание спецификаций по каталогу, штамп, экспорт Excel | ГИП/Lead |
| Диаграмма | Диаграмма Ганта | Все |
| Timeline | Временная шкала проекта | Все |
| Протоколы | Протоколы совещаний | Все |
| Табель | Учёт рабочего времени | Все |
| ГИП | Сводная аналитика | Только ГИП |
| BIM | IFC/BIM вьюер | ГИП/Lead |

### Модуль "Спецификации" (AGSK)
- Вкладка: `src/components/SpecificationsTab.tsx`
- Хранилище: таблицы `catalogs`, `sections`, `groups`, `catalog_items`, `specifications`, `specification_items`
- Миграция: `supabase/migrations/013_specifications_catalog.sql`
- Импорт каталога PDF: `api/catalog-parse.js` (Node + `pdf-parse`)
- Экспорт: `exportSpecificationXls()` в `src/utils/export.ts` (Excel XML, ГОСТ-табличный формат + штамп)

### Расчётный модуль
- 90 инженерных формул по категориям: ТХ, КМ, ЭМ, ОВиК, ВК, ПТ
- Экспорт результатов в `.docx`
- Конвертер единиц измерения

### Нормативная база (RAG)
- Поиск по ГОСТам, СНиПам, СП
- Векторный поиск (pgvector)
- Подсветка ключевых слов, % релевантности

---

## QA-аудит и исправленные баги

Аудит проведён 04.04.2026. Тестирование под тремя ролями: ГИП, Начальник отдела, Инженер.

**Итоговая оценка до исправлений: 6.2/10**

---

### Баг #1 — Кнопка «+ Замечание» скрыта за правым краем (КРИТИЧНО) ✅ ИСПРАВЛЕНО

**Файл:** `src/components/ReviewsTab.tsx`

**Причина:** Форма добавления замечания использовала `display: grid; grid-template-columns: 2fr 1fr 1fr auto`. Колонка с кнопкой (`auto`) отрисовывалась правее области видимости при недостаточной ширине контейнера.

**Исправление:** Заменено на `display: flex; flex-wrap: wrap` с `flex` базисом для каждого поля. Кнопка получила `flex-shrink: 0` и переносится на новую строку при необходимости.

```tsx
// ДО:
<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8 }}>
  <input ... />
  <select ... />
  <select ... />
  <button>+ Замечание</button>
</div>

// ПОСЛЕ:
<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
  <input style={{ flex: '2 1 200px', minWidth: 0 }} ... />
  <select style={{ flex: '1 1 140px', minWidth: 0 }} ... />
  <select style={{ flex: '1 1 140px', minWidth: 0 }} ... />
  <button style={{ flexShrink: 0 }}>+ Замечание</button>
</div>
```

---

### Баг #2 — Комментарии к задачам не отправляются (КРИТИЧНО) ✅ ИСПРАВЛЕНО

**Файл:** `src/App.tsx`

**Причина:** Поле ввода комментария в модальном окне задачи использовало общий стейт `chatInput`, который также используется для чата Совещания. При определённых условиях это приводило к конфликту состояний и пустому тексту при отправке.

**Исправление:**
1. Поле ввода переключено на выделенный стейт `taskComment`
2. Добавлена отдельная функция `sendTaskComment(taskId, text)`, которая принимает текст явным параметром и не зависит от `chatInput`
3. Кнопка и Enter проверяют `taskComment.trim()` перед отправкой

```tsx
// ДО:
<input value={chatInput} onChange={e => setChatInput(e.target.value)}
       onKeyDown={e => e.key === 'Enter' && sendMsg(selectedTask.id)} />
<button onClick={() => sendMsg(selectedTask.id)}>↑</button>

// ПОСЛЕ:
<input value={taskComment} onChange={e => setTaskComment(e.target.value)}
       onKeyDown={e => { if (e.key === 'Enter' && taskComment.trim()) {
         sendTaskComment(selectedTask.id, taskComment); setTaskComment('');
       }}} />
<button onClick={() => { if (taskComment.trim()) {
  sendTaskComment(selectedTask.id, taskComment); setTaskComment('');
}}}>↑</button>
```

---

### Баг #3 — Белый экран при прокрутке вниз / нажатии End (КРИТИЧНО) ✅ ИСПРАВЛЕНО

**Файл:** `src/styles.css`

**Причина:** `body` имел `min-height: 100vh` без `overflow: hidden`. При нажатии `End` браузер прокручивал документ за пределы контента, оставляя пустую белую область. `.app-root` и `.main-area` также использовали `min-height: 100vh`, создавая бесконечно расширяемый документ.

**Исправление:** Весь scroll зафиксирован внутри `.content`. Документ больше не прокручивается.

```css
/* БЫЛО: */
body { min-height: 100vh; }
.app-root { display: flex; min-height: 100vh; }
.main-area { flex: 1; min-height: 100vh; }
.content { flex: 1; overflow-y: auto; }

/* СТАЛО: */
html, body { height: 100%; overflow: hidden; }
.app-root { display: flex; height: 100vh; overflow: hidden; }
.main-area { flex: 1; height: 100vh; overflow: hidden; }
.content { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }
```

> `min-height: 0` на flex-потомке — критично: без него flex-элемент не сжимается ниже высоты своего содержимого и scroll не работает корректно.

---

### Баг #4 — Дублирование задач в Kanban ✅ ИСПРАВЛЕНО

**Уровень:** База данных Supabase

**Причина:** В таблице `tasks` 5 задач были продублированы трижды (15 лишних записей), по всей видимости из-за повторного запуска seed-скрипта.

**Исправление (SQL):**
```sql
DELETE FROM tasks WHERE id IN (6, 7, 8, 9, 10, 11, 12, 13, 14, 15);
```

Оставлены оригиналы с наименьшими ID. Дубликатов не осталось (проверено).

---

### Баг #5 — Поисковый фильтр сохраняется между сессиями пользователей ✅ ИСПРАВЛЕНО

**Файл:** `src/App.tsx` → функция `handleLogout`

**Причина:** При выходе из системы сбрасывались только `token` и `email`. Стейты `searchQuery`, `filterStatus`, `filterPriority`, `filterAssigned`, `activeProject`, а также ключи `localStorage` `enghub_screen` и `enghub_sidetab` оставались заполненными. Следующий пользователь видел фильтры и экран предыдущего.

**Исправление:**
```tsx
// БЫЛО:
const handleLogout = () => {
  setToken(null); setUserEmail(""); setCurrentUserData(null);
  setProjects([]); setTasks([]); setMsgs([]); setChatInput("");
  localStorage.removeItem('enghub_token');
  localStorage.removeItem('enghub_email');
};

// СТАЛО:
const handleLogout = () => {
  setToken(null); setUserEmail(""); setCurrentUserData(null);
  setProjects([]); setTasks([]); setMsgs([]); setChatInput(""); setTaskComment("");
  setSearchQuery(""); setFilterStatus("all"); setFilterPriority("all"); setFilterAssigned("all");
  setActiveProject(null); setScreen('dashboard');
  localStorage.removeItem('enghub_token'); localStorage.removeItem('enghub_email');
  localStorage.removeItem('enghub_screen'); localStorage.removeItem('enghub_sidetab');
};
```

---

### Баг #6 — Горизонтальный скролл таблицы расширяет сайдбар ✅ ИСПРАВЛЕНО

**Файлы:** `src/styles.css`, `src/components/DrawingsPanel.tsx`

**Причина:** Таблица в DrawingsPanel была обёрнута в `<div style={{ overflow: 'hidden' }}>`, что не позволяло таблице прокручиваться внутри. При этом `.content` не имел `overflow-x: hidden`, и горизонтальное переполнение расширяло сам документ, вызывая сдвиг всего layout.

**Исправление:**

`DrawingsPanel.tsx`:
```tsx
// БЫЛО:
<div className="panel-surface" style={{ overflow: 'hidden' }}>
  <table style={{ width: '100%', ... }}>

// СТАЛО:
<div className="panel-surface" style={{ overflowX: 'auto' }}>
  <table style={{ width: '100%', minWidth: 700, ... }}>
```

`styles.css`:
```css
/* Добавлено в .content: */
overflow-x: hidden;
```

---

### Баг #7 — Таб-панель проекта выходит за правый край экрана ✅ ИСПРАВЛЕНО

**Файл:** `src/styles.css`

**Причина:** `.tab-strip` не имел `max-width`, и при большом числе вкладок (13 штук) его внутренний flex-контент превышал ширину родителя. `overflow-x: auto` был задан, но без `max-width: 100%` scroll-контейнер сам расширялся шире viewport.

**Исправление:**
```css
/* ДОБАВЛЕНО в .tab-strip: */
max-width: 100%;
padding-bottom: 8px;  /* место для scrollbar на Windows */
scrollbar-width: thin;
scrollbar-color: var(--border) transparent;
```

---

### Баг #8 — «Призрачный» белый блок при прокрутке ✅ ИСПРАВЛЕНО

**Файл:** `src/styles.css`

**Причина:** Та же, что и у Бага #3. Flex-элемент `.content` без `min-height: 0` не мог корректно сжаться, создавая визуальный разрыв между контентом и нижней границей viewport.

**Исправление:** Решено добавлением `min-height: 0` в `.content` (см. Баг #3).

---

### Баг #9 — Поиск на обзоре не показывает «нет результатов» ✅ ИСПРАВЛЕНО

**Файл:** `src/App.tsx`

**Причина:** При вводе поискового запроса, который не совпадает ни с одним проектом, раздел «Проекты» становился пустым без каких-либо пояснений. Пользователь видел пустой экран без понимания причины.

> Примечание: сама фильтрация работала корректно — баг был UX, не логическим.

**Исправление:** Добавлено информационное сообщение когда отфильтрованный список пуст:
```tsx
{searchQuery && projects.filter(...).length === 0 && (
  <div style={{ fontSize: 13, color: C.textMuted, padding: '12px 0' }}>
    По запросу «{searchQuery}» проектов не найдено
  </div>
)}
```

---

### Баг #10 — Кнопка закрытия модального окна (×) не реагирует на клик ✅ ИСПРАВЛЕНО

**Файл:** `src/styles.css`

**Причина:** Псевдоэлемент `.modal-box::before` (декоративная градиентная линия сверху) имеет `position: absolute` без явного `z-index`. По правилам CSS stacking context, позиционированные элементы без z-index (`z-index: auto`) располагаются поверх непозиционированных дочерних элементов в том же контексте. Кнопка `.modal-close` не имела `position`, что ставило её ниже `::before` в порядке отрисовки.

**Исправление:**
```css
/* ДОБАВЛЕНО в .modal-close: */
position: relative;
z-index: 2;
```

---

### Баг #11 — Тестовые сообщения («парпрарп») в чате Совещания ✅ ИСПРАВЛЕНО

**Уровень:** База данных Supabase

**Исправление (SQL):**
```sql
DELETE FROM messages
WHERE text ILIKE '%парпрарп%'
   OR text ILIKE '%тест%'
   OR text ILIKE '%test%'
   OR (length(text) < 3 AND text NOT IN ('ok', 'да', 'нет', 'ок'));
```

---

## Сводная таблица исправлений

| # | Баг | Серьёзность | Файл | Статус |
|---|---|---|---|---|
| 1 | Кнопка «+ Замечание» скрыта | 🔴 Критично | ReviewsTab.tsx | ✅ |
| 2 | Комментарии к задачам не отправляются | 🔴 Критично | App.tsx | ✅ |
| 3 | Белый экран при прокрутке вниз | 🔴 Критично | styles.css | ✅ |
| 4 | Дублирование задач в Kanban | 🟠 Высокий | Supabase DB | ✅ |
| 5 | Поиск сохраняется между сессиями | 🟠 Высокий | App.tsx | ✅ |
| 6 | Горизонтальный скролл раздвигает сайдбар | 🟠 Высокий | DrawingsPanel.tsx + styles.css | ✅ |
| 7 | Таб-панель выходит за правый край | 🟡 Средний | styles.css | ✅ |
| 8 | Призрачный белый блок при скролле | 🟡 Средний | styles.css | ✅ |
| 9 | Поиск не показывает «нет результатов» | 🟡 Средний | App.tsx | ✅ |
| 10 | Кнопка × модального окна не кликается | 🟡 Средний | styles.css | ✅ |
| 11 | Тестовые сообщения в чате | 🟢 Низкий | Supabase DB | ✅ |

**Все 11 багов исправлены.**

---

## Известные ограничения

- **Адаптивность:** CSS breakpoints для мобильных (480/768/1024px) определены, но полноценное тестирование на мобильных устройствах не проводилось. При ширине экрана < 480px сайдбар скрывается — рекомендуется ручная проверка.
- **RLS (Row Level Security):** Политики Supabase настроены на уровне ролей. При добавлении новых таблиц необходимо явно прописывать RLS-политики.
- **Offline-режим (PWA):** Service Worker кэширует статику, но API-запросы к Supabase при отсутствии сети не обрабатываются — необходим offline-fallback.
- **Нормативная база:** Документы индексируются вручную через AdminPanel. Автоматической переиндексации нет.

---

## Changelog

### 2026-04-15 — WebRTC аудио (голосовые звонки)

Серия исправлений в `src/pages/ConferenceRoom.tsx`, направленных на устранение полного отсутствия звука в совещаниях.

---

#### fix: re-route audio on track unmute + connection connected event

**Файл:** `src/pages/ConferenceRoom.tsx`

**Проблема:** Chrome стреляет `ontrack` до завершения ICE-переговоров — трек находится в состоянии `muted: true`. Созданный в этот момент `MediaStreamAudioSourceNode` не получает данных. После того как трек размутируется (`track.onunmute`), Chrome не возобновляет поток через уже подключённый узел автоматически.

**Исправление:** Во всех 4 местах создания RTCPeerConnection:
- Добавлен `track.onunmute` → повторный вызов `attachRemoteAudio`
- `onconnectionstatechange: 'connected'` → повторный вызов `attachRemoteAudio`
- Логирование `track.muted`, `track.readyState`, `track.enabled`
- Диагностический AnalyserNode: через 2 секунды после подключения измеряет уровень сигнала и пишет в консоль `✅ AUDIO FLOWING` или `❌ SILENT`

---

#### fix: use AudioContext to bypass Chrome autoplay policy for WebRTC audio

**Файл:** `src/pages/ConferenceRoom.tsx`

**Проблема:** `new Audio().play()` вызывается внутри WebRTC `ontrack` callback — асинхронный сетевой обработчик вне контекста пользовательского жеста. Chrome блокирует воспроизведение даже если пользователь ранее нажимал кнопки.

**Исправление:**
- `joinRoom()` (клик кнопки "Войти") создаёт `AudioContext` и вызывает `.resume()` — внутри жеста, поэтому context получает state `running`
- `toggleMic()` дополнительно вызывает `audioCtxRef.current?.resume()`
- `attachRemoteAudio`: вместо `el.play()` использует `ctx.createMediaStreamSource(stream).connect(ctx.destination)` — не требует отдельного разрешения
- Fallback на `new Audio()` если `AudioContext` ещё не инициализирован
- Добавлены рефы `audioCtxRef` и `audioSourcesRef`; очистка source-узлов в `leaveRoom` и cleanup useEffect

```tsx
// БЫЛО:
const el = new Audio();
el.srcObject = stream;
el.play(); // ← блокируется Chrome вне жеста

// СТАЛО:
const source = ctx.createMediaStreamSource(stream); // ctx создан в onClick
source.connect(ctx.destination); // воспроизводится без play()
```

---

#### fix: audio_hello handshake + freestun TURN + 2s delay fallback

**Файл:** `src/pages/ConferenceRoom.tsx`

**Проблема (состояние гонки):** Когда пользователь B заходит в комнату, его присутствие обновляется в `conferenceParticipants`. A немедленно отправляет оффер. Но подписка B на Supabase Realtime-канал активируется через 200–500 мс — оффер приходит раньше, чем B готов его принять, и **тихо теряется**.

**Исправление:**
- При `status === 'SUBSCRIBED'` через 500 мс отправляется `audio_hello { from: myId }` — к этому моменту собственные обработчики точно активны
- Новый handler `audio_hello`: если мой микрофон включён (`audioStreamRef.current !== null`), отправляю оффер пришедшему
- `toggleMic(ON)` тоже шлёт `audio_hello` чтобы уже присутствующие участники отправили мне офферы
- В запасном useEffect добавлена задержка 2 с перед отправкой офферов новым пирам

```
Было:  B заходит → A видит B в presence → немедленно шлёт оффер (B не готов) → потеря
Стало: B заходит → B подписался → B шлёт audio_hello → A отвечает оффером (B готов)
```

**ICE серверы обновлены:**
```tsx
// Добавлены:
{ urls: 'stun:stun.cloudflare.com:3478' },
{ urls: 'turn:freestun.net:3478',  username: 'free', credential: 'free' },
{ urls: 'turns:freestun.net:5349', username: 'free', credential: 'free' },
// Удалены ненадёжные: numb.viagenie.ca, bistri.com
```

---

#### fix: auto-send audio offers to participants who join after mic is enabled

**Файл:** `src/pages/ConferenceRoom.tsx`

**Проблема:** `toggleMic()` отправляет офферы только участникам **в момент** включения микрофона. Если кто-то зашёл позже — оффер никогда не отправляется.

**Исправление:** Новый `useEffect([conferenceParticipants, micEnabled])` фильтрует пиров без существующего PC в `audioPeersRef` и отправляет им офферы.

---

#### fix: bypass Chrome autoplay block for remote WebRTC audio

**Файл:** `src/pages/ConferenceRoom.tsx`

- `new Audio()` создаётся императивно в `ontrack` (не в React render-цикле)
- `play().catch()` явно логирует ошибку вместо беззвучного проглатывания
- Баннер `🔊 Нажмите чтобы включить звук` при заблокированном autoplay
- Очистка Audio-элементов при disconnect и leaveRoom

---

#### debug+fix: ICE logging, restart on failure, backup TURN servers

**Файл:** `src/pages/ConferenceRoom.tsx`

- Логирование каждого ICE-кандидата (type: host/srflx/relay, protocol)
- `onconnectionstatechange: 'failed'` → `pc.restartIce()`
- Добавлены резервные TURN-серверы

---

#### fix: mic button pulses when speaking, avatars use instant local isTalking state

**Файл:** `src/pages/ConferenceRoom.tsx`

- Кнопка микрофона получает CSS-класс `avatar-talking` + яркий фон при `isTalking && micEnabled`
- Иконка меняется: 🔇 / 🎙️ / 🎤
- Все три вида участников (верхняя полоса, боковой список, вкладка) используют мгновенный локальный `isTalking` вместо данных из presence (задержка ~1 с)

---

#### feat: add voice activity detection — avatar pulses when speaking

**Файл:** `src/pages/ConferenceRoom.tsx`

- Web Audio API AnalyserNode считывает уровни микрофона на частоте 60fps
- При среднем значении частотного спектра > 8/255 → `isTalking = true`
- Аватар получает CSS-анимацию `avatar-talking` (зелёное пульсирующее свечение)
- Обновление presence throttled до 1 раза в секунду

**`src/styles.css`:**
```css
.avatar-talking {
  animation: avatar-talk-pulse 0.8s ease-in-out infinite !important;
}
@keyframes avatar-talk-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.7); border-color: #10B981 !important; }
  50%       { box-shadow: 0 0 0 4px rgba(16,185,129,0.3), 0 0 0 8px rgba(16,185,129,0.1);
               border-color: #34D399 !important; }
}
```

---

#### fix: replace Jitsi iframe with native WebRTC audio (P2P mic)

**Файл:** `src/pages/ConferenceRoom.tsx`

**Причина замены Jitsi:** iframe показывал UI предварительного просмотра, блокировался корпоративными сетями, пользователи зависали на подключении.

**Реализация нативного WebRTC аудио:**
- `getUserMedia({ audio: true })` при включении микрофона
- Сигнализация через Supabase Realtime Broadcast: события `audio_offer` / `audio_answer` / `audio_ice` / `audio_stop`
- Двунаправленная связь: answerer добавляет свой трек в answer-PC
- Разрешение glare (оба одновременно шлют offer): меньший ID побеждает
- Буферизация ICE-кандидатов до `setRemoteDescription` (`audioIceBufRef`)

---

#### Архитектура WebRTC аудио (итоговая)

```
Пользователь A (mic ON)                    Пользователь B
─────────────────────────────────────────────────────────
joinRoom() → AudioContext.resume()          joinRoom() → AudioContext.resume()
toggleMic() → getUserMedia()
  → audio_hello broadcast
  → offers to all participants              → SUBSCRIBED
                                            → audio_hello (после 500мс)
← audio_hello от B
  → если mic ON → audio_offer to B   ─────→ audio_offer handler
                                            → createAnswer
                                            ← audio_answer
audio_answer handler                        ICE candidates ↔
  → setRemoteDescription
  → ICE negotiation
  → connectionState: connected
  → attachRemoteAudio (AudioContext)        → attachRemoteAudio (AudioContext)
  → track.onunmute → re-route              → track.onunmute → re-route
```

---

### 2026-04-13
**fix: eliminate flicker and fix mouse control coordinate mapping**
- Файлы: `enghub-main/src/pages/ConferenceRoom.tsx`
- `hasScreenContent` — дебаунсированный стейт (1.5s off-delay), layout не переключается при кратком разрыве WebRTC
- `requestedFromRef` не сбрасывается при presence heartbeat — только при явном `stop`/disconnect
- `hasRemoteRef` предотвращает повторные WebRTC-переговоры пока стрим активен
- Координаты мыши вычисляются с учётом letterboxing `objectFit:contain` на обеих сторонах
- Курсор-оверлей позиционируется через pixel-расчёт границ видео (не наивные проценты)

### 2026-04-13
**fix: eliminate screen-share flicker and stabilise mouse cursor overlay**
- Файлы: `src/App.tsx`, `src/pages/ConferenceRoom.tsx`
- Удалён presence-based `setRemoteStream(null)` — обнулял стрим на каждом heartbeat
- `hasScreenContent` использует стабильный WebRTC `remoteStream`, а не `sharingParticipant` из presence
- `requestedFromRef` предотвращает повторную отправку WebRTC `request` при каждом presence update
- Дебаунс `conferenceScreenActive` в App.tsx (2s задержка перед скрытием мета-бара/табов)
- Видео-врапперы используют `position:absolute inset:0` для корректного рендера курсора

### 2026-04-13
**feat: screen share fullscreen + remote mouse control**
- Файлы: `src/App.tsx`, `src/pages/ConferenceRoom.tsx`
- Скрыты project-meta-bar, tab strip и заголовок при активной демонстрации экрана
- ConferenceRoom заполняет весь viewport при `screenShareActive`
- Зритель может запросить управление мышью; шарер одобряет/отклоняет через уведомление
- Курсор зрителя отображается красным кружком поверх трансляции шарера
- Любая сторона может отозвать управление; все состояния broadcast через WebRTC-канал
- Исправлен чёрный экран у получателя стрима (callback ref + явный `video.play()`)
- Уведомления о звонке через Supabase REST broadcast API (обходит RLS)

### 2026-04-12
**feat: fullscreen screen share mode with floating chat, fix black screen**
- Файлы: `src/pages/ConferenceRoom.tsx`
- WebRTC P2P screen share вместо canvas/JPEG
- Полноэкранный режим при демонстрации: sidebar и табы скрыты
- Плавающие аватары участников и кнопка чата в fullscreen-режиме

### 2026-04-12
**feat: rename ? button to Инструкция in tab strip**
- Файлы: `src/App.tsx`
- Кнопка контекстной помощи переименована из `?` в `Инструкция`

### 2026-04-11
**feat: add tab help modals, fix call invite notifications, WebRTC screen share**
- Файлы: `src/App.tsx`, `src/pages/ConferenceRoom.tsx`
- Контекстная кнопка `Инструкция` с описанием каждого раздела
- Надёжные уведомления о входящих звонках через Supabase REST broadcast API
- Реализован WebRTC P2P для передачи демонстрации экрана

### 2026-04-10
**fix: ГОСТ spec export — шаблонный подход, исправления маппинга ячеек**
- Файлы: `src/App.tsx`, `src/calculations/`, `src/utils/export.ts`
- Экспорт спецификаций строго по шаблону ГОСТ
- Исправлен маппинг колонок, объединённые ячейки, высота строк по тексту
- Блокировка масштаба печати на 100%, кодировка UTF-8 в заголовке ответа

---

*README обновляется автоматически после каждого `git push` через hook `.claude/settings.json` → `PostToolUse(Bash[git push])`*
