# Content packs en GitHub Releases

Daily Gold publica un zip de contenido para que
[Hortelano's Daily](https://github.com/unaisdev/hortelanos-daily) pueda
comprobar `/releases/latest` y actualizar el juego al vuelo.

## Convención (contrato con el launcher)

| Campo | Valor |
|-------|--------|
| Tag | `content-vX.Y.Z` (ej. `content-v0.1.0`) |
| Asset principal | `dailygold-content.zip` |
| Checksums | `SHA256SUMS` en el mismo Release |
| Dentro del zip | `game.manifest.json` en la **raíz**, más `rom/` y `assets/` |
| Body del Release | Solo `## Novedades` en castellano claro (sin jerga). Ver [RELEASE_NOTES.md](RELEASE_NOTES.md). |

Puntero en el catálogo del launcher:

```json
"content": {
  "repo": "unaisdev/dailygold",
  "asset": "dailygold-content.zip",
  "tagPrefix": "content-v"
}
```

El launcher:

1. Llama a `GET https://api.github.com/repos/unaisdev/dailygold/releases/latest`
2. Compara `tag_name` (sin el prefijo `content-v`) con la `contentVersion` local
3. Descarga `dailygold-content.zip` (o un asset cuyo nombre contenga `dailygold`)
4. Verifica SHA-256 con `SHA256SUMS` si está presente
5. Descomprime exigiendo `game.manifest.json` en la raíz y sustituye el pack en
   `games/dailygold/`

## Contenido del zip

```
game.manifest.json
rom/dailyred.gba.gz
assets/gold.png
assets/red-fallback.png
```

`content/game.manifest.json` guarda `contentVersion`, `protocolId` y
`compat.minLauncherVersion`. La ROM y los sprites se toman de `web/game/` al
empaquetar (no se duplican en Git dentro de `content/`).

## Releases automáticos en cada push a `main`

El workflow [`.github/workflows/release-content.yml`](../.github/workflows/release-content.yml)
se ejecuta en **cada push a `main`** y:

1. Lee el último Release `content-v*`
2. Sube el **patch** SemVer (`0.1.0` → `0.1.1` → `0.1.2` …)
3. Actualiza `content/game.manifest.json` y hace commit
   `chore: bump contentVersion to X.Y.Z` (con `GITHUB_TOKEN`, no re-dispara el workflow)
4. Empaqueta `dailygold-content.zip` + `SHA256SUMS`
5. Publica el Release `content-vX.Y.Z` (body solo con `## Novedades`) y lo marca
   como *latest*

Así el launcher siempre puede pedir `/releases/latest`, obtener el pack del
último `main` y mostrar las notas del body en el modal **Novedades**.

**Agentes:** en cada push a `main`, rellenad solos `content/NOVEDADES.md` (castellano,
jugador) antes de pushear. Sin bullets, CI falla. Ver [RELEASE_NOTES.md](RELEASE_NOTES.md)
y `AGENTS.md`.

También puedes:

- Lanzar el workflow a mano (`workflow_dispatch`) y opcionalmente fijar la versión
- Pushear un tag `content-v*` si quieres forzar una versión concreta

## Empaquetar en local

```sh
scripts/build-rom.sh          # si la ROM no está al día
scripts/package-content.sh    # → dist/content/dailygold-content.zip + SHA256SUMS
```

## Publicar a mano (opcional)

Normalmente **no hace falta**: un `git push origin main` ya publica Release.

```sh
# Forzar una versión concreta desde tu máquina:
scripts/release-content.sh 0.2.0
```

## Versionado

- SemVer: `MAJOR.MINOR.PATCH`
- Tag canónico = `content-v` + versión
- En `main`, el patch lo incrementa CI; usa `MAJOR`/`MINOR` a mano solo si
  rompes compatibilidad del pack o del protocolo (y sube
  `compat.minLauncherVersion` cuando corresponda)

## Orden si cambia el protocolo ROM

1. Adapter nuevo en el **launcher** + Release `v*` de Hortelano's Daily
2. Content pack con el nuevo `protocolId` y `compat.minLauncherVersion`
3. Nunca al revés: el menú del launcher bloqueará packs sin adapter

## Verificar

```sh
scripts/verify-content.sh
# Comprueba id, protocolId y que web/game/dailyred.gba.gz contiene DAILYRED-CONF-V2
```
