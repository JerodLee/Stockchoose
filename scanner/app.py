"""
US Momentum Surge Scanner — Streamlit UI
=========================================
Phase 1 MVP: 6-tab interface for detecting US stock momentum candidates.

Tabs:
  1. 오늘의 후보  — main scan table + CSV download
  2. 실시간 신호  — Phase 2 placeholder
  3. 종목별 상세  — per-ticker drill-down
  4. 백테스트     — Phase 2 placeholder
  5. 일일 리포트  — pre/intra/after-hours summary
  6. 설정/API 키  — API key management

⚠️ 본 시스템은 투자 권유가 아닙니다. 모든 투자 결정은 사용자 본인의 책임입니다.
"""

from __future__ import annotations

import logging
import os
import sys
from datetime import datetime
from pathlib import Path

import pytz
import streamlit as st
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Bootstrap — resolve scanner/ as root so sibling-module imports work
# ---------------------------------------------------------------------------
_SCANNER_DIR = Path(__file__).parent.resolve()
if str(_SCANNER_DIR) not in sys.path:
    sys.path.insert(0, str(_SCANNER_DIR))

# Load .env from scanner/ directory
load_dotenv(dotenv_path=_SCANNER_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module imports — wrapped so missing dependencies show friendly errors
# ---------------------------------------------------------------------------
_import_errors: list[str] = []

try:
    from modules import ticker_universe
except Exception as e:
    ticker_universe = None  # type: ignore
    _import_errors.append(f"ticker_universe: {e}")

try:
    from modules import price_collector
except Exception as e:
    price_collector = None  # type: ignore
    _import_errors.append(f"price_collector: {e}")

try:
    from modules import risk_filter
except Exception as e:
    risk_filter = None  # type: ignore
    _import_errors.append(f"risk_filter: {e}")

try:
    from modules import market_regime
except Exception as e:
    market_regime = None  # type: ignore
    _import_errors.append(f"market_regime: {e}")

try:
    from modules import type_classifier
except Exception as e:
    type_classifier = None  # type: ignore
    _import_errors.append(f"type_classifier: {e}")

try:
    from modules import news_collector
except Exception as e:
    news_collector = None  # type: ignore
    _import_errors.append(f"news_collector: {e}")

try:
    from modules import report_generator
except Exception as e:
    report_generator = None  # type: ignore
    _import_errors.append(f"report_generator: {e}")

# ---------------------------------------------------------------------------
# Streamlit page config
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="US Momentum Scanner",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
ET = pytz.timezone("US/Eastern")
_SCAN_LIMIT = 200   # max tickers to collect (MVP cap)
_MOVER_LIMIT = 50   # top movers to classify

_REGIME_BADGE = {
    "RISK_ON":  "🟢 RISK_ON",
    "NEUTRAL":  "🟡 NEUTRAL",
    "RISK_OFF": "🔴 RISK_OFF",
}

# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------
with st.sidebar:
    st.title("📈 US Momentum Scanner")
    st.caption("Phase 1 MVP")
    st.divider()
    st.warning(
        "⚠️ 본 시스템은 투자 권유가 아닙니다.\n"
        "모든 투자 결정은 사용자 본인의 책임입니다.\n"
        "무료 API 데이터는 최대 20분 지연될 수 있습니다."
    )
    st.divider()
    now_et = datetime.now(ET)
    st.caption(f"현재 시간 (ET): {now_et.strftime('%Y-%m-%d %H:%M:%S')}")
    if _import_errors:
        with st.expander("⚠️ 모듈 임포트 경고", expanded=False):
            for err in _import_errors:
                st.text(err)

# ---------------------------------------------------------------------------
# Session state initialisation
# ---------------------------------------------------------------------------
if "scan_results" not in st.session_state:
    st.session_state.scan_results = []       # list[dict] from format_report
if "raw_candidates" not in st.session_state:
    st.session_state.raw_candidates = []     # list[dict] raw
if "regime_details" not in st.session_state:
    st.session_state.regime_details = {}
if "scan_done" not in st.session_state:
    st.session_state.scan_done = False

# ---------------------------------------------------------------------------
# Tab layout
# ---------------------------------------------------------------------------
tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
    "1️⃣ 오늘의 후보",
    "2️⃣ 실시간 신호",
    "3️⃣ 종목별 상세",
    "4️⃣ 백테스트",
    "5️⃣ 일일 리포트",
    "6️⃣ 설정/API 키",
])

