// Control de la web: tarjeta diaria (Gold y estadísticas), emulador, barra de
// herramientas y controles táctiles. El juego se ejecuta en la ROM; este archivo
// lo inicia con la semilla del día, espera el resultado y guarda las estadísticas.
import { Nostalgist } from './vendor/nostalgist.js';
import { loadGameFiles } from './game-files.js';
import { injectConfig, parseSeed } from './rom-config.js';
import { createGameLink, PHASE, RESULT } from './game-link.js';
import {
  today, addDays, dailySeed, msUntilTomorrow, loadStats, resultFor, currentStreaks,
  markBattleStarted, recordResult, settleAbandonedGame,
} from './daily.js';
import { previewTeamForSeed } from './team-preview.js';
import { loadArchiveParty, peekArchiveParty } from './archive-party.js';

const $ = (id) => document.getElementById(id);
const app = document.querySelector('.app');
const screen = $('screen');
const ui = {
  play: $('play'),
  retry: $('retry'),
  sound: $('sound'),
  soundControl: document.querySelector('.sound-control'),
  volumePanel: $('volume-panel'),
  volume: $('volume'),
  volumeValue: $('volume-value'),
  fullscreen: $('fullscreen'),
  wins: $('stat-wins'),
  losses: $('stat-losses'),
  winStreak: $('stat-win-streak'),
  dayStreak: $('stat-day-streak'),
  played: $('played'),
  playedResult: $('played-result'),
  playedNext: $('played-next'),
  practiceNote: $('practice-note'),
  loadingText: $('loading-text'),
  loadingDetail: $('loading-detail'),
  meter: $('meter'),
  errorText: $('error-text'),
  archiveDate: $('archive-date'),
  archivePreview: $('archive-preview'),
  archiveFight: $('archive-fight'),
  archiveStatus: $('archive-status'),
  archiveTeam: $('archive-team'),
};

// sessionStorage puede fallar si el navegador bloquea el almacenamiento; la web funciona sin él.
const session = {
  get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { sessionStorage.setItem(key, value); } catch { /* not remembered */ } },
};

// ?seed=123 inicia una partida de práctica: no se guardan resultados, no hay
// límite diario y el juego genera nuevos equipos después de cada combate.
let practiceSeed = parseSeed(new URLSearchParams(location.search).get('seed'));
let archiveSeed = null;

let stats = settleAbandonedGame(loadStats());
let emu = null;
let readGame = null;
let pollTimer = null;
let runDate = null;
let battleSeen = false;
// Cada visita arranca al 25%; el slider puede cambiarlo durante la partida.
let volume = 25;
let starting = false;
let titleDate = null;

// RetroArch abre un contexto Web Audio por emulador y no lo cierra. Guardamos
// los contextos para cerrarlos al salir y evitar el límite del navegador.
// Interceptamos destination con un GainNode para que el slider controle el volumen.
const audioContexts = [];
const volumeGains = [];
const NativeAudioContext = window.AudioContext;
if (NativeAudioContext) {
  window.AudioContext = class extends NativeAudioContext {
    constructor(...args) {
      super(...args);
      audioContexts.push(this);
      const realDestination = this.destination;
      const master = this.createGain();
      master.gain.value = volume / 100;
      master.connect(realDestination);
      Object.defineProperty(this, 'destination', {
        configurable: true,
        enumerable: true,
        get: () => master,
      });
      volumeGains.push(master);
    }
  };
}

function setState(state) {
  app.dataset.state = state;
  const playing = state === 'playing';
  ui.sound.disabled = !playing;
  ui.volume.disabled = !playing;
  ui.fullscreen.disabled = !playing || !document.fullscreenEnabled;
}

function applyVolume() {
  const gain = volume / 100;
  for (const node of volumeGains) {
    try { node.gain.value = gain; } catch { /* contexto cerrado */ }
  }
}

// --- Tarjeta inicial --------------------------------------------------------------

