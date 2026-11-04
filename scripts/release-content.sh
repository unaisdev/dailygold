#!/usr/bin/env bash
# Crea (o actualiza) un GitHub Release de content pack desde main.
#
# Uso:
#   scripts/release-content.sh              # usa contentVersion del manifest
#   scripts/release-content.sh 0.1.0        # fuerza la versión
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
MIN_LAUNCHER=$(python3 -c "import json; print(json.load(open('$MANIFEST'))['compat']['minLauncherVersion'])")

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
python3 - "$NOTES_FILE" "$TAG" "$REPO" "$MIN_LAUNCHER" <<'PY'
from pathlib import Path
import sys
notes_path, tag, repo, min_launcher = sys.argv[1:5]
notes_path = Path(notes_path)
notes_path.write_text(
    f"""## Daily Gold content `{tag}`

Pack para [Hortelano's Daily](https://github.com/unaisdev/hortelanos-daily).

| Campo | Valor |
|-------|--------|
| Asset | `dailygold-content.zip` |
| Protocolo | `dailyred-conf-v2+status-v1` |
| minLauncherVersion | `{min_launcher}` |

El launcher consulta `GET /repos/{repo}/releases/latest`, descarga
`dailygold-content.zip` y verifica el SHA-256 de `SHA256SUMS`.
"""
)
PY

OUT="$ROOT/dist/content"
ASSETS=(
  "$OUT/dailygold-content.zip"
  "$OUT/SHA256SUMS"
)

if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  echo "Release ${TAG} already exists - uploading/replacing assets..."
  gh release upload "$TAG" "${ASSETS[@]}" --repo "$REPO" --clobber
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
