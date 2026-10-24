import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, act } from './helpers.js';
import { buildableSquares } from '../src/engine/game.js';
import { isConnected, reachableFromEntrance, enemyRoute } from '../src/engine/grid.js';
import { GameError } from '../src/engine/errors.js';

function afterExplore(stack = ['2H']) {
  return act(game(stack), { type: 'explore', x: 4, y: 0 });
}

test('only one room per turn, corridors and stairs included (p. 5, p. 11)', () => {
  let s = afterExplore();
  s = act(s, { type: 'build', x: 5, y: 0, room: 'corridor' });
  assert.throws(() => act(s, { type: 'build', x: 2, y: 0, room: 'corridor' }), /one room per turn/);
});

test('the limit resets next turn', () => {
  let s = afterExplore(['2H', '2H']);
  s = act(s, { type: 'build', x: 5, y: 0, room: 'corridor' });
  s = act(s, { type: 'endTurn' });
  s = act(s, { type: 'explore', x: 2, y: 0 });
  s = act(s, { type: 'build', x: 1, y: 0, room: 'corridor' });
  assert.equal(s.cells['1,0'].room, 'corridor');
});

test('a Barracks costs 8♥ and can go on an empty cavern', () => {
  let s = afterExplore();
  s = act(s, { type: 'build', x: 4, y: 0, room: 'barracks' });
  assert.equal(s.res.hearts, 23 - 8);
  assert.equal(s.cells['4,0'].room, 'barracks');
  assert.equal(s.stats.roomsBuilt, 1);
});

test('rooms cost what the book says and you cannot overspend', () => {
  let s = afterExplore();
  s.res.hearts = 7;
  assert.throws(() => act(s, { type: 'build', x: 4, y: 0, room: 'barracks' }), /afford/);
});

test('Corridors go sideways, Stairs go below (p. 11, R27)', () => {
  const s = afterExplore();
  const corridor = buildableSquares(s, 'corridor').map((p) => `${p.x},${p.y}`);
  const stairs = buildableSquares(s, 'stairs').map((p) => `${p.x},${p.y}`);
  assert.ok(corridor.includes('2,0') && corridor.includes('5,0'));
  assert.ok(!corridor.includes('3,1'));
  assert.ok(stairs.includes('3,1') && stairs.includes('4,1'));
  assert.ok(!stairs.includes('5,0'));
});

test('Stairs are free, do not score, and link the levels for enemies at normal speed', () => {
  let s = afterExplore();
  s = act(s, { type: 'build', x: 3, y: 1, room: 'stairs' });
  assert.equal(s.res.hearts, 23);
  assert.equal(s.stats.roomsBuilt, 0);
  assert.equal(s.links['3,0|3,1'], 'stairs');
  const r = enemyRoute(s, { x: 3, y: 1 });
  assert.equal(r.cost, 1);
});

test('exploring straight down digs a shaft that enemies climb at 2 rounds per space (R8, R14)', () => {
  let s = game(['2H']);
  s.cells['4,0'] = { type: 'cavern' };
  s = act(s, { type: 'explore', x: 4, y: 1 });
  assert.equal(s.links['4,0|4,1'], 'shaft');
  const r = enemyRoute(s, { x: 4, y: 1 });
  assert.equal(r.cost, 3); // 2 to climb, 1 to walk west to the Entrance
});

test('exploring beside a hold square connects sideways, without a shaft (R8)', () => {
  let s = game(['2H']);
  s.cells['4,0'] = { type: 'cavern' };
  s.cells['3,1'] = { type: 'room', room: 'stairs' };
  s.links['3,0|3,1'] = 'stairs';
  s = act(s, { type: 'explore', x: 4, y: 1 });
  assert.equal(s.links['4,0|4,1'], undefined);
  assert.ok(isConnected(s, 4, 1));
});

test('a room with no link to the Entrance is disconnected (p. 5, R9)', () => {
  const s = game();
  s.cells['3,2'] = { type: 'room', room: 'barracks' };
  assert.equal(isConnected(s, 3, 2), false);
  s.cells['3,1'] = { type: 'room', room: 'stairs' };
  s.links['3,0|3,1'] = 'stairs';
  assert.equal(isConnected(s, 3, 2), false); // no link between 3,1 and 3,2 yet
  s.links['3,1|3,2'] = 'shaft';
  assert.equal(isConnected(s, 3, 2), true);
  s.cells['3,1'].flooded = true;
  assert.equal(isConnected(s, 3, 2), false);
  assert.equal(reachableFromEntrance(s).size, 1);
});

test('you cannot explore above the surface or away from the hold (R4, R7)', () => {
  const s = game(['2H']);
  assert.throws(() => act(s, { type: 'explore', x: 3, y: -1 }), GameError);
  assert.throws(() => act(s, { type: 'explore', x: 6, y: 0 }), GameError);
});

test('recruiting Soldiers into a Barracks: 5♦ each, 10 per Barracks (p. 6, p. 11)', () => {
  let s = afterExplore();
  s = act(s, { type: 'build', x: 4, y: 0, room: 'barracks' });
  s = act(s, { type: 'recruit', x: 4, y: 0, unit: 'soldier', count: 3 });
  assert.equal(s.res.diamonds, 5);
  assert.equal(s.housing['4,0'].count, 3);
  s.res.diamonds = 100;
  assert.throws(() => act(s, { type: 'recruit', x: 4, y: 0, unit: 'soldier', count: 8 }), /Only 7/);
  assert.throws(() => act(s, { type: 'build', x: 5, y: 0, room: 'corridor' }), GameError); // recruiting comes after building
});

test('the Entrance houses the five starting Soldiers (p. 2, R26)', () => {
  const s = game();
  assert.deepEqual(s.housing['3,0'], { unit: 'soldier', count: 5 });
});
