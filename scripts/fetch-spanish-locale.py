#!/usr/bin/env python3
"""Build locale/es/ overlays from Acimut pret_europe (Spanish Rojo Fuego).

Pinned source: Acimut/pokefirered @ EUROPE_COMMIT (rama pret_europe).
Resolves `#if GAME_LANGUAGE == …` as SPANISH and writes pret-pin-compatible
files for a single castellano ROM build.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "pret_europe"
OUT = ROOT / "locale" / "es"
EUROPE_COMMIT = "6651454608dcc61356b60c20154214d773689730"
EUROPE_URL = "https://github.com/Acimut/pokefirered.git"
TARGET_LANG = "SPANISH"

SPARSE = [
    "/charmap.txt",
    "/src/data/text/",
    "/src/data/items.json",
    "/src/move_descriptions.c",
    "/src/strings.c",
    "/src/battle_message.c",
]


def run(cmd: list[str], **kw) -> None:
    subprocess.check_call(cmd, **kw)


def ensure_cache() -> None:
    if (CACHE / "src/data/text/move_names.h").is_file():
        head = subprocess.check_output(
            ["git", "-C", str(CACHE), "rev-parse", "HEAD"], text=True
        ).strip()
        if head.startswith(EUROPE_COMMIT[:10]):
            return
    if CACHE.exists():
        shutil.rmtree(CACHE)
    CACHE.mkdir(parents=True)
    run(["git", "init", "-q", str(CACHE)])
    run(["git", "-C", str(CACHE), "remote", "add", "origin", EUROPE_URL])
    run(["git", "-C", str(CACHE), "config", "core.sparseCheckout", "true"])
    (CACHE / ".git/info/sparse-checkout").write_text("\n".join(SPARSE) + "\n")
    print(f">> Fetching pret_europe @ {EUROPE_COMMIT[:10]}")
    run(["git", "-C", str(CACHE), "fetch", "-q", "--depth", "1", "origin", EUROPE_COMMIT])
    run(["git", "-C", str(CACHE), "checkout", "-q", "FETCH_HEAD"])


def eval_game_language_expr(expr: str) -> bool | None:
    """Evaluate simple GAME_LANGUAGE comparisons. None = not a language guard."""
    expr = expr.strip()
    # Strip trailing comments
    expr = expr.split("//", 1)[0].strip()
    if "GAME_LANGUAGE" not in expr:
        return None
    # Normalize spaces
    expr = re.sub(r"\s+", " ", expr)

    # Only handle forms we see in pret_europe text files.
    m = re.fullmatch(r"GAME_LANGUAGE == LANGUAGE_(\w+)", expr)
    if m:
        return m.group(1) == TARGET_LANG

    m = re.fullmatch(r"GAME_LANGUAGE != LANGUAGE_(\w+)", expr)
    if m:
        return m.group(1) != TARGET_LANG

    # Rare compound forms — treat unknown as keep-both failure
    raise ValueError(f"unsupported GAME_LANGUAGE expression: {expr!r}")


def resolve_game_language(text: str) -> str:
    """Keep only branches active when GAME_LANGUAGE == LANGUAGE_SPANISH.

    Non-GAME_LANGUAGE #if blocks are left untouched (should not appear in these files).
    """
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    # Stack entries: dict with keys:
    #   kind: 'lang' | 'other'
    #   taking: bool — currently emitting
    #   taken: bool — a branch already taken (for lang)
    stack: list[dict] = []

    def emitting() -> bool:
        return all(frame["taking"] for frame in stack)

    i = 0
    while i < len(lines):
        raw = lines[i]
        stripped = raw.strip()

        if stripped.startswith("#if"):
            expr = stripped[3:].strip()
            if expr.startswith("def") or expr.startswith("ndef"):
                # #ifdef / #ifndef — treat as opaque "other" (keep)
                stack.append({"kind": "other", "taking": True, "taken": True})
                if emitting():
                    out.append(raw)
            else:
                # Drop the leading "if " already stripped via [3:]; expr is after #if
                # Actually stripped is "#if EXPR" — fix:
                expr = stripped[len("#if") :].strip()
                try:
                    val = eval_game_language_expr(expr)
                except ValueError:
                    # Unknown — keep as other
                    stack.append({"kind": "other", "taking": True, "taken": True})
                    if emitting():
                        out.append(raw)
                else:
                    if val is None:
                        stack.append({"kind": "other", "taking": True, "taken": True})
                        if emitting():
                            out.append(raw)
                    else:
                        parent_ok = emitting()
                        stack.append(
                            {
                                "kind": "lang",
                                "taking": parent_ok and val,
                                "taken": val,
                            }
                        )
                        # Do not emit the #if line itself
            i += 1
            continue

        if stripped.startswith("#elif"):
            if not stack:
                raise ValueError(f"#elif without #if at line {i + 1}")
            frame = stack[-1]
            expr = stripped[len("#elif") :].strip()
            if frame["kind"] != "lang":
                if emitting():
                    out.append(raw)
            else:
                parent_ok = all(f["taking"] for f in stack[:-1])
                try:
                    val = eval_game_language_expr(expr)
                except ValueError as e:
                    raise ValueError(f"line {i + 1}: {e}") from e
                if val is None:
                    raise ValueError(f"line {i + 1}: #elif without GAME_LANGUAGE")
                if frame["taken"]:
                    frame["taking"] = False
                else:
                    frame["taking"] = parent_ok and bool(val)
                    frame["taken"] = frame["taken"] or bool(val)
            i += 1
            continue

        if stripped.startswith("#else"):
            if not stack:
                raise ValueError(f"#else without #if at line {i + 1}")
            frame = stack[-1]
            if frame["kind"] != "lang":
                if emitting():
                    out.append(raw)
            else:
                parent_ok = all(f["taking"] for f in stack[:-1])
                frame["taking"] = parent_ok and not frame["taken"]
                frame["taken"] = True
            i += 1
            continue

        if stripped.startswith("#endif"):
            if not stack:
                raise ValueError(f"#endif without #if at line {i + 1}")
            frame = stack.pop()
            if frame["kind"] != "lang" and emitting():
                out.append(raw)
            # lang: drop #endif
            i += 1
            continue

        if emitting():
            out.append(raw)
        i += 1

    if stack:
        raise ValueError(f"unclosed preprocessor stack ({len(stack)} frames)")

    result = "".join(out)
    # Collapse excessive blank lines from removed blocks
    result = re.sub(r"\n{3,}", "\n\n", result)
    if not result.endswith("\n"):
        result += "\n"
    return result


def write_out(rel: str, content: str) -> None:
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"  wrote locale/es/{rel} ({len(content)} bytes)")


def resolve_file(rel: str) -> None:
    src = (CACHE / rel).read_text(encoding="utf-8")
    write_out(rel, resolve_game_language(src))


def build_strings() -> None:
    write_out(
        "src/strings.c",
        """#include "global.h"