# ===========================================================================
# TAB 1 — 오늘의 후보
# ===========================================================================
with tab1:
    st.header("🔍 US Momentum Surge Scanner")
    st.caption(f"스캔 기준 시간 (ET): {datetime.now(ET).strftime('%Y-%m-%d %H:%M:%S')}")
    st.divider()

    # Regime badge row
    col_regime, col_spacer = st.columns([1, 3])
    with col_regime:
        regime_label = st.session_state.regime_details.get("regime", "—")
        st.metric("시장 국면", _REGIME_BADGE.get(regime_label, regime_label))

    st.divider()

    # Scan button
    if st.button("🚀 스캔 시작", type="primary", use_container_width=True):
        progress = st.progress(0, text="유니버스 로딩 중…")
        status_box = st.empty()

        try:
            # Step 1 — universe
            status_box.info("Step 1/5 · 티커 유니버스 구축 중…")
            progress.progress(5, text="유니버스 로딩 중…")
            if ticker_universe is None:
                st.error("ticker_universe 모듈을 불러올 수 없습니다.")
                st.stop()
            tickers: list[str] = ticker_universe.get_universe()
            if not tickers:
                st.warning("유니버스가 비어 있습니다. API 연결 및 .env를 확인하세요.")
                st.stop()
            tickers = tickers[:_SCAN_LIMIT]
            status_box.info(f"Step 1/5 완료 · {len(tickers)}개 티커 확보")
            progress.progress(15, text="가격 데이터 수집 중…")

            # Step 2 — price collection
            status_box.info("Step 2/5 · 가격/프리마켓 데이터 수집 중…")
            if price_collector is None:
                st.error("price_collector 모듈을 불러올 수 없습니다.")
                st.stop()
            df = price_collector.collect(tickers)
            if df is None or df.empty:
                st.warning("가격 데이터를 수집하지 못했습니다.")
                st.stop()
            progress.progress(40, text="시장 국면 판단 중…")

            # Step 3 — market regime
            status_box.info("Step 3/5 · 시장 국면 판단 중…")
            if market_regime is not None:
                regime_details = market_regime.get_regime_details()
                regime = regime_details.get("regime", "NEUTRAL")
            else:
                regime_details = {"regime": "NEUTRAL"}
                regime = "NEUTRAL"
            st.session_state.regime_details = regime_details
            progress.progress(50, text="종목 분류 중…")

            # Step 4 — classify top movers
            status_box.info("Step 4/5 · Kill-Switch + 유형 분류 중…")
            top_df = price_collector.get_top_movers(df, n=_MOVER_LIMIT)
            candidates_raw: list[dict] = []

            for i, (_, row) in enumerate(top_df.iterrows()):
                ticker = str(row.get("ticker", ""))
                if not ticker:
                    continue

                row_dict = row.to_dict()

                # Kill-Switch
                kill_result = {"passed": True, "hard_kill": {}, "soft_kill": {}, "details": ""}
                if risk_filter is not None:
                    try:
                        kill_result = risk_filter.run_kill_switch(ticker, row_dict)
                    except Exception as exc:
                        logger.warning("kill_switch error for %s: %s", ticker, exc)

                # News
                news: list[dict] = []
                if news_collector is not None:
                    try:
                        news = news_collector.get_news(ticker, hours_back=24)
                    except Exception as exc:
                        logger.warning("news error for %s: %s", ticker, exc)

                # Classification
                classification = {
                    "primary": "TYPE_E",
                    "secondary": None,
                    "scores": {},
                    "grade": "C",
                    "total_score": 0.0,
                    "confidence": 0.0,
                }
                if type_classifier is not None:
                    try:
                        classification = type_classifier.classify(ticker, row_dict, news)
                    except Exception as exc:
                        logger.warning("classify error for %s: %s", ticker, exc)

                # News summary
                news_summary = "뉴스 없음"
                if news_collector is not None and news:
                    try:
                        news_summary = news_collector.get_news_summary(ticker)
                    except Exception:
                        pass

                candidates_raw.append({
                    **row_dict,
                    "ticker": ticker,
                    "kill_switch": kill_result,
                    "news": news,
                    "news_summary": news_summary,
                    "sector": row_dict.get("sector", ""),
                    **classification,
                })

                frac = 50 + int(40 * (i + 1) / max(len(top_df), 1))
                progress.progress(frac, text=f"분류 중… {ticker}")

            progress.progress(90, text="리포트 생성 중…")

            # Step 5 — report generation
            status_box.info("Step 5/5 · 리포트 생성 중…")
            if report_generator is not None:
                filtered = report_generator.generate(candidates_raw, regime=regime)
                formatted = [report_generator.format_report(c) for c in filtered]
            else:
                filtered = candidates_raw
                formatted = candidates_raw

            st.session_state.raw_candidates = filtered
            st.session_state.scan_results = formatted
            st.session_state.scan_done = True

            progress.progress(100, text="완료!")
            status_box.success(f"✅ 스캔 완료 · 후보 {len(formatted)}개 발견")

        except Exception as e:
            st.error(f"스캔 중 오류 발생: {e}")
            logger.exception("Scan failed")

    # Results table
    st.divider()
    results = st.session_state.scan_results

    if not results:
        if st.session_state.scan_done:
            msg = "오늘은 조건에 부합하는 강한 급등 후보가 없습니다."
            if report_generator is not None:
                msg = report_generator.no_candidates_message()
            st.info(msg)
        else:
            st.info("위의 '스캔 시작' 버튼을 눌러 스캔을 실행하세요.")
    else:
        import pandas as pd

        display_cols = [
            "ticker", "type_display", "grade", "score",
            "confidence", "regime", "kill_switch_result",
            "data_quality_warnings", "news_summary",
        ]
        col_labels = {
            "ticker":               "티커",
            "type_display":         "유형",
            "grade":                "등급",
            "score":                "Score",
            "confidence":           "Confidence",
            "regime":               "Regime",
            "kill_switch_result":   "Kill-Switch",
            "data_quality_warnings":"데이터품질경고",
            "news_summary":         "뉴스요약",
        }

        df_display = pd.DataFrame(results)
        # Keep only columns that exist
        existing = [c for c in display_cols if c in df_display.columns]
        df_display = df_display[existing].rename(columns=col_labels)

        st.dataframe(
            df_display,
            use_container_width=True,
            hide_index=True,
            column_config={
                "티커":        st.column_config.TextColumn(width="small"),
                "유형":        st.column_config.TextColumn(width="medium"),
                "등급":        st.column_config.TextColumn(width="small"),
                "Score":       st.column_config.NumberColumn(format="%.1f", width="small"),
                "Confidence":  st.column_config.TextColumn(width="small"),
                "Regime":      st.column_config.TextColumn(width="small"),
                "Kill-Switch": st.column_config.TextColumn(width="medium"),
                "데이터품질경고": st.column_config.TextColumn(width="medium"),
                "뉴스요약":    st.column_config.TextColumn(width="large"),
            },
        )

        # CSV download
        if report_generator is not None:
            csv_data = report_generator.export_csv(st.session_state.raw_candidates)
        else:
            csv_data = df_display.to_csv(index=False)

        st.download_button(
            label="⬇️ CSV 다운로드",
            data=csv_data,
            file_name=f"momentum_scan_{datetime.now(ET).strftime('%Y%m%d_%H%M')}.csv",
            mime="text/csv",
        )

