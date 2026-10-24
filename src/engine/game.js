// The rules engine. Pure state → state. No DOM in here.
// `apply(state, action)` returns a new state or throws GameError; the UI keeps the undo
// history. Turn order (p. 44, RULINGS errata): start → explore → combat → trade → build →
// recruit → end.

import { ROOMS, FOUND_ROOMS } from '../data/rooms.js';
import { UNITS } from '../data/units.js';
import { SPADES, CLUBS } from '../data/discoveries.js';
import { RULES } from '../data/rules.js';
import { SUITS } from '../data/cards.js';
import { drawCard, parseCard, cardLabel, rollD4, rollD2 } from './deck.js';
import {
  ENTRANCE, key, parseKey, getCell, depthOf, isHoldCell, isConnected, explorableSquares,
  connectNewSquare, setLink, DIRS, isWet,
} from './grid.js';
import { write, hashPick, DIR_WORDS, MINING_LINES } from './chronicle.js';
import { startCombat, combatAction } from './combat.js';
import { GameError } from './errors.js';
import { capOf, gain, canAfford, pay, costText, gainText, BASE_CAP } from './economy.js';
import { naturalFormation, remnant, enemyFromLair, drawOnTable } from './discover.js';
import { drain, drainCost, flammableSquaresAround, explode } from './flow.js';

export { GameError, capOf, gain, canAfford, costText, BASE_CAP };
export { growShape } from './discover.js';

export const PHASES = ['start', 'explore', 'combat', 'trade', 'build', 'recruit', 'end'];
const MANAGE = ['trade', 'build', 'recruit'];

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
    lairs: {},
    artefacts: [],
    unlocks: {},
    pending: null,
    deck: { stack: [], drawn: [], jokersIn: false, heldOut: {} },
    flags: { traded: false, roomBuilt: false, used: {} },
    combat: null,
    chronicle: [],
    stats: { maxDepth: 1, roomsBuilt: 0, kills: [], unitsLost: 0, turnsSurvived: 0 },
    lastCard: null,
    lastDraws: [],
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

// Older saves (0.1.x) lack the newer fields; their crypt lairs were stored on the square itself.
export function upgrade(state) {
  state.lairs = state.lairs || {};
  for (const [k, c] of Object.entries(state.cells)) {
    if (c.type !== 'lair' || typeof c.lair !== 'object') continue;
    const id = `L${state.nextId++}`;
    const depth = depthOf(parseKey(k).y);
    state.lairs[id] = {
      id, card: c.lair.card, entryKey: 'S2', name: 'Forgotten crypt', foe: 'Undead', baseStr: 20, str: 20 + 5 * depth,
      squares: [k], home: k, behaviour: 'march', clearsTo: 'crypt', thief: 0,
    };
    for (const e of (state.combat && state.combat.enemies) || []) if (e.lair === k) { e.lairId = id; e.behaviour = 'march'; }
    c.lair = id;
  }
  if (state.combat) {
    state.combat.enemyShots = state.combat.enemyShots || [];
    state.combat.skullDeaths = state.combat.skullDeaths || {};
    state.combat.after = state.combat.after || 'trade';
  }
  state.artefacts = state.artefacts || [];
  state.unlocks = state.unlocks || {};
  state.lastDraws = state.lastDraws || [];
  state.flags.used = state.flags.used || {};
  if (state.pending === undefined) state.pending = null;
  return state;
}

// ---------------------------------------------------------------- dispatcher

const HOLD_ACTIONS = {
  useWell, stealHoard, openSealed, templeCleric, destroyPortal, attackLair, drainSquare, repair,
};

