// The rules engine. Pure state → state. No DOM in here.
// `apply(state, action)` returns a new state or throws GameError; the UI keeps the undo
// history. Turn order (p. 44, RULINGS errata): start → explore → combat → trade → build →
// recruit → end.

import { ROOMS, FOUND_ROOMS } from '../data/rooms.js';
import { UNITS } from '../data/units.js';
import { CLUBS, SPADES, SLICE_STAND_INS } from '../data/discoveries.js';
import { RULES } from '../data/rules.js';
import { SUITS } from '../data/cards.js';
import { drawCard, parseCard, cardLabel, rollD4 } from './deck.js';
import {
  ENTRANCE, key, getCell, depthOf, isHoldCell, isConnected, explorableSquares,
  connectNewSquare, setLink, DIRS,
} from './grid.js';
import { write, hashPick, DIR_WORDS, MINING_LINES } from './chronicle.js';
import { startCombat, combatAction } from './combat.js';
import { GameError } from './errors.js';

export { GameError };

export const BASE_CAP = 50; // RULINGS R3
export const PHASES = ['start', 'explore', 'combat', 'trade', 'build', 'recruit', 'end'];

export function newGame({ seed = Date.now() % 2147483647, holdName = 'the Hold', options = {} } = {}) {
  const state = {
    version: 1,
    holdName,
    seed,
    rng: seed | 0,
    turn: 1,
    phase: 'explore',
    res: { hearts: 20, diamonds: 20 },
    cells: {},
    links: {},
    housing: {},
    deck: { stack: [], drawn: [], jokersIn: false, heldOut: {} },
    flags: { traded: false, roomBuilt: false },
    combat: null,
    chronicle: [],
    stats: { maxDepth: 1, roomsBuilt: 0, kills: [], unitsLost: 0, turnsSurvived: 0 },
    lastCard: null,
    over: null,
    options: { worldLayers: false, ...options },
    nextId: 1,
  };
  const ek = key(ENTRANCE.x, ENTRANCE.y);
  state.cells[ek] = { type: 'entrance', room: 'entrance' };
  state.housing[ek] = { unit: 'soldier', count: 5 }; // p. 2, RULINGS R26
  write(state, `The first stones of ${holdName} were laid: a stairwell cut into the mountainside, ` +
    'twenty loads of resources, twenty of trade goods, and five Soldiers standing guard at the Entrance.',
  { page: 2, title: 'Starting the game', quote: 'To start your hold draw a stairwell at the centre of the top row of your grid paper. This is the Entrance of your hold. … note that you have 20 of each to start. … note that you have five Soldiers (page 6) at the Entrance.' });
  return state;
}

// ---------------------------------------------------------------- resources

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
  const gained = Math.min(room, amount);
  state.res[kind] += gained;
  return { gained, lost: amount - gained };
}

export function canAfford(state, cost) {
  return (cost.hearts || 0) <= state.res.hearts && (cost.diamonds || 0) <= state.res.diamonds;
}

function pay(state, cost) {
  if (!canAfford(state, cost)) throw new GameError('You cannot afford that.');
  state.res.hearts -= cost.hearts || 0;
  state.res.diamonds -= cost.diamonds || 0;
}

export function costText(cost) {
  const parts = [];
  if (cost.hearts) parts.push(`${cost.hearts}♥`);
  if (cost.diamonds) parts.push(`${cost.diamonds}♦`);
  return parts.length ? parts.join(' + ') : 'free';
}

// ---------------------------------------------------------------- dispatcher

export function apply(prev, action) {
  if (prev.over) throw new GameError('This hold’s story is over.');
  const state = structuredClone(prev);
  switch (action.type) {
    case 'explore': explore(state, action); break;
    case 'trade': trade(state, action); break;
    case 'build': build(state, action); break;
    case 'recruit': recruit(state, action); break;
    case 'endTurn': endTurn(state); break;
    case 'moveTroop':
    case 'fire':
    case 'endRound':
      if (state.phase !== 'combat') throw new GameError('There is no fight going on.');
      combatAction(state, action);
      if (!state.combat && !state.over) state.phase = 'trade';
      break;
    default: throw new GameError(`Unknown action ${action.type}`);
  }
  return state;
}

function requirePhase(state, allowed, verb) {
  if (!allowed.includes(state.phase)) {
    throw new GameError(`You can’t ${verb} during the ${state.phase} step.`);
  }
}

// ---------------------------------------------------------------- explore (p. 3)

function dirFrom(state, x, y) {
  for (const d of DIRS) {
    const from = getCell(state, x - d.dx, y - d.dy);
    if (isHoldCell(from)) return d.name;
  }
  return 'down';
}

