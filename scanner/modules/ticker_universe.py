"""
Gate 0 - Ticker Universe Builder
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
Price/volume     : last close >= $0.50, avg dollar vol >= $1M
                   (fast 2-day check, capped at _MAX_UNIVERSE tickers)

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

_NASDAQ_URL    = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt"
_OTHER_URL     = "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt"
_CACHE_PATH    = Path("/tmp/_ticker_universe_cache.pkl")
_CACHE_TTL     = timedelta(hours=4)
_ET            = pytz.timezone("US/Eastern")
_PRICE_MIN     = 0.50
_VOL_MIN       = 1_000_000.0   # avg daily dollar volume
_BATCH         = 200           # tickers per yfinance call (2-day period is fast)
_MAX_UNIVERSE  = 1500          # cap -- price_collector handles per-ticker fetching
_TIMEOUT       = 15
_RETRIES       = 3
_VALID_EX      = {"A", "N", "P", "Z"}
_BAD_SYM_RE    = re.compile(r"[$^]")


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
        symbol = parts[0].strip()
        etf    = parts[5].strip().upper()
        test   = parts[7].strip().upper() if len(parts) > 7 else ""
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
    """
    Fast filter: download only 2 days of OHLCV data per batch.
    Checks last close >= $0.50 and last day's dollar volume >= $1M.
    Caps total universe at _MAX_UNIVERSE to keep scan times reasonable.
    """
    passed: list[str] = []
    total = min(len(tickers), _MAX_UNIVERSE)
    candidates = tickers[:total]

    for i in range(0, total, _BATCH):
        batch = candidates[i : i + _BATCH]
        logger.info(
            "Price/vol filter: batch %d-%d / %d",
            i + 1, min(i + _BATCH, total), total,
        )
        try:
            raw = yf.download(
                batch,
                period="2d",
                auto_adjust=True,
                progress=False,
                threads=True,
            )
            if raw is None or raw.empty:
                passed.extend(batch)
                continue

            cols = raw.columns
            if hasattr(cols, "get_level_values"):
                has_multi = len(cols.get_level_values(0).unique()) > 1
            else:
                has_multi = False

            if has_multi:
                close_df  = raw["Close"]
                volume_df = raw["Volume"]
            else:
                close_df  = raw[["Close"]].rename(columns={"Close": batch[0]})
                volume_df = raw[["Volume"]].rename(columns={"Volume": batch[0]})

            for sym in batch:
                try:
                    if sym not in close_df.columns:
                        continue
                    close_s = close_df[sym].dropna()
                    if close_s.empty:
                        continue
                    last_close = float(close_s.iloc[-1])
                    if last_close < _PRICE_MIN:
                        continue
                    if sym in volume_df.columns:
                        vol_s = volume_df[sym].dropna()
                        if not vol_s.empty:
                            last_vol = float(vol_s.iloc[-1])
                            if last_close * last_vol < _VOL_MIN:
                                continue
                    passed.append(sym)
                except Exception:
                    continue
        except Exception as exc:
            logger.warning("Price/volume filter batch %d failed: %s", i, exc)
            passed.extend(batch)

        if len(passed) >= _MAX_UNIVERSE:
            break

    return passed[:_MAX_UNIVERSE]


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

    tickers = list(dict.fromkeys(tickers))
    logger.info("Total after dedup: %d tickers (capping at %d for filter)", len(tickers), _MAX_UNIVERSE)

    if not tickers:
        logger.error("Universe build failed -- both listing files unavailable")
        return []

    logger.info("Applying fast price/volume filter (2-day data, cap %d)...", _MAX_UNIVERSE)
    tickers = _apply_price_volume_filter(tickers)
    logger.info("Universe after filter: %d tickers", len(tickers))

    _save_cache(tickers)
    return tickers


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    universe = get_universe()
    print(f"Universe size: {len(universe)}")
    print("First 20:", universe[:20])