# ===========================================================================
# TAB 2 — 실시간 신호
# ===========================================================================
with tab2:
    st.header("2️⃣ 실시간 신호")
    st.info("Phase 2 구현 예정")

# ===========================================================================
# TAB 3 — 종목별 상세
# ===========================================================================
with tab3:
    st.header("3️⃣ 종목별 상세")

    results = st.session_state.scan_results
    raw = st.session_state.raw_candidates

    if not results:
        st.info("먼저 Tab 1에서 스캔을 실행하세요.")
    else:
        tickers_available = [r.get("ticker", "") for r in results if r.get("ticker")]
        selected = st.selectbox("티커 선택", tickers_available)

        if selected:
            # Find matching raw candidate
            raw_match = next((c for c in raw if c.get("ticker") == selected), None)
            fmt_match = next((r for r in results if r.get("ticker") == selected), None)

            if fmt_match:
                col1, col2, col3, col4 = st.columns(4)
                col1.metric("유형", fmt_match.get("type_display", "—"))
                col2.metric("등급", fmt_match.get("grade", "—"))
                col3.metric("Score", fmt_match.get("score", "—"))
                col4.metric("Confidence", fmt_match.get("confidence", "—"))

                st.divider()

                # Type scores breakdown
                if raw_match and raw_match.get("scores"):
                    st.subheader("📊 유형별 점수")
                    scores: dict = raw_match["scores"]
                    for type_key, score_val in sorted(scores.items()):
                        label = f"{type_key}"
                        try:
                            val = float(score_val)
                        except (TypeError, ValueError):
                            val = 0.0
                        st.progress(
                            min(val / 100.0, 1.0),
                            text=f"{label}: {val:.1f}점",
                        )

                st.divider()

                # Entry / forbidden
                col_a, col_b = st.columns(2)
                with col_a:
                    st.subheader("✅ 진입 조건")
                    st.write(fmt_match.get("entry_condition", "—"))
                with col_b:
                    st.subheader("🚫 진입 금지 조건")
                    st.write(fmt_match.get("entry_forbidden", "—"))

                st.divider()

                # Kill-switch details
                st.subheader("🔒 Kill-Switch 상세")
                ks_details = fmt_match.get("kill_switch_details", {})
                if ks_details:
                    for check, status in ks_details.items():
                        st.write(f"{status} {check}")
                else:
                    st.write(fmt_match.get("kill_switch_result", "—"))

                st.divider()

                # Data quality warnings
                dq = fmt_match.get("data_quality_warnings", "")
                if dq:
                    st.subheader("⚠️ 데이터 품질 경고")
                    st.warning(dq)

                # News
                if raw_match and raw_match.get("news"):
                    st.subheader("📰 뉴스")
                    for article in raw_match["news"][:5]:
                        with st.expander(
                            f"{article.get('catalyst_type', '')} · {article.get('headline', '')[:80]}"
                        ):
                            st.write(f"**출처:** {article.get('source', '—')}")
                            st.write(f"**발행:** {article.get('datetime', '—')}")
                            st.write(f"**Catalyst Multiplier:** {article.get('catalyst_multiplier', '—')}")
                            st.write(article.get("summary", ""))
                            if article.get("url"):
                                st.markdown(f"[기사 링크]({article['url']})")

                st.divider()
                st.caption(fmt_match.get("disclaimer", "⚠️ 최종 매수 판단은 사용자 책임입니다."))

