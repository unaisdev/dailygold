# Daily Gold

Una batalla diaria de Pokémon en el navegador, al estilo de Wordle. Cada día
recibes el mismo equipo aleatorio de seis Pokémon de nivel 100 y te enfrentas a
ORO (Ethan) en la sala del Campeón. Puedes jugar una vez al día. Las victorias,
derrotas y rachas se guardan en tu navegador.

El juego usa el motor original de Pokémon FireRed: una versión modificada de la
decompilación [pret/pokefirered](https://github.com/pret/pokefirered), compilada
como ROM de GBA y ejecutada en el navegador con el emulador mGBA para
WebAssembly. Los combates se ejecutan dentro del juego, no se simulan en
JavaScript.

## Inicio rápido en macOS

Necesitas las herramientas de línea de comandos de Xcode (`xcode-select --install`),
Node.js 18 o posterior y Git. No necesitas Homebrew, permisos de administrador
ni una ROM: el juego se compila desde el código fuente.

```sh
scripts/setup-macos.sh      # Instala compilador ARM y libpng en .toolchain/ (aprox. 1 GB)
scripts/get-pokefirered.sh  # Descarga pret/pokefirered en el commit fijado y aplica los parches
scripts/fetch-vendor.sh     # Descarga el emulador, su núcleo y la fuente en web/vendor/
scripts/build-rom.sh        # Compila la ROM y genera web/game/dailyred.gba.gz
node scripts/serve.mjs      # Abre http://localhost:8080
```

`setup-macos.sh` elige el compilador adecuado para Mac Intel o Apple Silicon.

## Cómo funciona

- **Equipo del día:** `web/daily.js` obtiene la semilla a partir de la fecha
  local. Así, quienes juegan el mismo día reciben el mismo equipo.
- **Web al juego:** antes de iniciar la ROM, `web/rom-config.js` escribe la
  semilla y el récord en la configuración `gDailyRedRomConfig` de la ROM.
- **Juego a la web:** `web/game-link.js` lee el estado de la partida desde la
  memoria del emulador. La página guarda el resultado en `localStorage`.
- **Una batalla diaria:** el día cuenta como jugado en cuanto empieza el
  combate. Si cierras o recargas la página durante la batalla, cuenta como una
  derrota. Antes de empezar puedes recargar: el equipo del día no cambia.
- **Partida de práctica:** `?seed=1234` inicia una partida sin límite diario y
  sin guardar resultados. Al terminar se genera otro equipo.
- **ROM independiente:** sin una semilla inyectada, aparece la introducción
  normal de FireRed y el juego genera un equipo nuevo después de cada batalla.

La web no requiere compilación: usa HTML, CSS y módulos JavaScript en `web/`.
El emulador ejecuta la ROM original de GBA, incluidos el motor de combate, las
animaciones y el sonido. No hace falta un archivo BIOS.

## Flujo del juego y archivos

| Parte | Código |
|---|---|
| Inicio directo al juego con semilla | `pokefirered/src/intro.c` y `src/dailyred.c` |
| Equipo inicial y traslado a la sala del Campeón | `pokefirered/src/new_game.c` |
| Mapa, personaje rival y diálogos | `pokefirered/data/maps/DailyRed_Summit/` |
| Inicio del combate, resultado y siguiente partida | `pokefirered/data/maps/DailyRed_Summit/scripts.inc` y `text.inc` |
| Generación de equipos | `pokefirered/src/dailyred_team.c` |
| Equipo de ORO | `pokefirered/src/dailyred_boss.c` |
| Estado diario y configuración de la ROM | `pokefirered/src/dailyred.c`, `web/daily.js`, `web/rom-config.js` |

El guion del mapa inicia un combate normal de entrenador con el modo de rival
temprano de FireRed. Si pierdes, no hay una derrota total del juego; el guion
registra el resultado y prepara el siguiente equipo.

## Generación de equipos

`pokefirered/src/dailyred_team.c` usa los datos originales del juego para crear
seis especies distintas de las generaciones 1 a 3. La suma de sus estadísticas
base debe ser al menos 2700. Hay una probabilidad de 1 entre 8 de que el equipo
incluya exactamente un Pokémon legendario o singular.

Los Pokémon son de nivel 100, tienen IV aleatorios entre 25 y 31 y EV
concentrados en sus estadísticas más útiles. Sus movimientos se eligen entre
los que aprenden por nivel o MT/MO, y cada uno lleva un objeto de combate. El
generador valida el equipo antes de entregarlo al jugador.

El equipo de ORO está definido en `pokefirered/src/dailyred_boss.c`: Gyarados,
Ampharos, Heracross, Togetic, Ho-Oh y Typhlosion, todos de nivel 100. Togetic
sustituye a Togekiss, que no existe en FireRed. El rival conserva el sprite y
la música de Campeón de Ethan.

## Desarrollo

1. Edita los archivos del juego dentro de `pokefirered/`.
2. Ejecuta `scripts/build-rom.sh` para compilar la ROM.
3. Recarga la página servida por `scripts/serve.mjs`.
4. Cuando los cambios estén listos, ejecuta `scripts/save-patch.sh` para
   actualizar `patches/pokefirered-dailyred.patch`.

`pokefirered/`, `.toolchain/` y `web/vendor/` se generan localmente y no se
incluyen en Git. Los scripts los descargan o crean cuando hacen falta.

### Pruebas

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

`smoke` comprueba el ciclo del juego y los equipos; `site` comprueba la web en
escritorio y móvil. Para jugar una partida de práctica, abre
`http://localhost:8080/?seed=42`. Para borrar el récord local, ejecuta
`localStorage.removeItem('dailyred-stats')` en la consola del navegador.

## Ejecución local

Después del inicio rápido, `node scripts/serve.mjs` sirve el contenido de
`web/` en `http://localhost:8080`. Puedes elegir otro puerto, por ejemplo
`node scripts/serve.mjs 3000`. El récord se guarda para esa dirección concreta;
usa el mismo puerto para conservar tus rachas. Después de recompilar la ROM,
recarga la página.

Para abrir la ROM fuera del navegador, carga
`pokefirered/pokefirered_modern.gba` en mGBA u otro emulador de GBA.

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

- Las zapatillas y la bicicleta están desactivadas en la cima; solo hay que
  caminar unos pasos.
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
`dailyred_team.c`, `dailyred_boss.c` y `pokefirered/data/maps/DailyRed_Summit/`.

