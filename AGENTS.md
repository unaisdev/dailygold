# Notas para agentes

## Releases `content-v*` (push a main / publicar)

Al commit/push a `main` o al publicar un Release de content pack:

1. El body **debe** tener `## Novedades` en castellano (cambios que el jugador note).
   Hortelano's Daily lo pinta en el modal **Novedades** (`release.body` → `notes`).
2. Metadatos técnicos van en `## Instalación` **debajo**, nunca dentro de Novedades.
3. Contrato y plantilla: [docs/RELEASE_NOTES.md](docs/RELEASE_NOTES.md).
4. Generación automática: `scripts/build-release-notes.sh` (workflow +
   `scripts/release-content.sh`). Filtra chore/ci/refactors; revisa bullets crudos.
