# Notas de release (lo que ve el jugador)

El launcher [Hortelano's Daily](https://github.com/unaisdev/hortelanos-daily)
muestra el **body del GitHub Release** en el modal **Novedades**.

**Público:** un usuario normal. Habla claro, sin jerga de desarrollo.
Nada de tags (`content-v*`), SHA, firmas, CI, nombres de zip técnicos ni docs internas.
Si no lo entendería tu abuela o un amigo que solo quiere jugar, no va aquí.

Aplica a los Releases de content pack de este repo (Daily Gold). Contrato compartido
con el launcher (`docs/RELEASE_NOTES.md` en hortelanos-daily).

## Contrato (notesForDisplay)

1. Fuente = `release.body` → `notes`.
2. Preferid la sección `## Novedades`; cualquier sección debajo se ignora en la UI.
3. Castellano, solo cambios visibles para el jugador.
4. Sin Novedades útiles → el launcher muestra “Sin notas en este release”.

## Para agentes (antes de push a main)

1. Edita **`content/NOVEDADES.md`**: bullets `- …` en castellano para el jugador.
2. Push a `main`. El workflow publica el body con solo `## Novedades` y vacía esos bullets.
3. Lo técnico (checksums, assets, protocolo, CI) vive en `docs/` y en el zip — **nunca** en el body.

## Plantilla del body publicado

```text
## Novedades

- Arreglado: el combate del día se reiniciaba si cerrabas a medias.
- GOLD ya no usa el mismo equipo dos días seguidos en la misma racha.
```

### Qué sí poner

- Bugs que el jugador note (pantallas rotas, combates que fallan, menús).
- Controles o pantallas nuevas.
- Cambios de reglas o de comportamiento del juego.
- Cosas que “se sienten distintas” al abrir el cartucho.

### Qué no poner

- Refactors, rendimiento, CI, dependencias, detalles internos.
- Tags, SHA, nombres de zip, protocolo, `minLauncherVersion`, firmas.
- Enlaces a docs técnicas ni mensajes de commit en inglés.
