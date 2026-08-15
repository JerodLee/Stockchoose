"""
news_collector.py — Finnhub News Collector
===========================================
Fetches, deduplicates, and classifies company news.

Public API
----------
get_news(ticker, hours_back=24) -> list[dict]
get_news_summary(ticker)        -> str
"""

from __future__ import annotations

import difflib
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

CATALYST_MULTIPLIER: dict[str, float] = {
    "FDA_APPROVAL":   1.5,
    "MA_DEAL":        1.5,
    "GUIDANCE_RAISE": 1.5,
    "MAJOR_CONTRACT": 1.4,
    "EARNINGS_BEAT":  1.3,
    "SHORT_REBUTTAL": 1.1,
    "MOU":            1.0,
    "RUMOR":          0.8,
    "TECHNICAL":      0.5,
}

_POSITIVE_WORDS = {
    "beat", "beats", "surges", "rally", "rallies", "upgraded", "upgrade",
    "record", "growth", "profit", "approval", "approved", "award", "win",
    "strong", "exceeds", "raises", "raised",
}
_NEGATIVE_WORDS = {
    "miss", "misses", "drops", "falls", "downgrade", "loss", "losses",
    "cut", "reduces", "delay", "delayed", "recall", "warning", "concern",
    "below", "decline", "declined", "weak",
}

_ET_OFFSET = timedelta(hours=-4)  # EDT fallback
_FINNHUB_CLIENT: Optional[object] = None


def _get_client():
    global _FINNHUB_CLIENT
    if _FINNHUB_CLIENT is not None:
        return _FINNHUB_CLIENT
    api_key = os.getenv("FINNHUB_API_KEY", "").strip()
    if not api_key:
        logger.warning("FINNHUB_API_KEY not set — news unavailable")
        return None
    try:
        import finnhub
        _FINNHUB_CLIENT = finnhub.Client(api_key=api_key)
        return _FINNHUB_CLIENT
    except Exception as exc:
        logger.error("Finnhub client init failed: %s", exc)
        return None


def _now_et() -> datetime:
    try:
        import pytz
        return datetime.now(pytz.timezone("US/Eastern"))
    except Exception:
        return datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=-4)))


def _classify_catalyst(headline: str, summary: str) -> tuple[str, float]:
    text = (headline + " " + summary).lower()
    if any(k in text for k in ("fda", "approval", "approved", "clearance", "pdufa", "nda", "bla")):
        return "FDA_APPROVAL", CATALYST_MULTIPLIER["FDA_APPROVAL"]
    if any(k in text for k in ("merger", "acquisition", "acqui", "takeover", "buyout")):
        return "MA_DEAL", CATALYST_MULTIPLIER["MA_DEAL"]
    if any(k in text for k in ("guidance", "raises guidance", "raised outlook", "raised forecast", "raises forecast")):
        return "GUIDANCE_RAISE", CATALYST_MULTIPLIER["GUIDANCE_RAISE"]
    if any(k in text for k in ("contract", "awarded", "agreement", "deal worth", "partnership")):
        return "MAJOR_CONTRACT", CATALYST_MULTIPLIER["MAJOR_CONTRACT"]
    if any(k in text for k in ("earnings", "eps", "beat", "beats estimates", "quarterly results")):
        return "EARNINGS_BEAT", CATALYST_MULTIPLIER["EARNINGS_BEAT"]
    if any(k in text for k in ("short", "squeeze", "cover", "short seller", "short interest")):
        return "SHORT_REBUTTAL", CATALYST_MULTIPLIER["SHORT_REBUTTAL"]
    if any(k in text for k in ("mou", "memorandum", "letter of intent")):
        return "MOU", CATALYST_MULTIPLIER["MOU"]
    if any(k in text for k in ("rumor", "report says", "sources say", "reportedly")):
        return "RUMOR", CATALYST_MULTIPLIER["RUMOR"]
    return "TECHNICAL", CATALYST_MULTIPLIER["TECHNICAL"]


def _sentiment_score(headline: str, summary: str) -> float:
    words = (headline + " " + summary).lower().split()
    pos = sum(1 for w in words if w in _POSITIVE_WORDS)
    neg = sum(1 for w in words if w in _NEGATIVE_WORDS)
    total = pos + neg
    if total == 0:
        return 0.0
    return max(-1.0, min(1.0, (pos - neg) / total))


def _deduplicate(articles: list[dict]) -> list[dict]:
    articles = sorted(articles, key=lambda a: a.get("datetime", ""))
    kept: list[dict] = []
    for art in articles:
        duplicate = False
        for prev in kept:
            # Title similarity
            ratio = difflib.SequenceMatcher(
                None,
                art.get("headline", ""),
                prev.get("headline", ""),
            ).ratio()
            if ratio >= 0.85:
                duplicate = True
                break
            # Same ticker within 1 hour
            try:
                t1 = datetime.fromisoformat(str(art.get("datetime", "")))
                t2 = datetime.fromisoformat(str(prev.get("datetime", "")))
                if abs((t1 - t2).total_seconds()) < 3600:
                    duplicate = True
                    break
            except Exception:
                pass
        if not duplicate:
            kept.append(art)
    return kept


def get_news(ticker: str, hours_back: int = 24) -> list[dict]:
    """Fetch, deduplicate, and classify news for *ticker*."""
    client = _get_client()
    if client is None:
        return []
    try:
        now_et  = _now_et()
        end_dt  = now_et
        start_dt = end_dt - timedelta(hours=hours_back)
        start_str = start_dt.strftime("%Y-%m-%d")
        end_str   = end_dt.strftime("%Y-%m-%d")

        raw = client.company_news(ticker, _from=start_str, to=end_str)
        time.sleep(0.1)

        if not raw:
            return []

        cutoff_ts = start_dt.timestamp()
        articles: list[dict] = []
        for item in raw:
            ts = item.get("datetime", 0)
            if ts and ts < cutoff_ts:
                continue
            headline = item.get("headline", "")
            summary  = item.get("summary", "")
            cat, mult = _classify_catalyst(headline, summary)
            sent = _sentiment_score(headline, summary)
            pub_dt = (
                datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
                if ts else ""
            )
            articles.append({
                "ticker":             ticker,
                "headline":           headline,
                "summary":            summary,
                "url":                item.get("url", ""),
                "datetime":           pub_dt,
                "source":             item.get("source", ""),
                "catalyst_type":      cat,
                "catalyst_multiplier": mult,
                "sentiment_score":    sent,
            })

        return _deduplicate(articles)

    except Exception as exc:
        logger.error("get_news error for %s: %s", ticker, exc)
        return []


def get_news_summary(ticker: str) -> str:
    """Return the most recent headline for *ticker*, or '뉴스 없음'."""
    try:
        news = get_news(ticker, hours_back=24)
        if not news:
            return "뉴스 없음"
        # Sort by datetime desc, take first headline
        news_sorted = sorted(news, key=lambda a: a.get("datetime", ""), reverse=True)
        return news_sorted[0].get("headline", "뉴스 없음") or "뉴스 없음"
    except Exception as exc:
        logger.error("get_news_summary error for %s: %s", ticker, exc)
        return "뉴스 없음"
