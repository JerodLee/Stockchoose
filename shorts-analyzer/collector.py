"""Stage 1 — YouTube Data API v3 수집.

쿼터 절약 원칙:
- search.list(100유닛)는 주제 키워드 모드에서 채널 발굴 시 1회만 사용
- 이후는 channels.list / playlistItems.list / videos.list / commentThreads.list (각 1유닛) 위주
- 채널 ID 직접 지정 모드(--channels)에서는 search를 아예 사용하지 않음
"""

import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

# YouTube Data API v3 메서드별 쿼터 비용 (유닛)
QUOTA_COSTS = {
    "search.list": 100,
    "channels.list": 1,
    "playlistItems.list": 1,
    "videos.list": 1,
    "commentThreads.list": 1,
}


class QuotaTracker:
    """API 호출별 쿼터 사용량 추정치를 집계한다."""

    def __init__(self):
        self.used = 0
        self.calls = {}

    def add(self, method: str):
        cost = QUOTA_COSTS.get(method, 1)
        self.used += cost
        self.calls[method] = self.calls.get(method, 0) + 1

    def summary(self) -> str:
        lines = [f"  {m}: {n}회 x {QUOTA_COSTS.get(m, 1)}유닛" for m, n in self.calls.items()]
        lines.append(f"  총 추정 사용량: {self.used}유닛 (일일 무료 쿼터 10,000유닛)")
        return "\n".join(lines)


def _parse_duration_seconds(iso_duration: str) -> int:
    """ISO 8601 duration(PT1M30S 등)을 초로 변환한다."""
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso_duration or "")
    if not m:
        return 0
    h, mi, s = (int(g) if g else 0 for g in m.groups())
    return h * 3600 + mi * 60 + s


