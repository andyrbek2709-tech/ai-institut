# android-voicebot — нативный APK для голосовой отправки в Telegram

Этот каталог зарезервирован под исходники нативного Android-приложения, реализующего путь D из `enghub-main/public/voice-bot.html`.

## Архитектура

- **Платформа:** Android 8.0+ (minSdk 26), Kotlin
- **Голос:** Android `SpeechRecognizer` в фоновом сервисе с непрерывным слушанием
- **Триггер-фраза:** регэкс `отправь в телеграм (.*)` — пользовательский на старте
- **Telegram:** [TDLib](https://core.telegram.org/tdlib) (`org.drinkless:tdlib`) — нативный клиент, не Bot API
- **Сборка:** Gradle (Kotlin DSL), AGP 8+, через GitHub Actions (`.github/workflows/build-voice-bot-apk.yml`)

## Структура (TODO к реализации)

```
android-voicebot/
├── gradlew, gradlew.bat
├── gradle/wrapper/...
├── settings.gradle.kts
├── build.gradle.kts
└── app/
    ├── build.gradle.kts
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/io/enghub/voicebot/
        │   ├── MainActivity.kt
        │   ├── VoiceListenerService.kt
        │   ├── TelegramClient.kt    # TDLib wrapper
        │   └── PhraseParser.kt
        └── res/
            ├── layout/activity_main.xml
            └── values/strings.xml
```

## Состояние

- ✅ CI workflow создан: `.github/workflows/build-voice-bot-apk.yml` (триггер: push в `android-voicebot/**` либо ручной `workflow_dispatch`)
- ✅ Релизы публикуются автоматически: тег `voice-bot-vYYYYMMDD-HHMM`, ассет `*-release*.apk`
- ✅ Страница `voice-bot.html` подхватывает свежий APK через GitHub Releases API
- ⏳ Исходники Kotlin — ещё не закоммичены (workflow корректно «no-op» пока их нет)

## Запуск сборки сейчас

CI пока «no-op» (печатает «⚠ android-voicebot/ source tree not yet committed»). Чтобы получить реальный APK — нужно добавить gradlew + app/ + AndroidManifest.xml.

## Установка APK на телефоне

1. Скачать `voice-bot-release.apk` из последнего релиза
2. На телефоне: Настройки → Безопасность → разрешить установку из неизвестных источников для браузера
3. Открыть APK → установить
4. При первом запуске:
   - Дать разрешение на микрофон
   - Отключить оптимизацию батареи для приложения (Настройки → Батарея → app → не оптимизировать)
   - Войти в Telegram (TDLib запросит номер телефона + SMS-код)
5. Проверка: сказать «отправь в телеграм проверка работает» — сообщение придёт в чат «Saved Messages» (или в выбранный получатель).
