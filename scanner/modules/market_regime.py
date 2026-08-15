"""
market_regime.py — Market Regime Detector
==========================================
Classifies current market conditions as RISK_ON / NEUTRAL / RISK_OFF
using VIX, QQQ, IWM, and BTC price data.

Public API
----------
get_regime()            -> str   ("RISK_ON" | "NEUTRAL" | "RISK_OFF")
get_regime_details()    -> dict  (raw indicator values + regime)
apply_regime_multiplier(score, type_name, regime) -> float
"""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Optional

import pytz
import yfinance as yf

logger = logging.getLogger(__name__)

_ET = pytz.timezone("US/Eastern")
_CACHE_TTL_SEC = 30 * 60  # 30 minutes

REGIME_MULTIPLIER = {
    "TYPE_A": {"RISK_ON": 1.00, "NEUTRAL": 1.00, "RISK_OFF": 0.95},
    "TYPE_B": {"RISK_ON": 1.00, "NEUTRAL": 0.95, "RISK_OFF": 0.85},
    "TYPE_C": {"RISK_ON": 1.00, "NEUTRAL": 0.95, "RISK_OFF": 0.90},
    "TYPE_D": {"RISK_ON": 1.00, "NEUTRAL": 0.85, "RISK_OFF": 0.70},
    "TYPE_E": {"RISK_ON": 1.00, "NEUTRAL": 0.90, "RISK_OFF": 0.80},
    "TYPE_F": {"RISK_ON": 1.00, "NEUTRAL": 1.00, "RISK_OFF": 0.90},
}

_cache: dict = {}
_cache_time: float = 0.0


# ---------------------------------------------------------------------------
# Indicator fetchers
# ---------------------------------------------------------------------------

def _fetch_vix() -> Optional[float]:
    try:
        df = yf.download("^VIX", period="5d", auto_adjust=True, progress=False)
        if df.empty:
            return None
        close = df["Close"] if "Close" in df.columns else df.iloc[:, 0]
        return float(close.dropna().iloc[-1])
    except Exception as exc:
        logger.warning("VIX fetch failed: %s", exc)
        return None


def _fetch_5d_return(ticker: str) -> Optional[float]:
    try:
        df = yf.download(ticker, period="15d", auto_adjust=True, progress=False)
        if df.empty:
            return None
        close = df["Close"] if "Close" in df.columns else df.iloc[:, 0]
        close = close.dropna()
        if len(close) < 6:
            logger.warning("%s: not enough rows for 5-day return", ticker)
            return None
        return float((close.iloc[-1] / close.iloc[-6] - 1) * 100)
    except Exception as exc:
        logger.warning("%s 5d-return fetch failed: %s", ticker, exc)
        return None


def _fetch_btc_1d() -> Optional[float]:
    try:
        df = yf.download("BTC-USD", period="5d", auto_adjust=True, progress=False)
        if df.empty:
            return None
        close = df["Close"] if "Close" in df.columns else df.iloc[:, 0]
        close = close.dropna()
        if len(close) < 2:
            return None
        return float((close.iloc[-1] / close.iloc[-2] - 1) * 100)
    except Exception as exc:
        logger.warning("BTC fetch failed: %s", exc)
        return None


def _compute_regime(
    vix: Optional[float],
    qqq_5d: Optional[float],
    iwm_5d: Optional[float],
    btc_1d: Optional[float],
) -> str:
    # RISK_OFF first (stronger condition)
    if vix is not None and vix > 30:
        return "RISK_OFF"
    if qqq_5d is not None and iwm_5d is not None:
        if qqq_5d < -3.0 and iwm_5d < -3.0:
            return "RISK_OFF"
    # RISK_ON
    if (vix is not None and vix < 20
            and qqq_5d is not None and qqq_5d > 0
            and iwm_5d is not None and iwm_5d > 0):
        return "RISK_ON"
    return "NEUTRAL"


def _refresh_cache() -> None:
    global _cache, _cache_time
    try:
        vix    = _fetch_vix()
        qqq_5d = _fetch_5d_return("QQQ")
        iwm_5d = _fetch_5d_return("IWM")
        btc_1d = _fetch_btc_1d()
        regime = _compute_regime(vix, qqq_5d, iwm_5d, btc_1d)
        _cache = {
            "vix":       vix,
            "qqq_5d":    qqq_5d,
            "iwm_5d":    iwm_5d,
            "btc_1d":    btc_1d,
            "regime":    regime,
            "fetched_at": datetime.now(_ET).isoformat(),
        }
        _cache_time = time.monotonic()
        logger.info("Regime: %s (VIX=%.1f)", regime, vix or 0)
    except Exception as exc:
        logger.error("Regime refresh failed: %s", exc)
        _cache = {"regime": "NEUTRAL", "fetched_at": datetime.now(_ET).isoformat()}
        _cache_time = time.monotonic()


def _ensure_fresh() -> None:
    if not _cache or (time.monotonic() - _cache_time) > _CACHE_TTL_SEC:
        _refresh_cache()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_regime() -> str:
    """Return current market regime: RISK_ON / NEUTRAL / RISK_OFF."""
    try:
        _ensure_fresh()
        return _cache.get("regime", "NEUTRAL")
    except Exception as exc:
        logger.error("get_regime error: %s", exc)
        return "NEUTRAL"


def get_regime_details() -> dict:
    """Return dict with raw indicator values and current regime."""
    try:
        _ensure_fresh()
        return dict(_cache)
    except Exception as exc:
        logger.error("get_regime_details error: %s", exc)
        return {"regime": "NEUTRAL"}


def apply_regime_multiplier(score: float, type_name: str, regime: str) -> float:
    """Multiply score by the regime-specific multiplier for the given type."""
    try:
        multiplier = REGIME_MULTIPLIER.get(type_name, {}).get(regime, 1.0)
        return score * multiplier
    except Exception as exc:
        logger.warning("apply_regime_multiplier error: %s", exc)
        return score
