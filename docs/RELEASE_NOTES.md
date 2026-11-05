# Notas de release (lo que ve el jugador)

El launcher [Hortelano's Daily](https://github.com/unaisdev/hortelanos-daily)
muestra el **body del GitHub Release** en el modal **Novedades**.

**Público:** un usuario normal. Habla claro, sin jerga de desarrollo.
Nada de tags (`content-v*`), SHA, firmas, CI, nombres de zip técnicos ni docs internas.
Si no lo entendería tu abuela o un amigo que solo quiere jugar, no va aquí.

## Quién las escribe

Quien pushea a `main` (casi siempre un **agente**): **antes del push** rellena
`content/NOVEDADES.md` con bullets `- …` según lo que ha cambiado en esa sesión.
No hace falta que un humano se lo pida. Sin bullets, el Release de CI **falla**.

Tras publicar, CI vacía esos bullets para el siguiente ciclo.

## Contrato (notesForDisplay)

1. Fuente = `release.body` → `notes`.
2. Preferid la sección `## Novedades`; cualquier sección debajo se ignora en la UI.
3. Castellano, solo cambios visibles para el jugador.
4. Sin Novedades útiles → el launcher muestra “Sin notas en este release”.

## Plantilla del body publicado

```text
## Novedades

- Arreglado: el combate del día se reiniciaba si cerrabas a medias.
- GOLD ya no usa el mismo equipo dos días seguidos en la misma racha.
```

### Qué sí / qué no

- **Sí:** bugs visibles, pantallas/controles, reglas, sensación al jugar.
- **No:** refactors, CI, SHA, tags, zips, protocolo, mensajes de commit.
- Sin cambios visibles: `- Sin cambios que notes al jugar.`
