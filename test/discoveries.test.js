import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, act } from './helpers.js';
import { holdActions } from '../src/engine/game.js';
import { isConnected } from '../src/engine/grid.js';
import { canWithdraw } from '../src/engine/combat.js';

// Card ids for rolls: 1D4 by suit (♠1 ♣2 ♦3 ♥4), 1D2 by colour (black 1, red 2).
const D4 = { 1: '2S', 2: '2C', 3: '2D', 4: '2H' };
const D2 = { 1: '3S', 2: '3H' };

// Entrance (3,0) with stairs down to depth 3: (3,1), (3,2).
function deepHold(stack = []) {
  const s = game(stack);
  s.cells['3,1'] = { type: 'room', room: 'stairs' };
  s.cells['3,2'] = { type: 'room', room: 'stairs' };
  s.links['3,0|3,1'] = 'stairs';
  s.links['3,1|3,2'] = 'stairs';
  return s;
}
const wet = (s) => Object.entries(s.cells).filter(([, c]) => c.liquid).map(([k]) => k).sort();

// ------------------------------------------------------------------ ♣

test('5♣ cavern is 1D4 squares, grown sideways first', () => {
  const s = act(game(['5C', D4[3]]), { type: 'explore', x: 4, y: 0 });
  assert.deepEqual(Object.keys(s.cells).filter((k) => s.cells[k].type === 'cavern').sort(), ['4,0', '5,0', '6,0']);
});

test('4♣ river runs to the closest page edge and spills into the 2 nearest open squares (R29)', () => {
  const s0 = game(['4C']);
  s0.cells['2,0'] = { type: 'cavern', feature: 'cave' };
  const s = act(s0, { type: 'explore', x: 4, y: 0 }); // x=4: right edge (7) is closer than left (0)
  assert.deepEqual(['4,0', '5,0', '6,0', '7,0'].every((k) => s.cells[k].liquid === 'water'), true);
  assert.equal(s.cells['3,0'].liquid, 'water'); // the Entrance floods…
  assert.equal(s.cells['2,0'].liquid, 'water');
  assert.equal(s.stats.unitsLost, 5); // …and the Soldiers housed there drown (p. 9)
});

test('liquid found by digging down stays in its bed (p. 9)', () => {
  const s0 = game(['8C', D4[1]]);
  s0.cells['4,0'] = { type: 'cavern', feature: 'cave' };
  const s = act(s0, { type: 'explore', x: 4, y: 1 });
  assert.deepEqual(wet(s), ['4,1']);
  assert.equal(s.stats.unitsLost, 0);
});

test('liquid takes the nearest 2 squares, then pours down shafts as far as it can (R29)', () => {
  const s0 = deepHold(['8C', D4[1]]);
  s0.housing = {};
  s0.cells['2,1'] = { type: 'cavern', feature: 'cave' };
  s0.cells['2,2'] = { type: 'cavern', feature: 'cave' };
  s0.cells['2,3'] = { type: 'cavern', feature: 'cave' };
  s0.links['2,1|2,2'] = 'shaft';
  s0.links['2,2|2,3'] = 'shaft';
  // A one-square lake found sideways at depth 2, east of the stairs.
  s0.cells['5,1'] = { type: 'cavern', feature: 'cave' };
  const s = act(s0, { type: 'explore', x: 4, y: 1 });
  // Nearest: 3,1 (1 step), then 2,1 and 3,2 tie at 2 steps (left wins), so 2,1. Then down.
  // 5,1 is also 1 step away and right of 3,1: the two nearest are 3,1 and 5,1.
  assert.deepEqual(wet(s), ['3,1', '3,2', '4,1', '5,1']);
});

test('gas takes the nearest 2 squares, then rises as far as it can, and poison kills (R30)', () => {
  const s0 = deepHold(['2C', D4[1]]);
  s0.cells['2,2'] = { type: 'cavern', feature: 'cave' };
  const s = act(s0, { type: 'explore', x: 4, y: 2 });
  const gassed = Object.entries(s.cells).filter(([, c]) => c.gas === 'poison').map(([k]) => k).sort();
  // Source 4,2; nearest: 3,2 (1), then 2,2 / 3,1 at 2 → 2,2 (left first). Rises from 3,2: 3,1, 3,0.
  assert.deepEqual(gassed, ['2,2', '3,0', '3,1', '3,2', '4,2']);
  assert.equal(s.stats.unitsLost, 5);
  assert.equal(isConnected(s, 3, 1), false); // poison gas blocks the way until drained
});

