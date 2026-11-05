#!/usr/bin/env bash
# Crea (o actualiza) un GitHub Release de content pack desde main.
# En condiciones normales NO hace falta: cada push a main ya publica un Release
# vía .github/workflows/release-content.yml (patch bump automático).
#
# Uso:
#   scripts/release-content.sh              # usa contentVersion del manifest
#   scripts/release-content.sh 0.2.0        # fuerza MAJOR/MINOR a mano
#
# Requisitos: gh autenticado, working tree limpio recomendado, ROM construida.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/content/game.manifest.json"
VER="${1:-}"
if [[ -z "$VER" ]]; then
  VER=$(python3 -c "import json; print(json.load(open('$MANIFEST'))['contentVersion'])")
fi
TAG="content-v${VER}"
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

# Keep manifest version in sync when an explicit version is passed.
python3 - "$MANIFEST" "$VER" <<'PY'
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
ver = sys.argv[2]
m = json.loads(path.read_text())
if m.get("contentVersion") != ver:
    m["contentVersion"] = ver
    path.write_text(json.dumps(m, indent=2) + "\n")
    print(f"Updated contentVersion → {ver}")
else:
    print(f"contentVersion already {ver}")
PY

"$ROOT/scripts/package-content.sh"

NOTES_FILE=$(mktemp)
trap 'rm -f "$NOTES_FILE"' EXIT
SHA=$(git -C "$ROOT" rev-parse HEAD)
chmod +x "$ROOT/scripts/build-release-notes.sh" "$ROOT/scripts/clear-novedades.sh"
# Solo ## Novedades (tono jugador) desde content/NOVEDADES.md. Ver docs/RELEASE_NOTES.md.
"$ROOT/scripts/build-release-notes.sh" "$NOTES_FILE" "$TAG" "$VER" "manual" "$SHA"
"$ROOT/scripts/clear-novedades.sh"

OUT="$ROOT/dist/content"
ASSETS=(
  "$OUT/dailygold-content.zip"
  "$OUT/SHA256SUMS"
)

if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  echo "Release ${TAG} already exists - uploading/replacing assets..."
  gh release upload "$TAG" "${ASSETS[@]}" --repo "$REPO" --clobber
  gh release edit "$TAG" --repo "$REPO" --notes-file "$NOTES_FILE" --latest
else
  echo "Creating release ${TAG}..."
  gh release create "$TAG" "${ASSETS[@]}" \
    --repo "$REPO" \
    --target main \
    --title "Daily Gold content ${VER}" \
    --notes-file "$NOTES_FILE" \
    --latest
fi

echo "Done: https://github.com/${REPO}/releases/tag/${TAG}"
