'use client';

import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const INCOME_LIMIT = 20000000;
const DIVIDEND_TAX = 0.154;

interface Holding {
  id: number;
  ticker: string;
  shares: number;
  dividendPerShare: number;
  priceUSD: number;
  exchangeRate: number;
  quartersPerYear: number;
}

const DEFAULT_HOLDINGS: Holding[] = [
  { id: 1, ticker: 'SCHD', shares: 1500, dividendPerShare: 0.278, priceUSD: 0, exchangeRate: 1400, quartersPerYear: 4 },
  { id: 2, ticker: 'JEPI', shares: 500, dividendPerShare: 0.45, priceUSD: 0, exchangeRate: 1400, quartersPerYear: 12 },
];

export default function DividendTracker() {
  const [holdings, setHoldings] = useState<Holding[]>(DEFAULT_HOLDINGS);
  const [otherIncome, setOtherIncome] = useState(3000000);

  const calcAnnualDividend = (h: Holding) => {
    const gross = h.shares * h.dividendPerShare * h.exchangeRate * h.quartersPerYear;
    const afterTax = gross * (1 - DIVIDEND_TAX);
    return { gross, afterTax };
  };

  const totalGross = holdings.reduce((sum, h) => sum + calcAnnualDividend(h).gross, 0);
  const totalAfterTax = holdings.reduce((sum, h) => sum + calcAnnualDividend(h).afterTax, 0);
  const totalIncome = totalGross + otherIncome;
  const progress = Math.min((totalIncome / INCOME_LIMIT) * 100, 100);
  const remaining = Math.max(INCOME_LIMIT - totalIncome, 0);
  const isNearLimit = totalIncome > INCOME_LIMIT * 0.8;

  const pieData = [
    ...holdings.map((h) => ({ name: h.ticker, value: calcAnnualDividend(h).gross })),
    { name: '기타소득', value: otherIncome },
  ].filter((d) => d.value > 0);

  const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6'];

  const updateHolding = (id: number, field: keyof Holding, value: number | string) => {
    setHoldings(holdings.map((h) => h.id === id ? { ...h, [field]: field === 'ticker' ? value : Number(value) } : h));
  };

  const addHolding = () => {
    setHoldings([...holdings, {
      id: Date.now(), ticker: 'NEW', shares: 100, dividendPerShare: 0.3,
      priceUSD: 0, exchangeRate: 1400, quartersPerYear: 4,
    }]);
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border-2 border-purple-100">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded-full">6</span>
        <h2 className="font-bold text-gray-800 text-lg">배당·이자 종합소득</h2>
        <span className="text-lg">💰</span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>연간 금융소득</span>
          <span className={`font-bold ${isNearLimit ? 'text-red-500' : 'text-purple-600'}`}>
            {(totalIncome / 10000).toFixed(0)}만원 / 2,000만원
          </span>
        </div>
        <div className="w-full bg-purple-50 rounded-full h-4 overflow-hidden">
          <div
            className={`h-4 rounded-full transition-all duration-500 ${isNearLimit ? 'bg-gradient-to-r from-red-400 to-red-600' : 'bg-gradient-to-r from-purple-400 to-violet-500'}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        {isNearLimit && <p className="text-xs text-red-500 mt-1">⚠️ 2천만원 초과 시 종합과세 대상!</p>}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-purple-50 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">배당 총액(세전)</div>
          <div className="font-bold text-purple-700 text-sm">{(totalGross / 10000).toFixed(0)}만원</div>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">세후 배당</div>
          <div className="font-bold text-green-600 text-sm">{(totalAfterTax / 10000).toFixed(0)}만원</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">여유 한도</div>
          <div className="font-bold text-blue-600 text-sm">{(remaining / 10000).toFixed(0)}만원</div>
        </div>
      </div>

      <div className="mb-4">
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" outerRadius={60} dataKey="value">
              {pieData.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${(Number(value) / 10000).toFixed(0)}만원`]} />
            <Legend iconSize={10} formatter={(value) => <span className="text-xs">{value}</span>} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-3">
        <div className="text-xs text-gray-500 mb-2">ETF 보유 현황</div>
        {holdings.map((h) => {
          const { gross, afterTax } = calcAnnualDividend(h);
          return (
            <div key={h.id} className="border border-gray-100 rounded-xl p-3 mb-2">
              <div className="flex items-center gap-2 mb-2">
                <input
                  value={h.ticker}
                  onChange={(e) => updateHolding(h.id, 'ticker', e.target.value)}
                  className="w-16 font-mono text-sm font-bold border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-purple-400"
                />
                <span className="text-xs text-gray-400 ml-auto">
                  세후 연 {(afterTax / 10000).toFixed(0)}만원
                </span>
                <button onClick={() => setHoldings(holdings.filter((x) => x.id !== h.id))} className="text-gray-300 hover:text-red-400">×</button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-400">보유 수량</label>
                  <input type="number" value={h.shares} onChange={(e) => updateHolding(h.id, 'shares', e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-purple-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">배당($)</label>
                  <input type="number" step="0.001" value={h.dividendPerShare} onChange={(e) => updateHolding(h.id, 'dividendPerShare', e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-purple-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-400">환율(₩)</label>
                  <input type="number" value={h.exchangeRate} onChange={(e) => updateHolding(h.id, 'exchangeRate', e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-purple-400" />
                </div>
              </div>
            </div>
          );
        })}
        <button onClick={addHolding}
          className="w-full border-2 border-dashed border-purple-200 text-purple-400 rounded-xl py-2 text-sm hover:border-purple-400 hover:text-purple-600 transition-colors">
          + ETF 추가
        </button>
      </div>

      <div className="mb-2">
        <label className="text-xs text-gray-500 mb-1 block">기타 금융소득 (이자 등)</label>
        <input type="range" min={0} max={5000000} step={100000} value={otherIncome}
          onChange={(e) => setOtherIncome(Number(e.target.value))}
          className="w-full accent-purple-500" />
        <div className="text-right text-xs text-purple-600 font-bold">{(otherIncome / 10000).toFixed(0)}만원</div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
        ⚠️ 배당 15.4% 원천징수 | 금융소득 2천만원 초과 시 종합과세(누진세율) 적용
      </div>
    </div>
  );
}
