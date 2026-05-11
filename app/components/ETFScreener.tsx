'use client';
import { useState, useEffect } from 'react';

const ETF_BASE = [
  { ticker: 'SCHD',   name: 'Schwab Dividend',       ret: 8.34,  div: 3.41, vol: 'LOW' },
  { ticker: 'JEPI',   name: 'JPMorgan Income',        ret: 12.11, div: 8.92, vol: 'LOW' },
  { ticker: 'QQQ',    name: 'Nasdaq 100',             ret: 18.4,  div: 0.62, vol: 'HIGH' },
  { ticker: 'TIGER',  name: 'TIGER 미국S&P500',       ret: 14.2,  div: 1.50, vol: 'MED' },
  { ticker: 'KODEX',  name: 'KODEX 배당성장',         ret: 6.8,   div: 3.20, vol: 'LOW' },
  { ticker: 'SPY',    name: 'S&P500 ETF',             ret: 11.2,  div: 1.35, vol: 'MED' },
  { ticker: 'VYM',    name: 'Vanguard High Div',      ret: 7.1,   div: 2.98, vol: 'LOW' },
  { ticker: 'SOXL',   name: 'Semi 3x Lev',           ret: 44.2,  div: 0.0,  vol: 'HIGH' },
];

export default function ETFScreener() {
  const [data, setData] = useState(ETF_BASE);
  const [sort, setSort] = useState<'ret' | 'div'>('ret');

  useEffect(() => {
    const id = setInterval(() => {
      setData(d => d.map(e => ({
        ...e,
        ret: +(e.ret + (Math.random() - 0.5) * 0.3).toFixed(2),
        div: +(e.div + (Math.random() - 0.5) * 0.05).toFixed(2),
      })));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const sorted = [...data].sort((a, b) => b[sort] - a[sort]);
  const maxRet = Math.max(...data.map(e => e.ret));

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      <div className="panel-header justify-between">
        <span>ETF SCREENER</span>
        <div className="flex gap-2">
          <button onClick={() => setSort('ret')}
            style={{ color: sort === 'ret' ? '#00e676' : '#444', fontSize: 9, cursor: 'pointer' }}>
            RETURN
          </button>
          <button onClick={() => setSort('div')}
            style={{ color: sort === 'div' ? '#00e676' : '#444', fontSize: 9, cursor: 'pointer' }}>
            DIV
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex px-2 py-1 gap-2" style={{ background: '#0a0a0a', borderBottom: '1px solid #1c1c1c', fontSize: 9, color: '#333' }}>
        <span style={{ minWidth: 52 }}>TICKER</span>
        <span className="flex-1">PERFORMANCE</span>
        <span style={{ minWidth: 40, textAlign: 'right' }}>RET%</span>
        <span style={{ minWidth: 36, textAlign: 'right' }}>DIV%</span>
        <span style={{ minWidth: 32, textAlign: 'right' }}>VOL</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {sorted.map((e) => {
          const barW = (e.ret / maxRet) * 100;
          const volColor = e.vol === 'HIGH' ? '#ff1744' : e.vol === 'MED' ? '#ffd740' : '#00e676';
          return (
            <div key={e.ticker} className="flex items-center px-2 gap-2 relative"
              style={{ height: 26, borderBottom: '1px solid #111' }}>
              <div className="bar-fill" style={{ width: `${barW}%`, background: '#00e676' }} />
              <span className="white" style={{ minWidth: 52, fontSize: 10, fontWeight: 'bold', zIndex: 1 }}>{e.ticker}</span>
              <span className="flex-1" style={{ fontSize: 8, color: '#444', zIndex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {e.name}
              </span>
              <span style={{ minWidth: 40, textAlign: 'right', color: e.ret >= 0 ? '#00e676' : '#ff1744', fontSize: 10, zIndex: 1 }}>
                {e.ret >= 0 ? '+' : ''}{e.ret}%
              </span>
              <span style={{ minWidth: 36, textAlign: 'right', color: '#ffd740', fontSize: 10, zIndex: 1 }}>
                {e.div}%
              </span>
              <span style={{ minWidth: 32, textAlign: 'right', color: volColor, fontSize: 8, zIndex: 1 }}>
                {e.vol}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
