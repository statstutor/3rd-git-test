import { newGame, apply } from '../src/engine/game.js';
import { key } from '../src/engine/grid.js';

// A fresh game with the deck stacked: the given cards come up first, in order.
export function game(stack = [], opts = {}) {
  const s = newGame({ seed: 12345, ...opts });
  s.deck.stack = [...stack];
  return s;
}

export function act(state, action) {
  return apply(state, action);
}

// Put a room straight onto the map (test setup only; skips costs and limits).
export function place(state, x, y, room, extra = {}) {
  state.cells[key(x, y)] = { type: 'room', room, ...extra };
  return state;
}

export function cavern(state, x, y) {
  state.cells[key(x, y)] = { type: 'cavern' };
  return state;
}
