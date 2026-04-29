#!/usr/bin/env python3
"""v2 AI pipeline — async batches, two-level clustering, cost tracking.

1. Read data/raw_items.json (no keyword pre-filter).
2. AsyncOpenAI client, gather() with semaphore=5, batches of 30.
3. For each item: is_pain, category, priority, summary_ru, cluster_seed_ru,
   meta_cluster_seed_ru, lang.
4. Group items → clusters (fuzzy by Levenshtein) → meta_clusters.
5. Write enghub-main/public/data/parsing.json with the v2 schema.
"""
from __future__ import annotations

import asyncio
import difflib
import json
import os
import re
import sys
import time
from datetime import datetime, timezone


MIN_TIMESTAMP = datetime(2026, 1, 1, tzinfo=timezone.utc)
_INVALID_TS = datetime.min.replace(tzinfo=timezone.utc)


def _parse_ts(ts):
    """Best-effort ISO-8601 parser. Invalid/None → datetime.min UTC."""
    if not ts or not isinstance(ts, str):
        return _INVALID_TS
    s_ = ts.strip()
    if not s_:
        return _INVALID_TS
    if s_.endswith("Z"):
        s_ = s_[:-1] + "+00:00"
    try:
        d = datetime.fromisoformat(s_)
    except ValueError:
        for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                d = datetime.strptime(s_.replace("+00:00", ""), fmt)
                break
            except ValueError:
                continue
        else:
            return _INVALID_TS
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_PATH = ROOT / "data" / "raw_items.json"
OUT_DIR = ROOT / "enghub-main" / "public" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_PATH = OUT_DIR / "parsing.json"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _status import update as status_update  # noqa: E402

OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "")
MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
BATCH_SIZE = 30
CONCURRENCY = 5
# gpt-4o-mini pricing (USD per 1M tokens) as of writing
PRICE_IN = 0.15 / 1_000_000
PRICE_OUT = 0.60 / 1_000_000

CATEGORIES = {
    "integration": "Интеграция систем",
    "workflow":    "Workflow-автоматизация",
    "docgen":      "Генерация документов",
    "monitoring":  "Мониторинг и триггеры",
    "parsing":     "Парсинг и агрегация",
    "mass-ops":    "Массовые операции",
    "ai":          "AI-обработка",
    "ui":          "Интерфейсы (бот/веб/форма)",
}

META_CLUSTER_EMOJI = {
    "data-sync":          "🔄",
    "manual-data-entry":  "✍️",
    "reporting":          "📊",
    "monitoring":         "🚨",
    "documentation":      "📄",
    "communication":      "💬",
    "scheduling":         "📅",
    "search-discovery":   "🔍",
    "code-quality":       "🐛",
    "deployment":         "🚀",
    "ai-tools":           "🤖",
    "other":              "🧩",
}


def _now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def excerpt(s, n=300):
    s = (s or "").strip()
    return (s[:n] + "…") if len(s) > n else s


def normalize_seed(seed):
    s = (seed or "").lower().strip()
    s = re.sub(r"[^\w\s\-а-яё]", "", s, flags=re.UNICODE)
    s = re.sub(r"\s+", "-", s).strip("-")
    return s or "uncategorized"


def fuzzy_match(seed, existing_ids):
    """Return existing id if seed shares 2+ tokens or has SequenceMatcher ratio>=0.78."""
    tokens = set(t for t in seed.split("-") if len(t) > 2)
    best, best_score = None, 0.0
    for cid in existing_ids:
        c_tokens = set(t for t in cid.split("-") if len(t) > 2)
        token_overlap = len(tokens & c_tokens)
        ratio = difflib.SequenceMatcher(None, seed, cid).ratio()
        score = token_overlap + ratio
        if (token_overlap >= 2 or ratio >= 0.78) and score > best_score:
            best_score = score
            best = cid
    return best


# ---------- AI ---------- #