# ===========================================================================
# TAB 4 — 백테스트
# ===========================================================================
with tab4:
    st.header("4️⃣ 백테스트")
    st.info("Phase 2 구현 예정")

# ===========================================================================
# TAB 5 — 일일 리포트
# ===========================================================================
with tab5:
    st.header("5️⃣ 일일 리포트")

    now_et = datetime.now(ET)
    hour = now_et.hour
    minute = now_et.minute
    total_min = hour * 60 + minute

    # Session boundaries (ET)
    PRE_START  = 4 * 60        # 04:00
    OPEN       = 9 * 60 + 30   # 09:30
    CLOSE      = 16 * 60       # 16:00
    AFTER_END  = 20 * 60       # 20:00

    if total_min < PRE_START or total_min >= AFTER_END:
        session_label = "장외"
    elif total_min < OPEN:
        session_label = "장전 (Pre-Market)"
    elif total_min < CLOSE:
        session_label = "장중 (Market Hours)"
    else:
        session_label = "장후 (After-Hours)"

    st.info(f"현재 세션: **{session_label}**  |  ET: {now_et.strftime('%H:%M:%S')}")
    st.divider()

    pre_tab, intra_tab, after_tab = st.tabs(["장전", "장중", "장후"])

    results = st.session_state.scan_results

    def _show_session_table(label: str):
        if not results:
            st.info("스캔 결과가 없습니다. Tab 1에서 스캔을 먼저 실행하세요.")
            return
        import pandas as pd
        df_s = pd.DataFrame(results)
        cols = ["ticker", "type_display", "grade", "score", "kill_switch_result", "news_summary"]
        existing = [c for c in cols if c in df_s.columns]
        st.dataframe(df_s[existing], use_container_width=True, hide_index=True)

    with pre_tab:
        st.subheader("📋 장전 후보 리스트")
        _show_session_table("장전")

    with intra_tab:
        st.subheader("📋 장중 모니터링 리스트")
        _show_session_table("장중")

    with after_tab:
        st.subheader("📋 장후 결과 리뷰")
        _show_session_table("장후")

