/**
 * PNG для sendPhoto: Telegram масштабирует фото по ширине пузыря.
 * Экранная высота ≈ file_h * (ширина_чата / file_w) — поэтому широкий холст с низким file_h.
 *
 * Уменьшаем «белые поля»: trim по краям (прозрачность / однотонные поля), минимальные pad,
 * динамическая ширина холста под целевую экранную высоту.
 * Чёткость: даунскейл в два прохода с умеренным sharpen.
 *
 * Источник: assets/vformate-logo.png → assets/vformate-logo-telegram.png
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "assets", "vformate-logo.png");
const dst = path.join(root, "assets", "vformate-logo-telegram.png");

const INNER_MAX_H = Number(process.env.TELEGRAM_LOGO_INNER_MAX_H || 32);
/** Ориентир ширины чата (px) для расчёта ширины холста. */
const REF_CHAT_W = Number(process.env.TELEGRAM_LOGO_REF_CHAT_W || 340);
/** Желаемая экранная высота превью (px), обычно ~28–34. */
const TARGET_SCREEN_H = Number(process.env.TELEGRAM_LOGO_TARGET_SCREEN_H || 28);
const PAD_X = Number(process.env.TELEGRAM_LOGO_PAD_X || 6);
const PAD_Y = Number(process.env.TELEGRAM_LOGO_PAD_Y || 2);
const TRIM_THRESHOLD = Number(process.env.TELEGRAM_LOGO_TRIM_THRESHOLD || 14);

if (!fs.existsSync(src)) {
  console.error("Missing source:", src);
  process.exit(1);
}

const meta = await sharp(src).metadata();
if (!meta.width || !meta.height) {
  console.error("Could not read image dimensions");
  process.exit(1);
}

// Два прохода: чуть крупнее, затем до целевой высоты — мягче края.
const upscaled = await sharp(src)
  .resize({
    height: Math.min(INNER_MAX_H * 2, meta.height),
    fit: "inside",
    withoutEnlargement: false,
  })
  .resize({
    height: INNER_MAX_H,
    fit: "inside",
  })
  .ensureAlpha()
  .sharpen({ sigma: 0.35, m1: 0.8, m2: 0.3 })
  .png()
  .toBuffer({ resolveWithObject: true });

let data = upscaled.data;
let w = upscaled.info.width;
let h = upscaled.info.height;

try {
  const trimmed = await sharp(data)
    .trim({ threshold: TRIM_THRESHOLD })
    .toBuffer({ resolveWithObject: true });
  if (trimmed.info.width > 8 && trimmed.info.height > 4) {
    data = trimmed.data;
    w = trimmed.info.width;
    h = trimmed.info.height;
  }
} catch {
  /* оставляем без trim */
}

const CANVAS_H = h + PAD_Y * 2;
const minW = w + PAD_X * 2;
const aspectW = Math.ceil((CANVAS_H * REF_CHAT_W) / TARGET_SCREEN_H);
const CANVAS_W = Math.max(minW, aspectW);

const left = Math.floor((CANVAS_W - w) / 2);
const top = Math.floor((CANVAS_H - h) / 2);

console.log("Source", meta.width, "x", meta.height, "→ logo", w, "x", h, "canvas", CANVAS_W, "x", CANVAS_H);

await sharp({
  create: {
    width: CANVAS_W,
    height: CANVAS_H,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: data, left, top }])
  .png({ compressionLevel: 7 })
  .toFile(dst);

const out = fs.statSync(dst);
const dim = await sharp(dst).metadata();
const est = Math.round((CANVAS_H * REF_CHAT_W) / CANVAS_W);
console.log("Wrote", dst, dim.width, "x", dim.height, `(${out.size} bytes), est. screen h ~${est}px @${REF_CHAT_W}px wide`);
