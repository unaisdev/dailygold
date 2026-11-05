#!/usr/bin/env bash
# Genera el body de un Release content-v* para GitHub.
# El launcher (hortelanos-daily) muestra solo la sección ## Novedades.
# Ver docs/RELEASE_NOTES.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:?usage: build-release-notes.sh <outfile> <tag> <ver> <source> <sha>}"
TAG="${2:?}"
VER="${3:?}"
SOURCE="${4:-manual}"
SHA="${5:-$(git -C "$ROOT" rev-parse HEAD)}"

MANIFEST="$ROOT/content/game.manifest.json"
MIN_LAUNCHER=$(python3 -c "import json; print(json.load(open('$MANIFEST'))['compat']['minLauncherVersion'])")
PROTOCOL=$(python3 -c "import json; print(json.load(open('$MANIFEST'))['protocolId'])")
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "unaisdev/dailygold")

PREV_TAG=$(
  git -C "$ROOT" tag -l 'content-v*' --sort=-version:refname \
    | grep -vxF "$TAG" \
    | head -n1 \
    || true
)

RANGE="HEAD"
if [[ -n "${PREV_TAG:-}" ]]; then
  RANGE="${PREV_TAG}..HEAD"
fi

NOVEDADES=$(
  git -C "$ROOT" log "$RANGE" --pretty=format:'%s' --no-merges 2>/dev/null \
    | python3 -c '
import re, sys

SKIP = re.compile(
    r"""(?ix)
    ^(chore|ci|docs|test|build|style|refactor)(\(.+\))?\s*:
    |^chore:\s*bump\s+contentversion
    |^merge\s+
    |^bump\s+contentversion
    """
)

seen = set()
bullets = []
for raw in sys.stdin:
    subj = raw.strip()
    if not subj or SKIP.search(subj):
        continue
    display = re.sub(r"(?i)^(feat|fix|perf|improv)(\(.+\))?\s*:\s*", "", subj).strip()
    if not display:
        continue
    display = display[0].upper() + display[1:]
    key = display.casefold()
    if key in seen:
        continue
    seen.add(key)
    bullets.append(f"- {display}")
    if len(bullets) >= 12:
        break

if not bullets:
    bullets = ["- Actualización del pack de Daily Gold."]

print("\n".join(bullets))
'
)

export OUT TAG VER MIN_LAUNCHER PROTOCOL SOURCE SHA REPO NOVEDADES
python3 - <<'PY'
from pathlib import Path
import os

path = Path(os.environ["OUT"])
path.write_text(
    f"""## Novedades

{os.environ["NOVEDADES"]}

## Instalación

Pack de contenido para Hortelano's Daily.
El modal Novedades del launcher lee solo la sección de arriba
(ver docs/RELEASE_NOTES.md).

- Tag: `{os.environ["TAG"]}`
- Asset: `dailygold-content.zip`
- Protocolo: `{os.environ["PROTOCOL"]}`
- minLauncherVersion: `{os.environ["MIN_LAUNCHER"]}`
- Origen: `{os.environ["SOURCE"]}`
- Commit: `{os.environ["SHA"]}`
- Repo: `{os.environ["REPO"]}` (releases/latest + SHA256SUMS)
"""
)
print(f"Wrote release notes → {path}")
PY
