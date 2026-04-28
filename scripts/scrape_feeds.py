#!/usr/bin/env python3
"""Scrape 6 free sources for the daily automation-feed pipeline.

Sources: Hacker News (Algolia), Habr (RSS), vc.ru (RSS),
ProductHunt (RSS), IndieHackers (RSS), StackOverflow (API).

For each item we collect: id, source, source_label, url, title, text,
timestamp, lang. A hash of (source|url) is stored in data/seen.json so the
same post is emitted only once across days. New items go to data/raw_items.json.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Callable

import requests

try:
    import feedparser  # type: ignore
except ImportError:  # pragma: no cover
    print("ERROR: feedparser not installed (pip install feedparser)", file=sys.stderr)
    sys.exit(2)


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)
SEEN_PATH = DATA_DIR / "seen.json"
OUT_PATH = DATA_DIR / "raw_items.json"

UA = "automation-feed-bot/1.0 (+github.com/andyrbek2709-tech/ai-institut)"
HEADERS = {"User-Agent": UA, "Accept": "*/*"}
TIMEOUT = 25


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


def fetch_hn() -> list:
    url = "https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=100"
    r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    out = []
    for h in r.json().get("hits", []):
        story_id = h.get("objectID")
        title = (h.get("title") or h.get("story_title") or "").strip()
        if not story_id or not title:
            continue
        link = h.get("url") or f"https://news.ycombinator.com/item?id={story_id}"
        text = _strip_html(h.get("story_text") or h.get("comment_text") or "")
        out.append({
            "id": f"hn-{story_id}",
            "source": "hn",
            "source_label": "Hacker News",
            "url": link,
            "title": title,
            "text": text,
            "timestamp": _safe_iso(h.get("created_at")),
            "lang": "en",
        })
    return out


def _fetch_rss(rss_url, source, label, lang, id_prefix):
    feed = feedparser.parse(rss_url, request_headers=HEADERS)
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
            "text": text[:4000],
            "timestamp": ts,
            "lang": lang,
        })
    return out


def fetch_habr():
    return _fetch_rss("https://habr.com/ru/rss/all/?fl=ru&limit=50", "habr", "Habr", "ru", "habr")


def fetch_vc():
    return _fetch_rss("https://vc.ru/rss/all", "vc", "vc.ru", "ru", "vc")


def fetch_ph():
    return _fetch_rss("https://www.producthunt.com/feed", "ph", "ProductHunt", "en", "ph")


def fetch_ih():
    return _fetch_rss("https://www.indiehackers.com/feed.xml", "ih", "IndieHackers", "en", "ih")


def fetch_so():
    url = ("https://api.stackexchange.com/2.3/questions"
           "?site=stackoverflow&order=desc&sort=activity"
           "&tagged=automation;workflow&pagesize=50&filter=withbody")
    r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    out = []
    for q in r.json().get("items", []):
        qid = q.get("question_id")
        title = _strip_html(q.get("title") or "")
        if not qid or not title:
            continue
        body = _strip_html(q.get("body") or "")
        out.append({
            "id": f"so-{qid}",
            "source": "so",
            "source_label": "Stack Overflow",
            "url": q.get("link") or f"https://stackoverflow.com/q/{qid}",
            "title": title,
            "text": body[:4000],
            "timestamp": _safe_iso(q.get("creation_date")),
            "lang": "en",
        })
    return out


FETCHERS = [
    ("hn",   fetch_hn),
    ("habr", fetch_habr),
    ("vc",   fetch_vc),
    ("ph",   fetch_ph),
    ("ih",   fetch_ih),
    ("so",   fetch_so),
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
    seen = load_seen()
    all_new = []
    stats = {}

    for name, fn in FETCHERS:
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
            time.sleep(1.5)  # polite throttle between sources
        except Exception as e:
            print(f"[!] {name}: failed: {e}", file=sys.stderr)
        stats[name] = {"fetched": fetched, "new": new_count}
        print(f"  {name:5s}  fetched={fetched:4d}  new={new_count:4d}")

    payload = {
        "scraped_at": _now_iso(),
        "stats": stats,
        "items": all_new,
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    save_seen(seen)
    total_fetched = sum(s["fetched"] for s in stats.values())
    print(f"\nTotal: fetched={total_fetched}  new={len(all_new)}  -> {OUT_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
