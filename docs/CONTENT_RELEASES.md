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

`content/game.manifest.json` es la fuente de verdad de `contentVersion`,
`protocolId` y `compat.minLauncherVersion`. La ROM y los sprites se toman de
`web/game/` al empaquetar (no se duplican en Git dentro de `content/`).

## Empaquetar en local

```sh
scripts/build-rom.sh          # si la ROM no está al día
scripts/package-content.sh    # → dist/content/dailygold-content.zip + SHA256SUMS
```

## Publicar un Release

### Opción A — script (recomendado en local)

```sh
# Desde main, con la ROM construida y el manifest en la versión deseada:
scripts/release-content.sh          # usa contentVersion del manifest
# o
scripts/release-content.sh 0.1.1    # fuerza versión y actualiza el manifest
```

Esto crea el tag `content-v…` / Release con `dailygold-content.zip` + `SHA256SUMS`
y lo marca como *latest*.

### Opción B — tag + Actions

```sh
# 1. Sube a main el manifest con contentVersion nueva y la ROM si cambió
git push origin main

# 2. Crea el tag (dispara .github/workflows/release-content.yml)
git tag content-v0.1.1
git push origin content-v0.1.1
```

También puedes lanzar el workflow a mano (`workflow_dispatch`) desde la pestaña
Actions.

## Versionado

- SemVer: `MAJOR.MINOR.PATCH`
- Tag canónico = `content-v` + versión del manifest
- Sube `contentVersion` en `content/game.manifest.json` en el mismo commit que
  cambia ROM, protocolo o assets del pack

## Orden si cambia el protocolo ROM

1. Adapter nuevo en el **launcher** + Release `v*` de Hortelano's Daily
2. Content pack con el nuevo `protocolId` y `compat.minLauncherVersion`
3. Nunca al revés: el menú del launcher bloqueará packs sin adapter

## Verificar

```sh
scripts/verify-content.sh
# Comprueba id, protocolId y que web/game/dailyred.gba.gz contiene DAILYRED-CONF-V2
```
