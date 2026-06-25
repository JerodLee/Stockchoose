// 1주(약 7일) 코인 롱숏 트렌드 편향 산출 로직.
//
// 설계 원칙:
//  - "정확히 맞추는 예측기"가 아니라 "확률적 편향"을 출력한다. 1주 horizon의
//    방향 적중률은 구조적으로 50~55%가 한계이므로, 확률처럼 보이는 % 신뢰도 대신
//    "지표 합의도(서수) + 강도(서수)"만 제시한다. (캘리브레이션되지 않은 수치를
//    퍼센트로 표기하지 않는다.)
//  - 데이터 소스와 분리한다. 이 파일은 순수 계산만 담당하며, 입력만 바꾸면
//    라이브/백테스트가 동일하게 동작한다. (백테스트가 라이브 모델을 그대로 검증)
//  - 모든 입력은 일별 과거 데이터로 재현 가능한 것만 사용한다. (도미넌스·OI 제외)

export const HORIZON_DAYS = 7;

// ── 모델 상수 (정규화·포화 임계) ────────────────────────────────
// 경험적 근거가 약한 손튜닝 값들이므로 한곳에 모아 명시·조정 가능하게 둔다.
export const MODEL_CONFIG = {
  trendSlopeSatPct: 6, // 20EMA 5봉 기울기 ±6%에서 포화
  trendMaSatPct: 15, // 200일선 대비 위치 ±15%에서 포화
  rsiSat: 25, // RSI 50±25에서 포화
  rsiExtremeDamp: 0.5, // RSI>80 또는 <20이면 절반 감쇠(되돌림 위험)
  macdSatPct: 1, // MACD히스토그램/가격 ±1%에서 포화
  fundingSat: 0.0005, // 펀딩비 0.05%에서 포화
  fundingCrowded: 0.0003, // 0.03% 초과면 쏠림 경고
  fgSat: 50, // F&G 50±50 (즉 0~100 전체)
  flowSat: 0.08, // 테이커매수비율 0.5±0.08(42~58%)에서 포화
  regimeDampMax: 0.6, // 추세가 최대일 때 역신호를 최대 60% 감쇠
} as const;

export interface WeightConfig {
  trend: number;
  momentum: number;
  funding: number;
  sentiment: number;
  flow: number;
}

export interface Thresholds {
  /** |score| 이 값 이상이면 LONG/SHORT */
  long: number;
  /** |score| 이 값 이상이면 STRONG LONG/SHORT */
  strongLong: number;
}

export interface Preset {
  key: string;
  label: string;
  desc: string;
  weights: WeightConfig;
  thresholds: Thresholds;
}

// 프리셋: 가중치 합은 항상 1.
export const PRESETS: Record<string, Preset> = {
  balanced: {
    key: 'balanced',
    label: '균형',
    desc: '추세·역신호 균형 (기본값)',
    weights: { trend: 0.3, momentum: 0.2, funding: 0.2, sentiment: 0.15, flow: 0.15 },
    thresholds: { long: 15, strongLong: 40 },
  },
  trend: {
    key: 'trend',
    label: '추세추종',
    desc: '추세·모멘텀 중시, 역신호 약화',
    weights: { trend: 0.4, momentum: 0.25, funding: 0.1, sentiment: 0.1, flow: 0.15 },
    thresholds: { long: 12, strongLong: 35 },
  },
  meanrev: {
    key: 'meanrev',
    label: '역추세',
    desc: '펀딩·심리 역신호 중시 (평균회귀)',
    weights: { trend: 0.2, momentum: 0.15, funding: 0.3, sentiment: 0.25, flow: 0.1 },
    thresholds: { long: 18, strongLong: 45 },
  },
};

export const DEFAULT_PRESET = 'balanced';

export interface ForecastOptions {
  weights?: WeightConfig;
  thresholds?: Thresholds;
}

/** 하위호환: 기본 가중치 */
export const WEIGHTS: WeightConfig = PRESETS.balanced.weights;

export type Bias = 'STRONG LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG SHORT';
export type Direction = 'up' | 'down' | 'flat' | 'warn';
export type Strength = 'low' | 'med' | 'high';

export interface IndicatorView {
  key: keyof WeightConfig;
  label: string;
  /** 부호 있는 기여도, -1 ~ +1 */
  value: number;
  direction: Direction;
  detail: string;
}

/**
 * 확신도(서수). 퍼센트가 아니라 "몇 개 지표가 같은 방향인가 + 점수 강도"만 제시한다.
 * 이 값은 적중 확률이 아니다(캘리브레이션되지 않음).
 */
