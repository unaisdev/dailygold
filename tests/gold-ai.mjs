// Real-ROM regressions for all six GOLD party members. Build the ROM first.
// node tests/gold-ai.mjs attack|status|followup|history
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {GAME_DIR,startServer,launchBrowser,bootGame,waitFor,startRedBattle,getStatus,patchMemory,symbol,u16,press,sleep} from './lib.mjs';
import {readParty,MOVES} from './party.mjs';
const allConstants={};
for(const file of ['moves.h','abilities.h','species.h','pokemon.h']) {
 const text=readFileSync(join(GAME_DIR,'include/constants',file),'utf8');
 for(const m of text.matchAll(/^#define (\w+)\s+(\d+)\b/gm)) allConstants[m[1]]=+m[2];
}
const C=n=>{assert.ok(n in allConstants,n);return allConstants[n]};
const speciesInfo=new Map();
for(const [_,name,body] of readFileSync(join(GAME_DIR,'src/data/pokemon/species_info.h'),'utf8').matchAll(/\[SPECIES_(\w+)\]\s*=\s*\{(.*?)\n    \}/gs)){
 const val=k=>+(body.match(new RegExp('\\.'+k+' = (\\d+)'))?.[1]??0);
 const types=body.match(/\.types = \{(TYPE_\w+), (TYPE_\w+)\}/);
 if(types)speciesInfo.set(name,{stats:['baseAttack','baseDefense','baseSpeed','baseSpAttack','baseSpDefense'].map(k=>2*val(k)+36),hp:2*val('baseHP')+141,types:types.slice(1).map(C)});
}
const group=process.argv[2]??'attack';
const cases=[];
const add=(boss,target,ability,label,extra={})=>cases.push({boss,target,ability,label,...extra});
if(group==='history'){
 add('UMBREON','BLISSEY','NATURAL_CURE','Ignore invalid previous move',{targetStatus1:128,lastTargetMove:'INVALID'});
 add('UMBREON','BLISSEY','NATURAL_CURE','Ignore invalid stored move',{targetStatus1:128,invalidHistory:true});
 add('UMBREON','BLISSEY','NATURAL_CURE','Invalid last move without residual effects',{noPP:[2],lastTargetMove:'INVALID'});
}else if(group==='followup'){
 add('AMPHAROS','BLISSEY','NATURAL_CURE','Thunder Wave substitute with real HP',{targetStatus2:1<<24});
 add('UMBREON','BLISSEY','NATURAL_CURE','Toxic substitute with real HP',{targetStatus2:1<<24});
 add('UMBREON','BLISSEY','NATURAL_CURE','Toxic taunted confirmed',{taunt:true});
 add('UMBREON','BLISSEY','NATURAL_CURE','Toxic disabled confirmed',{disabledMove:'TOXIC'});
 add('HO_OH','SNORLAX','IMMUNITY','Aerial Ace target evasion +6',{targetStages:{7:12}});
 // Remove Toxic's turn-stalling benefit to isolate the always-hit attack.
 add('UMBREON','BLISSEY','NATURAL_CURE','Faint Attack target evasion +6',{targetStages:{7:12},noPP:[2]});
 add('HERACROSS','BLISSEY','NATURAL_CURE','Brick Break no screens control',{noPP:[0]});
 add('TYPHLOSION','MUK','STENCH','Extrasensory Minimize control',{targetHp:230,ownHpFraction:.2});
 add('TYPHLOSION','MUK','STENCH','Extrasensory Minimize active',{targetHp:230,ownHpFraction:.2,targetStatus3:256});
 add('HERACROSS','SNORLAX','IMMUNITY','Reliable finishing attack',{targetHp:1,noPP:[0]});
 add('UMBREON','BLISSEY','NATURAL_CURE','Protect poison without known recovery',{targetStatus1:128});
 add('UMBREON','BLISSEY','NATURAL_CURE','Protect poison with known recovery',{targetStatus1:128,lastTargetMove:'RECOVER'});
 add('TYPHLOSION','NINETALES','FLASH_FIRE','Frozen Flash Fire exception',{targetStatus1:32});
 add('AMPHAROS','SNORLAX','IMMUNITY','Light Screen revealed special attack',{lastTargetMove:'PSYCHIC'});
 add('AMPHAROS','GYARADOS','INTIMIDATE','Light Screen revealed physical attack',{lastTargetMove:'EARTHQUAKE'});
 add('UMBREON','BLISSEY','NATURAL_CURE','Finish instead of unnecessary Wish',{targetHp:1,targetStatus1:128,ownHpFraction:.2});
}else if(group==='attack'){
 for(const hp of [undefined,1])add('HO_OH','GENGAR','LEVITATE',`Ho-Oh / Gengar HP ${hp??'full'}`,{targetHp:hp});
 add('HO_OH','GENGAR','LEVITATE','Ho-Oh low HP / Gengar 1 HP',{targetHp:1,ownHpFraction:.2});
 add('HO_OH','FLYGON','LEVITATE','Ho-Oh / Flygon');
 for(const hp of [undefined,1])add('HO_OH','NINETALES','FLASH_FIRE',`Ho-Oh / Flash Fire HP ${hp??'full'}`,{targetHp:hp});
 for(const hp of [undefined,1])add('GYARADOS','GENGAR','LEVITATE',`Gyarados / Levitate HP ${hp??'full'}`,{targetHp:hp,noPP:[0]});
 add('GYARADOS','VAPOREON','WATER_ABSORB','Gyarados / Water Absorb',{noPP:[0]});
 add('GYARADOS','SHEDINJA','WONDER_GUARD','Gyarados / Wonder Guard',{targetHp:1,noPP:[0]});
 for(const hp of [undefined,1])add('AMPHAROS','JOLTEON','VOLT_ABSORB',`Ampharos / Volt Absorb HP ${hp??'full'}`,{targetHp:hp});
 for(const hp of [undefined,1])add('AMPHAROS','DUGTRIO','ARENA_TRAP',`Ampharos / Ground HP ${hp??'full'}`,{targetHp:hp});
 for(const hp of [undefined,1])add('HERACROSS','GENGAR','LEVITATE',`Heracross / Ghost HP ${hp??'full'}`,{targetHp:hp,noPP:[0]});
 add('HERACROSS','SHEDINJA','WONDER_GUARD','Heracross / Wonder Guard',{targetHp:1,noPP:[0]});
 for(const hp of [undefined,1])add('TYPHLOSION','NINETALES','FLASH_FIRE',`Typhlosion / Flash Fire HP ${hp??'full'}`,{targetHp:hp});
 add('TYPHLOSION','HOUNDOOM','FLASH_FIRE','Typhlosion / Dark + Flash Fire',{targetHp:1});
 add('TYPHLOSION','SNORLAX','IMMUNITY','Typhlosion Eruption full HP');
 add('TYPHLOSION','SNORLAX','IMMUNITY','Typhlosion Eruption 20% HP',{ownHpFraction:.2});
 add('UMBREON','SHEDINJA','WONDER_GUARD','Umbreon / Wonder Guard',{targetHp:1,targetStatus1:128});
}else{
 const defaultAbilities=['INTIMIDATE','STATIC','GUTS','SYNCHRONIZE','PRESSURE','FLASH_FIRE'];
 for(const boss of ['GYARADOS','AMPHAROS','HERACROSS','UMBREON','HO_OH','TYPHLOSION']) add(boss,'SNORLAX','IMMUNITY',`${boss} baseline`);
 add('GYARADOS','SNORLAX','IMMUNITY','Dragon Dance both stages capped',{stages:{1:12,3:12}});
 add('GYARADOS','SNORLAX','IMMUNITY','Dragon Dance attack capped only',{stages:{1:12}});
 add('GYARADOS','SNORLAX','IMMUNITY','Dragon Dance low HP',{ownHpFraction:.2});
 add('GYARADOS','JOLTEON','VOLT_ABSORB','Dragon Dance lethal Thunderbolt',{targetMoves:['THUNDERBOLT']});
 add('HERACROSS','SNORLAX','IMMUNITY','Swords Dance capped',{stages:{1:12}});
 add('HERACROSS','ALAKAZAM','SYNCHRONIZE','Swords Dance boosted and lethal Psychic',{stages:{1:8},targetMoves:['PSYCHIC']});
 add('AMPHAROS','BLISSEY','NATURAL_CURE','Thunder Wave safeguard',{sidePlayer:32});
 add('AMPHAROS','BLISSEY','NATURAL_CURE','Thunder Wave substitute',{targetStatus2:1<<24});
 add('AMPHAROS','BLISSEY','NATURAL_CURE','Thunder Wave already paralyzed',{targetStatus1:64});
 add('AMPHAROS','DITTO','LIMBER','Thunder Wave Limber');
 add('AMPHAROS','BLISSEY','NATURAL_CURE','Light Screen already active',{sideEnemy:2});
 add('HERACROSS','BLISSEY','NATURAL_CURE','Brick Break Reflect',{sidePlayer:1,noPP:[0]});
 add('HERACROSS','BLISSEY','NATURAL_CURE','Brick Break Light Screen',{sidePlayer:2,noPP:[0]});
 for(const [target,ability,label,x] of [
 ['BLISSEY','NATURAL_CURE','Toxic normal',{}],
 ['STEELIX','STURDY','Toxic Steel',{}],
 ['MUK','STENCH','Toxic Poison',{}],
 ['SNORLAX','IMMUNITY','Toxic Immunity',{}],
 ['BLISSEY','NATURAL_CURE','Toxic safeguard',{sidePlayer:32}],
 ['BLISSEY','NATURAL_CURE','Toxic substitute',{targetStatus2:1<<24}],
 ['BLISSEY','NATURAL_CURE','Toxic already poisoned',{targetStatus1:128}],
 ['BLISSEY','NATURAL_CURE','Toxic taunted',{taunt:true}],
 ['BLISSEY','NATURAL_CURE','Toxic disabled',{disabledMove:'TOXIC'}],
 ['BLISSEY','NATURAL_CURE','Wish pending, half HP',{ownHpFraction:.5,wish:1,targetStatus1:128}],
 ['BLISSEY','NATURAL_CURE','Wish full HP',{targetStatus1:128}],
 ['BLISSEY','NATURAL_CURE','Wish low HP',{ownHpFraction:.2,targetStatus1:128}],
 ['BLISSEY','NATURAL_CURE','Protect twice used',{protectCount:2,targetStatus1:128}],
 ])add('UMBREON',target,ability,label,x);
 add('HO_OH','SNORLAX','IMMUNITY','Recover low HP, slower target',{ownHpFraction:.2});
 add('HO_OH','GENGAR','LEVITATE','Recover low HP, faster target',{ownHpFraction:.2});
 add('HO_OH','SNORLAX','IMMUNITY','Recover full HP');
 add('HO_OH','SNORLAX','IMMUNITY','Aerial Ace high evasion',{targetStages:{7:12}});
}
mkdirSync(new URL('./output/',import.meta.url),{recursive:true});
const output=new URL('./output/gold-ai-'+group+'.json',import.meta.url);
function verify(r) {
  assert.ok(r.legalRosterChoice, `${r.label}: a legal roster move must be committed`);
  const index = (name) => r.moves.indexOf(name);
  const score = (name) => r.scores[index(name)];
  const reject = (...names) => assert.ok(!names.includes(r.chosen), `${r.label}: must not choose ${names}`);
  if (r.ability === 'LEVITATE') reject('EARTHQUAKE');
  if (r.ability === 'FLASH_FIRE' && r.targetStatus1 !== 32) reject('ERUPTION', 'FIRE_BLAST', 'SACRED_FIRE');
  if (r.ability === 'VOLT_ABSORB') reject('THUNDERBOLT', 'THUNDER_PUNCH');
  if (r.target === 'DUGTRIO') reject('THUNDERBOLT', 'THUNDER_WAVE');
  if (r.ability === 'WATER_ABSORB') reject('WATERFALL');
  if (r.target === 'GENGAR' && r.boss === 'HERACROSS') reject('BRICK_BREAK');
  if (r.target === 'HOUNDOOM') reject('EXTRASENSORY');
  if (r.boss === 'GYARADOS' && r.label.includes('capped')) reject('DRAGON_DANCE');
  if (r.label.includes('Swords Dance capped')) reject('SWORDS_DANCE');
  if (r.boss === 'AMPHAROS' && (r.sidePlayer === 32 || r.targetStatus2 || r.targetStatus1 || r.ability === 'LIMBER')) reject('THUNDER_WAVE');
  if (r.label === 'Light Screen already active') reject('LIGHT_SCREEN');
  if (r.boss === 'UMBREON') {
    if (r.taunt || r.disabledMove || r.targetStatus2 || r.sidePlayer === 32 || r.targetStatus1 || ['STEELIX','MUK','SNORLAX'].includes(r.target)) reject('TOXIC');
    if (r.taunt || r.disabledMove) assert.equal(r.chosen, 'FAINT_ATTACK', r.label);
    if (r.wish) reject('WISH');
    if (r.label === 'Wish low HP') assert.equal(r.chosen, 'WISH', r.label);
    if (r.label === 'Toxic normal') assert.equal(r.chosen, 'TOXIC', r.label);
  }
  if (r.label === 'Recover low HP, slower target') {
    assert.ok(score('RECOVER') >= 100, 'Recover must not be penalized at low HP');
    assert.equal(r.chosen, 'RECOVER', r.label);
  }
  if (r.label === 'Recover full HP') reject('RECOVER');
  if (r.label.startsWith('Aerial Ace')) assert.equal(r.chosen, 'AERIAL_ACE', r.label);
  if (r.label.startsWith('Faint Attack target')) assert.equal(r.chosen, 'FAINT_ATTACK', r.label);
  if (r.label === 'Typhlosion Eruption 20% HP') reject('ERUPTION');
  if (r.label === 'Brick Break Reflect' || r.label === 'Brick Break Light Screen') {
    assert.ok(score('BRICK_BREAK') >= 105, 'screen removal must preserve the KO estimate and reward');
    assert.equal(r.chosen, 'BRICK_BREAK', r.label);
  }
  if (r.label === 'Light Screen revealed special attack') assert.equal(r.chosen, 'LIGHT_SCREEN', r.label);
  if (r.label === 'Light Screen revealed physical attack') assert.equal(score('LIGHT_SCREEN'), 98, r.label);
  if (r.label === 'Finish instead of unnecessary Wish') assert.equal(r.chosen, 'FAINT_ATTACK', r.label);
  if (r.label === 'Reliable finishing attack') assert.equal(r.chosen, 'BRICK_BREAK', r.label);
  if (r.label === 'Invalid last move without residual effects') assert.equal(score('PROTECT'), 100, r.label);
  if (r.label.startsWith('Ignore invalid')) assert.ok(score('PROTECT') >= 102, r.label);
  if (r.label === 'Protect poison without known recovery') assert.ok(score('PROTECT') >= 102, r.label);
  if (r.label === 'Protect poison with known recovery') assert.equal(score('PROTECT'), 100, r.label);
  if (r.label === 'Frozen Flash Fire exception') assert.ok(score('ERUPTION') > 0 && score('FIRE_BLAST') > 0, r.label);
  if (r.label === 'Extrasensory Minimize active') assert.equal(r.chosen, 'EXTRASENSORY', r.label);
  // Immunities cannot receive a finishing bonus, even at one HP.
  if (r.targetHp === 1 && r.ability === 'LEVITATE' && index('EARTHQUAKE') >= 0) assert.equal(score('EARTHQUAKE'), 0);
}
const server=await startServer();let browser;const results=[];
try{
 browser=await launchBrowser();const page=await browser.newPage();
 console.log('BOOT',group,cases.length,'start',process.argv[3]??0);
 await bootGame(page,server.url,{seed:424242});
 await waitFor(page,s=>s.inOverworld,{what:'overworld'});await startRedBattle(page);
 const original=(await getStatus(page)).mem;const party=readParty(original,'Enemy').party;
 console.log('PARTY',JSON.stringify(party.map(m=>({species:m.speciesName,stats:m.stats,moves:m.moveNames,item:m.heldItem}))));
 await page.evaluate(async()=>{window.goldAuditSnapshot=(await window.emu.saveState()).state});
 for(let caseIndex=0;caseIndex<cases.length;caseIndex++){
 const c=cases[caseIndex];
 await page.evaluate(async()=>window.emu.loadState(window.goldAuditSnapshot));await sleep(500);
 const {mem}=await getStatus(page);const mons=symbol('gBattleMons');
 const resources=mem.read(symbol('gBattleResources'),4).readUInt32LE();
 const ai=mem.read(resources+20,4).readUInt32LE(),history=mem.read(resources+24,4).readUInt32LE();
 const ownSlot=party.findIndex(m=>m.speciesName===c.boss);assert.ok(ownSlot>=0);
 const own=party[ownSlot],info=speciesInfo.get(c.target),ownInfo=speciesInfo.get(c.boss);assert.ok(info,c.target);
 const abilities=['INTIMIDATE','STATIC','GUTS','SYNCHRONIZE','PRESSURE','FLASH_FIRE'];
 const ownHp=Math.max(1,Math.floor(own.maxHp*(c.ownHpFraction??1))),targetMax=c.target==='SHEDINJA'?1:info.hp,targetHp=c.targetHp??targetMax;
 const writes=[];const set=(addr,bytes)=>writes.push({addr,bytes:[...bytes]});const set32=(addr,value)=>{const b=Buffer.alloc(4);b.writeUInt32LE(value>>>0);set(addr,b)};
 const targetMoves=(c.targetMoves??['GROWL','GROWL','GROWL','GROWL']);while(targetMoves.length<4)targetMoves.push('GROWL');
 for(const [id,sp,stats,ab,types,hp,maxhp,moves,item]of[
 [0,C('SPECIES_'+c.target),info.stats,C('ABILITY_'+c.ability),info.types,targetHp,targetMax,targetMoves.map(n=>C('MOVE_'+n)),0],
 [1,own.species,own.stats.slice(1),C('ABILITY_'+abilities[ownSlot]),ownInfo.types,ownHp,own.maxHp,own.moves,own.heldItem],
 ]){
 const b=mons+id*0x58;set(b,u16(sp));stats.forEach((v,i)=>set(b+2+2*i,u16(v)));
 set(b+0xc,moves.flatMap(u16));set32(b+0x14,0x3fffffff);
 const stages=Array(8).fill(6);for(const [k,v]of Object.entries(id===1?c.stages??{}:c.targetStages??{}))stages[k]=v;set(b+0x18,stages);
 set(b+0x20,[ab,...types,0]);set(b+0x24,id===1?own.pp.map((n,i)=>(c.noPP??[]).includes(i)?0:n):[20,20,20,20]);
 set(b+0x28,u16(hp));set(b+0x2a,[100,255]);set(b+0x2c,u16(maxhp));set(b+0x2e,u16(item));
 set32(b+0x4c,id===0?c.targetStatus1??0:0);set32(b+0x50,id===0?c.targetStatus2??0:0);
 }
 // Keep real party identities and boss stats; remove reserves to isolate move choice.
 set(symbol('gBattlerPartyIndexes')+2,u16(ownSlot));
 for(let i=0;i<6;i++)set(symbol('gEnemyParty')+i*100+86,u16(i===ownSlot?ownHp:0));
 set(symbol('gDisableStructs'),Array(0x1c*4).fill(0));
 if(c.taunt)set(symbol('gDisableStructs')+0x1c+0x13,[0x33]);
 if(c.disabledMove){set(symbol('gDisableStructs')+0x1c+4,u16(C('MOVE_'+c.disabledMove)));set(symbol('gDisableStructs')+0x1c+0xb,[0x33]);}
 if(c.protectCount)set(symbol('gDisableStructs')+0x1c+8,[c.protectCount]);
 if(c.targetStatus2)set(symbol('gDisableStructs')+0xa,[Math.floor(targetMax/4)]);
 set(symbol('gStatuses3'),Array(16).fill(0));set32(symbol('gStatuses3'),c.targetStatus3??0);set(symbol('gSideStatuses'),[...u16(c.sidePlayer??0),...u16(c.sideEnemy??0)]);
 set(symbol('gBattleWeather'),u16(0));set(symbol('gWishFutureKnock')+32,[0,c.wish??0,0,0]);
 set(history,Array(0x24).fill(0));set(history+0x20,[C('ABILITY_'+c.ability),0]);
 set(symbol('gLastMoves'),Array(8).fill(0));if(c.lastTargetMove)set(symbol('gLastMoves'),u16(c.lastTargetMove==='INVALID'?0xffff:C('MOVE_'+c.lastTargetMove)));if(c.invalidHistory)set(history,u16(0xffff));set(symbol('gChosenMoveByBattler'),Array(8).fill(0));
 set32(symbol('gRngValue'),c.seed??42);
 await patchMemory(page,writes);await press(page,'a');await sleep(1000);await press(page,'a');await sleep(1500);
 const after=(await getStatus(page)).mem,scores=[...after.read(ai+4,4)].map(n=>n>127?n-256:n);
 const chosen=after.read(symbol('gChosenMoveByBattler')+2,2).readUInt16LE();
 const actualTargetState={status1:after.read(mons+0x4c,4).readUInt32LE(),status2:after.read(mons+0x50,4).readUInt32LE(),substituteHp:after.read(symbol('gDisableStructs')+0xa,1)[0]};
 const result={...c,actualTargetState,ownHp,targetHp,moves:own.moveNames,scores,chosen:MOVES.get(chosen)??chosen,legalRosterChoice:own.moves.includes(chosen)};
 console.log(JSON.stringify(result));results.push(result);
 writeFileSync(output,JSON.stringify(results,null,2));
 verify(result);
 }
 console.log('COMPLETE',group,results.length);
}finally{await browser?.close();server.close();}
