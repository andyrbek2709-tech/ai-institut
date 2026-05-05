# 🔗 SYSTEM CONNECTIONS — EngHub Ecosystem Data Flow

**Дата:** 2026-05-05 | **Статус:** ✅ PRODUCTION

---

## 📌 OVERVIEW

Четыре главных системы и как они связаны между собой через данные.

```
┌─────────────────────────────────────────────────────────┐
│                  Git Repository                         │
│              andyrbek2709-tech/ai-institut              │
│                     (GitHub main)                       │
└─────────────────────┬─────────────────────────────────┬─┘
                      │                                 │
        ┌─────────────┴────────────┐         ┌──────────┴──────────┐
        │                          │         │                     │
   ┌────▼─────┐        ┌──────────▼──┐  ┌──▼──────┐      ┌────────▼─────┐
   │ EngHub   │        │ AdIntakeBot  │  │Cable    │      │ Android      │
   │ (CRA+TS) │        │ (Node+Tgraf) │  │ Calc    │      │ VoiceBot     │
   └────┬─────┘        └──────┬───────┘  │(Python) │      │ (Kotlin)     │
        │                     │          └────┬────┘      └──────────────┘
        │                     │               │
        │                     │               └────────┐
        │                     │                        │
   ┌────▼────────────────┐    │          ┌─────────────▼────────┐
   │  Vercel             │    │          │ Vercel (same)        │
   │  prj_ZDihCpWH...    │    │          │ API endpoints        │
   │  ├─ /api/...        │    │          │ ├─ /cable-calc/calc  │
   │  ├─ /api/telegram   │    │          │ ├─ /cable-calc/parse │
   │  ├─ /api/orchestr.. │    │          │ ├─ /report-xlsx      │
   │  └─ /cable-calc/... │    │          │ └─ ...               │
   └────┬─────────────────┘    │          └──────────────────────┘
        │                      │
        │                 ┌────▼────────────┐
        │                 │  Railway        │
        │                 │ kind-comfort    │
        │                 │ ai-institut     │
        │                 └────┬────────────┘
        │                      │
        │      ┌───────────────┴────────────┬────────────┐
        │      │                            │            │
        │  ┌───▼──────────┐    ┌───────────▼───┐  ┌────▼─────────┐
        │  │ Supabase-1   │    │ Supabase-2    │  │ External API │
        │  │ jbdljdwl...  │    │ pbxzxwskh...  │  │              │
        │  │              │    │               │  ├─ OpenAI      │
        │  ├─ auth        │    ├─ auth         │  ├─ DeepSeek    │
        │  ├─ projects    │    ├─ conversat..  │  ├─ Anthropic   │
        │  ├─ tasks       │    ├─ history      │  ├─ LiveKit     │
        │  ├─ drawings    │    ├─ knowledge..  │  └─ Telegram    │
        │  ├─ revisions   │    └─ Vector search   
        │  ├─ storage     │
        │  └─ pgvector    │
        └───┬────────────┘
            │
            └─ Vectorize-doc (edge fn)
            └─ Search-normative (edge fn)
```

---

## 1️⃣ ENGHUB ↔ SUPABASE-1 CONNECTION

### Data Flow (EngHub → Supabase-1)

**Writing (Create/Update):**
```typescript
// enghub-main/src/api/supabase.ts
const response = await supabaseClient
  .from('projects')
  .insert([{ name, team_id, ... }])
  .select();
// → Supabase-1 (jbdljdwlfimvmqybzynv)
```

**Tables touched:**
- `projects` — создание/редактирование проектов
- `tasks` — управление задачами (Kanban)
- `drawings` — реестр чертежей
- `revisions` — выпуск R0, R1, R2...
- `reviews` — замечания, severity, threads
- `transmittals` — отправки комплектов
- `messages` — realtime чат
- `time_entries` — табель часов
- `specifications` — спецификации (AGSK)

**Reading:**
```typescript
// Realtime subscriptions
const subscription = supabaseClient
  .from('tasks')
  .on('*', payload => console.log(payload))
  .subscribe();
// → Updates come back in real-time
```

### RLS (Row Level Security)

**Проверяется в БД:**
```sql
-- supabase/migrations/015_role_aware_rls.sql
CREATE POLICY ... USING (
  auth.uid() = user_id OR
  check_team_access(auth.uid(), team_id)
);
```

