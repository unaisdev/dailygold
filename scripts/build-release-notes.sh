#!/usr/bin/env bash
# Genera el body de un Release content-v* para GitHub.
# Solo ## Novedades, tono jugador (sin jerga). Ver docs/RELEASE_NOTES.md.
# Preferencia: bullets de content/NOVEDADES.md; si no hay, commits filtrados.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:?usage: build-release-notes.sh <outfile> <tag> <ver> <source> <sha>}"
TAG="${2:?}"
# ver/source/sha se aceptan por compatibilidad con el workflow; el body no los incluye.
: "${3:-}" "${4:-}" "${5:-}"
NOVEDADES_FILE="$ROOT/content/NOVEDADES.md"

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

export NOVEDADES_FILE
NOVEDADES=$(
  git -C "$ROOT" log "$RANGE" --pretty=format:'%s' --no-merges 2>/dev/null \
    | python3 -c '
import os, re, sys
from pathlib import Path

FALLBACK = "- Pequeños ajustes en Daily Gold."
MAX_BULLETS = 8

SKIP = re.compile(
    r"""(?ix)
    ^(chore|ci|docs|test|build|style|refactor)(\(.+\))?\s*:
    |^bump\s+contentversion
    |^merge\s+
    |release\s*notes
    |build-release-notes
    |novedades(\s+body|\s+pendientes)?
    |\bagents\.md\b
    |content/novedades
    |workflow
    |github\s*actions
    |auto-?publish
    |content\s*pack\s*release
    |content-v\d
    |sha256
    |minlauncher
    |package-content
    |verify-content
    """
)

NOISE = re.compile(
    r"""(?ix)
    ##\s*
    |^\s*#+\s*
    |\[skip\s*ci\]
    """
)

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

def bullets_from_commits(subjects: list[str]) -> list[str]:
    out = []
    seen = set()
    for subj in subjects:
        subj = subj.strip()
        if not subj or SKIP.search(subj) or NOISE.search(subj):
            continue
        display = re.sub(r"(?i)^(feat|fix|perf|improv)(\(.+\))?\s*:\s*", "", subj).strip()
        display = re.sub(r"#+\s*", "", display).strip()
        display = re.sub(r"\s+", " ", display)
        if not display or len(display) < 8:
            continue
        if re.search(r"(?i)\b(release|workflow|readme|script|repo|ci)\b", display) and not re.search(
            r"(?i)\b(gold|combate|equipo|men[uú]|batalla|jugador|pantalla)\b", display
        ):
            continue
        display = display[0].upper() + display[1:]
        key = display.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(f"- {display}")
        if len(out) >= MAX_BULLETS:
            break
    return out

path = Path(os.environ["NOVEDADES_FILE"])
bullets = bullets_from_novedades_file(path)
source = "content/NOVEDADES.md"
if not bullets:
    bullets = bullets_from_commits(sys.stdin.read().splitlines())
    source = "commits"
if not bullets:
    bullets = [FALLBACK]
    source = "fallback"

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
