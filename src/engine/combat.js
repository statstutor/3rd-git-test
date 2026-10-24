// Combat, pp. 7–8. RULINGS R16–R22, R39–R44.
// Enemy behaviours: 'march' (to the Entrance), 'raid' (J♣: nearest room, then home),
// 'guard' (Q♣, 10♠: holds its lair, attacks what enters), 'sleep' (the Wyrm, until woken).

import { UNITS } from '../data/units.js';
import { RULES } from '../data/rules.js';
import { FOUND_ROOMS, ROOMS } from '../data/rooms.js';
import {
  ENTRANCE, key, parseKey, getCell, isConnected, enemyRoute, connectedNeighbours, stepsWithin,
} from './grid.js';
import { write } from './chronicle.js';
import { rollD4 } from './deck.js';
import { GameError } from './errors.js';

const at = (a, b) => a.x === b.x && a.y === b.y;

export function troopStr(t) {
  return t.hp;
}

// Troops spawn from every connected, undamaged room that houses units (p. 6, p. 7).
// A Long lost artefact (J♠) adds +15 STR to Troops from its room (R43).
function spawnTroops(state) {
  const troops = [];
  for (const [k, h] of Object.entries(state.housing)) {
    if (!h.count) continue;
    const { x, y } = parseKey(k);
    const cell = getCell(state, x, y);
    if (!cell || cell.damaged || cell.claimed || cell.liquid || cell.gas === 'poison' || !isConnected(state, x, y)) continue;
    const u = UNITS[h.unit];
    const bonus = (state.artefacts || []).filter((a) => a.home === k).reduce((s, a) => s + a.bonus, 0);
    troops.push({
      id: `t${state.nextId++}`, unit: h.unit, count: h.count, unitStr: u.str, bonus,
      hp: h.count * u.str + bonus, startCount: h.count, x, y, home: k,
      acted: false, moved: false,
    });
  }
  return troops;
}

// opts.after: 'trade' (default) or 'newTurn' (combat begun by an end-of-turn event).
export function startCombat(state, enemies, opts = {}) {
  if (state.combat) {
    // Already fighting: newcomers join the same battle.
    for (const e of enemies) state.combat.enemies.push(makeEnemy(state, e));
    return;
  }
  state.combat = {
    round: 0,
    enemies: enemies.map((e) => makeEnemy(state, e)),
    troops: spawnTroops(state),
    shots: [],
    enemyShots: [],
    log: [],
    lostAtStart: state.stats.unitsLost,
    skullDeaths: {},
    after: opts.after || 'trade',
  };
  const names = state.combat.troops.map((t) => `${t.count} ${t.count === 1 ? UNITS[t.unit].name : UNITS[t.unit].plural}`);
  write(state, names.length
    ? `Horns sounded through the hold. ${names.join(', ')} mustered from their quarters.`
    : 'Horns sounded through the hold, but no dwarves were left to answer.',
  { page: RULES.combat.page, title: 'Starting combat', quote: 'To begin combat, spawn the enemy you discovered … Your rooms that spawn units at the start of combat do so now.' });
  beginRound(state);
}

