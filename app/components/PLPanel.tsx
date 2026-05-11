'use client';
import { useState, useEffect } from 'react';

const RECENT = [
  { time: '19:24', side: 'BUY', price: 80241, size: 0.5, pnl: 14000 },
  { time: '18:51', side: 'SELL', price: 79830, size: 0.3, pnl: -3200 },
  { time: '17:33', side: 'BUY', price: 78500, size: 1.0, pnl: 22000 },
  { time: '16:12', side: 'SELL', price: 77900, size: 0.8, pnl: 9100 },
  { time: '15:40', side: 'BUY', price: 76200, size: 0.2, pnl: -1400 },
];

export default function PLPanel() {
  const [pnl, setPnl] = useState(42000);
  const [trades] = useState(485);
  const [bigStreak] = useState(56);
  const [nextTarget] = useState(25);

  useEffect(() => {
    const id = setInterval(() => setPnl(p => p + (Math.random() - 0.45) * 120), 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      <div className="panel-header justify-between">
        <span>PERFORMANCE</span>
        <span style={{ color: '#ffd740', fontSize: 9 }}>LAST 485 TRADES</span>
      </div>

      {/* Big PnL */}
      <div className="px-3 py-3" style={{ borderBottom: '1px solid #1c1c1c', background: '#0a0a0a' }}>
        <div style={{ color: '#444', fontSize: 9, marginBottom: 2 }}>TOTAL P&L</div>
        <div className={pnl >= 0 ? 'green' : 'red'} style={{ fontSize: 36, fontWeight: 'bold', fontFamily: 'Courier New', lineHeight: 1 }}>
          {pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
        </div>
        <div style={{ color: '#333', fontSize: 9, marginTop: 2 }}>1,247 TRADES · BTG · 1.49s</div>
      </div>

      {/* Sub stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, borderBottom: '1px solid #1c1c1c' }}>
        {[
          { label: 'TODAY', value: `+$${(pnl * 0.12).toFixed(0)}`, color: '#00e676' },
          { label: 'WEEK', value: `+$42,000`, color: '#00e676' },
          { label: 'MAX DD', value: '-$14,000', color: '#ff1744' },
          { label: 'SHARPE', value: '2.41', color: '#ffd740' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#111', padding: '6px 10px', borderBottom: '1px solid #1c1c1c' }}>
            <div style={{ color: '#444', fontSize: 9 }}>{label}</div>
            <div style={{ color, fontSize: 13, fontWeight: 'bold', marginTop: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Streak + Target */}
      <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid #1c1c1c' }}>
        <div>
          <div style={{ color: '#444', fontSize: 9 }}>BIG STREAK</div>
          <div style={{ color: '#ffd740', fontSize: 20, fontWeight: 'bold' }}>{bigStreak}</div>
        </div>
        <div style={{ width: 1, height: 32, background: '#1c1c1c' }} />
        <div>
          <div style={{ color: '#444', fontSize: 9 }}>NEXT TARGET</div>
          <div className="white" style={{ fontSize: 20, fontWeight: 'bold' }}>{nextTarget}</div>
        </div>
        <div style={{ width: 1, height: 32, background: '#1c1c1c' }} />
        <div>
          <div style={{ color: '#444', fontSize: 9 }}>RATE/HR</div>
          <div style={{ color: '#448aff', fontSize: 14, fontWeight: 'bold' }}>$8,350</div>
        </div>
      </div>

      {/* Recent trades */}
      <div className="px-2 py-1" style={{ borderBottom: '1px solid #1c1c1c', fontSize: 9, color: '#444' }}>
        RECENT TRADES
      </div>
      <div className="flex-1 overflow-auto">
        {RECENT.map((t, i) => (
          <div key={i} className="flex items-center px-2 py-1 gap-2 slide-in"
            style={{ borderBottom: '1px solid #111', fontSize: 10 }}>
            <span style={{ color: '#333' }}>{t.time}</span>
            <span style={{ color: t.side === 'BUY' ? '#00e676' : '#ff1744', minWidth: 28 }}>{t.side}</span>
            <span className="white" style={{ flex: 1 }}>{t.price.toLocaleString()}</span>
            <span style={{ color: '#555' }}>{t.size}BTC</span>
            <span style={{ color: t.pnl >= 0 ? '#00e676' : '#ff1744', minWidth: 52, textAlign: 'right' }}>
              {t.pnl >= 0 ? '+' : ''}${Math.abs(t.pnl).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
