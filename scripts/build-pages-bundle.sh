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

# Inside the repository, only the dedicated dist/ directory may be replaced.
case "$OUTPUT_DIR/" in
  "$ROOT/"*)
    if [[ "$OUTPUT_DIR" != "$ROOT/dist" ]]; then
      echo "Repository output is restricted to $ROOT/dist: $OUTPUT_DIR" >&2
      exit 1
    fi
    ;;
esac

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
