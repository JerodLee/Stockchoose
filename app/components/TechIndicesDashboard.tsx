'use client';
import { useState, useEffect } from 'react';

const HISTORY_LEN = 30;

function addToHistory(arr: number[], val: number): number[] {
  const next = [...arr, val];
  return next.length > HISTORY_LEN ? next.slice(-HISTORY_LEN) : next;
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 76;
  const H = 26;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * W},${H - ((v - min) / range) * H}`)
    .join(' ');
  return (
    <svg width={W} height={H} style={{ overflow: 'visible', display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

function StrengthBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  return (
    <div style={{ background: '#111', height: 5, borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        width: `${(value / max) * 100}%`, height: '100%',
        background: `linear-gradient(90deg, ${color}66, ${color})`,
        borderRadius: 3, transition: 'width 0.5s ease',
      }} />
    </div>
  );
}

function signalColor(val: number, mid = 50) {
  return val > mid + 15 ? '#00e676' : val > mid - 15 ? '#ffd740' : '#ff1744';
}

interface RutState {
  price: number;
  change: number;
  premium: number;
  breadth: number;
  hist: number[];
}

interface SoxState {
  level: number;
  change: number;
  bullRatio: number;
  hist: number[];
  stocks: { ticker: string; chg: number }[];
}

interface AiState {
  corr: number;
  momentum: number;
  hist: number[];
  stocks: { ticker: string; chg: number }[];
}

function initHistory(base: number, step: number, noise: number): number[] {
  return Array.from({ length: HISTORY_LEN }, (_, i) => base + i * step + (Math.random() - 0.5) * noise);
}

export default function TechIndicesDashboard() {
  const [rut, setRut] = useState<RutState>({
    price: 2108.40,
    change: 0.64,
    premium: 12,
    breadth: 62,
    hist: initHistory(2080, 1.2, 8),
  });

  const [sox, setSox] = useState<SoxState>({
    level: 4821.30,
    change: 1.42,
    bullRatio: 73,
    hist: initHistory(4750, 2.4, 20),
    stocks: [
      { ticker: 'NVDA', chg: 2.14 },
      { ticker: 'AMD',  chg: 0.87 },
      { ticker: 'AVGO', chg: 1.56 },
      { ticker: 'INTC', chg: -0.33 },
      { ticker: 'QCOM', chg: 0.71 },
      { ticker: 'AMAT', chg: 1.03 },
    ],
  });

  const [ai, setAi] = useState<AiState>({
    corr: 74,
    momentum: 68,
    hist: initHistory(60, 0.4, 12),
    stocks: [
      { ticker: 'NVDA',  chg: 2.14 },
      { ticker: 'MSFT',  chg: 0.55 },
      { ticker: 'META',  chg: 1.08 },
      { ticker: 'GOOGL', chg: 0.42 },
      { ticker: 'PLTR',  chg: 3.21 },
      { ticker: 'AMZN',  chg: 0.74 },
    ],
  });

  useEffect(() => {
    const id = setInterval(() => {
      setRut(r => {
        const p = +(r.price + (Math.random() - 0.48) * 2.5).toFixed(2);
        const c = +(r.change + (Math.random() - 0.5) * 0.12).toFixed(2);
        return {
          price: p,
          change: c,
          premium: Math.round(r.premium + (Math.random() - 0.5) * 3),
          breadth: Math.min(100, Math.max(0, r.breadth + (Math.random() - 0.5) * 4)),
          hist: addToHistory(r.hist, p),
        };
      });

      setSox(s => {
        const l = +(s.level + (Math.random() - 0.47) * 8).toFixed(2);
        const c = +(s.change + (Math.random() - 0.5) * 0.2).toFixed(2);
        return {
          level: l, change: c,
          bullRatio: Math.min(100, Math.max(0, s.bullRatio + (Math.random() - 0.5) * 4)),
          hist: addToHistory(s.hist, l),
          stocks: s.stocks.map(st => ({ ...st, chg: +(st.chg + (Math.random() - 0.5) * 0.3).toFixed(2) })),
        };
      });

      setAi(a => {
        const corr = Math.min(100, Math.max(-100, a.corr + (Math.random() - 0.5) * 3));
        return {
          corr: +corr.toFixed(1),
          momentum: Math.min(100, Math.max(0, a.momentum + (Math.random() - 0.5) * 3)),
          hist: addToHistory(a.hist, corr),
          stocks: a.stocks.map(st => ({ ...st, chg: +(st.chg + (Math.random() - 0.5) * 0.3).toFixed(2) })),
        };
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const rutColor = signalColor(rut.breadth);
  const soxColor = signalColor(sox.bullRatio);
  const aiCorrColor = ai.corr > 40 ? '#448aff' : ai.corr > 0 ? '#ffd740' : '#ff6b35';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #1c1c1c', flexShrink: 0 }}>

      {/* ── Russell 2000 Futures ── */}
      <div style={{ background: '#0d0d0d', borderRight: '1px solid #1c1c1c' }}>
        <div className="panel-header justify-between">
          <span>RTY · 러셀2000 선물</span>
          <span className="blink" style={{ color: '#00e676', fontSize: 8 }}>● LIVE</span>
        </div>
        <div style={{ padding: '6px 10px' }}>
          <div className="flex items-baseline gap-2">
            <span style={{ fontSize: 20, fontWeight: 'bold', color: '#fff', fontFamily: 'Courier New' }}>
              {rut.price.toFixed(2)}
            </span>
            <span style={{ fontSize: 11, fontWeight: 'bold', color: rut.change >= 0 ? '#00e676' : '#ff1744' }}>
              {rut.change >= 0 ? '+' : ''}{rut.change}%
            </span>
            <span style={{ fontSize: 9, color: '#444', marginLeft: 'auto' }}>
              선물 프리미엄
              <span style={{ color: rut.premium >= 0 ? '#00e676' : '#ff1744', marginLeft: 4, fontWeight: 'bold' }}>
                {rut.premium >= 0 ? '+' : ''}{rut.premium}bp
              </span>
            </span>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <Sparkline values={rut.hist} color={rut.change >= 0 ? '#00e676' : '#ff1744'} />
            <div style={{ flex: 1 }}>
              <div className="flex justify-between mb-1" style={{ fontSize: 9 }}>
                <span style={{ color: '#444' }}>소형주 강도</span>
                <span style={{ color: rutColor, fontWeight: 'bold' }}>{rut.breadth.toFixed(0)}%</span>
              </div>
              <StrengthBar value={rut.breadth} color={rutColor} />
              <div style={{
                marginTop: 4, fontSize: 9, fontWeight: 'bold',
                color: rut.breadth > 65 ? '#00e676' : rut.breadth > 50 ? '#c8e676' : rut.breadth > 35 ? '#ffd740' : '#ff1744',
              }}>
                {rut.breadth > 65 ? '강한 상승 모멘텀' : rut.breadth > 50 ? '약한 상승 우위' : rut.breadth > 35 ? '중립 / 혼조' : '하락 압력'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SOX Semiconductor ── */}
      <div style={{ background: '#0d0d0d', borderRight: '1px solid #1c1c1c' }}>
        <div className="panel-header justify-between">
          <span>SOX · 반도체 지수</span>
          <span style={{ color: '#ffd740', fontSize: 8 }}>PHLX</span>
        </div>
        <div style={{ padding: '6px 10px' }}>
          <div className="flex items-baseline gap-2">
            <span style={{ fontSize: 20, fontWeight: 'bold', color: '#fff', fontFamily: 'Courier New' }}>
              {sox.level.toFixed(2)}
            </span>
            <span style={{ fontSize: 11, fontWeight: 'bold', color: sox.change >= 0 ? '#00e676' : '#ff1744' }}>
              {sox.change >= 0 ? '+' : ''}{sox.change}%
            </span>
            <span style={{ fontSize: 9, color: '#444', marginLeft: 'auto' }}>
              강세 비율
              <span style={{ color: soxColor, marginLeft: 4, fontWeight: 'bold' }}>{sox.bullRatio.toFixed(0)}%</span>
            </span>
          </div>

          <div className="flex items-start gap-3 mt-2">
            <div>
              <Sparkline values={sox.hist} color={sox.change >= 0 ? '#00e676' : '#ff1744'} />
              <div style={{ marginTop: 4 }}>
                <StrengthBar value={sox.bullRatio} color={soxColor} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 4px', flex: 1 }}>
              {sox.stocks.map(s => (
                <div key={s.ticker} className="flex justify-between"
                  style={{ background: '#0a0a0a', padding: '2px 5px', borderRadius: 2, fontSize: 9 }}>
                  <span style={{ color: '#555' }}>{s.ticker}</span>
                  <span style={{ color: s.chg >= 0 ? '#00e676' : '#ff1744', fontWeight: 'bold' }}>
                    {s.chg >= 0 ? '+' : ''}{s.chg}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Theme Correlation ── */}
      <div style={{ background: '#0d0d0d' }}>
        <div className="panel-header justify-between">
          <span>AI 테마 동조율</span>
          <span style={{ color: '#448aff', fontSize: 8 }}>vs SPY</span>
        </div>
        <div style={{ padding: '6px 10px' }}>
          <div className="flex items-baseline gap-2">
            <span style={{ fontSize: 20, fontWeight: 'bold', color: '#fff', fontFamily: 'Courier New' }}>
              {ai.corr.toFixed(1)}
            </span>
            <span style={{ fontSize: 10, color: '#444' }}>/ 100</span>
            <span style={{ fontSize: 10, fontWeight: 'bold', color: aiCorrColor, marginLeft: 4 }}>
              {ai.corr > 60 ? '강한 동조' : ai.corr > 20 ? '약한 동조' : ai.corr > -20 ? '비동조' : '역동조'}
            </span>
            <span style={{ fontSize: 9, color: '#444', marginLeft: 'auto' }}>
              모멘텀 <span style={{ color: signalColor(ai.momentum), fontWeight: 'bold' }}>{ai.momentum.toFixed(0)}</span>
            </span>
          </div>

          <div className="flex items-start gap-3 mt-2">
            <div>
              <Sparkline values={ai.hist} color={aiCorrColor} />
              {/* Bipolar correlation bar */}
              <div style={{ position: 'relative', background: '#111', height: 5, borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: '#2a2a2a', zIndex: 1 }} />
                {ai.corr >= 0 ? (
                  <div style={{
                    position: 'absolute', left: '50%',
                    width: `${(ai.corr / 100) * 50}%`, height: '100%',
                    background: '#448aff', borderRadius: '0 3px 3px 0', transition: 'width 0.5s',
                  }} />
                ) : (
                  <div style={{
                    position: 'absolute',
                    left: `${50 + (ai.corr / 100) * 50}%`,
                    width: `${(Math.abs(ai.corr) / 100) * 50}%`, height: '100%',
                    background: '#ff6b35', borderRadius: '3px 0 0 3px', transition: 'all 0.5s',
                  }} />
                )}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 4px', flex: 1 }}>
              {ai.stocks.map(s => (
                <div key={s.ticker} className="flex justify-between"
                  style={{ background: '#0a0a0a', padding: '2px 5px', borderRadius: 2, fontSize: 9 }}>
                  <span style={{ color: '#555' }}>{s.ticker}</span>
                  <span style={{ color: s.chg >= 0 ? '#00e676' : '#ff1744', fontWeight: 'bold' }}>
                    {s.chg >= 0 ? '+' : ''}{s.chg}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
