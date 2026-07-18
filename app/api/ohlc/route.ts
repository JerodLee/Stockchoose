import { NextRequest } from 'next/server';
import type { Bar } from '../../lib/backtest';

// 실시세(일봉) 프록시. 배포 환경(네트워크 허용)에선 Yahoo Finance 에서
// 실제 OHLC 를 받아 백테스트에 공급한다. 외부 egress 가 막힌 환경에선
// 502 를 반환하고, 클라이언트가 합성 데이터(SIM)로 자동 폴백한다.

// 화이트리스트: 임의 심볼 프록시(SSRF) 방지
const ALLOWED: Record<string, string> = {
  '005930.KS': '삼성전자',
  '000660.KS': 'SK하이닉스',
  SPY: 'S&P500 ETF',
  QQQ: '나스닥100 ETF',
  'BTC-USD': 'BTC/USD',
};

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol') || '005930.KS';
  const range = request.nextUrl.searchParams.get('range') || '2y';

  if (!(symbol in ALLOWED)) {
    return Response.json({ error: 'symbol not allowed', bars: [] }, { status: 400 });
  }

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${encodeURIComponent(range)}&interval=1d`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      // 시세는 자주 안 변하니 30분 캐시
      next: { revalidate: 1800 },
    });
    if (!res.ok) {
      return Response.json({ error: `upstream ${res.status}`, bars: [] }, { status: 502 });
    }
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const ts: number[] = result?.timestamp ?? [];
    const q = result?.indicators?.quote?.[0] ?? {};

    const bars: Bar[] = [];
    for (let i = 0; i < ts.length; i++) {
      const o = q.open?.[i];
      const h = q.high?.[i];
      const l = q.low?.[i];
      const c = q.close?.[i];
      if (o == null || h == null || l == null || c == null) continue;
      bars.push({ t: bars.length, open: o, high: h, low: l, close: c });
    }

    if (bars.length < 60) {
      return Response.json({ error: 'insufficient data', bars }, { status: 502 });
    }
    return Response.json({ symbol, name: ALLOWED[symbol], bars });
  } catch (e) {
    // egress 차단/타임아웃 등 → 클라이언트가 SIM 으로 폴백
    return Response.json({ error: String(e), bars: [] }, { status: 502 });
  }
}
