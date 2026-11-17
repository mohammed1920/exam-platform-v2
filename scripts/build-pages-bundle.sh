#!/usr/bin/env bash
# Build the public static artifact for GitHub Pages and Vercel.
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

# Keep crawler rules in the published bundle; sitemap.xml is served by the API rewrite.
if [[ -f "$ROOT/robots.txt" ]]; then
  cp "$ROOT/robots.txt" "$OUTPUT_DIR/robots.txt"
fi

cp -r "$ROOT/engine" "$ROOT/icons" "$ROOT/data" "$ROOT/assets" "$OUTPUT_DIR/"

# Give every deployment a distinct Service Worker script/cache version.
# Vercel and GitHub Actions provide their commit SHA; local builds use "local".
BUILD_ID="${VERCEL_GIT_COMMIT_SHA:-${GITHUB_SHA:-local}}"
if [[ ! "$BUILD_ID" =~ ^[A-Za-z0-9._-]+$ ]]; then
  BUILD_ID="local"
fi
sed "s/__MIZAN_BUILD_ID__/$BUILD_ID/g" "$OUTPUT_DIR/service-worker.js" > "$OUTPUT_DIR/service-worker.js.tmp"
mv "$OUTPUT_DIR/service-worker.js.tmp" "$OUTPUT_DIR/service-worker.js"

# Generate deterministic SHA-256 versions for question chapters on every build.
# Only hashes are published; question JSON files remain online-only.
node "$ROOT/scripts/build-question-content-manifest.mjs" "$OUTPUT_DIR/data"

# Build an explicit offline shell manifest (CSS, JS, fonts and UI imagery only).
# Question data, user data and legal-library content are intentionally excluded.
{
  printf '[\n'
  find "$OUTPUT_DIR/assets" "$OUTPUT_DIR/engine" "$OUTPUT_DIR/icons" -type f \( -name '*.css' -o -name '*.js' -o -name '*.mjs' -o -name '*.woff' -o -name '*.woff2' -o -name '*.ttf' -o -name '*.otf' -o -name '*.svg' -o -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.webp' -o -name '*.gif' -o -name '*.ico' \) \
    ! -path '*/features/admin/js/firebase-admin-panel.js' \
    ! -path '*/features/admin/js/admin.js' \
    -printf '"%P",\n' | sort | sed '$ s/,$//'
  printf '\n]\n'
} > "$OUTPUT_DIR/precache-manifest.json"

required_files=(
  index.html
  admin.html
  robots.txt
  assets/shared/js/contact-info.js
  assets/shared/js/book-icons.js
  assets/features/exams/js/exam-drafts.js
  assets/features/exams/js/question-sharing.js
  assets/shared/js/global-search.js
  assets/features/exams/js/wrong-answers-limit.js
  assets/features/exams/js/wrong-answers-retest.js
  assets/features/student-account/js/student-account-patch.js
  assets/features/notifications/js/notifications.js
  assets/shared/js/platform-header-fix.js
  assets/features/admin/js/admin-theme.js
  assets/features/admin/js/admin.js
  assets/features/home/js/home.js
  assets/features/judicial-institute/js/judicial-institute.js
  assets/features/judicial-institute/css/judicial-institute.css
  data/judicial-institute/manifest.json
  data/judicial-institute/README.md
  assets/shared/js/platform-bootstrap.js
  service-worker.js
  precache-manifest.json
  assets/features/student-account/js/user-dashboard.js
  assets/shared/js/theme.js
  assets/features/procedures/js/procedures.js
  assets/shared/js/platform-sidebar.js
  assets/features/admin/js/firebase-admin-panel.js
  assets/features/laws/js/laws.js
  assets/features/forum/js/mizan-pulpit.js
  assets/features/lawyers/js/lawyer-directory.js
  assets/features/petitions/js/petitions.js
  assets/shared/js/firebase-auth.js
  assets/shared/js/app.js
  assets/features/notifications/css/notifications.css
  assets/features/student-account/css/student-sidebar.css
  assets/features/student-account/css/student-ui-fixes.css
  assets/features/admin/css/admin.css
  assets/features/lawyers/css/lawyer-directory.css
  assets/features/student-account/css/user-dashboard.css
  assets/features/laws/css/laws.css
  assets/features/procedures/css/procedures.css
  assets/features/forum/css/mizan-pulpit.css
  assets/features/home/css/home.css
  assets/features/petitions/css/petitions.css
  assets/features/lawyers/css/lawyer-admin.css
  assets/shared/css/mizan-unified-theme.css
  assets/shared/css/style.css
  assets/shared/css/mizan-colors.css
  assets/shared/css/mizan-design-tokens.css
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
echo "Static deployment bundle ready: $OUTPUT_DIR"
