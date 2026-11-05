# Notas para agentes

## Releases de content pack (push a main)

**Público del body:** un usuario normal. Habla claro, sin jerga de desarrollo.
Nada de tags (`content-v*`), SHA, firmas, CI, nombres de zip técnicos ni docs internas.
Si no lo entendería tu abuela o un amigo que solo quiere jugar, no va en `## Novedades`.

1. **Antes del push:** bullets en `content/NOVEDADES.md` (`- …`, castellano, jugador).
2. El body publicado es solo `## Novedades` (sin sección técnica).
3. Contrato: [docs/RELEASE_NOTES.md](docs/RELEASE_NOTES.md).
4. Scripts: `build-release-notes.sh` + `clear-novedades.sh` (CI).
