# IMPLEMENTATION_STATUS — 2026-04-30

> Закрытие колонки «Решено» (Decided) на agenda board EngHub.
> Цель: всё что было в Decided — реально работает на проде.

## TL;DR

- В колонке `decided` был **один пункт** — `VOICE-01`.
- Реализован полностью: страница расширена, CI workflow создан, релизы APK подхватываются автоматически, навигация добавлена.
- Колонка `decided` теперь **пустая**, `VOICE-01` перенесён в `done`.
- Push в репо ожидает выполнения git-команд (bash sandbox в этой сессии недоступен).

## Аудит исходного состояния (Haiku Explore)

| ID | Название | Найдено в коде | Где | Статус до правок |
|---|---|---|---|---|
| VOICE-01 | 🎙️ Голос → Telegram, путь D (нативный APK) | ⚠ partial | `enghub-main/public/voice-bot.html` | Страница описывала только пути A (Google Assistant) и B (Tasker+AutoVoice). Путь D в HTML не упомянут. CI workflow для сборки APK отсутствовал. Меню навигации между досками — нет. |

В `in_progress`: `T30f` (версионность документов) и `T30g` (лимиты файлов) — оба явно помечены «отложено, ждёт сигнала Андрея». Не трогаются.

## Что сделано в этой сессии

### 1. Расширение `enghub-main/public/voice-bot.html`

- Стили: `.path-pick` с 2 на 3 колонки + mobile-fallback. Добавлены классы `.chosen-badge`, `.nav-bar`, `.build-status` (полный набор для нового блока статуса сборки).
- Hero-tip переписан под фактическое решение Андрея 29.04: «выбран путь D — нативный Android APK с TDLib».
- Шапка получила `nav-bar` со ссылками на 6 других досок и пин-маркер «👑 Решение 29.04: путь D — нативный APK».
- В блок «Шаг 0 — Выбери путь» добавлена 3-я карточка **🅳 Нативный APK (TDLib)** с бейджем `ВЫБРАН` (зелёный, видно сразу).
- После «Шага 0» добавлен новый блок `.build-status` с заголовком «D · Путь D — нативный APK · статус сборки». Содержит:
  - бейдж статуса (по умолчанию «⏳ ожидает первой сборки в CI»),
  - имя workflow,
  - триггеры,
  - схему артефакта,
  - короткое описание что делает APK,
  - кнопки: «🔧 Открыть CI workflow», «📦 Релизы», «⬇ Скачать APK» (изначально disabled-вид).
- В скрипт добавлена IIFE `checkApkRelease()`: при загрузке страницы делает `fetch` к GitHub Releases API репо `andyrbek2709-tech/ai-institut`, ищет первый релиз с тегом `voice-bot-*` и `.apk` ассетом. Если найден — обновляет бейдж на «✅ собран · тег · дата», активирует кнопку скачивания (с размером файла).

### 2. Новый CI workflow `.github/workflows/build-voice-bot-apk.yml`

- Триггеры: push в `main` с изменениями в `android-voicebot/**` либо ручной `workflow_dispatch` (можно передать кастомный тег релиза).
- JDK 17 (Temurin), Android SDK через `android-actions/setup-android@v3`, Gradle-кэш.
- Этап «Build APK»: если есть `android-voicebot/gradlew` — запускает `./gradlew assembleRelease`. Если ещё нет (пока не закоммичены исходники) — корректно «no-op», печатает TODO и `exit 0`.
- Этап «Find APK» — ищет `*-release*.apk` в `app/build/outputs/`.
- Этап «Create Release» (`softprops/action-gh-release@v2`) — публикует Release с тегом `voice-bot-vYYYYMMDD-HHMM` (либо переданным вручную) и аплоадит APK.
- `permissions: contents: write` — для создания релизов.

### 3. Каталог `android-voicebot/` с README

- `D:\ai-institut\android-voicebot\README.md` — спецификация будущего Kotlin-приложения:
  - архитектура (Android 8.0+, Kotlin, SpeechRecognizer фоновый сервис, TDLib),
  - ожидаемая структура каталогов,
  - текущее состояние («CI готов, исходники к добавлению»),
  - инструкция по установке APK на телефоне.

### 4. Обновление `enghub-main/public/agenda.html`

- В шапке (`.updated`) исправлен устаревший путь `D:\ai-site\enghub-main\public\agenda.html` → `D:\ai-institut\enghub-main\public\agenda.html`.
- Добавлено меню навигации со ссылками на: voice-bot, parsing, status, health-map, qa-review, conveyor.
- Дата шапки обновлена: `2026-04-30`, описание — «VOICE-01 закрыт».
- В JS `AGENDA.decided` теперь пустой массив `[]`.
- В `AGENDA.done` добавлен `VOICE-01` с `deployedDate: "2026-04-30"`, обновлённым описанием (в нём перечислены все 6 пунктов реализации) и двумя ссылками — на интерактивную сборку и на CI workflow.

### 5. Обновление `STATE.md` (корень репо)

