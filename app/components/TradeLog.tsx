'use client';
import { useState, useEffect } from 'react';

interface Trade {
  id: number; time: string; ticker: string;
  side: 'BUY' | 'SELL'; price: number; size: number; pnl: number; status: string;
}

const TICKERS = ['BTC', 'NVDA', '삼성전자', 'AAPL', 'TSLA', 'SPY', 'QQQ', 'SCHD'];

function randTrade(id: number): Trade {
  const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
  const price = 50000 + Math.random() * 40000;
  const pnl = (Math.random() - 0.45) * 5000;
  const now = new Date();
  const time = now.toTimeString().slice(0, 8);
  return {
    id, time, ticker: TICKERS[Math.floor(Math.random() * TICKERS.length)],
    side, price, size: +(Math.random() * 2 + 0.01).toFixed(3),
    pnl, status: Math.random() > 0.1 ? 'FILLED' : 'PARTIAL',
  };
}

export default function TradeLog() {
  const [trades, setTrades] = useState<Trade[]>(() => Array.from({ length: 10 }, (_, i) => randTrade(i)));

  useEffect(() => {
    const id = setInterval(() => {
      setTrades(prev => [randTrade(Date.now()), ...prev.slice(0, 14)]);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      <div className="panel-header justify-between">
        <span>TRADE LOG</span>
        <div className="flex items-center gap-1">
          <span className="dot-green blink" />
          <span style={{ color: '#00e676', fontSize: 9 }}>LIVE</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex px-2 py-1 gap-1" style={{ background: '#0a0a0a', borderBottom: '1px solid #1c1c1c', fontSize: 9, color: '#333' }}>
        <span style={{ minWidth: 50 }}>TIME</span>
        <span style={{ minWidth: 52 }}>TICKER</span>
        <span style={{ minWidth: 28 }}>SIDE</span>
        <span style={{ flex: 1, textAlign: 'right' }}>PRICE</span>
        <span style={{ minWidth: 36, textAlign: 'right' }}>SIZE</span>
        <span style={{ minWidth: 56, textAlign: 'right' }}>P&L</span>
        <span style={{ minWidth: 44, textAlign: 'right' }}>STATUS</span>
      </div>

      <div className="flex-1 overflow-auto">
        {trades.map((t, i) => (
          <div key={t.id} className="flex items-center px-2 gap-1 slide-in"
            style={{ height: 22, borderBottom: '1px solid #111', fontSize: 10, opacity: 1 - i * 0.05 }}>
            <span style={{ minWidth: 50, color: '#444' }}>{t.time}</span>
            <span style={{ minWidth: 52 }} className="white">{t.ticker}</span>
            <span style={{ minWidth: 28, color: t.side === 'BUY' ? '#00e676' : '#ff1744', fontSize: 9, fontWeight: 'bold' }}>
              {t.side}
            </span>
            <span style={{ flex: 1, textAlign: 'right', color: '#888' }}>{t.price.toFixed(0)}</span>
            <span style={{ minWidth: 36, textAlign: 'right', color: '#555' }}>{t.size}</span>
            <span style={{ minWidth: 56, textAlign: 'right', color: t.pnl >= 0 ? '#00e676' : '#ff1744' }}>
              {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(0)}
            </span>
            <span style={{ minWidth: 44, textAlign: 'right', fontSize: 8, color: t.status === 'FILLED' ? '#00e676' : '#ffd740' }}>
              {t.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
