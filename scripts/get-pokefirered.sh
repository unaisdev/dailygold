#!/usr/bin/env bash
# Recreates pokefirered/ from a clean checkout: fetches pret/pokefirered at the
# commit fijado y aplica los cambios de Daily Gold desde patches/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAME="$ROOT/pokefirered"
PATCH="$ROOT/patches/pokefirered-dailyred.patch"
PRET_URL="https://github.com/pret/pokefirered.git"
PRET_COMMIT="037335f4c725d7c9aecdac87066f2002b4bd7e14"

if [ -e "$GAME" ]; then
  echo "pokefirered/ already exists. Delete it first to start from a fresh copy."
  exit 1
fi

git init -q "$GAME"
git -C "$GAME" remote add origin "$PRET_URL"
git -C "$GAME" config core.autocrlf false
echo ">> Fetching pret/pokefirered @ ${PRET_COMMIT:0:10}"
git -C "$GAME" fetch -q --depth 1 origin "$PRET_COMMIT"
git -C "$GAME" checkout -q FETCH_HEAD
echo ">> Applying $(basename "$PATCH")"
NORMALIZED_PATCH="$(mktemp)"
trap 'rm -f "$NORMALIZED_PATCH"' EXIT
PYTHON="$(command -v python || command -v python3)"
"$PYTHON" "$ROOT/scripts/normalize-binary-patch.py" < "$PATCH" > "$NORMALIZED_PATCH"
git -C "$GAME" apply --binary --ignore-space-change --ignore-whitespace --whitespace=nowarn "$NORMALIZED_PATCH"
echo "Done. Build with: scripts/build-rom.sh"