function renderTitle() {
  titleDate = today();
  const { winStreak, dayStreak } = currentStreaks(stats, titleDate);
  ui.wins.textContent = stats.wins;
  ui.losses.textContent = stats.losses;
  ui.winStreak.textContent = winStreak;
  ui.dayStreak.textContent = dayStreak;

  const result = practiceSeed ? null : resultFor(stats, titleDate);
  ui.play.hidden = Boolean(result);
  ui.played.hidden = !result;
  ui.practiceNote.hidden = !practiceSeed;
  if (result) ui.playedResult.textContent = result === 'won' ? '¡Hoy has derrotado a Gold!' : 'Gold ha ganado hoy.';
  updateCountdown();
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}

function updateCountdown() {
// A medianoche se desbloquea el siguiente combate: actualiza la tarjeta.
  if (titleDate !== today()) {
    renderTitle();
    syncArchiveDateBounds();
    showArchivePreview();
    return;
  }
  if (!ui.played.hidden) ui.playedNext.textContent = `Próximo combate en ${formatTime(msUntilTomorrow())}`;
}
setInterval(() => {
  if (app.dataset.state === 'title') updateCountdown();
}, 1000);

// --- Ejecución del juego -----------------------------------------------------------

const megabytes = (n) => (n / 1048576).toFixed(1);

function checkBrowser() {
  if (typeof WebAssembly !== 'object' || typeof DecompressionStream !== 'function') {
    throw new Error('Este navegador no puede ejecutar el juego. Usa una versión reciente de Chrome, Edge, Firefox o Safari.');
  }
}

function stopEmulator() {
  clearInterval(pollTimer);
  pollTimer = null;
  readGame = null;
  if (emu) {
    try {
      emu.exit();
    } catch (err) {
      console.warn('Emulator exit failed', err);
    }
    emu = null;
  }
  for (const ctx of audioContexts.splice(0)) ctx.close().catch(() => {});
  volumeGains.length = 0;
}

async function startRun() {
  if (starting) return;
  starting = true;
  try {
    checkBrowser();
    stopEmulator();
    setState('loading');
    ui.loadingText.textContent = 'Descargando el juego';
    ui.loadingDetail.textContent = '';
    const files = await loadGameFiles((loaded, total) => {
      ui.meter.style.width = total ? `${Math.min(100, (loaded / total) * 100)}%` : '50%';
      ui.loadingDetail.textContent = total ? `${megabytes(loaded)} of ${megabytes(total)} MB` : `${megabytes(loaded)} MB`;
    });

    runDate = today();
    stats = loadStats(); // another tab may have played meanwhile
    if (!practiceSeed && resultFor(stats, runDate)) {
      renderTitle();
      setState('title');
      return;
    }
    const seed = practiceSeed ?? dailySeed(runDate);
    const rom = practiceSeed
      ? injectConfig(files.rom, { seed })
      : injectConfig(files.rom, { seed, wins: stats.wins, battles: stats.wins + stats.losses, daily: true });

    ui.loadingText.textContent = 'Iniciando el emulador';
    ui.loadingDetail.textContent = '';
    ui.meter.style.width = '100%';

    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    screen.prepend(canvas);
    emu = await Nostalgist.launch({
      core: 'mgba',
      element: canvas,
      size: { width: 720, height: 480 }, // render at 3x; CSS scales it to fit
      rom: { fileName: 'dailyred.gba', fileContent: new Blob([rom]) },
      resolveCoreJs: () => files.coreJs,
      resolveCoreWasm: () => files.coreWasm,
      retroarchConfig: {
        // Volumen del juego: lo escala el GainNode del AudioContext (slider).
        audio_mute_enable: false,
        audio_volume: 0,
        // The site never makes save states itself; uncompressed ones let the
        // debugging tools in tests/ read the game's RAM.
        savestate_file_compression: false,
        savestate_thumbnail_enable: false,
        // Controles documentados en la guía (teclado ES / layout habitual).
        input_player1_a: 'x',
        input_player1_b: 'z',
        input_player1_start: 'enter',
        input_player1_select: 'rshift',
        input_player1_up: 'up',
        input_player1_down: 'down',
        input_player1_left: 'left',
        input_player1_right: 'right',
      },
    });

    readGame = createGameLink(emu, seed);
    battleSeen = false;
    pollTimer = setInterval(watchGame, 500);
    setState('playing');
    applyVolume();
    showVolume();
  } catch (err) {
    console.error(err);
    stopEmulator();
    // fetch() rejects with a TypeError when the network itself fails.
    const hint = err instanceof TypeError ? ' Comprueba tu conexión e inténtalo de nuevo.' : '';
    ui.errorText.textContent = `${err?.message || err}${hint}`;
    setState('error');
  } finally {
    starting = false;
  }
}