test('flammable gas that reaches a Barracks explodes (p. 9)', () => {
  const s1 = game(['2C', D4[2]]);
  s1.cells['2,0'] = { type: 'room', room: 'barracks' };
  s1.housing['2,0'] = { unit: 'soldier', count: 3 };
  const b = act(s1, { type: 'explore', x: 1, y: 0 });
  assert.equal(b.cells['2,0'].damaged, true);
  assert.equal(b.housing['2,0'].count, 0);
  assert.ok(!Object.values(b.cells).some((c) => c.gas), 'the gas burns away');
});

test('blinding gas harms no one', () => {
  const s = act(game(['2C', D4[3]]), { type: 'explore', x: 4, y: 0 });
  assert.equal(s.cells['4,0'].gas, 'blinding');
  assert.equal(s.stats.unitsLost, 0);
});

test('6♣ crystal cavern: ♦ = card + depth each turn; the A♦ destroys it', () => {
  let s = act(game(['6C', D2[1], '7H']), { type: 'explore', x: 4, y: 0 });
  assert.equal(s.cells['4,0'].type, 'crystal');
  s = act(s, { type: 'endTurn' }); // start of turn 2 draws the 7♥: 7 + depth 1
  assert.equal(s.res.diamonds, 28);
});

test('A♦ shatters a crystal cavern', () => {
  const s0 = game(['AD']);
  s0.cells['4,0'] = { type: 'crystal', feature: 'crystal', group: 9 };
  s0.phase = 'trade';
  const s = act(s0, { type: 'endTurn' });
  assert.equal(s.cells['4,0'].type, 'cavern');
  assert.equal(s.res.diamonds, 20);
});

test('A♣ forest: +2♥ a turn, and a room built on it is free (R45)', () => {
  let s = act(game(['AC']), { type: 'explore', x: 4, y: 0 });
  assert.equal(s.cells['4,0'].feature, 'forest');
  s = act(s, { type: 'endTurn' });
  assert.equal(s.res.hearts, 22);
  s.deck.stack = ['2H'];
  s = act(s, { type: 'explore', x: 2, y: 0 });
  s = act(s, { type: 'build', x: 4, y: 0, room: 'barracks' });
  assert.equal(s.res.hearts, 25); // 22 + 3 from the 2♥, and the Barracks cost nothing
});

test('10♣ volcanic shaft runs to the bottom of the page', () => {
  const s = act(game(['10C']), { type: 'explore', x: 3, y: 1 });
  for (let y = 1; y <= 9; y++) assert.equal(s.cells[`3,${y}`].feature, 'volcanic');
  assert.equal(s.cells['3,10'], undefined);
});

test('9♣ hive: STR = size × 10 + depth, fighting at once', () => {
  const s = act(deepHold(['9C', D2[2], D4[2]]), { type: 'explore', x: 4, y: 1 });
  const e = s.combat.enemies[0];
  assert.equal(e.name, 'Giant Ants');
  assert.equal(e.baseStr, 20);
  assert.equal(s.lairs[e.lairId].str, 30);
});

test('J♣ small creature raids the nearest room, then slinks home, ending combat', () => {
  const s0 = game(['JC', D4[3]]);
  s0.housing = {};
  s0.cells['4,0'] = { type: 'cavern', feature: 'cave' };
  let s = act(s0, { type: 'explore', x: 5, y: 0 });
  assert.equal(s.combat.enemies[0].name, 'Huge Bat');
  let rounds = 0;
  while (s.combat && rounds++ < 10) s = act(s, { type: 'endRound' });
  assert.equal(s.over, null, 'a raider does not escape through the Entrance');
  assert.equal(s.combat, null);
  assert.equal(s.cells['5,0'].type, 'lair');
  assert.ok(holdActions(s).some((a) => a.type === 'attackLair'));
});

test('Q♣ large creature waits; once struck it leaves its lair for the Entrance', () => {
  let s = act(game(['QC', D4[1]]), { type: 'explore', x: 4, y: 0 });
  assert.equal(s.combat, null);
  assert.equal(Object.values(s.cells).filter((c) => c.type === 'lair').length, 4);
  s = act(s, { type: 'attackLair', x: 4, y: 0 });
  assert.equal(s.phase, 'combat');
  assert.ok(canWithdraw(s), 'a guarding creature lets you think better of it');
  const t = s.combat.troops[0];
  s = act(s, { type: 'moveTroop', troopId: t.id, x: 4, y: 0 });
  s = act(s, { type: 'endRound' });
  assert.equal(s.combat.enemies[0].behaviour, 'march');
});

