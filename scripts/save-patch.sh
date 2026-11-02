#!/usr/bin/env bash
# Saves every change made inside pokefirered/ (edited and new files) to
# patches/pokefirered-dailyred.patch. Run it after editing the game, and
# commit the patch: pokefirered/ itself isn't tracked by this repository.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAME="$ROOT/pokefirered"

# Mark new files as "intent to add" so they appear in the diff (ignored build
# outputs stay out, thanks to pokefirered's own .gitignore).
git -C "$GAME" add --intent-to-add .
PYTHON="$(command -v python || command -v python3)"
git -C "$GAME" diff --binary HEAD | "$PYTHON" "$ROOT/scripts/normalize-binary-patch.py" > "$ROOT/patches/pokefirered-dailyred.patch"
git -C "$GAME" diff --stat HEAD | tail -1
echo "Saved patches/pokefirered-dailyred.patch"
