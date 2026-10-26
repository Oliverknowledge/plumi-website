#!/bin/zsh
# Turns a practice pack's two PDFs into what the site serves (see src/content/practicePacks.ts):
#   public/practice-packs/<slug>/{cover,question,scheme}.webp   the pack page's cover and sample pages
#   scripts/practice-packs/.work/pdf/<slug>-v<n>-{questions,mark-scheme}.pdf   for R2, under packs/
#
#   scripts/practice-packs/build.sh <slug> <version> <questions.pdf> <mark-scheme.pdf> <question page> <scheme page>
#   python3 scripts/question-bank/upload_r2.py scripts/practice-packs/.work --pdf-prefix=packs/
#
# A changed pack gets a new version: R2 serves files with a year-long immutable cache.
set -euo pipefail
here=${0:A:h}
root=${here:h:h}
slug=$1 version=$2 qp=$3 ms=$4 qpage=$5 mspage=$6
tmp=$(mktemp -d)
swift "$here/render_pages.swift" "$qp" "$tmp" cover:1 question:$qpage --width=900
swift "$here/render_pages.swift" "$ms" "$tmp" scheme:$mspage --width=900
mkdir -p "$root/public/practice-packs/$slug" "$here/.work/pdf"
for n in cover question scheme; do
  if command -v cwebp >/dev/null; then cwebp -quiet -q 82 "$tmp/$n.png" -o "$root/public/practice-packs/$slug/$n.webp"
  else python3 -c "from PIL import Image; import sys; Image.open(sys.argv[1]).save(sys.argv[2], 'WEBP', quality=82)" "$tmp/$n.png" "$root/public/practice-packs/$slug/$n.webp"  # no cwebp: Pillow writes the same WebP
  fi
done
cp "$qp" "$here/.work/pdf/$slug-v$version-questions.pdf"
cp "$ms" "$here/.work/pdf/$slug-v$version-mark-scheme.pdf"
rm -rf "$tmp"
ls -la "$root/public/practice-packs/$slug" "$here/.work/pdf"
