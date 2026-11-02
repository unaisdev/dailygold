// Descarga la ROM y el núcleo del emulador una vez por visita y los conserva
// en memoria; las partidas siguientes solo tienen que reiniciar el emulador.

const FILES = {
  rom: 'game/dailyred.gba.gz',
  coreJs: 'vendor/mgba_libretro.js',
  coreWasm: 'vendor/mgba_libretro.wasm',
};

let cached = null;

// onProgress(bytesDescargados, bytesTotales); el total es 0 si se desconoce.
export function loadGameFiles(onProgress = () => {}) {
  cached ??= download(onProgress).catch((err) => {
    cached = null; // permite reintentar
    throw err;
  });
  return cached;
}

async function download(onProgress) {
  const responses = await Promise.all(Object.values(FILES).map(async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo descargar ${url} (HTTP ${res.status}).`);
    return res;
  }));

  // Content-Length solo es válido si el servidor no volvió a codificar el archivo.
  const sizes = responses.map((r) => (r.headers.get('Content-Encoding') ? 0 : Number(r.headers.get('Content-Length')) || 0));
  const total = sizes.every(Boolean) ? sizes.reduce((a, b) => a + b, 0) : 0;
  let loaded = 0;
  const report = (n) => { loaded += n; onProgress(loaded, total); };

  const [romGz, coreJs, coreWasm] = await Promise.all(responses.map((res) => readAll(res, report)));
  return {
    rom: await gunzip(romGz),
    coreJs: new Blob([coreJs], { type: 'text/javascript' }),
    coreWasm: new Blob([coreWasm], { type: 'application/wasm' }),
  };
}

async function readAll(res, report) {
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    report(value.length);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

async function gunzip(bytes) {
  // Algunos servidores envían .gz con Content-Encoding: gzip; en ese caso el
  // navegador ya lo ha descomprimido.
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
