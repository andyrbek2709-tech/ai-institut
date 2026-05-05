# 🗂️ ЭКОСИСТЕМА: БЫСТРАЯ СПРАВКА

**Дата:** 2026-05-05 | **Статус:** ✅ PRODUCTION

---

## 🏗️ АРХИТЕКТУРА В ОДНОЙ КАРТИНКЕ

```
┌─────────────────────┐
│  GitHub ai-institut │ ← Единый репозиторий (monorepo)
└──────────┬──────────┘
           │
    ┌──────┴────────┬──────────────┬──────────────┐
    │               │              │              │
┌───▼────┐  ┌──────▼───┐  ┌──────▼──┐  ┌───────▼─────┐
│ EngHub │  │ Ad-Intake│  │ Cable   │  │ Android     │
│        │  │ Bot      │  │ Calc    │  │ VoiceBot    │
└───┬────┘  └──────┬───┘  └────┬────┘  └──────┬──────┘
    │             │            │              │
    │         Railway       In API        CI/CD
    │         (separate)    (EngHub)       GitHub
    │             │            │          Actions
    │        ┌────▼───┐    ┌──┴──┐
    │        │ Railway │    │Vercel│
    │        └────┬───┘    └──┬──┘
    │             │           │
    └─────────┬───┴───────────┴──────────┐
              │                          │
         ┌────▼───────┐          ┌──────▼─────┐
         │ Supabase-1 │          │ Supabase-2 │
         │ (EngHub)   │          │ (AdBot)    │
         │ jbdljdwl...│          │ pbxzxwskh..│
         └────────────┘          └────────────┘
```

---

## 📍 PRODUCTION URLS

| Сервис | URL | Что там |
|--------|-----|---------|
| **EngHub** | `https://enghub-three.vercel.app` | Основная платформа + cable-calc |
| **AdIntakeBot** | `https://ai-institut-production.up.railway.app` | Telegram-бот |
| **Cable Calc** | `/cable-calc.html` (в EngHub) | Расчёты кабелей |
| **GitHub** | `github.com/andyrbek2709-tech/ai-institut` | Исходники |
| **Supabase EngHub** | `jbdljdwlfimvmqybzynv.supabase.co` | БД платформы |
| **Supabase Bot** | `pbxzxwskhuzaojphkeet.supabase.co` | БД бота |

---

## 🔑 КРИТИЧНЫЕ IDENTIFIERS

### GitHub
```
Repo:     andyrbek2709-tech/ai-institut
Branch:   main
Email:    andyrbek2709@gmail.com
```

### Vercel
```
Project ID:    prj_ZDihCpWH1AmIEPRebnOI7ST6d6nv
Team ID:       team_o0boJNeRGftH6Cbi9byd0dbF
Project:       enghub
Root Dir:      enghub-main/
```

### Supabase (EngHub)
```
Project ID:    jbdljdwlfimvmqybzynv
URL:           https://jbdljdwlfimvmqybzynv.supabase.co
Migrations:    supabase/migrations/ (001–023)
Functions:     supabase/functions/ (2 штуки)
```

### Supabase (AdIntakeBot)
```
Project ID:    pbxzxwskhuzaojphkeet
URL:           https://pbxzxwskhuzaojphkeet.supabase.co
Migrations:    ad-intake-bot/supabase/migrations/ (001–007)
Schema file:   ad-intake-bot/supabase/bundle_ad_intake_bot_schema.sql
```

### Railway
```
Project:       kind-comfort
Service:       ai-institut
URL:           https://ai-institut-production.up.railway.app
Health:        /health
```

---

## 🚀 DEPLOY CHECKLIST

### EngHub (Vercel)
- [ ] Изменения в `enghub-main/src/` или `enghub-main/api/`
- [ ] `git commit` + `git push` → `origin/main`
- [ ] Vercel автоматически деплоит
- [ ] Проверить `enghub-three.vercel.app`

