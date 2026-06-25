#!/usr/bin/env node
// 실데이터 소스 연결 점검 스크립트.
//
// egress 허용목록에 아래 호스트를 추가한 뒤 실행하세요:
//   api.binance.com, fapi.binance.com, api.alternative.me
//
// 사용법:  node scripts/verify-live.mjs

const CHECKS = [
  ['Binance klines (추세/모멘텀/매수압력)', 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=2'],
  ['Binance 현재 펀딩비 (라이브)', 'https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT'],
  ['Binance 펀딩 히스토리 (백테스트)', 'https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=3'],
  ['Alternative.me F&G 히스토리 (심리/백테스트)', 'https://api.alternative.me/fng/?limit=3'],
];

let pass = 0;
for (const [label, url] of CHECKS) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t);
    if (res.ok) {
      await res.json();
      console.log(`  ✅ ${label}  (HTTP ${res.status})`);
      pass++;
    } else {
      console.log(`  ❌ ${label}  (HTTP ${res.status})`);
    }
  } catch (e) {
    console.log(`  ❌ ${label}  (${e.name === 'AbortError' ? 'timeout' : e.message})`);
  }
}

console.log(`\n${pass}/${CHECKS.length} 소스 연결됨.`);
if (pass < CHECKS.length) {
  console.log('실패한 소스가 있으면 환경의 네트워크 egress 허용목록을 확인하세요.');
  console.log('일부 리전은 Binance가 HTTP 451로 차단할 수 있습니다 → api.binance.us 등으로 교체.');
  process.exit(1);
}
console.log('모든 실데이터 소스 정상. /forecast 탭이 라이브로 동작합니다.');
