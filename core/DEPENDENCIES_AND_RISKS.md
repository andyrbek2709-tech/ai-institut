# 🔗 МАТРИЦА ЗАВИСИМОСТЕЙ И РИСКОВ

**Дата аудита:** 2026-05-05

---

## 1. ЗАВИСИМОСТИ ДЛЯ КАЖДОГО ПРОДУКТА

### 1.1 EngHub

```
EngHub (Frontend + API)
│
├─ GitHub (исходники)
│  └─ РИСК: 🔴 Потеря = потеря всей истории + кода
│
├─ Vercel (deployment)
│  ├─ Project ID: prj_ZDihCpWH1AmIEPRebnOI7ST6d6nv
│  └─ РИСК: 🟡 Удаление проекта = офлайн + потеря истории деплоев
│
├─ Supabase jbdljdwlfimvmqybzynv (PRIMARY DB)
│  ├─ Tables: projects, tasks, drawings, revisions, reviews, transmittals, users, messages, etc.
│  └─ РИСК: 🔴 Потеря = потеря всех данных (7-дневный бэкап)
│
├─ OpenAI API
│  ├─ Сервисы: embeddings (RAG), vision (cable-calc parse), transcribe
│  └─ РИСК: 🟡 Key leak = утечка + затраты
│
├─ Anthropic Claude API
│  ├─ Сервис: AI Copilot orchestrator
│  └─ РИСК: 🟡 Key leak = копилот offline
│
├─ LiveKit Cloud
│  ├─ Сервис: видеоконференции
│  └─ РИСК: 🟡 Credentials leak = перехват видео
│
└─ Telegram (optional notifications)
   └─ РИСК: 🟢 Low (опциональная функция)
```

### 1.2 AdIntakeBot

```
AdIntakeBot (Telegram Bot)
│
├─ GitHub (исходники)
│  └─ РИСК: 🔴 Потеря = потеря кода
│
├─ Railway (deployment)
│  ├─ Project: kind-comfort
│  ├─ Service: ai-institut
│  └─ РИСК: 🟡 Service offline = бот не работает
│
├─ Supabase pbxzxwskhuzaojphkeet (SEPARATE DB!)
│  ├─ Tables: conversations, history, knowledge_items
│  └─ РИСК: 🔴 Потеря = потеря истории заявок (7-дневный бэкап)
│
├─ Telegram Bot API
│  ├─ Token: BOT_TOKEN
│  └─ РИСК: 🔴 Token leak = бот takeover
│
├─ OpenAI API
│  ├─ Models: gpt-4o-mini, text-embedding-3-small, whisper
│  └─ РИСК: 🟡 Key leak = утечка
│
├─ DeepSeek API (fallback)
│  ├─ Model: deepseek-chat
│  └─ РИСК: 🟢 Fallback (не критично если OpenAI работает)
│
└─ CRM Webhooks (optional)
   ├─ n8n, Bitrix24, amoCRM
   └─ РИСК: 🟢 Low (опциональная интеграция)
```

### 1.3 cable-calc

```
cable-calc (Engineering Calculations)
│
├─ Python (runtime) 
│  └─ РИСК: 🟢 Standard (в Vercel)
│
├─ Vercel functions (API hosting)
│  └─ РИСК: 🟡 calc.py / parse.py timeout (уже: 60s maxDuration)
│
├─ OpenAI Vision API (PDF parsing)
│  ├─ Used in: parse.py
│  └─ РИСК: 🟡 Vision token usage (дорого на больших батчах)
│
└─ Python libraries
   ├─ pdfplumber, openpyxl, python-docx, tesseract-ocr
   └─ РИСК: 🟢 Standard (в requirements.txt)
```

### 1.4 android-voicebot

```
android-voicebot (Android APK)
│
├─ GitHub (исходники)
│  └─ РИСК: 🔴 Потеря = потеря кода (но CI workflow готов)
│
├─ GitHub Actions (CI/CD)
│  └─ РИСК: 🟢 GitHub Actions бесплатен
│
├─ Telegram TDLib (native client)
│  └─ РИСК: 🟢 Open-source, self-contained
│
└─ Kotlin (runtime)
   └─ РИСК: 🟢 Standard (в Gradle)
```

---

## 2. ПОРЯДОК КРИТИЧНОСТИ

### Уровень 1: КРИТИЧНО (без этого система мертва)

| Зависимость | Для кого | Если потеря | Восстановление |
|-------------|----------|-------------|-----------------|
| GitHub repo | EngHub, AdBot, cable-calc | Потеря кода + истории | ❌ НЕВОЗМОЖНО (нужен бэкап) |
| Supabase jbdljdwlfimvmqybzynv | EngHub | Потеря всех данных платформы | ✅ Бэкап (7 дней) |
| Supabase pbxzxwskhuzaojphkeet | AdBot | Потеря всех данных бота | ✅ Бэкап (7 дней) |
| Vercel project | EngHub API + FE | Офлайн + потеря истории | ✅ Переделать, deploy заново |
| Railway service | AdBot | Офлайн | ✅ Перезапустить / переделать |

