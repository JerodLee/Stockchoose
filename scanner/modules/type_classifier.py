"""
type_classifier.py — 6-Type Score-Based Routing
================================================
Computes independent scores for TYPE_A through TYPE_F,
then uses sorted rank (not if-elif chains) to assign
primary and secondary types.

Public API
----------
classify(ticker, price_data, news_data) -> dict
"""

from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

_SECONDARY_MIN_SCORE = 50.0
_SECONDARY_MAX_GAP   = 20.0

GRADE_MAP = [
    (90, "A+"),
    (80, "A"),
    (70, "B+"),
    (60, "B"),
    (0,  "C"),
]


# ---------------------------------------------------------------------------
# Regime helper (lazy import to avoid circular)
# ---------------------------------------------------------------------------

def _get_regime() -> str:
    try:
        from modules import market_regime
        return market_regime.get_regime()
    except Exception:
        return "NEUTRAL"


def _apply_regime_multiplier(score: float, type_name: str, regime: str) -> float:
    try:
        from modules import market_regime
        return market_regime.apply_regime_multiplier(score, type_name, regime)
    except Exception:
        return score


# ---------------------------------------------------------------------------
# Score helpers
# ---------------------------------------------------------------------------

def _safe_float(val) -> float:
    try:
        return float(val or 0)
    except (TypeError, ValueError):
        return 0.0


def _clamp(val: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, val))


def _news_has_catalyst(news: list[dict], catalyst: str) -> bool:
    return any(a.get("catalyst_type") == catalyst for a in news)


def _best_catalyst_multiplier(news: list[dict]) -> float:
    if not news:
        return 0.0
    return max((a.get("catalyst_multiplier", 0.0) for a in news), default=0.0)


# ---------------------------------------------------------------------------
# Per-type scorers
# ---------------------------------------------------------------------------

def _score_type_a(price: dict, news: list[dict]) -> float:
    """TYPE_A — 저시총 숏스퀴즈형"""
    score = 0.0
    si = _safe_float(price.get("short_interest_pct")) * 100  # stored as 0–1 fraction
    if si == 0:
        si = _safe_float(price.get("short_interest_pct"))    # already in %
    if si > 40:
        score += 40
    elif si > 20:
        score += 25
    elif si > 10:
        score += 10

    dtc = _safe_float(price.get("days_to_cover"))
    if dtc > 10:
        score += 30
    elif dtc > 5:
        score += 20
    elif dtc > 2:
        score += 10

    fl = _safe_float(price.get("float_shares"))
    if fl > 0:
        if fl < 1_000_000:
            score += 30
        elif fl < 5_000_000:
            score += 20
        elif fl < 20_000_000:
            score += 10

    return _clamp(score)


def _score_type_b(price: dict, news: list[dict]) -> float:
    """TYPE_B — 실적 갭상승형"""
    score = 0.0
    has_earn = _news_has_catalyst(news, "EARNINGS_BEAT")
    if has_earn:
        score += 60
        gap = _safe_float(price.get("premarket_gap_pct"))
        if gap > 10:
            score += 20
        vel = _safe_float(price.get("premarket_velocity"))
        if vel > 3:
            score += 20
    return _clamp(score)


def _score_type_c(price: dict, news: list[dict]) -> float:
    """TYPE_C — 바이오 임상형"""
    score = 0.0
    if _news_has_catalyst(news, "FDA_APPROVAL"):
        score += 80
    keywords = {
        "phase 3": 15, "phase iii": 15,
        "phase 2": 10, "phase ii": 10,
        "pdufa": 20,
        "fda": 10,
    }
    all_text = " ".join(
        (a.get("headline", "") + " " + a.get("summary", "")).lower()
        for a in news
    )
    for kw, pts in keywords.items():
        if kw in all_text:
            score += pts
    return _clamp(score)


def _score_type_d(price: dict, news: list[dict], regime: str) -> float:
    """TYPE_D — AI/테마 확산형"""
    score = 0.0
    sector = str(price.get("sector", "")).lower()
    if "technology" in sector or "communication" in sector:
        score += 20

    vel = _safe_float(price.get("premarket_velocity"))
    if vel > 2:
        score += 20

    ai_keywords = {"ai", "artificial intelligence", "machine learning", "chatgpt"}
    all_text = " ".join(
        (a.get("headline", "") + " " + a.get("summary", "")).lower()
        for a in news
    )
    if any(kw in all_text for kw in ai_keywords):
        score += 30

    regime_pts = {"RISK_ON": 15, "NEUTRAL": 10, "RISK_OFF": 0}
    score += regime_pts.get(regime, 0)

    return _clamp(score)