# ===========================================================================
# TAB 6 — 설정/API 키
# ===========================================================================
with tab6:
    st.header("6️⃣ 설정 / API 키 관리")
    st.caption("입력한 키는 scanner/.env 파일에 저장됩니다.")
    st.divider()

    env_path = _SCANNER_DIR / ".env"

    def _read_env() -> dict[str, str]:
        kv: dict[str, str] = {}
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    kv[k.strip()] = v.strip()
        return kv

    current_env = _read_env()

    with st.form("api_key_form"):
        st.subheader("🔑 API 키")
        finnhub_key   = st.text_input("FINNHUB_API_KEY",      value=current_env.get("FINNHUB_API_KEY", ""),      type="password")
        av_key        = st.text_input("ALPHA_VANTAGE_API_KEY", value=current_env.get("ALPHA_VANTAGE_API_KEY", ""), type="password")
        sec_agent     = st.text_input("SEC_USER_AGENT",        value=current_env.get("SEC_USER_AGENT", ""),       placeholder="AppName email@example.com")
        polygon_key   = st.text_input("POLYGON_API_KEY",       value=current_env.get("POLYGON_API_KEY", ""),      type="password")
        alpaca_key    = st.text_input("ALPACA_API_KEY",        value=current_env.get("ALPACA_API_KEY", ""),       type="password")
        alpaca_secret = st.text_input("ALPACA_SECRET_KEY",     value=current_env.get("ALPACA_SECRET_KEY", ""),    type="password")

        st.divider()
        st.subheader("📡 데이터 레이어 선택")
        data_layer = st.radio(
            "데이터 소스",
            ["무료 (yfinance + Finnhub)", "유료 (Polygon.io)"],
            index=0,
        )

        submitted = st.form_submit_button("💾 저장", type="primary")

    if submitted:
        lines = [
            "# US Momentum Scanner — .env (auto-generated)",
            f"FINNHUB_API_KEY={finnhub_key}",
            f"ALPHA_VANTAGE_API_KEY={av_key}",
            f"SEC_USER_AGENT={sec_agent}",
            f"POLYGON_API_KEY={polygon_key}",
            f"ALPACA_API_KEY={alpaca_key}",
            f"ALPACA_SECRET_KEY={alpaca_secret}",
        ]
        try:
            env_path.write_text("\n".join(lines) + "\n")
            load_dotenv(dotenv_path=env_path, override=True)
            st.success("✅ API 키가 저장되었습니다. 앱을 재시작하면 반영됩니다.")
        except Exception as e:
            st.error(f"저장 실패: {e}")

    st.divider()
    st.subheader("📊 API 키 상태")

    def _status(val: str) -> str:
        return "✅ 설정됨" if val and val.strip() else "❌ 미설정"

    fresh_env = _read_env()
    status_data = {
        "키": ["FINNHUB_API_KEY", "ALPHA_VANTAGE_API_KEY", "SEC_USER_AGENT", "POLYGON_API_KEY"],
        "상태": [
            _status(fresh_env.get("FINNHUB_API_KEY", "")),
            _status(fresh_env.get("ALPHA_VANTAGE_API_KEY", "")),
            _status(fresh_env.get("SEC_USER_AGENT", "")),
            _status(fresh_env.get("POLYGON_API_KEY", "")),
        ],
    }
    import pandas as pd
    st.dataframe(pd.DataFrame(status_data), use_container_width=True, hide_index=True)

    st.divider()
    st.caption(
        "Finnhub 무료 키: https://finnhub.io/register  |  "
        "Alpha Vantage 무료 키: https://www.alphavantage.co/support/#api-key"
    )
