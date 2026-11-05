# Notas para agentes

## Releases `content-v*` (push a main / publicar)

1. **Antes del push:** escribe en `content/NOVEDADES.md` bullets `- …` en castellano
   (solo lo que el jugador note). Ese archivo es la fuente de `## Novedades`.
2. No uses mensajes de commit como notas: el modal del launcher mostraría ruido
   (p. ej. “Add player-facing ## Novedades…”).
3. Metadatos técnicos van en `## Instalación` (los genera el script).
4. Contrato: [docs/RELEASE_NOTES.md](docs/RELEASE_NOTES.md).
5. Scripts: `build-release-notes.sh` (body) + `clear-novedades.sh` (vacía bullets tras capturarlos en CI).