function makeEnemy(state, e) {
  return { id: `e${state.nextId++}`, climb: 0, stopped: 0, behaviour: 'march', ...e };
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

const isRoomSquare = (cell) => cell && (cell.type === 'room' || cell.type === 'entrance');
const blinded = (state, p) => (getCell(state, p.x, p.y) || {}).gas === 'blinding';

// Where an enemy is trying to go this round, or null to stay put.
function goalFor(state, e) {
  if (e.behaviour === 'march') return ENTRANCE;
  if (e.behaviour === 'raid') {
    if (e.raided) return parseKey(state.lairs[e.lairId].home);
    if (!e.target) {
      // R40: the nearest room by the creature's own route.
      let best = null;
      for (const [k, c] of Object.entries(state.cells)) {
        if (!isRoomSquare(c)) continue;
        const r = enemyRoute(state, e, parseKey(k));
        if (r && (!best || r.cost < best.cost)) best = { k, cost: r.cost };
      }
      if (!best) { e.raided = true; return goalFor(state, e); }
      e.target = best.k;
    }
    return parseKey(e.target);
  }
  if (e.behaviour === 'guard') {
    const lair = state.lairs[e.lairId];
    const intruder = state.combat.troops.find((t) => lair && lair.squares.includes(key(t.x, t.y)));
    return intruder ? { x: intruder.x, y: intruder.y } : null;
  }
  return null; // sleep
}

// Enemies move first (p. 7), then the player acts.
function beginRound(state) {
  const c = state.combat;
  c.round += 1;
  c.shots = [];
  c.enemyShots = [];
  for (const t of c.troops) { t.acted = false; t.moved = false; }

  for (const e of c.enemies) {
    e.moved = false;
    // R22: a marching enemy that stood on the Entrance and still lives escapes.
    if (e.behaviour === 'march' && at(e, ENTRANCE)) {
      holdFalls(state, e);
      return;
    }
    if (troopsAt(state, e).length) { log(state, `${e.name} stands and fights.`); continue; } // R18
    if (e.stopped > 0) { e.stopped -= 1; log(state, `${e.name} is held fast.`); continue; }

    // R41: a Ranged enemy fires instead of moving when a Troop is within 2 steps.
    if (e.ranged && e.behaviour !== 'sleep' && !blinded(state, e)) {
      const steps = stepsWithin(state, e, 2);
      const targets = c.troops.filter((t) => steps.has(key(t.x, t.y)) && !blinded(state, t));
      if (targets.length) {
        const t = targets.sort((a, b) => b.hp - a.hp)[0];
        c.enemyShots.push({ enemyId: e.id, troopId: t.id });
        log(state, `${e.name} breathes fire at ${troopName(t)}!`);
        if (e.damagesRooms) scorchPath(state, e, t);
        continue;
      }
    }

    const goal = goalFor(state, e);
    if (!goal || at(e, goal)) {
      if (e.behaviour === 'raid' && e.raided && goal && at(e, goal)) e.home = true;
      continue;
    }
    const route = enemyRoute(state, e, goal);
    if (!route) {
      if (!e.stuckNoted) {
        log(state, `${e.name} can find no way ${e.behaviour === 'march' ? 'to the Entrance' : 'forward'} and lurks where it is.`);
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
      : `${e.name} ${e.behaviour === 'raid' && e.raided ? 'slinks back toward its den' : 'advances'}.`);
    const cell = getCell(state, e.x, e.y);
    // A♠: "If monsters enter a room with no units in it, lose 10♦" (R42).
    if (e.thief && isRoomSquare(cell) && !here.length) {
      const lost = Math.min(e.thief, state.res.diamonds);
      state.res.diamonds -= lost;
      log(state, `${e.name} ransack the empty ${roomLabel(cell)}: −${lost}♦.`);
    }
    if (e.behaviour === 'raid' && !e.raided && key(e.x, e.y) === e.target) {
      e.raided = true;
      e.raidedRound = c.round;
    }
  }

  // Raiders back in their dens leave the fight (J♣: "ending combat unless you wish to follow").
  const home = c.enemies.filter((e) => e.home);
  for (const e of home) {
    state.lairs[e.lairId].str = e.str;
    log(state, `${e.name} vanishes back into its den.`);
  }
  if (home.length) {
    c.enemies = c.enemies.filter((e) => !e.home);
    if (!c.enemies.length) endCombat(state, 'The creature slipped back into its den; the fighting was over.');
  }
}

// Q♠: "rooms it attacks through are damaged" (R41): every room on the shot's path, and the target's.
function scorchPath(state, e, t) {
  const r = enemyRoute(state, e, t);
  if (!r) return;
  for (const p of r.path) {
    const cell = getCell(state, p.x, p.y);
    if (cell && cell.type === 'room' && !cell.damaged) {
      cell.damaged = true;
      log(state, `The ${roomLabel(cell)} is scorched and damaged.`);
    }
  }
}

function roomLabel(cell) {
  const d = ROOMS[cell.room] || FOUND_ROOMS[cell.room];
  return d ? d.name : 'room';
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
  if (blinded(state, troop)) return [];
  const steps = stepsWithin(state, troop, 2);
  return state.combat.enemies.filter((e) => steps.has(key(e.x, e.y)) && !at(e, troop) && !blinded(state, e));
}

// R44: you may withdraw when nothing is marching on the Entrance and nobody is locked in a fight.
export function canWithdraw(state) {
  const c = state.combat;
  if (!c) return false;
  if (c.troops.some((t) => enemiesAt(state, t).length)) return false;
  return c.enemies.every((e) => e.behaviour !== 'march' || !enemyRoute(state, e));
}

export function combatAction(state, action) {
  const c = state.combat;
  if (action.type === 'endRound') return endRound(state);
  if (action.type === 'withdraw') {
    if (!canWithdraw(state)) throw new GameError('You can’t withdraw while foes march on the Entrance or Troops are locked in battle.');
    for (const e of c.enemies) if (e.lairId && state.lairs[e.lairId]) state.lairs[e.lairId].str = e.str;
    return endCombat(state, 'The Overseer called the Troops back; the foes were left to their lairs.');
  }
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
  } else {
    throw new GameError(`Unknown combat action ${action.type}`);
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

  for (const s of c.shots) {
    const e = c.enemies.find((x) => x.id === s.enemyId);
    if (e) spreadOnEnemies(enemiesAt(state, e), s.dmg, onEnemy);
  }
  for (const s of c.enemyShots) {
    const e = c.enemies.find((x) => x.id === s.enemyId);
    const t = c.troops.find((x) => x.id === s.troopId);
    if (e && t) spreadOnTroops([t], e.str, onTroop);
  }
  // Fights: every square holding both sides (R18). Sleeping foes wake when struck.
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
    if (e.str > 0 && e.leavesWhenAttacked && e.behaviour === 'guard') {
      e.behaviour = 'march'; // Q♣: "will not leave here unless attacked"
      log(state, `Enraged, ${e.name} leaves its lair and makes for the Entrance!`);
    }
    if (e.str > 0 && e.behaviour === 'sleep') e.behaviour = 'march';
  }
  for (const t of c.troops) {
    const d = onTroop.get(t.id) || 0;
    if (!d) continue;
    const before = t.count;
    t.hp -= d;
    t.count = t.hp <= 0 ? 0 : Math.min(t.count, Math.ceil(t.hp / t.unitStr)); // R19, R43
    const lost = before - t.count;
    state.stats.unitsLost += lost;
    if (t.unit === 'skullDwarf' && lost) c.skullDeaths[t.home] = (c.skullDeaths[t.home] || 0) + lost;
    log(state, t.count > 0
      ? `${UNITS[t.unit].plural} take ${d} damage${lost ? `; ${lost} fall` : ''} (${t.hp} STR left).`
      : `The last of the ${UNITS[t.unit].plural} from the ${homeName(state, t)} fall.`);
  }

  const dead = c.enemies.filter((e) => e.str <= 0);
  for (const e of dead) {
    state.stats.kills.push({ name: e.name, baseStr: e.baseStr, turn: state.turn });
    if (e.lairId) clearLair(state, e);
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
  return cell ? roomLabel(cell) : 'hold';
}

// A lair whose foes are all dead becomes part of the hold (R28).
function clearLair(state, e) {
  const lair = state.lairs[e.lairId];
  if (!lair) return;
  if (state.combat.enemies.some((o) => o !== e && o.lairId === e.lairId && o.str > 0)) return;
  for (const k of lair.squares) {
    const cell = state.cells[k];
    if (!cell || cell.type !== 'lair') continue;
    if (lair.clearsTo && k === lair.home) {
      state.cells[k] = { type: 'room', room: lair.clearsTo, found: { card: lair.card } };
    } else if (lair.wyrm) {
      state.cells[k] = { type: 'room', room: 'emptyHoard', found: { card: lair.card } };
    } else {
      state.cells[k] = { type: 'cavern', feature: 'ruins', found: { card: lair.card } };
    }
  }
  if (lair.clearsTo === 'golemForge') state.unlocks = { ...(state.unlocks || {}), golems: true };
  delete state.lairs[e.lairId];
}

function endCombat(state, closing = null) {
  const c = state.combat;
  for (const t of c.troops) {
    // R19: survivors heal and go home.
    state.housing[t.home] = { unit: t.unit, count: t.count };
  }
  // Skull Dwarves: "On defeat, roll 1D4: 3+ revive after combat" (p. 6).
  let revived = 0;
  for (const [home, n] of Object.entries(c.skullDeaths)) {
    for (let i = 0; i < n; i++) {
      if (rollD4(state).roll >= 3) {
        const h = state.housing[home] || { unit: 'skullDwarf', count: 0 };
        h.unit = 'skullDwarf';
        h.count += 1;
        state.housing[home] = h;
        revived++;
      }
    }
  }
  const lost = state.stats.unitsLost - c.lostAtStart;
  const deaths = c.log.filter((l) => /destroyed|fall/.test(l.text)).map((l) => l.text).join(' ');
  write(state, `${closing || `After ${c.round} round${c.round === 1 ? '' : 's'} the fighting was done.`} ${deaths}` +
    (lost === 0 ? ' Not a single dwarf was lost.' : ` ${lost} dwarf${lost === 1 ? '' : 's'} will be mourned.`) +
    (revived ? ` ${revived} Skull Dwarf${revived === 1 ? '' : 's'} clattered back to unlife.` : ''),
  { page: RULES.combat.page, title: RULES.combat.title, quote: RULES.combat.text });
  state.lastCombatLog = c.log;
  state.afterCombat = c.after;
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