### AdIntakeBot (Railway)
- [ ] Изменения в `ad-intake-bot/`
- [ ] `git commit` + `git push` → `origin/main`
- [ ] Railway слушает branch → автодеплой
- [ ] Проверить `ai-institut-production.up.railway.app/health`

### Cable-calc API
- [ ] Изменения в `enghub-main/api/cable-calc/`
- [ ] Идёт с EngHub деплоем (Vercel)
- [ ] maxDuration в `vercel.json` уже установлен (60s)

### Database Migrations
- [ ] **EngHub:** SQL в `supabase/migrations/` → apply вручную в Supabase console
- [ ] **AdBot:** SQL в `ad-intake-bot/supabase/migrations/` → apply на его проекте
- [ ] Миграции **НЕ автоматизированы** — синхронизировать вручную!

---

## 🔐 ENVIRONMENT VARIABLES

### Vercel (EngHub)
```
REACT_APP_SUPABASE_URL
REACT_APP_SUPABASE_ANON_KEY
REACT_APP_SUPABASE_SERVICE_KEY  (deprecated, но может использоваться)
SUPABASE_URL
SUPABASE_SERVICE_KEY
OPENAI_API_KEY                  (для embeddings, vision)
ANTHROPIC_API_KEY               (для AI Copilot)
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
```

### Railway (AdIntakeBot)
```
BOT_TOKEN                       (Telegram)
OPENAI_API_KEY
LLM_API_KEY                     (DeepSeek alternative)
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
SUPABASE_URL                    (pbxzxwskhuzaojphkeet!)
SUPABASE_KEY                    (pbxzxwskhuzaojphkeet!)
WEBHOOK_DOMAIN
MANAGER_CHAT_ID
PORT=3000
```

---

## 🗂️ СТРУКТУРА ДО ДЕРЕВНИ

```
d:\ai-institut/
│
├── .git/                              ← КРИТИЧНО! История
├── .github/workflows/
│   └── build-voice-bot-apk.yml        ← CI для android-voicebot
│
├── enghub-main/                       ← EngHub (фронтенд + API)
│   ├── src/                           ← React 18 + TypeScript
│   ├── api/                           ← 18+ serverless functions
│   │   ├── cable-calc/                ← Python расчётный движок
│   │   │   ├── calc.py
│   │   │   ├── parse.py               ← Vision для PDF
│   │   │   ├── reverse.py
│   │   │   ├── report-xlsx.py
│   │   │   └── parsers/
│   │   ├── orchestrator.js            ← AI Copilot
│   │   ├── telegram.js
│   │   ├── meeting-token.js           ← LiveKit
│   │   ├── spec-export.js
│   │   ├── weekly-digest.js           ← Cron job
│   │   └── ... (15+ files more)
│   ├── public/                        ← Static files
│   │   ├── cable-calc.html
│   │   ├── agenda.html
│   │   ├── raschety-agenda.html
│   │   └── voice-bot.html             ← android-voicebot APK loader
│   ├── vercel.json                    ← Vercel config (maxDuration, crons)
│   └── package.json
│
├── ad-intake-bot/                     ← Telegram-бот для заявок
│   ├── src/
│   │   ├── bot/                       ← Диалоговая логика
│   │   ├── services/
│   │   │   ├── openai.js
│   │   │   ├── supabase.js
│   │   │   ├── whisper.js
│   │   │   └── ...
│   │   ├── utils/
│   │   └── index.js                   ← Entry point
│   ├── supabase/
│   │   ├── migrations/
│   │   │   ├── 001_...
│   │   │   └── 007_knowledge_items.sql
│   │   └── bundle_ad_intake_bot_schema.sql
│   ├── scripts/
│   │   ├── sync-supabase-to-railway.mjs
│   │   ├── dump-last-conversation.mjs
│   │   └── export-conversation-by-lead.mjs
│   ├── railway.json                   ← Railway config
│   ├── .env.example                   ← env template
│   └── package.json
│
├── android-voicebot/                  ← Native Android (TODO: sources)
│   ├── .github/workflows/
│   │   └── build-voice-bot-apk.yml   ← CI (currently no-op)
│   ├── gradle/ gradlew               ← Kotlin build
│   ├── app/                          ← Android sources (TODO!)
│   ├── settings.gradle.kts
│   └── build.gradle.kts
│
├── supabase/                          ← EngHub database
│   ├── migrations/
│   │   ├── 001_rag_setup.sql
│   │   ├── 002_drawings.sql
│   │   └── ... (до 023)
│   └── functions/
│       ├── vectorize-doc/index.ts    ← OpenAI embeddings
│       └── search-normative/index.ts ← pgvector search
│
├── STATE.md                           ← Live journal (ИСТОЧНИК ПРАВДЫ!)
├── CLAUDE.md                          ← Rules (правила проекта)
├── final-readme.md                    ← Актуальная doc
├── AUDIT_ECOSYSTEM_COMPLETE.md        ← Этот аудит (новый)
└── package.json                       ← Root (для monorepo)
```

