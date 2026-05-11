'use client';
import { useState, useEffect } from 'react';

const TICKERS = ['BTC/USD', 'NVDA', '삼성전자', 'KOSPI200', 'SPY', 'TSLA'];

export default function TopBar() {
  const [time, setTime] = useState('');
  const [price, setPrice] = useState(80519);
  const [change, setChange] = useState(2.24);
  const [ticker, setTicker] = useState('BTC/USD');
  const [trades] = useState(1338);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toTimeString().slice(0, 8) + ' KST');
      setPrice(p => p + (Math.random() - 0.495) * 40);
      setChange(c => +(c + (Math.random() - 0.5) * 0.1).toFixed(2));
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ background: '#0a0a0a', borderBottom: '1px solid #1c1c1c' }}
      className="flex items-center gap-0 h-9 text-[10px] shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 h-full" style={{ background: '#151515', borderRight: '1px solid #1c1c1c', minWidth: 160 }}>
        <div className="w-5 h-5 rounded flex items-center justify-center text-white font-bold text-xs" style={{ background: '#1a1a1a', border: '1px solid #333' }}>
          SC
        </div>
        <div>
          <div className="text-white font-bold tracking-wide">STOCKCHOOSE</div>
          <div style={{ color: '#444', fontSize: 9 }}>TERMINAL v2.1</div>
        </div>
      </div>

      {/* Ticker selector */}
      <div className="flex h-full" style={{ borderRight: '1px solid #1c1c1c' }}>
        {TICKERS.map(t => (
          <button key={t} onClick={() => setTicker(t)}
            className="px-3 h-full text-[10px] transition-colors"
            style={{
              color: ticker === t ? '#fff' : '#444',
              background: ticker === t ? '#161616' : 'transparent',
              borderBottom: ticker === t ? '2px solid #00e676' : '2px solid transparent',
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-2 px-4">
        <span className="text-[22px] font-bold" style={{ color: '#00e676', fontFamily: 'Courier New' }}>
          ${price.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
        </span>
        <span className={change >= 0 ? 'green' : 'red'} style={{ fontSize: 12 }}>
          {change >= 0 ? '+' : ''}{change}%
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 px-4" style={{ borderLeft: '1px solid #1c1c1c', color: '#555' }}>
        <div><span style={{ color: '#333' }}>TRADES</span> <span className="white">{trades.toLocaleString()} / ALL</span></div>
        <div><span style={{ color: '#333' }}>SPREAD</span> <span className="white">{Math.abs(change).toFixed(2)}+</span></div>
        <div><span style={{ color: '#333' }}>VOL</span> <span className="white">$2.4B</span></div>
      </div>

      {/* Right */}
      <div className="ml-auto flex items-center gap-3 px-4" style={{ borderLeft: '1px solid #1c1c1c' }}>
        <div className="flex items-center gap-1">
          <span className="dot-green blink" />
          <span style={{ color: '#00e676', fontSize: 9 }}>LIVE</span>
        </div>
        <span className="white font-bold">{time}</span>
      </div>
    </div>
  );
}
