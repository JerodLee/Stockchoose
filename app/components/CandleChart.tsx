'use client';
import { useState, useEffect, useMemo } from 'react';

interface Candle { open: number; high: number; low: number; close: number; }

function generateCandles(count: number, base: number): Candle[] {
  const candles: Candle[] = [];
  let price = base;
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.47) * price * 0.018;
    const open = price;
    price += change;
    const close = price;
    const wick = price * 0.006;
    const high = Math.max(open, close) + Math.random() * wick;
    const low = Math.min(open, close) - Math.random() * wick;
    candles.push({ open, high, low, close });
  }
  return candles;
}

export default function CandleChart() {
  const [candles, setCandles] = useState<Candle[]>(() => generateCandles(60, 78000));
  const [currentPrice, setCurrentPrice] = useState(80519);

  useEffect(() => {
    const id = setInterval(() => {
      const newPrice = currentPrice + (Math.random() - 0.49) * 80;
      setCurrentPrice(newPrice);
      setCandles(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        updated[updated.length - 1] = {
          ...last,
          close: newPrice,
          high: Math.max(last.high, newPrice),
          low: Math.min(last.low, newPrice),
        };
        return updated;
      });
    }, 1200);
    return () => clearInterval(id);
  }, [currentPrice]);

  const W = 580, H = 220;
  const PAD = { top: 10, right: 60, bottom: 24, left: 8 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const { minP, maxP, candleW } = useMemo(() => {
    const allPrices = candles.flatMap(c => [c.high, c.low]);
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    const pad = (max - min) * 0.05;
    return { minP: min - pad, maxP: max + pad, candleW: Math.floor(chartW / candles.length) - 1 };
  }, [candles, chartW]);

  const toY = (p: number) => PAD.top + chartH - ((p - minP) / (maxP - minP)) * chartH;
  const toX = (i: number) => PAD.left + i * (chartW / candles.length) + candleW / 2;

  const yLabels = Array.from({ length: 5 }, (_, i) => minP + (maxP - minP) * (i / 4));
  const isUp = (c: Candle) => c.close >= c.open;

  return (
    <div className="panel flex flex-col h-full">
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <span className="dot-green blink" />
          <span>BTC / USD</span>
          <span style={{ background: '#ff1744', color: '#fff', padding: '1px 4px', fontSize: 9, borderRadius: 2 }}>1m</span>
        </div>
        <div className="flex items-center gap-3">
          {['1m','5m','15m','1h','4h','1D'].map(t => (
            <span key={t} style={{ color: t === '1m' ? '#fff' : '#333', cursor: 'pointer', fontSize: 9 }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Price display */}
      <div className="px-3 py-1 flex items-baseline gap-3" style={{ borderBottom: '1px solid #1c1c1c' }}>
        <span style={{ fontSize: 28, fontWeight: 'bold', color: '#00e676', fontFamily: 'Courier New' }}>
          ${currentPrice.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
        </span>
        <span style={{ color: '#ff1744', fontSize: 13 }}>▼ 4,324</span>
      </div>

      {/* SVG Chart */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
          style={{ display: 'block' }}>

          {/* Grid lines */}
          {yLabels.map((price, i) => (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={toY(price)} y2={toY(price)}
                stroke="#1a1a1a" strokeWidth="0.5" strokeDasharray="3,3" />
              <text x={W - PAD.right + 4} y={toY(price) + 3}
                fill="#444" fontSize="8" fontFamily="Courier New">
                {(price / 1000).toFixed(1)}k
              </text>
            </g>
          ))}

          {/* Current price line */}
          <line x1={PAD.left} x2={W - PAD.right} y1={toY(currentPrice)} y2={toY(currentPrice)}
            stroke="#00e676" strokeWidth="0.5" strokeDasharray="4,2" opacity="0.6" />
          <rect x={W - PAD.right} y={toY(currentPrice) - 7} width={PAD.right - 2} height={13}
            fill="#00e676" rx="1" />
          <text x={W - PAD.right + 3} y={toY(currentPrice) + 3}
            fill="#000" fontSize="8" fontFamily="Courier New" fontWeight="bold">
            {(currentPrice / 1000).toFixed(2)}k
          </text>

          {/* Candles */}
          {candles.map((c, i) => {
            const x = toX(i);
            const up = isUp(c);
            const color = up ? '#00e676' : '#ff1744';
            const bodyTop = toY(Math.max(c.open, c.close));
            const bodyH = Math.max(1, Math.abs(toY(c.open) - toY(c.close)));
            return (
              <g key={i}>
                <line x1={x} x2={x} y1={toY(c.high)} y2={toY(c.low)} stroke={color} strokeWidth="0.8" />
                <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH}
                  fill={up ? color : 'transparent'} stroke={color} strokeWidth="0.8" />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Bottom stats */}
      <div className="px-3 py-1 flex gap-4" style={{ borderTop: '1px solid #1c1c1c', fontSize: 9, color: '#444' }}>
        <span>O <span className="white">79,841</span></span>
        <span>H <span style={{ color: '#00e676' }}>81,203</span></span>
        <span>L <span style={{ color: '#ff1744' }}>78,964</span></span>
        <span>C <span className="white">{currentPrice.toFixed(0)}</span></span>
        <span className="ml-auto">VOL <span className="white">$50,531</span></span>
      </div>
    </div>
  );
}
