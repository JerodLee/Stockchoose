---
name: product-discovery
description: "When the user wants to discover real products from open markets and extract their detailed specs (noise dB, runtime, weight, battery mAh, motor type, price) to fill in unknowns. Also use for '상품 발굴', '오픈마켓 조사', '실제 스펙 조사', '제품 사양 수집', '경쟁 상품 스펙', 'product discovery', 'spec extraction', 'source real products', 'find products with specs'. Searches open markets / review roundups, extracts a normalized spec sheet per candidate, and feeds it to product-selection (scoring) and copywriting (fills [__] placeholders). Flags confidence and sources for every number."
metadata:
  version: 1.0.0
---

# 상품 발굴관 (Product Discovery)

You find **real products** in the market and extract their **verifiable specs**, so downstream skills score and sell on facts instead of guesses.

## Where to source (in priority order)
1. **오픈마켓 공식 API** (프로덕션 권장) — 쿠팡 파트너스 API, 네이버 쇼핑 검색 API, 11번가/G마켓 오픈API, 다나와. 상품명·가격·리뷰수·평점·스펙을 구조화된 형태로 안정적으로 수집.
2. **헤드리스 브라우저** (Playwright) — API로 못 얻는 상세페이지 스펙 표를 렌더링해 파싱. 오픈마켓은 봇 차단이 강하므로 rate-limit·헤더·세션 관리 필수.
3. **리뷰·비교 콘텐츠** (폴백) — 다나와/노서치/전문 리뷰의 스펙 비교표, 제조사 사양. 실측 벤치마크(소음·사용시간)를 얻기 좋음.

> ⚠️ **환경 한계 주의:** 샌드박스·프록시 환경에선 오픈마켓 상세페이지 직접 요청이 403으로 막히는 경우가 많다. 그럴 땐 (1) 공식 API 키를 쓰거나 (2) 리뷰·비교 자료로 폴백하고, **수치의 출처와 신뢰도를 반드시 표기**한다.

## 추출할 스펙 스키마 (상품당)
| 필드 | 예시 |
|---|---|
| model / 판매명 | KONLI F6 |
| price(₩) | 39,900 |
| battery(mAh) | 5000 |
| runtime(저속/강풍, h) | 14 / 4 |
| noise(1단, dB) | ~35 |
| weight(g) | 180 |
| motor | BLDC |
| charge | USB-C, ~3.5h |
| features | 넥/핸디/탁상, 보조배터리 |
| rating / reviews | 4.6 / 12,000 |
| **source / confidence** | (링크) / 높음·중간·낮음 |

## 원칙
- **모든 숫자에 출처·신뢰도.** "up to 12시간"류 마케팅 표기는 낮은 신뢰도로 분리.
- **미확인은 `[__]`로 남긴다** — 지어내지 않는다. (허위 스펙 = 광고법 리스크)
- **정규화** — 단위 통일(mAh, dB, g), 저속/강풍 사용시간 분리.

## 산출물
1. 후보별 **스펙 시트**(위 스키마 표).
2. 카테고리 **벤치마크**(배터리↔사용시간, 소음·무게 기준선).
3. → `product-selection`에 넘겨 점수 근거로, → `copywriting`에 넘겨 `[__]` 채우기.

## Related Skills
- `product-selection`(스펙→점수) · `copywriting`(스펙→카피) · `competitor-profiling`(경쟁 셀러 심층)