function explore(state, { x, y }) {
  requirePhase(state, ['explore'], 'explore');
  const ok = explorableSquares(state).some((p) => p.x === x && p.y === y);
  if (!ok) throw new GameError('You can only explore an unexplored square next to your hold.');
  const depth = depthOf(y);
  const dir = dirFrom(state, x, y);

  let id = drawCard(state);
  let card = parseCard(id);
  while (!card.joker && card.suit === 'S' && depth === 1) {
    write(state, `At depth 1 the ${cardLabel(id)} was turned aside; the overseer bid the miners dig on.`,
      { card: id, ...RULES.spadeAtDepth1, quote: RULES.spadeAtDepth1.text });
    id = drawCard(state);
    card = parseCard(id);
  }
  state.lastCard = { id, x, y, depth };
  state.stats.maxDepth = Math.max(state.stats.maxDepth, depth);

  if (card.joker) {
    // Jokers only enter at depth 5 (p. 33); not part of the slice yet.
    openCavern(state, x, y, { card: id });
    write(state, `A strange card, the ${card.name}, came up — its legend is not yet written into this game.`);
  } else if (card.suit === 'H' || card.suit === 'D') {
    mineResources(state, x, y, card, depth, dir);
  } else if (card.suit === 'C') {
    naturalFormation(state, x, y, card, depth, dir);
  } else {
    remnant(state, x, y, card, depth, dir);
  }

  state.phase = state.combat ? 'combat' : 'trade';
}

function openCavern(state, x, y, extra = {}) {
  state.cells[key(x, y)] = { type: 'cavern', ...extra };
  connectNewSquare(state, x, y);
}

// R11: (card value + flat bonuses) × doublers, then + depth.
export function cardIncome(state, card, depth) {
  const flat = 0; // Shrine of Fortune (+3 ♦) arrives with Shrines.
  const mult = 1; // Overseer's Office, Riches layer: later.
  return (card.value + flat) * mult + depth;
}

function mineResources(state, x, y, card, depth, dir) {
  const kind = card.suit === 'H' ? 'hearts' : 'diamonds';
  const amount = cardIncome(state, card, depth);
  openCavern(state, x, y, { found: { card: card.id } });
  const { gained, lost } = gain(state, kind, amount);
  const sym = SUITS[card.suit].symbol;
  const opener = hashPick(MINING_LINES[kind], state.turn, x, y);
  const where = hashPick(DIR_WORDS[dir], state.turn, x);
  let text = `Digging ${where} at depth ${depth}: ${opener}. ${cardLabel(card.id)} — ` +
    `${card.value} + ${depth} for depth = ${amount}${sym}.`;
  if (lost) text += ` The storerooms could hold only ${gained}; ${lost}${sym} was left in the dark (cap ${capOf(state, kind)}).`;
  const rule = RULES[kind];
  write(state, text, { card: card.id, page: rule.page, title: rule.title, quote: rule.text });
}

// R6: grow a multi-space find into unexplored squares, sideways first, then down.
export function growShape(state, x, y, size) {
  const shape = [{ x, y }];
  const taken = new Set([key(x, y)]);
  while (shape.length < size) {
    let pick = null;
    for (const pref of [{ dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }]) {
      for (const p of shape) {
        const nx = p.x + pref.dx;
        const ny = p.y + pref.dy;
        const k = key(nx, ny);
        if (!taken.has(k) && !state.cells[k] && ny >= 0) { pick = { x: nx, y: ny }; break; }
      }
      if (pick) break;
    }
    if (!pick) break;
    shape.push(pick);
    taken.add(key(pick.x, pick.y));
  }
  return shape;
}

function placeShape(state, shape, makeCell) {
  shape.forEach((p, i) => {
    state.cells[key(p.x, p.y)] = makeCell(p, i);
  });
  connectNewSquare(state, shape[0].x, shape[0].y);
  // Vertical neighbours inside one find are open to each other.
  const inShape = new Set(shape.map((p) => key(p.x, p.y)));
  for (const p of shape) if (inShape.has(key(p.x, p.y + 1))) setLink(state, p.x, p.y, 'shaft');
}

function naturalFormation(state, x, y, card, depth, dir) {
  let entry = CLUBS[card.rank];
  let note = '';
  if (!entry.implemented) {
    note = ` (The ${entry.name} is ${SLICE_STAND_INS.C.note}.)`;
    entry = CLUBS[SLICE_STAND_INS.C.suitRank];
  }
  const { roll } = rollD4(state);
  const shape = growShape(state, x, y, roll);
  const group = state.nextId++;
  placeShape(state, shape, () => ({ type: 'cavern', group, found: { card: card.id } }));
  write(state, `The wall gave way ${hashPick(DIR_WORDS[dir], state.turn, y)} at depth ${depth} onto an open cavern, ` +
    `${shape.length} grid space${shape.length > 1 ? 's' : ''} wide (1D4 rolled ${roll}).${note}`,
  { card: card.id, page: CLUBS[card.rank].page, title: `${cardLabel(card.id)} — ${CLUBS[card.rank].name}`, quote: CLUBS[card.rank].text });
}