### Уровень 2: ВАЖНО (влияет на функциональность)

| Зависимость | Для кого | Если потеря | Fallback |
|-------------|----------|-------------|----------|
| OpenAI API | EngHub (RAG), AdBot (LLM) | RAG offline, бот медленнее | ⚠️ DeepSeek (для бота) |
| Anthropic API | EngHub | AI Copilot offline | ❌ Нет fallback |
| LiveKit | EngHub | Video meetings offline | ❌ Нет fallback |
| Telegram Bot API | AdBot | Бот offline | ❌ Нет fallback |

### Уровень 3: ВСПОМОГАТЕЛЬНО (приятно иметь, но можно работать без)

| Зависимость | Для кого | Если потеря |
|-------------|----------|-------------|
| Telegram notifications | EngHub | Уведомления offline (UI работает) |
| CRM webhooks | AdBot | CRM sync offline (бот работает) |
| android-voicebot | Voice feature | Voice feature offline (текстовые заявки работают) |

---

## 3. МАТРИЦА РИСКОВ

### 3.1 Вероятность × Влияние

```
ВЛИЯНИЕ
   │
4  │ [4,1]          [4,2]           [4,3]          [4,4]
   │ Repo delete    API key leak    LiveKit down   CRÍTICO
   │
3  │ [3,1]          [3,2]           [3,3]          [3,4]
   │ Rail offline   Parse timeout   Version issue  MAJOR
   │
2  │ [2,1]          [2,2]           [2,3]          [2,4]
   │ Spam          Slow API        Cache issue   MEDIUM
   │
1  │ [1,1]          [1,2]           [1,3]          [1,4]
   │ UI glitch     Network lag      Minor bug     MINOR
   │
   └─────────────────────────────────────────────────► ВЕРОЯТНОСТЬ
     RARE      UNLIKELY      POSSIBLE       LIKELY
     (1)         (2)           (3)           (4)
```

**Текущие риски на матрице:**

| Риск | Вероятность | Влияние | Уровень | Mitigation |
|------|------------|--------|---------|-----------|
| Repo deleted | RARE (1) | CRITICAL (4) | **CRITICAL** | GitHub backup в облако |
| DB corrupted | UNLIKELY (2) | CRITICAL (4) | **CRITICAL** | 7-день backup + automated daily dump |
| API key leaked | POSSIBLE (3) | MAJOR (3) | **MAJOR** | Rotate keys every 90 days |
| Vercel down | RARE (1) | MAJOR (3) | **MAJOR** | Нет mitigation (SaaS) |
| Railway down | RARE (1) | MAJOR (3) | **MAJOR** | Нет mitigation (SaaS) |
| LiveKit fail | UNLIKELY (2) | MEDIUM (2) | **MEDIUM** | Feature disabled, UI works |
| Parse timeout | POSSIBLE (3) | MEDIUM (2) | **MEDIUM** | Увеличить maxDuration |
| Token exhaustion | POSSIBLE (3) | MEDIUM (2) | **MEDIUM** | Monitor usage, set quota |

---

## 4. КАСКАДНЫЕ ОТКАЗЫ

### Сценарий А: GitHub репо удалён

```
GitHub repo deleted
    ↓
NO исходники
    ├─ Нельзя редактировать EngHub
    ├─ Нельзя редактировать AdBot
    ├─ Нельзя редактировать cable-calc
    ├─ Нельзя знать миграции Supabase
    └─ Потеря истории (commits, branches)

ПОТЕРЯ: 💯 ПОЛНАЯ (невозможно восстановить)
RECOVERY TIME: ❌ INFINITY (нужен бэкап из другого места)
```

### Сценарий Б: Supabase EngHub потеряна

```
Supabase jbdljdwlfimvmqybzynv deleted
    ↓
EngHub DATABASE GONE
    ├─ Потеря projects, tasks, drawings
    ├─ Потеря users + auth
    ├─ Потеря messages, meetings
    ├─ Потеря RAG normative docs
    └─ UI работает, но БЕЗ ДАННЫХ

ПОТЕРЯ: projects, tasks, specifications, history (~100k+ rows)
RECOVERY TIME: 7 дней (max from backup)
WORKAROUND: ❌ НЕЛЬЗЯ
```

### Сценарий В: API ключ OpenAI скомпрометирован

```
OPENAI_API_KEY в публичном логе
    ↓
УТЕЧКА
    ├─ Злоумышленник делает запросы
    ├─ Кончаются кредиты быстро
    ├─ RAG перестаёт работать (нельзя get embeddings)
    └─ cable-calc parse медленнее (vision отключена)

ПОТЕРЯ: деньги + функциональность RAG
RECOVERY TIME: 30 минут (переделать ключ в Vercel)
WORKAROUND: ✅ Отключить embedding-dependent features
```

### Сценарий Г: Railway service AdBot упал

