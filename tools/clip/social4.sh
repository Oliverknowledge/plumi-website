#!/usr/bin/env bash
# The social cut v4 in one command: raw frames of both shapes from the real engines, then the grade, captions and encode.
#   bash tools/clip/social4.sh [OUT_DIR]      (default ../clips/v4 beside the repo; frames go to OUT_DIR/raw and can be deleted after)
# Starts `next dev` on :3978 itself if nothing answers there (and stops it); a running one is used (`--base URL` is passed to social4.mjs through BASE=URL).
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="${1:-../clips/v4}"
mkdir -p "$OUT"
node tools/clip/social4.mjs --aspect both --out "$OUT/raw" ${BASE:+--base "$BASE"}
python3 tools/clip/grade.py --config tools/clip/social4.json --frames "$OUT/raw/landscape" --out "$OUT/plumi-social-1080p.mp4" &
python3 tools/clip/grade.py --config tools/clip/social4.json --frames "$OUT/raw/vertical" --out "$OUT/plumi-social-vertical.mp4" &
wait
echo "done: $OUT/plumi-social-1080p.mp4 and $OUT/plumi-social-vertical.mp4"
