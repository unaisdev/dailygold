// Escribe la configuración de la partida en la ROM de Daily Gold antes de iniciarla.
//
// El juego conserva una estructura pequeña en la ROM (gDailyRedRomConfig en
// pokefirered/src/dailyred.c): la marca de 16 bytes «DAILYRED-CONF-V2», seguida
// de semilla u32, victorias u16, combates u16 y modo diario u8 en little-endian.
// La marca evita fijar direcciones. Una semilla distinta de cero omite el título
// y genera el equipo a partir de ella.

const MAGIC = new TextEncoder().encode('DAILYRED-CONF-V2');

export function findConfigOffset(rom) {
  const first = MAGIC[0];
  outer: for (let i = rom.indexOf(first); i !== -1; i = rom.indexOf(first, i + 1)) {
    for (let j = 1; j < MAGIC.length; j++) {
      if (rom[i + j] !== MAGIC[j]) continue outer;
    }
    return i + MAGIC.length;
  }
  return -1;
}

// Devuelve una copia modificada de `rom` (Uint8Array); no altera el original.
//   seed     semilla del equipo distinta de cero
//   wins     victorias previas del jugador (aparecen en el récord del juego)
//   battles  combates previos
//   daily    true para el modo diario: un combate y fin de la partida
export function injectConfig(rom, { seed, wins = 0, battles = 0, daily = false }) {
  const offset = findConfigOffset(rom);
  if (offset < 0) throw new Error('Esta ROM no contiene la configuración de Daily Gold. Vuelve a compilarla con scripts/build-rom.sh.');
  const patched = rom.slice();
  const view = new DataView(patched.buffer);
  view.setUint32(offset, seed >>> 0, true);
  view.setUint16(offset + 4, Math.min(wins, 0xFFFF), true);
  view.setUint16(offset + 6, Math.min(battles, 0xFFFF), true);
  view.setUint8(offset + 8, daily ? 1 : 0);
  return patched;
}

// Interpreta una semilla introducida por el jugador, por ejemplo ?seed=1234.
// Devuelve null si no es válida.
export function parseSeed(text) {
  if (text == null || !/^\d{1,10}$/.test(String(text).trim())) return null;
  const seed = Number(text);
  return seed >= 1 && seed <= 0xFFFFFFFF ? seed : null;
}
