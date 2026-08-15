"""
report_generator.py — Report Generation & Formatting
======================================================
Applies diversity filters, sorts candidates, and formats
display-ready dicts for the Streamlit UI.

Public API
----------
generate(candidates, regime)     -> list[dict]
format_report(candidate)         -> dict
get_entry_condition(candidate)   -> str
get_entry_forbidden(candidate)   -> str
no_candidates_message()          -> str
export_csv(candidates)           -> str
"""

from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

DIVERSITY_LIMIT = {"same_theme": 3, "same_sector": 4}

_DISCLAIMER = "⚠️ 최종 매수 판단은 사용자 책임입니다."

_ENTRY_CONDITION: dict[str, str] = {
    "TYPE_A": "프리마켓 갭 확인 후 첫 눌림 시 분할 진입",
    "TYPE_B": "실적 발표 후 갭 안정화 확인, VWAP 위 유지 시 진입",
    "TYPE_C": "FDA 결과 발표 후 첫 양봉 확인 시 진입",
    "TYPE_D": "장 시작 후 10분 고점 돌파 시 진입",
    "TYPE_E": "뉴스 발표 직후 1분봉 강세 확인 시 진입",
    "TYPE_F": "프리마켓 거래량 급증 확인 후 시가 돌파 시 진입",
}

