"""분석 결과를 사람이 읽는 마크다운 리포트로 조립한다."""

import logging
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


def build_report(data: dict, analysis: dict, topic: str, out_path: Path) -> Path:
    channels = data["channels"]
    outliers = [
        (ch, v)
        for ch in channels
        for v in ch["videos"]
        if v.get("isOutlier")
    ]
    outliers.sort(key=lambda t: t[1]["outlierScore"], reverse=True)

    lines = [
        f"# 숏폼 경쟁 채널 분석 리포트 — {topic}",
        "",
        f"- 생성일: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"- 분석 채널: {len(channels)}개 / 떡상 영상: {len(outliers)}개",
        f"- 수집 시점: {data['collectedAt']}",
        "",
        "## 1. 분석 대상 채널",
        "",
        "| 채널 | 구독자 | 기간 내 쇼츠 | 평균 조회수 |",
        "|---|---:|---:|---:|",
    ]
    for ch in channels:
        lines.append(
            f"| {ch['title']} | {ch['subscriberCount']:,} | {ch.get('shortsInPeriod', 0)} | {ch.get('avgViewCount', 0):,} |"
        )

    lines += [
        "",
        "## 2. 떡상 영상 TOP",
        "",
        "| 배수 | 제목 | 채널 | 조회수 |",
        "|---:|---|---|---:|",
    ]
    for ch, v in outliers[:20]:
        lines.append(
            f"| x{v['outlierScore']} | {v['title']} | {ch['title']} | {v['viewCount']:,} |"
        )

    lines += [
        "",
        "## 3. 제목 구조 분석",
        "",
        analysis["title_analysis"],
        "",
        "## 4. 후킹 분석",
        "",
        analysis["hook_analysis"],
        "",
        "## 5. 댓글 니즈 클러스터링",
        "",
        analysis["comment_analysis"],
        "",
        "## 6. 이번 주 만들 영상 기획안 3개",
        "",
        analysis["content_plan"],
        "",
    ]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines), encoding="utf-8")
    logger.info("리포트 저장: %s", out_path)

    # TODO(확장): 텔레그램 봇 알림 — 리포트 요약을 전송.
    #   기존 Moon Scanner 텔레그램 파이프라인 패턴 재사용 예정.
    #   (기획안 3개 + 소재 아이디어 상위 3개만 발췌해서 전송)
    return out_path
