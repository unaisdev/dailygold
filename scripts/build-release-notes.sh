#!/usr/bin/env bash
# Genera el body de un Release content-v* para GitHub.
# Solo ## Novedades, tono jugador. Fuente: content/NOVEDADES.md
# Ver docs/RELEASE_NOTES.md y AGENTS.md.
#
# Por defecto exige bullets en content/NOVEDADES.md (para que el agente los
# rellene antes del push). ALLOW_EMPTY_NOVEDADES=1 desactiva el fallo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:?usage: build-release-notes.sh <outfile> <tag> <ver> <source> <sha>}"
TAG="${2:?}"
: "${3:-}" "${4:-}" "${5:-}"
NOVEDADES_FILE="$ROOT/content/NOVEDADES.md"
ALLOW_EMPTY="${ALLOW_EMPTY_NOVEDADES:-0}"

export NOVEDADES_FILE ALLOW_EMPTY
NOVEDADES=$(
  python3 -c '
import os, re, sys
from pathlib import Path

MAX_BULLETS = 8
FALLBACK = "- Sin cambios que notes al jugar."

def bullets_from_novedades_file(path: Path) -> list[str]:
    if not path.is_file():
        return []
    raw = path.read_text(encoding="utf-8")
    raw = re.sub(r"<!--.*?-->", "", raw, flags=re.S)
    out = []
    seen = set()
    for line in raw.splitlines():
        s = line.strip()
        if not s.startswith("- "):
            continue
        text = s[2:].strip()
        if not text or text.startswith("…") or text.startswith("..."):
            continue
        text = re.sub(r"#+\s*", "", text).strip()
        text = re.sub(r"\s+", " ", text)
        if not text:
            continue
        key = text.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(f"- {text}")
        if len(out) >= MAX_BULLETS:
            break
    return out

path = Path(os.environ["NOVEDADES_FILE"])
bullets = bullets_from_novedades_file(path)
allow_empty = os.environ.get("ALLOW_EMPTY_NOVEDADES", "0") == "1"

if not bullets:
    if not allow_empty:
        print(
            """ERROR: faltan novedades de jugador en content/NOVEDADES.md

El agente debe, ANTES de pushear a main:
  1. Escribir bullets "- …" en castellano claro (lo que el jugador note).
  2. Sin tags, SHA, CI, zips ni jerga de desarrollo.
  3. Si no hay nada visible: "- Sin cambios que notes al jugar."

Ver AGENTS.md y docs/RELEASE_NOTES.md.""",
            file=sys.stderr,
        )
        sys.exit(1)
    bullets = [FALLBACK]
    source = "fallback"
else:
    source = "content/NOVEDADES.md"

print("\n".join(bullets))
print(f"novedades_source={source}", file=sys.stderr)
'
)

export OUT NOVEDADES
python3 - <<'PY'
from pathlib import Path
import os

path = Path(os.environ["OUT"])
path.write_text(
    f"""## Novedades

{os.environ["NOVEDADES"]}
""",
    encoding="utf-8",
)
print(f"Wrote release notes → {path}")
PY