// Sigue el combate diario: al empezar cuenta como jugado, guarda el resultado
// en cuanto se conoce y vuelve a la tarjeta inicial al terminar.
function watchGame() {
  let status;
  try {
    status = readGame?.();
  } catch {
    return;
  }
  if (!status || practiceSeed) return;
  if (status.phase >= PHASE.BATTLE) {
    battleSeen = true;
    markBattleStarted(stats, runDate);
  } else if (battleSeen && status.result === RESULT.NONE) {
// Si el juego se reinicia durante el combate, cuenta como derrota, igual que al salir de la página.
    recordResult(stats, runDate, false);
    endDailyGame(0);
    return;
  }
  if (status.result !== RESULT.NONE) recordResult(stats, runDate, status.result === RESULT.WON);
  if (status.phase === PHASE.FINISHED) endDailyGame(1000);
}

function endDailyGame(delayMs) {
  clearInterval(pollTimer);
  pollTimer = null;
  setTimeout(() => {
    stopEmulator();
    renderTitle();
    setState('title');
  }, delayMs);
}

// --- Barra de herramientas --------------------------------------------------------

// Los botones conservan el foco tras pulsarlos y Enter equivale a Start en el
// juego. Devolvemos el foco a la página para evitar activar el botón otra vez.
function onClick(button, handler) {
  button.addEventListener('click', () => {
    button.blur();
    handler();
  });
}

onClick(ui.play, startRun);
onClick(ui.retry, startRun);

// --- Equipos pasados ----------------------------------------------------------

function latestArchiveDate() {
  // Today's team unlocks in the archive at local midnight of the next day.
  return addDays(today(), -1);
}

function selectedArchiveDate() {
  const value = ui.archiveDate?.value;
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  if (value > latestArchiveDate()) return null;
  return value;
}

function syncArchiveDateBounds() {
  if (!ui.archiveDate) return;
  const latest = latestArchiveDate();
  ui.archiveDate.max = latest;
  if (!ui.archiveDate.value || ui.archiveDate.value > latest) ui.archiveDate.value = latest;
}

function archiveTip(mon) {
  const tip = document.createElement('div');
  tip.className = 'archive-tip';
  tip.setAttribute('role', 'tooltip');

  const title = document.createElement('p');
  title.className = 'archive-tip-title';
  title.textContent = `${mon.name}${mon.shiny ? ' ✦' : ''}`;
  tip.appendChild(title);

  const meta = document.createElement('p');
  meta.className = 'archive-tip-meta';
  meta.textContent = `Nv. ${mon.level} · ${mon.nature} · ${mon.ability} · ${mon.heldItem}`;
  tip.appendChild(meta);

  const stats = document.createElement('dl');
  stats.className = 'archive-tip-stats';
  mon.statLabels.forEach((label, i) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = String(mon.stats[i]);
    stats.append(dt, dd);
  });
  tip.appendChild(stats);

  const moves = document.createElement('ol');
  moves.className = 'archive-tip-moves';
  for (const move of mon.moves) {
    const li = document.createElement('li');
    li.textContent = `${move.name} (${move.pp} PP)`;
    moves.appendChild(li);
  }
  tip.appendChild(moves);

  const ivs = document.createElement('p');
  ivs.className = 'archive-tip-ivs';
  ivs.textContent = `IV ${mon.ivs.join('/')} · EV ${mon.evs.join('/')}`;
  tip.appendChild(ivs);
  return tip;
}

