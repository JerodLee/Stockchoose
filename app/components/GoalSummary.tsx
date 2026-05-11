'use client';

export default function GoalSummary() {
  const goals = [
    { label: '양도소득세 절세', desc: '미국주식 연 250만원 한도 관리', done: true, icon: '🇺🇸' },
    { label: 'ISA 400만원 납입', desc: '3년 의무보유 후 연금으로 이전', done: false, icon: '📗' },
    { label: '연금저축펀드 600만원', desc: '연말정산 최대 90만원 환급', done: false, icon: '📚' },
    { label: '수수료 0원', desc: '위탁계좌 무료 수수료 유지', done: true, icon: '💸' },
    { label: '배당소득 2천만원 이하', desc: '종합과세 회피 전략', done: true, icon: '💰' },
  ];

  const doneCount = goals.filter((g) => g.done).length;

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-5 shadow-sm border-2 border-indigo-100">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">🎯</span>
        <div>
          <h2 className="font-bold text-gray-800 text-lg">투자 목표 체크리스트</h2>
          <p className="text-xs text-gray-500">3년 동안 배운점 실행 현황</p>
        </div>
        <div className="ml-auto text-right">
          <div className="text-2xl font-bold text-indigo-600">{doneCount}/{goals.length}</div>
          <div className="text-xs text-gray-400">달성</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="w-full bg-indigo-100 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-700"
            style={{ width: `${(doneCount / goals.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {goals.map((g, i) => (
          <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${g.done ? 'bg-white border border-green-200' : 'bg-white border border-gray-100'}`}>
            <span className="text-lg">{g.icon}</span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-800">{g.label}</div>
              <div className="text-xs text-gray-400">{g.desc}</div>
            </div>
            <span className={`text-lg ${g.done ? '' : 'grayscale opacity-30'}`}>
              {g.done ? '✅' : '⬜'}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 bg-white rounded-xl p-3 border border-indigo-100">
        <div className="text-xs text-indigo-600 font-bold mb-2">📊 연간 절세 효과 요약</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-gray-400">연금 환급</div>
            <div className="font-bold text-green-600 text-sm">최대 90만원</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">양도세 절감</div>
            <div className="font-bold text-blue-600 text-sm">최대 55만원</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">수수료 절감</div>
            <div className="font-bold text-purple-600 text-sm">수십만원+</div>
          </div>
        </div>
      </div>
    </div>
  );
}
