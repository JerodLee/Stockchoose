'use client';
import { useState, useEffect } from 'react';

const CYCLE_LABELS = ['BUY', 'CONFIRM', 'SETTLE', 'RECORD', 'SIGNAL', 'EXECUTE'];

export default function ExecutionRow() {
  const [active, setActive] = useState(2);
  const [latency, setLatency] = useState(1.49);
  const [target] = useState(2.75);
  const [current, setCurrent] = useState(1.445);

  useEffect(() => {
    const id = setInterval(() => {
      setActive(a => (a + 1) % CYCLE_LABELS.length);
      setLatency(+(1.2 + Math.random() * 0.6).toFixed(3));
      setCurrent(+(1.2 + Math.random() * 0.5).toFixed(3));
    }, 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ background: '#0a0a0a', borderTop: '1px solid #1c1c1c', borderBottom: '1px solid #1c1c1c', height: 56, display: 'flex', alignItems: 'center' }}>
      {/* Label */}
      <div className="flex items-center gap-2 px-3" style={{ borderRight: '1px solid #1c1c1c', height: '100%', minWidth: 140 }}>
        <span className="dot-green blink" />
        <div>
          <div style={{ fontSize: 9, color: '#00e676' }}>● LIVE EXECUTION CYCLE</div>
          <div style={{ fontSize: 8, color: '#333', marginTop: 1 }}>CHAIN AT 7K</div>
        </div>
      </div>

      {/* Cycle steps */}
      {CYCLE_LABELS.map((label, i) => (
        <div key={label} className="flex-1 h-full flex flex-col justify-center items-center"
          style={{ borderRight: '1px solid #1c1c1c', background: i === active ? '#111' : 'transparent' }}>
          <div style={{ fontSize: 8, color: i === active ? '#00e676' : '#333', marginBottom: 2, textTransform: 'uppercase' }}>
            {label}
          </div>
          <div style={{ fontSize: 9, color: i === active ? '#fff' : '#222' }}>
            {i === active ? '●' : '○'}
          </div>
          <div style={{ fontSize: 8, color: '#222' }}>
            {(0.2 + i * 0.15 + Math.random() * 0.1).toFixed(2)}s
          </div>
        </div>
      ))}

      {/* Right stats */}
      <div className="flex items-center gap-0 h-full" style={{ borderLeft: '1px solid #1c1c1c' }}>
        <div className="px-4 h-full flex flex-col justify-center" style={{ borderRight: '1px solid #1c1c1c' }}>
          <div style={{ fontSize: 9, color: '#444' }}>TARGET</div>
          <div style={{ fontSize: 16, color: '#888', fontWeight: 'bold' }}>{target}</div>
        </div>
        <div className="px-4 h-full flex flex-col justify-center" style={{ borderRight: '1px solid #1c1c1c' }}>
          <div style={{ fontSize: 9, color: '#444' }}>CURRENT</div>
          <div style={{ fontSize: 16, color: '#00e676', fontWeight: 'bold' }}>{current}</div>
        </div>
        <div className="px-3 h-full flex flex-col justify-center items-center" style={{ background: '#111', minWidth: 80 }}>
          <div style={{ fontSize: 8, color: '#444' }}>LATENCY</div>
          <div style={{ fontSize: 18, color: '#fff', fontWeight: 'bold' }}>{latency}s</div>
        </div>
      </div>
    </div>
  );
}
