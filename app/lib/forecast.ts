// 1주(약 5~7일) 코인 롱숏 트렌드 편향 산출 로직.
//
// 설계 원칙:
//  - "정확히 맞추는 예측기"가 아니라 "확률적 편향 + 신뢰도 + 무효화 조건"을 출력한다.
//  - 데이터 소스(Binance 등)와 분리한다. 이 파일은 순수 계산만 담당하며,
//    입력(IndicatorInputs)만 바꾸면 시뮬레이션/실데이터 어느 쪽이든 동작한다.
//  - 5개 지표를 가중 합산해 -100 ~ +100 점수를 만든다. (+ 롱 / - 숏)

export const HORIZON_DAYS = 7;

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

/** 하위호환: 기존 기본 가중치 */
export const WEIGHTS: WeightConfig = PRESETS.balanced.weights;

export type Bias =
  | 'STRONG LONG'
  | 'LONG'
  | 'NEUTRAL'
  | 'SHORT'
  | 'STRONG SHORT';

export type Direction = 'up' | 'down' | 'flat' | 'warn';

export interface IndicatorView {
  key: keyof typeof WEIGHTS;
  label: string;
  /** 부호 있는 기여도, -1 ~ +1 */
  value: number;
  direction: Direction;
  detail: string;
}

export interface ForecastResult {
  bias: Bias;
  /** -100 ~ +100 (+ 롱 / - 숏) */
  score: number;
  /** 0 ~ 100, 지표 합의도 기반 */
  confidence: number;
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
  /** 미결제약정(OI) 변화율, % */
  oiChangePct: number;
  /** 공포·탐욕 지수 0~100 */
  fearGreed: number;
  /** 시장 코인 여부(알트는 BTC 도미넌스 상승에 불리) */
  isBitcoin: boolean;
  /** BTC 도미넌스 변화 추정치, % (양수=도미넌스 상승) */
  dominanceChange: number;
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

  // 20EMA 기울기(최근 5봉) — % 단위
  const slopeRef = e20[Math.max(0, e20.length - 6)];
  const slopePct = slopeRef ? ((e20[e20.length - 1] - slopeRef) / slopeRef) * 100 : 0;
  // 200일선 대비 위치 — % 단위
  const maPct = ma200 ? ((last - ma200) / ma200) * 100 : 0;

  // 기울기 ±6%에서, 위치 ±15%에서 포화
  const slopeScore = clamp(slopePct / 6, -1, 1);
  const maScore = clamp(maPct / 15, -1, 1);
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

  // RSI 50 기준, ±25에서 포화. 단 과열(>80)·과매도(<20)는 1주 되돌림 위험 → 절반 감쇠.
  let rsiScore = clamp((r - 50) / 25, -1, 1);
  if (r > 80 || r < 20) rsiScore *= 0.5;
  // MACD 히스토그램을 가격 대비 정규화 (±1% 에서 포화)
  const histScore = clamp((hist / last) * 100, -1, 1);
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
  const { fundingRate, avgFunding, oiChangePct } = inp;
  // 펀딩비는 역신호: 롱이 과하게 쏠리면(펀딩 높음) 청산 위험 → 점수 차감.
  // 기준 펀딩 0.01%(0.0001) 정상, 0.05%(0.0005)에서 포화.
  const blended = 0.5 * fundingRate + 0.5 * avgFunding;
  let value = -clamp(blended / 0.0005, -1, 1);
  // OI 급증 + 한쪽 쏠림이면 역신호 강화
  if (Math.abs(oiChangePct) > 8) value *= 1.2;
  value = clamp(value, -1, 1);

  const crowded = Math.abs(blended) > 0.0003;
  return {
    key: 'funding',
    label: '펀딩',
    value,
    direction: crowded ? 'warn' : value > 0.15 ? 'up' : value < -0.15 ? 'down' : 'flat',
    detail: `펀딩 ${(blended * 100).toFixed(3)}% · OI ${oiChangePct >= 0 ? '+' : ''}${oiChangePct.toFixed(1)}%`,
  };
}

function sentimentIndicator(inp: IndicatorInputs): IndicatorView {
  const { fearGreed, isBitcoin, dominanceChange } = inp;
  // 공포·탐욕은 극단에서 평균회귀(역신호): 극공포→롱(+), 극탐욕→숏(-).
  const fgScore = clamp((50 - fearGreed) / 50, -1, 1);
  // 도미넌스 상승은 알트에 불리, BTC에 유리. ±5%에서 포화, 소폭 반영.
  const domTilt = clamp(dominanceChange / 5, -1, 1) * (isBitcoin ? 0.25 : -0.25);
  const value = clamp(0.8 * fgScore + domTilt, -1, 1);

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
  // 0.5 기준 매수/매도 압력. ±0.08 (42%~58%)에서 포화.
  const value = clamp((avg - 0.5) / 0.08, -1, 1);

  return {
    key: 'flow',
    label: '흐름',
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
  if (score > 0) {
    // 롱 시나리오: 최근 7봉 저점 이탈 시 무효화
    return Math.min(...lows.slice(-7));
  }
  if (score < 0) {
    // 숏 시나리오: 최근 7봉 고점 돌파 시 무효화
    return Math.max(...highs.slice(-7));
  }
  return null;
}

export function computeForecast(inp: IndicatorInputs, opts: ForecastOptions = {}): ForecastResult {
  const weights = opts.weights ?? PRESETS[DEFAULT_PRESET].weights;
  const thresholds = opts.thresholds ?? PRESETS[DEFAULT_PRESET].thresholds;

  const indicators: IndicatorView[] = [
    trendIndicator(inp),
    momentumIndicator(inp),
    fundingIndicator(inp),
    sentimentIndicator(inp),
    flowIndicator(inp),
  ];

  const raw = indicators.reduce((acc, ind) => acc + weights[ind.key] * ind.value, 0);
  const score = Math.round(clamp(raw * 100, -100, 100));
  const bias = biasFromScore(score, thresholds);

  // 신뢰도 = 합의도(같은 방향 지표 가중치 합) + 점수 강도.
  // 의도적으로 보수적(주로 50~75) — 1주 예측의 한계를 UI에 반영.
  const dir = Math.sign(score);
  const agree =
    dir === 0
      ? 0
      : indicators.reduce(
          (a, ind) => a + (Math.sign(ind.value) === dir ? weights[ind.key] : 0),
          0,
        );
  const strength = clamp(Math.abs(score) / 60, 0, 1);
  const confidence = clamp(Math.round(35 + agree * 45 + strength * 20), 5, 95);

  return {
    bias,
    score,
    confidence: bias === 'NEUTRAL' ? Math.min(confidence, 45) : confidence,
    horizonDays: HORIZON_DAYS,
    indicators,
    invalidation: computeInvalidation(inp, score),
  };
}
