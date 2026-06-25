'use client';
import { useState } from 'react';

interface CoinBacktest {
  symbol: string;
  name: string;
  signals: number;
  hits: number;
  hitRate: number;
  hitRateCI: [number, number];
  expectancy: number;
  grossExpectancy: number;
  longSignals: number;
  shortSignals: number;
  avgLongRet: number;
  avgShortRet: number;
  sampleDays: number;
}
interface BacktestResponse {
  ok: boolean;
  updatedAt: string;
  horizonDays: number;
  costPct: number;
  note: string;
  overall: { signals: number; hits: number; hitRate: number; expectancy: number };
  coins: CoinBacktest[];
}
interface PresetEval {
  key: string;
  label: string;
  desc: string;
  isExpectancy: number;
  isSignals: number;
  oosExpectancy: number;
  oosHitRate: number;
  oosHitRateCI: [number, number];
  oosSignals: number;
}
interface OptimizeResponse {
  ok: boolean;
  best: PresetEval | null;
  presets: PresetEval[];
}

const rateColor = (r: number) => (r >= 55 ? '#00e676' : r >= 50 ? '#ffd740' : '#ff6b6b');
const expColor = (e: number) => (e > 0.05 ? '#00e676' : e < -0.05 ? '#ff1744' : '#ffd740');
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

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
        <span>백테스트 · 비겹침 · 비용 차감 (라이브 모델 동일 검증)</span>
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
          과거 일봉(최대 1000봉) + 과거 F&G·펀딩으로 <b>라이브 모델 그대로</b> 워크포워드 백테스트를 실행합니다.
          표본은 7일 비겹침으로 잡고 왕복비용을 차감합니다. <b>헤드라인은 비용 차감 기대값</b>이며, 적중률은 보조 지표(95% 신뢰구간 동반)입니다.
        </div>
      )}

      {error && <div className="px-3 py-3" style={{ color: '#ff6b6b', fontSize: 10 }}>측정 실패: {error}. (Binance egress 허용 필요)</div>}

      {data && data.ok && (
        <>
          {/* overall */}
          <div className="px-3 py-3 flex items-center gap-5 flex-wrap" style={{ borderBottom: '1px solid #1c1c1c', background: '#0a0a0a' }}>
            <div>
              <div style={{ color: '#555', fontSize: 9 }}>신호당 기대값 (비용 {data.costPct}% 차감)</div>
              <div style={{ color: expColor(data.overall.expectancy), fontSize: 26, fontWeight: 'bold' }}>
                {pct(data.overall.expectancy)}
              </div>
            </div>
            <div>
              <div style={{ color: '#555', fontSize: 9 }}>방향 적중률 (보조)</div>
              <div style={{ color: rateColor(data.overall.hitRate), fontSize: 18, fontWeight: 'bold' }}>
                {data.overall.hitRate.toFixed(1)}%
              </div>
            </div>
            <div style={{ color: '#555', fontSize: 9, lineHeight: 1.6 }}>
              비겹침 표본 <span style={{ color: '#fff' }}>{data.overall.signals.toLocaleString()}</span>건<br />
              Horizon {data.horizonDays}일 · 5개 코인 합산
            </div>
          </div>

          {/* per coin table */}
          <div className="px-3 py-1 flex gap-2" style={{ fontSize: 9, color: '#333', borderBottom: '1px solid #111' }}>
            <span style={{ minWidth: 40 }}>COIN</span>
            <span style={{ minWidth: 66, textAlign: 'right' }}>기대값</span>
            <span style={{ minWidth: 50, textAlign: 'right' }}>적중률</span>
            <span style={{ minWidth: 96, textAlign: 'right' }}>95% CI</span>
            <span style={{ minWidth: 40, textAlign: 'right' }}>신호</span>
            <span className="flex-1" />
          </div>
          {data.coins.map((c) => (
            <div key={c.symbol} className="px-3 py-1 flex gap-2 items-center" style={{ borderBottom: '1px solid #111', fontSize: 10 }}>
              <span className="white" style={{ minWidth: 40, fontWeight: 'bold' }}>{c.name}</span>
              <span style={{ minWidth: 66, textAlign: 'right', color: expColor(c.expectancy), fontWeight: 'bold' }}>
                {c.signals > 0 ? pct(c.expectancy) : '—'}
              </span>
              <span style={{ minWidth: 50, textAlign: 'right', color: rateColor(c.hitRate) }}>
                {c.signals > 0 ? `${c.hitRate.toFixed(0)}%` : '—'}
              </span>
              <span style={{ minWidth: 96, textAlign: 'right', color: '#666', fontSize: 9 }}>
                {c.signals > 0 ? `${c.hitRateCI[0].toFixed(0)}–${c.hitRateCI[1].toFixed(0)}%` : '—'}
              </span>
              <span style={{ minWidth: 40, textAlign: 'right', color: '#888' }}>{c.signals}</span>
              <span className="flex-1" style={{ color: '#333', fontSize: 8, textAlign: 'right' }}>{c.sampleDays}표본</span>
            </div>
          ))}

          {/* 프리셋 튜닝: IS 선택 → OOS 보고 */}
          {optimize && optimize.ok && optimize.best && (
            <div style={{ borderTop: '1px solid #1c1c1c', background: '#0a0a0a' }}>
              <div className="px-3 py-2 flex items-center gap-2 flex-wrap" style={{ fontSize: 10 }}>
                <span style={{ color: '#555' }}>📊 프리셋 튜닝 (인-샘플 70% 선택 → 아웃-오브-샘플 30% 검증) — 추천:</span>
                <span style={{ color: '#00e676', fontWeight: 'bold' }}>{optimize.best.label}</span>
                <span style={{ color: '#555' }}>OOS 기대값</span>
                <span style={{ color: expColor(optimize.best.oosExpectancy), fontWeight: 'bold' }}>
                  {pct(optimize.best.oosExpectancy)}
                </span>
              </div>
              <div className="px-3 py-1 flex gap-2" style={{ fontSize: 8, color: '#333', borderTop: '1px solid #111' }}>
                <span style={{ minWidth: 60 }}>프리셋</span>
                <span style={{ minWidth: 72, textAlign: 'right' }}>OOS 기대값</span>
                <span style={{ minWidth: 60, textAlign: 'right' }}>OOS 적중</span>
                <span style={{ minWidth: 80, textAlign: 'right' }}>OOS 95%CI</span>
                <span className="flex-1" />
              </div>
              {optimize.presets.map((p) => (
                <div key={p.key} className="px-3 py-1 flex items-center gap-2" style={{ borderTop: '1px solid #111', fontSize: 9 }}>
                  <span className="white" style={{ minWidth: 60 }}>{p.label}</span>
                  <span style={{ minWidth: 72, textAlign: 'right', color: expColor(p.oosExpectancy), fontWeight: 'bold' }}>{pct(p.oosExpectancy)}</span>
                  <span style={{ minWidth: 60, textAlign: 'right', color: rateColor(p.oosHitRate) }}>{p.oosHitRate.toFixed(0)}%</span>
                  <span style={{ minWidth: 80, textAlign: 'right', color: '#666' }}>{p.oosHitRateCI[0].toFixed(0)}–{p.oosHitRateCI[1].toFixed(0)}%</span>
                  <span style={{ color: '#444', flex: 1, fontSize: 8 }}>{p.oosSignals}신호</span>
                </div>
              ))}
            </div>
          )}

          <div className="px-3 py-2" style={{ color: '#444', fontSize: 8, lineHeight: 1.5 }}>
            ⚠ {data.note} 종목은 현재 시총 상위 5개라 <b>생존편향</b>이 있고, 코인 간 상관이 높아 표본이 실제보다 독립적이지 않습니다.
            과거 성과가 미래를 보장하지 않습니다.
          </div>
        </>
      )}
    </div>
  );
}
