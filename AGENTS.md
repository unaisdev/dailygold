# AGENTS.md — Daily Gold

## Objetivo

Daily Gold es un desafío diario Pokémon en navegador: seis Pokémon aleatorios contra Oro (Ethan), un intento diario, con FireRed y mecánicas de tercera generación. El navegador ejecuta el motor FireRed compilado como ROM local y emulado con mGBA/WebAssembly; no simula los combates.

## Mapa del repositorio

- `web/`: aplicación estática, lógica diaria, enlace ROM/RAM, estilos, licencias y recursos web. `web/vendor/` contiene recursos de terceros versionados que también se pueden recrear con `fetch-vendor.sh`.
- `scripts/`: instalación de toolchain, descarga del código base, aplicación/guardado del parche, compilación, vendor y servidor estático.
- `patches/pokefirered-dailyred.patch`: fuente versionada de los cambios del motor.
- `pokefirered/`: checkout local generado desde pret/pokefirered; está sin seguimiento y no debe reemplazarse si contiene trabajo.
- `tests/`: validación independiente de datos de equipos y pruebas de navegador con la ROM real.
- `docs/`: instrucciones de instalación y descripción técnica.

Daily Gold se basa en el código y concepto de [Daily Red](https://github.com/amoi-builds/dailyred) y obtiene el motor desde [pret/pokefirered](https://github.com/pret/pokefirered). Los nombres internos `DailyRed_*`, `dailyred-*` de símbolos de ROM, rutas y constantes son heredados y necesarios para compatibilidad; no los renombres como limpieza estética.

## Preparar una máquina

Sigue primero [README.md](README.md) y [docs/INSTALL.md](docs/INSTALL.md). Requisitos: Node.js 18+, Git; en macOS Xcode Command Line Tools; en Linux/WSL Bash, make, compilador C, Python 3, curl, tar, gzip, unzip, awk y sha256sum; en Windows nativo, MSYS2 UCRT64 y `scripts/setup-windows.sh`. El build Windows se ha comprobado desde un entorno MSYS2 ya instalado; la instalación MSYS2 desde cero sigue pendiente. Para las pruebas: dependencias Playwright de `tests/` y Chrome/Chromium instalado.

Desde clon limpio:

```sh
# macOS: bash scripts/setup-macos.sh
# Linux/WSL: bash scripts/setup-linux.sh
# Windows MSYS2 UCRT64: bash scripts/setup-windows.sh
bash scripts/get-pokefirered.sh
bash scripts/fetch-vendor.sh
bash scripts/build-rom.sh
node scripts/serve.mjs
```

Abre `http://localhost:8080`. `get-pokefirered.sh` se niega a sobrescribir una carpeta existente. Antes de reintentar, inspecciona y conserva todo trabajo local.

## Guardar cambios del motor

No modifiques directamente el repositorio original Daily Red ni publiques cambios a pret/pokefirered. El motor de juego es el clon local de pret/pokefirered. Sus modificaciones se guardan en `patches/pokefirered-dailyred.patch` con `bash scripts/save-patch.sh`; revisa el diff y el parche antes de versionarlos. Los binarios `.gba`, `.gba.gz`, `.elf`, `.map`, `.sym`, `.toolchain/`, `web/vendor/` y productos de prueba son generados.

## Invariantes importantes

- No modificar el generador aleatorio, sus semillas, la selección de equipo ni los algoritmos de IV/EV/naturalezas sin autorización explícita del usuario.
- No alterar las mecánicas de tercera generación.
- No reconstruir ni rediseñar el equipo de Oro. Sus detalles están en `docs/TECHNICAL.md` y `src/dailyred_boss.c` dentro del checkout local. Mantener Ho-Oh Seria, Umbreon Persecución y Ampharos Pantalla Luz con 252 PS / 252 At. Esp. / 6 Def. Esp.
- No sobrescribir cambios de colaboradores, archivos sin seguimiento ni el checkout local `pokefirered/`. Inspecciona `git status` antes y después.
- No tocar `main`, no reescribir historial ni hacer push/merge sin autorización.
- Conservar movimientos de nivel, MT/MO, tutor y huevo. Las pruebas deben obtenerlos de los datos de FireRed por una ruta independiente del generador y rechazar movimientos desconocidos.
- No afirmar compatibilidad o éxito sin ejecutar realmente la compilación/prueba relevante. Distingue lo probado de lo pendiente.
- No distribuir una ROM compilada. Mantener la atribución, las licencias y los hashes de dependencias.
- Las estadísticas nuevas usan `dailygold-stats`; no borrar ni migrar la clave antigua `dailyred-stats`.

## Construcción, servidor y pruebas

- macOS: `bash scripts/setup-macos.sh`; Linux/WSL: `bash scripts/setup-linux.sh`.
- Checkout fijado + parches: `bash scripts/get-pokefirered.sh`.
- Recursos del navegador: `bash scripts/fetch-vendor.sh`.
- Motor y ROM: `bash scripts/build-rom.sh`; solo recompilar si los cambios requieren motor.
- Servidor: `node scripts/serve.mjs [puerto]`.
- Pruebas: `cd tests && npm install && npm run smoke && npm run site`; validar semillas con `npm run teams -- 1 2 3` o `npm run teams -- --random 40`. Requieren ROM, vendor y Chrome.
- El lector ELF busca `arm-none-eabi-nm` o `arm-none-eabi-nm.exe` en `.toolchain/arm-none-eabi/bin`, y después en `PATH`; para instalaciones externas admite `ARM_NM=/ruta/a/arm-none-eabi-nm`.

## Diagnóstico

- Toolchain ausente: setup del sistema correcto.
- Checkout existente: detenerse; revisar/guardar trabajo antes de apartarlo. Nunca borrar a ciegas.
- Fallo de checksum o descarga: comprobar conexión y repetir el paso; no desactivar hashes.
- ROM o vendor ausentes: ejecutar `fetch-vendor.sh` y `build-rom.sh`.
- Puerto ocupado: pasar otro, por ejemplo `node scripts/serve.mjs 8081`.
- Pruebas sin Chrome: instalar Chrome/Chromium y configurar `CHROME_PATH` si es necesario.
- Consulta `docs/INSTALL.md` para más casos.
