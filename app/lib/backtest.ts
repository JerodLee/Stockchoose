// 워크포워드 백테스트: 과거 각 시점에서 "그 시점까지의 데이터만으로" 편향을 계산하고,
// 이후 HORIZON_DAYS(=7일) 수익률과 방향이 맞았는지 집계해 적중률을 측정한다.
//
// 한계(정직하게 명시):
//  - 펀딩비·심리(F&G)·도미넌스의 "과거 일자별" 데이터는 정합이 어려워 중립(0)으로 둔다.
//    즉 이 백테스트는 가격 기반 기술 코어(추세+모멘텀+자금흐름)의 성능만 측정한다.
//  - 거래비용/슬리피지/펀딩비용 미반영. 미래편향(look-ahead) 없도록 t 시점까지만 사용.

import { computeForecast, HORIZON_DAYS, type IndicatorInputs, type ForecastOptions } from '@/app/lib/forecast';

export interface BacktestMetrics {
  /** 중립이 아닌(=베팅한) 신호 수 */
  signals: number;
  /** 방향 적중 수 */
  hits: number;
  /** 적중률 % (signals 기준) */
  hitRate: number;
  /** 롱 신호 평균 7일 수익률 % */
  avgLongRet: number;
  /** 숏 신호 평균 7일 수익률 % (가격 변화 기준, 음수면 숏에 유리) */
  avgShortRet: number;
  longSignals: number;
  shortSignals: number;
  /** 표본 일수 */
  sampleDays: number;
}

export interface BacktestInputs {
  closes: number[];
  highs: number[];
  lows: number[];
  /** 일별 (테이커 매수량/전체 거래량) 비율, closes와 같은 길이 */
  takerBuyRatioDaily: number[];
}

const MIN_HISTORY = 60; // 지표 안정화에 필요한 최소 봉 수

export function backtest(
  inp: BacktestInputs,
  horizon = HORIZON_DAYS,
  opts: ForecastOptions = {},
): BacktestMetrics {
  const { closes, highs, lows, takerBuyRatioDaily } = inp;
  const n = closes.length;

  let signals = 0;
  let hits = 0;
  let longSignals = 0;
  let shortSignals = 0;
  let sumLongRet = 0;
  let sumShortRet = 0;
  let sampleDays = 0;

  for (let t = MIN_HISTORY; t < n - horizon; t++) {
    sampleDays++;
    const inputs: IndicatorInputs = {
      closes: closes.slice(0, t + 1),
      highs: highs.slice(0, t + 1),
      lows: lows.slice(0, t + 1),
      takerBuyRatios: takerBuyRatioDaily.slice(Math.max(0, t - 6), t + 1),
      // 과거 일자별 정합 불가 → 중립 처리 (기술 코어만 평가)
      fundingRate: 0,
      avgFunding: 0,
      oiChangePct: 0,
      fearGreed: 50,
      isBitcoin: false,
      dominanceChange: 0,
    };

    const f = computeForecast(inputs, opts);
    if (f.bias === 'NEUTRAL') continue;

    const fwdRet = ((closes[t + horizon] - closes[t]) / closes[t]) * 100;
    const dir = f.score > 0 ? 1 : -1;
    const correct = Math.sign(fwdRet) === dir;

    signals++;
    if (correct) hits++;
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
    avgLongRet: longSignals > 0 ? sumLongRet / longSignals : 0,
    avgShortRet: shortSignals > 0 ? sumShortRet / shortSignals : 0,
    longSignals,
    shortSignals,
    sampleDays,
  };
}
