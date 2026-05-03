# Brand assets

- `vformate-logo.png` — исходник логотипа (может быть крупным). Обновляйте при смене бренда.
- `vformate-logo-telegram.png` — версия для `sendPhoto`: **широкий прозрачный холст** + логотип по центру (иначе Telegram растягивает узкий PNG на всю ширину чата и «вздувает» высоту). Сборка: `npm run build:telegram-logo` (devDependency `sharp`; env `TELEGRAM_LOGO_CANVAS_W` / `TELEGRAM_LOGO_CANVAS_H` / `TELEGRAM_LOGO_INNER_MAX_H`).
- Переопределение пути: `AGENCY_LOGO_PATH` (абсолютный путь к PNG/JPG на сервере) — если задан, подменяет оба встроенных файла.
