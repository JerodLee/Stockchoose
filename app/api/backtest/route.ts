// GET /api/backtest
// 주요 코인 장기 일봉 + 과거 F&G·펀딩을 받아 워크포워드 백테스트.
// 라이브 모델과 동일 입력·동일 로직으로 검증한다(비겹침 표본, 비용 차감 기대값).
//
// egress 허용 호스트: api.binance.com, fapi.binance.com, api.alternative.me

import { backtest, ROUND_TRIP_COST_PCT, type BacktestMetrics } from '@/app/lib/backtest';
import { loadHistory, loadFearGreedMap } from '@/app/lib/marketdata';

export const dynamic = 'force-dynamic';

const COINS = [
  { symbol: 'BTCUSDT', name: 'BTC' },
  { symbol: 'ETHUSDT', name: 'ETH' },
  { symbol: 'SOLUSDT', name: 'SOL' },
  { symbol: 'XRPUSDT', name: 'XRP' },
  { symbol: 'BNBUSDT', name: 'BNB' },
];

interface CoinBacktest extends BacktestMetrics {
  symbol: string;
  name: string;
}

export async function GET() {
  let fngMap: Map<number, number>;
  try {
    fngMap = await loadFearGreedMap();
  } catch {
    fngMap = new Map();
  }

  const results = await Promise.all(
    COINS.map(async (coin): Promise<CoinBacktest | null> => {
      try {
        const hist = await loadHistory(coin.symbol, fngMap);
        return { symbol: coin.symbol, name: coin.name, ...backtest(hist) };
      } catch {
        return null;
      }
    }),
  );

  const valid = results.filter((r): r is CoinBacktest => r !== null);
  const anyOk = valid.length > 0;

  const totSignals = valid.reduce((a, r) => a + r.signals, 0);
  const totHits = valid.reduce((a, r) => a + r.hits, 0);
  const overallHitRate = totSignals > 0 ? (totHits / totSignals) * 100 : 0;
  // 신호 가중 평균 기대값
  const overallExpectancy =
    totSignals > 0 ? valid.reduce((a, r) => a + r.expectancy * r.signals, 0) / totSignals : 0;

  return Response.json({
    ok: anyOk,
    updatedAt: new Date().toISOString(),
    horizonDays: 7,
    costPct: ROUND_TRIP_COST_PCT,
    note:
      '비겹침 표본(7일 간격) · 라이브 모델과 동일 입력(과거 F&G·펀딩 포함) · ' +
      `왕복비용 ${ROUND_TRIP_COST_PCT}% 차감. 적중률보다 기대값이 수익성의 척도다.`,
    overall: { signals: totSignals, hits: totHits, hitRate: overallHitRate, expectancy: overallExpectancy },
    coins: valid,
  });
}
