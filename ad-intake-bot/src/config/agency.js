import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Публичное имя бренда (как в логотипе). */
export const AGENCY_NAME = "vformate";

/**
 * Путь к PNG/JPG логотипа для приветствия /start.
 * AGENCY_LOGO_PATH — абсолютный путь на сервере; иначе используется встроенный assets/vformate-logo.png.
 */
export function resolveAgencyLogoPath() {
  const envPath = process.env.AGENCY_LOGO_PATH?.trim();
  if (envPath && fs.existsSync(envPath)) return envPath;
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
