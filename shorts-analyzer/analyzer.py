"""Stage 2 — Claude API 분석.

프롬프트는 prompts/ 디렉토리에서 로드하며, 분석 3종(제목 구조 / 후킹 / 댓글 니즈)을
각각 독립 호출로 수행한 뒤 종합 기획안을 생성한다.
"""

import json
import logging
from pathlib import Path

from anthropic import Anthropic

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent / "prompts"


def _load_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8")


def _outlier_videos(data: dict) -> list[dict]:
    out = []
    for ch in data["channels"]:
        for v in ch["videos"]:
            if v.get("isOutlier"):
                out.append({**v, "channelTitle": ch["title"], "channelAvgViews": ch["avgViewCount"]})
    return out


def _title_payload(data: dict) -> str:
    rows = []
    for ch in data["channels"]:
        for v in ch["videos"]:
            rows.append(
                {
                    "channel": ch["title"],
                    "title": v["title"],
                    "viewCount": v["viewCount"],
                    "outlierScore": v["outlierScore"],
                    "isOutlier": v.get("isOutlier", False),
                }
            )
    return json.dumps(rows, ensure_ascii=False, indent=1)


def _hook_payload(data: dict) -> str:
    rows = [
        {
            "channel": v["channelTitle"],
            "title": v["title"],
            "description": v["description"][:500],
            "thumbnailUrl": v["thumbnailUrl"],
            "outlierScore": v["outlierScore"],
            "durationSeconds": v["durationSeconds"],
        }
        for v in _outlier_videos(data)
    ]
    return json.dumps(rows, ensure_ascii=False, indent=1)


def _comment_payload(data: dict) -> str:
    rows = [
        {
            "title": v["title"],
            "outlierScore": v["outlierScore"],
            "comments": [{"text": c["text"][:300], "likes": c["likeCount"]} for c in v.get("comments", [])],
        }
        for v in _outlier_videos(data)
        if v.get("comments")
    ]
    return json.dumps(rows, ensure_ascii=False, indent=1)


class Analyzer:
    def __init__(self, config: dict):
        self.client = Anthropic()  # ANTHROPIC_API_KEY는 환경변수에서 자동 로드
        acfg = config["analysis"]
        self.model = acfg["model"]
        self.max_tokens = acfg["max_tokens"]

    def _ask(self, prompt: str, label: str) -> str:
        logger.info("Claude 분석 실행: %s (model=%s)", label, self.model)
        with self.client.messages.stream(
            model=self.model,
            max_tokens=self.max_tokens,
            thinking={"type": "adaptive"},
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            message = stream.get_final_message()
        if message.stop_reason == "refusal":
            raise RuntimeError(f"{label} 분석이 거절되었습니다 (stop_reason=refusal)")
        text = "".join(b.text for b in message.content if b.type == "text")
        logger.info("%s 완료 (output %d tokens)", label, message.usage.output_tokens)
        return text

    def run(self, data: dict, topic: str) -> dict:
        threshold = data["config"]["outlier"]["threshold"]

        title_analysis = self._ask(
            _load_prompt("title_analysis").format(
                outlier_threshold=threshold, data=_title_payload(data)
            ),
            "제목 구조 분석",
        )
        hook_analysis = self._ask(
            _load_prompt("hook_analysis").format(data=_hook_payload(data)),
            "후킹 분석",
        )
        comment_analysis = self._ask(
            _load_prompt("comment_needs").format(data=_comment_payload(data)),
            "댓글 니즈 클러스터링",
        )
        content_plan = self._ask(
            _load_prompt("content_plan").format(
                topic=topic,
                title_analysis=title_analysis,
                hook_analysis=hook_analysis,
                comment_analysis=comment_analysis,
            ),
            "영상 기획안 생성",
        )
        return {
            "title_analysis": title_analysis,
            "hook_analysis": hook_analysis,
            "comment_analysis": comment_analysis,
            "content_plan": content_plan,
        }
