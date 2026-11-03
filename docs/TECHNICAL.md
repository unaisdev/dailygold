# Arquitectura y datos del juego

## Arquitectura

`web/` es un sitio estático. `app.js` inicia Nostalgist y el core mGBA de RetroArch/WebAssembly, carga la ROM y escribe la configuración usando la marca incluida en el binario (`rom-config.js`). `game-link.js` localiza la estructura de estado en la RAM para detectar inicio y resultado. `daily.js` administra la semilla diaria y guarda estadísticas en `localStorage` bajo `dailygold-stats`.

El motor es [pret/pokefirered](https://github.com/pret/pokefirered), clonado a un commit fijado por `scripts/get-pokefirered.sh`. Los cambios se mantienen en `patches/pokefirered-dailyred.patch`; el clon `pokefirered/` es una carpeta local no versionada. `scripts/save-patch.sh` guarda sus cambios en el parche. No edites el repositorio upstream ni conviertas la ROM en un archivo distribuido.

FireRed aporta el motor de batalla y las mecánicas de tercera generación. Las estructuras y nombres `DailyRed_*`, `DAILYRED_*` y `TRAINER_DAILYRED_RED` son identificadores heredados utilizados por el parche y la ROM. Se conservan para evitar incompatibilidad; la interfaz pública se llama Daily Gold.

## Equipo diario del jugador

`src/dailyred_team.c` construye el equipo según una semilla propia, independiente de `Random()`. Mantiene seis especies distintas de las generaciones 1 a 3, un total mínimo de 2700 estadísticas base, nivel 100, IV entre 25 y 31 y EV enfocados en dos estadísticas con 252 cada una y los 6 restantes en PS (o la tercera estadística si PS es una de las dos primeras). Ataque y Ataque Especial solo se consideran si hay un movimiento dañino que use esa estadística; en tercera generación, el tipo del movimiento determina si es físico o especial.

La probabilidad de un equipo con exactamente un legendario/singular es 1/8; su posición es aleatoria. Los demás equipos no llevan legendarios. El selector vuelve a escoger el resto del equipo para satisfacer el mínimo de estadísticas. Los movimientos se seleccionan entre todos los que la especie puede aprender por nivel (a cualquier nivel), MT/MO, tutor o huevo; se evita un repertorio sin ataques dañinos cuando hay un ataque disponible. Se equipan objetos de combate, incluidos potenciadores de tipo solo cuando existe un ataque de ese tipo. Los Pokémon de evento tienen la marca necesaria para que Mew/Deoxys obedezcan. Los detalles exactos del generador, listas y constantes permanecen en el código; las pruebas de `tests/party.mjs` leen las fuentes de aprendizaje de FireRed por separado del generador. La validación debe seguir rechazando cualquier movimiento fuera de esas fuentes.

El generador no intenta optimizar equipos competitivos: puede elegir ataques de estado poco útiles y objetos inadecuados para un repertorio concreto. No incluye objetos específicos como Bola Luminosa o Hueso Grueso. No cambies estas reglas o su estado aleatorio al actualizar documentación.

No alteres el algoritmo aleatorio, las semillas, las reglas de selección ni el cálculo de IV/EV/naturalezas sin autorización explícita y un fallo reproducible.

## Equipo de Oro

El roster de ORO se define en `src/dailyred_boss.c`. La tabla expresa EVs como PS/Ataque/Defensa/Velocidad/Ataque Especial/Defensa Especial.

| Pokémon | Naturaleza | Habilidad | Objeto | Movimientos | EVs |
|---|---|---|---|---|---|
| Gyarados | Firme | Intimidación | Baya Ziuela | Danza Dragón, Terremoto, Avalancha, Retribución | 4/252/0/252/0/0 |
| Ampharos | Modesta | Electricidad Estática | Imán | Rayo, Puño Hielo, Onda Trueno, Pantalla Luz | 252/0/0/0/252/6 |
| Heracross | Alegre | Agallas | Polvo Plata | Danza Espada, Megacuerno, Demolición, Avalancha | 4/252/0/252/0/0 |
| Umbreon | Cauta | Sincronía | Restos | Deseo, Persecución, Tóxico, Finta | 252/0/252/0/0/4 |
| Ho-Oh | Seria | Presión | Pico Afilado | Fuego Sagrado, Golpe Aéreo, Terremoto, Recuperación | 252/252/0/6/0/0 |
| Typhlosion | Miedosa | Absorbe Fuego | Carbón | Estallido, Llamarada, Puño Trueno, Paranormal | 4/0/0/252/252/0 |

Gyarados conserva el brillo forzado y amistad 255. La naturaleza del equipo de Oro es configurable mediante `gDailyRedBossNatures`; las pruebas de `smoke.mjs` contrastan los valores activos. ORO conserva la clase Campeón y la música correspondiente. El jugador se llama HORTE dentro de la implementación.

## Flujo de compilación

1. `setup-macos.sh` o `setup-linux.sh` prepara el compilador ARM y libpng local.
2. `get-pokefirered.sh` descarga el commit fijado, crea `pokefirered/` y aplica el parche.
3. `fetch-vendor.sh` obtiene dependencias web con versiones y hashes fijados y sus textos de licencia.
4. `build-rom.sh` crea la ROM moderna y el gzip de ejecución local en `web/game/`, además de sprites/íconos web derivados.
5. `node scripts/serve.mjs` sirve el directorio estático `web/`.

La ROM y los productos de compilación están ignorados por Git; la web no funciona desde un clon nuevo hasta que se ejecute el flujo de preparación. Se utiliza el objetivo `modern` del proyecto upstream, no una ROM comercial ni una compilación byte a byte de `agbcc`.

La web obtiene la semilla de la fecha local del jugador; la misma fecha local genera el mismo equipo para todos. La configuración de ROM lleva semilla y datos de récord con una marca buscada por `rom-config.js`, sin direcciones absolutas fijas. El juego escribe una estructura de estado en RAM con marca, semilla, fase y resultado, que `game-link.js` busca en la memoria del emulador. El día se marca como usado al comenzar el combate; abandonar durante una partida diaria se registra como derrota. `?seed=1234` inicia práctica sin registrar estadísticas ni imponer límite diario. Sin configuración web/semilla, la ROM arranca en el título normal y crea equipos nuevos tras los combates.

El mapa y los nombres C conservan identificadores heredados de Daily Red. En el juego público el rival es ORO/Ethan. No se debe confundir una ruta interna heredada con la descripción del lugar: el encuentro es en la sala del Campeón, no en la sala de Lorelei ni en una montaña.

## Pruebas y directorios

- `tests/smoke.mjs`: inicia la ROM real y comprueba el mapa, batalla, equipo de ORO, estadísticas y partidas diarias/prácticas.
- `tests/site.mjs`: comprueba los resultados diarios, persistencia, textos, descarga y diseño de escritorio/móvil mediante Chrome.
- `tests/teams.mjs` y `tests/party.mjs`: comparan equipos generados con los datos de FireRed, de forma independiente al algoritmo de generación.
- `patches/`: cambios reproducibles del motor.
- `scripts/`: instalación, descarga, guardado del parche, construcción y servidor local.
- `web/`: interfaz, licencias, core generado localmente y ROM construida localmente.

El smoke test también fuerza resultados alterando PS de un estado guardado para comprobar victoria/derrota sin jugar cada combate completo. Las pruebas de sitio simulan fechas con el reloj de Playwright y revisan escritorio (pantalla 720×480), vista móvil, controles táctiles, persistencia, límite diario, partida abandonada, práctica y mensaje de error de descarga. El audio no se puede verificar en el modo headless. La compatibilidad debe describirse solo según los sistemas donde se hayan ejecutado realmente construcción y pruebas.

## Comportamiento y limitaciones conocidas

- Las estadísticas se guardan localmente en `dailygold-stats`; borrar los datos del sitio las reinicia. No se sincronizan entre navegadores o dispositivos y no existe servidor de cuentas.
- El día cambia a medianoche local. Safari, Firefox y dispositivos móviles reales no deben declararse probados sin una comprobación específica.
- En modo diario se desactiva el reinicio rápido A+B+Start+Select para impedir reiniciar una derrota; un reinicio durante el combate se cuenta como derrota.
- Los botones L/R todavía muestran la ayuda original de FireRed. El audio puede permanecer suspendido hasta que el usuario interactúe con la página.
- Las naturalezas del rival sí se configuran mediante `gDailyRedBossNatures`; no son una consecuencia inconfigurable de su nombre.
