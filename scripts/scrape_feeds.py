#!/usr/bin/env python3
"""Scrape ~3000–5000 raw items/day from 6 free sources.

v2 changes:
  - HN Algolia: hitsPerPage=500 + extra last-24h search
  - Habr: 5 RSS feeds, limit=200 each
  - vc.ru: 4 RSS feeds
  - ProductHunt + IndieHackers: full RSS body kept
  - Stack Overflow: 4 tag queries × 100 = 400 questions

Writes data/raw_items.json. Dedup via data/seen.json (sha256 of source|url).
Pushes live status updates to enghub-main/public/data/status.json.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

try:
    import feedparser  # type: ignore
except ImportError:
    print("ERROR: feedparser not installed", file=sys.stderr)
    sys.exit(2)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _status import update as status_update, begin as status_begin  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)
SEEN_PATH = DATA_DIR / "seen.json"
OUT_PATH = DATA_DIR / "raw_items.json"

UA = "automation-feed-bot/2.0 (+github.com/andyrbek2709-tech/ai-institut)"
HEADERS = {"User-Agent": UA, "Accept": "*/*"}
TIMEOUT = 30


def _strip_html(s: str) -> str:
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def _hash(source: str, url: str) -> str:
    return hashlib.sha256(f"{source}|{url}".encode("utf-8")).hexdigest()


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _safe_iso(ts) -> str:
    if not ts:
        return _now_iso()
    if isinstance(ts, (int, float)):
        return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    if isinstance(ts, str):
        return ts
    if hasattr(ts, "tm_year"):
        try:
            return datetime(*ts[:6], tzinfo=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            return _now_iso()
    return _now_iso()


# -------- HN -------- #
def fetch_hn() -> list:
    out, seen_ids = [], set()
    yesterday = int((datetime.now(timezone.utc) - timedelta(days=1)).timestamp())
    urls = [
        "https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=500",
        f"https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=500&numericFilters=created_at_i>{yesterday}",
        "https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=500",
    ]
    for url in urls:
        try:
            r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            r.raise_for_status()
            for h in r.json().get("hits", []):
                sid = h.get("objectID")
                if not sid or sid in seen_ids:
                    continue
                seen_ids.add(sid)
                title = (h.get("title") or h.get("story_title") or "").strip()
                if not title:
                    continue
                link = h.get("url") or f"https://news.ycombinator.com/item?id={sid}"
                text = _strip_html(h.get("story_text") or h.get("comment_text") or "")
                out.append({
                    "id": f"hn-{sid}",
                    "source": "hn",
                    "source_label": "Hacker News",
                    "url": link,
                    "title": title,
                    "text": text[:5000],
                    "timestamp": _safe_iso(h.get("created_at")),
                    "lang": "en",
                })
            time.sleep(0.8)
        except Exception as e:
            print(f"  [hn] {url}: {e}", file=sys.stderr)
    return out


# -------- Generic RSS -------- #
def _fetch_rss(rss_url, source, label, lang, id_prefix, keep_comments=False):
    try:
        feed = feedparser.parse(rss_url, request_headers=HEADERS)
    except Exception as e:
        print(f"  [{source}] {rss_url}: {e}", file=sys.stderr)
        return []
    out = []
    for e in feed.entries:
        link = (e.get("link") or "").strip()
        title = _strip_html(e.get("title") or "").strip()
        if not link or not title:
            continue
        body = e.get("summary") or ""
        if not body and e.get("content"):
            try:
                body = e["content"][0].get("value", "")
            except Exception:
                body = ""
        text = _strip_html(body)
        if keep_comments and e.get("comments"):
            text += "  [comments: " + str(e.get("comments")) + "]"
        guid = e.get("id") or e.get("guid") or link
        slug = re.sub(r"[^a-zA-Z0-9]+", "-", guid)[-32:].strip("-") \
            or hashlib.md5(link.encode()).hexdigest()[:12]
        ts = _safe_iso(e.get("published_parsed") or e.get("updated_parsed"))
        out.append({
            "id": f"{id_prefix}-{slug}",
            "source": source,
            "source_label": label,
            "url": link,
            "title": title,
            "text": text[:5000],
            "timestamp": ts,
            "lang": lang,
        })
    return out


# -------- Habr (multiple feeds) -------- #
HABR_FEEDS = [
    "https://habr.com/ru/rss/articles/?fl=ru&limit=200",
    "https://habr.com/ru/rss/all/?fl=ru&limit=200",
    "https://habr.com/ru/rss/best/daily/?fl=ru&limit=200",
    "https://habr.com/ru/rss/news/?fl=ru&limit=100",
    "https://habr.com/ru/rss/hubs/programming/articles/?fl=ru&limit=100",
]


def fetch_habr() -> list:
    out, seen_urls = [], set()
    for url in HABR_FEEDS:
        items = _fetch_rss(url, "habr", "Habr", "ru", "habr")
        for it in items:
            if it["url"] in seen_urls:
                continue
            seen_urls.add(it["url"])
            out.append(it)
        time.sleep(0.6)
    return out


# -------- vc.ru (multiple feeds) -------- #
VC_FEEDS = [
    "https://vc.ru/rss/all",
    "https://vc.ru/rss/new",
    "https://vc.ru/rss/hot",
    "https://vc.ru/services/rss",
]


def fetch_vc() -> list:
    out, seen_urls = [], set()
    for url in VC_FEEDS:
        items = _fetch_rss(url, "vc", "vc.ru", "ru", "vc")
        for it in items:
            if it["url"] in seen_urls:
                continue
            seen_urls.add(it["url"])
            out.append(it)
        time.sleep(0.6)
    return out


def fetch_ph() -> list:
    return _fetch_rss("https://www.producthunt.com/feed", "ph", "ProductHunt", "en", "ph",
                      keep_comments=True)


def fetch_ih() -> list:
    return _fetch_rss("https://www.indiehackers.com/feed.xml", "ih", "IndieHackers", "en", "ih",
                      keep_comments=True)


# -------- StackOverflow (4 tag queries) -------- #
SO_TAGS = ["automation", "workflow", "scripting", "efficiency"]


def fetch_so() -> list:
    out, seen_ids = [], set()
    for tag in SO_TAGS:
        url = ("https://api.stackexchange.com/2.3/questions"
               f"?site=stackoverflow&order=desc&sort=activity&tagged={tag}"
               "&pagesize=100&filter=withbody")
        try:
            r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            r.raise_for_status()
            for q in r.json().get("items", []):
                qid = q.get("question_id")
                if not qid or qid in seen_ids:
                    continue
                seen_ids.add(qid)
                title = _strip_html(q.get("title") or "")
                if not title:
                    continue
                body = _strip_html(q.get("body") or "")
                out.append({
                    "id": f"so-{qid}",
                    "source": "so",
                    "source_label": "Stack Overflow",
                    "url": q.get("link") or f"https://stackoverflow.com/q/{qid}",
                    "title": title,
                    "text": body[:5000],
                    "timestamp": _safe_iso(q.get("creation_date")),
                    "lang": "en",
                })
            time.sleep(2.0)  # respect SO's rate limit
        except Exception as e:
            print(f"  [so/{tag}] {e}", file=sys.stderr)
    return out


FETCHERS = [
    ("hn",   "Hacker News",      fetch_hn),
    ("habr", "Habr (5 feeds)",   fetch_habr),
    ("vc",   "vc.ru (4 feeds)",  fetch_vc),
    ("ph",   "ProductHunt",      fetch_ph),
    ("ih",   "IndieHackers",     fetch_ih),
    ("so",   "StackOverflow x4", fetch_so),
]


def load_seen():
    if not SEEN_PATH.exists():
        return set()
    try:
        return set(json.loads(SEEN_PATH.read_text(encoding="utf-8")))
    except Exception:
        return set()


def save_seen(seen):
    SEEN_PATH.write_text(json.dumps(sorted(seen), ensure_ascii=False), encoding="utf-8")


def main():
    started = status_begin("Парсинг источников", total=len(FETCHERS))

    seen = load_seen()
    all_new = []
    stats = {}

    for idx, (name, label, fn) in enumerate(FETCHERS):
        status_update(
            status="scraping",
            current_step=f"Источник {idx+1}/{len(FETCHERS)}: {label}",
            progress_pct=int(idx / len(FETCHERS) * 100),
            items_processed=len(all_new),
            items_total=0,
            started_at=started,
            commit=True,
        )
        fetched = 0
        new_count = 0
        try:
            items = fn()
            fetched = len(items)
            for it in items:
                h = _hash(it["source"], it["url"])
                if h in seen:
                    continue
                seen.add(h)
                it["_hash"] = h
                all_new.append(it)
                new_count += 1
        except Exception as e:
            print(f"[!] {name}: failed: {e}", file=sys.stderr)
        stats[name] = {"fetched": fetched, "new": new_count}
        print(f"  {name:5s}  fetched={fetched:5d}  new={new_count:5d}")

    payload = {
        "scraped_at": _now_iso(),
        "stats": stats,
        "items": all_new,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    save_seen(seen)
    total_fetched = sum(s["fetched"] for s in stats.values())
    print(f"\nTotal: fetched={total_fetched}  new={len(all_new)}  -> {OUT_PATH.relative_to(ROOT)}")

    status_update(
        status="scraped",
        current_step=f"Собрано {len(all_new)} новых items",
        progress_pct=100,
        items_processed=len(all_new),
        items_total=len(all_new),
        started_at=started,
        commit=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
