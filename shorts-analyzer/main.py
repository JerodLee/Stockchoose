"""숏폼 경쟁 채널 분석 파이프라인 — CLI 진입점.

사용법:
  python main.py --topic "재테크"          # 주제 키워드로 채널 자동 발굴
  python main.py --channels channels.yaml  # 채널 ID 직접 지정 (쿼터 절약)
  python main.py --topic "재테크" --reanalyze  # 오늘 수집분 재사용, 분석만 재실행

TODO(확장):
  - 주 1회 cron 스케줄링: crontab 예시 → 0 9 * * 1 cd shorts-analyzer && python main.py --topic "재테크"
  - 썸네일 이미지 다운로드 후 Claude 비전 분석 (hook_analysis에 이미지 블록 추가)
  - 텔레그램 봇 알림 (report.py 참고)
"""

import argparse
import json
import logging
import sys
from datetime import date
from pathlib import Path

import yaml
from dotenv import load_dotenv

from analyzer import Analyzer
from collector import Collector
from report import build_report

BASE_DIR = Path(__file__).parent

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("main")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="유튜브 숏폼 경쟁 채널 분석 파이프라인")
    src = p.add_mutually_exclusive_group()
    src.add_argument("--topic", help="주제 키워드 (예: 재테크)")
    src.add_argument("--channels", help="채널 ID 리스트 yaml 파일 (예: channels.yaml)")
    p.add_argument(
        "--reanalyze",
        action="store_true",
        help="같은 날짜의 수집 데이터가 있으면 수집을 건너뛰고 분석만 재실행",
    )
    return p.parse_args()


def main() -> int:
    load_dotenv(BASE_DIR / ".env")
    args = parse_args()

    config = yaml.safe_load((BASE_DIR / "config.yaml").read_text(encoding="utf-8"))

    channel_ids = None
    if args.channels:
        channels_cfg = yaml.safe_load(Path(args.channels).read_text(encoding="utf-8"))
        channel_ids = channels_cfg.get("channels", [])
        if not channel_ids:
            logger.error("%s 에 channels 리스트가 없습니다", args.channels)
            return 1
        topic = channels_cfg.get("topic") or config["topic"]
    else:
        topic = args.topic or config["topic"]

    today = date.today().isoformat()
    raw_dir = BASE_DIR / "data" / "raw" / today
    collected_path = raw_dir / "collected.json"

    # ── Stage 1: 수집 ──
    if collected_path.exists() and args.reanalyze:
        logger.info("기존 수집 데이터 재사용: %s", collected_path)
        data = json.loads(collected_path.read_text(encoding="utf-8"))
    else:
        if collected_path.exists():
            logger.info("오늘 수집 데이터가 이미 있습니다. 재수집합니다 (분석만 하려면 --reanalyze)")
        collector = Collector(config)
        data = collector.run(topic=topic, channel_ids=channel_ids, out_dir=raw_dir)

    if not data["channels"]:
        logger.error("수집된 채널이 없습니다. 필터 기준(config.yaml)을 완화해보세요.")
        return 1

    # ── Stage 2: 분석 ──
    analyzer = Analyzer(config)
    analysis = analyzer.run(data, topic)

    # 분석 중간 산출물도 저장 (재실행/디버깅용)
    (raw_dir / "analysis.json").write_text(
        json.dumps(analysis, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # ── 리포트 ──
    report_path = BASE_DIR / "reports" / f"{today}_report.md"
    build_report(data, analysis, topic, report_path)

    print(f"\n✅ 완료: {report_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
