'use client';

import { useState } from 'react';

const ISA_TARGET = 4000000;
const HOLDING_YEARS = 3;

export default function ISATracker() {
  const [contributed, setContributed] = useState(1600000);
  const [startDate, setStartDate] = useState('2024-01-01');

  const progress = Math.min((contributed / ISA_TARGET) * 100, 100);
  const remaining = Math.max(ISA_TARGET - contributed, 0);

  const start = new Date(startDate);
  const maturity = new Date(start);
  maturity.setFullYear(maturity.getFullYear() + HOLDING_YEARS);

  const today = new Date('2026-05-11');
  const totalDays = (maturity.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const elapsedDays = Math.min((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24), totalDays);
  const timeProgress = Math.min((elapsedDays / totalDays) * 100, 100);
  const daysRemaining = Math.max(Math.ceil((maturity.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)), 0);

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border-2 border-green-100">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">2</span>
        <h2 className="font-bold text-gray-800 text-lg">ISA 계좌</h2>
        <span className="text-lg">📗</span>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>납입금액</span>
          <span className="font-bold text-green-600">{(contributed / 10000).toFixed(0)}만원 / 400만원</span>
        </div>
        <div className="w-full bg-green-50 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-green-400 to-emerald-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>의무보유 기간</span>
          <span className="font-bold text-teal-600">{daysRemaining > 0 ? `${daysRemaining}일 남음` : '✅ 완료'}</span>
        </div>
        <div className="w-full bg-teal-50 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-teal-400 to-cyan-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${timeProgress}%` }}
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="text-xs text-gray-500 mb-1 block">ISA 가입일</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-400"
        />
      </div>

      <div className="mb-3">
        <label className="text-xs text-gray-500 mb-1 block">납입금액 조정</label>
        <input
          type="range"
          min={0}
          max={ISA_TARGET}
          step={100000}
          value={contributed}
          onChange={(e) => setContributed(Number(e.target.value))}
          className="w-full accent-green-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">남은 납입액</div>
          <div className="font-bold text-green-700">{(remaining / 10000).toFixed(0)}만원</div>
        </div>
        <div className="bg-teal-50 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">만기일</div>
          <div className="font-bold text-teal-700 text-sm">{maturity.toLocaleDateString('ko-KR')}</div>
        </div>
      </div>

      <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700">
        💡 만기 후 연금저축펀드로 일부 이전 → 연말정산 추가 공제 가능
      </div>
    </div>
  );
}