#include "strings.h"

#include "data/text/strings_1_es.h"
#include "data/text/quest_log_es.h"
#include "data/text/strings_2_es.h"
#include "data/text/teachy_tv_es.h"
#include "data/text/strings_3_es.h"
""",
    )
    for name in (
        "strings_1_es.h",
        "strings_2_es.h",
        "strings_3_es.h",
        "quest_log_es.h",
        "teachy_tv_es.h",
        "battle_message_1_es.h",
        "battle_message_2_es.h",
    ):
        write_out(
            f"src/data/text/{name}",
            (CACHE / "src/data/text" / name).read_text(encoding="utf-8"),
        )


def build_battle_string_map() -> None:
    combined = ""
    for name in ("battle_message_1_es.h", "battle_message_2_es.h"):
        combined += (CACHE / "src/data/text" / name).read_text(encoding="utf-8")
    mapping: dict[str, str] = {}
    pat = re.compile(
        r"(?:static )?const u8 (\w+)\[\] = (_\((?:\"(?:\\.|[^\"\\])*\"\s*)+\));",
        re.S,
    )
    for m in pat.finditer(combined):
        mapping[m.group(1)] = m.group(2)
    path = OUT / "battle_strings_es.json"
    path.write_text(json.dumps(mapping, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    print(f"  wrote locale/es/battle_strings_es.json ({len(mapping)} strings)")


def build_items() -> None:
    data = json.loads((CACHE / "src/data/items.json").read_text(encoding="utf-8"))
    for item in data["items"]:
        if "spanish" in item:
            item["english"] = item["spanish"]
        if "description_spanish" in item:
            item["description_english"] = item["description_spanish"]
        for k in list(item.keys()):
            if k in (
                "spanish",
                "italian",
                "french",
                "german",
                "description_spanish",
                "description_italian",
                "description_french",
                "description_german",
            ):
                del item[k]
    write_out("src/data/items.json", json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def build_type_names() -> None:
    """Spanish type abbreviations used in battle move info (battle_main.c)."""
    write_out(
        "patches/type_names.h",
        """const u8 gTypeNames[NUMBER_OF_MON_TYPES][TYPE_NAME_LENGTH + 1] =
{
    [TYPE_NORMAL] = _("NORMAL"),
    [TYPE_FIGHTING] = _("LUCHA"),
    [TYPE_FLYING] = _("VOLAD."),
    [TYPE_POISON] = _("VENENO"),
    [TYPE_GROUND] = _("TIERRA"),
    [TYPE_ROCK] = _("ROCA"),
    [TYPE_BUG] = _("BICHO"),
    [TYPE_GHOST] = _("FANT."),
    [TYPE_STEEL] = _("ACERO"),
    [TYPE_MYSTERY] = _("(?)"),
    [TYPE_FIRE] = _("FUEGO"),
    [TYPE_WATER] = _("AGUA"),
    [TYPE_GRASS] = _("PLANTA"),
    [TYPE_ELECTRIC] = _("ELÉCT."),
    [TYPE_PSYCHIC] = _("PSÍQ."),
    [TYPE_ICE] = _("HIELO"),
    [TYPE_DRAGON] = _("DRAGÓN"),
    [TYPE_DARK] = _("SINIE."),
};
""",
    )


def write_manifest() -> None:
    meta = {
        "source": EUROPE_URL,
        "ref": "pret_europe",
        "commit": EUROPE_COMMIT,
        "language": "es-ES",
        "notes": (
            "Official Spanish (Spain) FireRed string tables. "
            "Daily Gold ships a single castellano ROM (no bilingual switch)."
        ),
    }
    write_out("SOURCE.json", json.dumps(meta, indent=2) + "\n")


def main() -> int:
    ensure_cache()
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    print(">> Extracting Spanish (es-ES) locale overlays")
    for rel in (
        "src/data/text/move_names.h",
        "src/data/text/nature_names.h",
        "src/data/text/species_names.h",
        "src/data/text/abilities.h",
        "src/data/text/trainer_class_names.h",
        "src/move_descriptions.c",
        "charmap.txt",
    ):
        resolve_file(rel)
    build_strings()
    build_battle_string_map()
    build_items()
    build_type_names()
    write_manifest()

    # Sanity checks
    mn = (OUT / "src/data/text/move_names.h").read_text(encoding="utf-8")
    assert "PLACAJE" in mn and "GAME_LANGUAGE" not in mn
    sp = (OUT / "src/data/text/species_names.h").read_text(encoding="utf-8")
    assert "GAME_LANGUAGE" not in sp
    assert "[SPECIES_BULBASAUR]" in sp
    ab = (OUT / "src/data/text/abilities.h").read_text(encoding="utf-8")
    assert "HEDOR" in ab and "GAME_LANGUAGE" not in ab
    nn = (OUT / "src/data/text/nature_names.h").read_text(encoding="utf-8")
    assert "FUERTE" in nn and "gNatureNamePointers" in nn
    print(f"Done → {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
