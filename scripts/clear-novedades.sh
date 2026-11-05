#!/usr/bin/env bash
# Vacía los bullets de content/NOVEDADES.md tras haber generado el body del Release.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$ROOT/content/NOVEDADES.md"
cat > "$FILE" <<'EOF'
# Novedades pendientes (jugador)

Bullets en castellano para el próximo release.
Solo líneas que empiecen por `- ` entran en el modal Novedades del launcher.
Tras publicar, el workflow vacía los bullets de este archivo.

Habla claro, sin jerga. Nada de tags, SHA, CI ni nombres técnicos.
Si no lo entendería alguien que solo quiere jugar, no lo pongas.

<!-- Ejemplo:
- Arreglado: el combate del día se reiniciaba si cerrabas a medias.
- GOLD ya no usa el mismo equipo dos días seguidos.
-->
EOF
echo "Cleared bullets in content/NOVEDADES.md"
