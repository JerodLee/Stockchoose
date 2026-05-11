'use client';
import { useState, useEffect } from 'react';

interface Order { price: number; size: number; total: number; }

function genOrders(base: number, side: 'ask' | 'bid', count = 12): Order[] {
  const orders: Order[] = [];
  let p = base;
  let cum = 0;
  for (let i = 0; i < count; i++) {
    p += side === 'ask' ? (Math.random() * 8 + 1) : -(Math.random() * 8 + 1);
    const size = +(Math.random() * 2.5 + 0.05).toFixed(3);
    cum += size;
    orders.push({ price: p, size, total: +cum.toFixed(3) });
  }
  return orders;
}

export default function OrderBook() {
  const [base, setBase] = useState(80519);
  const [asks, setAsks] = useState<Order[]>([]);
  const [bids, setBids] = useState<Order[]>([]);

  useEffect(() => {
    const refresh = () => {
      const nb = base + (Math.random() - 0.5) * 30;
      setBase(nb);
      const rawAsks = genOrders(nb + 5, 'ask');
      setAsks(rawAsks.sort((a, b) => a.price - b.price));
      setBids(genOrders(nb - 5, 'bid'));
    };
    refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, []);

  const maxTotal = Math.max(...[...asks, ...bids].map(o => o.total), 1);
  const spread = asks[0] && bids[0] ? (asks[0].price - bids[0].price).toFixed(1) : '—';

  const Row = ({ o, side }: { o: Order; side: 'ask' | 'bid' }) => {
    const color = side === 'ask' ? '#ff1744' : '#00e676';
    const pct = (o.total / maxTotal) * 100;
    return (
      <div className="relative flex items-center" style={{ height: 16, paddingLeft: 4, paddingRight: 4 }}>
        <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
        <span className="flex-1" style={{ color, fontSize: 10, fontFamily: 'Courier New', zIndex: 1 }}>
          {o.price.toFixed(1)}
        </span>
        <span style={{ color: '#888', fontSize: 10, zIndex: 1, minWidth: 48, textAlign: 'right' }}>
          {o.size.toFixed(3)}
        </span>
        <span style={{ color: '#444', fontSize: 10, zIndex: 1, minWidth: 48, textAlign: 'right' }}>
          {o.total.toFixed(3)}
        </span>
      </div>
    );
  };

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      <div className="panel-header justify-between">
        <span>ORDER BOOK</span>
        <span style={{ color: '#ffd740' }}>DEPTH</span>
      </div>

      {/* Column headers */}
      <div className="flex px-1 py-0.5" style={{ background: '#0a0a0a', borderBottom: '1px solid #1c1c1c', fontSize: 9, color: '#333' }}>
        <span className="flex-1">PRICE</span>
        <span style={{ minWidth: 48, textAlign: 'right' }}>SIZE</span>
        <span style={{ minWidth: 48, textAlign: 'right' }}>TOTAL</span>
      </div>

      {/* Asks (sell orders) */}
      <div className="flex-1 flex flex-col-reverse overflow-hidden">
        {asks.slice(0, 12).map((o, i) => <Row key={i} o={o} side="ask" />)}
      </div>

      {/* Spread */}
      <div className="flex items-center justify-between px-2 py-1" style={{ background: '#111', borderTop: '1px solid #1c1c1c', borderBottom: '1px solid #1c1c1c' }}>
        <span style={{ color: '#ffd740', fontSize: 11, fontWeight: 'bold' }}>
          ${base.toFixed(1)}
        </span>
        <span style={{ color: '#444', fontSize: 9 }}>SPREAD <span style={{ color: '#888' }}>${spread}</span></span>
      </div>

      {/* Bids (buy orders) */}
      <div className="flex-1 overflow-hidden">
        {bids.slice(0, 12).map((o, i) => <Row key={i} o={o} side="bid" />)}
      </div>
    </div>
  );
}
