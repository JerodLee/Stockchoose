# 유튜브 요약 기능 — 가능성 체크 (Feasibility)

- 대상 영상 예시: https://youtu.be/hLn6LrlXgAE
- 작성일: 2026-07-18
- 결론 한 줄: **기술적으로 충분히 가능**. 다만 "무료 자막 라이브러리 → 클라우드 배포" 조합은 IP 차단 때문에 불안정하므로, **상용 transcript API + LLM 요약** 조합을 권장한다.

---

## 1. 무엇을 만들려는가

사용자가 유튜브 투자 영상 URL을 붙여넣으면 → 영상 자막을 뽑아 → LLM으로 요약해서
"핵심 요지 / 언급된 종목 / 강세·약세 논거 / 리스크 / 타임스탬프"를 Stockchoose 대시보드
안에 카드로 보여주는 기능.

지금 앱은 Next.js 16(standalone) 기반 블룸버그 스타일 대시보드이고, **API 라우트가 아직
하나도 없다**(`app/api/*` 없음). 즉 요약 기능은 새 route handler + 클라이언트 패널을
얹으면 되는 순수 "추가" 작업이다. 기존 화면을 뜯을 필요는 없다.

---

## 2. 처리 파이프라인 (3단계)

```
[유튜브 URL] → (1) videoId 파싱 → (2) 자막 추출 → (3) LLM 요약 → [구조화 결과]
```

### (1) videoId 파싱 — 난이도 ★☆☆☆☆
`youtu.be/xxx`, `youtube.com/watch?v=xxx`, `/shorts/xxx` 등 정규식으로 처리. 리스크 없음.

### (2) 자막(transcript) 추출 — **여기가 유일한 병목**
| 방법 | 비용 | 임의 영상 지원 | 클라우드 배포 안정성 | 비고 |
|------|------|----------------|----------------------|------|
| YouTube Data API v3 (공식 Captions) | 무료 | ❌ 내 소유 영상만, OAuth 필요 | - | **사실상 사용 불가** |
| `youtube-transcript-api` (비공식 무료) | 무료 | ✅ | ❌ **클라우드 IP 대량 차단** | 로컬은 되는데 Render 배포하면 깨짐 |
| 상용 transcript API (Supadata / OutlierKit / TranscriptAPI 등) | 유료(저렴) | ✅ | ✅ | 프록시·차단·자막없음 케이스를 대신 처리 |
| `yt-dlp` 오디오 다운로드 + Whisper STT | 무료(무거움) | ✅ | ⚠️ CPU/시간 큼 | 자막 없는 영상용 최후 수단 |

핵심 함정: 무료 `youtube-transcript-api`는 **로컬 개발에선 잘 되다가 Render 같은
클라우드에 올리는 순간 유튜브가 서버 IP를 차단**해서 실패한다. 프로덕션에서 무료로
쓰려면 결국 로테이팅 레지덴셜 프록시가 필요하고, 그러면 이미 무료가 아니다.
→ 그래서 프로덕션은 상용 transcript API를 쓰는 게 가장 현실적이다.

### (3) LLM 요약 — 난이도 ★☆☆☆☆
자막 텍스트를 Claude API(예: `claude-opus-4-8` 또는 비용용 Haiku)에 넣고,
"핵심 요지 / 종목 / 논거 / 리스크"를 **JSON 구조로 출력**하도록 프롬프트. 안정적이고 검증된 부분.

---

## 3. 이 앱에 얹는 구체 구조

```
app/
  api/
    summarize/
      route.ts        ← POST { url } → { summary, tickers[], bullCase[], bearCase[], risks[], timestamps[] }
  components/
    YoutubeSummary.tsx ← URL 입력 + 결과 카드 (기존 블룸버그 다크 테마에 맞춤)
```

