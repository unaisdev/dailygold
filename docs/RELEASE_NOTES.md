# Notas de release (lo que ve el jugador)

El launcher [Hortelano's Daily](https://github.com/unaisdev/hortelanos-daily)
muestra el **body del GitHub Release** (`release.body` → campo `notes`) en el
modal **Novedades**. Escríbelo en **castellano**, pensado para quien juega — no
para quien desarrolla.

Aplica a los Releases `content-v*` de este repo (Daily Gold). Contrato compartido
con el launcher (`docs/RELEASE_NOTES.md` en hortelanos-daily).

## Contrato (notesForDisplay)

1. Fuente = `release.body` → `notes`.
2. Preferid la sección `## Novedades`; el resto (Instalación/técnico) se ignora en la UI.
3. Castellano, solo cambios visibles para el jugador.
4. Sin Novedades útiles → el launcher muestra “Sin notas en este release”.

Matices:

- Corte estricto: solo el bloque tras `## Novedades` hasta el siguiente `## …`.
- Markdown mínimo en Novedades: bullets `-` / `*` y `**negrita**`. Evitad tablas,
  links `[…](…)`, checklists y listas numeradas (se ven crudas).
- Sin límite duro de longitud (scroll), pero pocos bullets. Al generar desde
  commits, filtrar `chore:` / `ci:` / refactors / ruido interno.

## Para agentes (obligatorio al commit/push a main / publicar content-v*)

El workflow de push a `main` y `scripts/release-content.sh` generan el body con
`scripts/build-release-notes.sh`. No quitéis `## Novedades` ni mezcléis metadatos
técnicos ahí. Revisad/reescribid bullets si salen crudos desde commits.

## Plantilla

```text
## Novedades

- Arreglado: el combate del día se reiniciaba si cerrabas a medias.
- GOLD ya no usa el mismo equipo dos días seguidos en la misma racha.

## Instalación

- Asset: `dailygold-content.zip`
- Checksums: `SHA256SUMS`
- …
```

- **Sí** en Novedades: bugs visibles, pantallas/controles, reglas, sensación al jugar.
- **No** en Novedades: refactors, CI, dependencias, SHA, nombres de assets, bumps de
  `contentVersion`, mensajes `chore:` / `ci:` / `docs:` / `test:`.