class Collector:
    def __init__(self, config: dict, quota: QuotaTracker | None = None):
        api_key = os.environ.get("YOUTUBE_API_KEY")
        if not api_key:
            raise RuntimeError("YOUTUBE_API_KEY가 설정되지 않았습니다 (.env 확인)")
        self.yt = build("youtube", "v3", developerKey=api_key)
        self.config = config
        self.quota = quota or QuotaTracker()
        self.recent_days = config["channel_discovery"]["recent_days"]
        self.published_after = datetime.now(timezone.utc) - timedelta(days=self.recent_days)

    # ── 채널 발굴 ────────────────────────────────────────────────

    def discover_channels(self, topic: str) -> list[dict]:
        """주제 키워드로 쇼츠 상위 채널을 발굴한다. search.list 1회(100유닛)만 사용."""
        cfg = self.config["channel_discovery"]
        logger.info("주제 '%s' 쇼츠 상위 채널 검색 중 (search 1회 = 100유닛)", topic)

        resp = (
            self.yt.search()
            .list(
                part="snippet",
                q=f"{topic} shorts",
                type="video",
                videoDuration="short",
                order="viewCount",
                publishedAfter=self.published_after.isoformat().replace("+00:00", "Z"),
                regionCode="KR",
                relevanceLanguage="ko",
                maxResults=50,
            )
            .execute()
        )
        self.quota.add("search.list")

        # 검색 결과에서 채널 후보 추출 (등장 순 = 조회수 상위 영상의 채널 우선)
        seen, candidate_ids = set(), []
        for item in resp.get("items", []):
            cid = item["snippet"]["channelId"]
            if cid not in seen:
                seen.add(cid)
                candidate_ids.append(cid)

        channels = self._fetch_channel_stats(candidate_ids)

        # 구독자 수 필터 → 상위 max_channels개
        filtered = [c for c in channels if c["subscriberCount"] >= cfg["min_subscribers"]]
        filtered.sort(key=lambda c: c["subscriberCount"], reverse=True)
        selected = filtered[: cfg["max_channels"] * 2]  # 업로드 빈도 필터에서 탈락할 여유분 확보
        logger.info("후보 채널 %d개 → 구독자 필터 통과 %d개", len(channels), len(filtered))
        return selected

    def load_channels(self, channel_ids: list[str]) -> list[dict]:
        """채널 ID 리스트 모드 — search 없이 channels.list만 사용."""
        return self._fetch_channel_stats(channel_ids)

    def _fetch_channel_stats(self, channel_ids: list[str]) -> list[dict]:
        channels = []
        for i in range(0, len(channel_ids), 50):
            batch = channel_ids[i : i + 50]
            resp = (
                self.yt.channels()
                .list(part="snippet,statistics,contentDetails", id=",".join(batch), maxResults=50)
                .execute()
            )
            self.quota.add("channels.list")
            for item in resp.get("items", []):
                channels.append(
                    {
                        "channelId": item["id"],
                        "title": item["snippet"]["title"],
                        "subscriberCount": int(item["statistics"].get("subscriberCount", 0)),
                        "uploadsPlaylistId": item["contentDetails"]["relatedPlaylists"]["uploads"],
                    }
                )
        return channels

    # ── 영상 수집 ────────────────────────────────────────────────

    def collect_channel_shorts(self, channel: dict) -> list[dict]:
        """채널의 최근 90일 쇼츠를 수집하고 조회수 상위 N개를 반환한다."""
        vcfg = self.config["videos"]
        video_ids = self._recent_upload_ids(channel["uploadsPlaylistId"])
        if not video_ids:
            return []

        videos = []
        for i in range(0, len(video_ids), 50):
            batch = video_ids[i : i + 50]
            resp = (
                self.yt.videos()
                .list(part="snippet,statistics,contentDetails", id=",".join(batch), maxResults=50)
                .execute()
            )
            self.quota.add("videos.list")
            for item in resp.get("items", []):
                duration = _parse_duration_seconds(item["contentDetails"]["duration"])
                published = item["snippet"]["publishedAt"]
                if duration == 0 or duration > vcfg["max_short_seconds"]:
                    continue  # 쇼츠가 아님
                if datetime.fromisoformat(published.replace("Z", "+00:00")) < self.published_after:
                    continue
                videos.append(
                    {
                        "videoId": item["id"],
                        "title": item["snippet"]["title"],
                        "description": item["snippet"].get("description", ""),
                        "viewCount": int(item["statistics"].get("viewCount", 0)),
                        "likeCount": int(item["statistics"].get("likeCount", 0)),
                        "commentCount": int(item["statistics"].get("commentCount", 0)),
                        "publishedAt": published,
                        "durationSeconds": duration,
                        "thumbnailUrl": item["snippet"]["thumbnails"].get("high", {}).get("url", ""),
                    }
                )

        videos.sort(key=lambda v: v["viewCount"], reverse=True)
        top = videos[: vcfg["per_channel"]]

        # outlier score: 채널의 기간 내 전체 쇼츠 평균 조회수 대비 배수
        avg_views = sum(v["viewCount"] for v in videos) / len(videos) if videos else 0
        for v in top:
            v["outlierScore"] = round(v["viewCount"] / avg_views, 2) if avg_views else 0.0
        channel["avgViewCount"] = round(avg_views)
        channel["shortsInPeriod"] = len(videos)
        return top

    def _recent_upload_ids(self, playlist_id: str, max_pages: int = 4) -> list[str]:
        """업로드 재생목록에서 최근 90일 내 영상 ID를 페이징 수집한다 (1유닛/페이지)."""
        ids, page_token = [], None
        for _ in range(max_pages):
            try:
                resp = (
                    self.yt.playlistItems()
                    .list(part="contentDetails", playlistId=playlist_id, maxResults=50, pageToken=page_token)
                    .execute()
                )
            except HttpError as e:
                logger.warning("재생목록 %s 조회 실패, 스킵: %s", playlist_id, e)
                return ids
            self.quota.add("playlistItems.list")
            stop = False
            for item in resp.get("items", []):
                published = item["contentDetails"].get("videoPublishedAt")
                if published and datetime.fromisoformat(published.replace("Z", "+00:00")) < self.published_after:
                    stop = True  # 업로드 목록은 최신순 → 기간 밖이면 종료
                    continue
                ids.append(item["contentDetails"]["videoId"])
            page_token = resp.get("nextPageToken")
            if stop or not page_token:
                break
        return ids

    # ── 댓글 수집 ────────────────────────────────────────────────

    def collect_comments(self, video_id: str) -> list[dict]:
        """떡상 영상의 상위 댓글(좋아요 순)을 수집한다. 댓글 비활성화 영상은 스킵."""
        per_video = self.config["comments"]["per_video"]
        comments, page_token = [], None
        while len(comments) < per_video:
            try:
                resp = (
                    self.yt.commentThreads()
                    .list(
                        part="snippet",
                        videoId=video_id,
                        order="relevance",
                        maxResults=min(100, per_video - len(comments)),
                        textFormat="plainText",
                        pageToken=page_token,
                    )
                    .execute()
                )
            except HttpError as e:
                reason = ""
                if e.error_details:
                    reason = e.error_details[0].get("reason", "")
                if reason == "commentsDisabled" or e.resp.status == 403:
                    logger.info("영상 %s: 댓글 비활성화 → 스킵", video_id)
                else:
                    logger.warning("영상 %s 댓글 수집 실패(%s) → 스킵", video_id, reason or e.resp.status)
                return comments
            self.quota.add("commentThreads.list")
            for item in resp.get("items", []):
                top = item["snippet"]["topLevelComment"]["snippet"]
                comments.append(
                    {
                        "text": top.get("textDisplay", ""),
                        "likeCount": int(top.get("likeCount", 0)),
                        "publishedAt": top.get("publishedAt", ""),
                    }
                )
            page_token = resp.get("nextPageToken")
            if not page_token:
                break
        comments.sort(key=lambda c: c["likeCount"], reverse=True)
        return comments[:per_video]

    # ── 파이프라인 ───────────────────────────────────────────────

    def run(self, topic: str | None, channel_ids: list[str] | None, out_dir: Path) -> dict:
        cfg = self.config["channel_discovery"]

        if channel_ids:
            channels = self.load_channels(channel_ids)
        else:
            channels = self.discover_channels(topic)

        results = []
        for ch in channels:
            if len(results) >= cfg["max_channels"]:
                break
            videos = self.collect_channel_shorts(ch)
            if not channel_ids and ch.get("shortsInPeriod", 0) < cfg["min_uploads_in_period"]:
                logger.info("채널 '%s': 기간 내 쇼츠 %d개 < %d → 활동성 미달, 제외",
                            ch["title"], ch.get("shortsInPeriod", 0), cfg["min_uploads_in_period"])
                continue
            if not videos:
                continue
            ch["videos"] = videos
            results.append(ch)
            logger.info("채널 '%s': 쇼츠 %d개 수집 (평균 조회수 %s)",
                        ch["title"], len(videos), f"{ch['avgViewCount']:,}")

        # 떡상 영상 댓글 수집
        threshold = self.config["outlier"]["threshold"]
        outlier_count = 0
        for ch in results:
            for v in ch["videos"]:
                if v["outlierScore"] >= threshold:
                    v["isOutlier"] = True
                    v["comments"] = self.collect_comments(v["videoId"])
                    outlier_count += 1
                else:
                    v["isOutlier"] = False
        logger.info("떡상 영상(평균 %.1f배 이상) %d개 → 댓글 수집 완료", threshold, outlier_count)

        data = {
            "collectedAt": datetime.now(timezone.utc).isoformat(),
            "topic": topic,
            "config": self.config,
            "channels": results,
        }
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / "collected.json"
        out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.info("수집 데이터 저장: %s", out_path)
        logger.info("YouTube API 쿼터 사용량 추정:\n%s", self.quota.summary())
        return data