CAT_LIST = "\n".join(f"  - {k} → {v}" for k, v in CATEGORIES.items())
SYS_PROMPT = (
    "Ты классификатор болевых точек, которые можно автоматизировать. "
    "Получаешь массив постов из инженерных/IT-сообществ. Для КАЖДОГО элемента возвращай "
    "объект со строгим JSON-форматом.\n\n"
    f"Категории (id → label):\n{CAT_LIST}\n\n"
    "Правила:\n"
    "1. is_pain=true только если автор реально жалуется на ручную/повторяющуюся работу или "
    "ищет инструмент. Иначе false.\n"
    "2. category — один из id выше.\n"
    "3. priority — float 0..10: насколько эта боль распространена И автоматизируема.\n"
    "4. summary_ru — одно предложение по-русски, что именно болит.\n"
    "5. cluster_seed_ru — 3..5 ключевых слов на русском (общие для всей категории схожих "
    "болей, нижний регистр, без знаков, например \"ручной перенос crm excel\").\n"
    "6. meta_cluster_seed_ru — 1..3 слова, более широкая мета-тема (например \"синхронизация "
    "данных\", \"отчётность\", \"коммуникация\", \"мониторинг\", \"документация\").\n"
    "7. lang — \"ru\" или \"en\" исходного поста.\n"
    "Выводи строго JSON: {\"results\":[obj,...]} в том же порядке что вход."
)


def _heuristic_one(it):
    txt = (it.get("title", "") + " " + it.get("text", "")).lower()
    triggers = ["вручную", "приходится", "копирую", "руками", "manually",
                "every time", "repetitive", "by hand", "tired of", "automate"]
    hits = sum(1 for t in triggers if t in txt)
    return {
        "is_pain": hits >= 1,
        "category": "workflow",
        "priority": min(10.0, 4.0 + hits),
        "summary_ru": (it.get("title") or "")[:140],
        "cluster_seed_ru": "ручной-процесс",
        "meta_cluster_seed_ru": "автоматизация",
        "lang": it.get("lang", "en"),
    }


async def _call_batch(client, items, totals):
    payload = [
        {"i": idx, "title": it["title"], "text": (it.get("text") or "")[:600],
         "lang": it.get("lang", "en")}
        for idx, it in enumerate(items)
    ]
    user = json.dumps({"items": payload}, ensure_ascii=False)
    try:
        rsp = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYS_PROMPT},
                {"role": "user", "content": user},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
            max_tokens=4000,
        )
        if rsp.usage:
            totals["in"] += rsp.usage.prompt_tokens
            totals["out"] += rsp.usage.completion_tokens
        raw = rsp.choices[0].message.content or "{}"
        data = json.loads(raw)
        results = data.get("results") or data.get("items") or []
        out = []
        for idx in range(len(items)):
            r = results[idx] if idx < len(results) else {}
            cat = r.get("category") if r.get("category") in CATEGORIES else "workflow"
            out.append({
                "is_pain": bool(r.get("is_pain", False)),
                "category": cat,
                "priority": float(r.get("priority", 5.0)),
                "summary_ru": (r.get("summary_ru") or "").strip()[:240],
                "cluster_seed_ru": (r.get("cluster_seed_ru") or "ручной процесс").strip().lower(),
                "meta_cluster_seed_ru": (r.get("meta_cluster_seed_ru") or "автоматизация").strip().lower(),
                "lang": r.get("lang") or items[idx].get("lang", "en"),
            })
        return out
    except Exception as e:
        print(f"[!] batch failed: {e}", file=sys.stderr)
        return [_heuristic_one(it) for it in items]


async def run_ai(items, started_at):
    if not OPENAI_KEY:
        print("[!] no OPENAI_API_KEY — using heuristic fallback", file=sys.stderr)
        return [_heuristic_one(it) for it in items], {"in": 0, "out": 0}

    try:
        from openai import AsyncOpenAI  # type: ignore
    except ImportError:
        print("[!] openai SDK missing — heuristic fallback", file=sys.stderr)
        return [_heuristic_one(it) for it in items], {"in": 0, "out": 0}

    client = AsyncOpenAI(api_key=OPENAI_KEY)
    totals = {"in": 0, "out": 0}

    batches = [items[i:i + BATCH_SIZE] for i in range(0, len(items), BATCH_SIZE)]
    results_by_idx: dict[int, list] = {}
    sem = asyncio.Semaphore(CONCURRENCY)
    completed = [0]
    total_batches = len(batches)

    async def _worker(batch_idx, batch):
        async with sem:
            r = await _call_batch(client, batch, totals)
            results_by_idx[batch_idx] = r
            completed[0] += 1
            done_items = sum(len(results_by_idx[k]) for k in results_by_idx)
            pct = int(completed[0] / total_batches * 100)
            # Periodic status update — every 5 completed batches to limit commits
            if completed[0] % 5 == 0 or completed[0] == total_batches:
                status_update(
                    status="ai-processing",
                    current_step=f"AI обрабатывает (батч {completed[0]}/{total_batches})",
                    progress_pct=pct,
                    items_processed=done_items,
                    items_total=len(items),
                    started_at=started_at,
                    commit=True,
                )

    await asyncio.gather(*(_worker(i, b) for i, b in enumerate(batches)))
    flat = []
    for i in range(total_batches):
        flat.extend(results_by_idx.get(i, []))
    return flat, totals