- `route.ts`: videoId 파싱 → transcript API 호출 → Claude API 호출 → JSON 반환
- API 키(transcript API, ANTHROPIC_API_KEY)는 Render 환경변수(`render.yaml`의 `envVars`)로 주입
- ⚠️ 이 저장소의 `AGENTS.md` 경고: 이 Next.js는 표준과 다를 수 있으니 **구현 전
  `node_modules/next/dist/docs/`의 route handler 문서를 먼저 읽고** 코드를 작성할 것.

---

## 4. 비용·성능·품질

- **비용(영상 1건)**: 자막 API ≈ $0.001–0.01 + LLM 토큰. 10분 영상 ≈ 1,500단어 ≈ 2K 입력
  토큰 수준이라 요약 LLM 비용은 매우 작다. 캐싱하면 같은 영상 재요약은 공짜.
- **지연**: 10–20분 영상 기준 수 초 ~ 십수 초. 긴 영상(1시간+)은 청크 분할 후 map-reduce 요약 권장.
- **한국어 품질**: 이 채널이 한국어 투자 영상일 가능성이 큰데, 유튜브 **자동생성
  한국어 자막은 영어(정확도 ~95%)보다 오탈자·종목명 오인식이 잦다.** 수동 자막이 있으면
  그걸 우선 쓰고, 없으면 Whisper large 또는 상용 API의 자체 STT가 자동자막보다 낫다.
- **투자 도메인 주의**: 종목명·티커·수치를 잘못 요약하면 곧 오정보다. 프롬프트에서
  "원문에 없는 수치·종목은 만들지 말 것"을 강제하고, 결과에 "요약이며 투자권유 아님" 고지 필요.

---

## 5. 리스크 / 제약

1. **유튜브 ToS**: 자막 스크래핑은 유튜브 약관 위반 소지가 있다. 상용 API를 쓰면 그
   책임/차단 회피를 벤더가 흡수하지만, 완전한 면책은 아니다.
2. **클라우드 IP 차단**(위 2-(2)): 무료 경로의 최대 약점. 상용 API로 회피.
3. **자막 없는 영상**: Whisper 폴백이 필요하고 서버 부하·시간이 큼. Render 웹 서비스에서
   무거운 STT를 돌리면 타임아웃 위험 → 상용 API의 STT 폴백이 더 안전.
4. **네트워크 정책**: 이 개발 샌드박스의 이그레스 정책이 `youtube.com`을 **403으로 차단**하고
   있어(확인함), 여기서 대상 영상 메타데이터/자막을 실제로 가져와 검증하지는 못했다.
   프로덕션(Render)에서도 유튜브/자막 API로의 아웃바운드 허용 여부를 배포 전에 확인해야 한다.

---

## 6. 권장안 (MVP)

1. 자막: **상용 transcript API 1곳**(Supadata 등, 월 $5~ 시작, 한국어 포함 50+개 언어, 자막
   없는 영상 STT 폴백 제공)로 시작 — 무료 라이브러리는 프로토타입에서만.
2. 요약: **Claude API**, JSON 구조 출력 + 투자 오정보 방지 프롬프트.
3. 결과 캐싱(videoId 키)으로 비용·지연 절감.
4. UI: 기존 대시보드에 "영상 요약" 패널 추가.

**총평: 가능(GO). 병목은 오직 "자막 추출을 클라우드에서 안정적으로 하는 것" 하나이며,
상용 transcript API로 해소된다. 나머지(파싱·요약·UI)는 표준 작업이다.**

---

## 참고 자료
- [YouTube Transcript API 정리 (OutlierKit, 2026)](https://outlierkit.com/resources/youtube-transcript-api/)
- [클라우드 IP 차단 이슈 (youtube-transcript-api #593)](https://github.com/jdepoix/youtube-transcript-api/issues/593)
- [Supadata — 자막/STT API, 다국어](https://supadata.ai/blog/best-youtube-transcript-api)
- [2026 Transcript API 비교 (TranscriptAPI)](https://transcriptapi.com/blog/best-youtube-transcript-apis-compared)
- [n8n: 자막 + LLM 요약 워크플로 예시](https://n8n.io/workflows/3828-generate-youtube-video-summaries-with-searchapi-transcripts-and-llm/)
