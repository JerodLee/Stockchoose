// 추세선 풀백(Trendline Pullback) 스윙 전략 백테스트 엔진
// 영상 "This boring trading strategy made me $526,454"의 규칙을 코드화한 것.
// 절대 수익금액 대신 승률 / 평균 R / 기대값 / MDD 로 "가능성"을 검증한다.

export interface Bar {
  t: number; // index (봉 번호)
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Trade {
  entryIdx: number;
  exitIdx: number;
  entry: number;
  stop: number;
  target: number;
  exit: number;
  r: number; // 손익비 배수 (손실 = -1)
  win: boolean;
}

export interface BacktestParams {
  emaFast: number; // 되돌림 기준 이평 (추세선 대용)
  emaSlow: number; // 추세 방향 판정 이평
  stopLookback: number; // 손절용 직전 스윙 저점 탐색 구간
  stopBuffer: number; // 스윙 저점 아래 여유 (%)
  rMultiple: number; // 손익비 (익절 목표 = 1 : rMultiple)
  maxHold: number; // 최대 보유 봉 수 (미도달 시 종가 청산)
}

export interface BacktestStats {
  trades: number;
  wins: number;
  losses: number;
  winRate: number; // %
  avgR: number; // 평균 R (기대값, R 단위)
  profitFactor: number;
  totalR: number;
  maxDrawdownR: number; // 최대 낙폭 (R 단위)
  equityR: number[]; // 누적 R 곡선
}

export const DEFAULT_PARAMS: BacktestParams = {
  emaFast: 10,
  emaSlow: 30,
  stopLookback: 5,
  stopBuffer: 0.003,
  rMultiple: 2,
  maxHold: 20,
};

// --- 시드 기반 PRNG (렌더마다 값이 흔들리지 않도록 결정적) ---
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 추세와 되돌림이 섞인 합성 OHLC 데이터 생성 (전략이 잡을 셋업이 존재하도록)
export function generateBars(count: number, base: number, seed: number): Bar[] {
  const rnd = mulberry32(seed);
  const bars: Bar[] = [];
  let price = base;
  let drift = 0;
  for (let i = 0; i < count; i++) {
    // 완만히 변하는 추세(drift) + 노이즈 → 상승/하락/횡보 국면이 번갈아 등장
    drift += (rnd() - 0.5) * 0.0012;
    drift = Math.max(-0.006, Math.min(0.006, drift));
    const change = (drift + (rnd() - 0.5) * 0.018) * price;
    const open = price;
    price = Math.max(1, price + change);
    const close = price;
    const wick = price * 0.005 * (0.5 + rnd());
    const high = Math.max(open, close) + rnd() * wick;
    const low = Math.min(open, close) - rnd() * wick;
    bars.push({ t: i, open, high, low, close });
  }
  return bars;
}

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function runBacktest(bars: Bar[], params: BacktestParams): {
  trades: Trade[];
  stats: BacktestStats;
  fast: number[]; // 되돌림 기준 EMA (차트 오버레이용)
  slow: number[]; // 추세 판정 EMA
} {
  const { emaFast, emaSlow, stopLookback, stopBuffer, rMultiple, maxHold } = params;
  const closes = bars.map((b) => b.close);
  const fast = ema(closes, emaFast);
  const slow = ema(closes, emaSlow);
  const trades: Trade[] = [];

  let armed = false; // 되돌림 발생(저점이 fast 이평 터치) 후 진입 대기 상태
  let i = emaSlow + 1;

  while (i < bars.length - 1) {
    const b = bars[i];
    const uptrend = fast[i] > slow[i] && b.close > slow[i];

    if (!uptrend) {
      armed = false;
      i++;
      continue;
    }

    // 되돌림: 봉의 저점이 fast 이평까지 눌림 → 진입 대기 무장
    if (b.low <= fast[i]) armed = true;

    // 트리거: 무장 상태 + 반전(양봉) + 종가가 fast 이평 회복
    const bullish = b.close > b.open && b.close > fast[i];
    if (armed && bullish) {
      const entry = b.close;
      // 손절 = 직전 스윙 저점 아래 (buffer)
      let swingLow = b.low;
      for (let j = Math.max(0, i - stopLookback); j <= i; j++) {
        swingLow = Math.min(swingLow, bars[j].low);
      }
      const stop = swingLow * (1 - stopBuffer);
      const risk = entry - stop;
      if (risk <= 0) {
        armed = false;
        i++;
        continue;
      }
      const target = entry + rMultiple * risk;

      // 진입 이후 봉을 따라가며 손절/익절/시간청산 판정
      let exitIdx = i;
      let exit = entry;
      let r = 0;
      let resolved = false;
      const end = Math.min(bars.length - 1, i + maxHold);
      for (let k = i + 1; k <= end; k++) {
        const f = bars[k];
        if (f.low <= stop) {
          // 같은 봉에 둘 다 닿으면 보수적으로 손절 우선
          exit = stop;
          r = -1;
          exitIdx = k;
          resolved = true;
          break;
        }
        if (f.high >= target) {
          exit = target;
          r = rMultiple;
          exitIdx = k;
          resolved = true;
          break;
        }
      }
      if (!resolved) {
        exit = bars[end].close;
        r = (exit - entry) / risk;
        exitIdx = end;
      }

      trades.push({ entryIdx: i, exitIdx, entry, stop, target, exit, r, win: r > 0 });
      armed = false;
      i = exitIdx + 1; // 한 번에 한 포지션
      continue;
    }
    i++;
  }

  return { trades, stats: computeStats(trades), fast, slow };
}

function computeStats(trades: Trade[]): BacktestStats {
  const equityR: number[] = [];
  let cum = 0;
  let peak = 0;
  let maxDD = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let wins = 0;

  for (const tr of trades) {
    cum += tr.r;
    equityR.push(cum);
    peak = Math.max(peak, cum);
    maxDD = Math.min(maxDD, cum - peak);
    if (tr.r > 0) {
      grossWin += tr.r;
      wins++;
    } else {
      grossLoss += Math.abs(tr.r);
    }
  }

  const n = trades.length;
  return {
    trades: n,
    wins,
    losses: n - wins,
    winRate: n ? (wins / n) * 100 : 0,
    avgR: n ? cum / n : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    totalR: cum,
    maxDrawdownR: maxDD,
    equityR,
  };
}
