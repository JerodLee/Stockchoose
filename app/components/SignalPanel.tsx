'use client';
import { useState, useEffect } from 'react';

const SIGNALS = [
  { ticker: 'BTC', signal: 'STRONG BUY', score: 92, reason: 'RSI 과매도 + 볼린저 하단', color: '#00e676' },
  { ticker: 'SCHD', signal: 'BUY', score: 78, reason: '배당 증가 + 52주 저점', color: '#00e676' },
  { ticker: 'NVDA', signal: 'HOLD', score: 55, reason: '실적 발표 대기', color: '#ffd740' },
  { ticker: '삼성전자', signal: 'BUY', score: 71, reason: 'PBR 0.9 저평가', color: '#00e676' },
  { ticker: 'TSLA', signal: 'SELL', score: 28, reason: 'MACD 데드크로스', color: '#ff1744' },
];

export default function SignalPanel() {
  const [signals, setSignals] = useState(SIGNALS);
  const [trendScore, setTrendScore] = useState(68);

  useEffect(() => {
    const id = setInterval(() => {
      setSignals(s => s.map(sig => ({ ...sig, score: Math.min(100, Math.max(0, sig.score + (Math.random() - 0.5) * 4)) })));
      setTrendScore(t => Math.min(100, Math.max(0, t + (Math.random() - 0.5) * 3)));
    }, 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      <div className="panel-header justify-between">
        <span>LATEST SIGNALS</span>
        <span style={{ color: '#ffd740', fontSize: 9 }}>AI POWERED</span>
      </div>

      {/* Market sentiment */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid #1c1c1c', background: '#0a0a0a' }}>
        <div className="flex justify-between mb-1">
          <span style={{ color: '#444', fontSize: 9 }}>MARKET SENTIMENT</span>
          <span style={{ color: trendScore > 60 ? '#00e676' : trendScore > 40 ? '#ffd740' : '#ff1744', fontSize: 9, fontWeight: 'bold' }}>
            {trendScore > 60 ? '탐욕' : trendScore > 40 ? '중립' : '공포'} {trendScore.toFixed(0)}
          </span>
        </div>
        <div style={{ background: '#111', height: 8, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            width: `${trendScore}%`,
            background: trendScore > 60 ? 'linear-gradient(90deg,#00e676,#69f0ae)' : trendScore > 40 ? '#ffd740' : 'linear-gradient(90deg,#ff1744,#ff6b6b)',
            height: '100%', borderRadius: 4, transition: 'width 0.5s',
          }} />
        </div>
        <div className="flex justify-between mt-1" style={{ fontSize: 8, color: '#333' }}>
          <span>극도의 공포</span><span>극도의 탐욕</span>
        </div>
      </div>

      {/* Signals */}
      <div className="flex-1 overflow-auto">
        {signals.map((s) => (
          <div key={s.ticker} style={{ borderBottom: '1px solid #111', padding: '6px 10px' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="white" style={{ fontSize: 11, fontWeight: 'bold' }}>{s.ticker}</span>
              <span style={{ color: s.color, fontSize: 9, fontWeight: 'bold', border: `1px solid ${s.color}44`, padding: '1px 5px', borderRadius: 2 }}>
                {s.signal}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div style={{ flex: 1, background: '#111', height: 4, borderRadius: 2 }}>
                <div style={{ width: `${s.score}%`, background: s.color, height: '100%', borderRadius: 2, transition: 'width 0.5s' }} />
              </div>
              <span style={{ fontSize: 9, color: s.color, minWidth: 24 }}>{s.score.toFixed(0)}</span>
            </div>
            <div style={{ color: '#333', fontSize: 8, marginTop: 2 }}>{s.reason}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