export function apply(prev, action) {
  if (prev.over) throw new GameError('This hold’s story is over.');
  const state = upgrade(JSON.parse(JSON.stringify(prev))); // plain data; works in older browsers too
  if (state.pending && !['choose'].includes(action.type)) {
    throw new GameError(state.pending.kind === 'artefact' ? 'First choose a room for the artefact.' : 'First choose what the abandoned room was.');
  }
  switch (action.type) {
    case 'explore': explore(state, action); break;
    case 'skipExplore': skipExplore(state); break;
    case 'trade': trade(state, action); break;
    case 'build': build(state, action); break;
    case 'recruit': recruit(state, action); break;
    case 'endTurn': endTurn(state); break;
    case 'choose': choose(state, action); break;
    case 'moveTroop':
    case 'fire':
    case 'endRound':
    case 'withdraw':
      if (state.phase !== 'combat') throw new GameError('There is no fight going on.');
      combatAction(state, action);
      break;
    default: {
      const fn = HOLD_ACTIONS[action.type];
      if (!fn) throw new GameError(`Unknown action ${action.type}`);
      requirePhase(state, MANAGE, 'do that');
      fn(state, action);
    }
  }
  if (state.phase === 'combat' && !state.combat && !state.over) {
    // A fight just ended: carry on where it interrupted.
    if (state.afterCombat === 'newTurn') startTurn(state);
    else state.phase = MANAGE.includes(state.afterCombat) ? state.afterCombat : 'trade';
  } else if (state.combat && !state.over) {
    state.phase = 'combat';
  }
  return state;
}

function requirePhase(state, allowed, verb) {
  if (!allowed.includes(state.phase)) {
    throw new GameError(`You can’t ${verb} during the ${state.phase} step.`);
  }
}

function cellAt(state, x, y, what) {
  const c = getCell(state, x, y);
  if (!c) throw new GameError(`There is no ${what} there.`);
  return c;
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
  state.lastDraws = [];

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
    // Jokers only enter at depth 5 (p. 33); Legendary Finds come later.
    state.cells[key(x, y)] = { type: 'cavern', feature: 'cave', found: { card: id } };
    connectNewSquare(state, x, y);
    write(state, `A strange card, the ${card.name}, came up. Its legend is not yet written into this game.`);
  } else if (card.suit === 'H' || card.suit === 'D') {
    mineResources(state, x, y, card, depth, dir);
  } else if (card.suit === 'C') {
    naturalFormation(state, x, y, card, depth, dir);
  } else {
    remnant(state, x, y, card, depth, dir);
  }

  state.phase = state.combat ? 'combat' : 'trade';
}

// R48: when water, lava or lairs leave nothing to explore, the turn goes on without a draw.
function skipExplore(state) {
  requirePhase(state, ['explore'], 'skip exploring');
  if (explorableSquares(state).length) throw new GameError('There is still rock to dig: you must explore.');
  state.lastDraws = [];
  write(state, 'There was nowhere left to dig: water, fire or foes hemmed the hold in. The miners rested.');
  state.phase = 'trade';
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
  state.cells[key(x, y)] = { type: 'cavern', feature: 'cave', found: { card: card.id } };
  connectNewSquare(state, x, y);
  const { gained, lost } = gain(state, kind, amount);
  const sym = SUITS[card.suit].symbol;
  const opener = hashPick(MINING_LINES[kind], state.turn, x, y);
  const where = hashPick(DIR_WORDS[dir], state.turn, x);
  let text = `Digging ${where} at depth ${depth}: ${opener}. ${cardLabel(card.id)}: ` +
    `${card.value} + ${depth} for depth = ${amount}${sym}.`;
  if (lost) text += ` The storerooms could hold only ${gained}; ${lost}${sym} was left in the dark (cap ${capOf(state, kind)}).`;
  const rule = RULES[kind];
  write(state, text, { card: card.id, page: rule.page, title: rule.title, quote: rule.text });
}

// ---------------------------------------------------------------- choices after a find

export function chooseOptions(state) {
  const p = state.pending;
  if (!p) return [];
  if (p.kind === 'abandonedRoom') {
    return Object.entries(ROOMS).filter(([, r]) => r.implemented).map(([id, r]) => ({ id, label: r.name }));
  }
  if (p.kind === 'artefact') {
    return Object.keys(state.cells).map(parseKey).filter((q) => housingFor(state, q.x, q.y))
      .map((q) => ({ id: key(q.x, q.y), label: `${housingFor(state, q.x, q.y).def.name} (depth ${depthOf(q.y)})` }));
  }
  return [];
}

