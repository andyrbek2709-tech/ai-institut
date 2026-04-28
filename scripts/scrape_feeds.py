#!/usr/bin/env python3
"""Scrape ~3000–5000 raw items/day from 6 free sources.

v2 changes:
  - HN Algolia: hitsPerPage=500 + extra last-24h search
  - HN comments: async fetch /items/{id}, top-10 per story (top-level + 1st reply)
  - Habr: 5 RSS feeds, limit=200 each (TODO: comments scraping)
  - vc.ru: 4 RSS feeds (TODO: comments scraping)
  - ProductHunt + IndieHackers: full RSS body kept
  - Stack Overflow: 4 tag queries × 100 = 400 questions
  - SO answers: batched /questions/{ids}/answers, top-3 by score per question

Writes data/raw_items.json. Dedup via data/seen.json (sha256 of source|url).
Pushes live status updates to enghub-main/public/data/status.json.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import sys
import asyncio
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



# -------- HN comments (async via Algolia /items/{id}) -------- #
HN_COMMENT_CAP_PER_STORY = 10
HN_COMMENT_STORY_CAP = 150          # cap how many stories we walk
HN_COMMENT_CONCURRENCY = 10


def _make_hn_comment(c, story_id):
    cid = c.get("id")
    text = _strip_html(c.get("text") or "")
    if not text or not cid:
        return None
    title = (text[:100] + "…") if len(text) > 100 else text
    return {
        "id": f"hn-comment-{cid}",
        "source": "hn-comment",
        "source_label": "HN comment",
        "url": f"https://news.ycombinator.com/item?id={cid}",
        "parent_url": f"https://news.ycombinator.com/item?id={story_id}",
        "title": title,
        "text": text[:5000],
        "timestamp": _safe_iso(c.get("created_at")),
        "lang": "en",
    }


async def _fetch_hn_story_comments(session, sem, story_id):
    import aiohttp  # local import — only needed for async path
    url = f"https://hn.algolia.com/api/v1/items/{story_id}"
    async with sem:
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=20)) as r:
                if r.status != 200:
                    return []
                data = await r.json()
        except Exception:
            return []
    out = []
    children = data.get("children") or []
    for c in children:
        if c.get("type") != "comment":
            continue
        node = _make_hn_comment(c, story_id)
        if node:
            out.append(node)
        if len(out) >= HN_COMMENT_CAP_PER_STORY:
            break
        # one first-level reply
        for sc in (c.get("children") or [])[:1]:
            if sc.get("type") != "comment":
                continue
            sub = _make_hn_comment(sc, story_id)
            if sub:
                out.append(sub)
            break
        if len(out) >= HN_COMMENT_CAP_PER_STORY:
            break
    return out


async def _fetch_hn_comments_async(story_ids):
    import aiohttp
    sem = asyncio.Semaphore(HN_COMMENT_CONCURRENCY)
    async with aiohttp.ClientSession(headers=HEADERS) as session:
        tasks = [_fetch_hn_story_comments(session, sem, sid) for sid in story_ids]
        results = await asyncio.gather(*tasks, return_exceptions=True)
    flat = []
    for r in results:
        if isinstance(r, list):
            flat.extend(r)
    return flat


def fetch_hn_comments(story_ids: list) -> list:
    if not story_ids:
        return []
    capped = story_ids[:HN_COMMENT_STORY_CAP]
    try:
        import aiohttp  # noqa: F401  - probe availability
    except ImportError:
        print("  [hn-comment] aiohttp missing — skip", file=sys.stderr)
        return []
    return asyncio.run(_fetch_hn_comments_async(capped))


# -------- SO answers (batched, top-3 by score per question) -------- #
SO_ANSWER_CHUNK = 100


def fetch_so_answers(question_ids: list) -> list:
    if not question_ids:
        return []
    out = []
    for i in range(0, len(question_ids), SO_ANSWER_CHUNK):
        chunk = question_ids[i:i + SO_ANSWER_CHUNK]
        ids = ";".join(str(q) for q in chunk)
        url = (f"https://api.stackexchange.com/2.3/questions/{ids}/answers"
               "?site=stackoverflow&filter=withbody&order=desc&sort=votes&pagesize=100")
        try:
            r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            print(f"  [so-answer] {e}", file=sys.stderr)
            continue
        by_q: dict[int, list] = {}
        for a in data.get("items", []):
            qid = a.get("question_id")
            by_q.setdefault(qid, []).append(a)
        for qid, answers in by_q.items():
            top = sorted(answers, key=lambda x: -(x.get("score") or 0))[:3]
            for a in top:
                aid = a.get("answer_id")
                if not aid:
                    continue
                body = _strip_html(a.get("body") or "")
                if not body:
                    continue
                title = (body[:100] + "…") if len(body) > 100 else body
                out.append({
                    "id": f"so-answer-{aid}",
                    "source": "so-answer",
                    "source_label": "SO answer",
                    "url": f"https://stackoverflow.com/a/{aid}",
                    "parent_url": f"https://stackoverflow.com/q/{qid}",
                    "title": title,
                    "text": body[:5000],
                    "timestamp": _safe_iso(a.get("creation_date")),
                    "lang": "en",
                })
        time.sleep(2.0)  # respect SO rate limit
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


def _absorb(items, seen, all_new, stats_key, stats):
    fetched = len(items)
    new_count = 0
    for it in items:
        h = _hash(it["source"], it["url"])
        if h in seen:
            continue
        seen.add(h)
        it["_hash"] = h
        all_new.append(it)
        new_count += 1
    stats[stats_key] = {"fetched": fetched, "new": new_count}
    print(f"  {stats_key:11s}  fetched={fetched:5d}  new={new_count:5d}")


def main():
    total_steps = len(FETCHERS) + 2  # +HN comments +SO answers
    started = status_begin("Парсинг источников", total=total_steps)

    seen = load_seen()
    all_new = []
    stats = {}
    hn_story_ids: list = []
    so_question_ids: list = []

    for idx, (name, label, fn) in enumerate(FETCHERS):
        status_update(
            status="scraping",
            current_step=f"Источник {idx+1}/{total_steps}: {label}",
            progress_pct=int(idx / total_steps * 100),
            items_processed=len(all_new),
            items_total=0,
            started_at=started,
            commit=True,
        )
        try:
            items = fn()
            if name == "hn":
                hn_story_ids = [it["id"].replace("hn-", "", 1) for it in items if it.get("id", "").startswith("hn-")]
            elif name == "so":
                so_question_ids = [it["id"].replace("so-", "", 1) for it in items if it.get("id", "").startswith("so-")]
            _absorb(items, seen, all_new, name, stats)
        except Exception as e:
            print(f"[!] {name}: failed: {e}", file=sys.stderr)
            stats[name] = {"fetched": 0, "new": 0}

    # ---- Follow-up: HN comments ---- #
    step_idx = len(FETCHERS)
    status_update(
        status="scraping",
        current_step=f"Источник {step_idx+1}/{total_steps}: HN comments ({min(len(hn_story_ids), HN_COMMENT_STORY_CAP)} stories)",
        progress_pct=int(step_idx / total_steps * 100),
        items_processed=len(all_new),
        items_total=0,
        started_at=started,
        commit=True,
    )
    try:
        hn_comments = fetch_hn_comments(hn_story_ids)
        _absorb(hn_comments, seen, all_new, "hn-comment", stats)
    except Exception as e:
        print(f"[!] hn-comment: failed: {e}", file=sys.stderr)
        stats["hn-comment"] = {"fetched": 0, "new": 0}

    # ---- Follow-up: SO answers ---- #
    step_idx += 1
    status_update(
        status="scraping",
        current_step=f"Источник {step_idx+1}/{total_steps}: SO answers ({len(so_question_ids)} qs)",
        progress_pct=int(step_idx / total_steps * 100),
        items_processed=len(all_new),
        items_total=0,
        started_at=started,
        commit=True,
    )
    try:
        so_answers = fetch_so_answers(so_question_ids)
        _absorb(so_answers, seen, all_new, "so-answer", stats)
    except Exception as e:
        print(f"[!] so-answer: failed: {e}", file=sys.stderr)
        stats["so-answer"] = {"fetched": 0, "new": 0}

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
