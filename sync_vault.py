#!/usr/bin/env python3
"""
=============================================================================
IELTS ADVANTAGE VAULT - AUTO SYNC & UPDATE ENGINE (sync_vault.py)
=============================================================================
Automatically checks IELTS Advantage's YouTube channel for new videos,
extracts durations, classifies them into correct categories, and updates
videos_data.js.

Usage:
  python3 sync_vault.py          # Checks latest 30 videos
  python3 sync_vault.py --all    # Scans entire channel playlist
=============================================================================
"""

import sys
import json
import re
import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_FILE = SCRIPT_DIR / "videos_data.js"
CHANNEL_URL = "https://www.youtube.com/@IELTSAdvantage/videos"


def determine_category(title, categories):
    """Intelligently classifies a video title into appropriate vault category."""
    title_lower = title.lower()

    if any(k in title_lower for k in ["vip", "success story", "student review", "case study", "band 8.5 story"]):
        return "vip_reviews"
    if any(k in title_lower for k in ["task 1", "task1", "graph", "bar chart", "line graph", "pie chart", "process diagram", "letter"]):
        return "writing_task1"
    if any(k in title_lower for k in ["task 2", "task2", "essay", "makeover", "writing band", "body paragraph", "introduction", "conclusion"]):
        return "writing_task2"
    if any(k in title_lower for k in ["speaking", "cue card", "part 1", "part 2", "part 3", "fluency", "pronunciation", "shadow"]):
        return "speaking"
    if any(k in title_lower for k in ["reading", "true false", "headings", "skimming", "scanning"]):
        return "reading"
    if any(k in title_lower for k in ["listening", "audio", "accent", "spelling"]):
        return "listening"
    if any(k in title_lower for k in ["vocabulary", "vocab", "idiom", "collocation", "phrasal", "words"]):
        return "vocabulary"

    for cat in categories:
        for kw in cat.get("keywords", []):
            if kw.lower() in title_lower:
                return cat["key"]

    return "general_tips"


def load_vault_data():
    """Reads videos_data.js and returns parsed data."""
    if not DATA_FILE.exists():
        print("❌ Error: videos_data.js not found.")
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
    print(f"✅ Successfully updated {DATA_FILE.name}!")


def fetch_channel_videos(limit=30):
    """Uses yt-dlp to fetch video metadata from the channel."""
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
        print(f"⚠️ Error running yt-dlp: {e}")
        return []


def main():
    fetch_all = "--all" in sys.argv
    limit = None if fetch_all else 50

    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("  IELTS Advantage Vault - YouTube Auto-Sync Engine")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    print("🔍 Reading existing vault database...")
    data = load_vault_data()
    if not data:
        return

    existing_videos = data.get("videos", [])
    categories = data.get("categories", [])
    existing_ids = {v["id"]: v for v in existing_videos}

    print(f"📊 Current Vault Count: {len(existing_videos)} masterclasses indexed.")
    print(f"🌐 Fetching {'ALL' if fetch_all else 'latest 50'} videos from @IELTSAdvantage...")

    remote_videos = fetch_channel_videos(limit=limit)

    if not remote_videos:
        print("❌ Could not retrieve videos from YouTube.")
        return

    print(f"📥 Scanned {len(remote_videos)} videos from YouTube channel.\n")

    new_count = 0
    updated_durations = 0

    for r_vid in reversed(remote_videos):
        vid_id = r_vid["id"]
        title = r_vid["title"]
        dur = r_vid["duration"]

        if vid_id not in existing_ids:
            cat = determine_category(title, categories)
            new_item = {
                "id": vid_id,
                "title": title,
                "category": cat,
                "hasPdf": False,
                "duration": dur
            }
            # Insert at the beginning of the vault
            existing_videos.insert(0, new_item)
            existing_ids[vid_id] = new_item
            new_count += 1
            print(f"  ✨ [NEW] [{cat.upper()}] {title} ({dur})")
        else:
            # Update duration or title if needed
            existing_item = existing_ids[vid_id]
            if existing_item.get("duration") in [None, "NA", "15:00", ""] and dur not in ["NA", ""]:
                existing_item["duration"] = dur
                updated_durations += 1

    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    if new_count > 0 or updated_durations > 0:
        print(f"🎉 Sync Complete: Added {new_count} new videos, updated {updated_durations} durations.")
        save_vault_data(data)
    else:
        print("✨ Vault is already 100% up to date with YouTube!")
    print(f"📈 Total Videos in Vault: {len(data.get('videos', []))}")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")


if __name__ == "__main__":
    main()
