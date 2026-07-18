'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  generateBars,
  runBacktest,
  DEFAULT_PARAMS,
  type BacktestParams,
  type Bar,
} from '../lib/backtest';
import StrategyChart from './StrategyChart';

const CAPITAL = 10000; // 시작 자본 ($)
const RISK_PCT = 0.01; // 1 트레이드당 계좌 리스크 1%

const SYMBOLS: { code: string; label: string }[] = [
  { code: '005930.KS', label: '삼성전자' },
  { code: 'SPY', label: 'SPY' },
  { code: 'QQQ', label: 'QQQ' },
  { code: 'BTC-USD', label: 'BTC' },
];

type Source = 'LOADING' | 'LIVE' | 'SIM';

export default function BacktestPanel() {
  const [seed, setSeed] = useState(12345);
  const [rMultiple, setRMultiple] = useState(DEFAULT_PARAMS.rMultiple);
  const [symbol, setSymbol] = useState(SYMBOLS[0].code);
  const [realBars, setRealBars] = useState<Bar[] | null>(null);
  const [source, setSource] = useState<Source>('LOADING');

  // 실시세 요청 → 성공 시 LIVE, 차단/실패 시 SIM 폴백
  useEffect(() => {
    let cancelled = false;
    setSource('LOADING');
    setRealBars(null);
    fetch(`/api/ohlc?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { bars?: Bar[] }) => {
        if (cancelled) return;
        if (Array.isArray(d.bars) && d.bars.length > 60) {
          setRealBars(d.bars);
          setSource('LIVE');
        } else {
          setSource('SIM');
        }
      })
      .catch(() => {
        if (!cancelled) setSource('SIM');
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const params: BacktestParams = useMemo(
    () => ({ ...DEFAULT_PARAMS, rMultiple }),
    [rMultiple],
  );

  const { stats, bars, trades, fast, slow } = useMemo(() => {
    // 실데이터가 있으면 사용, 없으면 결정적 합성 데이터
    const b = realBars ?? generateBars(900, 80000, seed);
    const res = runBacktest(b, params);
    return { ...res, bars: b };
  }, [realBars, seed, params]);

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
    <div className="panel flex flex-col h-full" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
      <div className="panel-header justify-between" style={{ whiteSpace: 'nowrap' }}>
        <div className="flex items-center gap-2" style={{ minWidth: 0, overflow: 'hidden' }}>
          <span className="dot-green" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>PULLBACK · BACKTEST</span>
        </div>
        <span
          style={{
            fontSize: 8,
            fontWeight: 'bold',
            padding: '1px 5px',
            borderRadius: 2,
            color: source === 'LIVE' ? '#00e676' : source === 'SIM' ? '#ffd740' : '#666',
            border: `1px solid ${source === 'LIVE' ? '#00e67655' : source === 'SIM' ? '#ffd74055' : '#333'}`,
          }}
          title={
            source === 'SIM'
              ? '실시세 egress 차단/실패 → 합성 데이터로 폴백'
              : source === 'LIVE'
                ? 'Yahoo Finance 실시세 일봉'
                : '데이터 로딩 중'
          }
        >
          {source === 'LOADING' ? '···' : source === 'LIVE' ? '● LIVE' : '◐ SIM'}
        </span>
      </div>

      {/* 심볼 선택 */}
      <div
        className="flex items-center gap-1 px-2 py-1 flex-wrap"
        style={{ borderBottom: '1px solid #1c1c1c', background: '#0a0a0a' }}
      >
        <span style={{ color: '#444', fontSize: 8, marginRight: 2 }}>SYMBOL</span>
        {SYMBOLS.map((s) => (
          <button
            key={s.code}
            onClick={() => setSymbol(s.code)}
            style={{
              padding: '1px 6px',
              fontSize: 9,
              border: `1px solid ${symbol === s.code ? '#448aff' : '#2a2a2a'}`,
              background: symbol === s.code ? '#448aff22' : 'transparent',
              color: symbol === s.code ? '#448aff' : '#666',
              cursor: 'pointer',
              borderRadius: 2,
            }}
          >
            {s.label}
          </button>
        ))}
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

      {/* 전략 차트: 캔들 + EMA + 진입/청산 마커 */}
      <div className="px-2 pt-2 pb-1" style={{ borderBottom: '1px solid #1c1c1c' }}>
        <div className="flex justify-between px-1" style={{ fontSize: 8, color: '#444', marginBottom: 2 }}>
          <span>SETUP MAP · 캔들 + 추세선 + 진입/청산</span>
          <span>{bars.length} bars</span>
        </div>
        <StrategyChart bars={bars} fast={fast} slow={slow} trades={trades} />
        <div className="flex gap-3 px-1" style={{ fontSize: 8, color: '#555', marginTop: 3 }}>
          <span style={{ color: '#448aff' }}>— EMA{DEFAULT_PARAMS.emaFast}</span>
          <span style={{ color: '#ffd740' }}>— EMA{DEFAULT_PARAMS.emaSlow}</span>
          <span style={{ color: '#00e676' }}>▲ 진입</span>
          <span style={{ color: '#00e676' }}>● 익절</span>
          <span style={{ color: '#ff1744' }}>● 손절</span>
        </div>
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
      <div className="px-3 py-2 flex flex-col gap-2">
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
        {source === 'LIVE' ? (
          <div
            style={{
              padding: '4px',
              fontSize: 9,
              border: '1px solid #00e67633',
              background: '#0a1a10',
              color: '#00e676',
              borderRadius: 2,
              textAlign: 'center',
            }}
          >
            ● 실시세 {symbol} · {bars.length} 일봉
          </div>
        ) : (
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
            ↻ 새 합성데이터로 재검증 (seed #{seed % 10000})
          </button>
        )}
      </div>
    </div>
  );
}
