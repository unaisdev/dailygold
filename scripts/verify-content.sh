#!/usr/bin/env bash
# Verifica el content pack de Daily Gold (manifest + ROM + magics).
# Uso: scripts/verify-content.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/content/game.manifest.json"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Missing manifest: $MANIFEST" >&2
  exit 1
fi

python3 - "$MANIFEST" "$ROOT" <<'PY'
import gzip, json, sys
from pathlib import Path

manifest_path = Path(sys.argv[1])
root = Path(sys.argv[2])
m = json.loads(manifest_path.read_text())

required = ["id", "name", "contentVersion", "protocolId", "rom", "compat"]
missing = [k for k in required if k not in m]
if missing:
    raise SystemExit(f"manifest missing keys: {missing}")

if m["id"] != "dailygold":
    raise SystemExit(f'expected id "dailygold", got {m["id"]!r}')

rom_rel = m["rom"]["path"]
magic = m["rom"]["configMagic"].encode()
status_magic = m["rom"].get("statusMagic", "").encode()
# Staging layout used by package-content.sh
candidates = [
    root / "dist" / "content" / "staging" / rom_rel,
    root / "web" / "game" / Path(rom_rel).name,
]
rom = next((p for p in candidates if p.is_file()), None)
if rom is None:
    raise SystemExit(f"ROM not found (looked for {Path(rom_rel).name} under web/game/)")

raw = rom.read_bytes()
if raw[:2] == b"\x1f\x8b":
    raw = gzip.decompress(raw)
if magic not in raw:
    raise SystemExit(f"config magic {magic!r} not found in {rom}")
print(f"OK id={m['id']} version={m['contentVersion']} protocol={m['protocolId']}")
print(f"OK config magic {magic.decode()} in {rom.relative_to(root)}")
if status_magic and status_magic not in raw:
    # Status magic lives in RAM at runtime; ROM may still embed the string.
    print(f"NOTE status magic {status_magic.decode()} not embedded in ROM (expected for RAM-only markers)")
else:
    if status_magic:
        print(f"OK status magic string present in ROM blob")

# Archive symbols: must exist, be EWRAM addresses and belong to this exact ROM
# (the launcher reads the generated team from these RAM addresses).
import hashlib
sym_rel = m.get("archive", {}).get("symbols")
if not sym_rel:
    raise SystemExit('manifest missing "archive": {"symbols": ...}')
sym_candidates = [
    root / "dist" / "content" / "staging" / sym_rel,
    root / "web" / "game" / Path(sym_rel).name,
]
sym_path = next((p for p in sym_candidates if p.is_file()), None)
if sym_path is None:
    raise SystemExit(f"{Path(sym_rel).name} not found under web/game/ (run scripts/gen-archive-assets.mjs)")
syms = json.loads(sym_path.read_text())
for name in ("gPlayerParty", "gPlayerPartyCount"):
    addr = syms.get(name)
    if not isinstance(addr, int) or not 0x02000000 <= addr < 0x02040000:
        raise SystemExit(f"{sym_path.name}: bad {name}={addr!r}")
if syms.get("romSha256") != hashlib.sha256(raw).hexdigest():
    raise SystemExit(f"{sym_path.name} was generated from a different ROM; rerun scripts/gen-archive-assets.mjs")
print(f"OK archive symbols match the ROM (gPlayerParty=0x{syms['gPlayerParty']:x})")
print(f"OK minLauncherVersion={m['compat']['minLauncherVersion']}")
PY