# ---------- Pipeline ---------- #

def main():
    if not RAW_PATH.exists():
        print(f"ERROR: missing {RAW_PATH}", file=sys.stderr)
        return 1

    raw = json.loads(RAW_PATH.read_text(encoding="utf-8"))
    raw_items = raw.get("items", [])
    _before = len(raw_items)
    raw_items = [it for it in raw_items if _parse_ts(it.get("timestamp", "")) >= MIN_TIMESTAMP]
    if _before != len(raw_items):
        print(f"[date-filter] process_pains: {_before} → {len(raw_items)} (отброшено {_before-len(raw_items)})")
    raw_stats = raw.get("stats", {})
    sources_used = sorted(s for s, st in raw_stats.items() if st.get("fetched", 0) > 0)
    started_at = _now_iso()

    print(f"raw_items={len(raw_items)}")

    status_update(
        status="ai-processing",
        current_step=f"Старт AI: {len(raw_items)} элементов",
        progress_pct=0,
        items_processed=0,
        items_total=len(raw_items),
        started_at=started_at,
        commit=True,
    )

    if not raw_items:
        write_feed([], [], [], len(raw_items), 0, 0, sources_used, 0.0,
                   note="Новых болей не найдено в этом прогоне")
        status_update(status="done", current_step="Готово (пусто)", progress_pct=100,
                      started_at=started_at, commit=True)
        return 0

    t0 = time.time()
    ai_results, tok = asyncio.run(run_ai(raw_items, started_at))
    elapsed = time.time() - t0
    cost = tok["in"] * PRICE_IN + tok["out"] * PRICE_OUT
    print(f"AI done in {elapsed:.1f}s; tokens in={tok['in']} out={tok['out']} cost=${cost:.4f}")

    status_update(
        status="clustering",
        current_step="Группировка по кластерам",
        progress_pct=92,
        items_processed=len(raw_items),
        items_total=len(raw_items),
        started_at=started_at,
        commit=True,
    )

    # ---- Filter pains and build first-level clusters ---- #
    clusters: dict[str, dict] = {}
    enriched = []
    for it, ai in zip(raw_items, ai_results):
        if not ai.get("is_pain"):
            continue
        seed = normalize_seed(ai["cluster_seed_ru"])
        match = fuzzy_match(seed, list(clusters.keys()))
        cid = match or seed
        if cid not in clusters:
            clusters[cid] = {
                "id": cid,
                "label": ai["cluster_seed_ru"].strip().capitalize() or cid,
                "category": ai["category"],
                "items_count": 0,
                "_priorities": [],
                "_meta_seeds": [],
                "examples_ids": [],
            }
        c = clusters[cid]
        c["items_count"] += 1
        c["_priorities"].append(ai["priority"])
        c["_meta_seeds"].append(normalize_seed(ai["meta_cluster_seed_ru"]))
        if len(c["examples_ids"]) < 5:
            c["examples_ids"].append(it["id"])

        enriched.append({
            "id": it["id"],
            "source": it["source"],
            "source_label": it.get("source_label", it["source"]),
            "url": it["url"],
            "title": it["title"],
            "text_excerpt": excerpt(it.get("text", ""), 300),
            "timestamp": it.get("timestamp", ""),
            "lang": ai.get("lang", it.get("lang", "en")),
            "is_pain": True,
            "category": ai["category"],
            "category_label": CATEGORIES.get(ai["category"], "Workflow-автоматизация"),
            "priority": round(ai["priority"], 2),
            "summary_ru": ai["summary_ru"],
            "cluster_id": cid,
            "meta_cluster_id": "",  # filled in below
        })

    # ---- Roll up tiny clusters (<2 items) into "Прочее" ---- #
    misc_id = "misc-other"
    misc_meta_seed = "прочее"
    for cid in list(clusters.keys()):
        if cid == misc_id:
            continue
        if clusters[cid]["items_count"] < 2:
            old = clusters.pop(cid)
            if misc_id not in clusters:
                clusters[misc_id] = {
                    "id": misc_id,
                    "label": "Прочее",
                    "category": "workflow",
                    "items_count": 0,
                    "_priorities": [],
                    "_meta_seeds": [],
                    "examples_ids": [],
                }
            m = clusters[misc_id]
            m["items_count"] += old["items_count"]
            m["_priorities"].extend(old["_priorities"])
            m["_meta_seeds"].extend(old["_meta_seeds"] or [misc_meta_seed])
            for ex in old["examples_ids"]:
                if len(m["examples_ids"]) < 8:
                    m["examples_ids"].append(ex)
            for it in enriched:
                if it["cluster_id"] == cid:
                    it["cluster_id"] = misc_id

    # ---- Decide each cluster's meta_cluster (majority vote on meta seeds) ---- #
    meta_clusters: dict[str, dict] = {}
    for cid, c in clusters.items():
        seeds = c.get("_meta_seeds") or ["автоматизация"]
        # majority vote
        from collections import Counter
        winner = Counter(seeds).most_common(1)[0][0]
        winner_norm = normalize_seed(winner)
        # fuzzy merge with existing meta clusters
        match = fuzzy_match(winner_norm, list(meta_clusters.keys()))
        mid = match or winner_norm
        if mid not in meta_clusters:
            meta_clusters[mid] = {
                "id": mid,
                "label": winner.strip().capitalize() or mid,
                "emoji": META_CLUSTER_EMOJI.get(mid, "🧩"),
                "clusters_count": 0,
                "items_count": 0,
                "total_priority": 0.0,
            }
        c["meta_cluster_id"] = mid
        meta_clusters[mid]["clusters_count"] += 1
        meta_clusters[mid]["items_count"] += c["items_count"]
        meta_clusters[mid]["total_priority"] += sum(c["_priorities"])

    # propagate meta_cluster_id to items
    for it in enriched:
        cid = it["cluster_id"]
        it["meta_cluster_id"] = clusters[cid]["meta_cluster_id"] if cid in clusters else ""

    # finalize cluster averages
    cluster_list = []
    for c in clusters.values():
        prios = c.pop("_priorities") or [0]
        c.pop("_meta_seeds", None)
        c["avg_priority"] = round(sum(prios) / len(prios), 2)
        cluster_list.append(c)
    cluster_list.sort(key=lambda c: (c.get("meta_cluster_id", ""), -c["items_count"], -c["avg_priority"]))

    meta_list = sorted(
        meta_clusters.values(),
        key=lambda m: (-m["total_priority"], -m["items_count"]),
    )
    for m in meta_list:
        m["total_priority"] = round(m["total_priority"], 1)

    enriched.sort(key=lambda x: -x["priority"])

    note = None
    if not enriched:
        note = "Новых болей не найдено в этом прогоне"
    write_feed(enriched, cluster_list, meta_list,
               total_scraped=len(raw_items),
               passed=len(raw_items),
               confirmed=len(enriched),
               sources_used=sources_used,
               cost_usd=cost,
               note=note)

    status_update(
        status="done",
        current_step=f"Готово: {len(enriched)} болей в {len(cluster_list)} кластерах",
        progress_pct=100,
        items_processed=len(raw_items),
        items_total=len(raw_items),
        started_at=started_at,
        commit=True,
    )
    print(f"\nWritten {OUT_PATH.relative_to(ROOT)}: items={len(enriched)} "
          f"clusters={len(cluster_list)} meta={len(meta_list)}")
    return 0


def write_feed(items, clusters, meta_clusters, total_scraped, passed, confirmed,
               sources_used, cost_usd, note=None):
    meta = {
        "generated_at": _now_iso(),
        "sources_used": sources_used,
        "stats": {
            "total_scraped": total_scraped,
            "ai_processed": passed,
            "confirmed_pain": confirmed,
            "clusters": len(clusters),
            "meta_clusters": len(meta_clusters),
        },
        "categories": CATEGORIES,
        "cost_usd": round(cost_usd, 4),
    }
    if note:
        meta["note"] = note
    payload = {
        "meta": meta,
        "meta_clusters": meta_clusters,
        "clusters": clusters,
        "items": items,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