function remnant(state, x, y, card, depth, dir) {
  let rank = card.rank;
  let note = '';
  if (!SPADES[rank].implemented) {
    note = ` (The ${SPADES[rank].name} is ${SLICE_STAND_INS.S.note}.)`;
    rank = SLICE_STAND_INS.S.suitRank;
  }
  const entry = SPADES[rank];
  state.cells[key(x, y)] = { type: 'lair', lair: { card: card.id, entry: rank } };
  connectNewSquare(state, x, y);
  const str = entry.enemy.str + 5 * depth; // R16
  write(state, `Breaking through ${hashPick(DIR_WORDS[dir], state.turn, x, y)} at depth ${depth}, the miners found a forgotten crypt. ` +
    `Its seals cracked, and the dead rose: ${entry.enemy.name}, ${entry.enemy.str} STR + ${5 * depth} for depth = ${str} STR.${note}`,
  { card: card.id, page: SPADES[card.rank].page, title: `${cardLabel(card.id)} — ${SPADES[card.rank].name}`, quote: SPADES[card.rank].text });
  startCombat(state, [{
    name: entry.enemy.name, baseStr: entry.enemy.str, str, x, y, lair: key(x, y),
  }]);
}

// ---------------------------------------------------------------- trade (p. 4, R12)

function trade(state, { give, amount }) {
  requirePhase(state, ['trade'], 'trade');
  if (state.flags.traded) throw new GameError('You have already traded this turn.');
  amount = Math.floor(amount);
  if (!(amount > 0)) throw new GameError('Choose an amount to trade.');
  if (state.res[give] < amount) throw new GameError('You don’t have that much to trade.');
  let text;
  if (give === 'hearts') {
    if (amount % 2) throw new GameError('Resources trade in pairs: 2♥ buys 1♦.');
    state.res.hearts -= amount;
    const { gained, lost } = gain(state, 'diamonds', amount / 2);
    text = `The quartermasters sent ${amount}♥ up to market and brought back ${gained}♦` +
      (lost ? ` (${lost}♦ more than the vaults could hold was lost)` : '') + '.';
  } else if (give === 'diamonds') {
    state.res.diamonds -= amount;
    const { gained, lost } = gain(state, 'hearts', amount * 2);
    text = `${amount}♦ were traded away for ${gained}♥ of stone, timber and iron` +
      (lost ? ` (${lost}♥ would not fit in the stores)` : '') + '.';
  } else {
    throw new GameError('Trade ♥ or ♦.');
  }
  state.flags.traded = true;
  write(state, text, { page: RULES.trading.page, title: RULES.trading.title, quote: RULES.trading.text });
}

// ---------------------------------------------------------------- build (p. 5, R27)

export function buildableSquares(state, roomId) {
  const def = ROOMS[roomId];
  if (!def) return [];
  const out = [];
  const consider = new Map();
  for (const [k, c] of Object.entries(state.cells)) {
    if (!isHoldCell(c)) continue;
    const [x, y] = k.split(',').map(Number);
    if (!isConnected(state, x, y)) continue;
    for (const d of DIRS) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (ny < 0) continue;
      const nk = key(nx, ny);
      const target = state.cells[nk];
      if (target && target.type !== 'cavern') continue;
      if (target && target.flooded) continue;
      const okDir =
        def.placement === 'sideways' ? d.dy === 0 :
          def.placement === 'below' ? d.dy === 1 : true;
      if (okDir) consider.set(nk, { x: nx, y: ny });
    }
  }
  for (const p of consider.values()) out.push(p);
  return out;
}

function build(state, { x, y, room }) {
  requirePhase(state, ['trade', 'build'], 'build');
  const def = ROOMS[room];
  if (!def) throw new GameError('No such room.');
  if (!def.implemented) throw new GameError(`${def.name} isn’t in the game yet.`);
  if (state.flags.roomBuilt) throw new GameError('You may build only one room per turn (p. 5).');
  if (!buildableSquares(state, room).some((p) => p.x === x && p.y === y)) {
    throw new GameError(def.placement === 'sideways' ? 'Corridors go to the left or right of a room or cavern.' :
      def.placement === 'below' ? 'Stairs go below a room or cavern.' :
        'Rooms must be built on an unexplored square or empty cavern next to your hold.');
  }
  pay(state, def.cost);
  state.phase = 'build';
  const k = key(x, y);
  const wasCavern = !!state.cells[k];
  state.cells[k] = { type: 'room', room, built: state.turn };
  if (room === 'stairs') setLink(state, x, y - 1, 'stairs');
  else if (!wasCavern) connectNewSquare(state, x, y);
  state.flags.roomBuilt = true;
  if (def.countsForScore) state.stats.roomsBuilt += 1;
  state.stats.maxDepth = Math.max(state.stats.maxDepth, depthOf(y));
  write(state, `${roomPhrase(room)} at depth ${depthOf(y)}${wasCavern ? ', carved from an empty cavern' : ''} ` +
    `(${costText(def.cost)}).`, { page: def.page, title: def.name, quote: def.text });
}