**Влияние:**
- Инженер видит только свои задачи
- ГИП видит все проекты
- Lead видит задачи отдела

---

## 2️⃣ ADINTAKEBOT ↔ SUPABASE-2 CONNECTION

### Data Flow (AdBot → Supabase-2)

**Writing (Telegram → Bot → DB):**
```javascript
// ad-intake-bot/src/services/supabase.js
const { data } = await supabaseClient
  .from('conversations')
  .insert([{ 
    user_id: message.from.id,
    stage: 'new',
    data: { agency, budget, timeline }
  }])
  .select();
// → Supabase-2 (pbxzxwskhuzaojphkeet)
```

**Tables:**
- `conversations` — заявки от клиентов
- `history` — сообщения (text + voice → transcribed)
- `knowledge_items` — RAG база (pgvector embeddings)

**Reading:**
```javascript
// Get conversation history for context
const { data: history } = await supabaseClient
  .from('history')
  .select('*')
  .eq('conversation_id', conv_id)
  .order('created_at', { ascending: true });

// RAG search (pgvector)
const { data: matches } = await supabaseClient
  .rpc('match_knowledge_items', {
    query_embedding: embedding,
    match_count: 5
  });
```

### Webhook Flow (AdBot → External)

**After storing in Supabase-2:**
```javascript
// Notifying manager
await telegramBot.sendMessage(
  MANAGER_CHAT_ID,
  `🔔 New lead: ${conversation.agency}`
);

// CRM webhook (optional)
if (CRM_WEBHOOK_URL) {
  await fetch(CRM_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({
      agency: conversation.data.agency,
      budget: conversation.data.budget,
      // ...
    })
  });
}
```

---

## 3️⃣ CABLE-CALC FLOW

### Request Path

```
User input (UI in /cable-calc.html)
        ↓
    fetch('/api/cable-calc/calc', { 
      method: 'POST',
      body: JSON.stringify(params)
    })
        ↓
    Vercel function (enghub-main/api/cable-calc/calc.py)
        ↓
    Python engine (calc.py module)
        ↓
    Database lookup (k_tables, standard sections)
        ↓
    Calculate (МЭК formulas)
        ↓
    JSON response
        ↓
    Browser renders results
```

### Parsing with Vision

```
User uploads PDF/Excel
        ↓
    fetch('/api/cable-calc/parse', {
      method: 'POST',
      body: FormData (file)
    })
        ↓
    Vercel function (parse.py)
        ↓
    Detect file type
        ├─ PDF (text) → pdfplumber
        ├─ PDF (scan) → OpenAI Vision (expensive!)
        ├─ Excel → openpyxl
        └─ Word → python-docx
        ↓
    Extract rows
        ↓
    Regex parse (марка, сечение, длина)
        ↓
    Validate with check_section()
        ↓
    Return table with status per row
```

**Critical:** maxDuration = 60s (in `vercel.json`) because Vision API can timeout.

---

## 4️⃣ EXTERNAL API DEPENDENCIES

### OpenAI Connections

**From EngHub:**
- `OPENAI_API_KEY` (Vercel env)
- Used in:
  - `/api/cable-calc/parse.py` — Vision (PDF parsing)
  - Supabase Edge Function `vectorize-doc` — embeddings (text-embedding-3-small)
  - `/api/orchestrator` — as fallback for Claude

**From AdIntakeBot:**
- `OPENAI_API_KEY` (Railway env)
- Used in:
  - Whisper (STT) — `src/services/whisper.js`
  - GPT-4o-mini (LLM) — `src/services/openai.js` (if DeepSeek fails)
  - Embeddings (RAG) — `src/services/openai.js` (knowledge items)

### Anthropic Claude Connection

**From EngHub only:**
- `ANTHROPIC_API_KEY` (Vercel env)
- Used in:
  - `/api/orchestrator.js` — AI Copilot
  - Intent routing (project_insights, smart_decompose, etc.)

### DeepSeek Fallback

**From AdIntakeBot:**
- `LLM_API_KEY` (Railway env)
- `LLM_BASE_URL=https://api.deepseek.com`
- Used in:
  - If OpenAI fails or quota exhausted
  - Cheaper alternative for long conversations

### LiveKit (Video)