test('K♣ burrowing beast digs straight up, turns at the top, and breaks into the hold (p. 9)', () => {
  const s0 = game(['KC', D4[1], D2[1]]);
  s0.cells['4,0'] = { type: 'cavern', feature: 'cave' };
  s0.cells['4,1'] = { type: 'cavern', feature: 'cave' };
  s0.links['4,0|4,1'] = 'shaft';
  const s = act(s0, { type: 'explore', x: 5, y: 1 });
  assert.equal(s.cells['5,0'].feature, 'tunnel');
  assert.equal(s.phase, 'combat');
  assert.equal(s.combat.enemies[0].name, 'Sabre-tooth Mole');
});

// ------------------------------------------------------------------ ♠

test('A♠ village: size × 10 STR, and it steals 10♦ from empty rooms', () => {
  const s0 = deepHold(['AS', D4[1], D4[1]]);
  s0.housing = {};
  let s = act(s0, { type: 'explore', x: 4, y: 2 });
  assert.equal(s.combat.enemies[0].baseStr, 10);
  // It stepped into the empty stairs at 3,2.
  assert.equal(s.res.diamonds, 10);
});

test('K♠ court is 1D4+2 squares, 20 STR each', () => {
  const s = act(deepHold(['KS', D4[4], D4[1]]), { type: 'explore', x: 4, y: 2 });
  const e = s.combat.enemies[0];
  assert.equal(e.baseStr, 120);
  assert.equal(e.name, 'Spellbound Apprentices');
});

test('5♠ abandoned mine pays 20♦ + 2♦ × depth', () => {
  const s0 = deepHold(['5S', D2[1]]);
  s0.res.diamonds = 0;
  const s = act(s0, { type: 'explore', x: 4, y: 1 });
  assert.equal(s.res.diamonds, 24);
});

test('7♠ abandoned room: you choose the room; it does not count as built', () => {
  let s = act(deepHold(['7S']), { type: 'explore', x: 4, y: 1 });
  assert.throws(() => act(s, { type: 'endTurn' }), /abandoned room/);
  s = act(s, { type: 'choose', option: 'barracks' });
  assert.equal(s.cells['4,1'].room, 'barracks');
  assert.equal(s.stats.roomsBuilt, 0);
  assert.equal(s.flags.roomBuilt, false);
});

test('J♠ artefact: +15 STR to Troops from its room', () => {
  let s = act(deepHold(['JS', '2S']), { type: 'explore', x: 4, y: 1 });
  s = act(s, { type: 'choose', option: '3,0' });
  s.deck.stack = ['2S'];
  s = act(s, { type: 'endTurn' });
  s = act(s, { type: 'explore', x: 4, y: 2 }); // a crypt: combat
  assert.equal(s.combat.troops[0].hp, 25 + 15);
});

test('2♠ crypt, once cleared, recruits Skull Dwarves', () => {
  const s0 = deepHold();
  s0.cells['4,2'] = { type: 'room', room: 'crypt' };
  s0.phase = 'recruit';
  const s = act(s0, { type: 'recruit', x: 4, y: 2, unit: 'skullDwarf', count: 2 });
  assert.equal(s.housing['4,2'].count, 2);
  assert.equal(s.res.diamonds, 10);
});

test('9♠ demon portal rolls at the end of each turn; on a 1, Demons attack', () => {
  const s0 = deepHold([D4[1]]);
  s0.cells['4,2'] = { type: 'room', room: 'portal' };
  s0.phase = 'trade';
  let s = act(s0, { type: 'endTurn' });
  assert.equal(s.phase, 'combat');
  assert.equal(s.combat.enemies[0].str, 20 + 15);
  s.housing['3,0'] = { unit: 'soldier', count: 5 };
  while (s.combat) s = act(s, { type: 'endRound' });
  if (!s.over) {
    assert.equal(s.turn, 2);
    assert.equal(s.phase, 'explore');
  }
});

