#!/usr/bin/env python3
"""AI processing pipeline for the daily pain-points feed.

1. Read data/raw_items.json
2. Filter by trigger phrases (>=2 hits in title+text, RU+EN combined)
3. Call OpenAI gpt-4o-mini in batches of ~25 items, JSON mode
4. Cluster items by fuzzy-matched cluster_seed_ru
5. Write enghub-main/public/data/automation-feed.json
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_PATH = ROOT / "data" / "raw_items.json"
OUT_DIR = ROOT / "enghub-main" / "public" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_PATH = OUT_DIR / "automation-feed.json"

OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "")
MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
BATCH_SIZE = 25

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

TRIGGER_RU = [
    "вручную", "каждый раз", "приходится", "нет такого инструмента",
    "нет инструмента", "повторяю", "копирую", "руками", "делаю по",
    "до сих пор", "всегда", "достало", "нельзя ли как-то",
    "автоматически", "автоматизировать", "раз в день", "раз в неделю",
    "часами", "надоело", "не могу найти", "чтобы не делать", "рутина",
    "скучно", "задолбался",
]
TRIGGER_EN = [
    "manually", "every time", "have to", "no tool", "repeatedly",
    "copy paste", "by hand", "daily", "weekly", "tired of",
    "can't find", "automate", "automatic", "repetitive", "boring",
    "time-consuming", "copy-pasting", "again and again", "wasted hours",
    "error-prone", "sick of", "fed up",
]
TRIGGERS = TRIGGER_RU + TRIGGER_EN


def _now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def trigger_hits(text: str) -> int:
    t = text.lower()
    return sum(1 for p in TRIGGERS if p in t)


def excerpt(s: str, n: int = 300) -> str:
    s = (s or "").strip()
    return (s[:n] + "…") if len(s) > n else s


def normalize_seed(seed: str) -> str:
    """Normalize cluster_seed_ru → stable cluster id."""
    s = (seed or "").lower().strip()
    s = re.sub(r"[^\w\s\-а-яё]", "", s, flags=re.UNICODE)
    s = re.sub(r"\s+", "-", s).strip("-")
    return s or "uncategorized"


def fuzzy_match(seed: str, existing: dict) -> str | None:
    """Return existing cluster id if seed shares 2+ tokens with one already there."""
    tokens = set(t for t in seed.split("-") if len(t) > 2)
    if not tokens:
        return None
    best = None
    best_score = 0
    for cid in existing.keys():
        c_tokens = set(t for t in cid.split("-") if len(t) > 2)
        score = len(tokens & c_tokens)
        if score >= 2 and score > best_score:
            best_score = score
            best = cid
    return best


# ---------- OpenAI wrapper (degrades gracefully if SDK or key missing) ---------- #

def call_openai(items: list[dict]) -> list[dict]:
    """Send a batch of items to OpenAI; return list aligned to input order.

    Each return entry: {is_pain, category, priority, summary_ru, cluster_seed_ru}
    """
    if not OPENAI_KEY:
        # heuristic fallback so the pipeline still produces output without a key
        return [
            {
                "is_pain": True,
                "category": "workflow",
                "priority": min(10.0, 4.0 + trigger_hits(it["title"] + " " + it["text"])),
                "summary_ru": (it["title"][:140]),
                "cluster_seed_ru": "ручной-процесс",
            }
            for it in items
        ]

    try:
        from openai import OpenAI  # type: ignore
    except ImportError:
        print("[!] openai SDK not installed — heuristic fallback", file=sys.stderr)
        return call_openai_no_key(items)

    client = OpenAI(api_key=OPENAI_KEY)

    cat_list = "\n".join(f"  - {k} → {v}" for k, v in CATEGORIES.items())
    sys_prompt = (
        "Ты классификатор болевых точек, которые можно автоматизировать. "
        "Получаешь массив постов из инженерных/айтишных сообществ. "
        "Для КАЖДОГО элемента возвращай объект со строгим JSON-форматом.\n\n"
        f"Доступные категории (id → label):\n{cat_list}\n\n"
        "Правила:\n"
        "1. is_pain=true только если автор реально жалуется на ручную/повторяющуюся работу или ищет инструмент.\n"
        "2. category — обязательно один из id выше.\n"
        "3. priority — float 0..10, насколько эта боль распространена и автоматизируема.\n"
        "4. summary_ru — одно предложение на русском, что именно болит.\n"
        "5. cluster_seed_ru — 3..5 ключевых слов на русском, без знаков препинания, "
        "общие для всех схожих болей (например 'ручной перенос crm excel').\n"
        "Выводи строго JSON: {\"results\":[{...}, {...}]} в том же порядке."
    )

    payload_items = [
        {"i": idx, "title": it["title"], "text": (it["text"] or "")[:600], "lang": it["lang"]}
        for idx, it in enumerate(items)
    ]
    user_prompt = json.dumps({"items": payload_items}, ensure_ascii=False)

    try:
        rsp = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
            max_tokens=3500,
        )
        raw = rsp.choices[0].message.content or "{}"
        data = json.loads(raw)
        results = data.get("results") or data.get("items") or []
        out = []
        for idx in range(len(items)):
            r = results[idx] if idx < len(results) else {}
            out.append({
                "is_pain":         bool(r.get("is_pain", False)),
                "category":        r.get("category") if r.get("category") in CATEGORIES else "workflow",
                "priority":        float(r.get("priority", 5.0)),
                "summary_ru":      (r.get("summary_ru") or "").strip()[:240],
                "cluster_seed_ru": (r.get("cluster_seed_ru") or "ручной-процесс").strip().lower(),
            })
        return out
    except Exception as e:
        print(f"[!] OpenAI batch failed: {e}", file=sys.stderr)
        return call_openai_no_key(items)


def call_openai_no_key(items):
    OPENAI_KEY_LOCAL = ""  # noqa
    return [
        {
            "is_pain": True,
            "category": "workflow",
            "priority": min(10.0, 4.0 + trigger_hits(it["title"] + " " + it["text"])),
            "summary_ru": (it["title"][:140]),
            "cluster_seed_ru": "ручной-процесс",
        }
        for it in items
    ]


# ---------- Pipeline ---------- #

def main():
    if not RAW_PATH.exists():
        print(f"ERROR: missing {RAW_PATH}", file=sys.stderr)
        return 1

    raw = json.loads(RAW_PATH.read_text(encoding="utf-8"))
    raw_items = raw.get("items", [])
    raw_stats = raw.get("stats", {})
    sources_used = sorted(s for s, st in raw_stats.items() if st.get("fetched", 0) > 0)

    # 1) trigger filter
    filtered = []
    for it in raw_items:
        text = (it.get("title", "") + " " + it.get("text", "")).lower()
        if trigger_hits(text) >= 2:
            filtered.append(it)

    print(f"raw={len(raw_items)}  passed_filter={len(filtered)}")

    if not filtered:
        # Still write an empty feed
        write_feed([], [], len(raw_items), 0, 0, sources_used)
        return 0

    # 2) AI in batches
    ai_results = []
    for i in range(0, len(filtered), BATCH_SIZE):
        batch = filtered[i:i + BATCH_SIZE]
        print(f"  AI batch {i//BATCH_SIZE + 1}: {len(batch)} items")
        ai_results.extend(call_openai(batch))
        time.sleep(1.0)

    # 3) build enriched items + clusters
    clusters: dict[str, dict] = {}
    enriched = []
    for it, ai in zip(filtered, ai_results):
        if not ai.get("is_pain"):
            continue
        seed = normalize_seed(ai["cluster_seed_ru"])
        match = fuzzy_match(seed, clusters)
        cid = match or seed
        if cid not in clusters:
            clusters[cid] = {
                "id": cid,
                "label": ai["cluster_seed_ru"].strip().capitalize() or cid,
                "category": ai["category"],
                "items_count": 0,
                "_priorities": [],
                "examples": [],
            }
        clusters[cid]["items_count"] += 1
        clusters[cid]["_priorities"].append(ai["priority"])
        if len(clusters[cid]["examples"]) < 5:
            clusters[cid]["examples"].append(it["id"])

        enriched.append({
            "id": it["id"],
            "source": it["source"],
            "source_label": it.get("source_label", it["source"]),
            "url": it["url"],
            "title": it["title"],
            "text_excerpt": excerpt(it.get("text", ""), 300),
            "timestamp": it["timestamp"],
            "lang": it["lang"],
            "is_pain": True,
            "category": ai["category"],
            "category_label": CATEGORIES.get(ai["category"], "Workflow-автоматизация"),
            "priority": round(ai["priority"], 2),
            "summary_ru": ai["summary_ru"],
            "cluster_id": cid,
        })

    # finalize cluster averages
    cluster_list = []
    for c in clusters.values():
        prios = c.pop("_priorities") or [0]
        c["avg_priority"] = round(sum(prios) / len(prios), 2)
        cluster_list.append(c)
    cluster_list.sort(key=lambda c: (-c["items_count"], -c["avg_priority"]))

    # default sort: priority desc
    enriched.sort(key=lambda x: -x["priority"])

    write_feed(enriched, cluster_list,
               total_scraped=len(raw_items),
               passed=len(filtered),
               confirmed=len(enriched),
               sources_used=sources_used)
    print(f"\nWritten {OUT_PATH.relative_to(ROOT)}: items={len(enriched)} clusters={len(cluster_list)}")
    return 0


def write_feed(items, clusters, total_scraped, passed, confirmed, sources_used):
    payload = {
        "meta": {
            "generated_at": _now_iso(),
            "sources_used": sources_used,
            "stats": {
                "total_scraped": total_scraped,
                "passed_filter": passed,
                "ai_confirmed_pain": confirmed,
                "clusters": len(clusters),
            },
            "categories": CATEGORIES,
        },
        "items": items,
        "clusters": clusters,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