function roomPhrase(room) {
  return {
    corridor: 'A corridor was hewn',
    stairs: 'A flight of stairs was cut downward',
    barracks: 'A Barracks was raised, its bunks smelling of fresh pine',
  }[room] || `A ${ROOMS[room].name} was built`;
}

// ---------------------------------------------------------------- recruit (p. 6)

export function roomDef(cell) {
  if (!cell || !cell.room) return null;
  return ROOMS[cell.room] || FOUND_ROOMS[cell.room];
}

export function housingFor(state, x, y) {
  const cell = getCell(state, x, y);
  const def = roomDef(cell);
  if (!def || !def.houses) return null;
  const h = state.housing[key(x, y)] || { unit: null, count: 0 };
  return { def, houses: def.houses, unit: h.unit, count: h.count, capacity: def.houses.capacity };
}

function recruit(state, { x, y, unit, count = 1 }) {
  requirePhase(state, ['trade', 'build', 'recruit'], 'recruit');
  const u = UNITS[unit];
  if (!u || !u.implemented) throw new GameError('That unit can’t be recruited yet.');
  const h = housingFor(state, x, y);
  if (!h) throw new GameError('That room can’t house units.');
  if (!h.houses.units.includes(unit)) throw new GameError(`A ${h.def.name} can’t house ${u.plural}.`);
  const cell = getCell(state, x, y);
  if (cell.damaged) throw new GameError('Repair the room first.');
  if (!isConnected(state, x, y)) throw new GameError('That room is cut off from the Entrance.');
  if (h.count > 0 && h.unit && h.unit !== unit) {
    throw new GameError(`This ${h.def.name} already houses ${UNITS[h.unit].plural}; they won’t share.`);
  }
  if (!(count > 0)) throw new GameError('Recruit at least one.');
  if (h.count + count > h.capacity) throw new GameError(`Only ${h.capacity - h.count} more will fit there.`);
  const cost = { diamonds: (u.cost.diamonds || 0) * count, hearts: (u.cost.hearts || 0) * count };
  pay(state, cost);
  state.phase = 'recruit';
  state.housing[key(x, y)] = { unit, count: h.count + count };
  write(state, `${count} ${count === 1 ? u.name : u.plural} answered the call and took up quarters in the ` +
    `${h.def.name} (${costText(cost)}).`, { page: RULES.recruiting.page, title: RULES.recruiting.title, quote: RULES.recruiting.text });
}

// ---------------------------------------------------------------- end of turn

function endTurn(state) {
  requirePhase(state, ['trade', 'build', 'recruit'], 'end the turn');
  // End-of-turn checks (Demon portals, Circus, God Mushroom, …) arrive with those discoveries.
  state.stats.turnsSurvived += 1;
  state.turn += 1;
  state.flags = { traded: false, roomBuilt: false };
  // Start-of-turn effects (Crystal Caverns, Prisons, …) arrive with those rooms.
  state.phase = 'explore';
}

// ---------------------------------------------------------------- score (R31)

export function scoreBreakdown(state) {
  const killStr = state.stats.kills.reduce((a, k) => a + k.baseStr, 0);
  const parts = [
    { label: 'Depth reached', detail: `${state.stats.maxDepth} × 10`, points: state.stats.maxDepth * 10 },
    { label: 'Rooms built', detail: `${state.stats.roomsBuilt} × 5`, points: state.stats.roomsBuilt * 5 },
    { label: 'Enemies slain', detail: `${state.stats.kills.length} foes, base STR`, points: killStr },
    { label: 'Turns survived', detail: `${state.stats.turnsSurvived} × 1`, points: state.stats.turnsSurvived },
    { label: 'Leftover ♥ + ♦', detail: `${state.res.hearts} + ${state.res.diamonds}`, points: state.res.hearts + state.res.diamonds },
    { label: 'Units lost', detail: `${state.stats.unitsLost} × −2`, points: -2 * state.stats.unitsLost },
  ];
  if (state.over && state.over.reason === 'voidCrystal') {
    parts.push({ label: 'The Void Crystal', detail: 'victory', points: 200 }); // R32
  }
  return { parts, total: parts.reduce((a, p) => a + p.points, 0) };
}
