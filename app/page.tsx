import TopBar from './components/TopBar';
import AgentCard from './components/AgentCard';
import CandleChart from './components/CandleChart';
import OrderBook from './components/OrderBook';
import PLPanel from './components/PLPanel';
import ExecutionRow from './components/ExecutionRow';
import AgentNetwork from './components/AgentNetwork';
import ETFScreener from './components/ETFScreener';
import TradeLog from './components/TradeLog';
import SignalPanel from './components/SignalPanel';
import BacktestPanel from './components/BacktestPanel';

export default function Home() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#050505' }}>
      {/* Top bar */}
      <TopBar />

      {/* Nav tabs */}
      <div style={{ background: '#0a0a0a', borderBottom: '1px solid #1c1c1c', display: 'flex', height: 28, flexShrink: 0 }}>
        {['MY WALLET', 'HISTORY · LIBRARY', 'ACTIONS'].map((tab, i) => (
          <div key={tab} style={{
            padding: '0 12px', display: 'flex', alignItems: 'center',
            borderRight: '1px solid #1c1c1c',
            background: i === 0 ? '#111' : 'transparent',
            borderBottom: i === 0 ? '2px solid #00e676' : '2px solid transparent',
            color: i === 0 ? '#fff' : '#444', fontSize: 9, cursor: 'pointer',
          }}>
            {tab}
          </div>
        ))}
      </div>

      {/* Main row: Agent | Chart | OrderBook | PL */}
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 200px 220px', flex: '0 0 320px', gap: 0, overflow: 'hidden' }}>
        <AgentCard />
        <CandleChart />
        <OrderBook />
        <PLPanel />
      </div>

      {/* Execution row */}
      <ExecutionRow />

      {/* Network + bottom panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 220px', flex: 1, gap: 0, minHeight: 0 }}>
        {/* Network graph */}
        <AgentNetwork />

        {/* Right stats panel */}
        <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid #1c1c1c' }}>
          <div className="panel-header">NETWORK STATS</div>
          {[
            { label: '# BIG STREAK', value: '56', color: '#ffd740', big: true },
            { label: 'PROFIT RATE', value: '$8,350/HR', color: '#00e676', big: false },
            { label: '# NEXT TARGET', value: '25', color: '#fff', big: true },
            { label: 'AGENTS ONLINE', value: '3 / 10', color: '#448aff', big: false },
            { label: 'NETWORK LOAD', value: '72%', color: '#ff6b35', big: false },
          ].map(({ label, value, color, big }) => (
            <div key={label} style={{ padding: '8px 12px', borderBottom: '1px solid #1c1c1c', background: '#0d0d0d' }}>
              <div style={{ color: '#444', fontSize: 9, marginBottom: 2 }}>{label}</div>
              <div style={{ color, fontSize: big ? 24 : 14, fontWeight: 'bold' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Trade stats */}
        <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid #1c1c1c' }}>
          <div className="panel-header">TRADE STATS</div>
          {[
            { label: 'LAST 6-DAY PNL', value: '+$14,000', sub: '1,247 TRADES · BTG', color: '#00e676' },
            { label: '2 NOV', value: '+$42,000', sub: '810 · 1TH · KNF', color: '#00e676' },
            { label: '6 NOV', value: '+$14,000', sub: 'MAX TRADES', color: '#00e676' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} style={{ padding: '8px 12px', borderBottom: '1px solid #1c1c1c', background: '#0d0d0d' }}>
              <div style={{ color: '#444', fontSize: 9, marginBottom: 1 }}>{label}</div>
              <div style={{ color, fontSize: 18, fontWeight: 'bold' }}>{value}</div>
              <div style={{ color: '#333', fontSize: 8 }}>{sub}</div>
            </div>
          ))}
          <div style={{ padding: '6px 12px', flex: 1, background: '#0a0a0a' }}>
            <div style={{ color: '#444', fontSize: 9, marginBottom: 4 }}>2-DAY PNL</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 9, color: '#555' }}>
              <div>TRADES <span style={{ color: '#888' }}>1,862</span></div>
              <div>WIN <span style={{ color: '#00e676' }}>70.4%</span></div>
              <div>AVG R <span style={{ color: '#888' }}>2.41</span></div>
              <div>MAX DD <span style={{ color: '#ff1744' }}>-$4,200</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 300px 220px', flex: '0 0 340px', gap: 0, borderTop: '1px solid #1c1c1c', minHeight: 0 }}>
        <ETFScreener />
        <TradeLog />
        <BacktestPanel />
        <SignalPanel />
      </div>
    </div>
  );
}
