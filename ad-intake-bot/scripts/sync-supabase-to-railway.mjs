/**
 * Подставляет в Railway (сервис ai-institut) SUPABASE_URL и SUPABASE_KEY из .env.
 * Читает по порядку: ./.env в ad-intake-bot, затем %AD_INTAKE_BOT_ENV% или D:\\AdIntakeBot\\.env
 *
 *   node scripts/sync-supabase-to-railway.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
process.chdir(root);

function parseLooseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Z0-9_]+)\s*[-—=]\s*(.+)$/i);
    if (m) {
      out[m[1].toUpperCase()] = m[2].trim();
      continue;
    }
    const eq = t.indexOf("=");
    if (eq > 0) {
      const k = t.slice(0, eq).trim().toUpperCase();
      out[k] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

function loadEnv() {
  const candidates = [
    path.join(root, ".env"),
    process.env.AD_INTAKE_BOT_ENV,
    "D:\\AdIntakeBot\\.env",
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (!p || !fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, "utf8");
      const parsed = parseLooseEnv(raw);
      if (parsed.SUPABASE_URL && parsed.SUPABASE_KEY) {
        console.log("Источник:", p);
        return { url: parsed.SUPABASE_URL, key: parsed.SUPABASE_KEY };
      }
    } catch {
      /* next */
    }
  }
  return null;
}

const pair = loadEnv();
if (!pair) {
  console.error(
    "Не найдены SUPABASE_URL и SUPABASE_KEY. Создайте ad-intake-bot/.env или D:\\AdIntakeBot\\.env в формате KEY=value."
  );
  process.exit(1);
}

function resolveRailwayCmd() {
  if (process.platform === "win32") {
    const roaming = process.env.APPDATA || "";
    if (roaming) {
      const cmd = path.join(roaming, "npm", "railway.cmd");
      if (fs.existsSync(cmd)) return cmd;
    }
  }
  return "railway";
}
const railwayCmd = resolveRailwayCmd();

function setStdin(name, value) {
  const r = spawnSync(railwayCmd, ["variable", "set", name, "--stdin"], {
    input: value.endsWith("\n") ? value : `${value}\n`,
    encoding: "utf-8",
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  const err = r.stderr?.toString?.() || "";
  const out = r.stdout?.toString?.() || "";
  if (r.error) {
    console.error(r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error(err || out || `railway exit ${r.status}`);
    process.exit(r.status ?? 1);
  }
}

setStdin("SUPABASE_URL", pair.url);
setStdin("SUPABASE_KEY", pair.key);
console.log("Готово: в Railway для сервиса ai-institut обновлены SUPABASE_URL и SUPABASE_KEY (деплой запустится автоматически).");
