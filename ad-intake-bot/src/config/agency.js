import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Публичное имя бренда (как в логотипе). */
export const AGENCY_NAME = "vformate";

/**
 * Параметры сборки `npm run build:telegram-logo` (см. скрипт).
 * Важно: Telegram масштабирует фото по **ширине** пузыря; узкий файл с малым `h`
 * даёт огромную **экранную** высоту. Поэтому в репо — **широкий холст** + логотип по центру.
 */
export const TELEGRAM_LOGO_CANVAS_W = 400;
export const TELEGRAM_LOGO_CANVAS_H = 48;
export const TELEGRAM_LOGO_INNER_MAX_H = 36;

/**
 * Путь к PNG/JPG логотипа для приветствия /start.
 * 1) `AGENCY_LOGO_PATH` — явный абсолютный путь на сервере (если задан и файл есть).
 * 2) `assets/vformate-logo-telegram.png` — компактная версия для чата (предпочтительно).
 * 3) `assets/vformate-logo.png` — полноразмерный fallback.
 */
export function resolveAgencyLogoPath() {
  const envPath = process.env.AGENCY_LOGO_PATH?.trim();
  if (envPath && fs.existsSync(envPath)) return envPath;
  const compact = path.join(__dirname, "../../assets/vformate-logo-telegram.png");
  if (fs.existsSync(compact)) return compact;
  const builtIn = path.join(__dirname, "../../assets/vformate-logo.png");
  if (fs.existsSync(builtIn)) return builtIn;
  return null;
}

/** Короткая подпись под логотипом в /start (отдельное сообщение с полным текстом идёт следом). */
export function buildStartPhotoCaption() {
  return `🏢 ${AGENCY_NAME} — жарнама агенттігі / рекламное агентство`;
}

/**
 * Текст приветствия после логотипа: қазақ + русский.
 * «В формате» — отсылка к названию vformate.
 */
export function buildStartWelcomeBody() {
  return [
    `👋 Сәлеметсіз бе! Бұл компания — в формате (${AGENCY_NAME}).`,
    "Қалаған тіліңізде жаза беріңіз.",
    "Тапсырысты рәсімдеуге көмектесемін. Не керек екенін айтыңыз — мәтінмен, дауыспен немесе макет пен фотоны жіберіңіз.",
    "",
    "—",
    "",
    `👋 Здравствуйте! Эта компания — в формате (${AGENCY_NAME}).`,
    "Пишите на любом удобном языке.",
    "Я помогу оформить заказ. Расскажите, что нужно — текстом, голосом или пришлите макет/фото.",
    "",
    "Шаблоны: /templates",
  ].join("\n");
}

/** Если логотип не удалось отправить — одно сообщение: шапка + тело. */
export function buildStartWelcomeFallbackText() {
  return `${buildStartPhotoCaption()}\n\n${buildStartWelcomeBody()}`;
}

/** Текст после /reset — kk + ru, как раньше, с пометкой рекламного агентства (без фото). */
export function buildResetWelcomeText() {
  return [
    `🏢 ${AGENCY_NAME} — жарнама агенттігі / рекламное агентство`,
    "",
    "👋 Сәлеметсіз бе!",
    "Бәрін нөлден бастаймыз. Не керек екенін айтыңыз — бірнеше позицияны «және» арқылы бірден жазуға болады.",
    "",
    "—",
    "",
    "👋 Здравствуйте!",
    "Окей, начнём заново. Расскажите, что нужно сделать — можно сразу несколько позиций через «и».",
  ].join("\n");
}

/** Клавиатура менеджера: нажатие = отправка текста команды в чат. */
export function getManagerLeadsKeyboardMarkup() {
  return {
    keyboard: [
      [{ text: "/leads" }, { text: "/leads new" }],
      [{ text: "/leads in_progress" }, { text: "/leads hot" }],
      [{ text: "/stats" }],
    ],
    resize_keyboard: true,
  };
}
