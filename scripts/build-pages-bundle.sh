#!/usr/bin/env bash
# Build the public GitHub Pages artifact from the same file list used in CI.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REQUESTED_OUTPUT="${1:?Usage: bash scripts/build-pages-bundle.sh <output-directory>}"
OUTPUT_DIR="$(realpath -m -- "$REQUESTED_OUTPUT")"

if [[ "$OUTPUT_DIR" == "/" || "$OUTPUT_DIR" == "$ROOT" ]]; then
  echo "Refusing to replace an unsafe output directory: $OUTPUT_DIR" >&2
  exit 1
fi

# Only the dedicated deployment directory or a specifically named temporary
# bundle directory may be removed/rebuilt. Never accept an arbitrary path.
if [[ "$OUTPUT_DIR" != "$ROOT/dist" ]]; then
  output_parent="$(dirname "$OUTPUT_DIR")"
  output_name="$(basename "$OUTPUT_DIR")"
  allowed_temp_parent=false

  for temp_parent in "${RUNNER_TEMP:-/nonexistent}" "${TMPDIR:-/tmp}" "/tmp"; do
    if [[ "$output_parent" == "$temp_parent" ]]; then
      allowed_temp_parent=true
      break
    fi
  done

  if [[ "$allowed_temp_parent" != true || "$output_name" != mizan-pages-bundle* ]]; then
    echo "Output must be $ROOT/dist or a dedicated mizan-pages-bundle* directory in a temporary folder: $OUTPUT_DIR" >&2
    exit 1
  fi
fi

rm -rf -- "$OUTPUT_DIR"
mkdir -p -- "$OUTPUT_DIR"

find "$ROOT" -maxdepth 1 -type f \( \
  -name '*.html' -o \
  -name '*.js' -o \
  -name '*.css' -o \
  -name 'manifest.json' \
\) -exec cp {} "$OUTPUT_DIR/" \;

cp -r "$ROOT/engine" "$ROOT/icons" "$ROOT/data" "$ROOT/assets" "$OUTPUT_DIR/"

required_files=(
  index.html
  admin.html
  contact-info.js
  exam-drafts.js
  question-sharing.js
  mizan-colors.css
  mizan-design-tokens.css
  assets/branding/meezan-assemble.json
  engine/examEngine.js
  data/books.json
  data/search-index.json
  manifest.json
)

for relative_path in "${required_files[@]}"; do
  if [[ ! -f "$OUTPUT_DIR/$relative_path" ]]; then
    echo "Required deployment file is missing: $relative_path" >&2
    exit 1
  fi
done

touch "$OUTPUT_DIR/.nojekyll"
echo "GitHub Pages bundle ready: $OUTPUT_DIR"
