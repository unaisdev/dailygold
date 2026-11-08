// Regression in the real ROM: Eruption must respect Flash Fire across species.
// Build first with scripts/build-rom.sh; run node tests/eruption.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GAME_DIR, startServer, launchBrowser, bootGame, waitFor, startRedBattle,
  getStatus, patchMemory, symbol, u16, press, sleep,
} from './lib.mjs';

function constant(file, name) {
  const text = readFileSync(join(GAME_DIR, 'include/constants', file), 'utf8');
  const match = text.match(new RegExp(`^#define ${name}\\s+(\\d+)\\b`, 'm'));
  assert.ok(match, name);
  return Number(match[1]);
}
const move = (name) => constant('moves.h', `MOVE_${name}`);
const ability = (name) => constant('abilities.h', `ABILITY_${name}`);
const species = (name) => constant('species.h', `SPECIES_${name}`);
const fire = constant('pokemon.h', 'TYPE_FIRE');
const attacks = ['ERUPTION', 'FIRE_BLAST', 'THUNDER_PUNCH', 'EXTRASENSORY'].map(move);
const server = await startServer();
let browser;
try {
  browser = await launchBrowser();
  const page = await browser.newPage();
  // Optional previous ROM to confirm this regression fails before the fix.
  if (process.env.ERUPTION_TEST_ROM) {
    await page.route('**/game/dailyred.gba.gz', (route) => route.fulfill({
      body: readFileSync(process.env.ERUPTION_TEST_ROM), contentType: 'application/octet-stream',
    }));
  }
  console.log('Booting ROM');
  await bootGame(page, server.url, { seed: 424242 });
  await waitFor(page, (s) => s.inOverworld, { what: 'overworld' });
  await startRedBattle(page);
  console.log('Battle started');
  await page.evaluate(async () => { window.eruptionTestState = (await window.emu.saveState()).state; });

  for (const [targetSpecies, targetAbility, seed] of [
    ['NINETALES', 'FLASH_FIRE', 1],
    ['HOUNDOOM', 'FLASH_FIRE', 42],
    ['FLAREON', 'FLASH_FIRE', 12345],
    ['TORKOAL', 'WHITE_SMOKE', 1],
  ]) {
    const name = `${targetSpecies}, ${targetAbility}, seed ${seed}`;
    await page.evaluate(async () => window.emu.loadState(window.eruptionTestState));
    await sleep(500);
    const { mem } = await getStatus(page);
    const mons = symbol('gBattleMons');
    const resources = mem.read(symbol('gBattleResources'), 4).readUInt32LE();
    const ai = mem.read(resources + 20, 4).readUInt32LE();
    const history = mem.read(resources + 24, 4).readUInt32LE();
    const rng = Buffer.alloc(4); rng.writeUInt32LE(seed);
    const writes = [];
    const set = (addr, bytes) => writes.push({ addr, bytes: [...bytes] });
    for (const [battler, monSpecies, stats, monAbility] of [
      [0, species(targetSpecies), [188, 186, 200, 198, 236], ability(targetAbility)],
      [1, species('TYPHLOSION'), [183, 192, 328, 317, 206], ability('FLASH_FIRE')],
    ]) {
      const base = mons + battler * 0x58;
      set(base, u16(monSpecies));
      stats.forEach((stat, i) => set(base + 2 + i * 2, u16(stat)));
      set(base + 0x18, Array(8).fill(6));
      const dark = constant('pokemon.h', 'TYPE_DARK');
      set(base + 0x20, [monAbility, fire, battler === 0 && targetSpecies === 'HOUNDOOM' ? dark : fire, 0]);
      set(base + 0x24, [10, 10, 10, 10]);
      set(base + 0x28, u16(300));
      set(base + 0x2a, [100, 255]);
      set(base + 0x2c, u16(300));
      set(base + 0x2e, u16(0));
      set(base + 0x4c, Array(8).fill(0));
    }
    set(mons + 0x0c, ['GROWL', 'GROWL', 'GROWL', 'GROWL'].flatMap((n) => u16(move(n))));
    set(mons + 0x58 + 0x0c, attacks.flatMap(u16));
    // No reserve can switch in; this test isolates move evaluation.
    for (let i = 0; i < 6; i++) set(symbol('gEnemyParty') + i * 100 + 86, u16(0));
    set(history + 0x20, [ability(targetAbility), 0]);
    set(symbol('gRngValue'), rng);
    await patchMemory(page, writes);
    await press(page, 'a'); // FIGHT.
    await sleep(1000);
    await press(page, 'a'); // Choose Growl; the opponent now evaluates its moves.
    await sleep(1500);
    const after = (await getStatus(page)).mem;
    const scores = [...after.read(ai + 4, 4)].map((n) => n > 127 ? n - 256 : n);
    console.log(name, 'scores:', scores);
    if (targetAbility === 'FLASH_FIRE') {
      assert.ok(scores[0] < Math.max(scores[2], scores[3]), 'Eruption loses to useful alternatives');
      assert.ok(scores[1] < Math.max(scores[2], scores[3]), 'Fire Blast remains penalized');
    } else {
      assert.ok(scores[0] > 90, 'Eruption does not receive the immunity penalty');
      assert.ok(scores[1] > 90, 'Fire Blast does not receive the immunity penalty');
    }
    const chosen = (await getStatus(page)).mem.read(symbol('gChosenMoveByBattler') + 2, 2).readUInt16LE();
    console.log(name, 'chosen:', chosen);
    assert.ok(attacks.includes(chosen), 'opponent chose one of Typhlosion\'s attacks');
    if (targetAbility === 'FLASH_FIRE') assert.ok(!attacks.slice(0, 2).includes(chosen), 'uses non-Fire coverage');
  }
  console.log('Eruption regression passed');
} finally {
  await browser?.close();
  server.close();
}
