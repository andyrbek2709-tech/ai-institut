# Brand assets

- `vformate-logo.png` — исходник логотипа (может быть крупным). Обновляйте при смене бренда.
- `vformate-logo-telegram.png` — **уменьшенная** копия для `sendPhoto` (~52px по высоте, визуально ≈ две строки текста в Telegram). Собрать из PNG: из каталога `ad-intake-bot` выполнить `npm install` и `npm run build:telegram-logo` (нужен devDependency `sharp`).
- Переопределение пути: `AGENCY_LOGO_PATH` (абсолютный путь к PNG/JPG на сервере) — если задан, подменяет оба встроенных файла.
