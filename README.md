# Daily Gold

> **Aviso:** Daily Gold se basa en y se construye sobre el repositorio de
> [DailyRed](https://github.com/amoi-builds/dailyred).

Una batalla diaria de Pokémon en el navegador, al estilo de Wordle. Cada día
recibes el mismo equipo aleatorio de seis Pokémon de nivel 100 y te enfrentas a
ORO (Ethan). Puedes jugar una vez al día. Las victorias, derrotas y rachas se
guardan en tu navegador.

Los combates usan el motor original de Pokémon FireRed: una versión modificada
de la decompilación [pret/pokefirered](https://github.com/pret/pokefirered),
compilada como ROM de GBA y ejecutada en el navegador con el emulador mGBA para
WebAssembly. Los combates se ejecutan dentro del juego; no se simulan en
JavaScript.

- [Inicio rápido en macOS](#inicio-rápido-en-macos)
- [Cómo funciona](#cómo-funciona)
- [Generación de equipos](#generación-de-equipos)
- [Equipo de ORO](#equipo-de-oro)
- [Desarrollo](#desarrollo)
- [Pruebas y depuración](#pruebas-y-depuración)
- [Ejecución local](#ejecución-local)
- [Créditos y licencias](#créditos-y-licencias)
- [Limitaciones conocidas](#limitaciones-conocidas)

## Inicio rápido en macOS

Necesitas las herramientas de línea de comandos de Xcode
(`xcode-select --install`), Node.js 18 o posterior y Git. No necesitas
Homebrew, permisos de administrador ni una ROM: el juego se compila desde el
código fuente.

```sh
scripts/setup-macos.sh      # Instala compilador ARM y libpng en .toolchain/ (aprox. 1 GB)
scripts/get-pokefirered.sh  # Descarga pret/pokefirered en el commit fijado y aplica los parches
scripts/fetch-vendor.sh     # Descarga el emulador, su núcleo y la fuente en web/vendor/
scripts/build-rom.sh        # Compila la ROM y genera web/game/dailyred.gba.gz
node scripts/serve.mjs      # Abre http://localhost:8080
```

`setup-macos.sh` elige el compilador adecuado para Mac Intel o Apple Silicon.

## Cómo funciona

```text
pret/pokefirered + patches/ ──compilación──▶ pokefirered_modern.gba
                                                    │ gzip
web/ (archivos estáticos)                         ▼
  index.html + app.js ── carga ──▶ game/dailyred.gba.gz y emulador mGBA
        │ escribe semilla y récord en la ROM
        ▼
  Nostalgist.js ──▶ RetroArch + núcleo mGBA (WebAssembly) ──▶ pantalla
        ▲
        └── game-link.js lee el estado del combate en la memoria del juego
              └── daily.js guarda los resultados en localStorage
```

El código de FireRed está escrito para el hardware de GBA (vídeo, DMA,
interrupciones, sonido y ensamblador ARM/Thumb). Ejecutar la ROM real en mGBA
conserva el motor de combate, las animaciones y el sonido. mGBA incluye una
implementación de BIOS, por lo que no hace falta un archivo BIOS.

Nostalgist y el núcleo mGBA de RetroArch permiten cargar la ROM como datos,
leer la memoria del emulador desde JavaScript y servir la web como archivos
estáticos sin cabeceras especiales. Los componentes se cargan desde
`web/vendor/`.

### La partida diaria

- **Equipo del día:** `web/daily.js` obtiene la semilla a partir de la fecha
  local. Así, quienes juegan el mismo día reciben el mismo equipo.
- **De la web al juego:** antes de iniciar la ROM, `web/rom-config.js` escribe
  la semilla y el récord en la configuración `gDailyRedRomConfig` de la ROM.
- **Del juego a la web:** `web/game-link.js` lee el estado de la partida desde
  la memoria del emulador. La página guarda el resultado en `localStorage`.
- **Una batalla diaria:** el día cuenta como jugado en cuanto empieza el
  combate. Si cierras o recargas la página durante la batalla, cuenta como una
  derrota. Antes de empezar puedes recargar: el equipo del día no cambia.
- **Récords** (`web/daily.js`, clave `dailyred-stats`): se guardan las
  victorias, derrotas y rachas. Si no juegas un día, se reinicia la racha diaria.
- **ROM independiente:** sin una semilla inyectada, aparece la introducción
  normal de FireRed y el juego genera un equipo nuevo después de cada batalla.
- **Partida de práctica:** `?seed=1234` inicia una partida sin límite diario y
  sin guardar resultados. Al terminar se genera otro equipo.

La web no requiere compilación: usa HTML, CSS y módulos JavaScript en `web/`.

### Flujo del juego y archivos

| Parte | Código |
|---|---|
| Inicio directo al juego con semilla | `pokefirered/src/intro.c` y `src/dailyred.c` |
| Equipo inicial | `pokefirered/src/new_game.c` |
| Inicio del combate, resultado y siguiente partida | Guiones de combate y `DailyRed_On*` en `pokefirered/src/dailyred.c` |
| Generación de equipos | `pokefirered/src/dailyred_team.c` |
| Equipo de ORO | `pokefirered/src/dailyred_boss.c` |
| Estado diario y configuración de la ROM | `pokefirered/src/dailyred.c`, `web/daily.js`, `web/rom-config.js` |

El combate usa el sistema normal de entrenadores de FireRed y el modo de rival
que evita terminar la partida si pierdes. El guion registra el resultado y
prepara el siguiente equipo.

## Generación de equipos

`pokefirered/src/dailyred_team.c` usa los datos originales del juego para crear
seis especies distintas de las generaciones 1 a 3. La suma de sus estadísticas
base debe ser al menos 2700. Hay una probabilidad de 1 entre 8 de que el equipo
incluya exactamente un Pokémon legendario o singular.

Los equipos son aleatorios, pero se valida su fuerza mínima para evitar que una
composición demasiado débil haga la partida injusta. La generación usa un
estado aleatorio propio, separado del generador del juego, de modo que cada
semilla produce el mismo equipo.

Los Pokémon son de nivel 100, tienen IV aleatorios entre 25 y 31 y EV
concentrados en sus estadísticas más útiles. Para cada especie, el generador
forma un repertorio con los movimientos que aprende por nivel (a cualquier
nivel), por MT/MO, como tutor y como movimiento huevo. De ese repertorio elige
hasta cuatro movimientos distintos al azar; no intenta crear combinaciones
competitivas. Si hay algún movimiento de ataque disponible, garantiza que el
set incluya al menos uno. Cada Pokémon recibe también un objeto de combate y el
generador valida el equipo antes de entregarlo al jugador.

## Equipo de ORO

El equipo está definido en `pokefirered/src/dailyred_boss.c` y sigue este
orden: Gyarados, Ampharos, Heracross, Umbreon, Ho-Oh y Typhlosion. Todos son de
nivel 100 y tienen IV perfectos (31). Cada Pokémon lleva un objeto y un set de
cuatro movimientos definidos en el código. Umbreon ocupa el cuarto puesto en
la formación actual. Gyarados aparece variocolor. ORO conserva el sprite y la
música de Campeón de Ethan.

## Desarrollo

1. Edita los archivos del juego dentro de `pokefirered/`.
2. Ejecuta `scripts/build-rom.sh` para compilar la ROM.
3. Recarga la página servida por `scripts/serve.mjs`.
4. Cuando los cambios estén listos, ejecuta `scripts/save-patch.sh` para
   actualizar `patches/pokefirered-dailyred.patch`.

`pokefirered/`, `.toolchain/`, `web/vendor/` y `web/game/` se generan
localmente y no se incluyen en Git. Los scripts los descargan o crean cuando
hacen falta. `git -C pokefirered diff` muestra los cambios del juego sobre el
código original.

Para abrir la ROM fuera del navegador, carga
`pokefirered/pokefirered_modern.gba` en mGBA u otro emulador de GBA. Sin una
semilla inyectada, inicia en la pantalla de título de FireRed.

## Pruebas y depuración

Las pruebas usan Chrome sin interfaz gráfica y ejecutan la ROM con el mismo
emulador que utiliza la web. Requieren Node.js y `playwright-core`:

```sh
cd tests
npm install
npm run smoke
npm run site
npm run teams -- 1 2 3
npm run teams -- --random 40
```

`smoke` comprueba el flujo del juego y los equipos; `site` comprueba la web en
escritorio y móvil. Las victorias y derrotas se fuerzan en las pruebas para
comprobar que se registran correctamente. Para jugar una partida de práctica,
abre `http://localhost:8080/?seed=42`. Para borrar el récord local, ejecuta
`localStorage.removeItem('dailyred-stats')` en la consola del navegador.

En la consola, `dailyRed.emulator` permite acceder al emulador activo y
`dailyRed.stats` muestra las estadísticas guardadas.

## Ejecución local

Después del inicio rápido, `node scripts/serve.mjs` sirve el contenido de
`web/` en `http://localhost:8080`. Puedes elegir otro puerto, por ejemplo
`node scripts/serve.mjs 3000`. El récord se guarda para esa dirección concreta;
usa el mismo puerto para conservar tus rachas. Después de recompilar la ROM,
recarga la página.

## Créditos y licencias

Daily Gold es un proyecto de fans gratuito y no oficial. No está afiliado ni
cuenta con el respaldo de Nintendo, Creatures Inc., GAME FREAK inc. ni The
Pokémon Company. Pokémon y el contenido de los juegos son propiedad de sus
respectivos titulares.

Este repositorio contiene el código propio de Daily Gold: los parches, la web
y las pruebas. No incluye la decompilación de pret/pokefirered ni la ROM
compilada. Los scripts obtienen el código de juego desde el repositorio de
pret y compilan la ROM localmente. Los componentes de terceros y sus licencias
se detallan en [web/licenses.txt](web/licenses.txt).

## Limitaciones conocidas

- El récord se guarda en el navegador. Borrar sus datos lo elimina y no se
  comparte entre navegadores o dispositivos.
- El día cambia a medianoche local, por lo que la hora de cambio varía según
  la zona horaria.
- El reinicio rápido está desactivado en el modo diario. Si la partida se
  reinicia durante un combate, la web lo cuenta como derrota.
- Las pruebas automatizadas no comprueban el sonido. En algunos navegadores,
  el audio se activa con la siguiente pulsación o toque.
- Se ha probado en macOS con Chrome de escritorio y emulación móvil. Safari,
  Firefox y teléfonos reales aún no se han comprobado.
- Los botones L y R abren la ayuda integrada de FireRed, que describe el juego
  original.

## Estructura del proyecto

```text
patches/                  Cambios aplicados a pret/pokefirered
scripts/                  Descarga, compilación y servidor local
web/                      Sitio web y recursos del juego
tests/                    Pruebas de navegador y herramienta de equipos
pokefirered/              Decompilación local, generada por los scripts
```

El código propio del juego se encuentra en `pokefirered/src/dailyred.c`,
`dailyred_team.c`, `dailyred_boss.c` y los guiones de combate.
