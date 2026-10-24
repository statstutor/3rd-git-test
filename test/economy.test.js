import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game, act } from './helpers.js';
import { BASE_CAP, capOf } from '../src/engine/game.js';
import { GameError } from '../src/engine/errors.js';

test('a ♥ card adds its value plus depth (p. 3)', () => {
  let s = game(['7H']);
  s = act(s, { type: 'explore', x: 4, y: 0 }); // depth 1, east of the Entrance
  assert.equal(s.res.hearts, 20 + 7 + 1);
  assert.equal(s.cells['4,0'].type, 'cavern');
  assert.equal(s.phase, 'trade');
});

test("the book's own example: 3♦ at depth 3 adds 6 (p. 3)", () => {
  let s = game();
  s.cells['3,1'] = { type: 'room', room: 'stairs' };
  s.cells['3,2'] = { type: 'room', room: 'stairs' };
  s.links['3,0|3,1'] = 'stairs';
  s.links['3,1|3,2'] = 'stairs';
  s.deck.stack = ['3D'];
  s = act(s, { type: 'explore', x: 4, y: 2 });
  assert.equal(s.res.diamonds, 26);
});

test('face cards are worth 11/12/13 (p. 43)', () => {
  let s = game(['KD']);
  s = act(s, { type: 'explore', x: 2, y: 0 });
  assert.equal(s.res.diamonds, 20 + 13 + 1);
});

test('income above the cap is lost (R3)', () => {
  let s = game(['KH']);
  s.res.hearts = 45;
  s = act(s, { type: 'explore', x: 2, y: 0 });
  assert.equal(s.res.hearts, BASE_CAP);
  assert.equal(capOf(s, 'hearts'), 50);
  assert.match(s.chronicle.at(-1).text, /left in the dark/);
});

test('a ♠ at depth 1 is ignored and redrawn (p. 4)', () => {
  let s = game(['QS', '2H']);
  s = act(s, { type: 'explore', x: 4, y: 0 });
  assert.equal(s.res.hearts, 23);
  assert.equal(s.combat, null);
});

test('trading: 1♦ buys 2♥, once per turn (p. 4)', () => {
  let s = game(['2H']);
  s = act(s, { type: 'explore', x: 4, y: 0 });
  s = act(s, { type: 'trade', give: 'diamonds', amount: 5 });
  assert.equal(s.res.diamonds, 15);
  assert.equal(s.res.hearts, 23 + 10);
  assert.throws(() => act(s, { type: 'trade', give: 'diamonds', amount: 1 }), GameError);
});

test('trading: 2♥ buys 1♦, and odd ♥ cannot be traded (R12)', () => {
  let s = game(['2H']);
  s = act(s, { type: 'explore', x: 4, y: 0 });
  assert.throws(() => act(s, { type: 'trade', give: 'hearts', amount: 3 }), /pairs/);
  s = act(s, { type: 'trade', give: 'hearts', amount: 4 });
  assert.equal(s.res.hearts, 19);
  assert.equal(s.res.diamonds, 22);
});

test('trading resets next turn but not before exploring', () => {
  let s = game(['2H', '2H']);
  assert.throws(() => act(s, { type: 'trade', give: 'diamonds', amount: 1 }), GameError);
  s = act(s, { type: 'explore', x: 4, y: 0 });
  s = act(s, { type: 'trade', give: 'diamonds', amount: 1 });
  s = act(s, { type: 'endTurn' });
  s = act(s, { type: 'explore', x: 2, y: 0 });
  s = act(s, { type: 'trade', give: 'diamonds', amount: 1 });
  assert.equal(s.res.diamonds, 18);
});

test('trading is not allowed once building has started (turn order p. 44)', () => {
  let s = game(['2H']);
  s = act(s, { type: 'explore', x: 4, y: 0 });
  s = act(s, { type: 'build', x: 5, y: 0, room: 'corridor' });
  assert.throws(() => act(s, { type: 'trade', give: 'diamonds', amount: 1 }), GameError);
});
