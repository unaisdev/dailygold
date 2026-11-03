#!/usr/bin/env bash
# Install the pinned ARM GCC and a project-local libpng build on Linux.
# First install the host prerequisites listed in README.md / docs/INSTALL.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TC="$ROOT/.toolchain"
mkdir -p "$TC/downloads"
GCC_VER="14.2.1-1.1"
LIBPNG_VER="1.6.44"

case "$(uname -m)" in
  x86_64) GCC_HOST="linux-x64" ;;
  aarch64|arm64) GCC_HOST="linux-arm64" ;;
  *) echo "Unsupported Linux CPU: $(uname -m)"; exit 1 ;;
esac

if [ ! -x "$TC/arm-none-eabi/bin/arm-none-eabi-gcc" ]; then
  name="xpack-arm-none-eabi-gcc-$GCC_VER"
  archive="$name-$GCC_HOST.tar.gz"
  url="https://github.com/xpack-dev-tools/arm-none-eabi-gcc-xpack/releases/download/v$GCC_VER/$archive"
  curl -fL --retry 3 -o "$TC/downloads/$archive" "$url"
  curl -fsL -o "$TC/downloads/$archive.sha" "$url.sha"
  expected="$(awk '{print $1}' "$TC/downloads/$archive.sha")"
  actual="$(sha256sum "$TC/downloads/$archive" | awk '{print $1}')"
  [ "$expected" = "$actual" ] || { echo "Checksum mismatch: $archive"; exit 1; }
  tar -xzf "$TC/downloads/$archive" -C "$TC"
  ln -s "$name" "$TC/arm-none-eabi"
  rm -f "$TC/downloads/$archive"
fi
"$TC/arm-none-eabi/bin/arm-none-eabi-gcc" --version | head -1

if [ ! -f "$TC/libpng/lib/libpng.a" ]; then
  src="$TC/downloads/libpng-$LIBPNG_VER"
  curl -fL --retry 3 -o "$TC/downloads/libpng-$LIBPNG_VER.tar.gz" \
    "https://github.com/pnggroup/libpng/archive/refs/tags/v$LIBPNG_VER.tar.gz"
  tar -xzf "$TC/downloads/libpng-$LIBPNG_VER.tar.gz" -C "$TC/downloads"
  cp "$src/scripts/pnglibconf.h.prebuilt" "$src/pnglibconf.h"
  mkdir -p "$TC/libpng/include" "$TC/libpng/lib" "$src/obj"
  for f in png pngerror pngget pngmem pngpread pngread pngrio pngrtran pngrutil \
           pngset pngtrans pngwio pngwrite pngwtran pngwutil; do
    cc -O2 -DPNG_ARM_NEON_OPT=0 -DPNG_INTEL_SSE_OPT=0 -I"$src" -c "$src/$f.c" -o "$src/obj/$f.o"
  done
  ar rcs "$TC/libpng/lib/libpng.a" "$src"/obj/*.o
  cp "$src/png.h" "$src/pngconf.h" "$src/pnglibconf.h" "$TC/libpng/include/"
fi
echo "Toolchain ready. Build with: bash scripts/build-rom.sh"
