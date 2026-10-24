// ♥ and ♦: caps, income, spending. RULINGS R3.

import { GameError } from './errors.js';

export const BASE_CAP = 50; // RULINGS R3

export function capOf(state, kind) {
  const roomId = kind === 'hearts' ? 'stockpile' : 'treasury';
  let extra = 0;
  for (const c of Object.values(state.cells)) if (c.room === roomId && !c.damaged) extra += 50;
  return BASE_CAP + extra;
}

// Add income, respecting the cap (R3). Returns { gained, lost }.
export function gain(state, kind, amount) {
  const cap = capOf(state, kind);
  const room = Math.max(0, cap - state.res[kind]);
  const gained = Math.min(room, Math.max(0, amount));
  state.res[kind] += gained;
  return { gained, lost: Math.max(0, amount) - gained };
}

export function canAfford(state, cost) {
  return (cost.hearts || 0) <= state.res.hearts && (cost.diamonds || 0) <= state.res.diamonds;
}

export function pay(state, cost) {
  if (!canAfford(state, cost)) throw new GameError(`You need ${costText(cost)} for that.`);
  state.res.hearts -= cost.hearts || 0;
  state.res.diamonds -= cost.diamonds || 0;
}

export function costText(cost) {
  const parts = [];
  if (cost.hearts) parts.push(`${cost.hearts}♥`);
  if (cost.diamonds) parts.push(`${cost.diamonds}♦`);
  return parts.length ? parts.join(' + ') : 'free';
}

// "Gained 12♦" or "Gained 8♦ (4♦ more would not fit)".
export function gainText(kind, { gained, lost }) {
  const sym = kind === 'hearts' ? '♥' : '♦';
  return `${gained}${sym}${lost ? ` (${lost}${sym} more would not fit in the stores)` : ''}`;
}
