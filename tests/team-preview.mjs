// Checks that web/team-preview.js matches the species the ROM produced for
// known seeds (captured via teams.mjs after a ROM rebuild).
//
//   node team-preview.mjs
import { previewTeamForSeed } from '../web/team-preview.js';
import { SPECIES_NAMES } from '../web/team-preview-data.js';
import { dailySeed } from '../web/daily.js';

const cases = [
  { date: '2026-11-01', species: ['TROPIUS', 'CRADILY', 'JYNX', 'GRUMPIG', 'ABSOL', 'AGGRON'] },
  { date: '2026-11-08', species: ['AERODACTYL', 'DUNSPARCE', 'GOREBYSS', 'CRADILY', 'MUK', 'CLAYDOL'] },
  { date: '2026-11-09', species: ['RELICANTH', 'VILEPLUME', 'CLEFABLE', 'MILTANK', 'MILOTIC', 'ARIADOS'] },
];

let failed = 0;
for (const { date, species } of cases) {
  const seed = dailySeed(date);
  const keys = previewTeamForSeed(seed).map((m) => SPECIES_NAMES[m.id]);
  const ok = keys.join(',') === species.join(',');
  console.log(`${ok ? 'ok' : 'FAIL'} ${date} seed=${seed} → ${keys.join(', ')}`);
  if (!ok) {
    console.log(`  expected ${species.join(', ')}`);
    failed++;
  }
}

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log('\nAll team-preview cases match the ROM reference.');
