// 워크포워드 백테스트: 과거 각 시점에서 "그 시점까지의 데이터만으로" 편향을 계산하고,
// 이후 HORIZON_DAYS(=7일) 수익률·방향을 집계한다.
//
// 설계 원칙(이전 버전의 결함 교정):
//  - 라이브 모델과 "완전히 동일한 입력"을 쓴다. 과거 F&G·펀딩 일별 데이터를 받아
//    넣으므로, 이 백테스트는 사용자가 실제로 보는 모델을 그대로 검증한다.
//  - 비겹침 표본: 7일 보유를 1일 간격으로 재면 표본이 6일씩 겹쳐 유의성이 과장된다.
//    → 평가 시점을 horizon 간격으로 띄워 독립 표본만 집계한다.
//  - 거래비용(수수료+슬리피지+추정 펀딩)을 차감한 "기대값(expectancy)"을 헤드라인으로.
//    방향 적중률은 보조 지표일 뿐 수익성과 동치가 아니다.
//  - Wilson 신뢰구간으로 적중률의 불확실성을 함께 보고한다.

import { computeForecast, HORIZON_DAYS, type IndicatorInputs, type ForecastOptions } from '@/app/lib/forecast';

/** 왕복 거래비용 가정(%) = 테이커 수수료 양방향 + 슬리피지 + 7일 추정 펀딩 */
export const ROUND_TRIP_COST_PCT = 0.2;

const MIN_HISTORY = 60;

export interface BacktestInputs {
  closes: number[];
  highs: number[];
  lows: number[];
  /** 일별 (테이커 매수량/전체 거래량), closes와 동일 길이 */
  takerBuyRatioDaily: number[];
  /** 일별 F&G 0~100, closes와 동일 길이 (없으면 50) */
  fearGreedDaily: number[];
  /** 일별 펀딩비, closes와 동일 길이 (없으면 0) */
  fundingDaily: number[];
}

export interface BacktestMetrics {
  signals: number;
  hits: number;
  hitRate: number;
  /** 적중률 95% Wilson 신뢰구간 [low, high] (%) */
  hitRateCI: [number, number];
  /** 비용 차감 후 신호당 평균 손익(%) — 헤드라인 */
  expectancy: number;
  /** 비용 차감 전 신호당 평균 손익(%) */
  grossExpectancy: number;
  longSignals: number;
  shortSignals: number;
  avgLongRet: number;
  avgShortRet: number;
  sampleDays: number;
}

function wilson(hits: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 0];
  const p = hits / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, (center - margin) * 100), Math.min(100, (center + margin) * 100)];
}

/**
 * @param range 평가 시점 t의 범위 [from, to). 미지정 시 전체. (train/test 분리용)
 */
export function backtest(
  inp: BacktestInputs,
  horizon = HORIZON_DAYS,
  opts: ForecastOptions = {},
  range?: { from: number; to: number },
): BacktestMetrics {
  const { closes, highs, lows, takerBuyRatioDaily, fearGreedDaily, fundingDaily } = inp;
  const n = closes.length;

  const from = Math.max(MIN_HISTORY, range?.from ?? MIN_HISTORY);
  const to = Math.min(n - horizon, range?.to ?? n - horizon);

  let signals = 0;
  let hits = 0;
  let longSignals = 0;
  let shortSignals = 0;
  let sumLongRet = 0;
  let sumShortRet = 0;
  let sumNet = 0;
  let sumGross = 0;
  let sampleDays = 0;

  // 비겹침: horizon 간격으로 평가 → 독립 표본
  for (let t = from; t < to; t += horizon) {
    sampleDays++;
    const fundingWindow = fundingDaily.slice(Math.max(0, t - 6), t + 1);
    const avgFunding =
      fundingWindow.length > 0 ? fundingWindow.reduce((a, b) => a + b, 0) / fundingWindow.length : 0;

    const inputs: IndicatorInputs = {
      closes: closes.slice(0, t + 1),
      highs: highs.slice(0, t + 1),
      lows: lows.slice(0, t + 1),
      takerBuyRatios: takerBuyRatioDaily.slice(Math.max(0, t - 6), t + 1),
      fundingRate: fundingDaily[t] ?? 0,
      avgFunding,
      fearGreed: fearGreedDaily[t] ?? 50,
    };

    const f = computeForecast(inputs, opts);
    if (f.bias === 'NEUTRAL') continue;

    const fwdRet = ((closes[t + horizon] - closes[t]) / closes[t]) * 100;
    const dir = f.score > 0 ? 1 : -1;
    const signedRet = dir * fwdRet; // 방향이 맞으면 +
    const net = signedRet - ROUND_TRIP_COST_PCT;

    signals++;
    if (signedRet > 0) hits++;
    sumGross += signedRet;
    sumNet += net;
    if (dir > 0) {
      longSignals++;
      sumLongRet += fwdRet;
    } else {
      shortSignals++;
      sumShortRet += fwdRet;
    }
  }

  return {
    signals,
    hits,
    hitRate: signals > 0 ? (hits / signals) * 100 : 0,
    hitRateCI: wilson(hits, signals),
    expectancy: signals > 0 ? sumNet / signals : 0,
    grossExpectancy: signals > 0 ? sumGross / signals : 0,
    longSignals,
    shortSignals,
    avgLongRet: longSignals > 0 ? sumLongRet / longSignals : 0,
    avgShortRet: shortSignals > 0 ? sumShortRet / shortSignals : 0,
    sampleDays,
  };
}
