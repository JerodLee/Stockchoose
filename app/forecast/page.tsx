import TopBar from '../components/TopBar';
import NavTabs from '../components/NavTabs';
import ForecastBoard from '../components/ForecastBoard';

export const metadata = {
  title: '1W FORECAST · STOCKCHOOSE',
  description: '주요 코인 1주 롱숏 트렌드 편향',
};

export default function ForecastPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#050505' }}>
      <TopBar />
      <NavTabs />
      <ForecastBoard />
    </div>
  );
}