---

## ⚡ QUICK START

### Locально запустить EngHub
```bash
cd d:\ai-institut\enghub-main
npm install
npm start          # http://localhost:3000
```

### Локально запустить AdIntakeBot
```bash
cd d:\ai-institut\ad-intake-bot
npm install
npm run dev        # localhost:3000 (если WEBHOOK_DOMAIN пусто)
```

### Apply Supabase migration
```bash
# EngHub (вручную в console)
# https://jbdljdwlfimvmqybzynv.supabase.co → SQL Editor
# Вставить файл из supabase/migrations/*.sql → Run

# AdIntakeBot (вручную)
# https://pbxzxwskhuzaojphkeet.supabase.co → SQL Editor
# Вставить файл из ad-intake-bot/supabase/migrations/*.sql → Run
```

### Sync AdBot env to Railway
```bash
cd d:\ai-institut\ad-intake-bot
npm run railway:sync-supabase
```

---

## 🆘 ЕСЛИ ЧТО-ТО СЛОМАЛОСЬ

| Проблема | Решение |
|----------|---------|
| EngHub offline | Проверить Vercel deploy status → redeploy |
| AdBot offline | Проверить Railway health → restart service |
| Cable-calc медленно | Увеличить maxDuration в vercel.json (текущий: 60s) |
| Нет embeddings (RAG) | Проверить OPENAI_API_KEY в Vercel |
| Бот не отвечает | Проверить BOT_TOKEN в Railway + MANAGER_CHAT_ID |
| БД EngHub offline | Проверить Supabase jbdljdwlfimvmqybzynv |
| БД AdBot offline | Проверить Supabase pbxzxwskhuzaojphkeet + Railway env |

---

## 🔄 ОБНОВЛЕНИЯ И ВЕРСИОНИРОВАНИЕ

- **Main branch:** `origin/main` → production
- **Git commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, etc.)
- **Deployments:**
  - EngHub: автоматический при push в `main` (Vercel)
  - AdBot: автоматический при push в `main` (Railway)
  - Migrations: **РУЧНЫЕ** в Supabase console
- **State tracking:** `STATE.md` — синхронизируется с коммитами

---

## 📊 СЕРВИСЫ И ИХ РОЛИ

| Сервис | Роль | Критичность |
|--------|------|-------------|
| GitHub | Исходники + история | 🔴 КРИТИЧНО |
| Vercel | Deploy EngHub + API | 🔴 КРИТИЧНО |
| Supabase (EngHub) | БД + Auth | 🔴 КРИТИЧНО |
| Supabase (AdBot) | БД бота | 🔴 КРИТИЧНО |
| Railway | Deploy AdBot | 🔴 КРИТИЧНО |
| OpenAI | Embeddings, vision, Whisper | 🟡 ВАЖНО |
| Anthropic | AI Copilot | 🟡 ВАЖНО |
| DeepSeek | Fallback LLM для бота | 🟡 ВАЖНО |
| Telegram | Bot API, notifications | 🟡 ВАЖНО |
| LiveKit | Video meetings | 🟡 ВАЖНО |

---

**Последнее обновление:** 2026-05-05
