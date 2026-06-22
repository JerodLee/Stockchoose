// GET /api/forecast
// 주요 코인의 실데이터(Binance 공개 API + 공포·탐욕 지수)를 받아
// 1주 롱숏 편향을 계산해 반환한다. API 키 불필요.
//
// 데이터 소스(허용 필요한 egress 호스트):
//   - api.binance.com    : 일봉 klines (추세/모멘텀/자금흐름)
//   - fapi.binance.com   : 펀딩비 / 미결제약정 (펀딩 지표)
//   - api.alternative.me : 공포·탐욕 지수 (심리 지표)
//   - api.coingecko.com  : BTC 도미넌스 (심리 지표 보정, 선택)
//
// 일부 소스가 실패해도 해당 지표만 중립화하고 나머지로 계산한다(graceful degradation).

import { computeForecast, type IndicatorInputs, type ForecastResult } from '@/app/lib/forecast';

export const dynamic = 'force-dynamic';

const COINS = [
  { symbol: 'BTCUSDT', name: 'BTC', isBitcoin: true },
  { symbol: 'ETHUSDT', name: 'ETH', isBitcoin: false },
  { symbol: 'SOLUSDT', name: 'SOL', isBitcoin: false },
  { symbol: 'XRPUSDT', name: 'XRP', isBitcoin: false },
  { symbol: 'BNBUSDT', name: 'BNB', isBitcoin: false },
];

const SPOT = 'https://api.binance.com';
const FUTURES = 'https://fapi.binance.com';
const FNG = 'https://api.alternative.me';
const CG = 'https://api.coingecko.com';

// 서버측 60초 캐시로 레이트리밋/지연 완화.
const REVALIDATE = 60;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    next: { revalidate: REVALIDATE },
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

type RawKline = [
  number, // openTime
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // closeTime
  string, // quoteVolume
  number, // trades
  string, // takerBuyBase
  string, // takerBuyQuote
  string, // ignore
];

interface CoinForecast extends ForecastResult {
  symbol: string;
  name: string;
  price: number | null;
}

interface SourceHealth {
  klines: boolean;
  funding: boolean;
  fearGreed: boolean;
  dominance: boolean;
}

export async function GET() {
  const sources: SourceHealth = { klines: false, funding: false, fearGreed: false, dominance: false };

  // ── 시장 전역 데이터 (코인 공통) ──────────────────────────────
  let fearGreed = 50;
  try {
    const fng = await getJson<{ data: { value: string }[] }>(`${FNG}/fng/?limit=1`);
    fearGreed = Number(fng.data?.[0]?.value);
    if (Number.isFinite(fearGreed)) sources.fearGreed = true;
    else fearGreed = 50;
  } catch {
    fearGreed = 50;
  }

  let dominanceChange = 0;
  try {
    const g = await getJson<{
      data: { market_cap_percentage: { btc: number }; market_cap_change_percentage_24h_usd: number };
    }>(`${CG}/api/v3/global`);
    const btcDom = g.data?.market_cap_percentage?.btc ?? 50;
    // 도미넌스 절대 변화는 무료 API로 직접 제공되지 않아, 50% 기준 편차를 약한 신호로 사용.
    dominanceChange = btcDom - 50;
    sources.dominance = true;
  } catch {
    dominanceChange = 0;
  }

  // ── 코인별 계산 ──────────────────────────────────────────────
  const results = await Promise.all(
    COINS.map(async (coin): Promise<CoinForecast> => {
      // 일봉 klines (추세·모멘텀·자금흐름)
      let closes: number[] = [];
      let highs: number[] = [];
      let lows: number[] = [];
      let takerBuyRatios: number[] = [];
      let price: number | null = null;
      try {
        const kl = await getJson<RawKline[]>(
          `${SPOT}/api/v3/klines?symbol=${coin.symbol}&interval=1d&limit=200`,
        );
        closes = kl.map((k) => Number(k[4]));
        highs = kl.map((k) => Number(k[2]));
        lows = kl.map((k) => Number(k[3]));
        takerBuyRatios = kl.slice(-7).map((k) => {
          const vol = Number(k[5]);
          const takerBuy = Number(k[9]);
          return vol > 0 ? takerBuy / vol : 0.5;
        });
        price = closes[closes.length - 1] ?? null;
        sources.klines = true;
      } catch {
        // klines 실패 시 이 코인은 계산 불가 → 중립 처리
      }

      // 펀딩비 / OI (선물)
      let fundingRate = 0;
      let avgFunding = 0;
      let oiChangePct = 0;
      try {
        const premium = await getJson<{ lastFundingRate: string }>(
          `${FUTURES}/fapi/v1/premiumIndex?symbol=${coin.symbol}`,
        );
        fundingRate = Number(premium.lastFundingRate) || 0;

        const hist = await getJson<{ fundingRate: string }[]>(
          `${FUTURES}/fapi/v1/fundingRate?symbol=${coin.symbol}&limit=21`,
        );
        if (hist.length > 0) {
          avgFunding = hist.reduce((a, h) => a + (Number(h.fundingRate) || 0), 0) / hist.length;
        }

        const oiHist = await getJson<{ sumOpenInterest: string }[]>(
          `${FUTURES}/futures/data/openInterestHist?symbol=${coin.symbol}&period=1d&limit=8`,
        );
        if (oiHist.length >= 2) {
          const first = Number(oiHist[0].sumOpenInterest);
          const lastOi = Number(oiHist[oiHist.length - 1].sumOpenInterest);
          if (first > 0) oiChangePct = ((lastOi - first) / first) * 100;
        }
        sources.funding = true;
      } catch {
        // 펀딩 소스 실패 → 펀딩 지표 중립화(0)
      }

      // klines가 없으면 계산이 무의미하므로 중립 결과 반환
      if (closes.length < 35) {
        return {
          symbol: coin.symbol,
          name: coin.name,
          price,
          bias: 'NEUTRAL',
          score: 0,
          confidence: 0,
          horizonDays: 7,
          indicators: [],
          invalidation: null,
        };
      }

      const inputs: IndicatorInputs = {
        closes,
        highs,
        lows,
        takerBuyRatios,
        fundingRate,
        avgFunding,
        oiChangePct,
        fearGreed,
        isBitcoin: coin.isBitcoin,
        dominanceChange,
      };

      return { symbol: coin.symbol, name: coin.name, price, ...computeForecast(inputs) };
    }),
  );

  // ── 시장 전체 요약 ────────────────────────────────────────────
  const valid = results.filter((r) => r.indicators.length > 0);
  const longs = valid.filter((r) => r.bias === 'LONG' || r.bias === 'STRONG LONG').length;
  const shorts = valid.filter((r) => r.bias === 'SHORT' || r.bias === 'STRONG SHORT').length;
  const neutrals = valid.filter((r) => r.bias === 'NEUTRAL').length;
  const avgConfidence =
    valid.length > 0 ? Math.round(valid.reduce((a, r) => a + r.confidence, 0) / valid.length) : 0;

  let regime: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (longs > shorts && longs >= valid.length / 2) regime = 'LONG';
  else if (shorts > longs && shorts >= valid.length / 2) regime = 'SHORT';

  const ok = sources.klines; // 최소한 가격/추세 데이터는 있어야 의미 있음

  return Response.json({
    ok,
    updatedAt: new Date().toISOString(),
    sources,
    summary: { regime, longs, shorts, neutrals, avgConfidence, total: valid.length },
    coins: results,
  });
}
