'use client';

import { useState } from 'react';

const MAX_ANNUAL = 6000000;
const TAX_RATE = 0.15;
const MONTHLY_TARGET = 500000;

export default function PensionTracker() {
  const [contributed, setContributed] = useState(3000000);

  const progress = Math.min((contributed / MAX_ANNUAL) * 100, 100);
  const remaining = Math.max(MAX_ANNUAL - contributed, 0);
  const taxRefund = contributed * TAX_RATE;
  const monthsNeeded = Math.ceil(remaining / MONTHLY_TARGET);

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border-2 border-blue-100">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">1</span>
        <h2 className="font-bold text-gray-800 text-lg">연금저축펀드</h2>
        <span className="text-lg">📚</span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>납입금액</span>
          <span className="font-bold text-blue-600">{(contributed / 10000).toFixed(0)}만원 / 600만원</span>
        </div>
        <div className="w-full bg-blue-50 rounded-full h-4 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-400 to-blue-600 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
            style={{ width: `${progress}%` }}
          >
            {progress > 15 && <span className="text-white text-xs font-bold">{progress.toFixed(0)}%</span>}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <label className="text-xs text-gray-500 mb-1 block">올해 납입금액 조정</label>
        <input
          type="range"
          min={0}
          max={MAX_ANNUAL}
          step={100000}
          value={contributed}
          onChange={(e) => setContributed(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">남은 납입액</div>
          <div className="font-bold text-blue-700 text-sm">{(remaining / 10000).toFixed(0)}만원</div>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">연말정산 환급</div>
          <div className="font-bold text-green-600 text-sm">~{(taxRefund / 10000).toFixed(0)}만원</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">완납까지</div>
          <div className="font-bold text-purple-600 text-sm">{monthsNeeded}개월</div>
        </div>
      </div>

      <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-700">
        💡 월 50만원씩 납입 시 연말정산 환급 <strong>최대 90만원</strong>
      </div>
    </div>
  );
}
