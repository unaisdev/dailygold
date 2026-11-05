#!/usr/bin/env bash
# Vacía los bullets de content/NOVEDADES.md tras haber generado el body del Release.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$ROOT/content/NOVEDADES.md"
cat > "$FILE" <<'EOF'
# Novedades pendientes (jugador)

Bullets en **castellano** para el próximo Release `content-v*`.
Solo líneas que empiecen por `- ` entran en el body (sección `## Novedades`).
Tras publicar, el workflow vacía los bullets de este archivo.

<!-- Ejemplo (descomenta / escribe bullets reales):
- Arreglado: el combate del día se reiniciaba si cerrabas a medias.
- GOLD ya no usa el mismo equipo dos días seguidos.
-->
EOF
echo "Cleared bullets in content/NOVEDADES.md"
