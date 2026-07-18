'use client';
import { useMemo } from 'react';
import type { Bar, Trade } from '../lib/backtest';

interface Props {
  bars: Bar[];
  fast: number[];
  slow: number[];
  trades: Trade[];
}

// 백테스트가 실제로 매매한 셋업을 캔들 위에 시각화:
// EMA 추세선(fast/slow) + 진입(▲) + 손절/익절 도달 지점.
export default function StrategyChart({ bars, fast, slow, trades }: Props) {
  const W = 280, H = 130;
  const PAD = { top: 6, right: 4, bottom: 4, left: 4 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const { minP, maxP } = useMemo(() => {
    if (!bars.length) return { minP: 0, maxP: 1 };
    let lo = Infinity, hi = -Infinity;
    for (const b of bars) {
      if (b.low < lo) lo = b.low;
      if (b.high > hi) hi = b.high;
    }
    // 손절/익절선도 프레임 안에 들어오도록 확장
    for (const t of trades) {
      lo = Math.min(lo, t.stop);
      hi = Math.max(hi, t.target);
    }
    const pad = (hi - lo) * 0.04 || 1;
    return { minP: lo - pad, maxP: hi + pad };
  }, [bars, trades]);

  const n = bars.length || 1;
  const toX = (i: number) => PAD.left + (i / (n - 1)) * chartW;
  const toY = (p: number) => PAD.top + chartH - ((p - minP) / (maxP - minP)) * chartH;
  const bw = Math.max(0.6, chartW / n - 0.6);

  const line = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {/* 캔들 */}
      {bars.map((c, i) => {
        const up = c.close >= c.open;
        const color = up ? '#1f6b45' : '#7a2230';
        const x = toX(i);
        const bodyTop = toY(Math.max(c.open, c.close));
        const bodyH = Math.max(0.5, Math.abs(toY(c.open) - toY(c.close)));
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={toY(c.high)} y2={toY(c.low)} stroke={color} strokeWidth="0.4" />
            <rect x={x - bw / 2} y={bodyTop} width={bw} height={bodyH} fill={color} />
          </g>
        );
      })}

      {/* EMA 추세선 */}
      <path d={line(slow)} fill="none" stroke="#ffd740" strokeWidth="0.8" opacity="0.8" />
      <path d={line(fast)} fill="none" stroke="#448aff" strokeWidth="0.8" opacity="0.9" />

      {/* 트레이드 마커 */}
      {trades.map((t, i) => {
        const ex = toX(t.entryIdx);
        const xx = toX(t.exitIdx);
        const ey = toY(t.entry);
        const win = t.win;
        return (
          <g key={i}>
            {/* 손절~익절 밴드 */}
            <line x1={ex} x2={ex} y1={toY(t.stop)} y2={toY(t.target)} stroke="#333" strokeWidth="0.4" />
            {/* 진입 삼각형 */}
            <path
              d={`M${ex},${ey + 4} L${ex - 3},${ey + 9} L${ex + 3},${ey + 9} Z`}
              fill="#00e676"
            />
            {/* 청산 지점 (승=초록 원, 패=빨강 x) */}
            <circle cx={xx} cy={toY(t.exit)} r="1.6" fill={win ? '#00e676' : '#ff1744'} />
            {/* 진입→청산 결과선 */}
            <line
              x1={ex} y1={ey} x2={xx} y2={toY(t.exit)}
              stroke={win ? '#00e67666' : '#ff174466'} strokeWidth="0.5" strokeDasharray="2,1.5"
            />
          </g>
        );
      })}
    </svg>
  );
}
