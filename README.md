# Daily Gold

> **Aviso:** Daily Gold se basa en y se construye sobre el repositorio de
> [DailyRed](https://github.com/amoi-builds/dailyred).

Una batalla diaria de Pokémon en el navegador, al estilo de Wordle. Cada día
recibes el mismo equipo aleatorio de seis Pokémon de nivel 100 y te enfrentas a
**GOLD (Ethan)** en la sala del Campeón. Puedes jugar una vez al día. Las
victorias, derrotas y rachas se guardan en tu navegador.

Cada combate se ejecuta en el motor original de Pokémon FireRed: el juego parte
de la decompilación [pret/pokefirered](https://github.com/pret/pokefirered),
con algunos cambios propios, se compila como ROM de GBA y se ejecuta en el
navegador mediante el emulador mGBA compilado para WebAssembly. JavaScript no
simula los combates.

- [Inicio rápido (macOS)](#inicio-rapido-macos)
- [Cómo funciona](#como-funciona)
- [Generación de equipos](#generacion-de-equipos)
- [Equipo de GOLD](#equipo-de-gold)
- [Flujo de desarrollo](#flujo-de-desarrollo)
- [Pruebas y depuración](#pruebas-y-depuracion)
- [Ejecución local](#ejecucion-local)
- [Derechos de autor y licencias](#derechos-de-autor-y-licencias)
- [Limitaciones conocidas](#limitaciones-conocidas)
- [Estructura del proyecto](#estructura-del-proyecto)

## Inicio rápido (macOS)

Necesitas las herramientas de línea de comandos de Xcode (`xcode-select --install`),
Node.js 18 o posterior y Git. No necesitas Homebrew, permisos de administrador
ni una ROM: el juego se compila desde el código fuente.

```sh
scripts/setup-macos.sh      # Instala el compilador ARM y libpng en .toolchain/ (aprox. 1 GB, una vez)
scripts/get-pokefirered.sh  # Descarga pret/pokefirered en el commit fijado y aplica patches/
scripts/fetch-vendor.sh     # Descarga el emulador, su núcleo y la fuente en web/vendor/
scripts/build-rom.sh        # Compila la ROM y genera web/game/dailyred.gba.gz
node scripts/serve.mjs      # Abre http://localhost:8080
```

`setup-macos.sh` elige el compilador adecuado para Mac Intel o Apple Silicon.

## Cómo funciona

```
pret/pokefirered @ 037335f + patches/  ──make modern──▶  pokefirered_modern.gba
                                                              │ gzip (16 MB → 5,5 MB)
web/ (archivos estáticos)                                     ▼
  index.html + app.js ── fetch ──▶ game/dailyred.gba.gz, vendor/mgba_libretro.wasm
        │  escribe la semilla del día y el récord en la ROM (rom-config.js)
        ▼
  Nostalgist.js ──▶ RetroArch + núcleo mGBA (WebAssembly) ──▶ <canvas>
        ▲
        └─ game-link.js lee el estado del combate desde la RAM del juego
           → daily.js actualiza las estadísticas en localStorage
```

**Por qué se usa un emulador en vez de compilar C a WebAssembly:** la
decompilación está escrita para el hardware de GBA (vídeo, DMA, interrupciones,
el motor de sonido m4a y ensamblador ARM/Thumb). Ejecutar la ROM real en mGBA
conserva el motor de combate, las animaciones y el sonido originales, sin
portarlos. mGBA incluye una sustitución del BIOS, así que no hace falta un
archivo BIOS.

**Por qué se usan Nostalgist y el núcleo mGBA de RetroArch:** aceptan la ROM
como bytes (necesario para escribir la configuración), permiten enviar botones
y acceder desde JavaScript a la memoria del emulador, y no requieren
`SharedArrayBuffer`. Por eso basta con un servidor estático sin cabeceras
especiales. Todo se carga desde `web/vendor/`.

### La partida diaria

- **Equipo del día:** la semilla es un hash de la fecha local del jugador
  (`dailySeed` en `web/daily.js`). Así, todos reciben el mismo equipo durante
  el mismo día natural, como en Wordle.
- **De la web al juego:** la ROM contiene una estructura pequeña,
  `gDailyRedRomConfig`: la marca `DAILYRED-CONF-V2`, la semilla, las victorias
  y los combates anteriores, y un indicador de partida diaria. Antes de iniciar
  el juego, `web/rom-config.js` busca la marca en la ROM descargada y escribe
  los valores; no hay direcciones fijadas a mano. El juego utiliza el récord
  para mostrar el número de victorias y combates.
- **Del juego a la web:** el juego mantiene un bloque de estado en la RAM
  (`sStatus` en `src/dailyred.c)): la marca `DAILYRED-STATUS1`, la semilla,
  una fase (exploración, combate, resultado o fin) y el resultado (victoria o
  derrota). `web/game-link.js` lo localiza en la memoria WebAssembly del
  emulador mediante la marca y la semilla, y lo lee dos veces por segundo.
- **Un combate al día:** el día cuenta como jugado en cuanto empieza el combate
  contra GOLD. Cerrar o recargar la página durante el combate cuenta como
  derrota. El resultado se guarda en cuanto se conoce. Tras los mensajes
  finales, el juego funde a negro y se queda esperando; la web lo cierra y
  muestra el resultado y la cuenta atrás para el siguiente combate. Antes de
  empezar puedes recargar sin problema: el equipo no cambia durante el día.
- **Estadísticas** (`web/daily.js`, clave de `localStorage`:
  `dailyred-stats`): victorias, derrotas, racha de victorias diarias y racha de
  días jugados. Si pasa un día sin jugar, se reinician las rachas.
- **Sin la web** (semilla 0, por ejemplo, en un emulador de escritorio): aparece
  la introducción y la pantalla de título normales. Al pulsar Start, FireRed
  prepara la partida como de costumbre y genera un equipo nuevo después de cada
  combate.
- **`?seed=1234`** en la URL inicia una partida de práctica para probar un
  equipo concreto. No tiene límite diario ni guarda resultados; al terminar se
  genera otro equipo. El parámetro no aparece en la interfaz.

### Flujo del juego y archivos

| Paso | Código |
|---|---|
| Pantalla de copyright → inicio directo con semilla | `src/intro.c` → `CB2_DailyRed_StartFromCopyright` (`src/dailyred.c`) |
| Pantalla de título → inicio directo sin semilla | `src/title_screen.c` → `CB2_DailyRed_StartFromTitle` |
| Datos de partida: LEAF (jugadora de FireRed), texto rápido | `StartNewGame` en `src/dailyred.c`, después el `CB2_NewGame` original |
| Equipo y traslado a la sala del Campeón en lugar de la habitación | `src/new_game.c` → `DailyRed_InitNewGame` |
| Sala del Campeón sin salidas; GOLD mira al sur desde (6, 8) | `data/maps/DailyRed_Summit/` (diseño `LAYOUT_POKEMON_LEAGUE_CHAMPIONS_ROOM`) |
| Hablar con GOLD → combate → resultado → récord → fundido a negro | `data/maps/DailyRed_Summit/scripts.inc`, `text.inc` y especiales `DailyRed_On*` en `src/dailyred.c` |
| Fondo de combate de la Liga | `BattleSetup_GetTerrainId` en `src/battle_setup.c` |
| Sin cambio gratis de Pokémon al debilitar a uno de GOLD: estilo SET bloqueado en Opciones | `StartNewGame` en `src/dailyred.c`, `src/option_menu.c` |
| GOLD como entrenador (sprites de Ethan, de Hall of Legends) | `TRAINER_DAILYRED_RED` (identificador interno heredado) en `include/constants/opponents.h`, `src/data/trainers.h`, `src/dailyred_boss.c` |
| Menús: POKéMON / OPTION / EXIT; equipo: SUMMARY / SWITCH / CANCEL | `src/start_menu.c`, `src/party_menu.c`; altura de las ventanas en `src/new_menu_helpers.c` |
| Jugador HORTE: sprite calvo del mapa, frontal VS y espalda de combate | `src/dailyred.c`, sprites `horte_*`, `RedNormal` → BaldingMan |
| Sprite de GOLD en su propia paleta para no interferir con HORTE | `OBJ_EVENT_GFX_DAILYRED_RED` (identificador interno heredado) en `include/constants/event_objects.h`, `src/data/object_events/` |

El combate es un combate normal contra un entrenador de FireRed. El guion del
mapa usa `trainerbattle_earlyrival` con `RIVAL_BATTLE_HEAL_AFTER`, el modo de la
batalla contra el rival en el laboratorio de Oak; perder no provoca un
«blanco». Después lee `VAR_RESULT`, actualiza el contador de victorias y
combates, llama al especial `DailyRed_StartNextRun` para generar otro equipo y
vuelve al punto inicial, donde también reinicia a GOLD.

Los archivos originales modificados llevan un comentario `Daily Red:` junto al
cambio:

```sh
grep -rn "Daily Red" pokefirered/src pokefirered/include pokefirered/data
```

El mapa reutiliza el diseño de la sala del Campeón de la Liga Pokémon (el mismo
lugar que Hall of Legends). GOLD está en (6, 8), mirando al sur; empiezas en
(6, 12). El proyecto usa el objetivo `modern` de pokefirered (GCC 14), no la
compilación `agbcc` idéntica byte a byte, por lo que no reproduce la ROM
comercial.

## Generación de equipos

`pokefirered/src/dailyred_team.c` genera cada equipo con los datos de la
decompilación (`gLevelUpLearnsets`, `CanMonLearnTMHM`, la tabla de movimientos
MT/MO, `CreateMon` y `CalculateMonStats`):

- **Especies:** seis Pokémon distintos de las 386 especies de las generaciones
  1 a 3. La suma de sus estadísticas base debe ser al menos 2850
  (`MIN_TEAM_BASE_STAT_TOTAL`). Hay una probabilidad de 1 entre 8
  (`LEGENDARY_TEAM_ODDS`) de que un equipo tenga exactamente un Pokémon
  legendario o singular, en una posición aleatoria; los otros siete equipos de
  cada ocho no tienen ninguno. El generador vuelve a elegir el resto del equipo
  hasta alcanzar el mínimo, de modo que todos los equipos válidos tengan la
  misma probabilidad. Las reglas de elegibilidad por especie están en
  `IsEligibleSpecies`; por ejemplo, ahí se puede exigir que solo haya especies
  totalmente evolucionadas.

  **Por qué hay un mínimo:** el equipo de GOLD suma 3289 puntos (véase abajo).
  Un equipo totalmente aleatorio promedia unos 2430 y dos tercios incluyen un
  Pokémon con menos de 300 puntos, lo que hacía que la mayoría de partidas
  fueran casi imposibles. Aun así, un equipo puede tener un Pokémon débil si
  los demás compensan sus estadísticas.

  **Por qué los legendarios tienen una probabilidad independiente:** como sus
  estadísticas base son mucho más altas, el mínimo por sí solo haría que
  aparecieran con demasiada frecuencia. Por eso el juego decide primero si el
  equipo tendrá exactamente uno: la probabilidad es 1 entre 8 (12,5 %), y los
  otros siete de cada ocho equipos no tienen ninguno.

  **Comparación con GOLD:** una simulación de 500 000 equipos, con las especies
  actuales y el mínimo de 2850, estima que alrededor del **0,04 %**
  (aproximadamente 1 de cada 2600 equipos) supera los **3289 puntos de
  estadísticas base** de GOLD. Esta comparación solo suma estadísticas base;
  no mide el efecto de movimientos, objetos, tipos ni estrategias.

- **Movimientos:** se eligen uniformemente hasta cuatro movimientos distintos
  entre todos los que una especie puede aprender por nivel (a cualquier nivel),
  por MT/MO, como tutor o como movimiento huevo. Si ninguno de los cuatro causa
  daño y la especie conoce alguno
  que sí lo haga, se sustituye uno por un ataque. Las especies con menos de
  cuatro movimientos disponibles (Ditto, Unown, Magikarp, Smeargle…) reciben
  todos los que puedan aprender.
- **Estadísticas:** nivel 100 y personalidad aleatoria (naturaleza, género,
  habilidad y la probabilidad habitual de 1 entre 8192 de ser variocolor).
  - **IV:** aleatorios entre 25 y 31 para cada estadística (`MIN_TEAM_IV`); GOLD
    tiene 31 en todas.
  - **EV:** 252 en cada una de las dos estadísticas base más altas y los 6
    restantes en PS, o en la tercera más alta si PS está entre las dos
    primeras (`AssignFocusedEVs`). Ataque y At. Esp. solo se cuentan si algún
    movimiento usa esa estadística; en la tercera generación el tipo del
    movimiento determina cuál se usa. Por ejemplo, un Gyarados que solo tenga
    Surf y Rayo Hielo no desperdicia EV en Ataque. El reparto se calcula según
    las estadísticas base y los movimientos, no para igualar la velocidad de
    GOLD.

  El jugador es el entrenador original, así que todos los Pokémon obedecen.
  Además, se marcan como Pokémon de evento para que Mew y Deoxys también
  obedezcan.
- **Objetos equipados:** cada Pokémon lleva uno, elegido uniformemente de una
  lista de objetos útiles para el combate (`sBattleItems`: Restos, Cinta
  Elegida, Garra Rápida, Baya Ziuela, bayas que se activan con pocos PS, etc.)
  y de los potenciadores de tipo del 10 % para cada tipo de ataque que conozca
  (Carbón solo si tiene un ataque de tipo Fuego, por ejemplo). No hay objetos
  de la mochila.
- **Validación:** se comprueban nivel, PS, al menos un movimiento, ausencia de
  movimientos duplicados y PP. Si una especie fallara diez veces, el juego
  usaría su repertorio predeterminado de nivel 100 de FireRed para evitar un
  Pokémon defectuoso.

El selector no busca crear equipos competitivos. Pueden salir Salpicadura,
Agua Lodosa o tres movimientos de estado y un único ataque. Los objetos se
eligen sin mirar el repertorio salvo para los potenciadores de tipo; por eso
una Cinta Elegida puede acabar en un Pokémon que use sobre todo movimientos de
estado. Tampoco se incluyen objetos específicos de especie como Bola Luminosa
o Hueso Grueso. El generador usa su propio estado aleatorio, independiente de
`Random()`, por lo que los equipos dependen solo de la semilla.

## Equipo de GOLD

Edita **`pokefirered/src/dailyred_boss.c`** para cambiar especies, nivel, IV,
objeto y movimientos, usando el formato normal de FireRed
`TrainerMonItemCustomMoves` y una tabla de EV junto a él. El equipo sigue al de
Ethan en [Hall of Legends](https://github.com/amoi-builds/halloflegends):
Gyarados, Ampharos, Heracross, Umbreon, Ho-Oh y Typhlosion. Todos están al
nivel 100, con IV perfectos, objetos equipados y EV completos. El Gyarados
inicial es variocolor, igual que en Hall of Legends. Umbreon ocupa el cuarto
puesto en la formación actual. El combate tiene lugar
en la sala del Campeón.

| Pokémon | PS | Atq | Def | Vel | At. Esp. | Def. Esp. | Total |
|---|---|---|---|---|---|---|---|
| Gyarados | 95 | 125 | 79 | 81 | 60 | 100 | 540 |
| Ampharos | 90 | 75 | 85 | 55 | 115 | 90 | 510 |
| Heracross | 80 | 125 | 75 | 85 | 40 | 95 | 500 |
| Umbreon | 95 | 65 | 110 | 65 | 60 | 130 | 525 |
| Ho-Oh | 106 | 130 | 90 | 90 | 110 | 154 | 680 |
| Typhlosion | 78 | 84 | 78 | 100 | 109 | 85 | 534 |
| **Equipo** | | | | | | | **3289** |

### Pokémon, movimientos, habilidades y objetos

- **Gyarados** — Danza Dragón, Terremoto, Avalancha y Retribución; habilidad: **Intimidación**; objeto: **Baya Ziuela**.
- **Ampharos** — Rayo, Puño Hielo, Onda Trueno y Pantalla Luz; habilidad: **Electricidad Estática**; objeto: **Imán**.
- **Heracross** — Danza Espada, Megacuerno, Demolición y Avalancha; habilidad: **Agallas**; objeto: **Polvo Plata**.
- **Umbreon** — Deseo, Protección, Tóxico y Finta; habilidad: **Sincronía**; objeto: **Restos**.
- **Ho-Oh** — Fuego Sagrado, Golpe Aéreo, Terremoto y Recuperación; habilidad: **Presión**; objeto: **Pico Afilado**.
- **Typhlosion** — Estallido, Llamarada, Puño Trueno y Paranormal; habilidad: **Absorbe Fuego**; objeto: **Carbón**.

Son estadísticas base de la tercera generación, tomadas de
`src/data/pokemon/species_info.h`. La generación del equipo diario conserva sus
reglas. El equipo de GOLD suma 3289 puntos de estadísticas base, frente a los
2954 del equipo anterior de RED: son 335 puntos más (aproximadamente un 11,3 %).
Las comparaciones de dificultad anteriores con RED ya no describen al rival
actual.

El nombre de GOLD, su clase de entrenador Campeón, su sprite de combate (Ethan,
de Hall of Legends) y sus indicadores de IA están en
`[TRAINER_DAILYRED_RED]` dentro de `pokefirered/src/data/trainers.h`. El código
conserva ese identificador interno heredado, pero el entrenador se llama GOLD.
Conserva la música de combate de Campeón (`src/pokemon.c`). El jugador es **HORTE**
(sprites calvo en el mapa, frontal VS y espalda de combate). FireRed no asigna
EV a los entrenadores; un enganche de tres líneas en `CreateNPCTrainerParty`
(`src/battle_main.c`) aplica la tabla de EV. Las naturalezas se obtienen con
la fórmula habitual de FireRed basada en el nombre y no se pueden configurar.

## Flujo de desarrollo

1. Edita los archivos de `pokefirered/`, un clon local del repositorio de pret.
2. Ejecuta `scripts/build-rom.sh`; las compilaciones incrementales tardan unos
   segundos.
3. Recarga la página. `scripts/serve.mjs` envía `Cache-Control: no-cache`.
4. Cuando los cambios estén listos, ejecuta `scripts/save-patch.sh` y guarda
   `patches/pokefirered-dailyred.patch` en Git.

`pokefirered/`, `.toolchain/` y `web/vendor/` no están versionados (véase
`.gitignore`); en una copia limpia se vuelven a crear con los scripts. Los
sprites de `web/game/` (GOLD y su equipo) sí están versionados; solo se ignora
la ROM compilada (`.gba` / `.gba.gz`). `git -C pokefirered diff` muestra
todos los cambios respecto al código original.

Para jugar la ROM fuera del navegador, abre
`pokefirered/pokefirered_modern.gba` en mGBA u otro emulador de GBA. Sin una
semilla inyectada, empieza en la pantalla de título; pulsa Start.

La web no necesita compilarse: usa HTML, CSS y módulos ES en `web/`.

## Pruebas y depuración

Las pruebas ejecutan la ROM real en Chrome sin interfaz gráfica, mediante el
mismo emulador que usa la web. Simulan pulsaciones y leen la RAM del juego desde
los estados guardados por el emulador (los estados de mGBA incluyen una copia
sin comprimir de la RAM).

```sh
cd tests
npm install        # Solo instala playwright-core; controla el Chrome instalado
npm run smoke      # Ciclo del juego (unos 3 minutos)
npm run site       # Web en escritorio y móvil (aprox. 1 minuto)
npm run teams -- 1 2 3            # Muestra y valida los equipos de estas semillas
npm run teams -- --random 40      # Genera 40 semillas aleatorias
```

`npm run smoke` comprueba que:
- cada equipo tiene seis especies reales distintas de las generaciones 1 a 3,
  suma al menos 2850 puntos de estadísticas base, como máximo un legendario,
  nivel 100, PS completos, IV entre 25 y 31, EV colocados exactamente según
  `AssignFocusedEVs` (con una implementación JavaScript independiente), un
  objeto de la lista (los potenciadores de tipo solo aparecen si hay un ataque
  de ese tipo) y movimientos que la especie puede aprender. La comprobación de
  movimientos analiza los archivos de datos de la decompilación desde
  JavaScript, por separado del generador en C.
- una misma semilla produce el mismo equipo y semillas diferentes producen
  equipos distintos.
- el jugador empieza al pie de las escaleras, GOLD mira hacia el lado contrario
  (también después de cada partida) y hablar con GOLD inicia un combate de
  entrenador con el fondo de montaña.
- el estilo de combate está en SET desde el inicio, el menú Opciones no permite
  cambiarlo y, cuando debilitas a un Pokémon de GOLD, este envía al siguiente
  sin preguntar «¿Cambiará LEAF de POKéMON?».
- el equipo de GOLD en combate coincide con su configuración de IV, objetos y EV.
- se procesan tanto la victoria como la derrota: no hay derrota total, se
  actualizan los contadores y después aparece un equipo nuevo.
- el modo diario recibe el récord de la web, informa del inicio, resultado y
  fin del combate, incluye la batalla en el mensaje del récord e ignora las
  pulsaciones cuando termina (no se inicia un segundo combate).
- sin semilla aparece la pantalla de título y Start inicia la partida.

Las victorias y derrotas se fuerzan modificando los PS en un estado guardado;
así las pruebas son rápidas y deterministas. Se guardan capturas de cada paso
en `tests/output/`.

`npm run site` recorre cinco días simulados con el reloj de Playwright: una
visita nueva, una victoria (estadísticas, bloqueo hasta mañana, cuenta atrás y
persistencia tras recargar), el mismo equipo en un segundo navegador ese día,
una derrota al día siguiente, abandonar durante el combate (cuenta como
derrota), saltarse un día (se reinician las rachas) y una partida de práctica
(`?seed=`, no se registra). También comprueba la pantalla 3× (720×480), el
sprite de GOLD, la vista móvil, la cruceta táctil y la pantalla de error de
descarga con la opción «Reintentar».

**Comprobación manual:** abre `http://localhost:8080/?seed=42` para una
partida de práctica (no se guarda nada ni hay límite diario). Para borrar las
estadísticas diarias, ejecuta
`localStorage.removeItem('dailyred-stats')` en la consola del navegador.

**Consola del navegador:** `dailyRed.emulator` es la instancia activa de
Nostalgist y `dailyRed.stats` muestra las estadísticas guardadas.

## Ejecución local

Daily Gold está pensado para jugarse en tu ordenador. Tras el inicio rápido,
`web/` contiene todo el sitio (unos 9 MB) y `node scripts/serve.mjs` lo sirve
en http://localhost:8080:

```
web/         index.html, app.js, daily.js, game-link.js, game-files.js,
             rom-config.js, style.css, favicon.svg y licenses.txt
web/vendor/  emulador (3,4 MB) y fuente
web/game/    dailyred.gba.gz (5,5 MB), compilado en tu máquina
```

Para usar otro puerto, indícalo, por ejemplo:
`node scripts/serve.mjs 3000`. Las estadísticas se guardan para esa dirección
del navegador; utiliza siempre el mismo puerto para conservar las rachas.
Después de recompilar la ROM con `scripts/build-rom.sh`, recarga la página.

## Derechos de autor y licencias

Daily Gold es un proyecto de fans gratuito y no oficial. No está afiliado ni
cuenta con el respaldo de Nintendo, Creatures Inc., GAME FREAK inc. ni The
Pokémon Company. Pokémon y los nombres, personajes y contenido relacionados
son © Nintendo, Creatures Inc. y GAME FREAK inc.

Este repositorio contiene el trabajo propio de Daily Gold: los cambios de
`patches/`, la web y las pruebas. No incluye pret/pokefirered ni una ROM
compilada; los scripts descargan la decompilación del repositorio de pret y la
compilan localmente.

El núcleo del emulador se distribuye bajo GPL-3.0 (RetroArch) y MPL-2.0 (mGBA).
`web/licenses.txt` enumera los componentes de terceros y enlaza a su código
fuente; el pie de la página también lleva a esa lista.

## Limitaciones conocidas

- **Movimiento:** las zapatillas para correr y la bicicleta están desactivadas
  en la cima; solo hay unos pasos hasta arriba.
- **Estadísticas en el navegador:** borrar los datos del sitio reinicia el
  récord. No se comparte entre dispositivos o navegadores y cualquiera puede
  editar su propio `localStorage`. El juego es informal y no tiene servidor.
- **Zonas horarias:** el día cambia a medianoche local, así que el equipo diario
  aparece a distintas horas según la zona horaria, como en Wordle.
- **Reinicio rápido:** la combinación A+B+Start+Select está desactivada en el
  modo diario para que no se pueda reiniciar una derrota. Si el juego se
  reinicia durante un combate de todos modos, la web lo cuenta como derrota.
- **Audio:** las pruebas sin interfaz no pueden comprobarlo. Los navegadores
  suelen suspender el sonido hasta que el jugador pulsa una tecla o toca la
  pantalla; el juego lo reanuda entonces.
- **Entorno probado:** macOS con Google Chrome, en modo sin interfaz, escritorio
  y emulación móvil. Aún no se ha probado en Safari, Firefox ni teléfonos reales.
- Los botones L/R todavía abren la ayuda integrada de FireRed, que describe el
  juego original.

## Estructura del proyecto

```
patches/pokefirered-dailyred.patch   cambios a pret/pokefirered
scripts/setup-macos.sh               herramientas de compilación y libpng
scripts/get-pokefirered.sh           descarga fijada del código original y parches
scripts/save-patch.sh                cambios de pokefirered/ → patches/
scripts/build-rom.sh                 make modern → web/game/dailyred.gba.gz
scripts/fetch-vendor.sh              Nostalgist, núcleo mGBA y fuente (versiones verificadas)
scripts/serve.mjs                    servidor estático local
web/                                 sitio web
tests/                               pruebas de navegador y herramienta de equipos
```

Dentro de `pokefirered/`, el código de Daily Gold está en `include/dailyred.h`,
`include/constants/dailyred.h`, `src/dailyred.c` (flujo y semilla),
`src/dailyred_team.c` (generador de equipos), `src/dailyred_boss.c` (equipo
de GOLD), `data/maps/DailyRed_Summit/` y `data/layouts/DailyRed_Summit/`
(el mapa).
