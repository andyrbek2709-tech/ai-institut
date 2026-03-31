# EngHub — Инженерная платформа (v6.0)

Веб-платформа для управления инженерными проектами проектного института. Вдохновлено дизайном Figma, Bitrix24 и Microsoft Teams.

---

## 🚀 Возможности

- **4 роли пользователей**: Администратор → ГИП → Руководитель отдела → Инженер
- **Управление проектами**: создание, архивирование, автоматический прогресс (% выполнения)
- **Система ревизий**: клонирование задач R0 → R1 → R2 с историей замечаний
- **Канбан-доска задач**: 6 статусов с полным жизненным циклом
- **Задания смежникам**: матрица увязки с Accept/Reject и Inbox для нач. отделов
- **Модуль расчётов**: 90+ инженерных шаблонов с LaTeX и экспортом в DOCX
- **Нормативка (RAG)**: загрузка PDF/DOCX, автоматическая векторизация, AI-поиск
- **AI Copilot**: чат-бот с режимом поиска по базе знаний (RAG) и созданием задач
- **Конференц-зал**: чат внутри проекта
- **Тёмная/светлая тема**: адаптивный интерфейс с CSS-переменными

---

## 🏗️ Технологии

| Компонент | Технология |
|-----------|-----------|
| Фронтенд | React 18 + TypeScript |
| Хостинг | Vercel |
| БД / Auth | Supabase (PostgreSQL + pgvector) |
| Стили | Vanilla CSS (Figma Tokens) |
| AI поиск | OpenAI Embeddings + Claude (Anthropic) |
| Векторизация | Supabase Edge Functions |

---

## 📁 Структура проекта

```
/
├── vercel.json                    # Конфигурация деплоя Vercel
├── package.json                   # Корневой package.json (делегирует в enghub-main)
├── supabase/
│   ├── functions/
│   │   └── vectorize-doc/
│   │       └── index.ts           # Edge Function: PDF → эмбеддинги → pgvector
│   └── migrations/
│       └── 001_rag_setup.sql      # SQL: pgvector, normative_chunks, search_normative()
└── enghub-main/
    ├── api/
    │   └── orchestrator.js        # Vercel serverless: Task Manager + RAG поиск
    ├── src/
    │   ├── api/
    │   │   └── supabase.ts        # API-хелперы (ключи из env vars)
    │   ├── components/
    │   │   ├── ui.tsx             # Базовые UI-компоненты
    │   │   ├── Notifications.tsx  # Toast уведомления
    │   │   └── CopilotPanel.tsx   # AI Copilot интерфейс
    │   ├── pages/
    │   │   ├── LoginPage.tsx
    │   │   ├── AdminPanel.tsx
    │   │   └── ConferenceRoom.tsx
    │   ├── calculations/          # Движок расчётов (90+ шаблонов)
    │   ├── App.tsx                # Основной интерфейс
    │   ├── constants.ts
    │   └── styles.css
    └── .env.local                 # Локальные ключи (НЕ в git)
```

---

## 🔄 Жизненный цикл задачи

```
todo → inprogress → review_lead → review_gip → done
                                ↘ revision → inprogress
```

---

## 🔐 Переменные окружения

Создай файл `enghub-main/.env.local` для локальной разработки:

```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
REACT_APP_SUPABASE_SERVICE_KEY=your-service-key
```

В **Vercel Dashboard → Settings → Environment Variables** добавь:

| Переменная | Описание |
|-----------|---------|
| `REACT_APP_SUPABASE_URL` | URL Supabase проекта |
| `REACT_APP_SUPABASE_ANON_KEY` | Публичный anon ключ |
| `REACT_APP_SUPABASE_SERVICE_KEY` | Service role ключ (только сервер) |
| `SUPABASE_URL` | URL для Edge Functions |
| `SUPABASE_SERVICE_KEY` | Service role для Edge Functions |
| `OPENAI_API_KEY` | Для эмбеддингов (text-embedding-3-small) |
| `ANTHROPIC_API_KEY` | Для RAG-ответов (Claude Haiku) |

> ⚠️ **Никогда не коммить `.env.local` в git!**

