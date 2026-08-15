# Stockchoose

미국 주식 당일 급등주 탐지 시스템 **US Momentum Surge Scanner** (Python/Streamlit) +
Next.js 프론트엔드

---

## US Momentum Surge Scanner (Python / Streamlit)

### 자동매매 단계적 접근

```
1단계: 후보 탐지 ← 현재 구현 (Phase 1 MVP)
2단계: 종이매매 (수동 검증)
3단계: 알림 매매 (Telegram)
4단계: 반자동 주문
5단계: 자동매매 (Phase 5 이후)
```

### 빠른 시작

```bash
cd scanner
pip install -r requirements.txt
cp .env.example .env      # .env 파일을 열어 API 키 입력
streamlit run app.py
```

### 환경 변수 (.env)

| 변수 | 필수 | 설명 |
|------|------|------|
| `FINNHUB_API_KEY` | 권장 | 뉴스 및 프리마켓 데이터 |
| `ALPHA_VANTAGE_API_KEY` | 선택 | 가격 데이터 3차 Fallback |
| `SEC_USER_AGENT` | 필수 | SEC EDGAR 접근용 ("AppName email@domain.com") |
| `POLYGON_API_KEY` | 선택 | 유료 실시간 데이터 |

- Finnhub 무료 키: https://finnhub.io/register
- Alpha Vantage 무료 키: https://www.alphavantage.co/support/#api-key

### 모듈 구조

```
scanner/
├── app.py                    # Streamlit UI (6개 탭)
├── requirements.txt
├── .env.example
└── modules/
    ├── ticker_universe.py    # Gate 0: NASDAQ/NYSE 유니버스 필터링
    ├── price_collector.py    # OHLCV + 프리마켓 (yfinance→Finnhub→AlphaVantage)
    ├── risk_filter.py        # Kill-Switch (SEC EDGAR RSS + 소프트 필터)
    ├── market_regime.py      # 시장 국면 (RISK_ON/NEUTRAL/RISK_OFF)
    ├── type_classifier.py    # 6대 유형 분류 + Score-based Routing
    ├── news_collector.py     # Finnhub 뉴스 + 중복제거 + Half-life 분류
    └── report_generator.py   # 후보 정렬 + 리포트 포맷팅
```

### UI 탭 구성

| 탭 | 내용 |
|----|------|
| 1. 오늘의 후보 | 메인 스캔 테이블 + CSV 다운로드 |
| 2. 실시간 신호 | Phase 2 예정 |
| 3. 종목별 상세 | 유형별 점수 상세 + 진입 조건 |
| 4. 백테스트 | Phase 2 예정 |
| 5. 일일 리포트 | 장전/장중/장후 |
| 6. 설정/API 키 | API 키 관리 |

### 메인 테이블 컬럼

```
티커 | 유형(Primary/Secondary) | 등급(A+~C) | Score | Confidence
Regime | Kill-Switch 결과 | 데이터품질경고 | 뉴스요약
```

### 6대 종목 유형

| 유형 | 명칭 | 핵심 지표 |
|------|------|----------|
| TYPE_A | 저시총 숏스퀴즈형 | Short Interest, Days to Cover, Float |
| TYPE_B | 실적 갭상승형 | EPS Surprise, Revenue Surprise |
| TYPE_C | 바이오 임상형 | FDA 단계, PDUFA 날짜 |
| TYPE_D | AI/테마 확산형 | 섹터ETF 모멘텀, 키워드 증가율 |
| TYPE_E | 뉴스 촉매형 | 뉴스 강도(Half-life), 계약 구속력 |
| TYPE_F | 저Float 초고변동성형 | Float Rotation, Free Float 절대값 |

---

## ⚠️ 면책 조항

본 시스템은 데이터 기반 후보군 탐지 도구이며 **투자 권유가 아닙니다.**
모든 투자 결정과 손익은 전적으로 사용자 본인의 책임입니다.
무료 API 데이터는 최대 20분 지연될 수 있으며 실시간 매매에 부적합합니다.

---

## Next.js Frontend

```bash
npm run dev        # http://localhost:3000
```
