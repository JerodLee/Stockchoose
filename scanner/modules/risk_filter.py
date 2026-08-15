"""
risk_filter.py — Hard & Soft Kill-Switch
=========================================
Hard kill  : SEC EDGAR RSS — detects dilutive / dangerous 8-K filings.
Soft kill  : Pre-market gap / volume heuristics.

Public API
----------
poll_edgar_rss(ticker)                                             -> dict
soft_kill_check(ticker, gap_pct, pm_volume, vol_velocity)         -> dict
run_kill_switch(ticker, price_data)                               -> dict
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timedelta, timezone

import feedparser
import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

HARD_KILL_KEYWORDS: dict[str, list[str]] = {
    "reverse_split":   ["reverse split", "reverse stock split", "1-for-"],
    "atm_offering":    ["at-the-market", "ATM offering"],
    "direct_offering": ["direct offering", "registered direct", "424B5"],
    "shelf_reg":       ["shelf registration", "Form S-3"],
    "convertible":     ["convertible note", "convertible debenture"],
    "delisting":       ["delisting", "noncompliance", "below minimum bid"],
}

_EDGAR_RSS = (
    "https://www.sec.gov/cgi-bin/browse-edgar"
    "?action=getcompany&company={ticker}&type=8-K"
    "&dateb=&owner=include&count=10&search_text=&output=atom"
)
_EDGAR_EFTS = (
    "https://efts.sec.gov/LATEST/search-index"
    "?q=%22{ticker}%22&dateRange=custom&startdt={start}&enddt={end}"
    "&forms=8-K,S-3,424B5,DEF14A"
)
_TIMEOUT  = 10
_RETRIES  = 3


def _get_user_agent() -> str:
    agent = os.getenv("SEC_USER_AGENT", "").strip()
    if not agent:
        logger.warning("SEC_USER_AGENT not set; using fallback")
        agent = "StockScanner contact@example.com"
    return agent


def _get_with_retry(url: str, headers: dict) -> requests.Response | None:
    for attempt in range(_RETRIES):
        try:
            r = requests.get(url, headers=headers, timeout=_TIMEOUT)
            r.raise_for_status()
            return r
        except Exception as exc:
            if attempt < _RETRIES - 1:
                time.sleep(1)
            else:
                logger.warning("GET %s failed: %s", url, exc)
    return None


def _scan_text(text: str) -> tuple[bool, str, str]:
    """Return (matched, category, matched_phrase)."""
    lower = text.lower()
    for category, phrases in HARD_KILL_KEYWORDS.items():
        for phrase in phrases:
            if phrase.lower() in lower:
                return True, category, phrase
    return False, "", ""


def poll_edgar_rss(ticker: str) -> dict:
    """
    Poll SEC EDGAR for recent dilutive/dangerous filings for *ticker*.

    Returns
    -------
    {has_hard_kill, kill_reason, kill_category, filing_title, filing_url}
    """
    ua = _get_user_agent()
    headers = {"User-Agent": ua, "Accept-Encoding": "gzip, deflate"}

    result = {
        "has_hard_kill": False,
        "kill_reason":   "",
        "kill_category": "",
        "filing_title":  "",
        "filing_url":    "",
    }

    # --- Source 1: RSS atom feed -----------------------------------------
    try:
        url1 = _EDGAR_RSS.format(ticker=ticker)
        r = _get_with_retry(url1, headers)
        if r:
            feed = feedparser.parse(r.text)
            for entry in feed.entries:
                text = (entry.get("title", "") + " " + entry.get("summary", ""))
                hit, cat, phrase = _scan_text(text)
                if hit:
                    result.update(
                        has_hard_kill=True,
                        kill_reason=phrase,
                        kill_category=cat,
                        filing_title=entry.get("title", ""),
                        filing_url=entry.get("link", ""),
                    )
                    logger.info("Hard kill (%s) via RSS for %s: %s", cat, ticker, phrase)
                    return result
    except Exception as exc:
        logger.warning("EDGAR RSS error for %s: %s", ticker, exc)

    # --- Source 2: EFTS full-text search ---------------------------------
    try:
        today = datetime.now(timezone.utc).date()
        start = (today - timedelta(days=7)).isoformat()
        end   = today.isoformat()
        url2  = _EDGAR_EFTS.format(ticker=ticker, start=start, end=end)
        r = _get_with_retry(url2, headers)
        if r:
            data = r.json()
            hits = data.get("hits", {}).get("hits", [])
            for hit in hits:
                src = hit.get("_source", {})
                form_type = src.get("form_type", "")
                # Hard-kill on form type alone
                if form_type in ("S-3", "424B5"):
                    cat   = "shelf_reg" if form_type == "S-3" else "direct_offering"
                    title = src.get("period_of_report", form_type)
                    result.update(
                        has_hard_kill=True,
                        kill_reason=form_type,
                        kill_category=cat,
                        filing_title=title,
                        filing_url="",
                    )
                    logger.info("Hard kill (%s) via EFTS for %s", cat, ticker)
                    return result
                text = src.get("period_of_report", "") + " " + form_type
                matched, cat, phrase = _scan_text(text)
                if matched:
                    result.update(
                        has_hard_kill=True,
                        kill_reason=phrase,
                        kill_category=cat,
                        filing_title=src.get("period_of_report", ""),
                        filing_url="",
                    )
                    return result
    except Exception as exc:
        logger.warning("EDGAR EFTS error for %s: %s", ticker, exc)

    return result


def soft_kill_check(
    ticker: str,
    premarket_gap_pct: float,
    premarket_volume: int,
    volume_velocity: float,
) -> dict:
    """
    Apply soft kill-switch heuristics.

    Returns
    -------
    {has_soft_kill, soft_kill_reason}
    """
    result = {"has_soft_kill": False, "soft_kill_reason": ""}
    try:
        gap = float(premarket_gap_pct or 0)
        vol = int(premarket_volume or 0)
        vel = float(volume_velocity or 0)

        if gap > 30 and vol < 50_000:
            result.update(has_soft_kill=True, soft_kill_reason="AVOID: 유령 펌핑")
            return result
        if gap > 30 and vel < 1.5:
            result.update(has_soft_kill=True, soft_kill_reason="AVOID: 갭 대비 거래량 부족")
    except Exception as exc:
        logger.warning("soft_kill_check error for %s: %s", ticker, exc)
    return result


def run_kill_switch(ticker: str, price_data: dict) -> dict:
    """
    Run both hard and soft kill-switch checks.

    price_data keys used: premarket_gap_pct, premarket_volume, volume_velocity

    Returns
    -------
    {passed, hard_kill, soft_kill, details}
    """
    hard_result = {"has_hard_kill": False, "kill_reason": "", "kill_category": "",
                   "filing_title": "", "filing_url": ""}
    soft_result = {"has_soft_kill": False, "soft_kill_reason": ""}

    try:
        hard_result = poll_edgar_rss(ticker)
    except Exception as exc:
        logger.error("Hard kill-switch error for %s: %s", ticker, exc)

    try:
        soft_result = soft_kill_check(
            ticker,
            premarket_gap_pct=price_data.get("premarket_gap_pct", 0),
            premarket_volume=price_data.get("premarket_volume", 0),
            volume_velocity=price_data.get("premarket_velocity", 0),
        )
    except Exception as exc:
        logger.error("Soft kill-switch error for %s: %s", ticker, exc)

    passed = not hard_result["has_hard_kill"] and not soft_result["has_soft_kill"]
    detail_parts = []
    if hard_result["has_hard_kill"]:
        detail_parts.append(f"HARD: {hard_result['kill_reason']}")
    if soft_result["has_soft_kill"]:
        detail_parts.append(f"SOFT: {soft_result['soft_kill_reason']}")

    return {
        "passed":    passed,
        "hard_kill": hard_result,
        "soft_kill": soft_result,
        "details":   " | ".join(detail_parts) if detail_parts else "통과",
    }
