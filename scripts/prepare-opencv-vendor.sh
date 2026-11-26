#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/assets/vendor/opencv/opencv.js"
URL="https://github.com/TechStark/opencv-js/releases/download/opencv-js-4.13.0-build3/opencv.js"
EXPECTED_SHA256="f73f3a20958f3a05529cb513805a7311adce0bf05323887c5a9feb3c63c3953e"
mkdir -p "$(dirname "$DEST")"
if [[ -f "$DEST" ]] && echo "$EXPECTED_SHA256  $DEST" | sha256sum --check --status; then
  echo "Pinned OpenCV.js is already present and verified."
  exit 0
fi
TEMP_FILE="$DEST.download"
trap 'rm -f "$TEMP_FILE"' EXIT
curl --fail --location --retry 3 --retry-delay 2 --connect-timeout 20 --max-time 300 "$URL" --output "$TEMP_FILE"
echo "$EXPECTED_SHA256  $TEMP_FILE" | sha256sum --check
mv "$TEMP_FILE" "$DEST"
trap - EXIT
echo "Pinned OpenCV.js downloaded and verified."