function choose(state, { option }) {
  const p = state.pending;
  if (!p) throw new GameError('There is nothing to choose.');
  if (!chooseOptions(state).some((o) => o.id === option)) throw new GameError('That isn’t one of the choices.');
  if (p.kind === 'abandonedRoom') {
    const def = ROOMS[option];
    state.cells[key(p.x, p.y)] = { type: 'room', room: option, found: { card: p.card } }; // R31: found rooms don't score
    if (option === 'stairs' && getCell(state, p.x, p.y - 1)) setLink(state, p.x, p.y - 1, 'stairs');
    write(state, `The abandoned room had once been a ${def.name}. With a little sweeping, it was so again.`,
      { page: def.page, title: def.name, quote: def.text });
  } else if (p.kind === 'artefact') {
    const h = housingFor(state, ...option.split(',').map(Number));
    state.artefacts.push({ home: option, bonus: p.bonus, card: p.card });
    write(state, `The artefact was hung in the ${h.def.name}. Troops from there now fight with +${p.bonus} STR.`,
      { card: p.card, page: SPADES.J.page, title: SPADES.J.name, quote: SPADES.J.text });
  }
  state.pending = null;
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
    const g = gain(state, 'diamonds', amount / 2);
    text = `The quartermasters sent ${amount}♥ up to market and brought back ${gainText('diamonds', g)}.`;
  } else if (give === 'diamonds') {
    state.res.diamonds -= amount;
    const g = gain(state, 'hearts', amount * 2);
    text = `${amount}♦ were traded away for ${gainText('hearts', g)} of stone, timber and iron.`;
  } else {
    throw new GameError('Trade ♥ or ♦.');
  }
  state.flags.traded = true;
  write(state, text, { page: RULES.trading.page, title: RULES.trading.title, quote: RULES.trading.text });
}

// ---------------------------------------------------------------- build (p. 5, R27)

// A square a room may go on: unexplored rock, or an empty cavern (R27a). Corridors may also
// bridge water (p. 9: "The only rooms that can be built on water are Corridors and Drawbridges").
function canBuildOn(target, roomId) {
  if (!target) return true;
  if (target.type !== 'cavern' || target.noBuild || target.gas) return false;
  if (target.liquid) return target.liquid === 'water' && roomId === 'corridor';
  return true;
}

export function buildableSquares(state, roomId) {
  const def = ROOMS[roomId];
  if (!def) return [];
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
      if (!canBuildOn(state.cells[nk], roomId)) continue;
      const okDir =
        def.placement === 'sideways' ? d.dy === 0 :
          def.placement === 'below' ? d.dy === 1 : true;
      if (okDir) consider.set(nk, { x: nx, y: ny });
    }
  }
  return [...consider.values()];
}

// What a room costs on this square: a forest is cut down for a free room (A♣, R45).
export function buildCost(state, room, x, y) {
  const target = getCell(state, x, y);
  if (target && target.feature === 'forest') return {};
  return ROOMS[room].cost;
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
  const cost = buildCost(state, room, x, y);
  pay(state, cost);
  state.phase = 'build';
  const k = key(x, y);
  const was = state.cells[k];
  state.cells[k] = { type: 'room', room, built: state.turn };
  if (was && was.liquid === 'water') state.cells[k].bridge = true;
  if (room === 'stairs') setLink(state, x, y - 1, 'stairs');
  else if (!was) connectNewSquare(state, x, y);
  state.flags.roomBuilt = true;
  if (def.countsForScore) state.stats.roomsBuilt += 1;
  state.stats.maxDepth = Math.max(state.stats.maxDepth, depthOf(y));
  const how = !was ? '' : was.feature === 'forest' ? ', the forest felled for its timber' :
    was.liquid ? ', bridging the water' : ', carved from an empty cavern';
  write(state, `${roomPhrase(room)} at depth ${depthOf(y)}${how} (${costText(cost)}).`,
    { page: def.page, title: def.name, quote: def.text });
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
  requirePhase(state, MANAGE, 'recruit');
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
  const verb = unit === 'skullDwarf' ? 'were summoned from their tombs into' : 'answered the call and took up quarters in';
  write(state, `${count} ${count === 1 ? u.name : u.plural} ${verb} the ${h.def.name} (${costText(cost)}).`,
    { page: RULES.recruiting.page, title: RULES.recruiting.title, quote: RULES.recruiting.text });
}

