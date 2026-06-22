'use client';
import { useEffect, useState } from 'react';
import BacktestPanel from './BacktestPanel';

type Bias = 'STRONG LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG SHORT';
type Direction = 'up' | 'down' | 'flat' | 'warn';

interface IndicatorView {
  key: string;
  label: string;
  value: number;
  direction: Direction;
  detail: string;
}
interface CoinForecast {
  symbol: string;
  name: string;
  price: number | null;
  bias: Bias;
  score: number;
  confidence: number;
  horizonDays: number;
  indicators: IndicatorView[];
  invalidation: number | null;
}
interface ForecastResponse {
  ok: boolean;
  updatedAt: string;
  sources: { klines: boolean; funding: boolean; fearGreed: boolean; dominance: boolean };
  summary: { regime: 'LONG' | 'SHORT' | 'NEUTRAL'; longs: number; shorts: number; neutrals: number; avgConfidence: number; total: number };
  coins: CoinForecast[];
}

const biasColor = (b: Bias) =>
  b === 'STRONG LONG' || b === 'LONG' ? '#00e676' : b === 'STRONG SHORT' || b === 'SHORT' ? '#ff1744' : '#ffd740';
const biasLabel = (b: Bias) =>
  b === 'STRONG LONG' ? '강한 롱' : b === 'LONG' ? '롱 우위' : b === 'STRONG SHORT' ? '강한 숏' : b === 'SHORT' ? '숏 우위' : '관망';
const dirSymbol = (d: Direction) => (d === 'up' ? '↑' : d === 'down' ? '↓' : d === 'warn' ? '⚠' : '→');
const dirColor = (d: Direction) => (d === 'up' ? '#00e676' : d === 'down' ? '#ff1744' : d === 'warn' ? '#ffd740' : '#666');

function fmtPrice(p: number | null) {
  if (p == null) return '—';
  if (p >= 100) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return p.toLocaleString('en-US', { maximumFractionDigits: p >= 1 ? 2 : 4 });
}

export default function ForecastBoard() {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // 새로고침 버튼 / 60초 주기로 effect를 재실행시키는 트리거.
  const [nonce, setNonce] = useState(0);
  const reload = () => setNonce((n) => n + 1);

  useEffect(() => {
    let active = true;
    // fetch의 await 경계 안에서만 setState → effect 동기 렌더 유발 없음.
    async function run() {
      try {
        const res = await fetch('/api/forecast', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ForecastResponse = await res.json();
        if (!active) return;
        setData(json);
        setError(null);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : '알 수 없는 오류');
      } finally {
        if (active) setLoading(false);
      }
    }
    run();
    const id = setInterval(run, 60_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [nonce]);

  const s = data?.summary;
  const regimeColor = s?.regime === 'LONG' ? '#00e676' : s?.regime === 'SHORT' ? '#ff1744' : '#ffd740';
  const allSourcesDown = data && !data.ok;

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#050505', display: 'flex', flexDirection: 'column' }}>
      {/* Summary strip */}
      <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-3" style={{ borderBottom: '1px solid #1c1c1c', background: '#0a0a0a' }}>
        <div className="flex items-center gap-3">
          <span style={{ color: '#666', fontSize: 11, letterSpacing: '0.05em' }}>THIS WEEK · 1주 시장 편향</span>
          {s && (
            <span style={{ color: regimeColor, fontSize: 15, fontWeight: 'bold' }}>
              {s.regime === 'LONG' ? '롱 우위' : s.regime === 'SHORT' ? '숏 우위' : '중립 / 혼조'}
            </span>
          )}
          {s && (
            <span style={{ color: '#555', fontSize: 11 }}>
              ({s.longs} LONG / {s.neutrals} NEUTRAL / {s.shorts} SHORT) · 평균 신뢰도{' '}
              <span style={{ color: '#fff' }}>{s.avgConfidence}%</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <span style={{ color: '#444', fontSize: 9 }}>
              UPDATED {new Date(data.updatedAt).toLocaleTimeString('ko-KR')}
            </span>
          )}
          <button
            onClick={reload}
            style={{ color: '#00e676', fontSize: 9, border: '1px solid #00e67644', padding: '3px 10px', borderRadius: 2, cursor: 'pointer', background: 'transparent' }}
          >
            ↻ REFRESH
          </button>
        </div>
      </div>

      {/* Source health / degraded banner */}
      {data && (
        <div className="px-4 py-1 flex items-center gap-3" style={{ borderBottom: '1px solid #111', background: '#080808', fontSize: 9 }}>
          <span style={{ color: '#444' }}>DATA SOURCES:</span>
          {[
            ['Binance klines', data.sources.klines],
            ['Funding/OI', data.sources.funding],
            ['Fear&Greed', data.sources.fearGreed],
            ['Dominance', data.sources.dominance],
          ].map(([label, ok]) => (
            <span key={label as string} style={{ color: ok ? '#00e676' : '#ff1744' }}>
              {ok ? '●' : '○'} {label as string}
            </span>
          ))}
        </div>
      )}

      {loading && <div className="px-4 py-8" style={{ color: '#555', fontSize: 12 }}>로딩 중…</div>}

      {error && (
        <div className="px-4 py-6" style={{ color: '#ff6b6b', fontSize: 12 }}>
          데이터를 불러오지 못했습니다: {error}
        </div>
      )}

      {allSourcesDown && (
        <div className="mx-4 my-4 px-4 py-3" style={{ border: '1px solid #ff174455', background: '#1a0808', borderRadius: 3 }}>
          <div style={{ color: '#ff6b6b', fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>⚠ 실데이터 소스에 연결할 수 없습니다</div>
          <div style={{ color: '#888', fontSize: 10, lineHeight: 1.6 }}>
            Binance 공개 API에 접근하지 못했습니다. 실행 환경의 <b>네트워크 egress 허용목록</b>에 다음 호스트를 추가해야 합니다:
            <code style={{ color: '#ffd740' }}> api.binance.com, fapi.binance.com, api.alternative.me, api.coingecko.com</code>.
            또한 일부 서버 리전은 Binance가 차단(HTTP 451)할 수 있습니다.
          </div>
        </div>
      )}

      {/* Coin cards */}
      {data && data.ok && (
        <div className="p-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {data.coins.map((c) => (
            <CoinCard key={c.symbol} c={c} />
          ))}
        </div>
      )}

      {/* Backtest */}
      {data && data.ok && <BacktestPanel />}

      {/* Disclaimer footer */}
      <div className="px-4 py-3 mt-auto" style={{ borderTop: '1px solid #1c1c1c', background: '#0a0a0a', color: '#555', fontSize: 9, lineHeight: 1.6 }}>
        ⚠ 본 지표는 <b>확률적 롱숏 편향</b>을 제시할 뿐 가격 예측이나 투자 조언이 아닙니다. 1주 horizon에서 방향 적중률은 구조적으로
        50~55% 수준이며, 각 카드의 <b>무효화(invalidation)</b> 조건을 반드시 함께 확인하세요. 데이터: Binance 공개 API · Alternative.me F&G.
      </div>
    </div>
  );
}

