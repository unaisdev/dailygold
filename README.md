# Daily Gold

Daily Gold es un desafío diario de Pokémon para jugar en el navegador. Cada día recibes un equipo aleatorio de seis Pokémon de nivel 100 y tienes un único intento para enfrentarte a **Oro (Ethan)**. También puedes abrir partidas de práctica con una semilla.

El combate usa el motor de Pokémon FireRed y sus mecánicas de tercera generación. El navegador ejecuta una ROM compilada localmente con el motor mGBA; JavaScript no simula el combate. Daily Gold parte de la decompilación comunitaria [pret/pokefirered](https://github.com/pret/pokefirered) y del proyecto [Daily Red](https://github.com/amoi-builds/dailyred).

## Requisitos

- Git y Node.js 18 o posterior.
- macOS con Xcode Command Line Tools; o Linux/Ubuntu con compilador C, `make`, `curl`, `tar`, `unzip`, `python3` y `git`.
- En Windows, MSYS2 con el entorno **UCRT64** para compilar de forma nativa. La compilación se ha probado desde un MSYS2 ya preparado; el bootstrap completo en una instalación limpia aún está pendiente de verificación.
- Chrome/Chromium para ejecutar las pruebas de navegador. Para jugar basta un navegador moderno.
- Espacio libre para el código de FireRed, el toolchain ARM y las dependencias web (aproximadamente 1 GB).

No se distribuye una ROM compilada. Cada persona la genera en su ordenador desde las fuentes.

## Instalar y jugar

### macOS

Instala las herramientas de Apple una vez y clona el repositorio:

```sh
xcode-select --install
git clone https://github.com/unaisdev/dailygold.git
cd dailygold
bash scripts/setup-macos.sh
bash scripts/get-pokefirered.sh
bash scripts/fetch-vendor.sh
bash scripts/build-rom.sh
node scripts/serve.mjs
```

Abre <http://localhost:8080>. `setup-macos.sh` instala las herramientas de compilación dentro de `.toolchain/`; no requiere Homebrew. En Mac Intel y Apple Silicon se selecciona el compilador correspondiente.

### Windows nativo con MSYS2 UCRT64

Instala MSYS2 desde <https://www.msys2.org/> con su ruta predeterminada y Node.js 18 o posterior desde <https://nodejs.org/>. Abre **MSYS2 UCRT64**, actualiza MSYS2 según su guía y prepara Git antes de clonar. No uses PowerShell, Git Bash ni la consola MSYS para compilar.

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

Abre <http://localhost:8080> en Windows. El script instala los paquetes de compilación MSYS2 y el toolchain ARM fijado. La primera instalación limpia de MSYS2 con este procedimiento todavía necesita una prueba completa.

### Windows con WSL 2 / Ubuntu

Instala WSL 2 y Ubuntu desde Windows; abre la terminal Ubuntu. Guarda el clon dentro del sistema de archivos de Linux (por ejemplo, `~/src`) para evitar problemas de rendimiento y permisos:

```sh
sudo apt update
sudo apt install -y build-essential git curl tar unzip python3 nodejs npm
mkdir -p ~/src && cd ~/src
git clone https://github.com/unaisdev/dailygold.git
cd dailygold
bash scripts/setup-linux.sh
bash scripts/get-pokefirered.sh
bash scripts/fetch-vendor.sh
bash scripts/build-rom.sh
node scripts/serve.mjs
```

Abre <http://localhost:8080> desde Windows. WSL reenvía el puerto local al navegador de Windows. Si la versión de Node.js de Ubuntu es anterior a 18, instala una versión actual de Node.js antes de continuar.

### Linux

En Ubuntu/Debian instala los paquetes indicados en el bloque de WSL y sigue los mismos pasos, desde `git clone` en adelante. En otras distribuciones instala sus equivalentes de Git, Node.js 18+, Python 3, `make`, compilador C, `curl`, `tar` y `unzip`. El script de toolchain está preparado para Linux x86-64 y ARM64; otras arquitecturas no están comprobadas.

## Ejecutar solo el sitio local

Para ejecutar una copia de desarrollo que ya tenga la ROM generada, no hace falta volver a compilar: desde la raíz del repositorio ejecuta el servidor. `web/vendor/` está incluido en Git; la ROM local no.

```sh
node scripts/serve.mjs
```

Abre <http://localhost:8080>. En un clon nuevo, sigue la instalación del sistema operativo para descargar el código del motor y crear la ROM. Si faltan los recursos web de terceros, `bash scripts/fetch-vendor.sh` los restaura con versiones fijadas.

## Documentación técnica

- [Instalación, reconstrucción y solución de problemas](docs/INSTALL.md)
- [Arquitectura, motor, generación y equipo de Oro](docs/TECHNICAL.md)
- [Instrucciones para Codex y otros asistentes](AGENTS.md)
- [Licencias y atribuciones de terceros](web/licenses.txt)

## Créditos y licencias

Daily Gold es un proyecto de fans gratuito y no oficial. Pokémon y sus contenidos pertenecen a sus titulares. Daily Gold atribuye el proyecto original a [Daily Red](https://github.com/amoi-builds/dailyred), y usa fuentes de [pret/pokefirered](https://github.com/pret/pokefirered). Las licencias de Nostalgist, mGBA/RetroArch y Pixelify Sans están enumeradas en [`web/licenses.txt`](web/licenses.txt). No se incluye ni distribuye una ROM de Pokémon FireRed.
