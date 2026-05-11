'use client';

import { useState } from 'react';

interface Trade {
  id: number;
  market: string;
  amount: number;
  commission: number;
}

export default function CommissionTracker() {
  const [trades, setTrades] = useState<Trade[]>([
    { id: 1, market: '국장', amount: 5000000, commission: 0 },
    { id: 2, market: '미장', amount: 3000000, commission: 0 },
  ]);
  const [newMarket, setNewMarket] = useState('국장');
  const [newAmount, setNewAmount] = useState('');
  const [newCommission, setNewCommission] = useState('');

  const totalAmount = trades.reduce((sum, t) => sum + t.amount, 0);
  const totalCommission = trades.reduce((sum, t) => sum + t.commission, 0);
  const avgCommissionRate = totalAmount > 0 ? (totalCommission / totalAmount) * 100 : 0;

  const addTrade = () => {
    if (!newAmount) return;
    setTrades([...trades, {
      id: Date.now(), market: newMarket,
      amount: Number(newAmount), commission: Number(newCommission || 0),
    }]);
    setNewAmount('');
    setNewCommission('');
  };

  const removeTrade = (id: number) => setTrades(trades.filter((t) => t.id !== id));

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border-2 border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded-full">3</span>
        <h2 className="font-bold text-gray-800 text-lg">위탁계좌 수수료</h2>
        <span className="text-lg">💸</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">총 거래금액</div>
          <div className="font-bold text-gray-700 text-sm">{(totalAmount / 10000).toFixed(0)}만원</div>
        </div>
        <div className={`rounded-xl p-3 text-center ${totalCommission === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="text-xs text-gray-500 mb-1">납부 수수료</div>
          <div className={`font-bold text-sm ${totalCommission === 0 ? 'text-green-600' : 'text-red-500'}`}>
            {totalCommission === 0 ? '🎉 0원' : `${totalCommission.toLocaleString()}원`}
          </div>
        </div>
        <div className={`rounded-xl p-3 text-center ${avgCommissionRate === 0 ? 'bg-green-50' : 'bg-amber-50'}`}>
          <div className="text-xs text-gray-500 mb-1">평균 수수료율</div>
          <div className={`font-bold text-sm ${avgCommissionRate === 0 ? 'text-green-600' : 'text-amber-600'}`}>
            {avgCommissionRate === 0 ? '0%' : `${avgCommissionRate.toFixed(3)}%`}
          </div>
        </div>
      </div>

      <div className="mb-3">
        <div className="text-xs text-gray-500 mb-2">거래 내역</div>
        {trades.map((t) => (
          <div key={t.id} className="flex items-center gap-2 mb-1.5 bg-gray-50 rounded-lg px-3 py-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${t.market === '국장' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600'}`}>
              {t.market}
            </span>
            <span className="flex-1 text-sm">{t.amount.toLocaleString()}원</span>
            <span className={`text-sm font-bold ${t.commission === 0 ? 'text-green-500' : 'text-red-500'}`}>
              {t.commission === 0 ? '무료' : `${t.commission.toLocaleString()}원`}
            </span>
            <button onClick={() => removeTrade(t.id)} className="text-gray-300 hover:text-red-400">×</button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <select value={newMarket} onChange={(e) => setNewMarket(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-gray-400">
          <option>국장</option>
          <option>미장</option>
        </select>
        <input type="number" placeholder="거래금액" value={newAmount} onChange={(e) => setNewAmount(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-gray-400" />
        <input type="number" placeholder="수수료(0)" value={newCommission} onChange={(e) => setNewCommission(e.target.value)}
          className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-gray-400" />
        <button onClick={addTrade}
          className="bg-gray-700 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-gray-800 transition-colors">
          추가
        </button>
      </div>

      <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-600">
        💡 국장·미장 위탁계좌는 <strong>수수료 무료 또는 최저가</strong>로 설정하세요
      </div>
    </div>
  );
}
