"""Tiny shared helper for writing live status.json and committing it."""
from __future__ import annotations

import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATUS_PATH = ROOT / "enghub-main" / "public" / "data" / "status.json"
STATUS_PATH.parent.mkdir(parents=True, exist_ok=True)


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def write_status(**fields) -> None:
    """Merge fields into status.json (always sets updated_at)."""
    cur: dict = {}
    if STATUS_PATH.exists():
        try:
            cur = json.loads(STATUS_PATH.read_text(encoding="utf-8")) or {}
        except Exception:
            cur = {}
    cur.update({k: v for k, v in fields.items() if v is not None})
    cur["updated_at"] = _now_iso()
    STATUS_PATH.write_text(json.dumps(cur, ensure_ascii=False, indent=2), encoding="utf-8")


def commit_status(message: str = "chore(parsing): status update") -> None:
    """Commit + push status.json. Soft-fails outside CI / no remote."""
    if os.environ.get("PARSING_NO_COMMIT") == "1":
        return
    try:
        subprocess.run(["git", "add", str(STATUS_PATH)], cwd=ROOT, check=False)
        r = subprocess.run(
            ["git", "diff", "--cached", "--quiet", "--", str(STATUS_PATH)],
            cwd=ROOT, check=False,
        )
        if r.returncode == 0:
            return  # no changes staged
        subprocess.run(["git", "commit", "-m", message], cwd=ROOT, check=False,
                       capture_output=True)
        subprocess.run(["git", "pull", "--rebase", "--autostash", "origin", "main"],
                       cwd=ROOT, check=False, capture_output=True)
        subprocess.run(["git", "push", "origin", "HEAD:main"], cwd=ROOT, check=False,
                       capture_output=True)
    except Exception as e:  # noqa
        print(f"[status] commit failed: {e}")


def update(status: str, current_step: str = "", progress_pct: int = 0,
           items_processed: int = 0, items_total: int = 0,
           error: str | None = None, started_at: str | None = None,
           commit: bool = True, **extra) -> None:
    payload = {
        "status": status,
        "current_step": current_step,
        "progress_pct": int(progress_pct),
        "items_processed": int(items_processed),
        "items_total": int(items_total),
        "error": error,
    }
    if started_at:
        payload["started_at"] = started_at
    payload.update(extra)
    write_status(**payload)
    if commit:
        commit_status(f"chore(parsing): status={status} {current_step}".strip())


def begin(step: str, total: int = 0) -> str:
    """Initialize a fresh status doc and return the started_at iso."""
    started = _now_iso()
    write_status(
        status="scraping",
        started_at=started,
        current_step=step,
        progress_pct=0,
        items_processed=0,
        items_total=total,
        error=None,
    )
    commit_status(f"chore(parsing): begin {step}")
    return started
