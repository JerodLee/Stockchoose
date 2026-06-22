// GET /api/backtest
// 주요 코인의 일봉 장기 시계열(최대 1000봉)을 받아 워크포워드 백테스트로
// 기술 코어(추세+모멘텀+자금흐름)의 1주 방향 적중률을 측정한다. API 키 불필요.
//
// klines 단일 소스만 사용하므로 egress 허용 호스트: api.binance.com

import { backtest, type BacktestMetrics } from '@/app/lib/backtest';

export const dynamic = 'force-dynamic';

const COINS = [
  { symbol: 'BTCUSDT', name: 'BTC' },
  { symbol: 'ETHUSDT', name: 'ETH' },
  { symbol: 'SOLUSDT', name: 'SOL' },
  { symbol: 'XRPUSDT', name: 'XRP' },
  { symbol: 'BNBUSDT', name: 'BNB' },
];

const SPOT = 'https://api.binance.com';
const REVALIDATE = 60 * 30; // 백테스트는 비싸므로 30분 캐시

type RawKline = [number, string, string, string, string, string, number, string, number, string, string, string];

interface CoinBacktest extends BacktestMetrics {
  symbol: string;
  name: string;
}

export async function GET() {
  let anyOk = false;

  const results = await Promise.all(
    COINS.map(async (coin): Promise<CoinBacktest> => {
      try {
        const kl = await fetch(
          `${SPOT}/api/v3/klines?symbol=${coin.symbol}&interval=1d&limit=1000`,
          { next: { revalidate: REVALIDATE }, headers: { Accept: 'application/json' } },
        );
        if (!kl.ok) throw new Error(`HTTP ${kl.status}`);
        const rows = (await kl.json()) as RawKline[];
        const closes = rows.map((k) => Number(k[4]));
        const highs = rows.map((k) => Number(k[2]));
        const lows = rows.map((k) => Number(k[3]));
        const takerBuyRatioDaily = rows.map((k) => {
          const vol = Number(k[5]);
          return vol > 0 ? Number(k[9]) / vol : 0.5;
        });
        const m = backtest({ closes, highs, lows, takerBuyRatioDaily });
        anyOk = true;
        return { symbol: coin.symbol, name: coin.name, ...m };
      } catch {
        return {
          symbol: coin.symbol,
          name: coin.name,
          signals: 0,
          hits: 0,
          hitRate: 0,
          avgLongRet: 0,
          avgShortRet: 0,
          longSignals: 0,
          shortSignals: 0,
          sampleDays: 0,
        };
      }
    }),
  );

  // 전체 합산 적중률
  const totSignals = results.reduce((a, r) => a + r.signals, 0);
  const totHits = results.reduce((a, r) => a + r.hits, 0);
  const overallHitRate = totSignals > 0 ? (totHits / totSignals) * 100 : 0;

  return Response.json({
    ok: anyOk,
    updatedAt: new Date().toISOString(),
    horizonDays: 7,
    note: '가격 기반 기술 코어(추세+모멘텀+자금흐름)만 평가. 펀딩·심리 제외, 거래비용 미반영.',
    overall: { signals: totSignals, hits: totHits, hitRate: overallHitRate },
    coins: results,
  });
}