---

## 🧠 RAG — Нормативная база знаний

### Архитектура

```
Пользователь загружает PDF
       ↓
App.tsx вызывает Supabase Edge Function (vectorize-doc)
       ↓
Edge Function: PDF → текст → чанки → OpenAI Embeddings → pgvector
       ↓
Пользователь задаёт вопрос в Copilot с включённым "База знаний"
       ↓
orchestrator.js: вопрос → OpenAI Embedding → search_normative() → Claude → ответ
```

### Настройка базы данных (один раз)

Выполни SQL из `supabase/migrations/001_rag_setup.sql` в **Supabase Dashboard → SQL Editor**.

### Деплой Edge Function

```bash
# Установить Supabase CLI
npm install -g supabase

# Залогиниться
supabase login

# Задеплоить функцию
supabase functions deploy vectorize-doc --project-ref jbdljdwlfimvmqybzynv

# Добавить секреты
supabase secrets set OPENAI_API_KEY=your-key --project-ref jbdljdwlfimvmqybzynv
supabase secrets set SUPABASE_SERVICE_KEY=your-key --project-ref jbdljdwlfimvmqybzynv
```

---

## 🔧 Локальный запуск

```bash
cd enghub-main
npm install
npm start
```

## 🚀 Деплой на Vercel

```bash
git push origin main
# Vercel автоматически соберёт через vercel.json
```

**Конфигурация Vercel (`vercel.json`):**
- Сборка из `enghub-main/` через `@vercel/static-build`
- API функция `enghub-main/api/orchestrator.js` → маршрут `/api/orchestrator`

---

## 📝 История изменений

### v6.3 — Умный конвертер единиц для расчётов
- ✅ Конвертер автоматически определяет нужные единицы по входным данным расчёта
- ✅ 12 типов конвертеров: длина, давление, температура, мощность, масса, расход, скорость, плотность, сила, сечение, ток, напряжение
- ✅ Карточки конвертеров — каждый с собственным вводом значения

### v6.2 — Каталог расчётов: полный список + поиск
- ✅ Сайдбар теперь берёт все 90+ расчётов из реестра (было 6)
- ✅ Поиск по названию, дисциплине и описанию расчёта
- ✅ Счётчик расчётов в каждой категории (бейдж)

### v6.1 — Семантический поиск в Нормативке
- ✅ Поиск по смыслу через `orchestrator.js` (action: search_normative) — без нового деплоя Edge Functions
- ✅ Query → OpenAI embedding → `search_normative()` RPC (pgvector cosine similarity)
- ✅ Результаты с процентом релевантности (цветной бейдж: зелёный ≥80%, жёлтый ≥60%)

### v6.0 — RAG + Безопасность + Фикс деплоя
- ✅ **Vercel build fix**: Добавлен `vercel.json` с явным `rootDirectory` через `@vercel/static-build`
- ✅ **Безопасность**: API ключи вынесены в `process.env` (`.env.local` + Vercel env vars)
- ✅ **RAG backend**: Supabase Edge Function `vectorize-doc` — PDF → pgvector
- ✅ **SQL миграция**: `normative_chunks` + `search_normative()` функция
- ✅ **Orchestrator RAG**: поиск через OpenAI Embeddings + ответ через Claude Haiku
- ✅ **`.gitignore`**: добавлены `.env`, `.env.local`, `build/`

### v5.1 — Фикс переходов и высоты
- ✅ Reset sideTab при входе в проект
- ✅ Conference room fix: высота контейнера 600px

### v5.0 — Глобальный редизайн (Figma Make)
- ✅ Sidebar, Topbar, Breadcrumbs, pill-style табы
- ✅ Задачи с цветными бордерами по приоритету

### v4.0 — Конференц-зал и чат
- ✅ ConferenceRoom компонент
- ✅ История сообщений через Supabase `messages`

---

## 🌐 Ссылки

- **Live**: [https://enghub.vercel.app](https://enghub.vercel.app)
- **GitHub**: [andyrbek2709-tech/enghub](https://github.com/andyrbek2709-tech/enghub)
