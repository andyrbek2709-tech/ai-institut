/**
 * PNG для sendPhoto: Telegram тянет фото на ширину чата, поэтому «маленькая высота файла»
 * даёт огромную картинку на экране. Делаем широкий холст с логотипом по центру —
 * визуальная высота ≈ CANVAS_H * (ширина_чата / CANVAS_W).
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

/** Ширина холста (px): больше → ниже превью на экране при той же высоте холста. */
const CANVAS_W = Number(process.env.TELEGRAM_LOGO_CANVAS_W || 400);
/** Высота холста (px): при ширине чата ~340px экранная высота ≈ CANVAS_H * 340 / CANVAS_W (~40px). */
const CANVAS_H = Number(process.env.TELEGRAM_LOGO_CANVAS_H || 48);
/** Макс. высота самого логотипа внутри холста (без плющивания, fit inside). */
const INNER_MAX_H = Number(process.env.TELEGRAM_LOGO_INNER_MAX_H || 36);

if (!fs.existsSync(src)) {
  console.error("Missing source:", src);
  process.exit(1);
}

const meta = await sharp(src).metadata();
if (!meta.width || !meta.height) {
  console.error("Could not read image dimensions");
  process.exit(1);
}
console.log("Source", meta.width, "x", meta.height, "→ canvas", CANVAS_W, "x", CANVAS_H, "inner max h", INNER_MAX_H);

const innerBuf = await sharp(src)
  .resize({
    height: INNER_MAX_H,
    width: Math.floor(CANVAS_W * 0.92),
    fit: "inside",
    withoutEnlargement: false,
  })
  .ensureAlpha()
  .png()
  .toBuffer({ resolveWithObject: true });

const { data, info } = innerBuf;
const left = Math.max(0, Math.floor((CANVAS_W - info.width) / 2));
const top = Math.max(0, Math.floor((CANVAS_H - info.height) / 2));

await sharp({
  create: {
    width: CANVAS_W,
    height: CANVAS_H,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: data, left, top }])
  .png({ compressionLevel: 9 })
  .toFile(dst);

const out = fs.statSync(dst);
const dim = await sharp(dst).metadata();
console.log("Wrote", dst, dim.width, "x", dim.height, `(${out.size} bytes)`);
console.log(
  "On ~340px chat width, preview height ≈",
  Math.round((CANVAS_H * 340) / CANVAS_W),
  "px"
);