_ENTRY_FORBIDDEN: dict[str, str] = {
    "TYPE_A": "숏 스퀴즈 이미 완료 신호(거래량 급감) 시 진입 금지",
    "TYPE_B": "갭 하락 반전 시 진입 금지",
    "TYPE_C": "FDA 결과 부정적일 경우 즉시 관망",
    "TYPE_D": "QQQ 급락 시 진입 금지",
    "TYPE_E": "뉴스 출처 미확인(RUMOR) 시 진입 금지",
    "TYPE_F": "프리마켓 거래량 < 50,000주 시 절대 진입 금지",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_str(val, default: str = "—") -> str:
    if val is None:
        return default
    s = str(val).strip()
    return s if s else default


def _build_kill_switch_display(candidate: dict) -> tuple[str, dict]:
    """Return (kill_switch_result string, kill_switch_details dict)."""
    ks = candidate.get("kill_switch", {})
    if not ks:
        return "—", {}

    passed = ks.get("passed", True)
    hard   = ks.get("hard_kill", {})
    soft   = ks.get("soft_kill", {})
    details: dict = {}

    if hard.get("has_hard_kill"):
        details["SEC 공시 필터"] = f"❌ {hard.get('kill_category', '')} — {hard.get('kill_reason', '')}"
    else:
        details["SEC 공시 필터"] = "✅"

    if soft.get("has_soft_kill"):
        details["거래량/갭 필터"] = f"❌ {soft.get('soft_kill_reason', '')}"
    else:
        details["거래량/갭 필터"] = "✅"

    result_str = "✅ 통과" if passed else f"❌ {ks.get('details', '필터 차단')}"
    return result_str, details


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate(candidates: list[dict], regime: str = "NEUTRAL") -> list[dict]:
    """
    Apply diversity filter, stamp regime, sort by total_score.

    Returns filtered list (empty list if no candidates).
    """
    if not candidates:
        return []
    try:
        # Stamp regime on each candidate
        for c in candidates:
            c["regime"] = regime

        # Sort descending by total_score
        sorted_cands = sorted(
            candidates,
            key=lambda c: float(c.get("total_score", 0)),
            reverse=True,
        )

        # Diversity filter
        theme_count:  dict[str, int] = {}
        sector_count: dict[str, int] = {}
        result: list[dict] = []

        for c in sorted_cands:
            theme  = c.get("primary", "UNKNOWN")
            sector = c.get("sector", "UNKNOWN") or "UNKNOWN"

            if theme_count.get(theme, 0) >= DIVERSITY_LIMIT["same_theme"]:
                continue
            if sector_count.get(sector, 0) >= DIVERSITY_LIMIT["same_sector"]:
                continue

            theme_count[theme]   = theme_count.get(theme, 0) + 1
            sector_count[sector] = sector_count.get(sector, 0) + 1
            result.append(c)

        return result
    except Exception as exc:
        logger.error("generate error: %s", exc)
        return []


def format_report(candidate: dict) -> dict:
    """Return a Streamlit-ready display dict for *candidate*."""
    try:
        primary   = _safe_str(candidate.get("primary"), "UNKNOWN")
        secondary = candidate.get("secondary")
        type_display = f"{primary}/{secondary}" if secondary and secondary != primary else primary

        raw_conf = candidate.get("confidence", 0.0)
        try:
            conf_val = float(raw_conf)
            if conf_val <= 1.0:
                conf_pct = f"{int(conf_val * 100)}%"
            else:
                conf_pct = f"{int(conf_val)}%"
        except (TypeError, ValueError):
            conf_pct = "—"

        kill_str, kill_details = _build_kill_switch_display(candidate)

        warnings_raw = candidate.get("data_quality_warnings", [])
        if isinstance(warnings_raw, list):
            data_quality_warnings = ", ".join(str(w) for w in warnings_raw if w)
        else:
            data_quality_warnings = _safe_str(warnings_raw, "")

        return {
            "ticker":               _safe_str(candidate.get("ticker")),
            "type_display":         type_display,
            "grade":                _safe_str(candidate.get("grade"), "C"),
            "score":                round(float(candidate.get("total_score", 0)), 1),
            "confidence":           conf_pct,
            "regime":               _safe_str(candidate.get("regime"), "NEUTRAL"),
            "kill_switch_result":   kill_str,
            "data_quality_warnings": data_quality_warnings,
            "news_summary":         _safe_str(candidate.get("news_summary"), "뉴스 없음"),
            "entry_condition":      get_entry_condition(candidate),
            "entry_forbidden":      get_entry_forbidden(candidate),
            "kill_switch_details":  kill_details,
            "disclaimer":           _DISCLAIMER,
        }
    except Exception as exc:
        logger.error("format_report error for %s: %s", candidate.get("ticker"), exc)
        return {
            "ticker":               _safe_str(candidate.get("ticker"), "UNKNOWN"),
            "type_display":         "UNKNOWN",
            "grade":                "C",
            "score":                0.0,
            "confidence":           "0%",
            "regime":               "NEUTRAL",
            "kill_switch_result":   "❌ 오류",
            "data_quality_warnings": "",
            "news_summary":         "뉴스 없음",
            "entry_condition":      "",
            "entry_forbidden":      "",
            "kill_switch_details":  {},
            "disclaimer":           _DISCLAIMER,
        }


def get_entry_condition(candidate: dict) -> str:
    primary = candidate.get("primary", "TYPE_E")
    condition = _ENTRY_CONDITION.get(primary)
    if not condition:
        logger.warning("get_entry_condition: unknown type %s", primary)
    return condition or "진입 조건 정보 없음"


def get_entry_forbidden(candidate: dict) -> str:
    primary = candidate.get("primary", "TYPE_E")
    forbidden = _ENTRY_FORBIDDEN.get(primary)
    if not forbidden:
        logger.warning("get_entry_forbidden: unknown type %s", primary)
    return forbidden or "진입 금지 조건 정보 없음"


def no_candidates_message() -> str:
    return "오늘은 조건에 부합하는 강한 급등 후보가 없습니다."


def export_csv(candidates: list[dict]) -> str:
    """Return a UTF-8-BOM CSV string for Streamlit download."""
    if not candidates:
        return "﻿"
    try:
        import pandas as pd

        rows: list[dict] = []
        for c in candidates:
            flat: dict = {}
            for k, v in c.items():
                if isinstance(v, dict):
                    for sub_k, sub_v in v.items():
                        flat[f"{k}.{sub_k}"] = sub_v
                elif isinstance(v, list):
                    flat[k] = ", ".join(str(x) for x in v)
                else:
                    flat[k] = v
            rows.append(flat)

        df = pd.DataFrame(rows)
        # Drop raw news list if present
        for col in list(df.columns):
            if col == "news":
                df = df.drop(columns=["news"])
        return "﻿" + df.to_csv(index=False)
    except Exception as exc:
        logger.error("export_csv error: %s", exc)
        return "﻿"
