# Brand assets

- `vformate-logo.png` — исходник логотипа (может быть крупным). Обновляйте при смене бренда.
- `vformate-logo-telegram.png` — для `sendPhoto`: после ресайза **trim** краёв, минимальные поля, ширина холста считается под целевую **экранную** высоту (~28px); иначе Telegram растягивает узкий PNG на всю ширину чата. Сборка: `npm run build:telegram-logo` (`sharp`). Env: `TELEGRAM_LOGO_INNER_MAX_H`, `TELEGRAM_LOGO_TARGET_SCREEN_H`, `TELEGRAM_LOGO_REF_CHAT_W`, `TELEGRAM_LOGO_TRIM_THRESHOLD`, `TELEGRAM_LOGO_PAD_X` / `PAD_Y`.
- Переопределение пути: `AGENCY_LOGO_PATH` (абсолютный путь к PNG/JPG на сервере) — если задан, подменяет оба встроенных файла.
