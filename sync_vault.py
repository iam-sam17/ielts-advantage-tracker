#!/usr/bin/env python3
"""
=============================================================================
IELTS ADVANTAGE VAULT - AUTO SYNC & UPDATE ENGINE (sync_vault.py)
=============================================================================
Automatically checks IELTS Advantage's YouTube channel for new videos,
extracts durations, classifies them into correct categories, and updates
videos_data.js.

Designed to run seamlessly in GitHub Actions (without getting blocked by YouTube)
and locally.

Fetch Strategies:
1. Official YouTube RSS Feed (Cloud-safe, zero datacenter IP block, no API key needed)
2. YouTube Data API v3 (Optional, if YOUTUBE_API_KEY env is set)
3. yt-dlp (Local fallback for full channel archival: python3 sync_vault.py --all)
=============================================================================
"""

import os
import sys
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_FILE = SCRIPT_DIR / "videos_data.js"
CHANNEL_ID = "UCXg7gy4XmPZEGr4kumPNGyQ"
CHANNEL_URL = "https://www.youtube.com/@IELTSAdvantage/videos"
RSS_FEED_URL = f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}"

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"


def format_duration(seconds):
    """Converts seconds into MM:SS or HH:MM:SS format."""
    try:
        s = int(seconds)
        h = s // 3600
        m = (s % 3600) // 60
        sec = s % 60
        if h > 0:
            return f"{h}:{m:02d}:{sec:02d}"
        return f"{m}:{sec:02d}"
    except Exception:
        return "20:00"


def fetch_video_duration(vid_id):
    """Scrapes video duration directly from the watch page metadata."""
    try:
        url = f"https://www.youtube.com/watch?v={vid_id}"
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
            m = re.search(r'\"lengthSeconds\":\"(\d+)\"', html)
            if m:
                return format_duration(m.group(1))
    except Exception as e:
        print(f"    ⚠️ Could not fetch precise duration for {vid_id}: {e}")
    return "20:00"


def determine_category(title, categories):
    """Intelligently classifies a video title into appropriate vault category."""
    title_lower = title.lower()

    # VIP Reviews & Success Stories
    if any(k in title_lower for k in [
        "vip", "success story", "student review", "case study", "band 8.5 story",
        "scored band", "from failure", "visa", "scholarship", "how i got band",
        "sarabdeep", "kashyap", "harneet", "divya", "carolina", "crystal", "komal", "ashok"
    ]):
        return "vip_reviews"

    # Writing Task 1
    if any(k in title_lower for k in [
        "task 1", "task1", "graph", "bar chart", "line graph", "pie chart",
        "process diagram", "letter", "map labeling", "task 1 academic"
    ]):
        return "writing_task1"

    # Writing Task 2
    if any(k in title_lower for k in [
        "task 2", "task2", "essay", "makeover", "writing band", "body paragraph",
        "introduction", "conclusion", "agree or disagree", "opinion essay", "both views"
    ]):
        return "writing_task2"

    # Speaking
    if any(k in title_lower for k in [
        "speaking", "cue card", "part 1", "part 2", "part 3", "fluency",
        "pronunciation", "shadow", "mock interview", "speaking test"
    ]):
        return "speaking"

    # Reading
    if any(k in title_lower for k in [
        "reading", "true false", "not given", "headings", "skimming", "scanning", "reading passage"
    ]):
        return "reading"

    # Listening
    if any(k in title_lower for k in [
        "listening", "audio", "accent", "spelling", "multiple choice"
    ]):
        return "listening"

    # Vocabulary
    if any(k in title_lower for k in [
        "vocabulary", "vocab", "idiom", "collocation", "phrasal", "words", "lexical", "c1 +", "c2 +"
    ]):
        return "vocabulary"

    # Fallback to category keywords configured in database
    for cat in categories:
        for kw in cat.get("keywords", []):
            if kw.lower() in title_lower:
                return cat["key"]

    return "general_tips"


def load_vault_data():
    """Reads videos_data.js and returns parsed data."""
    if not DATA_FILE.exists():
        print(f"❌ Error: {DATA_FILE.name} not found.")
        return None

    content = DATA_FILE.read_text(encoding="utf-8")
    clean = re.sub(r'^\s*const\s+VAULT_DATA\s*=\s*', '', content.strip())
    clean = re.sub(r';\s*$', '', clean)

    try:
        return json.loads(clean)
    except json.JSONDecodeError as e:
        print(f"❌ Failed to parse videos_data.js: {e}")
        return None


def save_vault_data(data):
    """Saves updated JSON structure back to videos_data.js."""
    json_str = json.dumps(data, indent=2, ensure_ascii=False)
    output = f"const VAULT_DATA = {json_str};\n"
    DATA_FILE.write_text(output, encoding="utf-8")
    print(f"💾 Saved database updates to {DATA_FILE.name}!")


