#!/usr/bin/env bash
# Overlay locale/es onto pokefirered/ (single castellano ROM).
# Run after scripts/get-pokefirered.sh (or on an existing tree).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAME="$ROOT/pokefirered"
LOCALE="$ROOT/locale/es"

if [[ ! -d "$GAME/src" ]]; then
  echo "Missing $GAME — run scripts/get-pokefirered.sh first." >&2
  exit 1
fi
if [[ ! -f "$LOCALE/SOURCE.json" ]]; then
  echo "Missing $LOCALE — run scripts/fetch-spanish-locale.py first." >&2
  exit 1
fi

echo ">> Applying Spanish (es-ES) locale overlays"
while IFS= read -r -d '' src; do
  rel="${src#"$LOCALE/"}"
  case "$rel" in
    SOURCE.json|battle_strings_es.json|patches/*) continue ;;
  esac
  dest="$GAME/$rel"
  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
  echo "  $rel"
done < <(find "$LOCALE" -type f -print0)

# Replace type names in battle_main.c (not a full-file overlay).
if [[ -f "$LOCALE/patches/type_names.h" ]]; then
  python3 - "$GAME/src/battle_main.c" "$LOCALE/patches/type_names.h" <<'PY'
import re, sys
from pathlib import Path
path = Path(sys.argv[1])
replacement = Path(sys.argv[2]).read_text(encoding="utf-8").rstrip() + "\n"
text = path.read_text(encoding="utf-8")
pat = re.compile(
    r"const u8 gTypeNames\[NUMBER_OF_MON_TYPES\]\[TYPE_NAME_LENGTH \+ 1\]\s*=\s*\{.*?\n\};",
    re.S,
)
new, n = pat.subn(replacement.rstrip() + "\n", text, count=1)
if n != 1:
    raise SystemExit(f"gTypeNames replace failed (matches={n})")
path.write_text(new, encoding="utf-8")
print("  battle_main.c: gTypeNames → ES")
PY
fi

python3 - "$GAME/src/battle_message.c" "$LOCALE/battle_strings_es.json" <<'PY'
import json, re, sys
from pathlib import Path

path = Path(sys.argv[1])
mapping = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
text = path.read_text(encoding="utf-8")

pat = re.compile(
    r"((?:static )?const u8 )(\w+)(\[\] = )(_\((?:\"(?:\\.|[^\"\\])*\"\s*)+\);)",
    re.S,
)

replaced = 0

def repl(m: re.Match) -> str:
    global replaced
    name = m.group(2)
    if name in mapping:
        replaced += 1
        return f"{m.group(1)}{name}{m.group(3)}{mapping[name]};"
    return m.group(0)

text2 = pat.sub(repl, text)

daily_es = {
    "sText_DailyGoldWantsToBattle": '_("GOLD de la ELITE FOUR\\nde CAMPEONES quiere combatir\\p")',
    "sText_DailyGoldSentOutPkmn": '_("¡GOLD de la ELITE FOUR de CAMPEONES\\nenvió a {B_OPPONENT_MON1_NAME}!{PAUSE 60}")',
    "sText_DailyGoldSentOutPkmn2": '_("¡GOLD de la ELITE FOUR de CAMPEONES\\nenvió a {B_BUFF1}!")',
}
for name, lit in daily_es.items():
    def make_repl(literal: str):
        def _repl(m: re.Match) -> str:
            return m.group(1) + literal + ";"
        return _repl

    text2, n = re.subn(
        rf"((?:static )?const u8 {name}\[\] = )(_\((?:\"(?:\\.|[^\"\\])*\"\s*)+\);)",
        make_repl(lit),
        text2,
        count=1,
        flags=re.S,
    )
    if n:
        replaced += n

path.write_text(text2, encoding="utf-8")
print(f"  battle_message.c: replaced {replaced} string literals")
PY

# European FireRed puts the nickname before " enemigo"/" salvaje"; English
# puts the prefix first. Without this, Spanish prefixes glue to the name.
python3 "$LOCALE/patches/battle_message_eu_nick_order.py" "$GAME/src/battle_message.c"

echo "Done. Locale es-ES applied to pokefirered/"