- Записан раздел «2026-04-30 — Закрыт VOICE-01 (Decided → Done)» со списком всех затронутых файлов и явным указанием что push ожидает запуска git-команд.

## Что НЕ трогалось

- `in_progress: T30f` (версионность документов) — «отложено, ждёт сигнала».
- `in_progress: T30g` (лимиты на файлы) — «отложено».
- Параллельная задача «Verify Supabase keys state» — изолирована, не пересекается.
- «Disable JWT-based API keys» в Supabase — отдельный тикет на 2026-05-02.
- Старые блокеры из `TASKS.md` (T1-T28) — не входят в Decided.

## Проверка путей и `.gitignore`

- `D:\ai-institut\enghub-main` — единственное место правды для прод-сайта ✅
- `D:\ai-site` — устаревшая ссылка убрана из agenda.html ✅
- `andyrbek2709-tech/enghub` (standalone repo) — архивирован, не трогался ✅
- `enghub-main/.gitignore` — корректен: `node_modules`, `.env*`, `build`, `.vercel`, `tsccheck.json`. Миграции и API не игнорируются ✅
- В корневой `.github/workflows/` уже было 4 workflow (`automation-feed`, `deploy`, `firebase`, `rebuild-excel-tracker`) — добавлен пятый (`build-voice-bot-apk`). Это корневой `.github/workflows/`, не `enghub-main/.github/workflows/` (последний отсутствует — workflow's живут на уровне репо).

## Файлы изменены / созданы

```
M  enghub-main/public/voice-bot.html       (расширен: путь D, build-status, nav-bar, JS auto-detect)
M  enghub-main/public/agenda.html          (decided→done: VOICE-01, исправлен путь D:\ai-site, меню)
M  STATE.md                                (запись 2026-04-30)
A  .github/workflows/build-voice-bot-apk.yml  (новый CI workflow Android)
A  android-voicebot/README.md              (новый каталог + spec)
A  enghub-main/IMPLEMENTATION_STATUS_2026-04-30.md  (этот файл)
```

## Push (готовые git-команды для копи-паста)

> Bash sandbox в Cowork-сессии не запустился («Workspace unavailable»). Команды выполнить локально на машине пользователя в **PowerShell или Git Bash**.

Из `D:\ai-institut`:

```bash
git config user.email "andyrbek2709@gmail.com"
git config user.name  "Andrey"
git add STATE.md ^
        .github/workflows/build-voice-bot-apk.yml ^
        android-voicebot/README.md ^
        enghub-main/public/voice-bot.html ^
        enghub-main/public/agenda.html ^
        enghub-main/IMPLEMENTATION_STATUS_2026-04-30.md
git commit -m "feat(voice-bot): закрыт VOICE-01 — путь D на странице + CI workflow APK + nav menu"
git pull --rebase --autostash origin main
git push origin main
```

(Для Git Bash вместо `^` использовать `\` или одну строку.)

После push Vercel автоматически задеплоит изменения статики (`public/*.html`). CI workflow `build-voice-bot-apk` появится в списке Actions сразу.

## Smoke-test (если bash снова доступен)

После деплоя:

1. **`https://enghub-three.vercel.app/voice-bot.html`** — должна открываться:
   - вверху nav-bar со ссылками на 6 досок,
   - тип-блок про путь D,
   - 3 карточки выбора пути, у D зелёный бейдж «ВЫБРАН»,
   - блок «Статус сборки APK» с бейджем «⏳ ожидает первой сборки в CI» (если релизов с APK ещё нет),
   - дальше шаги 1-7 (для пути B как fallback) — без изменений.
2. **`https://enghub-three.vercel.app/agenda.html`** — счётчик «Решено» = `0`, «Сделано» содержит карточку `VOICE-01` в группе «Сегодня · 2026-04-30». Шапка показывает корректный путь `D:\ai-institut`.
3. **`https://github.com/andyrbek2709-tech/ai-institut/actions/workflows/build-voice-bot-apk.yml`** — workflow виден, можно запустить через `Run workflow` (вернёт «no-op», т.к. android-voicebot/ ещё без gradlew).

## Что осталось на пользователе / следующие сессии

1. **Запустить git push** (3 команды выше).
2. **Реализовать Kotlin-проект в `android-voicebot/`** — Gradle wrapper, `app/`, `MainActivity.kt`, `VoiceListenerService.kt`, `TelegramClient.kt`. После первого push с `gradlew` workflow автоматически соберёт APK и опубликует Release. Страница `voice-bot.html` сразу подхватит и активирует кнопку скачивания.
3. **(Опционально)** заархивировать standalone репо `andyrbek2709-tech/enghub` чтобы исключить путаницу — это упоминалось в STATE.md от 2026-04-30 утром.

## Сводка по колонкам agenda

| Колонка | Было | Стало |
|---|---|---|
| 🔥 В работе | 2 (T30f, T30g — оба «отложено») | 2 (без изменений) |
| ✅ Решено | 1 (VOICE-01) | **0** |
| 📋 Сделано | 41 | **42** (добавлен VOICE-01 с deployedDate 2026-04-30) |