test('the demon portal stays quiet on 2–4', () => {
  const s0 = deepHold([D4[3]]);
  s0.cells['4,2'] = { type: 'room', room: 'portal' };
  s0.phase = 'trade';
  const s = act(s0, { type: 'endTurn' });
  assert.equal(s.phase, 'explore');
});

test('Q♠ Wyrm: steal 20♦ once a turn; on a 1 it wakes', () => {
  let s = act(deepHold(['QS']), { type: 'explore', x: 4, y: 1 });
  s.res.diamonds = 0;
  s.deck.stack = [D4[3]];
  s = act(s, { type: 'stealHoard', x: 4, y: 1 });
  assert.equal(s.res.diamonds, 20);
  assert.throws(() => act(s, { type: 'stealHoard', x: 4, y: 1 }), /stolen this turn/);
  s = act(s, { type: 'endTurn' });
  s.deck.stack = ['2H', D4[1]];
  s = act(s, { type: 'explore', x: 2, y: 0 });
  s = act(s, { type: 'stealHoard', x: 4, y: 1 });
  assert.equal(s.phase, 'combat');
  assert.equal(s.combat.enemies[0].str, 110);
  assert.equal(s.combat.enemies[0].ranged, true);
});

test('10♠ golem forge: claimed only by defeating the Golems', () => {
  let s = act(deepHold(['10S']), { type: 'explore', x: 4, y: 1 });
  assert.equal(s.combat, null);
  s.housing['3,0'] = { unit: 'soldier', count: 20 };
  s = act(s, { type: 'attackLair', x: 4, y: 1 });
  const t = s.combat.troops[0];
  s = act(s, { type: 'moveTroop', troopId: t.id, x: 3, y: 1 });
  s = act(s, { type: 'endRound' });
  s = act(s, { type: 'moveTroop', troopId: t.id, x: 4, y: 1 });
  s = act(s, { type: 'endRound' });
  assert.equal(s.combat, null);
  assert.equal(s.cells['4,1'].room, 'golemForge');
  assert.equal(s.unlocks.golems, true);
});

test('4♠ sealed room blocks the way until opened, then draws Bad Magic', () => {
  let s = act(deepHold(['4S', D4[2]]), { type: 'explore', x: 4, y: 1 });
  assert.equal(isConnected(s, 4, 1), false);
  s.deck.stack = ['9C'];
  s = act(s, { type: 'openSealed', x: 4, y: 1 });
  assert.equal(s.lastDraws[0].name, 'Mimic');
  assert.equal(isConnected(s, 4, 1), true);
});

test('draining lava costs 20♦ and leaves the room damaged; repairs cost half', () => {
  const s0 = game();
  s0.cells['4,0'] = { type: 'room', room: 'barracks', liquid: 'lava', damaged: true };
  s0.phase = 'build';
  let s = act(s0, { type: 'drainSquare', x: 4, y: 0 });
  assert.equal(s.res.diamonds, 0);
  assert.equal(s.cells['4,0'].liquid, undefined);
  s = act(s, { type: 'repair', x: 4, y: 0 });
  assert.equal(s.res.hearts, 16);
  assert.equal(s.cells['4,0'].damaged, undefined);
});

test('a Corridor can bridge water', () => {
  let s = game(['2H']);
  s.cells['4,0'] = { type: 'cavern', feature: 'river', liquid: 'water' };
  s = act(s, { type: 'explore', x: 2, y: 0 });
  s = act(s, { type: 'build', x: 4, y: 0, room: 'corridor' });
  assert.equal(s.cells['4,0'].bridge, true);
  assert.equal(isConnected(s, 4, 0), true);
});

test('a save from version 0.1 (crypt stored on the square) loads and plays on', async () => {
  const { upgrade, apply } = await import('../src/engine/game.js');
  const old = game();
  delete old.lairs; delete old.artefacts; delete old.unlocks; delete old.lastDraws; delete old.pending;
  old.cells['3,1'] = { type: 'room', room: 'stairs' };
  old.links['3,0|3,1'] = 'stairs';
  old.cells['4,1'] = { type: 'lair', lair: { card: '2S', entry: '2' } };
  old.flags = { traded: false, roomBuilt: false };
  const s = upgrade(old);
  const lair = Object.values(s.lairs)[0];
  assert.equal(lair.str, 30);
  assert.equal(s.cells['4,1'].lair, lair.id);
  s.phase = 'trade';
  const n = apply(s, { type: 'attackLair', x: 4, y: 1 });
  assert.equal(n.phase, 'combat');
});