// ---------------------------------------------------------------- places in the hold

// Everything the Overseer can do with the hold's special places this turn, for the UI.
export function holdActions(state) {
  if (!MANAGE.includes(state.phase) || state.pending) return [];
  const out = [];
  const used = state.flags.used || {};
  for (const [k, c] of Object.entries(state.cells)) {
    const { x, y } = parseKey(k);
    const d = depthOf(y);
    const reach = isConnected(state, x, y) || adjacentToHold(state, x, y);
    if (c.room === 'well' && reach) {
      out.push({ type: 'useWell', x, y, label: `Make a wish at the well (depth ${d})`, cost: SPADES[3].useCost, disabled: used[`well${k}`] ? 'used this turn' : null });
    }
    if (c.room === 'sealed' && reach) out.push({ type: 'openSealed', x, y, label: `Open the sealed room (depth ${d})`, cost: {} });
    if (c.room === 'buriedTemple' && reach && !c.used) {
      out.push({ type: 'templeCleric', x, y, label: `Recruit a Cleric at the buried temple (depth ${d})`, cost: SPADES[6].clericCost });
    }
    if (c.room === 'portal' && reach) {
      const cleric = findCleric(state);
      out.push({ type: 'destroyPortal', x, y, label: `Close the demon portal (depth ${d}): 20♦ and a Cleric’s life`, cost: SPADES[9].destroyCost, disabled: cleric ? null : 'needs a Cleric' });
    }
    if (isWet(c) || c.gas) {
      if (reach) out.push({ type: 'drainSquare', x, y, label: `Drain the ${c.liquid || (c.gas ? `${c.gas} gas` : 'water')} at depth ${d}`, cost: drainCost(c) });
    }
    if (c.damaged && reach) {
      out.push({ type: 'repair', x, y, label: `Repair the ${roomDef(c).name} at depth ${d}`, cost: repairCost(c) });
    }
  }
  for (const lair of Object.values(state.lairs)) {
    const { x, y } = parseKey(lair.home);
    if (!adjacentToHold(state, x, y) && !lair.squares.some((k) => adjacentToHold(state, ...k.split(',').map(Number)))) continue;
    if (lair.wyrm) {
      out.push({ type: 'stealHoard', x, y, label: `Steal 20♦ from the sleeping Wyrm (depth ${depthOf(y)})`, cost: {}, disabled: used[`wyrm${lair.id}`] ? 'stolen this turn' : null });
    }
    const verb = lair.wyrm ? 'Attack the Wyrm' : lair.clearsTo === 'golemForge' ? 'Claim the golem forge' : `Attack the ${lair.foe}`;
    out.push({ type: 'attackLair', x, y, label: `${verb} (${lair.str} STR, depth ${depthOf(y)})`, cost: {} });
  }
  return out.map((a) => ({ ...a, disabled: a.disabled || (canAfford(state, a.cost) ? null : `needs ${costText(a.cost)}`) }));
}

function adjacentToHold(state, x, y) {
  return DIRS.some((d) => isHoldCell(getCell(state, x + d.dx, y + d.dy)) && isConnected(state, x + d.dx, y + d.dy));
}

function requireAction(state, type, x, y) {
  const a = holdActions(state).find((o) => o.type === type && o.x === x && o.y === y);
  if (!a) throw new GameError('You can’t do that there.');
  if (a.disabled) throw new GameError(`Not now: ${a.disabled}.`);
  return a;
}

function useWell(state, { x, y }) {
  const a = requireAction(state, 'useWell', x, y);
  pay(state, a.cost);
  state.flags.used[`well${key(x, y)}`] = true;
  state.lastDraws = [];
  write(state, 'A coin of 10♦ dropped into the wishing well, and something answered.',
    { page: SPADES[3].page, title: SPADES[3].name, quote: SPADES[3].text });
  const { roll } = rollD2(state);
  drawOnTable(state, roll === 1 ? 'good' : 'bad', `The well (1D2 rolled ${roll}) gave`);
}

