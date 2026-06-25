// GET /api/forecast?preset=
// 주요 코인의 실데이터(Binance 공개 API + Alternative.me F&G)로 1주 롱숏 편향 계산.
// API 키 불필요. 소스별 graceful degradation.
//
// egress 허용 호스트: api.binance.com, fapi.binance.com, api.alternative.me

import {
  computeForecast,
  PRESETS,
  DEFAULT_PRESET,
  type IndicatorInputs,
  type ForecastResult,
} from '@/app/lib/forecast';
import { fetchJson, SPOT, FUTURES, FNG } from '@/app/lib/marketdata';

export const dynamic = 'force-dynamic';

const COINS = [
  { symbol: 'BTCUSDT', name: 'BTC' },
  { symbol: 'ETHUSDT', name: 'ETH' },
  { symbol: 'SOLUSDT', name: 'SOL' },
  { symbol: 'XRPUSDT', name: 'XRP' },
  { symbol: 'BNBUSDT', name: 'BNB' },
];

const REVALIDATE = 60;

type RawKline = [number, string, string, string, string, string, number, string, number, string, string, string];

interface CoinForecast extends ForecastResult {
  symbol: string;
  name: string;
  price: number | null;
}

interface SourceHealth {
  klines: boolean;
  funding: boolean;
  fearGreed: boolean;
}

export async function GET(request: Request) {
  const presetKey = new URL(request.url).searchParams.get('preset') ?? DEFAULT_PRESET;
  const preset = PRESETS[presetKey] ?? PRESETS[DEFAULT_PRESET];
  const forecastOpts = { weights: preset.weights, thresholds: preset.thresholds };

  const sources: SourceHealth = { klines: false, funding: false, fearGreed: false };

  // 시장 공통: F&G
  let fearGreed = 50;
  try {
    const fng = await fetchJson<{ data: { value: string }[] }>(`${FNG}/fng/?limit=1`, { revalidate: REVALIDATE });
    const v = Number(fng.data?.[0]?.value);
    if (Number.isFinite(v)) {
      fearGreed = v;
      sources.fearGreed = true;
    }
  } catch {
    /* 중립 유지 */
  }

  const results = await Promise.all(
    COINS.map(async (coin): Promise<CoinForecast> => {
      let closes: number[] = [];
      let highs: number[] = [];
      let lows: number[] = [];
      let takerBuyRatios: number[] = [];
      let price: number | null = null;
      try {
        const kl = await fetchJson<RawKline[]>(
          `${SPOT}/api/v3/klines?symbol=${coin.symbol}&interval=1d&limit=200`,
          { revalidate: REVALIDATE },
        );
        closes = kl.map((k) => Number(k[4]));
        highs = kl.map((k) => Number(k[2]));
        lows = kl.map((k) => Number(k[3]));
        takerBuyRatios = kl.slice(-7).map((k) => {
          const vol = Number(k[5]);
          return vol > 0 ? Number(k[9]) / vol : 0.5;
        });
        price = closes[closes.length - 1] ?? null;
        sources.klines = true;
      } catch {
        /* 이 코인 계산 불가 */
      }

      let fundingRate = 0;
      let avgFunding = 0;
      try {
        const premium = await fetchJson<{ lastFundingRate: string }>(
          `${FUTURES}/fapi/v1/premiumIndex?symbol=${coin.symbol}`,
          { revalidate: REVALIDATE },
        );
        fundingRate = Number(premium.lastFundingRate) || 0;
        const hist = await fetchJson<{ fundingRate: string }[]>(
          `${FUTURES}/fapi/v1/fundingRate?symbol=${coin.symbol}&limit=21`,
          { revalidate: REVALIDATE },
        );
        if (hist.length > 0) avgFunding = hist.reduce((a, h) => a + (Number(h.fundingRate) || 0), 0) / hist.length;
        sources.funding = true;
      } catch {
        /* 펀딩 지표 중립화 */
      }

      if (closes.length < 35) {
        return {
          symbol: coin.symbol,
          name: coin.name,
          price,
          bias: 'NEUTRAL',
          score: 0,
          conviction: { agree: 0, total: 5, strength: 'low' },
          horizonDays: 7,
          indicators: [],
          invalidation: null,
        };
      }

      const inputs: IndicatorInputs = { closes, highs, lows, takerBuyRatios, fundingRate, avgFunding, fearGreed };
      return { symbol: coin.symbol, name: coin.name, price, ...computeForecast(inputs, forecastOpts) };
    }),
  );

  const valid = results.filter((r) => r.indicators.length > 0);
  const longs = valid.filter((r) => r.bias === 'LONG' || r.bias === 'STRONG LONG').length;
  const shorts = valid.filter((r) => r.bias === 'SHORT' || r.bias === 'STRONG SHORT').length;
  const neutrals = valid.filter((r) => r.bias === 'NEUTRAL').length;

  let regime: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (longs > shorts && longs >= valid.length / 2) regime = 'LONG';
  else if (shorts > longs && shorts >= valid.length / 2) regime = 'SHORT';

  const ok = sources.klines;

  return Response.json({
    ok,
    updatedAt: new Date().toISOString(),
    preset: { key: preset.key, label: preset.label, desc: preset.desc },
    sources,
    summary: {
      regime,
      longs,
      shorts,
      neutrals,
      total: valid.length,
      // #7 주의: 코인 간 상관이 높아 아래 신호들은 독립 베팅이 아니라 대체로 하나의 매크로 방향이다.
      caveat: '코인 간 상관이 높아 사실상 하나의 시장 방향 베팅에 가깝습니다.',
    },
    coins: results,
  });
}
