# 숏폼 경쟁 채널 분석 파이프라인

특정 주제의 유튜브 쇼츠 상위 채널 10개를 해부해서, 떡상 영상의 제목·후킹 구조와 댓글에서 드러나는 시청자 니즈를 마크다운 리포트로 뽑는 2단계 파이프라인입니다.

## 구조

- **Stage 1 — 수집** (`collector.py`): YouTube Data API v3로 채널 발굴 → 최근 90일 조회수 상위 쇼츠 수집 → outlier score(채널 평균 대비 배수) 계산 → 떡상 영상(3배 이상) 댓글 상위 50개 수집 → `data/raw/{date}/collected.json`
- **Stage 2 — 분석** (`analyzer.py`): Claude API(claude-sonnet-4-6)로 제목 구조 분석 / 3초 후킹 전략 / 댓글 니즈 클러스터링 → 영상 기획안 3개 생성. 프롬프트는 `prompts/`에서 관리.
- **리포트** (`report.py`): `reports/{date}_report.md`

## 설치

```bash
cd shorts-analyzer
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # API 키 2개 입력
```

- **YOUTUBE_API_KEY**: Google Cloud Console → YouTube Data API v3 활성화 → API 키 발급 (일일 무료 쿼터 10,000유닛)
- **ANTHROPIC_API_KEY**: console.anthropic.com에서 발급

## 사용법

```bash
# 주제 키워드로 상위 채널 자동 발굴 (search 1회 = 100유닛)
python main.py --topic "재테크"

# 채널 ID 직접 지정 (search 생략 → 쿼터 절약)
python main.py --channels channels.yaml

# 오늘 수집분 재사용, Claude 분석만 재실행
python main.py --topic "재테크" --reanalyze
```

실행 후 로그에 YouTube API 쿼터 사용량 추정치가 출력됩니다.

## 설정

`config.yaml`에서 채널 필터(구독자 수, 업로드 빈도), 쇼츠 판별 기준, outlier 임계값, 댓글 수, Claude 모델을 조정합니다.

## 확장 예정 (TODO)

- 텔레그램 봇 알림 — 기존 Moon Scanner 텔레그램 파이프라인 패턴 재사용 (`report.py` 참고)
- 주 1회 cron 스케줄링 — `0 9 * * 1 cd shorts-analyzer && python main.py --topic "재테크"`
- 썸네일 이미지 다운로드 후 Claude 비전 분석 (`main.py`, `prompts/hook_analysis.md` 참고)
