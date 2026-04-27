# STATE — EngHub

> Живой журнал. Обновляется при каждом значимом изменении. Источник правды между сессиями Claude.

## Текущее состояние

- **Прод:** https://enghub-three.vercel.app/ — последний успешный деплой `E5X9xDEy`
- **Стек:** React 18 + TypeScript (CRA), Vercel (monorepo: api/* serverless functions + src/), Supabase (Postgres + auth + Realtime + Storage)
- **Репо:** `andyrbek2709-tech/ai-institut`, ветка `main`
- **Последний рабочий коммит:** `2b9e2df` — fix: revert truncated specificationPayload.ts (orphan code at line 119) (2026-04-27 17:58:13)
- **Vercel project id:** `prj_ZDihCpWH1AmIEPRebnOI7ST6d6nv` (team `team_o0boJNeRGftH6Cbi9byd0dbF`)
- **Supabase project id:** `jbdljdwlfimvmqybzynv`
- **Env (Vercel):** `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` + Supabase keys
- **Миграции БД:** до `018_video_meetings.sql` применены в Supabase

## Известные проблемы

- При прямой правке App.tsx через Cowork-маунт файлы могут уезжать в commit обрезанными (наблюдалось на supabase.ts, SpecificationsTab.tsx, specificationPayload.ts). Все правки делать через клон `/tmp` или Cowork-disptacher → bash, не через Sonnet-чат на Cowork-маунте.
- Старая `ConferenceRoom.legacy.tsx` сохранена для отката LiveKit-видеовстреч.

## Следующие шаги

- [ ] (заполнится по мере работы)

## Последние изменения (новые сверху)

### 2026-04-27 18:42 — chore: добавлен STATE.md (память проекта)
- **Что:** введён единый протокол памяти через STATE.md в репо. Любая сессия Claude (Cowork, Sonnet code chat, Claude Code, claude.ai) теперь читает этот файл первым делом и обновляет после каждого значимого изменения.
- **Файлы:** `STATE.md` (новый), `CLAUDE.md` (дополнен/создан с правилами).
- **Деплой:** не требуется, документация.
- **Почему:** чтобы память о проекте переживала сессии и переходила между разными чатами Claude через git.

## Недавние коммиты (контекст до начала ведения STATE.md)

- `2b9e2df` fix: revert truncated specificationPayload.ts (orphan code at line 119) (2026-04-27 17:58:13 +0000)
- `b11e93b` fix: revert broken supabase.ts and SpecificationsTab.tsx from fd2e9ed (truncated/orphaned JSX) (2026-04-27 17:24:24 +0000)
- `fd2e9ed` fix: add AbortSignal timeout to all API calls + implement pagination for admin user list (2026-04-27 10:18:15 +0000)
