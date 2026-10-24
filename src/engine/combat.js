// Combat, pp. 7–8. RULINGS R16–R22.

import { UNITS } from '../data/units.js';
import { RULES } from '../data/rules.js';
import { FOUND_ROOMS } from '../data/rooms.js';
import {
  ENTRANCE, key, parseKey, getCell, isConnected, enemyRoute, connectedNeighbours, stepsWithin,
} from './grid.js';
import { write } from './chronicle.js';
import { GameError } from './errors.js';


const at = (a, b) => a.x === b.x && a.y === b.y;

export function troopStr(t) {
  return t.hp;
}

// Troops spawn from every connected, undamaged room that houses units (p. 6, p. 7).
function spawnTroops(state) {
  const troops = [];
  for (const [k, h] of Object.entries(state.housing)) {
    if (!h.count) continue;
    const { x, y } = parseKey(k);
    const cell = getCell(state, x, y);
    if (!cell || cell.damaged || cell.claimed || !isConnected(state, x, y)) continue;
    const u = UNITS[h.unit];
    troops.push({
      id: `t${state.nextId++}`, unit: h.unit, count: h.count, unitStr: u.str,
      hp: h.count * u.str, startCount: h.count, x, y, home: k,
      acted: false, moved: false,
    });
  }
  return troops;
}

export function startCombat(state, enemies) {
  state.combat = {
    round: 0,
    enemies: enemies.map((e) => ({
      id: `e${state.nextId++}`, climb: 0, stopped: 0, ...e,
    })),
    troops: spawnTroops(state),
    shots: [],
    log: [],
    lostAtStart: state.stats.unitsLost,
  };
  const names = state.combat.troops.map((t) => `${t.count} ${t.count === 1 ? UNITS[t.unit].name : UNITS[t.unit].plural}`);
  write(state, names.length
    ? `Horns sounded through the hold. ${names.join(', ')} mustered from their quarters.`
    : 'Horns sounded through the hold, but no dwarves were left to answer.',
  { page: RULES.combat.page, title: 'Starting combat', quote: 'To begin combat, spawn the enemy you discovered … Your rooms that spawn units at the start of combat do so now.' });
  beginRound(state);
}

function log(state, text) {
  state.combat.log.push({ round: state.combat.round, text });
}

function troopsAt(state, p) {
  return state.combat.troops.filter((t) => at(t, p));
}

function enemiesAt(state, p) {
  return state.combat.enemies.filter((e) => at(e, p));
}

// Enemies move first (p. 7), then the player acts.
function beginRound(state) {
  const c = state.combat;
  c.round += 1;
  c.shots = [];
  for (const t of c.troops) { t.acted = false; t.moved = false; }

  for (const e of c.enemies) {
    e.moved = false;
    // R22: an enemy that stood on the Entrance and still lives escapes.
    if (at(e, ENTRANCE)) {
      holdFalls(state, e);
      return;
    }
    if (troopsAt(state, e).length) { log(state, `${e.name} stands and fights.`); continue; } // R18
    if (e.stopped > 0) { e.stopped -= 1; log(state, `${e.name} is held fast.`); continue; }
    const route = enemyRoute(state, e);
    if (!route) {
      // R23 Takeover: arrives with the full rules for traps & barricades.
      if (!e.stuckNoted) {
        log(state, `${e.name} can find no way to the Entrance and lurks where it is.`);
        e.stuckNoted = true;
      }
      continue;
    }
    const step = route.path[0];
    if (step.cost > 1) {
      // R14: climbing anything but stairs takes 2 rounds per space.
      e.climb += 1;
      if (e.climb < step.cost) { log(state, `${e.name} claws its way up the shaft.`); continue; }
    }
    e.climb = 0;
    e.x = step.x;
    e.y = step.y;
    e.moved = true;
    const here = troopsAt(state, e);
    log(state, here.length
      ? `${e.name} advances and crashes into ${here.map(troopName).join(' and ')}!`
      : `${e.name} advances toward the Entrance.`);
  }
}

export function troopName(t) {
  const u = UNITS[t.unit];
  return `${t.count} ${t.count === 1 ? u.name : u.plural}`;
}

export function legalTroopMoves(state, troop) {
  if (troop.acted) return [];
  if (enemiesAt(state, troop).length) return []; // R18: engaged troops stand and fight
  return connectedNeighbours(state, troop.x, troop.y, 'dwarf');
}

export function legalTargets(state, troop) {
  const u = UNITS[troop.unit];
  if (!u.ranged || troop.acted) return [];
  if (u.oncePerCombat && troop.fired) return [];
  if (enemiesAt(state, troop).length) return [];
  const steps = stepsWithin(state, troop, 2);
  return state.combat.enemies.filter((e) => steps.has(key(e.x, e.y)) && !at(e, troop));
}

export function combatAction(state, action) {
  const c = state.combat;
  if (action.type === 'endRound') return endRound(state);
  const troop = c.troops.find((t) => t.id === action.troopId);
  if (!troop) throw new GameError('No such Troop.');
  if (action.type === 'moveTroop') {
    const ok = legalTroopMoves(state, troop).some((p) => p.x === action.x && p.y === action.y);
    if (!ok) throw new GameError('That Troop can’t move there.');
    troop.x = action.x;
    troop.y = action.y;
    troop.acted = true;
    troop.moved = true;
    const foes = enemiesAt(state, troop);
    log(state, foes.length ? `${troopName(troop)} charge into ${foes.map((e) => e.name).join(' and ')}!` : `${troopName(troop)} move up.`);
  } else if (action.type === 'fire') {
    const target = legalTargets(state, troop).find((e) => e.id === action.enemyId);
    if (!target) throw new GameError('No clear shot at that enemy.');
    troop.acted = true;
    troop.fired = true;
    c.shots.push({ troopId: troop.id, enemyId: target.id, dmg: troopStr(troop) });
    log(state, `${troopName(troop)} loose a volley at ${target.name}.`);
  }
}

