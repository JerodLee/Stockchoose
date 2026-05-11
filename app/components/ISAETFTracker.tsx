'use client';

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const DIVIDEND_TAX = 0.154;

interface ETFHolding {
  id: number;
  ticker: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  dividendYield: number;
}

export default function ISAETFTracker() {
  const [holdings, setHoldings] = useState<ETFHolding[]>([
    { id: 1, ticker: 'KODEX 배당성장', shares: 200, avgPrice: 12000, currentPrice: 13500, dividendYield: 3.2 },
    { id: 2, ticker: 'TIGER 미국S&P500', shares: 100, avgPrice: 15000, currentPrice: 17200, dividendYield: 1.5 },
  ]);

  const totalValue = holdings.reduce((sum, h) => sum + h.shares * h.currentPrice, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.shares * h.avgPrice, 0);
  const totalGain = totalValue - totalCost;
  const gainRate = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const annualDividend = holdings.reduce((sum, h) => sum + (h.shares * h.currentPrice * h.dividendYield) / 100, 0);
  const afterTaxDividend = annualDividend * (1 - DIVIDEND_TAX);

  const projectionData = Array.from({ length: 11 }, (_, i) => {
    const year = 2026 + i;
    const value = totalValue * Math.pow(1 + 0.07 + (annualDividend / totalValue || 0), i);
    return { year: String(year), value: Math.round(value / 10000) };
  });

  const updateHolding = (id: number, field: keyof ETFHolding, value: string | number) => {
    setHoldings(holdings.map((h) => h.id === id ? { ...h, [field]: field === 'ticker' ? value : Number(value) } : h));
  };

  const addHolding = () => {
    setHoldings([...holdings, {
      id: Date.now(), ticker: 'NEW ETF', shares: 100, avgPrice: 10000, currentPrice: 10000, dividendYield: 2.0,
    }]);
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border-2 border-teal-100">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-teal-100 text-teal-700 text-xs font-bold px-2 py-1 rounded-full">4</span>
        <h2 className="font-bold text-gray-800 text-lg">ISA 국내상장 ETF</h2>
        <span className="text-lg">📈</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-teal-50 rounded-xl p-3">
          <div className="text-xs text-gray-500 mb-1">평가금액</div>
          <div className="font-bold text-teal-700">{(totalValue / 10000).toFixed(0)}만원</div>
          <div className={`text-xs mt-0.5 ${gainRate >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {gainRate >= 0 ? '▲' : '▼'} {Math.abs(gainRate).toFixed(1)}% ({(totalGain / 10000).toFixed(0)}만원)
          </div>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3">
          <div className="text-xs text-gray-500 mb-1">연 배당(세후)</div>
          <div className="font-bold text-emerald-700">{(afterTaxDividend / 10000).toFixed(1)}만원</div>
          <div className="text-xs text-gray-400 mt-0.5">세전 {(annualDividend / 10000).toFixed(1)}만원</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-2">10년 자산 성장 예측 (연 7% + 배당 재투자)</div>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={projectionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f9ff" />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}만`} />
            <Tooltip formatter={(v) => [`${v}만원`, '예상자산']} />
            <Line type="monotone" dataKey="value" stroke="#14b8a6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-3">
        {holdings.map((h) => (
          <div key={h.id} className="border border-gray-100 rounded-xl p-3 mb-2">
            <div className="flex items-center gap-2 mb-2">
              <input value={h.ticker} onChange={(e) => updateHolding(h.id, 'ticker', e.target.value)}
                className="flex-1 text-sm font-bold border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:border-teal-400" />
              <button onClick={() => setHoldings(holdings.filter((x) => x.id !== h.id))} className="text-gray-300 hover:text-red-400">×</button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[
                { label: '수량', field: 'shares' as const },
                { label: '매입가', field: 'avgPrice' as const },
                { label: '현재가', field: 'currentPrice' as const },
                { label: '배당률%', field: 'dividendYield' as const },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label className="text-xs text-gray-400">{label}</label>
                  <input type="number" step={field === 'dividendYield' ? '0.1' : '1'}
                    value={h[field]}
                    onChange={(e) => updateHolding(h.id, field, e.target.value)}
                    className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-teal-400" />
                </div>
              ))}
            </div>
          </div>
        ))}
        <button onClick={addHolding}
          className="w-full border-2 border-dashed border-teal-200 text-teal-400 rounded-xl py-2 text-sm hover:border-teal-400 hover:text-teal-600 transition-colors">
          + ETF 추가
        </button>
      </div>

      <div className="bg-teal-50 border border-teal-200 rounded-lg p-2 text-xs text-teal-700">
        💡 ISA에서 국내상장 ETF 투자 시 우상향 + 배당 수익 | 단, 배당세 15.4% 적용
      </div>
    </div>
  );
}
