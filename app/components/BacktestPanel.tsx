'use client';
import { useMemo, useState } from 'react';
import {
  generateBars,
  runBacktest,
  DEFAULT_PARAMS,
  type BacktestParams,
} from '../lib/backtest';

const CAPITAL = 10000; // 시작 자본 ($)
const RISK_PCT = 0.01; // 1 트레이드당 계좌 리스크 1%

export default function BacktestPanel() {
  const [seed, setSeed] = useState(12345);
  const [rMultiple, setRMultiple] = useState(DEFAULT_PARAMS.rMultiple);

  const params: BacktestParams = useMemo(
    () => ({ ...DEFAULT_PARAMS, rMultiple }),
    [rMultiple],
  );

  const { stats } = useMemo(() => {
    const bars = generateBars(900, 80000, seed);
    return runBacktest(bars, params);
  }, [seed, params]);

  // R 단위 성과를 $ 로 환산 (트레이드당 계좌의 RISK_PCT 만큼 리스크)
  const equity$ = useMemo(() => {
    let eq = CAPITAL;
    return stats.equityR.length
      ? stats.equityR.map((_, idx) => {
          const stepR =
            idx === 0
              ? stats.equityR[0]
              : stats.equityR[idx] - stats.equityR[idx - 1];
          eq += eq * RISK_PCT * stepR;
          return eq;
        })
      : [];
  }, [stats]);

  const finalPnl = (equity$.length ? equity$[equity$.length - 1] : CAPITAL) - CAPITAL;
  const positive = stats.avgR > 0;

  // equity 커브 SVG (R 누적)
  const W = 260, H = 60;
  const curve = stats.equityR;
  const minV = Math.min(0, ...curve);
  const maxV = Math.max(0, ...curve);
  const span = maxV - minV || 1;
  const path = curve
    .map((v, i) => {
      const x = (i / Math.max(1, curve.length - 1)) * W;
      const y = H - ((v - minV) / span) * H;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const zeroY = H - ((0 - minV) / span) * H;

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { maximumFractionDigits: 0 });

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <span className="dot-green" />
          <span>TRENDLINE PULLBACK · BACKTEST</span>
        </div>
        <span style={{ color: '#ffd740', fontSize: 9 }}>BORING MODE</span>
      </div>

      {/* 판정 배너 */}
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{
          borderBottom: '1px solid #1c1c1c',
          background: positive ? '#0a1a10' : '#1a0a0a',
        }}
      >
        <div>
          <div style={{ color: '#444', fontSize: 9 }}>기대값 (평균 R)</div>
          <div
            style={{
              color: positive ? '#00e676' : '#ff1744',
              fontSize: 22,
              fontWeight: 'bold',
              fontFamily: 'Courier New',
            }}
          >
            {stats.avgR >= 0 ? '+' : ''}
            {stats.avgR.toFixed(3)}R
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#444', fontSize: 9 }}>
            판정 {positive ? '(양의 기대값)' : '(음의 기대값)'}
          </div>
          <div
            style={{
              color: positive ? '#00e676' : '#ff1744',
              fontSize: 12,
              fontWeight: 'bold',
            }}
          >
            {positive ? '✓ 통계적 우위 있음' : '✗ 우위 없음'}
          </div>
        </div>
      </div>

      {/* 스탯 그리드 */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: '1fr 1fr 1fr',
          borderBottom: '1px solid #1c1c1c',
        }}
      >
        {[
          { label: 'TRADES', value: `${stats.trades}`, color: '#fff' },
          {
            label: 'WIN RATE',
            value: `${stats.winRate.toFixed(1)}%`,
            color: stats.winRate >= 40 ? '#00e676' : '#ffd740',
          },
          {
            label: 'PROFIT FACTOR',
            value: Number.isFinite(stats.profitFactor)
              ? stats.profitFactor.toFixed(2)
              : '∞',
            color: stats.profitFactor >= 1 ? '#00e676' : '#ff1744',
          },
          {
            label: 'TOTAL R',
            value: `${stats.totalR >= 0 ? '+' : ''}${stats.totalR.toFixed(1)}R`,
            color: stats.totalR >= 0 ? '#00e676' : '#ff1744',
          },
          {
            label: 'MAX DD',
            value: `${stats.maxDrawdownR.toFixed(1)}R`,
            color: '#ff1744',
          },
          {
            label: 'W / L',
            value: `${stats.wins} / ${stats.losses}`,
            color: '#888',
          },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding: '6px 10px',
              borderRight: '1px solid #141414',
              borderBottom: '1px solid #141414',
            }}
          >
            <div style={{ color: '#444', fontSize: 8 }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: 14, fontWeight: 'bold' }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Equity 커브 */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid #1c1c1c' }}>
        <div className="flex justify-between" style={{ fontSize: 8, color: '#444', marginBottom: 2 }}>
          <span>EQUITY CURVE (누적 R)</span>
          <span>{stats.trades} trades</span>
        </div>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
          <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="#333" strokeWidth="0.5" strokeDasharray="3,3" />
          {path && (
            <path
              d={path}
              fill="none"
              stroke={stats.totalR >= 0 ? '#00e676' : '#ff1744'}
              strokeWidth="1.2"
            />
          )}
        </svg>
      </div>

      {/* $ 환산 (계좌 1% 리스크 가정) */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid #1c1c1c' }}>
        <div style={{ color: '#444', fontSize: 8, marginBottom: 2 }}>
          $ 환산 · 시작 ${fmt(CAPITAL)} · 트레이드당 리스크 {(RISK_PCT * 100).toFixed(0)}%
        </div>
        <div className="flex items-baseline gap-2">
          <span
            style={{
              color: finalPnl >= 0 ? '#00e676' : '#ff1744',
              fontSize: 18,
              fontWeight: 'bold',
              fontFamily: 'Courier New',
            }}
          >
            {finalPnl >= 0 ? '+' : '-'}${fmt(Math.abs(finalPnl))}
          </span>
          <span style={{ color: '#555', fontSize: 9 }}>
            → ${fmt(CAPITAL + finalPnl)}
          </span>
        </div>
      </div>

      {/* 컨트롤 */}
      <div className="px-3 py-2 flex flex-col gap-2" style={{ marginTop: 'auto' }}>
        <div className="flex items-center justify-between">
          <span style={{ color: '#444', fontSize: 9 }}>손익비 (R:R)</span>
          <div className="flex gap-1">
            {[1.5, 2, 3].map((r) => (
              <button
                key={r}
                onClick={() => setRMultiple(r)}
                style={{
                  padding: '2px 8px',
                  fontSize: 9,
                  border: `1px solid ${rMultiple === r ? '#00e676' : '#2a2a2a'}`,
                  background: rMultiple === r ? '#00e67622' : 'transparent',
                  color: rMultiple === r ? '#00e676' : '#666',
                  cursor: 'pointer',
                  borderRadius: 2,
                }}
              >
                1:{r}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setSeed((s) => (s + 2654435761) % 2147483647)}
          style={{
            padding: '4px',
            fontSize: 9,
            border: '1px solid #2a2a2a',
            background: '#111',
            color: '#888',
            cursor: 'pointer',
            borderRadius: 2,
          }}
        >
          ↻ 새 데이터로 재검증 (seed #{seed % 10000})
        </button>
      </div>
    </div>
  );
}
