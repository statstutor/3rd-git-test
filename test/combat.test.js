import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, act } from './helpers.js';
import { startCombat, legalTroopMoves } from '../src/engine/combat.js';
import { scoreBreakdown } from '../src/engine/game.js';

// A straight hold: Entrance (3,0) → stairs (3,1) → stairs (3,2) → corridor west (2,2).
function deepHold() {
  const s = game();
  s.cells['3,1'] = { type: 'room', room: 'stairs' };
  s.cells['3,2'] = { type: 'room', room: 'stairs' };
  s.links['3,0|3,1'] = 'stairs';
  s.links['3,1|3,2'] = 'stairs';
  return s;
}

test("depth bonus: the book's crypt at depth 3 has 20 + 15 = 35 STR (p. 7, R16)", () => {
  let s = deepHold();
  s.deck.stack = ['2S'];
  s = act(s, { type: 'explore', x: 4, y: 2 });
  assert.equal(s.phase, 'combat');
  const undead = s.combat.enemies[0];
  assert.equal(undead.baseStr, 20);
  // It has already taken its first step toward the Entrance (enemies move first).
  assert.equal(undead.str, 35);
});

test('enemies move first, one space, along the shortest route (p. 7)', () => {
  let s = deepHold();
  s.housing = {};
  s.deck.stack = ['2S'];
  s = act(s, { type: 'explore', x: 4, y: 2 });
  const e = s.combat.enemies[0];
  assert.deepEqual([e.x, e.y], [3, 2]);
  s = act(s, { type: 'endRound' });
  assert.deepEqual([s.combat.enemies[0].x, s.combat.enemies[0].y], [3, 1]);
});

test("simultaneous damage: 30 STR enemy vs a 10 STR Troop (p. 7's example)", () => {
  const s = game();
  s.housing['3,0'] = { unit: 'soldier', count: 2 };
  s.cells['4,0'] = { type: 'cavern' };
  startCombat(s, [{ name: 'Brute', baseStr: 30, str: 30, x: 4, y: 0 }]);
  // The Brute stepped onto the Entrance where the Troop stands: they fight.
  assert.deepEqual([s.combat.enemies[0].x, s.combat.enemies[0].y], [3, 0]);
  s.phase = 'combat';
  const after = act(s, { type: 'endRound' });
  // The soldiers are defeated; the enemy is reduced by 10 and, standing on the Entrance, escapes.
  assert.equal(after.stats.unitsLost, 2);
  assert.equal(after.over.reason, 'fallen');
});

test('a Troop loses a unit for each full unit-STR of damage, rounding survivors up (R19)', () => {
  const s = game();
  s.housing['3,0'] = { unit: 'soldier', count: 2 };
  s.cells['4,0'] = { type: 'cavern' };
  s.cells['5,0'] = { type: 'cavern' };
  startCombat(s, [{ name: 'Goblin', baseStr: 6, str: 6, x: 5, y: 0 }]);
  s.phase = 'combat';
  let t = s.combat.troops[0];
  let n = act(s, { type: 'moveTroop', troopId: t.id, x: 4, y: 0 });
  n = act(n, { type: 'endRound' });
  // 6 damage to a 10-STR Troop of two Soldiers: one Soldier falls (p. 8), and the Goblin dies.
  assert.equal(n.stats.unitsLost, 1);
  assert.equal(n.combat, null);
  assert.equal(n.housing['3,0'].count, 1);
  assert.equal(n.phase, 'trade');
});

test('your damage goes to the weakest enemy first, carrying over (R20)', () => {
  const s = game();
  s.housing['3,0'] = { unit: 'soldier', count: 5 }; // 25 STR
  s.cells['4,0'] = { type: 'cavern' };
  s.cells['5,0'] = { type: 'cavern' };
  startCombat(s, [
    { name: 'Big', baseStr: 40, str: 40, x: 5, y: 0 },
    { name: 'Small', baseStr: 10, str: 10, x: 5, y: 0 },
  ]);
  s.phase = 'combat';
  const t = s.combat.troops[0];
  let n = act(s, { type: 'moveTroop', troopId: t.id, x: 4, y: 0 });
  n = act(n, { type: 'endRound' });
  // Enemies moved first (5,0 → 4,0); the Troop then charged into 4,0.
  const names = n.combat ? n.combat.enemies.map((e) => `${e.name}:${e.str}`) : [];
  assert.deepEqual(names, ['Big:25']); // Small died (10), 15 carried to Big
});

test('engaged Troops cannot walk away (R18)', () => {
  const s = game();
  s.housing['3,0'] = { unit: 'soldier', count: 5 };
  s.cells['4,0'] = { type: 'cavern' };
  startCombat(s, [{ name: 'Ghoul', baseStr: 100, str: 100, x: 4, y: 0 }]);
  const t = s.combat.troops[0];
  assert.deepEqual(legalTroopMoves(s, t), []);
});

test('an enemy that reaches the Entrance and survives the round escapes: the hold falls (R22)', () => {
  const s = game();
  s.housing = {};
  s.cells['4,0'] = { type: 'cavern' };
  startCombat(s, [{ name: 'Wight', baseStr: 20, str: 20, x: 4, y: 0 }]);
  s.phase = 'combat';
  assert.equal(s.over, null); // it is standing on the Entrance, not yet out
  const n = act(s, { type: 'endRound' });
  assert.equal(n.over.reason, 'fallen');
  assert.equal(n.phase, 'over');
  assert.throws(() => act(n, { type: 'endTurn' }), /over/);
});

test('a cleared crypt becomes part of the hold (R28)', () => {
  let s = deepHold();
  s.housing['3,0'] = { unit: 'soldier', count: 8 }; // 40 STR beats 35
  s.deck.stack = ['2S'];
  s = act(s, { type: 'explore', x: 4, y: 2 }); // undead 35 STR, steps to 3,2
  // Fight on the stairs: troop moves down to 3,1, the undead climbs to 3,1 next round.
  const t = s.combat.troops[0];
  s = act(s, { type: 'moveTroop', troopId: t.id, x: 3, y: 1 });
  s = act(s, { type: 'endRound' }); // undead moves into 3,1 and the fight starts
  while (s.combat) s = act(s, { type: 'endRound' });
  assert.equal(s.over, null);
  assert.equal(s.cells['4,2'].room, 'crypt');
  assert.equal(s.stats.kills[0].baseStr, 20);
});

test('score follows the family formula (R31)', () => {
  const s = game();
  s.stats = { maxDepth: 3, roomsBuilt: 2, kills: [{ baseStr: 20 }], unitsLost: 4, turnsSurvived: 7 };
  s.res = { hearts: 10, diamonds: 5 };
  assert.equal(scoreBreakdown(s).total, 30 + 10 + 20 + 7 + 15 - 8);
});
