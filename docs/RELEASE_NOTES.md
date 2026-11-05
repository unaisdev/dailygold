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
- Sin límite duro de longitud (scroll), pero pocos bullets.

## Para agentes (antes de push a main)

1. Edita **`content/NOVEDADES.md`**: añade bullets `- …` en castellano (lo que el
   jugador debe ver). Solo esas líneas entran en el body.
2. Haz commit y `git push origin main`. El workflow:
   - Genera el body con `## Novedades` + `## Instalación`
   - Publica el Release `content-v*`
   - Vacía los bullets de `content/NOVEDADES.md` en el bump
3. No pongas en los bullets texto tipo `## Novedades`, nombres de scripts, CI ni
   mensajes de commit en inglés.

Si `content/NOVEDADES.md` no tiene bullets, el generador intenta commits filtrados
(sin `chore:`/`ci:`/ruido) y, si no hay nada usable, un fallback genérico.

## Plantilla del body publicado

```text
## Novedades

- Arreglado: el combate del día se reiniciaba si cerrabas a medias.
- GOLD ya no usa el mismo equipo dos días seguidos en la misma racha.

## Instalación

- Asset: `dailygold-content.zip`
- …
```

- **Sí** en Novedades: bugs visibles, pantallas/controles, reglas, sensación al jugar.
- **No** en Novedades: refactors, CI, dependencias, SHA, assets, bumps de versión.
