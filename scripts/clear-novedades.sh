#!/usr/bin/env bash
# Vacía los bullets de content/NOVEDADES.md tras haber generado el body del Release.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$ROOT/content/NOVEDADES.md"
cat > "$FILE" <<'EOF'
# Novedades pendientes (jugador)

El agente de turno debe rellenar bullets ANTES de pushear a main.
Solo líneas `- …` entran en el modal Novedades. CI falla si van vacíos.
Tras publicar, este archivo se vacía otra vez.

**Público:** castellano claro, sin jerga. Nada de tags, SHA, CI ni nombres técnicos.
Si no lo entendería alguien que solo quiere jugar, no lo pongas.

<!-- Ejemplo:
- Arreglado: el combate del día se reiniciaba si cerrabas a medias.
- GOLD ya no usa el mismo equipo dos días seguidos.
-->
EOF
echo "Cleared bullets in content/NOVEDADES.md"
