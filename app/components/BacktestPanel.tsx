'use client';
import { useState } from 'react';

interface CoinBacktest {
  symbol: string;
  name: string;
  signals: number;
  hits: number;
  hitRate: number;
  avgLongRet: number;
  avgShortRet: number;
  longSignals: number;
  shortSignals: number;
  sampleDays: number;
}
interface BacktestResponse {
  ok: boolean;
  updatedAt: string;
  horizonDays: number;
  note: string;
  overall: { signals: number; hits: number; hitRate: number };
  coins: CoinBacktest[];
}
interface PresetResult {
  key: string;
  label: string;
  desc: string;
  hitRate: number;
  signals: number;
  hits: number;
}
interface OptimizeResponse {
  ok: boolean;
  best: PresetResult | null;
  presets: PresetResult[];
}

const rateColor = (r: number) => (r >= 55 ? '#00e676' : r >= 50 ? '#ffd740' : '#ff6b6b');

export default function BacktestPanel() {
  const [data, setData] = useState<BacktestResponse | null>(null);
  const [optimize, setOptimize] = useState<OptimizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const [btRes, optRes] = await Promise.all([
        fetch('/api/backtest', { cache: 'no-store' }),
        fetch('/api/optimize', { cache: 'no-store' }),
      ]);
      if (!btRes.ok) throw new Error(`HTTP ${btRes.status}`);
      setData((await btRes.json()) as BacktestResponse);
      if (optRes.ok) setOptimize((await optRes.json()) as OptimizeResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-4 mb-4 panel" style={{ overflow: 'hidden' }}>
      <div className="panel-header justify-between">
        <span>백테스트 · 과거 1주 방향 적중률 (기술 코어)</span>
        <button
          onClick={run}
          disabled={loading}
          style={{ color: loading ? '#555' : '#00e676', fontSize: 9, border: '1px solid #00e67644', padding: '2px 10px', borderRadius: 2, cursor: loading ? 'default' : 'pointer', background: 'transparent' }}
        >
          {loading ? '측정 중…' : data ? '↻ 다시 측정' : '측정 실행'}
        </button>
      </div>

      {!data && !loading && !error && (
        <div className="px-3 py-3" style={{ color: '#555', fontSize: 10, lineHeight: 1.6 }}>
          과거 일봉(최대 1000봉)으로 워크포워드 백테스트를 실행해 실제 방향 적중률을 측정합니다.
          50%를 의미 있게 넘으면 통계적 엣지가 있는 것이며, 1주 horizon에서는 55% 안팎이 현실적 상한입니다.
        </div>
      )}

      {error && <div className="px-3 py-3" style={{ color: '#ff6b6b', fontSize: 10 }}>측정 실패: {error}. (Binance egress 허용 필요)</div>}

      {data && data.ok && (
        <>
          {/* overall */}
          <div className="px-3 py-3 flex items-center gap-4" style={{ borderBottom: '1px solid #1c1c1c', background: '#0a0a0a' }}>
            <div>
              <div style={{ color: '#555', fontSize: 9 }}>전체 적중률</div>
              <div style={{ color: rateColor(data.overall.hitRate), fontSize: 26, fontWeight: 'bold' }}>
                {data.overall.hitRate.toFixed(1)}%
              </div>
            </div>
            <div style={{ color: '#555', fontSize: 9, lineHeight: 1.6 }}>
              표본 신호 <span style={{ color: '#fff' }}>{data.overall.signals.toLocaleString()}</span>건 · 적중{' '}
              <span style={{ color: '#fff' }}>{data.overall.hits.toLocaleString()}</span>건<br />
              Horizon {data.horizonDays}일 · 5개 코인 합산
            </div>
          </div>

          {/* per coin table */}
          <div className="px-3 py-1 flex gap-2" style={{ fontSize: 9, color: '#333', borderBottom: '1px solid #111' }}>
            <span style={{ minWidth: 44 }}>COIN</span>
            <span style={{ minWidth: 56, textAlign: 'right' }}>적중률</span>
            <span style={{ minWidth: 56, textAlign: 'right' }}>신호수</span>
            <span style={{ minWidth: 60, textAlign: 'right' }}>롱 평균</span>
            <span style={{ minWidth: 60, textAlign: 'right' }}>숏 평균</span>
            <span className="flex-1" />
          </div>
          {data.coins.map((c) => (
            <div key={c.symbol} className="px-3 py-1 flex gap-2 items-center" style={{ borderBottom: '1px solid #111', fontSize: 10 }}>
              <span className="white" style={{ minWidth: 44, fontWeight: 'bold' }}>{c.name}</span>
              <span style={{ minWidth: 56, textAlign: 'right', color: rateColor(c.hitRate), fontWeight: 'bold' }}>
                {c.signals > 0 ? `${c.hitRate.toFixed(1)}%` : '—'}
              </span>
              <span style={{ minWidth: 56, textAlign: 'right', color: '#888' }}>{c.signals}</span>
              <span style={{ minWidth: 60, textAlign: 'right', color: c.avgLongRet >= 0 ? '#00e676' : '#ff1744' }}>
                {c.longSignals > 0 ? `${c.avgLongRet >= 0 ? '+' : ''}${c.avgLongRet.toFixed(1)}%` : '—'}
              </span>
              <span style={{ minWidth: 60, textAlign: 'right', color: c.avgShortRet <= 0 ? '#00e676' : '#ff1744' }}>
                {c.shortSignals > 0 ? `${c.avgShortRet >= 0 ? '+' : ''}${c.avgShortRet.toFixed(1)}%` : '—'}
              </span>
              <span className="flex-1" style={{ color: '#333', fontSize: 8, textAlign: 'right' }}>{c.sampleDays}일 표본</span>
            </div>
          ))}

          {/* 프리셋 튜닝 결과 */}
          {optimize && optimize.ok && optimize.best && (
            <div style={{ borderTop: '1px solid #1c1c1c', background: '#0a0a0a' }}>
              <div className="px-3 py-2 flex items-center gap-2" style={{ fontSize: 10 }}>
                <span style={{ color: '#555' }}>📊 프리셋 튜닝 — 과거 적중률 1위:</span>
                <span style={{ color: '#00e676', fontWeight: 'bold' }}>{optimize.best.label}</span>
                <span style={{ color: rateColor(optimize.best.hitRate), fontWeight: 'bold' }}>
                  {optimize.best.hitRate.toFixed(1)}%
                </span>
              </div>
              {optimize.presets.map((p, i) => (
                <div key={p.key} className="px-3 py-1 flex items-center gap-2" style={{ borderTop: '1px solid #111', fontSize: 9 }}>
                  <span style={{ minWidth: 14, color: '#444' }}>{i + 1}.</span>
                  <span className="white" style={{ minWidth: 60 }}>{p.label}</span>
                  <span style={{ minWidth: 50, textAlign: 'right', color: rateColor(p.hitRate), fontWeight: 'bold' }}>
                    {p.hitRate.toFixed(1)}%
                  </span>
                  <span style={{ color: '#444', flex: 1 }}>{p.desc} · {p.signals}신호</span>
                </div>
              ))}
            </div>
          )}

          <div className="px-3 py-2" style={{ color: '#444', fontSize: 8, lineHeight: 1.5 }}>
            ⚠ {data.note} 숏 평균은 가격 변화 기준이라 <b>음수일수록 숏에 유리</b>합니다.
          </div>
        </>
      )}
    </div>
  );
}
