#!/usr/bin/env python3
"""Rewrite English nickname+prefix order to European (name then " enemigo").

English FireRed builds "Foe CHARIZARD". Spanish Rojo Fuego builds
"CHARIZARD enemigo". Our locale overlays Spanish strings onto English code,
so without this patch the prefix glues to the nickname.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

EN_MACRO = r"""#define HANDLE_NICKNAME_STRING_CASE(battlerId, monIndex)                \
    if (GetBattlerSide(battlerId) != B_SIDE_PLAYER)                     \
    {                                                                   \
        if (gBattleTypeFlags & BATTLE_TYPE_TRAINER)                     \
            toCpy = sText_FoePkmnPrefix;                                \
        else                                                            \
            toCpy = sText_WildPkmnPrefix;                               \
        while (*toCpy != EOS)                                           \
        {                                                               \
            dst[dstId] = *toCpy;                                        \
            dstId++;                                                    \
            toCpy++;                                                    \
        }                                                               \
        GetMonData(&gEnemyParty[monIndex], MON_DATA_NICKNAME, text);    \
    }                                                                   \
    else                                                                \
    {                                                                   \
        GetMonData(&gPlayerParty[monIndex], MON_DATA_NICKNAME, text);   \
    }                                                                   \
    StringGet_Nickname(text);                                           \
    toCpy = text;"""

# Already-applied EU macro (idempotent re-runs).
EU_MACRO = r"""#define HANDLE_NICKNAME_STRING_CASE(battlerId, monIndex)                \
    if (GetBattlerSide(battlerId) != B_SIDE_PLAYER)                     \
    {                                                                   \
        GetMonData(&gEnemyParty[monIndex], MON_DATA_NICKNAME, text);    \
        StringGet_Nickname(text);                                       \
        toCpy = text;                                                   \
        while (*toCpy != EOS)                                           \
        {                                                               \
            dst[dstId] = *toCpy;                                        \
            dstId++;                                                    \
            toCpy++;                                                    \
        }                                                               \
        if (gBattleTypeFlags & BATTLE_TYPE_TRAINER)                     \
            toCpy = sText_FoePkmnPrefix;                                \
        else                                                            \
            toCpy = sText_WildPkmnPrefix;                               \
    }                                                                   \
    else                                                                \
    {                                                                   \
        GetMonData(&gPlayerParty[monIndex], MON_DATA_NICKNAME, text);   \
        StringGet_Nickname(text);                                       \
        toCpy = text;                                                   \
    }"""

EN_BUFF = r"""        case B_BUFF_MON_NICK_WITH_PREFIX: // poke nick with prefix
            if (GetBattlerSide(src[srcId + 1]) == B_SIDE_PLAYER)
            {
                GetMonData(&gPlayerParty[src[srcId + 2]], MON_DATA_NICKNAME, text);
            }
            else
            {
                if (gBattleTypeFlags & BATTLE_TYPE_TRAINER)
                    StringAppend(dst, sText_FoePkmnPrefix);
                else
                    StringAppend(dst, sText_WildPkmnPrefix);

                GetMonData(&gEnemyParty[src[srcId + 2]], MON_DATA_NICKNAME, text);
            }
            StringGet_Nickname(text);
            StringAppend(dst, text);
            srcId += 3;
            break;"""

EU_BUFF = r"""        case B_BUFF_MON_NICK_WITH_PREFIX: // poke nick with prefix (ES: name then " enemigo")
            if (GetBattlerSide(src[srcId + 1]) == B_SIDE_PLAYER)
            {
                GetMonData(&gPlayerParty[src[srcId + 2]], MON_DATA_NICKNAME, text);
                StringGet_Nickname(text);
                StringAppend(dst, text);
            }
            else
            {
                GetMonData(&gEnemyParty[src[srcId + 2]], MON_DATA_NICKNAME, text);
                StringGet_Nickname(text);
                StringAppend(dst, text);
                if (gBattleTypeFlags & BATTLE_TYPE_TRAINER)
                    StringAppend(dst, sText_FoePkmnPrefix);
                else
                    StringAppend(dst, sText_WildPkmnPrefix);
            }
            srcId += 3;
            break;"""


def normalize_ws(s: str) -> str:
    # Collapse runs of spaces on continuation lines for resilient matching.
    return re.sub(r"[ \t]+\\", r" \\", s)


def replace_exact(text: str, old: str, new: str, label: str) -> tuple[str, bool]:
    if new in text and old not in text:
        return text, False  # already applied
    if old not in text:
        # Try a whitespace-flexible match for the macro (tabs/spaces drift).
        pattern = re.escape(old)
        pattern = pattern.replace(r"\ ", r"[ \t]+")
        m = re.search(pattern, text)
        if not m:
            raise SystemExit(f"could not find {label} block to patch")
        text = text[: m.start()] + new + text[m.end() :]
        return text, True
    return text.replace(old, new, 1), True


def main() -> int:
    path = Path(sys.argv[1])
    text = path.read_text(encoding="utf-8")
    changed = []

    text, did = replace_exact(text, EN_MACRO, EU_MACRO, "HANDLE_NICKNAME_STRING_CASE")
    if did:
        changed.append("HANDLE_NICKNAME_STRING_CASE → EU order")

    text, did = replace_exact(text, EN_BUFF, EU_BUFF, "B_BUFF_MON_NICK_WITH_PREFIX")
    if did:
        changed.append("B_BUFF_MON_NICK_WITH_PREFIX → EU order")
    elif EU_BUFF in text or "ES: name then" in text:
        pass  # already applied
    else:
        # Flexible fallback for buff block
        pat = re.compile(
            r"case B_BUFF_MON_NICK_WITH_PREFIX:.*?srcId \+= 3;\n\s*break;",
            re.S,
        )
        m = pat.search(text)
        if not m:
            raise SystemExit("could not find B_BUFF_MON_NICK_WITH_PREFIX block")
        if "ES: name then" not in m.group(0):
            text = text[: m.start()] + EU_BUFF + text[m.end() :]
            changed.append("B_BUFF_MON_NICK_WITH_PREFIX → EU order (flex)")

    path.write_text(text, encoding="utf-8")
    if changed:
        for c in changed:
            print(f"  battle_message.c: {c}")
    else:
        print("  battle_message.c: EU nick order already applied")
    return 0


if __name__ == "__main__":
    sys.exit(main())
