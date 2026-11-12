#!/usr/bin/env node
// Builds assets for the past-teams archive UI:
//   - web/game/icons/<speciesId>.png  (party menu icons from the decomp)
//   - web/game/symbols.json           (gPlayerParty addresses from the ELF)
//   - web/archive-data.js             (move / item / ability / species tables)
//
// Run after scripts/build-rom.sh (needs the ELF for symbols).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseStatTotal, SPECIES } from '../tests/party.mjs';

// Party-menu icons are two 32×32 frames stacked (32×64). Keep only the top frame.
// Prefer ffmpeg: `sips -c` crops from the centre and would mix both frames.
function cropIconTopFrame(src, dst) {
  try {
    execFileSync('ffmpeg', [
      '-y', '-i', src,
      '-vf', 'crop=32:32:0:0,format=rgba',
      '-frames:v', '1', '-update', '1', dst,
    ], { stdio: 'pipe' });
    return true;
  } catch {
    try {
      // ImageMagick, if present.
      execFileSync('convert', [src, '-crop', '32x32+0+0', '+repage', dst], { stdio: 'pipe' });
      return true;
    } catch {
      copyFileSync(src, dst);
      return false;
    }
  }
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = join(ROOT, 'pokefirered');
const ELF = join(GAME, 'pokefirered_modern.elf');
const NUM_SPECIES = 412;
const NM = join(ROOT, '.toolchain/arm-none-eabi/bin/arm-none-eabi-nm');

function readConstants(file, prefix) {
  const names = [];
  const text = readFileSync(join(GAME, file), 'utf8');
  let max = 0;
  for (const m of text.matchAll(new RegExp(`^#define ${prefix}(\\w+)\\s+(\\d+)\\b`, 'gm'))) {
    const id = Number(m[2]);
    names[id] = m[1];
    if (id > max) max = id;
  }
  for (let i = 0; i <= max; i++) names[i] ??= null;
  return names;
}

function fireRedOnly(text) {
  const out = [];
  const stack = [];
  for (const line of text.split('\n')) {
    const directive = line.match(/^\s*#\s*(if|ifdef|elif|else|endif)\b(.*)/);
    if (!directive) {
      if (stack.every(Boolean)) out.push(line);
      continue;
    }
    const [, kind, rest] = directive;
    const cond = rest.includes('FIRERED') ? true : rest.includes('LEAFGREEN') ? false : true;
    if (kind === 'if' || kind === 'ifdef') stack.push(cond);
    else if (kind === 'elif') stack[stack.length - 1] = cond;
    else if (kind === 'else') stack[stack.length - 1] = !stack[stack.length - 1];
    else if (kind === 'endif') stack.pop();
  }
  return out.join('\n');
}

function readAbilities() {
  const abilityNames = readConstants('include/constants/abilities.h', 'ABILITY_');
  const text = fireRedOnly(readFileSync(join(GAME, 'src/data/pokemon/species_info.h'), 'utf8'));
  const ids = new Map([...SPECIES].map(([id, name]) => [name, id]));
  for (const m of readFileSync(join(GAME, 'include/constants/species.h'), 'utf8').matchAll(/^#define SPECIES_(\w+)\s+(\d+)\b/gm)) {
    ids.set(m[1], Number(m[2]));
  }
  const abilities = Array.from({ length: NUM_SPECIES }, () => [0, 0]);
  for (const chunk of text.split('[SPECIES_').slice(1)) {
    const name = chunk.split(']')[0];
    const id = ids.get(name);
    if (id == null) continue;
    const match = chunk.match(/\.abilities\s*=\s*\{([^}]+)\}/);
    if (!match) continue;
    const abs = [...match[1].matchAll(/ABILITY_(\w+)/g)].map((m) => {
      const idx = abilityNames.indexOf(m[1]);
      return idx >= 0 ? idx : 0;
    });
    abilities[id] = [abs[0] || 0, abs[1] || 0];
  }
  return { abilityNames, abilities };
}

function readSymbols() {
  if (!existsSync(ELF)) {
    throw new Error(`Missing ${ELF}. Run scripts/build-rom.sh first.`);
  }
  const nm = existsSync(NM) ? NM : 'arm-none-eabi-nm';
  const out = execFileSync(nm, [ELF], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const wanted = ['gPlayerParty', 'gPlayerPartyCount'];
  const symbols = {};
  for (const line of out.split('\n')) {
    const [addr, , name] = line.trim().split(/\s+/);
    if (wanted.includes(name)) symbols[name] = parseInt(addr, 16);
  }
  for (const name of wanted) {
    if (!symbols[name]) throw new Error(`Symbol ${name} not found in ELF`);
  }
  return symbols;
}

function copyIcons() {
  const dir = join(ROOT, 'web/game/icons');
  mkdirSync(dir, { recursive: true });
  let copied = 0;
  let missing = 0;
  for (let id = 1; id < NUM_SPECIES; id++) {
    if (id >= 252 && id <= 276) continue;
    const key = SPECIES.get(id);
    if (!key) continue;
    let src = join(GAME, 'graphics/pokemon', key.toLowerCase(), 'icon.png');
    if (!existsSync(src) && key === 'UNOWN') {
      src = join(GAME, 'graphics/pokemon/unown', 'a', 'icon.png');
      if (!existsSync(src)) src = join(GAME, 'graphics/pokemon/unown', 'icon.png');
    }
    const dst = join(dir, `${id}.png`);
    if (existsSync(src)) {
      cropIconTopFrame(src, dst);
      copied++;
    } else {
      missing++;
    }
  }
  return { copied, missing };
}

const moveNames = readConstants('include/constants/moves.h', 'MOVE_');
const itemNames = readConstants('include/constants/items.h', 'ITEM_');
const { abilityNames, abilities } = readAbilities();

const speciesNames = new Array(NUM_SPECIES).fill('');
const totals = new Array(NUM_SPECIES).fill(0);
for (let id = 1; id < NUM_SPECIES; id++) {
  speciesNames[id] = SPECIES.get(id) ?? `SPECIES_${id}`;
  try { totals[id] = baseStatTotal(id); } catch { totals[id] = 0; }
}

const symbols = readSymbols();
writeFileSync(join(ROOT, 'web/game/symbols.json'), `${JSON.stringify(symbols, null, 2)}\n`);

const icons = copyIcons();

const archiveData = `// Auto-generated by scripts/gen-archive-assets.mjs — do not edit by hand.
export const NUM_SPECIES = ${NUM_SPECIES};
export const BASE_STAT_TOTALS = ${JSON.stringify(totals)};
export const SPECIES_NAMES = ${JSON.stringify(speciesNames)};
export const MOVE_NAMES = ${JSON.stringify(moveNames)};
export const ITEM_NAMES = ${JSON.stringify(itemNames)};
export const ABILITY_NAMES = ${JSON.stringify(abilityNames)};
export const SPECIES_ABILITIES = ${JSON.stringify(abilities)};
`;

writeFileSync(join(ROOT, 'web/archive-data.js'), archiveData);
// Keep the lighter species-only module in sync for the species preview helper.
writeFileSync(join(ROOT, 'web/team-preview-data.js'), `// Auto-generated by scripts/gen-archive-assets.mjs — do not edit by hand.
export const NUM_SPECIES = ${NUM_SPECIES};
export const BASE_STAT_TOTALS = ${JSON.stringify(totals)};
export const SPECIES_NAMES = ${JSON.stringify(speciesNames)};
`);

console.log(`symbols → web/game/symbols.json (${Object.keys(symbols).join(', ')})`);
console.log(`icons   → web/game/icons/ (${icons.copied} copied, ${icons.missing} missing)`);
console.log('data    → web/archive-data.js + web/team-preview-data.js');
