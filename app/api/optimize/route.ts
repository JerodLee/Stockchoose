// GET /api/optimize
// 데이터 스누핑을 피하는 정직한 프리셋 선택:
//   1) 인-샘플(앞 70%)에서 각 프리셋의 기대값을 측정해 "최적 프리셋"을 고르고
//   2) 아웃-오브-샘플(뒤 30%)에서 모든 프리셋의 성능을 보고한다.
// 즉 추천(best)은 IS로 정하되, 신뢰할 숫자는 OOS다.
//
// egress 허용 호스트: api.binance.com, fapi.binance.com, api.alternative.me

import { backtest, type BacktestInputs } from '@/app/lib/backtest';
import { PRESETS } from '@/app/lib/forecast';
import { loadHistory, loadFearGreedMap } from '@/app/lib/marketdata';

export const dynamic = 'force-dynamic';

const COINS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT'];
const SPLIT = 0.7;
const MIN_HISTORY = 60;

interface PresetEval {
  key: string;
  label: string;
  desc: string;
  // 인-샘플(프리셋 선택용)
  isExpectancy: number;
  isSignals: number;
  // 아웃-오브-샘플(보고용)
  oosExpectancy: number;
  oosHitRate: number;
  oosHitRateCI: [number, number];
  oosSignals: number;
}

export async function GET() {
  let fngMap: Map<number, number>;
  try {
    fngMap = await loadFearGreedMap();
  } catch {
    fngMap = new Map();
  }

  const series: BacktestInputs[] = [];
  await Promise.all(
    COINS.map(async (symbol) => {
      try {
        series.push(await loadHistory(symbol, fngMap));
      } catch {
        /* skip */
      }
    }),
  );
  const anyOk = series.length > 0;

  const presets = Object.values(PRESETS).map((preset): PresetEval => {
    const opts = { weights: preset.weights, thresholds: preset.thresholds };
    let isSum = 0;
    let isSig = 0;
    let oosSum = 0;
    let oosSig = 0;
    let oosHits = 0;

    for (const s of series) {
      const n = s.closes.length;
      const split = Math.floor(n * SPLIT);
      const is = backtest(s, 7, opts, { from: MIN_HISTORY, to: split });
      const oos = backtest(s, 7, opts, { from: split, to: n });
      isSum += is.expectancy * is.signals;
      isSig += is.signals;
      oosSum += oos.expectancy * oos.signals;
      oosSig += oos.signals;
      oosHits += oos.hits;
    }

    // OOS 합산 적중률의 Wilson CI
    const ci = wilson(oosHits, oosSig);
    return {
      key: preset.key,
      label: preset.label,
      desc: preset.desc,
      isExpectancy: isSig > 0 ? isSum / isSig : 0,
      isSignals: isSig,
      oosExpectancy: oosSig > 0 ? oosSum / oosSig : 0,
      oosHitRate: oosSig > 0 ? (oosHits / oosSig) * 100 : 0,
      oosHitRateCI: ci,
      oosSignals: oosSig,
    };
  });

  // 추천: 인-샘플 기대값 최고. (보고는 OOS로)
  const best = [...presets].sort((a, b) => b.isExpectancy - a.isExpectancy)[0] ?? null;

  return Response.json({
    ok: anyOk,
    updatedAt: new Date().toISOString(),
    horizonDays: 7,
    note:
      '인-샘플(앞 70%)로 프리셋을 고르고 아웃-오브-샘플(뒤 30%)로 평가. ' +
      'IS 성능은 과적합되므로 신뢰할 숫자는 OOS다.',
    best,
    presets,
  });
}

function wilson(hits: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 0];
  const p = hits / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, (center - margin) * 100), Math.min(100, (center + margin) * 100)];
}