function renderArchiveTeam(party) {
  const legendaryIds = new Set(
    previewTeamForSeed(archiveSeed).filter((m) => m.legendary).map((m) => m.id),
  );
  ui.archiveTeam.hidden = false;
  ui.archiveTeam.replaceChildren(...party.map((mon) => {
    const li = document.createElement('li');
    li.className = 'archive-mon';
    li.tabIndex = 0;
    if (legendaryIds.has(mon.species)) li.classList.add('is-legendary');
    if (mon.shiny) li.classList.add('is-shiny');

    const img = document.createElement('img');
    img.className = 'archive-mon-sprite';
    img.src = `game/icons/${mon.species}.png`;
    img.width = 64;
    img.height = 64;
    img.alt = mon.name;
    img.loading = 'lazy';
    img.decoding = 'async';

    const name = document.createElement('span');
    name.className = 'archive-mon-name';
    name.textContent = mon.name;

    li.append(img, name, archiveTip(mon));
    if (legendaryIds.has(mon.species)) {
      const tag = document.createElement('span');
      tag.className = 'archive-mon-tag';
      tag.textContent = 'Legendario';
      li.appendChild(tag);
    }
    return li;
  }));
}

let archiveRequest = 0;

async function showArchivePreview() {
  const date = selectedArchiveDate();
  const requestId = ++archiveRequest;
  if (!date) {
    archiveSeed = null;
    ui.archiveFight.disabled = true;
    ui.archiveTeam.hidden = true;
    ui.archiveStatus.hidden = false;
    ui.archiveStatus.textContent = 'Elige una fecha hasta ayer. El equipo de hoy solo está en el emulador.';
    return;
  }

  archiveSeed = dailySeed(date);
  ui.archiveFight.disabled = true;
  ui.archiveStatus.hidden = false;

  const statusText = `Equipo del ${date} · práctica (no cuenta para el diario). Pasa el ratón por un Pokémon para ver el summary.`;
  const cached = peekArchiveParty(archiveSeed);
  if (cached) {
    renderArchiveTeam(cached);
    ui.archiveFight.disabled = false;
    ui.archiveStatus.textContent = statusText;
    return;
  }

  ui.archiveTeam.hidden = true;
  ui.archiveStatus.textContent = 'Generando el equipo en la ROM…';
  ui.archivePreview.disabled = true;
  try {
    const party = await loadArchiveParty(archiveSeed);
    if (requestId !== archiveRequest) return;
    renderArchiveTeam(party);
    ui.archiveFight.disabled = false;
    ui.archiveStatus.textContent = statusText;
  } catch (err) {
    if (requestId !== archiveRequest) return;
    console.error(err);
    // Species-only fallback if the headless boot fails.
    const speciesOnly = previewTeamForSeed(archiveSeed).map((m) => ({
      species: m.id,
      name: m.name,
      level: 100,
      nature: '—',
      ability: '—',
      heldItem: '—',
      stats: [0, 0, 0, 0, 0, 0],
      statLabels: ['PS', 'Ataque', 'Defensa', 'Velocidad', 'At. Esp.', 'Def. Esp.'],
      moves: [],
      ivs: [],
      evs: [],
      shiny: false,
    }));
    renderArchiveTeam(speciesOnly);
    ui.archiveFight.disabled = false;
    ui.archiveStatus.textContent = `No se pudo leer el summary completo (${err?.message || err}). Mostrando especies.`;
  } finally {
    if (requestId === archiveRequest) ui.archivePreview.disabled = false;
  }
}

function fightArchiveTeam() {
  if (!archiveSeed || starting) return;
  practiceSeed = archiveSeed;
  const url = new URL(location.href);
  url.searchParams.set('seed', String(practiceSeed));
  history.replaceState(null, '', url);
  renderTitle();
  startRun();
}

function initArchive() {
  if (!ui.archiveDate) return;
  syncArchiveDateBounds();
  ui.archiveDate.addEventListener('change', () => { showArchivePreview(); });
  onClick(ui.archivePreview, () => { showArchivePreview(); });
  onClick(ui.archiveFight, fightArchiveTeam);
  showArchivePreview();
}

