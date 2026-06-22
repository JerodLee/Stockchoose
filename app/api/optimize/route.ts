// GET /api/optimize
// 각 가중치 프리셋을 동일한 과거 데이터로 백테스트해 적중률 순으로 정렬한다.
// egress가 열리면 "실데이터 기준 최적 프리셋"을 경험적으로 고르기 위한 튜닝 도구.
//
// egress 허용 호스트: api.binance.com (klines 단일 소스)

import { backtest } from '@/app/lib/backtest';
import { PRESETS } from '@/app/lib/forecast';

export const dynamic = 'force-dynamic';

const COINS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT'];
const SPOT = 'https://api.binance.com';
const REVALIDATE = 60 * 30;

type RawKline = [number, string, string, string, string, string, number, string, number, string, string, string];

interface Series {
  closes: number[];
  highs: number[];
  lows: number[];
  takerBuyRatioDaily: number[];
}

interface PresetResult {
  key: string;
  label: string;
  desc: string;
  hitRate: number;
  signals: number;
  hits: number;
}

export async function GET() {
  // 코인별 시계열을 한 번만 받아 모든 프리셋에 재사용.
  const series: Series[] = [];
  let anyOk = false;

  await Promise.all(
    COINS.map(async (symbol) => {
      try {
        const res = await fetch(`${SPOT}/api/v3/klines?symbol=${symbol}&interval=1d&limit=1000`, {
          next: { revalidate: REVALIDATE },
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = (await res.json()) as RawKline[];
        series.push({
          closes: rows.map((k) => Number(k[4])),
          highs: rows.map((k) => Number(k[2])),
          lows: rows.map((k) => Number(k[3])),
          takerBuyRatioDaily: rows.map((k) => {
            const vol = Number(k[5]);
            return vol > 0 ? Number(k[9]) / vol : 0.5;
          }),
        });
        anyOk = true;
      } catch {
        // 해당 코인 스킵
      }
    }),
  );

  const results: PresetResult[] = Object.values(PRESETS).map((preset) => {
    let signals = 0;
    let hits = 0;
    for (const s of series) {
      const m = backtest(s, 7, { weights: preset.weights, thresholds: preset.thresholds });
      signals += m.signals;
      hits += m.hits;
    }
    return {
      key: preset.key,
      label: preset.label,
      desc: preset.desc,
      hitRate: signals > 0 ? (hits / signals) * 100 : 0,
      signals,
      hits,
    };
  });

  results.sort((a, b) => b.hitRate - a.hitRate);

  return Response.json({
    ok: anyOk,
    updatedAt: new Date().toISOString(),
    horizonDays: 7,
    note: '동일 과거 데이터에 각 프리셋 적용. 가격 기반 기술 코어만 평가(펀딩·심리 제외).',
    best: results[0] ?? null,
    presets: results,
  });
}
