'use client';
import { useState, useEffect } from 'react';

export default function AgentCard() {
  const [pnl, setPnl] = useState(-2416);
  const [trades] = useState(1338);
  const [winRate] = useState(70.4);
  const [rating] = useState(8.6);
  const [streak, setStreak] = useState(5);

  useEffect(() => {
    const id = setInterval(() => {
      setPnl(p => p + (Math.random() - 0.45) * 80);
      setStreak(s => Math.max(0, s + (Math.random() > 0.7 ? 1 : 0)));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const ratingColor = rating >= 8 ? '#00e676' : rating >= 6 ? '#ffd740' : '#ff1744';

  return (
    <div className="panel flex flex-col h-full">
      <div className="panel-header">
        <span className="dot-green" />
        AGENT PROFILE
      </div>

      <div className="p-2 flex flex-col gap-2 flex-1">
        {/* Agent ID */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 3, padding: '6px 8px' }}>
          <div style={{ color: '#555', fontSize: 9, marginBottom: 2 }}>AGENT ID</div>
          <div className="white font-bold" style={{ fontSize: 12 }}>g0bble0nt0b</div>
          <div style={{ color: '#444', fontSize: 9 }}>market · btcalgo · polymarket</div>
        </div>

        {/* PnL */}
        <div style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: 3, padding: '8px' }}>
          <div style={{ color: '#555', fontSize: 9 }}>ALL TIME PNL</div>
          <div className={pnl >= 0 ? 'green' : 'red'} style={{ fontSize: 22, fontWeight: 'bold', marginTop: 2 }}>
            {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          </div>
          <div style={{ color: '#333', fontSize: 9 }}>· ALL TIME · {trades} TRADES</div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
          {[
            { label: 'TRADES', value: trades.toLocaleString() },
            { label: 'WIN %', value: `${winRate}%` },
            { label: 'AVG R', value: '2.41' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#111', border: '1px solid #1c1c1c', borderRadius: 3, padding: '6px 4px', textAlign: 'center' }}>
              <div style={{ color: '#444', fontSize: 8, marginBottom: 2 }}>{label}</div>
              <div className="white" style={{ fontSize: 11, fontWeight: 'bold' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Rating */}
        <div style={{ background: '#111', border: '1px solid #1c1c1c', borderRadius: 3, padding: '6px 8px' }}>
          <div style={{ color: '#444', fontSize: 9, marginBottom: 4 }}>LIVE SCORE</div>
          <div className="flex items-center gap-2">
            <div style={{ color: ratingColor, fontSize: 18, fontWeight: 'bold' }}>{rating}/10</div>
            <div style={{ flex: 1, background: '#0a0a0a', height: 6, borderRadius: 3 }}>
              <div style={{ width: `${rating * 10}%`, background: ratingColor, height: '100%', borderRadius: 3, transition: 'width 0.5s' }} />
            </div>
          </div>
          <div style={{ color: '#333', fontSize: 9, marginTop: 2 }}>STREAK: <span style={{ color: '#ffd740' }}>{streak}</span></div>
        </div>

        {/* Win rate bar */}
        <div style={{ background: '#111', border: '1px solid #1c1c1c', borderRadius: 3, padding: '6px 8px' }}>
          <div className="flex justify-between mb-1" style={{ fontSize: 9, color: '#555' }}>
            <span>WIN RATE</span><span className="white">{winRate}%</span>
          </div>
          <div style={{ background: '#0a0a0a', height: 8, borderRadius: 2 }}>
            <div style={{ width: `${winRate}%`, background: 'linear-gradient(90deg, #00e676, #69f0ae)', height: '100%', borderRadius: 2 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