function CoinCard({ c }: { c: CoinForecast }) {
  const color = biasColor(c.bias);
  // 게이지: -100..+100 → 0..100%
  const gaugePct = (c.score + 100) / 2;

  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      {/* header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid #1c1c1c' }}>
        <div className="flex items-baseline gap-2">
          <span className="white" style={{ fontSize: 15, fontWeight: 'bold' }}>{c.name}</span>
          <span style={{ color: '#555', fontSize: 10, fontFamily: 'Courier New' }}>${fmtPrice(c.price)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color, fontSize: 11, fontWeight: 'bold', border: `1px solid ${color}55`, padding: '2px 8px', borderRadius: 2 }}>
            {biasLabel(c.bias)}
          </span>
          <span style={{ color, fontSize: 13, fontWeight: 'bold', minWidth: 34, textAlign: 'right' }}>{c.confidence}%</span>
        </div>
      </div>

      {/* gauge -100..+100 */}
      <div className="px-3 pt-2 pb-1">
        <div style={{ position: 'relative', height: 10, background: '#111', borderRadius: 5, overflow: 'hidden' }}>
          {/* center line */}
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#333' }} />
          {/* fill from center */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              background: color,
              opacity: 0.85,
              borderRadius: 2,
              left: c.score >= 0 ? '50%' : `${gaugePct}%`,
              width: `${Math.abs(c.score) / 2}%`,
              transition: 'all 0.5s',
            }}
          />
        </div>
        <div className="flex justify-between mt-1" style={{ fontSize: 8, color: '#333' }}>
          <span>SHORT -100</span>
          <span style={{ color, fontWeight: 'bold' }}>{c.score >= 0 ? '+' : ''}{c.score}</span>
          <span>+100 LONG</span>
        </div>
      </div>

      {/* indicators */}
      <div className="px-3 py-2 grid grid-cols-5 gap-1" style={{ borderTop: '1px solid #111' }}>
        {c.indicators.map((ind) => (
          <div key={ind.key} title={ind.detail} style={{ textAlign: 'center' }}>
            <div style={{ color: '#555', fontSize: 8 }}>{ind.label}</div>
            <div style={{ color: dirColor(ind.direction), fontSize: 14, fontWeight: 'bold' }}>{dirSymbol(ind.direction)}</div>
          </div>
        ))}
      </div>

      {/* detail rows */}
      <div className="px-3 pb-2" style={{ fontSize: 8, color: '#444' }}>
        {c.indicators.map((ind) => (
          <div key={ind.key} className="flex justify-between" style={{ padding: '1px 0' }}>
            <span style={{ color: '#555' }}>{ind.label}</span>
            <span style={{ color: dirColor(ind.direction) }}>{ind.detail}</span>
          </div>
        ))}
      </div>

      {/* horizon + invalidation */}
      <div className="px-3 py-2 flex items-center justify-between" style={{ borderTop: '1px solid #1c1c1c', background: '#0a0a0a' }}>
        <span style={{ color: '#555', fontSize: 9 }}>Horizon ~{c.horizonDays}일</span>
        {c.invalidation != null && c.bias !== 'NEUTRAL' && (
          <span style={{ color: '#ffd740', fontSize: 9 }}>
            ⚠ 무효화: 일봉 ${fmtPrice(c.invalidation)} {c.score >= 0 ? '이탈' : '돌파'} 시
          </span>
        )}
      </div>
    </div>
  );
}
