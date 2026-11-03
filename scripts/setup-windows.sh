#!/usr/bin/env bash
# Native Windows build prerequisites. Run inside an MSYS2 UCRT64 terminal.
# Install MSYS2 itself from https://www.msys2.org/ before running this script.
set -euo pipefail

if [ "${MSYSTEM:-}" != "UCRT64" ]; then
  echo "Open the MSYS2 UCRT64 terminal and run: bash scripts/setup-windows.sh"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
TC=".toolchain"
mkdir -p "$TC/downloads"
export PATH="/ucrt64/bin:/usr/bin:$PATH"

echo ">> Installing MSYS2 build dependencies"
pacman -S --needed --noconfirm base-devel git curl python unzip \
  mingw-w64-ucrt-x86_64-gcc

GCC_VER="14.2.1-1.1"
LIBPNG_VER="1.6.44"
GCC_NAME="xpack-arm-none-eabi-gcc-$GCC_VER-win32-x64"
if [ ! -x "$TC/arm-none-eabi/bin/arm-none-eabi-gcc.exe" ]; then
  archive="$GCC_NAME.zip"
  url="https://github.com/xpack-dev-tools/arm-none-eabi-gcc-xpack/releases/download/v$GCC_VER/$archive"
  curl -fL --retry 3 -o "$TC/downloads/$archive" "$url"
  actual="$(sha256sum "$TC/downloads/$archive" | awk '{print $1}')"
  expected="0b2d496b383ba578182eb57b3f7d35ff510e36eda56257883b902fa07c3bba55"
  [ "$actual" = "$expected" ] || { echo "Checksum mismatch: $archive"; exit 1; }
  unzip -q "$TC/downloads/$archive" -d "$TC/downloads"
  mv "$TC/downloads/$GCC_NAME" "$TC/arm-none-eabi"
  rm -f "$TC/downloads/$archive"
fi
"$TC/arm-none-eabi/bin/arm-none-eabi-gcc.exe" --version | head -1

if [ ! -f "$TC/libpng/lib/libpng.a" ]; then
  src="$TC/downloads/libpng-$LIBPNG_VER"
  curl -fL --retry 3 -o "$TC/downloads/libpng-$LIBPNG_VER.tar.gz" \
    "https://github.com/pnggroup/libpng/archive/refs/tags/v$LIBPNG_VER.tar.gz"
  tar -xzf "$TC/downloads/libpng-$LIBPNG_VER.tar.gz" -C "$TC/downloads"
  cp "$src/scripts/pnglibconf.h.prebuilt" "$src/pnglibconf.h"
  mkdir -p "$TC/libpng/include" "$TC/libpng/lib" "$src/obj"
  for f in png pngerror pngget pngmem pngpread pngread pngrio pngrtran pngrutil \
           pngset pngtrans pngwio pngwrite pngwtran pngwutil; do
    cc -O2 -DPNG_ARM_NEON_OPT=0 -DPNG_INTEL_SSE_OPT=0 -I"$src" \
      -c "$src/$f.c" -o "$src/obj/$f.o"
  done
  ar rcs "$TC/libpng/lib/libpng.a" "$src"/obj/*.o
  cp "$src/png.h" "$src/pngconf.h" "$src/pnglibconf.h" "$TC/libpng/include/"
fi

echo "Native Windows toolchain ready. Run the source download, vendor and build scripts from this UCRT64 terminal."
