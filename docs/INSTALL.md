# Instalación y reconstrucción

Este procedimiento parte de un clon limpio. La ROM no está en Git: `get-pokefirered.sh` obtiene el código abierto en el commit fijado por el proyecto, aplica `patches/pokefirered-dailyred.patch`, y `build-rom.sh` compila localmente y crea `web/game/dailyred.gba.gz`. `fetch-vendor.sh` obtiene versiones fijadas de las dependencias web y comprueba sus hashes.

## Dependencias del sistema

- macOS: Git, Node.js 18+, Xcode Command Line Tools, Bash, `curl`, `tar`, `gzip` y `shasum`. Las herramientas de Apple se instalan con `xcode-select --install`.
- Linux y WSL/Ubuntu: Git, Node.js 18+, Python 3, Bash, `make`, compilador C, `ar`, `curl`, `tar`, `gzip`, `unzip`, `awk` y `sha256sum`. En Ubuntu: `sudo apt install build-essential git curl tar gzip unzip python3 nodejs npm`.
- Windows nativo: MSYS2 instalado desde su sitio oficial, terminal UCRT64 y paquetes que prepara `setup-windows.sh`.
- Chrome/Chromium instalado es necesario para las pruebas Playwright; el runner usa Chrome instalado, no descarga uno.

## macOS

Desde Terminal:

```sh
git clone https://github.com/unaisdev/dailygold.git
cd dailygold
xcode-select --install  # omítelo si las Command Line Tools ya están instaladas
bash scripts/setup-macos.sh
bash scripts/get-pokefirered.sh
bash scripts/fetch-vendor.sh
bash scripts/build-rom.sh
node scripts/serve.mjs
```

La primera compilación crea el toolchain y las dependencias en `.toolchain/`, `pokefirered/`, `web/vendor/` y `web/game/`. La carpeta `.toolchain/` no se comparte ni se sube a Git.

## Linux y Windows con WSL 2

En Ubuntu/WSL 2, coloca el proyecto bajo el directorio Linux (por ejemplo `~/src`) y ejecuta:

```sh
sudo apt update
sudo apt install -y build-essential git curl tar gzip unzip python3 nodejs npm
mkdir -p ~/src && cd ~/src
git clone https://github.com/unaisdev/dailygold.git
cd dailygold
bash scripts/setup-linux.sh
bash scripts/get-pokefirered.sh
bash scripts/fetch-vendor.sh
bash scripts/build-rom.sh
node scripts/serve.mjs
```

Abre `http://localhost:8080` en el navegador del anfitrión. Para otra distribución instala paquetes equivalentes. `setup-linux.sh` reconoce Linux x86-64 y ARM64; la compatibilidad de otras arquitecturas no se ha comprobado.

## Windows nativo con MSYS2

Instala MSYS2 desde <https://www.msys2.org/> usando la ruta predeterminada `C:\msys64`, actualízalo según su guía, instala Node.js 18+ desde <https://nodejs.org/> y abre **MSYS2 UCRT64**. Ejecuta los pasos desde esa terminal (no PowerShell ni Git Bash), en un directorio de usuario sin espacios:

```sh
pacman -S --needed git
mkdir -p ~/src && cd ~/src
git clone https://github.com/unaisdev/dailygold.git
cd dailygold
bash scripts/setup-windows.sh
bash scripts/get-pokefirered.sh
bash scripts/fetch-vendor.sh
bash scripts/build-rom.sh
node scripts/serve.mjs
```

El instalador `setup-windows.sh` instala dependencias MSYS2, descarga el toolchain Windows x64 fijado con SHA-256 y construye libpng localmente. El build completo de la ROM sí se ha comprobado en este equipo con una instalación MSYS2 preexistente; el bootstrap desde la descarga limpia de MSYS2 y el toolchain fijado está implementado, pero pendiente de prueba completa.

## Compilar de nuevo y servir

Con el clon preparado, los cambios de la web no requieren compilación. Reinicia el servidor con `Ctrl+C` y `node scripts/serve.mjs`. Para reconstruir el motor ejecuta `bash scripts/build-rom.sh` y recarga el navegador. Los argumentos opcionales se pasan a `make`, por ejemplo `bash scripts/build-rom.sh clean`.

No ejecutes `get-pokefirered.sh` sobre una carpeta `pokefirered/` existente: se detiene deliberadamente para proteger el trabajo local. Para empezar desde una carpeta limpia, conserva primero cualquier trabajo propio y aparta la carpeta existente fuera del repositorio.

## Solo ejecutar el sitio

El servidor estático no tiene dependencias de Node aparte del propio runtime:

```sh
node scripts/serve.mjs [puerto]
```

El valor predeterminado es 8080. La ejecución necesita `web/game/dailyred.gba.gz`, generado localmente; los recursos `web/vendor/` sí están versionados. `fetch-vendor.sh` permite reconstruirlos a partir de las versiones y hashes fijados.

## Pruebas

```sh
cd tests
npm install
npm run smoke
npm run site
npm run teams -- 1 2 3
npm run teams -- --random 40
```

`smoke` y `site` necesitan la ROM generada, los recursos `web/vendor/` (incluidos en Git) y Google Chrome instalado. `teams` inicia el juego real para cada semilla y valida los datos de equipo. `npm test` ejecuta reglas, smoke y site en secuencia. Las pruebas escriben capturas en `tests/output/`, ignorado por Git.

## Errores habituales

- **`Toolchain missing`:** ejecuta el setup correcto para macOS o Linux/WSL.
- **`arm-none-eabi-nm was not found`:** instala el toolchain del sistema. El runner busca `arm-none-eabi-nm` y `arm-none-eabi-nm.exe` dentro de `.toolchain/arm-none-eabi/bin` antes de `PATH`; también puedes definir `ARM_NM` con la ruta completa de un ejecutable compatible.
- **`pokefirered/ already exists`:** el descargador protege la carpeta. No la borres sin revisar antes su estado; guarda el trabajo local y apártala, luego vuelve a ejecutar el descargador.
- **`Checksum mismatch`:** elimina solo el archivo descargado incompleto indicado por el error y repite el paso con conexión estable. No desactives la comprobación del hash.
- **No se puede descargar:** comprueba que la red permite GitHub, npm registry, jsDelivr y Google Fonts; luego repite el paso.
- **`No such file ... dailyred.gba.gz` o pantalla de error:** ejecuta `build-rom.sh`; la ROM se genera localmente y se ignora en Git. Si faltan recursos de `web/vendor/`, ejecuta `fetch-vendor.sh`.
- **Puerto ocupado:** usa `node scripts/serve.mjs 8081` y abre `http://localhost:8081`.
- **Chrome no encontrado en las pruebas:** instala Chrome/Chromium y establece `CHROME_PATH` si está en una ubicación no estándar.
- **Node anterior a 18:** actualiza Node antes de instalar las dependencias de pruebas.

## Estado de compatibilidad observado

Windows 11/MSYS2 UCRT64: compilación limpia del código fuente, empaquetado de ROM, servidor local y prueba web completa se han ejecutado en una instalación existente. El setup desde MSYS2 recién instalado aún requiere confirmación. macOS y Linux/WSL tienen instrucciones, pero no se han reconstruido en esta verificación. Windows nativo significa MSYS2 sobre Windows, sin WSL ni Ubuntu; no significa compilación desde PowerShell puro.
