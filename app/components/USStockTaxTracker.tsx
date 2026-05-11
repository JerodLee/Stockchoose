'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const TAX_LIMIT = 2500000;

interface StockGain {
  id: number;
  name: string;
  gain: number;
}

export default function USStockTaxTracker() {
  const [gains, setGains] = useState<StockGain[]>([
    { id: 1, name: 'NVDA', gain: 800000 },
    { id: 2, name: 'AAPL', gain: 600000 },
    { id: 3, name: 'MSFT', gain: 400000 },
  ]);
  const [newName, setNewName] = useState('');
  const [newGain, setNewGain] = useState('');

  const totalGain = gains.reduce((sum, g) => sum + g.gain, 0);
  const progress = Math.min((totalGain / TAX_LIMIT) * 100, 100);
  const remaining = Math.max(TAX_LIMIT - totalGain, 0);
  const isOver = totalGain > TAX_LIMIT;

  const addGain = () => {
    if (!newName || !newGain) return;
    setGains([...gains, { id: Date.now(), name: newName, gain: Number(newGain) }]);
    setNewName('');
    setNewGain('');
  };

  const removeGain = (id: number) => setGains(gains.filter((g) => g.id !== id));

  const chartData = gains.map((g) => ({ name: g.name, gain: g.gain / 10000 }));

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border-2 border-red-100">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">5</span>
        <h2 className="font-bold text-gray-800 text-lg">미국주식 양도소득세</h2>
        <span className="text-lg">🇺🇸</span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>연간 양도차익</span>
          <span className={`font-bold ${isOver ? 'text-red-500' : 'text-orange-500'}`}>
            {(totalGain / 10000).toFixed(0)}만원 / 250만원
          </span>
        </div>
        <div className="w-full bg-orange-50 rounded-full h-4 overflow-hidden">
          <div
            className={`h-4 rounded-full transition-all duration-500 ${isOver ? 'bg-gradient-to-r from-red-400 to-red-600' : 'bg-gradient-to-r from-orange-400 to-amber-500'}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        {isOver && (
          <p className="text-xs text-red-500 mt-1">⚠️ 한도 초과! 매도 후 재매수 또는 장기보유 검토 필요</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className={`rounded-xl p-3 text-center ${isOver ? 'bg-red-50' : 'bg-orange-50'}`}>
          <div className="text-xs text-gray-500 mb-1">총 양도차익</div>
          <div className={`font-bold text-sm ${isOver ? 'text-red-600' : 'text-orange-600'}`}>
            {(totalGain / 10000).toFixed(0)}만원
          </div>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">남은 한도</div>
          <div className="font-bold text-green-600 text-sm">{(remaining / 10000).toFixed(0)}만원</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">절세세율</div>
          <div className="font-bold text-blue-600 text-sm">22%</div>
        </div>
      </div>

      <div className="mb-3">
        <div className="text-xs text-gray-500 mb-2">종목별 수익</div>
        {gains.map((g) => (
          <div key={g.id} className="flex items-center gap-2 mb-1.5">
            <span className="text-xs bg-gray-100 px-2 py-1 rounded font-mono min-w-[60px] text-center">{g.name}</span>
            <input
              type="number"
              value={g.gain}
              onChange={(e) => setGains(gains.map((x) => x.id === g.id ? { ...x, gain: Number(e.target.value) } : x))}
              className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-400"
            />
            <span className="text-xs text-gray-400">원</span>
            <button onClick={() => removeGain(g.id)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
          </div>
        ))}
        <div className="flex gap-2 mt-2">
          <input
            placeholder="종목명"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-20 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-400"
          />
          <input
            type="number"
            placeholder="수익(원)"
            value={newGain}
            onChange={(e) => setNewGain(e.target.value)}
            className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-400"
          />
          <button
            onClick={addGain}
            className="bg-orange-500 text-white px-3 py-1 rounded text-sm hover:bg-orange-600 transition-colors"
          >
            추가
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
        💡 연 250만원 초과 시 → 매도 후 재매수(손익실현) 또는 장기보유 전략
      </div>
    </div>
  );
}