```
Railway ai-institut service stopped/crashed
    ↓
BOT OFFLINE
    ├─ Клиенты не могут отправлять заявки (webhook не получает)
    ├─ Менеджер не получает уведомления
    └─ БД AdBot в порядке, но недостижима через API

ПОТЕРЯ: лиды
RECOVERY TIME: 2 минуты (restart в Railway)
WORKAROUND: ✅ Можно вручную проверить БД и достать заявки
```

### Сценарий Д: Vercel project удалён

```
Vercel prj_ZDihCpWH1AmIEPRebnOI deleted
    ↓
ENGHUB OFFLINE + NO CABLE-CALC
    ├─ Website недостижима
    ├─ API endpoints не работают
    ├─ History деплоев потеряна
    └─ Исходники в GitHub целые

ПОТЕРЯ: deployment конфиг, история
RECOVERY TIME: 1-2 часа (пересоздать проект, переподключить)
WORKAROUND: ❌ НЕЛЬЗЯ работать без deployment
```

---

## 5. ПЛАН МИГРАЦИИ (Disaster Recovery)

### Если потеря GitHub

**Если есть локальный клон:**
```bash
cd /tmp/ai-institut
git remote add backup https://github.com/andyrbek2709-tech/ai-institut-backup.git
git push --all backup
```

**Лучше всего:**
- ✅ GitHub → GitLab mirror (бесплатный, приватный)
- ✅ GitHub → Gitea self-hosted (свой сервер)
- ✅ GitHub → Cloudflare R2 backup (ежедневно)

### Если потеря Supabase БД

**Восстановление из backup (7 дней):**
```bash
1. Supabase Dashboard → Backups
2. Выбрать дату
3. Restore → новый проект
4. Обновить env vars в Vercel/Railway
```

**Лучше всего:**
- ✅ Automatic daily SQL dump в S3/GCS
- ✅ Hourly backups (не только 7 дней)
- ✅ Point-in-time recovery (PITR)

### Если потеря Vercel проекта

**Восстановление:**
```bash
1. Создать новый Vercel проект
2. Подключить GitHub repo
3. Скопировать env vars из старого проекта
4. Re-deploy
```

### Если потеря Railway сервиса

**Восстановление:**
```bash
1. Railway Dashboard → Restart service
   ИЛИ
2. Создать новый service из GitHub repo
3. Скопировать env vars
4. Deploy
```

---

## 6. РЕКОМЕНДУЕМЫЕ ACTIONS

### Критичные (СДЕЛАТЬ СЕЙЧАС)

- [ ] **GitHub backup:** Создать GitLab mirror или Gitea backup
- [ ] **SQL backup automation:** Ежедневный dump Supabase в S3
- [ ] **API keys audit:** Проверить где логируются (исключить!)
- [ ] **Supabase PITR:** Включить если доступна (Enterprise plan)

### Важные (СДЕЛАТЬ НА ЭТОЙ НЕДЕЛЕ)

- [ ] **Secrets rotation policy:** Ключи каждые 90 дней
- [ ] **Disaster recovery plan:** Документировать процедуры
- [ ] **Monitoring setup:** Sentry + Datadog для ошибок
- [ ] **Health checks:** Мониторить все endpoints

### Желательные (СДЕЛАТЬ КОГДА-НИБУДЬ)

- [ ] **Load balancing:** Vercel Pro / Enterprise для better uptime
- [ ] **Database replicas:** Supabase read replicas для analytics
- [ ] **CDN optimization:** Cloudflare для ускорения
- [ ] **API rate limiting:** Защита от DDoS
- [ ] **Android-voicebot:** Закоммитить Kotlin исходники

---

## 7. СВОДНАЯ ТАБЛИЦА РИСКОВ

| Система | Критичность | Риск | Восстановление | Действие |
|---------|-----------|------|-----------------|----------|
| **GitHub** | 🔴 CRÍTICO | Потеря кода | GitLab mirror | В РАБОТЕ |
| **Vercel** | 🔴 CRÍTICO | Удаление | Переделать | Мониторить |
| **Supabase (EngHub)** | 🔴 CRÍTICO | Corruption | 7-day backup | SQL dump automation |
| **Supabase (AdBot)** | 🔴 CRÍTICO | Corruption | 7-day backup | SQL dump automation |
| **Railway** | 🟡 MAJOR | Offline | Restart (2 min) | Health check |
| **OpenAI** | 🟡 MAJOR | Key leak | Rotate (30 min) | Key rotation policy |
| **Anthropic** | 🟡 MAJOR | Key leak | Rotate (30 min) | Key rotation policy |
| **LiveKit** | 🟡 MAJOR | Down | No fallback | Feature flag |
| **Telegram** | 🟡 MAJOR | Down | No fallback | Feature flag |
| **DeepSeek** | 🟢 MEDIUM | Down | OpenAI fallback | Auto-fallback code |

---

**Дата аудита:** 2026-05-05  
**Статус:** ✅ ЗАВЕРШЕНО
