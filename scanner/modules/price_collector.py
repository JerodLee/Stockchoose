"""
price_collector.py — OHLCV + Pre-market Data Collector
========================================================
Collects previous-day OHLCV, pre-market price/volume, float, short
interest, and metadata for each ticker in the universe.

Data quality tags (inline comments + data_quality_warnings list):
  Premarket  : [DATA_QUALITY: DELAYED_15MIN]
  Float      : [DATA_QUALITY: APPROXIMATE]
  Short Int. : [DATA_QUALITY: DELAYED_2W]

Fallback chain: yfinance → Finnhub → Alpha Vantage
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import pytz
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

_ET       = pytz.timezone("US/Eastern")
_TIMEOUT  = 10
_RETRIES  = 3
_BATCH    = 50
_NAN_THRESHOLD = 0.30   # switch source if NaN fraction exceeds this


# ---------------------------------------------------------------------------
# Retry helper
# ---------------------------------------------------------------------------

def _retry(fn, *args, **kwargs):
    for attempt in range(_RETRIES):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:
            if attempt < _RETRIES - 1:
                time.sleep(2 ** attempt)
            else:
                raise exc


# ---------------------------------------------------------------------------
# yfinance helpers
# ---------------------------------------------------------------------------

def _fetch_premarket_yfinance(ticker: str, prev_close: float) -> dict:
    import yfinance as yf
    result: dict = {
        "premarket_price":   None,  # [DATA_QUALITY: DELAYED_15MIN]
        "premarket_volume":  None,  # [DATA_QUALITY: DELAYED_15MIN]
        "premarket_gap_pct": None,  # [DATA_QUALITY: DELAYED_15MIN]
    }
    try:
        df = _retry(
            yf.download,
            ticker,
            period="1d",
            interval="1m",
            prepost=True,
            auto_adjust=True,
            progress=False,
        )
        if df is None or df.empty:
            return result
        # Localise index to US/Eastern
        if df.index.tz is None:
            df.index = df.index.tz_localize("UTC").tz_convert(_ET)
        else:
            df.index = df.index.tz_convert(_ET)
        now_et = datetime.now(_ET)
        market_open = now_et.replace(hour=9, minute=30, second=0, microsecond=0)
        pre = df[df.index < market_open]
        if pre.empty:
            return result

        close_col = pre["Close"] if "Close" in pre.columns else pre.iloc[:, 0]
        vol_col   = pre["Volume"] if "Volume" in pre.columns else None

        pm_price  = float(close_col.dropna().iloc[-1])
        pm_volume = int(vol_col.sum()) if vol_col is not None else 0
        pm_gap    = ((pm_price / prev_close) - 1) * 100 if prev_close else None

        result["premarket_price"]   = pm_price   # [DATA_QUALITY: DELAYED_15MIN]
        result["premarket_volume"]  = pm_volume  # [DATA_QUALITY: DELAYED_15MIN]
        result["premarket_gap_pct"] = pm_gap     # [DATA_QUALITY: DELAYED_15MIN]
    except Exception as exc:
        logger.warning("yfinance premarket error for %s: %s", ticker, exc)
    return result


def _fetch_yfinance(ticker: str) -> Optional[dict]:
    import yfinance as yf
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        hist = _retry(t.history, period="31d", auto_adjust=True)
        if hist.empty:
            return None

        # NaN check
        nan_frac = hist["Close"].isna().mean()
        if nan_frac > _NAN_THRESHOLD:
            logger.warning("%s yfinance NaN fraction %.0f%% — switching", ticker, nan_frac * 100)
            return None

        prev_close  = float(hist["Close"].dropna().iloc[-1])
        prev_open   = float(hist["Open"].dropna().iloc[-1])
        prev_high   = float(hist["High"].dropna().iloc[-1])
        prev_low    = float(hist["Low"].dropna().iloc[-1])
        prev_volume = int(hist["Volume"].dropna().iloc[-1])
        avg_vol_30d = float(hist["Volume"].dropna().mean())

        premarket = _fetch_premarket_yfinance(ticker, prev_close)
        pm_volume = premarket.get("premarket_volume") or 0

        return {
            "ticker":          ticker,
            "prev_close":      prev_close,
            "prev_open":       prev_open,
            "prev_high":       prev_high,
            "prev_low":        prev_low,
            "prev_volume":     prev_volume,
            "avg_volume_30d":  avg_vol_30d,
            "float_shares":    info.get("floatShares"),          # [DATA_QUALITY: APPROXIMATE]
            "short_interest_pct": info.get("shortPercentOfFloat"),  # [DATA_QUALITY: DELAYED_2W]
            "days_to_cover":   info.get("shortRatio"),           # [DATA_QUALITY: DELAYED_2W]
            "market_cap":      info.get("marketCap"),
            "sector":          info.get("sector", ""),
            "industry":        info.get("industry", ""),
            "premarket_price":   premarket.get("premarket_price"),
            "premarket_volume":  pm_volume,
            "premarket_gap_pct": premarket.get("premarket_gap_pct"),
            "premarket_velocity": (pm_volume / avg_vol_30d) if avg_vol_30d else None,
            "source": "yfinance",
        }
    except Exception as exc:
        logger.warning("yfinance fetch error for %s: %s", ticker, exc)
        return None


# ---------------------------------------------------------------------------
# Finnhub fallback
# ---------------------------------------------------------------------------

def _fetch_premarket_finnhub(ticker: str, api_key: str, prev_close: float) -> dict:
    result = {"premarket_price": None, "premarket_volume": None, "premarket_gap_pct": None}
    try:
        import finnhub
        client = finnhub.Client(api_key=api_key)
        quote = client.quote(ticker)
        if not quote:
            return result
        current = quote.get("c") or quote.get("pc")
        if current and prev_close:
            result["premarket_price"]   = current  # [DATA_QUALITY: DELAYED_15MIN]
            result["premarket_gap_pct"] = ((current / prev_close) - 1) * 100
    except Exception as exc:
        logger.warning("Finnhub premarket error for %s: %s", ticker, exc)
    return result


def _fetch_finnhub(ticker: str) -> Optional[dict]:
    api_key = os.getenv("FINNHUB_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        import finnhub
        client = finnhub.Client(api_key=api_key)
        quote = _retry(client.quote, ticker)
        if not quote or not quote.get("pc"):
            return None
        basics = _retry(client.company_basic_financials, ticker, "all")
        metric = (basics or {}).get("metric", {})
        prev_close = float(quote["pc"])
        premarket  = _fetch_premarket_finnhub(ticker, api_key, prev_close)
        pm_volume  = premarket.get("premarket_volume") or 0
        avg_vol    = metric.get("10DayAverageTradingVolume", 0) or 0
        avg_vol_shares = avg_vol * 1_000  # reported in thousands
        return {
            "ticker":          ticker,
            "prev_close":      prev_close,
            "prev_open":       None,
            "prev_high":       quote.get("h"),
            "prev_low":        quote.get("l"),
            "prev_volume":     None,
            "avg_volume_30d":  avg_vol_shares,
            "float_shares":    metric.get("shareFloat"),         # [DATA_QUALITY: APPROXIMATE]
            "short_interest_pct": metric.get("shortInterestSharesFloat"),  # [DATA_QUALITY: DELAYED_2W]
            "days_to_cover":   metric.get("shortInterestDaysToCover"),     # [DATA_QUALITY: DELAYED_2W]
            "market_cap":      metric.get("marketCapitalization"),
            "sector":          "",
            "industry":        "",
            "premarket_price":   premarket.get("premarket_price"),
            "premarket_volume":  pm_volume,
            "premarket_gap_pct": premarket.get("premarket_gap_pct"),
            "premarket_velocity": (pm_volume / avg_vol_shares) if avg_vol_shares else None,
            "source": "finnhub",
        }
    except Exception as exc:
        logger.warning("Finnhub fetch error for %s: %s", ticker, exc)
        return None


# ---------------------------------------------------------------------------
# Alpha Vantage fallback
# ---------------------------------------------------------------------------

def _fetch_alpha_vantage(ticker: str) -> Optional[dict]:
    api_key = os.getenv("ALPHA_VANTAGE_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        import requests
        url = (
            f"https://www.alphavantage.co/query"
            f"?function=GLOBAL_QUOTE&symbol={ticker}&apikey={api_key}"
        )
        r = requests.get(url, timeout=_TIMEOUT)
        r.raise_for_status()
        data = r.json().get("Global Quote", {})
        price_str = data.get("05. price")
        prev_str  = data.get("08. previous close")
        if not price_str:
            return None
        price      = float(price_str)
        prev_close = float(prev_str) if prev_str else price
        return {
            "ticker":          ticker,
            "prev_close":      prev_close,
            "prev_open":       float(data.get("02. open", 0) or 0) or None,
            "prev_high":       float(data.get("03. high", 0) or 0) or None,
            "prev_low":        float(data.get("04. low", 0) or 0) or None,
            "prev_volume":     int(float(data.get("06. volume", 0) or 0)) or None,
            "avg_volume_30d":  None,
            "float_shares":    None,  # [DATA_QUALITY: APPROXIMATE]
            "short_interest_pct": None,  # [DATA_QUALITY: DELAYED_2W]
            "days_to_cover":   None,  # [DATA_QUALITY: DELAYED_2W]
            "market_cap":      None,
            "sector":          "",
            "industry":        "",
            "premarket_price":   price,  # [DATA_QUALITY: DELAYED_15MIN]
            "premarket_volume":  None,
            "premarket_gap_pct": ((price / prev_close) - 1) * 100 if prev_close else None,
            "premarket_velocity": None,
            "source": "alpha_vantage",
        }
    except Exception as exc:
        logger.warning("Alpha Vantage error for %s: %s", ticker, exc)
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_with_fallback(ticker: str) -> Optional[dict]:
    """Fetch ticker data with yfinance → Finnhub → Alpha Vantage fallback."""
    data = _fetch_yfinance(ticker)
    if data is None:
        data = _fetch_finnhub(ticker)
    if data is None:
        data = _fetch_alpha_vantage(ticker)
    if data is None:
        return None

    # Build data_quality_warnings list
    warnings: list[str] = []
    if data.get("premarket_price") is not None:
        warnings.append("DELAYED_15MIN")   # [DATA_QUALITY: DELAYED_15MIN]
    if data.get("float_shares") is not None:
        warnings.append("APPROXIMATE")     # [DATA_QUALITY: APPROXIMATE]
    if data.get("short_interest_pct") is not None:
        warnings.append("DELAYED_2W")      # [DATA_QUALITY: DELAYED_2W]
    data["data_quality_warnings"] = warnings
    return data


def collect(tickers: list[str]) -> pd.DataFrame:
    """Collect data for all tickers; return a DataFrame with one row per ticker."""
    rows: list[dict] = []
    for i, ticker in enumerate(tickers):
        try:
            row = fetch_with_fallback(ticker)
            if row:
                rows.append(row)
        except Exception as exc:
            logger.warning("collect error for %s: %s", ticker, exc)
        if (i + 1) % _BATCH == 0:
            logger.info("Collected %d / %d tickers", i + 1, len(tickers))

    if not rows:
        logger.warning("collect: no data returned for any ticker")
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    # Forward/backward fill numeric columns
    num_cols = df.select_dtypes(include="number").columns
    df[num_cols] = df[num_cols].ffill().bfill()
    logger.info("collect: DataFrame shape %s", df.shape)
    return df


def get_top_movers(df: pd.DataFrame, n: int = 50) -> pd.DataFrame:
    """Return top n tickers sorted by premarket_gap_pct descending."""
    if df.empty or "premarket_gap_pct" not in df.columns:
        return df
    valid = df.dropna(subset=["premarket_gap_pct"])
    return valid.nlargest(n, "premarket_gap_pct").reset_index(drop=True)
