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

/** Текст приветствия клиенту после /start (без parse_mode). */
export function buildStartWelcomeText() {
  return [
    `🏢 ${AGENCY_NAME} — рекламное агентство`,
    "",
    "👋 Сәлеметсіз бе!",
    "Қалаған тіліңізде жаза беріңіз — сол тілде жауап беремін.",
    "Жарнамаға тапсырыс беруге көмектесемін. Не керек екенін айтыңыз — мәтінмен, дауыспен немесе макетті/фотоны жіберіңіз.",
    "",
    "—",
    "",
    "👋 Здравствуйте!",
    "Пишите на любом удобном языке — отвечу на нём же.",
    "Помогу оформить заказ на рекламу — текстом, голосом или с макетом/фото.",
    "",
    "—",
    "",
    "👋 Hello!",
    "Write in any language you prefer — I’ll reply in the same language.",
    "I’ll help you place an advertising order — text, voice, or mockups/photos.",
    "",
    "Шаблоны: /templates",
  ].join("\n");
}
