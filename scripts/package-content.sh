#!/usr/bin/env bash
# Empaqueta el content pack para Hortelano's Daily / GitHub Releases.
#
# Salida (dist/content/):
#   dailygold-content.zip              ← nombre que espera el catálogo del launcher
#   dailygold-content-vX.Y.Z.zip       ← copia versionada (opcional, útil en CI)
#   SHA256SUMS                         ← checksums (nombres de asset de Release)
#
# Uso: scripts/package-content.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/content/game.manifest.json"
ROM_SRC="$ROOT/web/game/dailyred.gba.gz"
GOLD_SRC="$ROOT/web/game/gold.png"
RED_SRC="$ROOT/web/game/red.png"
OUT_DIR="$ROOT/dist/content"
STAGING="$OUT_DIR/staging"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Missing $MANIFEST" >&2
  exit 1
fi
if [[ ! -f "$ROM_SRC" ]]; then
  echo "Missing ROM $ROM_SRC — run scripts/build-rom.sh first." >&2
  exit 1
fi
if [[ ! -f "$GOLD_SRC" || ! -f "$RED_SRC" ]]; then
  echo "Missing title sprites under web/game/ — run scripts/build-rom.sh first." >&2
  exit 1
fi

"$ROOT/scripts/verify-content.sh"

ID=$(python3 -c "import json; print(json.load(open('$MANIFEST'))['id'])")
VER=$(python3 -c "import json; print(json.load(open('$MANIFEST'))['contentVersion'])")

rm -rf "$STAGING"
mkdir -p "$STAGING/rom" "$STAGING/assets"
cp "$MANIFEST" "$STAGING/game.manifest.json"
cp "$ROM_SRC" "$STAGING/rom/dailyred.gba.gz"
cp "$GOLD_SRC" "$STAGING/assets/gold.png"
cp "$RED_SRC" "$STAGING/assets/red-fallback.png"

# Re-verify against staging copy
python3 - "$STAGING/rom/dailyred.gba.gz" <<'PY'
import gzip, sys
from pathlib import Path
raw = Path(sys.argv[1]).read_bytes()
if raw[:2] == b'\x1f\x8b':
    raw = gzip.decompress(raw)
assert b'DAILYRED-CONF-V2' in raw, 'config magic missing in staged ROM'
print('OK staged ROM')
PY

UPLOAD_ZIP="$OUT_DIR/${ID}-content.zip"
VERSIONED_ZIP="$OUT_DIR/${ID}-content-v${VER}.zip"
rm -f "$UPLOAD_ZIP" "$VERSIONED_ZIP" "$OUT_DIR/SHA256SUMS" "$OUT_DIR/SHA256SUMS-${ID}.txt"

( cd "$STAGING" && zip -r "$UPLOAD_ZIP" . -x '*.DS_Store' )
cp "$UPLOAD_ZIP" "$VERSIONED_ZIP"

(
  cd "$OUT_DIR"
  shasum -a 256 "$(basename "$UPLOAD_ZIP")" "$(basename "$VERSIONED_ZIP")" > SHA256SUMS
  # Alias that hortelanos docs also mention
  cp SHA256SUMS "SHA256SUMS-${ID}.txt"
)

echo "Wrote $UPLOAD_ZIP"
echo "Wrote $VERSIONED_ZIP"
echo "Wrote $OUT_DIR/SHA256SUMS"
cat "$OUT_DIR/SHA256SUMS"