// R20: your damage goes to the weakest enemy first, carrying over.
function spreadOnEnemies(enemies, dmg, pending) {
  const order = [...enemies].sort((a, b) => (a.str - (pending.get(a.id) || 0)) - (b.str - (pending.get(b.id) || 0)));
  for (const e of order) {
    if (dmg <= 0) break;
    const left = e.str - (pending.get(e.id) || 0);
    if (left <= 0) continue;
    const d = Math.min(left, dmg);
    pending.set(e.id, (pending.get(e.id) || 0) + d);
    dmg -= d;
  }
}

// R20: enemy damage goes to the strongest Troop first, carrying over.
function spreadOnTroops(troops, dmg, pending) {
  const order = [...troops].sort((a, b) => b.hp - a.hp);
  for (const t of order) {
    if (dmg <= 0) break;
    const left = t.hp - (pending.get(t.id) || 0);
    if (left <= 0) continue;
    const d = Math.min(left, dmg);
    pending.set(t.id, (pending.get(t.id) || 0) + d);
    dmg -= d;
  }
}

// All damage lands at once at the end of the round (p. 7).
function endRound(state) {
  const c = state.combat;
  const onEnemy = new Map();
  const onTroop = new Map();

  // Ranged shots first decide their targets, but land at the same moment as everything else.
  for (const s of c.shots) {
    const e = c.enemies.find((x) => x.id === s.enemyId);
    if (e) spreadOnEnemies(enemiesAt(state, e), s.dmg, onEnemy);
  }
  // Fights: every square holding both sides (R18).
  const squares = new Set(c.enemies.map((e) => key(e.x, e.y)));
  for (const k of squares) {
    const p = parseKey(k);
    const ts = troopsAt(state, p);
    if (!ts.length) continue;
    const es = enemiesAt(state, p);
    const troopDmg = ts.reduce((a, t) => a + troopStr(t), 0);
    const enemyDmg = es.reduce((a, e) => a + e.str, 0);
    spreadOnEnemies(es, troopDmg, onEnemy);
    spreadOnTroops(ts, enemyDmg, onTroop);
  }

  for (const e of c.enemies) {
    const d = onEnemy.get(e.id) || 0;
    if (!d) continue;
    e.str -= d;
    log(state, e.str > 0 ? `${e.name} takes ${d} damage (${e.str} STR left).` : `${e.name} is destroyed!`);
  }
  for (const t of c.troops) {
    const d = onTroop.get(t.id) || 0;
    if (!d) continue;
    const before = t.count;
    t.hp -= d;
    t.count = Math.max(0, Math.ceil(t.hp / t.unitStr)); // R19
    const lost = before - t.count;
    state.stats.unitsLost += lost;
    log(state, t.count > 0
      ? `${UNITS[t.unit].plural} take ${d} damage${lost ? `; ${lost} fall` : ''} (${t.hp} STR left).`
      : `The last of the ${UNITS[t.unit].plural} from the ${homeName(state, t)} fall.`);
  }

  const dead = c.enemies.filter((e) => e.str <= 0);
  for (const e of dead) {
    state.stats.kills.push({ name: e.name, baseStr: e.baseStr, turn: state.turn });
    if (e.lair) clearLair(state, e);
  }
  c.enemies = c.enemies.filter((e) => e.str > 0);
  const fallen = c.troops.filter((t) => t.count <= 0);
  c.troops = c.troops.filter((t) => t.count > 0);
  for (const t of fallen) state.housing[t.home] = { unit: t.unit, count: 0 };

  if (!c.enemies.length) return endCombat(state);
  return beginRound(state);
}

function homeName(state, t) {
  const cell = state.cells[t.home];
  return (cell && (FOUND_ROOMS[cell.room] || {}).name) || (cell && cell.room) || 'hold';
}

function clearLair(state, e) {
  const cell = state.cells[e.lair];
  if (!cell || cell.type !== 'lair') return;
  if (state.combat.enemies.some((o) => o !== e && o.lair === e.lair && o.str > 0)) return;
  state.cells[e.lair] = { type: 'room', room: 'crypt', found: { card: cell.lair.card } };
}

function endCombat(state) {
  const c = state.combat;
  for (const t of c.troops) {
    // R19: survivors heal and go home.
    state.housing[t.home] = { unit: t.unit, count: t.count };
  }
  const lost = state.stats.unitsLost - c.lostAtStart;
  const deaths = c.log.filter((l) => /destroyed|fall/.test(l.text)).map((l) => l.text).join(' ');
  write(state, `After ${c.round} round${c.round === 1 ? '' : 's'} the fighting was done. ${deaths}` +
    (lost === 0 ? ' Not a single dwarf was lost.' : ` ${lost} dwarf${lost === 1 ? '' : 's'} will be mourned.`),
  { page: RULES.combat.page, title: RULES.combat.title, quote: RULES.combat.text });
  state.lastCombatLog = c.log;
  state.combat = null;
}

function holdFalls(state, e) {
  state.over = { reason: 'fallen', turn: state.turn, by: e.name };
  state.phase = 'over';
  state.lastCombatLog = state.combat.log;
  state.combat = null;
  write(state, `${e.name} burst up the stairwell and out into the daylight. The hold had fallen. ` +
    'Let the chronicle remember the dwarves who held the dark as long as they could.',
  { page: RULES.holdFalls.page, title: RULES.holdFalls.title, quote: RULES.holdFalls.text });
}
