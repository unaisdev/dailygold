// Unit checks for the independent learnset validator; no ROM boot or generator run.
import { SPECIES, MOVES, learnableMoves, learnsetSources, validateTeam } from './party.mjs';

const speciesId = (name) => [...SPECIES].find(([, value]) => value === name)[0];
const moveId = (name) => [...MOVES].find(([, value]) => value === name)[0];
const assert = (ok, message) => { if (!ok) throw new Error(message); };

const charmander = speciesId('CHARMANDER');
assert(learnsetSources(charmander).egg.has(moveId('ROCK_SLIDE')), 'egg move Rock Slide is parsed for Charmander');
assert(learnableMoves(charmander).has(moveId('ROCK_SLIDE')), 'egg move Rock Slide is allowed for Charmander');

const tutorCandidates = [...SPECIES].filter(([id]) => learnsetSources(id).tutor.has(moveId('ROCK_SLIDE')));
assert(tutorCandidates.length > 0, 'tutor Rock Slide is parsed from tutor learnsets');
assert(tutorCandidates.some(([id]) => learnableMoves(id).has(moveId('ROCK_SLIDE'))), 'tutor Rock Slide is allowed');

const invalidMove = [...MOVES].find(([id]) => id > 0
  && !learnableMoves(charmander).has(id))[0];
const mons = [1, 2, 3, 4, 5, 6].map((id, i) => ({
  species: id,
  speciesName: SPECIES.get(id),
  level: 100,
  hp: 1,
  maxHp: 1,
  moves: [i === 0 ? invalidMove : moveId('TACKLE'), 0, 0, 0],
  moveNames: [MOVES.get(i === 0 ? invalidMove : moveId('TACKLE'))],
  evs: [0, 0, 0, 0, 0, 0],
  ivs: [31, 31, 31, 31, 31, 31],
  pp: [1, 0, 0, 0],
  heldItem: 0,
  fateful: true,
}));
const issues = validateTeam({ count: 6, party: mons });
assert(issues.some((issue) => issue.includes(`can't learn ${MOVES.get(invalidMove)}`)), 'validator rejects a move outside FireRed learnsets');
console.log('PASS  independent learnset validation includes tutor/egg moves and rejects forbidden moves');
