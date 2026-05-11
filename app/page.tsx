import PensionTracker from './components/PensionTracker';
import ISATracker from './components/ISATracker';
import CommissionTracker from './components/CommissionTracker';
import ISAETFTracker from './components/ISAETFTracker';
import USStockTaxTracker from './components/USStockTaxTracker';
import DividendTracker from './components/DividendTracker';
import GoalSummary from './components/GoalSummary';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 bg-white rounded-2xl px-6 py-3 shadow-sm border border-orange-100 mb-4">
            <span className="text-3xl">✨</span>
            <div>
              <h1 className="text-2xl font-black text-gray-800">3년 동안 배운점</h1>
              <p className="text-sm text-gray-500">한국 개인투자자 절세 전략 대시보드</p>
            </div>
            <span className="text-3xl">✨</span>
          </div>
          <div className="flex justify-center gap-3 flex-wrap">
            {['연금저축', 'ISA', '수수료 절감', 'ETF 배당', '양도세 절세', '종합과세 관리'].map((tag) => (
              <span key={tag} className="bg-white text-gray-600 text-xs px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-5">
          <PensionTracker />
          <ISATracker />
          <CommissionTracker />
          <ISAETFTracker />
          <USStockTaxTracker />
          <DividendTracker />
        </div>

        <GoalSummary />

        <div className="text-center mt-6 text-xs text-gray-400">
          * 이 대시보드는 개인 투자 관리용입니다. 실제 세무 상담은 전문가에게 문의하세요.
        </div>
      </div>
    </main>
  );
}
