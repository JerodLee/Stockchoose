// 시장 데이터 로더 (서버 전용). backtest/optimize 라우트가 공유한다.
// 모든 fetch에 타임아웃을 건다. 과거 F&G·펀딩을 일봉에 정렬해 백테스트가
// 라이브 모델과 동일한 입력을 쓰도록 한다.
//
// egress 허용 호스트: api.binance.com, fapi.binance.com, api.alternative.me

import type { BacktestInputs } from '@/app/lib/backtest';

export const SPOT = 'https://api.binance.com';
export const FUTURES = 'https://fapi.binance.com';
export const FNG = 'https://api.alternative.me';

const DAY_MS = 86_400_000;
const DAY_S = 86_400;

/** 타임아웃이 있는 fetch+json. */
export async function fetchJson<T>(url: string, opts: { revalidate?: number; timeoutMs?: number } = {}): Promise<T> {
  const { revalidate = 0, timeoutMs = 10_000 } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
      next: revalidate > 0 ? { revalidate } : undefined,
    });
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const dayIndexFromMs = (ms: number) => Math.floor(ms / DAY_MS);
const dayIndexFromS = (s: number) => Math.floor(s / DAY_S);

type RawKline = [number, string, string, string, string, string, number, string, number, string, string, string];

/** 전체 시장 공통 F&G 히스토리 → dayIndex→value 맵. 한 번만 받으면 됨. */
export async function loadFearGreedMap(revalidate = 1800): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  const json = await fetchJson<{ data: { value: string; timestamp: string }[] }>(
    `${FNG}/fng/?limit=0&format=json`,
    { revalidate },
  );
  for (const d of json.data ?? []) {
    const v = Number(d.value);
    const ts = Number(d.timestamp);
    if (Number.isFinite(v) && Number.isFinite(ts)) map.set(dayIndexFromS(ts), v);
  }
  return map;
}

/** 심볼별 펀딩 히스토리(페이지네이션) → dayIndex→평균펀딩 맵. */
async function loadFundingMap(symbol: string, sinceMs: number, revalidate = 1800): Promise<Map<number, number>> {
  const byDay = new Map<number, { sum: number; n: number }>();
  let endTime = Date.now();
  // 1페이지 = 1000건 ≈ 333일. 최대 5페이지(≈4.5년)까지 거슬러 올라간다.
  for (let page = 0; page < 5; page++) {
    const rows = await fetchJson<{ fundingTime: number; fundingRate: string }[]>(
      `${FUTURES}/fapi/v1/fundingRate?symbol=${symbol}&limit=1000&endTime=${endTime}`,
      { revalidate },
    );
    if (!rows.length) break;
    for (const r of rows) {
      const rate = Number(r.fundingRate);
      if (!Number.isFinite(rate)) continue;
      const di = dayIndexFromMs(r.fundingTime);
      const cur = byDay.get(di) ?? { sum: 0, n: 0 };
      cur.sum += rate;
      cur.n += 1;
      byDay.set(di, cur);
    }
    const oldest = rows[0].fundingTime;
    if (oldest <= sinceMs || rows.length < 1000) break;
    endTime = oldest - 1;
  }
  const map = new Map<number, number>();
  for (const [di, { sum, n }] of byDay) map.set(di, sum / n);
  return map;
}

/** 백테스트용 장기 일봉 + 정렬된 F&G·펀딩. fngMap을 넘기면 재사용(중복 fetch 방지). */
export async function loadHistory(
  symbol: string,
  fngMap: Map<number, number>,
  revalidate = 1800,
): Promise<BacktestInputs> {
  const rows = await fetchJson<RawKline[]>(
    `${SPOT}/api/v3/klines?symbol=${symbol}&interval=1d&limit=1000`,
    { revalidate },
  );
  const closes = rows.map((k) => Number(k[4]));
  const highs = rows.map((k) => Number(k[2]));
  const lows = rows.map((k) => Number(k[3]));
  const takerBuyRatioDaily = rows.map((k) => {
    const vol = Number(k[5]);
    return vol > 0 ? Number(k[9]) / vol : 0.5;
  });

  const sinceMs = rows.length ? rows[0][0] : Date.now() - 1000 * DAY_MS;
  const fundMap = await loadFundingMap(symbol, sinceMs, revalidate);

  const fearGreedDaily = rows.map((k) => fngMap.get(dayIndexFromMs(k[0])) ?? 50);
  const fundingDaily = rows.map((k) => fundMap.get(dayIndexFromMs(k[0])) ?? 0);

  return { closes, highs, lows, takerBuyRatioDaily, fearGreedDaily, fundingDaily };
}
