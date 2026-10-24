// Liquid and gas, p. 9 and p. 43. RULINGS R29, R30, R36–R38.

import { UNITS } from '../data/units.js';
import { key, parseKey, getCell, openNeighbours, getLink } from './grid.js';

const LIQUID_NAMES = { water: 'water', lava: 'lava', swamp: 'swamp' };

// Squares liquid or gas can't enter. Pumps stop liquid (p. 16); Defensive Barricades stop both (p. 18).
function blocksFlow(cell, what) {
  if (!cell) return true;
  if (cell.closed) return true;
  if (cell.barricade && cell.barricade.type === 'defensive') return true;
  if (what === 'liquid' && (cell.room === 'pump' || cell.liquid)) return true;
  if (what === 'gas' && (cell.gas || cell.liquid)) return true;
  return false;
}

// The nearest `count` open squares from the sources, moving only in `dirs`.
// Ties: left before right, then top before bottom (R29).
function nearest(state, sources, dirs, what, count) {
  const dist = new Map(sources.map((p) => [key(p.x, p.y), 0]));
  let frontier = [...sources];
  const found = [];
  for (let d = 1; frontier.length && found.length < count; d++) {
    const next = [];
    for (const p of frontier) {
      for (const n of openNeighbours(state, p.x, p.y, dirs)) {
        const k = key(n.x, n.y);
        if (dist.has(k)) continue;
        dist.set(k, d);
        if (blocksFlow(state.cells[k], what)) continue;
        next.push(n);
      }
    }
    next.sort((a, b) => a.x - b.x || a.y - b.y);
    for (const n of next) if (found.length < count) found.push(n);
    frontier = next;
  }
  return found;
}

// Everything in a straight line down (liquid) or up (gas) through links.
function fall(state, start, dy, what) {
  const out = [];
  let p = start;
  for (;;) {
    const ny = p.y + dy;
    const cell = getCell(state, p.x, ny);
    if (!cell || !getLink(state, p.x, p.y, ny) || blocksFlow(cell, what)) break;
    p = { x: p.x, y: ny };
    out.push(p);
  }
  return out;
}

// Units housed in a square swamped by liquid or gas are defeated (p. 9). Golems are immune (p. 6).
export function drownUnits(state, k) {
  const h = state.housing[k];
  if (!h || !h.count || UNITS[h.unit].immuneToFlow) return 0;
  const lost = h.count;
  state.stats.unitsLost += lost;
  h.count = 0;
  return lost;
}

// Liquid from `sources` (already marked liquid): nearest 2 open squares, then down as far as it
// can go from every wet square. Returns the newly wet squares and units lost.
export function spreadLiquid(state, sources, liquid) {
  const spill = nearest(state, sources, ['side', 'down'], 'liquid', 2);
  const wet = [];
  const mark = (p) => {
    const k = key(p.x, p.y);
    const cell = state.cells[k];
    if (blocksFlow(cell, 'liquid')) return false;
    cell.liquid = liquid;
    if (liquid === 'lava' && cell.type === 'room' && cell.room !== 'entrance') cell.damaged = true; // p. 43
    wet.push(p);
    return true;
  };
  for (const p of spill) mark(p);
  const pourFrom = [...sources, ...wet];
  for (const p of pourFrom) for (const q of fall(state, p, 1, 'liquid')) mark(q);
  let lost = 0;
  for (const p of [...sources, ...wet]) lost += drownUnits(state, key(p.x, p.y));
  return { wet, lost, name: LIQUID_NAMES[liquid] };
}

// Gas from a source square: nearest 2 open squares, then up as far as it can go (p. 9, R30).
export function spreadGas(state, source, gas) {
  const src = state.cells[key(source.x, source.y)];
  src.gas = gas;
  const spread = nearest(state, [source], ['side', 'up'], 'gas', 2);
  const filled = [source];
  for (const p of spread) {
    state.cells[key(p.x, p.y)].gas = gas;
    filled.push(p);
  }
  for (const p of [...filled]) {
    for (const q of fall(state, p, -1, 'gas')) {
      state.cells[key(q.x, q.y)].gas = gas;
      filled.push(q);
    }
  }
  let lost = 0;
  let exploded = null;
  if (gas === 'poison') for (const p of filled) lost += drownUnits(state, key(p.x, p.y));
  if (gas === 'flammable') {
    const spark = filled.find((p) => ['forge', 'inn', 'barracks'].includes(state.cells[key(p.x, p.y)].room));
    if (spark) exploded = explode(state, filled);
  }
  if (exploded) lost += exploded.lost;
  return { filled, lost, exploded };
}

// p. 9: "every grid space containing the gas is engulfed in fire, instantly defeating all units
// within. All rooms within the gas are damaged." The gas burns away.
export function explode(state, squares) {
  let lost = 0;
  let damaged = 0;
  for (const p of squares) {
    const k = key(p.x, p.y);
    const cell = state.cells[k];
    lost += drownUnits(state, k);
    if (cell.type === 'room' && cell.room !== 'entrance') { cell.damaged = true; damaged++; }
    delete cell.gas;
  }
  return { lost, damaged };
}

export function flammableSquaresAround(state, x, y) {
  const out = [];
  const seen = new Set();
  const stack = [{ x, y }];
  while (stack.length) {
    const p = stack.pop();
    const k = key(p.x, p.y);
    if (seen.has(k)) continue;
    seen.add(k);
    const c = state.cells[k];
    if (!c || c.gas !== 'flammable') continue;
    out.push(p);
    for (const n of openNeighbours(state, p.x, p.y, ['side', 'up', 'down'])) stack.push(n);
  }
  return out;
}

// p. 5: "Rooms filled by liquid or gas can be drained at a cost of 5♦. Lava can be drained for
// 20♦, but treat that room as damaged after it is drained."
export function drainCost(cell) {
  if (cell.liquid === 'lava' || cell.slime) return { diamonds: 20 };
  return { diamonds: 5 };
}

export function drain(state, x, y) {
  const cell = state.cells[key(x, y)];
  const wasLava = cell.liquid === 'lava';
  delete cell.liquid;
  delete cell.flooded;
  delete cell.gas;
  if (wasLava && cell.type === 'room' && cell.room !== 'entrance') cell.damaged = true;
  return { wasLava };
}

export function wetSquares(state) {
  return Object.entries(state.cells).filter(([, c]) => c.liquid || c.flooded || c.gas).map(([k]) => parseKey(k));
}