function stealHoard(state, { x, y }) {
  requireAction(state, 'stealHoard', x, y);
  const lair = Object.values(state.lairs).find((l) => l.home === key(x, y));
  state.flags.used[`wyrm${lair.id}`] = true;
  const g = gain(state, 'diamonds', lair.steal);
  const { roll } = rollD4(state);
  if (roll === 1) {
    write(state, `The thieves crept onto the hoard and came back with ${gainText('diamonds', g)}, but the 1D4 rolled 1. ` +
      `An eye opened. The Wyrm awoke, and the hoard was lost in its fury (${lair.str} STR, Ranged).`,
    { page: SPADES.Q.page, title: SPADES.Q.name, quote: SPADES.Q.text });
    wakeWyrm(state, lair);
  } else {
    write(state, `Thieves crept across the sleeping Wyrm's hoard and came back with ${gainText('diamonds', g)} (1D4 rolled ${roll}). It slept on.`,
      { page: SPADES.Q.page, title: SPADES.Q.name, quote: SPADES.Q.text });
  }
}

function wakeWyrm(state, lair) {
  lair.behaviour = 'march';
  lair.steal = 0;
  const e = enemyFromLair(lair);
  e.behaviour = 'march';
  startCombat(state, [e], { after: state.phase });
}

function openSealed(state, { x, y }) {
  requireAction(state, 'openSealed', x, y);
  const cell = getCell(state, x, y);
  state.cells[key(x, y)] = { type: 'room', room: 'openedRoom', found: cell.found };
  state.lastDraws = [];
  write(state, `The chains were struck from the sealed room. Within: a ${cell.trapped || 'nameless evil'}.`,
    { page: SPADES[4].page, title: SPADES[4].name, quote: SPADES[4].text });
  drawOnTable(state, 'bad', 'It unleashed');
}

function findCleric(state) {
  return Object.entries(state.housing).find(([, h]) => h.unit === 'cleric' && h.count > 0);
}

function templeCleric(state, { x, y }) {
  const a = requireAction(state, 'templeCleric', x, y);
  pay(state, a.cost);
  const k = key(x, y);
  state.cells[k].used = true;
  state.housing[k] = { unit: 'cleric', count: 1 };
  state.lastDraws = [];
  const { roll } = rollD4(state);
  write(state, `A Cleric took vows at the buried temple (8♦) and prayed at its altar (1D4 rolled ${roll}).`,
    { page: SPADES[6].page, title: SPADES[6].name, quote: SPADES[6].text });
  drawOnTable(state, roll === 4 ? 'good' : 'bad', 'The temple answered with');
}

function destroyPortal(state, { x, y }) {
  const a = requireAction(state, 'destroyPortal', x, y);
  const [ck, h] = findCleric(state);
  pay(state, a.cost);
  h.count -= 1;
  state.stats.unitsLost += 1;
  state.cells[key(x, y)] = { type: 'cavern', feature: 'ruins', found: getCell(state, x, y).found };
  write(state, `For 20♦ and the life of the Cleric from the ${roomDef(state.cells[ck]).name}, the demon portal was sealed forever.`,
    { page: SPADES[9].page, title: SPADES[9].name, quote: SPADES[9].text });
}

function attackLair(state, { x, y }) {
  requireAction(state, 'attackLair', x, y);
  const lair = Object.values(state.lairs).find((l) => l.home === key(x, y));
  if (lair.wyrm) {
    write(state, 'The Overseer sent Troops against the sleeping Wyrm. It woke.', { page: SPADES.Q.page, title: SPADES.Q.name, quote: SPADES.Q.text });
    return wakeWyrm(state, lair);
  }
  const e = enemyFromLair(lair);
  if (e.behaviour === 'raid') e.behaviour = 'guard'; // a cornered creature defends its den
  write(state, `The Overseer sent Troops against the ${lair.foe} (${lair.str} STR).`);
  startCombat(state, [e], { after: state.phase });
}

function drainSquare(state, { x, y }) {
  const a = requireAction(state, 'drainSquare', x, y);
  pay(state, a.cost);
  const { wasLava } = drain(state, x, y);
  write(state, `The square at depth ${depthOf(y)} was drained (${costText(a.cost)})${wasLava ? '; the lava left the room damaged' : ''}.`,
    { page: 5, title: 'Draining', quote: 'Rooms filled by liquid or gas can be drained at a cost of 5♦. Lava can be drained for 20♦, but treat that room as damaged after it is drained.' });
}

