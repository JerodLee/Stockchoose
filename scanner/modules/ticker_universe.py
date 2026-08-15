"""
Gate 0 – Ticker Universe Builder
=================================
Produces a filtered list of liquid US common-stock tickers before any
momentum computation begins, preventing wasted API calls downstream.

Sources
-------
* https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt
* https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt

Filters applied
---------------
nasdaqlisted.txt : drops ETF=Y, Test Issue=Y, symbols with $ or ^
otherlisted.txt  : same + Exchange must be in {A, N, P, Z}
Price/volume     : last close >= $0.50, 30-day avg dollar volume >= $1 M

Results are cached as a pickle file for 4 hours.
"""

from __future__ import annotations

import io
import logging
import pickle
import re
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import pytz
import requests
import yfinance as yf

logger = logging.getLogger(__name__)

_NASDAQ_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt"
_OTHER_URL  = "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt"
_CACHE_PATH = Path("/tmp/_ticker_universe_cache.pkl")
_CACHE_TTL  = timedelta(hours=4)
_ET         = pytz.timezone("US/Eastern")
_PRICE_MIN  = 0.50
_VOL_MIN    = 1_000_000.0
_BATCH      = 100
_TIMEOUT    = 10
_RETRIES    = 3
_VALID_EX   = {"A", "N", "P", "Z"}
_BAD_SYM_RE = re.compile(r"[\$\^]")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _fetch_url(url: str) -> Optional[str]:
    for attempt in range(_RETRIES):
        try:
            r = requests.get(url, timeout=_TIMEOUT, headers={"User-Agent": "Mozilla/5.0"})
            r.raise_for_status()
            return r.text
        except Exception as exc:
            if attempt < _RETRIES - 1:
                time.sleep(2 ** attempt)
            else:
                logger.error("Failed to fetch %s after %d retries: %s", url, _RETRIES, exc)
    return None


def _parse_nasdaq_listed(text: str) -> list[str]:
    tickers: list[str] = []
    for line in io.StringIO(text):
        line = line.strip()
        if not line or line.startswith("Symbol") or "File Creation Time" in line:
            continue
        parts = line.split("|")
        if len(parts) < 6:
            continue
        symbol   = parts[0].strip()
        etf      = parts[5].strip().upper()
        test     = parts[7].strip().upper() if len(parts) > 7 else ""
        if etf == "Y" or test == "Y":
            continue
        if _BAD_SYM_RE.search(symbol):
            continue
        tickers.append(symbol)
    return tickers


def _parse_other_listed(text: str) -> list[str]:
    tickers: list[str] = []
    for line in io.StringIO(text):
        line = line.strip()
        if not line or line.startswith("ACT") or "File Creation Time" in line:
            continue
        parts = line.split("|")
        if len(parts) < 6:
            continue
        symbol   = parts[0].strip()
        exchange = parts[3].strip().upper()
        etf      = parts[5].strip().upper()
        if etf == "Y" or exchange not in _VALID_EX:
            continue
        if _BAD_SYM_RE.search(symbol):
            continue
        tickers.append(symbol)
    return tickers


def _apply_price_volume_filter(tickers: list[str]) -> list[str]:
    passed: list[str] = []
    for i in range(0, len(tickers), _BATCH):
        batch = tickers[i : i + _BATCH]
        try:
            raw = yf.download(
                batch,
                period="31d",
                auto_adjust=True,
                progress=False,
                threads=True,
            )
            close_df = raw["Close"] if "Close" in raw.columns.get_level_values(0) else raw
            if close_df.empty:
                continue
            for sym in batch:
                try:
                    if sym not in close_df.columns:
                        continue
                    s = close_df[sym].dropna()
                    if s.empty:
                        continue
                    last_close = float(s.iloc[-1])
                    if last_close < _PRICE_MIN:
                        continue
                    vol_col = raw["Volume"][sym] if "Volume" in raw.columns.get_level_values(0) else None
                    if vol_col is not None:
                        avg_vol = vol_col.dropna().mean()
                        avg_dollar = float(last_close * avg_vol)
                        if avg_dollar < _VOL_MIN:
                            continue
                    passed.append(sym)
                except Exception:
                    continue
        except Exception as exc:
            logger.warning("Price/volume filter batch %d failed: %s", i, exc)
            passed.extend(batch)  # include on error to avoid over-exclusion
    return passed


def _load_cache() -> Optional[list[str]]:
    try:
        if not _CACHE_PATH.exists():
            return None
        mtime = datetime.fromtimestamp(_CACHE_PATH.stat().st_mtime, tz=pytz.utc)
        if datetime.now(pytz.utc) - mtime > _CACHE_TTL:
            return None
        with _CACHE_PATH.open("rb") as f:
            data = pickle.load(f)
        if isinstance(data, list):
            logger.info("Ticker universe loaded from cache (%d symbols)", len(data))
            return data
    except Exception as exc:
        logger.warning("Cache read failed: %s", exc)
    return None


def _save_cache(tickers: list[str]) -> None:
    try:
        with _CACHE_PATH.open("wb") as f:
            pickle.dump(tickers, f)
    except Exception as exc:
        logger.warning("Cache write failed: %s", exc)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_universe() -> list[str]:
    """Return a filtered list of tradeable US common-stock ticker symbols."""
    cached = _load_cache()
    if cached is not None:
        return cached

    tickers: list[str] = []

    nasdaq_text = _fetch_url(_NASDAQ_URL)
    if nasdaq_text:
        nasdaq_tickers = _parse_nasdaq_listed(nasdaq_text)
        tickers.extend(nasdaq_tickers)
        logger.info("NASDAQ listed: %d raw tickers", len(nasdaq_tickers))

    other_text = _fetch_url(_OTHER_URL)
    if other_text:
        other_tickers = _parse_other_listed(other_text)
        tickers.extend(other_tickers)
        logger.info("Other listed: %d raw tickers", len(other_tickers))

    tickers = list(dict.fromkeys(tickers))  # deduplicate, preserve order
    logger.info("Total after dedup: %d tickers", len(tickers))

    if not tickers:
        logger.error("Universe build failed — both listing files unavailable")
        return []

    logger.info("Applying price/volume filter…")
    tickers = _apply_price_volume_filter(tickers)
    logger.info("Universe after price/volume filter: %d tickers", len(tickers))

    _save_cache(tickers)
    return tickers


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    universe = get_universe()
    print(f"Universe size: {len(universe)}")
    print("First 20:", universe[:20])
