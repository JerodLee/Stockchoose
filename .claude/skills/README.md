# Marketing Skills — Stockchoose

이 폴더에는 [`coreyhaines31/marketingskills`](https://github.com/coreyhaines31/marketingskills) (MIT License)
의 **마케팅 스킬 47개**가 설치되어 있습니다. 각 스킬은 특정 마케팅 직무의 전문 지식과 작업 순서를
담은 `SKILL.md` 매뉴얼입니다. Claude Code가 대화 맥락을 보고 알맞은 스킬을 자동으로 선택합니다.

## 가장 중요한 규칙
모든 스킬은 일을 시작하기 전에 **`.claude/product-marketing.md`** (회사 브리핑)를 먼저 참조합니다.
이 문서가 정확할수록 모든 결과 품질이 올라갑니다. → 먼저 이 문서의 `[확인 필요]` 항목을 채우세요.

## 사용법
### ① 자연어로 시키기 (권장)
맥락에 맞는 스킬이 자동으로 작동합니다.

| 이렇게 말하면 | 작동하는 스킬 |
|---|---|
| "이 랜딩페이지 전환율 좀 올려줘" | `cro` |
| "홈페이지 카피 다시 써줘" | `copywriting` |
| "가입 이벤트에 GA4 추적 붙여줘" | `analytics` |
| "5통짜리 웰컴 이메일 시퀀스 만들어줘" | `emails` |
| "경쟁사 대안 페이지 만들어줘" | `competitors` |

### ② 직접 호출하기
특정 스킬을 콕 집어 쓰려면: `product-marketing`, `cro`, `seo-audit`, `marketing-plan` 등을 지정하세요.

## 부서(카테고리)별 스킬
- **전략·리서치:** product-marketing, marketing-plan, customer-research, competitor-profiling, marketing-psychology, marketing-ideas, marketing-council
- **SEO·검색:** seo-audit, ai-seo, programmatic-seo, site-architecture, schema, aso, directory-submissions
- **전환·CRO:** cro, signup, onboarding, popups, paywalls, ab-testing
- **콘텐츠·카피:** copywriting, copy-editing, emails, cold-email, social, content-strategy, video, image, sms
- **광고·측정:** ads, ad-creative, analytics
- **성장·리텐션:** churn-prevention, referrals, lead-magnets, free-tools, community-marketing, marketing-loops, launch, co-marketing, public-relations
- **세일즈·RevOps:** prospecting, revops, sales-enablement, pricing, offers, competitors

## 처음 쓴다면 이 순서로
1. **기반 세팅** — `product-marketing`으로 `.claude/product-marketing.md` 확정
2. **현황 진단** — `customer-research` + `analytics`
3. **전환 개선** — `onboarding` + `cro`
4. **문구 정비** — `copywriting`
5. **검증·반복** — `ab-testing`

---
출처: https://github.com/coreyhaines31/marketingskills (MIT License) · 저작권 표기는 `LICENSE` 파일 참조.
런타임에 불필요한 `evals/` 테스트 폴더는 설치 시 제외했습니다.