def fetch_via_rss():
    """
    Fetches the latest videos using YouTube's official RSS feed.
    100% reliable on GitHub Actions / cloud runners without getting blocked.
    """
    print("📡 Querying YouTube RSS Feed endpoint...")
    req = urllib.request.Request(RSS_FEED_URL, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            xml_data = resp.read()

        root = ET.fromstring(xml_data)
        ns = {
            "atom": "http://www.w3.org/2005/Atom",
            "yt": "http://www.youtube.com/xml/schemas/2015",
            "media": "http://search.yahoo.com/mrss/"
        }

        videos = []
        entries = root.findall("atom:entry", ns)
        print(f"  📥 Found {len(entries)} recent uploads in channel feed.")

        for entry in entries:
            vid_id_elem = entry.find("yt:videoId", ns)
            title_elem = entry.find("atom:title", ns)

            if vid_id_elem is None or not vid_id_elem.text:
                continue

            vid_id = vid_id_elem.text.strip()
            title = title_elem.text.strip() if title_elem is not None else "IELTS Advantage Lesson"

            videos.append({
                "id": vid_id,
                "title": title,
                "duration": None # Will be resolved on-demand if new
            })

        return videos
    except Exception as e:
        print(f"⚠️ RSS feed fetch failed: {e}")
        return []


def fetch_via_ytdlp(limit=50):
    """Fallback using yt-dlp (mainly for full local historical backfills)."""
    print("📺 Querying YouTube via yt-dlp...")
    cmd = [
        "yt-dlp",
        "--flat-playlist",
        "--print", "%(id)s\t%(title)s\t%(duration_string)s",
        CHANNEL_URL
    ]
    if limit:
        cmd.insert(2, "--playlist-end")
        cmd.insert(3, str(limit))

    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        lines = res.stdout.strip().split("\n")
        videos = []
        for line in lines:
            if not line.strip():
                continue
            parts = line.split("\t")
            vid_id = parts[0].strip()
            title = parts[1].strip() if len(parts) > 1 else "IELTS Advantage Lesson"
            dur = parts[2].strip() if len(parts) > 2 and parts[2].strip() != "NA" else "20:00"

            videos.append({
                "id": vid_id,
                "title": title,
                "duration": dur
            })
        return videos
    except Exception as e:
        print(f"⚠️ yt-dlp fetch failed or not installed: {e}")
        return []


def main():
    fetch_all = "--all" in sys.argv

    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("  IELTS Advantage Vault - YouTube Auto-Sync Engine")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    data = load_vault_data()
    if not data:
        sys.exit(1)

    existing_videos = data.get("videos", [])
    categories = data.get("categories", [])
    existing_ids = {v["id"]: v for v in existing_videos}

    print(f"📊 Current Vault Count: {len(existing_videos)} masterclasses indexed.")

    remote_videos = []
    if fetch_all:
        remote_videos = fetch_via_ytdlp(limit=None)
    
    if not remote_videos:
        remote_videos = fetch_via_rss()

    if not remote_videos and not fetch_all:
        remote_videos = fetch_via_ytdlp(limit=50)

    if not remote_videos:
        print("❌ Error: Could not retrieve any video metadata from YouTube.")
        sys.exit(1)

    print(f"📥 Successfully retrieved {len(remote_videos)} videos to evaluate.\n")

    new_count = 0
    updated_durations = 0

    for r_vid in reversed(remote_videos):
        vid_id = r_vid["id"]
        title = r_vid["title"]

        if vid_id not in existing_ids:
            dur = r_vid.get("duration")
            if not dur:
                print(f"  ⏱️ Fetching duration for new video: {vid_id}...")
                dur = fetch_video_duration(vid_id)

            cat = determine_category(title, categories)
            new_item = {
                "id": vid_id,
                "title": title,
                "category": cat,
                "hasPdf": False,
                "duration": dur
            }
            # Insert new video at the very top
            existing_videos.insert(0, new_item)
            existing_ids[vid_id] = new_item
            new_count += 1
            print(f"  ✨ [NEW] [{cat.upper()}] {title} ({dur})")
        else:
            # Update missing or default durations if needed
            existing_item = existing_ids[vid_id]
            if existing_item.get("duration") in [None, "NA", ""]:
                dur = r_vid.get("duration") or fetch_video_duration(vid_id)
                existing_item["duration"] = dur
                updated_durations += 1

    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    if new_count > 0 or updated_durations > 0:
        print(f"🎉 Sync Complete: Added {new_count} new masterclasses, updated {updated_durations} durations.")
        save_vault_data(data)
    else:
        print("✨ Vault is already 100% up to date with YouTube!")
    print(f"📈 Total Videos in Vault: {len(data.get('videos', []))}")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")


if __name__ == "__main__":
    main()
