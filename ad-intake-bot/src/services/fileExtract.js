/**
 * Текст из PDF (цифровой). Импорт из lib/, не из корня pdf-parse — там отладочный блок при !module.parent.
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

export async function extractTextFromPdfBuffer(buffer) {
  if (!buffer || !buffer.length) return "";
  try {
    const data = await pdfParse(buffer);
    const text = (data.text || "").replace(/\s+/g, " ").trim();
    return text.slice(0, 14000);
  } catch (e) {
    console.error("[fileExtract/pdf]", e.message);
    return "";
  }
}
