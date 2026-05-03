/**
 * Собирает компактный PNG для sendPhoto: в Telegram высота превью
 * задаётся исходными пикселями (~2 строки текста в чате ≈ 52px).
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

/** Целевая высота (px): визуально ≈ 2 строки обычного текста в Telegram. */
const MAX_HEIGHT = Number(process.env.TELEGRAM_LOGO_MAX_HEIGHT || 52);

if (!fs.existsSync(src)) {
  console.error("Missing source:", src);
  process.exit(1);
}

const meta = await sharp(src).metadata();
if (!meta.width || !meta.height) {
  console.error("Could not read image dimensions");
  process.exit(1);
}
console.log("Source", meta.width, "x", meta.height);

await sharp(src)
  .resize({
    height: MAX_HEIGHT,
    fit: "inside",
    withoutEnlargement: true,
  })
  .png({ compressionLevel: 9 })
  .toFile(dst);

const out = fs.statSync(dst);
console.log("Wrote", dst, `(${out.size} bytes), max height ${MAX_HEIGHT}px`);
