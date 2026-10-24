import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, apply, buildableSquares, housingFor } from '../src/engine/game.js';
import { GameError } from '../src/engine/errors.js';
import { explorableSquares, parseKey } from '../src/engine/grid.js';
import { legalTroopMoves } from '../src/engine/combat.js';

// Plays many seeded games with a simple random overseer. Rule refusals (GameError) are fine;
// anything else is a bug. Also checks invariants after every action.
function rnd(seed) {
  let t = seed;
  return () => ((t = (Math.imul(t, 1103515245) + 12345) | 0) >>> 0) / 4294967296;
}

function invariants(s) {
  assert.ok(s.res.hearts >= 0 && s.res.diamonds >= 0, 'no negative supply');
  assert.ok(s.res.hearts <= 50 && s.res.diamonds <= 50, 'supply within cap');
  for (const h of Object.values(s.housing)) assert.ok(h.count >= 0);
  if (s.combat) for (const e of s.combat.enemies) assert.ok(e.str > 0, 'dead enemies are removed');
}

test('300 random games run without engine errors', () => {
  let falls = 0;
  let fights = 0;
  for (let g = 0; g < 300; g++) {
    const r = rnd(g + 1);
    let s = newGame({ seed: g * 7919 + 1 });
    for (let step = 0; step < 400 && !s.over; step++) {
      let action;
      if (s.phase === 'explore') {
        const opts = explorableSquares(s);
        const p = opts[Math.floor(r() * opts.length)];
        action = { type: 'explore', x: p.x, y: p.y };
      } else if (s.phase === 'combat') {
        fights += s.combat.round === 1 ? 1 : 0;
        const t = s.combat.troops.find((x) => !x.acted && legalTroopMoves(s, x).length);
        if (t && r() < 0.7) {
          const m = legalTroopMoves(s, t);
          const p = m[Math.floor(r() * m.length)];
          action = { type: 'moveTroop', troopId: t.id, x: p.x, y: p.y };
        } else action = { type: 'endRound' };
      } else {
        const roll = r();
        if (roll < 0.15) action = { type: 'trade', give: r() < 0.5 ? 'hearts' : 'diamonds', amount: 2 };
        else if (roll < 0.45) {
          const room = ['corridor', 'stairs', 'barracks'][Math.floor(r() * 3)];
          const opts = buildableSquares(s, room);
          if (opts.length) { const p = opts[Math.floor(r() * opts.length)]; action = { type: 'build', room, x: p.x, y: p.y }; }
        } else if (roll < 0.6) {
          const homes = Object.keys(s.cells).map(parseKey).filter((p) => housingFor(s, p.x, p.y));
          const p = homes[Math.floor(r() * homes.length)];
          action = { type: 'recruit', x: p.x, y: p.y, unit: 'soldier', count: 1 };
        }
        action = action || { type: 'endTurn' };
      }
      try {
        s = apply(s, action);
      } catch (e) {
        if (!(e instanceof GameError)) throw e;
        if (s.phase !== 'explore' && s.phase !== 'combat') s = apply(s, { type: 'endTurn' });
      }
      invariants(s);
    }
    if (s.over) falls++;
  }
  assert.ok(fights > 50, `expected plenty of fights, saw ${fights}`);
  assert.ok(falls > 0, 'some random overseers should lose their hold');
});