// p. 5: "pay ½ of the room's cost (rounded down)".
export function repairCost(cell) {
  const cost = (ROOMS[cell.room] || {}).cost || {};
  return { hearts: Math.floor((cost.hearts || 0) / 2), diamonds: Math.floor((cost.diamonds || 0) / 2) };
}

function repair(state, { x, y }) {
  const a = requireAction(state, 'repair', x, y);
  pay(state, a.cost);
  const cell = getCell(state, x, y);
  delete cell.damaged;
  write(state, `The ${roomDef(cell).name} at depth ${depthOf(y)} was repaired (${costText(a.cost)}).`,
    { page: 5, title: 'Repairing', quote: 'To repair a damaged room, pay ½ of the room’s cost (rounded down) from your supply.' });
}

// ---------------------------------------------------------------- turn boundaries (p. 44)

function endTurn(state) {
  requirePhase(state, MANAGE, 'end the turn');
  state.stats.turnsSurvived += 1;
  // End of turn: Demon portals (9♠) roll 1D4; on 1, Demons spawn (R46).
  const spawns = [];
  for (const [k, c] of Object.entries(state.cells)) {
    if (c.room !== 'portal') continue;
    const { x, y } = parseKey(k);
    const { roll } = rollD4(state);
    const spec = SPADES[9].spawn;
    if (roll === spec.onRoll) {
      const str = spec.str + 5 * depthOf(y);
      spawns.push({ name: spec.foe, baseStr: spec.str, str, x, y, behaviour: 'march' });
      write(state, `At the turn's end the demon portal at depth ${depthOf(y)} tore open (1D4 rolled 1): ${spec.foe}, ${spec.str} + ${5 * depthOf(y)} for depth = ${str} STR!`,
        { page: SPADES[9].page, title: SPADES[9].name, quote: SPADES[9].text });
    }
  }
  if (spawns.length) {
    startCombat(state, spawns, { after: 'newTurn' });
    state.phase = 'combat';
    return;
  }
  startTurn(state);
}

function startTurn(state) {
  state.turn += 1;
  state.flags = { traded: false, roomBuilt: false, used: {} };
  state.lastDraws = [];
  state.afterCombat = null;
  const notes = [];
  // Underground forests (A♣): "keep for 2♥ per turn".
  const forests = Object.entries(state.cells).filter(([k, c]) => c.feature === 'forest' && isConnected(state, ...k.split(',').map(Number)));
  if (forests.length) {
    const per = CLUBS.A.incomePerTurn.hearts;
    const g = gain(state, 'hearts', per * forests.length);
    notes.push(`the forest${forests.length > 1 ? 's' : ''} gave ${gainText('hearts', g)}`);
  }
  // Crystal caverns (6♣): a card each, ♦ = value + cavern's depth; the A♦ destroys it (R47).
  const groups = new Map();
  for (const [k, c] of Object.entries(state.cells)) {
    if (c.type !== 'crystal') continue;
    const p = parseKey(k);
    if (!groups.has(c.group) || p.y < groups.get(c.group).y) groups.set(c.group, p);
  }
  for (const [group, p] of groups) {
    let card;
    do { card = parseCard(drawCard(state, 'Crystal cavern')); } while (card.joker);
    if (card.id === 'AD') {
      for (const c of Object.values(state.cells)) {
        if (c.type === 'crystal' && c.group === group) { c.type = 'cavern'; c.feature = 'ruins'; }
      }
      notes.push(`the crystal cavern at depth ${depthOf(p.y)} drew the A♦ and shattered`);
    } else {
      const amount = card.value + depthOf(p.y);
      const g = gain(state, 'diamonds', amount);
      notes.push(`the crystal cavern at depth ${depthOf(p.y)} drew ${cardLabel(card.id)} for ${gainText('diamonds', g)}`);
    }
  }
  if (notes.length) {
    write(state, `As turn ${state.turn} began, ${notes.join('; ')}.`,
      { page: 44, title: 'Start of turn', quote: 'Draw a card for any Crystal Caverns in your hold.' });
  }
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

export { explode, flammableSquaresAround };