export interface Conviction {
  /** 합성 방향과 같은 부호인 지표 수 (0~5) */
  agree: number;
  total: number;
  /** |score| 기반 강도 */
  strength: Strength;
}

export interface ForecastResult {
  bias: Bias;
  /** -100 ~ +100 (+ 롱 / - 숏) */
  score: number;
  conviction: Conviction;
  horizonDays: number;
  indicators: IndicatorView[];
  /** 종가 이탈 시 시나리오가 깨지는 가격 */
  invalidation: number | null;
}

export interface IndicatorInputs {
  /** 일봉 종가, 오래된→최신 순. 200개 권장 */
  closes: number[];
  highs: number[];
  lows: number[];
  /** 최근 일봉들의 (테이커 매수량 / 전체 거래량) 비율, 0~1 */
  takerBuyRatios: number[];
  /** 최근 펀딩비 (예: 0.0001 = 0.01%) */
  fundingRate: number;
  /** 최근 윈도우 평균 펀딩비 */
  avgFunding: number;
  /** 공포·탐욕 지수 0~100 */
  fearGreed: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ── 지표 계산 (순수 함수) ──────────────────────────────────────────

export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

export function rsi(closes: number[], period = 14): number {
  if (closes.length <= period) return 50;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** MACD 히스토그램의 최신값 (정규화 전 절대값) */
export function macdHistogram(closes: number[]): number {
  if (closes.length < 35) return 0;
  const e12 = ema(closes, 12);
  const e26 = ema(closes, 26);
  const macdLine = closes.map((_, i) => e12[i] - e26[i]);
  const signal = ema(macdLine, 9);
  const i = closes.length - 1;
  return macdLine[i] - signal[i];
}

// ── 지표별 부호 있는 기여도 (-1 ~ +1) ────────────────────────────

function trendIndicator(inp: IndicatorInputs): IndicatorView {
  const { closes } = inp;
  const last = closes[closes.length - 1];
  const e20 = ema(closes, 20);
  const ma200 =
    closes.length >= 200
      ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200
      : closes.reduce((a, b) => a + b, 0) / closes.length;

  const slopeRef = e20[Math.max(0, e20.length - 6)];
  const slopePct = slopeRef ? ((e20[e20.length - 1] - slopeRef) / slopeRef) * 100 : 0;
  const maPct = ma200 ? ((last - ma200) / ma200) * 100 : 0;

  const slopeScore = clamp(slopePct / MODEL_CONFIG.trendSlopeSatPct, -1, 1);
  const maScore = clamp(maPct / MODEL_CONFIG.trendMaSatPct, -1, 1);
  const value = clamp(0.6 * slopeScore + 0.4 * maScore, -1, 1);

  return {
    key: 'trend',
    label: '추세',
    value,
    direction: value > 0.15 ? 'up' : value < -0.15 ? 'down' : 'flat',
    detail: `20EMA ${slopePct >= 0 ? '+' : ''}${slopePct.toFixed(1)}% · 200MA ${
      maPct >= 0 ? '위 +' : '아래 '
    }${maPct.toFixed(1)}%`,
  };
}

function momentumIndicator(inp: IndicatorInputs): IndicatorView {
  const { closes } = inp;
  const r = rsi(closes, 14);
  const hist = macdHistogram(closes);
  const last = closes[closes.length - 1] || 1;

  let rsiScore = clamp((r - 50) / MODEL_CONFIG.rsiSat, -1, 1);
  if (r > 80 || r < 20) rsiScore *= MODEL_CONFIG.rsiExtremeDamp;
  const histScore = clamp((hist / last) * 100 / MODEL_CONFIG.macdSatPct, -1, 1);
  const value = clamp(0.6 * rsiScore + 0.4 * histScore, -1, 1);

  return {
    key: 'momentum',
    label: '모멘텀',
    value,
    direction: value > 0.15 ? 'up' : value < -0.15 ? 'down' : 'flat',
    detail: `RSI ${r.toFixed(0)} · MACD ${hist >= 0 ? '+' : '-'}`,
  };
}

function fundingIndicator(inp: IndicatorInputs): IndicatorView {
  const { fundingRate, avgFunding } = inp;
  // 펀딩비 역신호: 롱이 과하게 쏠리면(펀딩 높음) 청산 위험 → 점수 차감.
  const blended = 0.5 * fundingRate + 0.5 * avgFunding;
  const value = -clamp(blended / MODEL_CONFIG.fundingSat, -1, 1);

  const crowded = Math.abs(blended) > MODEL_CONFIG.fundingCrowded;
  return {
    key: 'funding',
    label: '펀딩',
    value,
    direction: crowded ? 'warn' : value > 0.15 ? 'up' : value < -0.15 ? 'down' : 'flat',
    detail: `펀딩 ${(blended * 100).toFixed(3)}%`,
  };
}

function sentimentIndicator(inp: IndicatorInputs): IndicatorView {
  const { fearGreed } = inp;
  // 공포·탐욕은 극단에서 평균회귀(역신호): 극공포→롱(+), 극탐욕→숏(-).
  const value = clamp((50 - fearGreed) / MODEL_CONFIG.fgSat, -1, 1);

  return {
    key: 'sentiment',
    label: '심리',
    value,
    direction: value > 0.15 ? 'up' : value < -0.15 ? 'down' : 'flat',
    detail: `F&G ${fearGreed.toFixed(0)} (${
      fearGreed >= 75 ? '극탐욕' : fearGreed >= 55 ? '탐욕' : fearGreed >= 45 ? '중립' : fearGreed >= 25 ? '공포' : '극공포'
    })`,
  };
}

function flowIndicator(inp: IndicatorInputs): IndicatorView {
  const { takerBuyRatios } = inp;
  const avg =
    takerBuyRatios.length > 0
      ? takerBuyRatios.reduce((a, b) => a + b, 0) / takerBuyRatios.length
      : 0.5;
  // 테이커 매수/매도 압력. 온체인 순입출금이 아니라 선물 체결 기준 압력임에 주의.
  const value = clamp((avg - 0.5) / MODEL_CONFIG.flowSat, -1, 1);

  return {
    key: 'flow',
    label: '매수압력',
    value,
    direction: value > 0.15 ? 'up' : value < -0.15 ? 'down' : 'flat',
    detail: `테이커 매수 ${(avg * 100).toFixed(1)}%`,
  };
}

// ── 합성 ──────────────────────────────────────────────────────

function biasFromScore(score: number, th: Thresholds): Bias {
  if (score >= th.strongLong) return 'STRONG LONG';
  if (score >= th.long) return 'LONG';
  if (score <= -th.strongLong) return 'STRONG SHORT';
  if (score <= -th.long) return 'SHORT';
  return 'NEUTRAL';
}

function computeInvalidation(inp: IndicatorInputs, score: number): number | null {
  const { highs, lows } = inp;
  if (highs.length < 7 || lows.length < 7) return null;
  if (score > 0) return Math.min(...lows.slice(-7));
  if (score < 0) return Math.max(...highs.slice(-7));
  return null;
}

// 레짐 필터: 추세가 강할 때, 추세에 "맞서는" 역신호(펀딩·심리)만 감쇠한다.
// (강세장에서 펀딩이 수개월 양수로 유지되는 식의 오신호를 줄임)
function dampenAgainstTrend(ind: IndicatorView, trendValue: number): IndicatorView {
  const opposes = Math.sign(ind.value) !== 0 && Math.sign(ind.value) !== Math.sign(trendValue);
  if (!opposes) return ind;
  const factor = 1 - MODEL_CONFIG.regimeDampMax * Math.abs(trendValue);
  return { ...ind, value: ind.value * factor };
}

export function computeForecast(inp: IndicatorInputs, opts: ForecastOptions = {}): ForecastResult {
  const weights = opts.weights ?? PRESETS[DEFAULT_PRESET].weights;
  const thresholds = opts.thresholds ?? PRESETS[DEFAULT_PRESET].thresholds;

  const trend = trendIndicator(inp);
  const momentum = momentumIndicator(inp);
  const funding = dampenAgainstTrend(fundingIndicator(inp), trend.value);
  const sentiment = dampenAgainstTrend(sentimentIndicator(inp), trend.value);
  const flow = flowIndicator(inp);
  const indicators: IndicatorView[] = [trend, momentum, funding, sentiment, flow];

  const raw = indicators.reduce((acc, ind) => acc + weights[ind.key] * ind.value, 0);
  const score = Math.round(clamp(raw * 100, -100, 100));
  const bias = biasFromScore(score, thresholds);

  // 확신도(서수, 확률 아님): 합성 방향과 같은 부호인 지표 수 + 점수 강도.
  const dir = Math.sign(score);
  const agree =
    dir === 0 ? 0 : indicators.filter((ind) => Math.sign(ind.value) === dir).length;
  const absScore = Math.abs(score);
  const strength: Strength =
    bias === 'NEUTRAL' || absScore < 25 ? 'low' : absScore < 50 ? 'med' : 'high';

  return {
    bias,
    score,
    conviction: { agree, total: indicators.length, strength },
    horizonDays: HORIZON_DAYS,
    indicators,
    invalidation: computeInvalidation(inp, score),
  };
}
