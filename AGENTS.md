# Notas para agentes

## Obligatorio: Novedades antes de push a main

Este repo **publica Release en cada push a `main`**. El compañero/agente de turno
debe rellenar las notas **automáticamente** al acabar el trabajo, sin esperar a
que se lo pidan.

### Checklist (hazlo tú)

1. Mira qué cambió en esta sesión que el **jugador** note.
2. Escribe bullets en `content/NOVEDADES.md` (solo líneas `- …`).
3. Commit de esos bullets junto al resto del trabajo (o justo antes del push).
4. Push a `main`.

**Público:** un usuario normal. Habla claro, sin jerga de desarrollo.
Nada de tags (`content-v*`), SHA, firmas, CI, nombres de zip técnicos ni docs internas.
Si no lo entendería tu abuela o un amigo que solo quiere jugar, no va aquí.

Ejemplos buenos:

```text
- Arreglado: el combate se reiniciaba si cerrabas a medias.
- GOLD pelea un poco distinto con Gyarados.
```

Si no hay nada visible al jugar:

```text
- Sin cambios que notes al jugar.
```

Sin bullets en `content/NOVEDADES.md`, el workflow de Release **falla a propósito**.
No copies mensajes de commit. Contrato: [docs/RELEASE_NOTES.md](docs/RELEASE_NOTES.md).