def _score_type_e(price: dict, news: list[dict]) -> float:
    """TYPE_E — 뉴스 촉매형"""
    score = 0.0
    best_mult = _best_catalyst_multiplier(news)
    mult_pts = {1.5: 60, 1.4: 45, 1.3: 30, 1.1: 20, 1.0: 10}
    for threshold, pts in sorted(mult_pts.items(), reverse=True):
        if best_mult >= threshold:
            score += pts
            break

    positive_count = sum(
        1 for a in news if _safe_float(a.get("sentiment_score", 0)) > 0
    )
    if positive_count > 3:
        score += 25
    elif positive_count > 1:
        score += 15

    gap = _safe_float(price.get("premarket_gap_pct"))
    if gap > 5:
        score += 15

    return _clamp(score)


def _score_type_f(price: dict, news: list[dict]) -> float:
    """TYPE_F — 저Float 초고변동성형"""
    score = 0.0
    fl = _safe_float(price.get("float_shares"))
    if fl > 0:
        if fl < 500_000:
            score += 50
        elif fl < 1_000_000:
            score += 35
        elif fl < 2_000_000:
            score += 25
        elif fl < 5_000_000:
            score += 10

    pm_vol = _safe_float(price.get("premarket_volume"))
    if fl > 0 and pm_vol > 0:
        rotation = pm_vol / fl
        if rotation > 0.5:
            score += 30
        elif rotation > 0.2:
            score += 20
        elif rotation > 0.1:
            score += 10

    gap = _safe_float(price.get("premarket_gap_pct"))
    if gap > 20:
        score += 20

    return _clamp(score)


# ---------------------------------------------------------------------------
# Grade mapping
# ---------------------------------------------------------------------------

def _grade(score: float) -> str:
    for threshold, label in GRADE_MAP:
        if score >= threshold:
            return label
    return "C"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def classify(ticker: str, price_data: dict, news_data: list[dict]) -> dict:
    """
    Classify *ticker* into primary/secondary types using Score-based Routing.

    Returns
    -------
    {primary, secondary, scores, grade, total_score, confidence}
    """
    regime = _get_regime()
    news   = news_data or []
    price  = price_data or {}

    # Compute all 6 independent raw scores
    raw_scores: dict[str, float] = {}
    for type_key, scorer in [
        ("TYPE_A", lambda: _score_type_a(price, news)),
        ("TYPE_B", lambda: _score_type_b(price, news)),
        ("TYPE_C", lambda: _score_type_c(price, news)),
        ("TYPE_D", lambda: _score_type_d(price, news, regime)),
        ("TYPE_E", lambda: _score_type_e(price, news)),
        ("TYPE_F", lambda: _score_type_f(price, news)),
    ]:
        try:
            raw_scores[type_key] = scorer()
        except Exception as exc:
            logger.warning("Score error for %s / %s: %s", ticker, type_key, exc)
            raw_scores[type_key] = 0.0

    # Score-based routing — NO if-elif chains
    sorted_types = sorted(raw_scores.items(), key=lambda kv: kv[1], reverse=True)
    primary_type, primary_raw = sorted_types[0]
    second_type,  second_raw  = sorted_types[1]

    # Apply regime multiplier to primary score
    try:
        total_score = _apply_regime_multiplier(primary_raw, primary_type, regime)
    except Exception as exc:
        logger.warning("Regime multiplier error: %s", exc)
        total_score = primary_raw
    total_score = _clamp(total_score)

    # Secondary only if close enough and above threshold
    secondary_type: Optional[str] = None
    if second_raw >= _SECONDARY_MIN_SCORE and (primary_raw - second_raw) <= _SECONDARY_MAX_GAP:
        secondary_type = second_type

    confidence = _clamp((primary_raw - (second_raw if secondary_type else 0.0)) / 100.0, 0.0, 1.0)

    return {
        "primary":     primary_type,
        "secondary":   secondary_type,
        "scores":      raw_scores,
        "grade":       _grade(total_score),
        "total_score": round(total_score, 1),
        "confidence":  round(confidence, 3),
    }