**From EngHub only:**
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (Vercel env)
- Used in:
  - `/api/meeting-token.js` — issue JWT for video room
  - `src/components/ConferenceRoom.tsx` — @livekit/components-react

### Telegram Connections

**AdIntakeBot:**
- `BOT_TOKEN` (Railway env, from @BotFather)
- Used in:
  - Receive messages from users
  - Send notifications to manager
  - Commands: `/help`, `/transcript`, etc.

**EngHub (optional):**
- `/api/telegram.js` — pull-based (bot doesn't receive push)
- Commands: `/mytasks`, `/deadlines`, `/status`
- NOT a bot account (just calls Telegram API)

---

## 5️⃣ DATA ISOLATION (CRITICAL)

### Supabase-1 (EngHub) ≠ Supabase-2 (AdBot)

```
SUPABASE_URL=https://jbdljdwlfimvmqybzynv.supabase.co  ← EngHub
SUPABASE_KEY=sbp_...  ← EngHub service_role

DIFFERENT FROM:

SUPABASE_URL=https://pbxzxwskhuzaojphkeet.supabase.co   ← AdBot
SUPABASE_KEY=sbp_...  ← AdBot service_role
```

**Why separate?**
- Isolation (if one is compromised, other is safe)
- Different schema needs (AdBot is simpler)
- Independent scaling
- Independent backup/restore

**Connection locations:**
```
Vercel env vars       → EngHub only
Railway env vars      → AdBot only
```

---

## 6️⃣ DEPLOYMENT PIPELINE

### EngHub Deploy (Vercel)

```
1. Developer: git commit + git push origin main
2. GitHub: webhook → Vercel
3. Vercel: 
   ├─ Clone repo
   ├─ npm install
   ├─ npm run build (CRA)
   ├─ Deploy serverless functions (api/*)
   └─ Cache busting + alias promotion
4. Result: https://enghub-three.vercel.app READY
5. Migrations: Manual (need to apply in Supabase console)
```

### AdIntakeBot Deploy (Railway)

```
1. Developer: git commit + git push origin main
2. GitHub: webhook → Railway
3. Railway:
   ├─ Clone repo
   ├─ npm install
   ├─ NIXPACKS build
   ├─ Start: npm start (index.js)
   └─ Health check: GET /health
4. Result: https://ai-institut-production.up.railway.app UP
5. Migrations: Manual (apply in Supabase-2 console)
```

---

## 7️⃣ ERROR PROPAGATION

### If Supabase-1 is down

```
EngHub → [API call] → Supabase-1 (jbdljdwlfimvmqybzynv) ❌
            ↓
         500 error
            ↓
      UI shows error boundary
            ↓
   User cannot access data
   (but app doesn't crash)
```

**Fallback:** None (must restore Supabase-1)

### If Supabase-2 is down

```
AdBot → [save conversation] → Supabase-2 (pbxzxwskhuzaojphkeet) ❌
            ↓
         Error on saving
            ↓
      Notify manager
            ↓
   Conversation lost (if not retried)
```

**Fallback:** None (must restore Supabase-2)

### If OpenAI API is down

```
cable-calc/parse (Vision) ❌
    ↓
Parse fails
    ↓
User gets: "Vision API unavailable"
    ↓
WORKAROUND: User uploads CSV/Excel instead

OR

AdBot (GPT-4o-mini) ❌
    ↓
Fallback to DeepSeek ✅
    ↓
Conversation continues (slower/cheaper)
```

### If Vercel is down

```
EngHub API ❌
    ↓
All requests fail
    ↓
Vercel status page shows red
    ↓
WORKAROUND: None (must wait for Vercel recovery)
```

---

## 8️⃣ MONITORING POINTS

**Critical to watch:**

| System | Metric | Threshold | Action |
|--------|--------|-----------|--------|
| Vercel | Deploy success | 100% | Revert if fails |
| Railway | Health check | 200 OK | Restart if fails |
| Supabase-1 | Connection | <100ms | Alert if >500ms |
| Supabase-2 | Backups | Daily | Manual if fails |
| OpenAI | Rate limit | <1000 req/min | Upgrade plan |
| Cable-calc | Parse timeout | <60s | Kill if exceeds |

---

**Date:** 2026-05-05  
**Status:** ✅ PRODUCTION VERIFIED