ui.volume.addEventListener('input', () => {
  volume = Number(ui.volume.value);
  session.set('dailyred-volume', String(volume));
  session.set('dailyred-muted', volume <= 0 ? '1' : '0');
  showVolume();
  applyVolume();
});

if (ui.soundControl) {
  ui.soundControl.addEventListener('mouseenter', () => {
    if (!ui.sound.disabled) ui.sound.setAttribute('aria-expanded', 'true');
  });
  ui.soundControl.addEventListener('mouseleave', () => {
    ui.sound.setAttribute('aria-expanded', 'false');
  });
}

function showVolume() {
  const silent = volume <= 0;
  ui.volume.value = String(volume);
  ui.volumeValue.textContent = String(volume);
  ui.sound.setAttribute('aria-pressed', String(silent));
  const on = ui.sound.querySelector('.icon-sound-on');
  const off = ui.sound.querySelector('.icon-sound-off');
  if (on) on.hidden = silent;
  if (off) off.hidden = !silent;
}

function showFullscreen() {
  const active = Boolean(document.fullscreenElement);
  ui.fullscreen.setAttribute('aria-label', active ? 'Salir de pantalla completa' : 'Pantalla completa');
  const enter = ui.fullscreen.querySelector('.icon-fs-enter');
  const exit = ui.fullscreen.querySelector('.icon-fs-exit');
  if (enter) enter.hidden = active;
  if (exit) exit.hidden = !active;
}

onClick(ui.fullscreen, () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else $('console').requestFullscreen().catch(() => {});
});

document.addEventListener('fullscreenchange', showFullscreen);

// Evita que las flechas y la barra espaciadora desplacen la página durante el juego.
window.addEventListener('keydown', (event) => {
  if (app.dataset.state === 'playing' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
    event.preventDefault();
  }
});

// Pausa el juego cuando la pestaña deja de estar visible.
document.addEventListener('visibilitychange', () => {
  if (!emu) return;
  if (document.hidden) emu.pause();
  else emu.resume();
});

// El navegador suspende el audio si no se inicia durante un clic. El emulador
// arranca después de la descarga, así que reanudamos el audio al interactuar.
function resumeAudio() {
  for (const ctx of audioContexts) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  applyVolume();
}
window.addEventListener('pointerdown', resumeAudio);
window.addEventListener('keydown', resumeAudio);

// --- Controles táctiles -----------------------------------------------------------

for (const button of document.querySelectorAll('[data-button]')) {
  const release = () => {
    if (!button.classList.contains('is-down')) return;
    button.classList.remove('is-down');
    emu?.pressUp(button.dataset.button);
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    button.classList.add('is-down');
    emu?.pressDown(button.dataset.button);
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}

// La cruceta sigue el dedo para poder deslizarse de una dirección a otra.
const dpad = document.querySelector('.dpad');
let heldDirection = null;

function setDirection(next) {
  if (next === heldDirection) return;
  if (heldDirection) emu?.pressUp(heldDirection);
  if (next) emu?.pressDown(next);
  heldDirection = next;
  dpad.dataset.dir = next ?? '';
}

function directionAt(event) {
  const box = dpad.getBoundingClientRect();
  const dx = event.clientX - (box.left + box.width / 2);
  const dy = event.clientY - (box.top + box.height / 2);
  if (Math.hypot(dx, dy) < box.width * 0.12) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

dpad.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  dpad.setPointerCapture(event.pointerId);
  setDirection(directionAt(event));
});
dpad.addEventListener('pointermove', (event) => {
  if (dpad.hasPointerCapture(event.pointerId)) setDirection(directionAt(event));
});
dpad.addEventListener('pointerup', () => setDirection(null));
dpad.addEventListener('pointercancel', () => setDirection(null));

// Acceso desde la consola para depuración y pruebas automatizadas.
window.dailyRed = {
  get emulator() { return emu; },
  get stats() { return { ...stats }; },
};

renderTitle();
setState('title');
showVolume();
showFullscreen();
ui.fullscreen.hidden = !document.fullscreenEnabled; // e.g. iPhone Safari
initArchive();
