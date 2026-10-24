// What the miners find: ♣ Natural Formations (pp. 19–20) and ♠ Remnants (pp. 21–22).
// Each handler draws the find on the map, writes the chronicle, and starts combat if the
// find fights on discovery (R28).

import { CLUBS, SPADES } from '../data/discoveries.js';
import { GOOD_MAGIC, BAD_MAGIC, WYRD, PROMPTS, COURT_FOES } from '../data/magic.js';
import { PAGE_W, PAGE_H, key, getCell, setLink, connectNewSquare, depthOf } from './grid.js';
import { drawCard, parseCard, cardLabel, rollD4, rollD2 } from './deck.js';
import { write, hashPick, DIR_WORDS } from './chronicle.js';
import { gain, gainText } from './economy.js';
import { spreadLiquid, spreadGas } from './flow.js';
import { startCombat } from './combat.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function ref(card, entry) {
  return { card, page: entry.page, title: `${cardLabel(card)} — ${entry.name}`, quote: entry.text };
}

// '1D4', '1D2', '1D4+2' or a number → { size, note }
export function rollSize(state, spec) {
  if (typeof spec === 'number') return { size: spec, note: '' };
  const m = /^1D([24])(?:\+(\d+))?$/.exec(spec);
  const r = m[1] === '4' ? rollD4(state) : rollD2(state);
  const plus = m[2] ? Number(m[2]) : 0;
  return { size: r.roll + plus, note: `${spec} rolled ${r.roll + plus}` };
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

export function placeShape(state, shape, makeCell) {
  shape.forEach((p, i) => { state.cells[key(p.x, p.y)] = makeCell(p, i); });
  connectNewSquare(state, shape[0].x, shape[0].y);
  const inShape = new Set(shape.map((p) => key(p.x, p.y)));
  for (const p of shape) if (inShape.has(key(p.x, p.y + 1))) setLink(state, p.x, p.y, 'shaft');
}

function openCavern(state, x, y, extra = {}) {
  state.cells[key(x, y)] = { type: 'cavern', feature: 'cave', ...extra };
  connectNewSquare(state, x, y);
}

function pickPrompt(state, list) {
  const { roll } = rollD4(state);
  return list[roll - 1];
}

// Draw on a magic or Wyrd table and record it. Effects are applied by hand for now.
export function drawOnTable(state, table, why) {
  const tables = { good: [GOOD_MAGIC, 'Good Magic'], bad: [BAD_MAGIC, 'Bad Magic'], wyrd: [WYRD, 'Wyrd'] };
  const [data, label] = tables[table];
  let id;
  let card;
  do { id = drawCard(state, label); card = parseCard(id); } while (card.joker);
  const entry = data[card.rank];
  state.lastDraws.push({ card: id, table: label, name: entry.name, text: entry.text, page: entry.page });
  write(state, `${why} ${label}, ${cardLabel(id)}: ${entry.name}. (Not yet automated: apply it by hand if you wish.)`,
    { card: id, page: entry.page, title: `${label} — ${entry.name}`, quote: entry.text });
  return { card: id, entry };
}

function magicByD2(state, why) {
  const { roll } = rollD2(state);
  return drawOnTable(state, roll === 1 ? 'good' : 'bad', `${why} (1D2 rolled ${roll}):`);
}

// ------------------------------------------------------------------ lairs

let lairCounter = 0;
function newLairId(state) {
  lairCounter = state.nextId++;
  return `L${lairCounter}`;
}

// A lair: enemy squares on the map, with the foe's record kept in state.lairs (R28).
export function createLair(state, shape, { card, entry, name, foe, baseStr, depth, extra = {} }) {
  const id = newLairId(state);
  placeShape(state, shape, () => ({ type: 'lair', lair: id }));
  state.lairs[id] = {
    id, card, entryKey: `${parseCard(card).suit}${parseCard(card).rank}`, name, foe,
    baseStr, str: baseStr + 5 * depth, // R16
    squares: shape.map((p) => key(p.x, p.y)), home: key(shape[0].x, shape[0].y),
    behaviour: entry.behaviour || 'march',
    leavesWhenAttacked: !!entry.leavesWhenAttacked,
    waits: !!entry.waits,
    clearsTo: entry.clearsTo || null,
    thief: entry.stealsFromEmptyRooms || 0,
    tamable: !!entry.tamable,
    ...extra,
  };
  return state.lairs[id];
}

export function enemyFromLair(lair, at = null) {
  const p = at || { x: Number(lair.home.split(',')[0]), y: Number(lair.home.split(',')[1]) };
  return {
    name: lair.foe, baseStr: lair.baseStr, str: lair.str, x: p.x, y: p.y,
    lairId: lair.id, behaviour: lair.behaviour, leavesWhenAttacked: lair.leavesWhenAttacked,
    thief: lair.thief, ranged: !!lair.ranged, damagesRooms: !!lair.damagesRooms,
  };
}

// ------------------------------------------------------------------ ♣

export function naturalFormation(state, x, y, card, depth, dir) {
  const entry = CLUBS[card.rank];
  const r = ref(card.id, entry);
  const where = hashPick(DIR_WORDS[dir], state.turn, x, y);
  const spills = dir !== 'down'; // p. 9: "Digging down into a liquid source has no effect."

  switch (entry.kind) {
    case 'forest': {
      if (depth >= entry.wyrdFromDepth) {
        openCavern(state, x, y, { feature: 'wyrd', found: { card: card.id } });
        write(state, `At depth ${depth} the ${cardLabel(card.id)} opened onto something that was no forest.`, r);
        const w = drawOnTable(state, 'wyrd', 'The Wyrd table answered');
        state.cells[key(x, y)].wyrd = w.entry.name;
        return;
      }
      openCavern(state, x, y, { feature: 'forest', found: { card: card.id } });
      write(state, `Digging ${where} at depth ${depth}, the miners broke into an underground forest: pale trunks, ` +
        'dripping moss, the smell of loam. Keep it for 2♥ each turn, or build a room here for free.', r);
      return;
    }
    case 'gas': {
      const { roll, card: rollCard } = rollD4(state);
      const gas = entry.byRoll[roll];
      openCavern(state, x, y, { feature: 'gasChamber', found: { card: card.id } });
      const res = spreadGas(state, { x, y }, gas);
      const names = { poison: 'poison gas', flammable: 'flammable gas', blinding: 'blinding gas' };
      let text = `A hiss ${where} at depth ${depth}: a chamber of ${names[gas]} (1D4 drew ${cardLabel(rollCard)} = ${roll}). ` +
        `It crept through ${plural(res.filled.length, 'square')}.`;
      if (res.exploded) text += ` It reached a fire and EXPLODED, damaging ${plural(res.exploded.damaged, 'room')}.`;
      if (res.lost) text += ` ${plural(res.lost, 'dwarf')} did not come out again.`;
      if (gas === 'blinding') text += ' Ranged units cannot shoot through it.';
      if (gas !== 'blinding' && !res.exploded) text += ' Drain it for 5♦ a square to pass again.';
      write(state, text, r);
      return;
    }
    case 'naturalMagic': {
      openCavern(state, x, y, { feature: 'grotto', found: { card: card.id } });
      write(state, `At depth ${depth} the air itself shimmered: natural magic.`, r);
      magicByD2(state, 'The magic was drawn');
      return;
    }
    case 'river': {
      const liquid = entry.liquid;
      const x0 = Math.floor(x / PAGE_W) * PAGE_W;
      const x1 = x0 + PAGE_W - 1;
      let step;
      let tieNote = '';
      if (x - x0 < x1 - x) step = -1;
      else if (x1 - x < x - x0) step = 1;
      else { const d = rollD2(state); step = d.roll === 1 ? -1 : 1; tieNote = ` (both edges equally close; 1D2 sent it ${step < 0 ? 'west' : 'east'})`; }
      const squares = [{ x, y }];
      for (let nx = x + step; nx >= x0 && nx <= x1 && !getCell(state, nx, y); nx += step) squares.push({ x: nx, y });
      const feature = liquid === 'lava' ? 'magma' : 'river';
      placeShape(state, squares, () => ({ type: 'cavern', feature, liquid, found: { card: card.id } }));
      let text = liquid === 'lava'
        ? `Heat, then light: digging ${where} at depth ${depth} the miners opened a magma flow, running ${plural(squares.length, 'square')} to the page's edge${tieNote}.`
        : `The sound of water ${where} at depth ${depth}: an underground river, running ${plural(squares.length, 'square')} to the page's edge${tieNote}.`;
      text += flood(state, squares, liquid, spills);
      write(state, text, r);
      return;
    }
    case 'cavern': {
      const { size, note } = rollSize(state, entry.size);
      const shape = growShape(state, x, y, size);
      const group = state.nextId++;
      placeShape(state, shape, () => ({ type: 'cavern', feature: 'cave', group, found: { card: card.id } }));
      write(state, `The wall gave way ${where} at depth ${depth} onto an open cavern, ` +
        `${plural(shape.length, 'grid space')} wide (${note}).`, r);
      return;
    }
    case 'crystal': {
      const { size, note } = rollSize(state, entry.size);
      const shape = growShape(state, x, y, size);
      const group = state.nextId++;
      placeShape(state, shape, () => ({ type: 'crystal', feature: 'crystal', group, found: { card: card.id } }));
      write(state, `Lamplight exploded into a thousand colours ${where} at depth ${depth}: a crystal cavern, ` +
        `${plural(shape.length, 'grid space')} (${note}). Each turn it will yield ♦; it can be crossed but never built in.`, r);
      return;
    }
    case 'lake': {
      const { size, note } = rollSize(state, entry.size);
      const shape = growShape(state, x, y, size);
      placeShape(state, shape, () => ({ type: 'cavern', feature: 'lake', liquid: entry.liquid, found: { card: card.id } }));
      let text = `Still black water ${where} at depth ${depth}: an underground lake, ${plural(shape.length, 'grid space')} (${note}).`;
      text += flood(state, shape, entry.liquid, spills);
      write(state, text, r);
      return;
    }
    case 'lair': return lairFind(state, x, y, card, entry, depth, where, r);
    case 'volcanicShaft': {
      const bottom = (Math.floor(y / PAGE_H) + 1) * PAGE_H - 1;
      const squares = [{ x, y }];
      for (let ny = y + 1; ny <= bottom && !getCell(state, x, ny); ny++) squares.push({ x, y: ny });
      placeShape(state, squares, () => ({ type: 'cavern', feature: 'volcanic', noBuild: true, found: { card: card.id } }));
      const last = squares[squares.length - 1];
      if (getCell(state, x, last.y + 1)) setLink(state, x, last.y, 'shaft');
      write(state, `At depth ${depth} the floor fell away into a volcanic shaft, dormant for now, ` +
        `plunging ${plural(squares.length, 'square')} to the bottom of the page.`, r);
      return;
    }
    case 'burrower': return burrower(state, x, y, card, entry, depth, where, r);
    default: throw new Error(`No handler for ♣ ${entry.kind}`);
  }
}

// Liquid spills only if found sideways or from below (p. 9). Returns chronicle text.
function flood(state, squares, liquid, spills) {
  if (!spills) {
    // Still kill anyone in the source squares (none: they were rock).
    return ' It was found from above, so it stayed in its bed.';
  }
  const res = spreadLiquid(state, squares, liquid);
  let text = res.wet.length
    ? ` It spilled into ${plural(res.wet.length, 'square')} of the hold${liquid === 'lava' ? ', burning what it touched' : ''}.`
    : ' It found nowhere to spill.';
  if (res.lost) text += ` ${plural(res.lost, 'dwarf')} drowned${liquid === 'lava' ? ' in fire' : ''}.`;
  if (res.wet.length) text += ` Drain each square for ${liquid === 'lava' ? '20♦ (and the room is left damaged)' : '5♦'}.`;
  return text;
}

function lairFind(state, x, y, card, entry, depth, where, r) {
  const { size, note } = rollSize(state, entry.size);
  const shape = growShape(state, x, y, size);
  const kind = entry.prompt ? pickPrompt(state, PROMPTS[entry.prompt]) : null;
  const foe = entry.foe || (entry.prompt === 'court' ? COURT_FOES[kind] : kind);
  const baseStr = entry.str || shape.length * entry.strPerSpace;
  const lair = createLair(state, shape, {
    card: card.id, entry, name: entry.prompt === 'court' ? `${entry.name}: ${kind}` : entry.name, foe, baseStr, depth,
  });
  const sizeText = shape.length > 1 || note ? `, ${plural(shape.length, 'grid space')}${note ? ` (${note})` : ''}` : '';
  const strText = `${baseStr} STR + ${5 * depth} for depth = ${lair.str} STR`;
  const lines = {
    S: {
      A: `Smoke and chatter ${where} at depth ${depth}: a village of ${foe}${sizeText}. They poured out to raid the hold: ${strText}.`,
      2: `Breaking through ${where} at depth ${depth}, the miners found a forgotten crypt. Its seals cracked, and the dead rose: ${foe}, ${strText}.`,
      10: `Hammering ${where} at depth ${depth}: a golem forge, its ${foe} (${strText}) standing silent. They will not stir unless you try to claim the forge.`,
      K: `Cold halls ${where} at depth ${depth}: a desolate court, a ${kind}${sizeText}. ${foe} rose from it: ${strText}.`,
    },
    C: {
      9: `A drone like a held breath ${where} at depth ${depth}: a hive of ${foe}${sizeText}. They swarmed out: ${strText}.`,
      J: `Eyes in the dark ${where} at depth ${depth}: a ${foe} in its den (${strText}). It went for the nearest room.`,
      Q: `Something vast breathed ${where} at depth ${depth}: the lair of a ${foe}, four grid spaces (${strText}). It will not leave unless attacked, but will attack anything entering its lair.`,
    },
  };
  write(state, lines[card.suit][card.rank], r);
  if (!entry.waits) startCombat(state, [enemyFromLair(lair)]);
}

// K♣: a tunnel straight up from the find until it meets the hold (p. 20; burrowing p. 9).
function burrower(state, x, y, card, entry, depth, where, r) {
  const foe = pickPrompt(state, PROMPTS.burrower);
  const lair = createLair(state, [{ x, y }], { card: card.id, entry: { ...entry, behaviour: 'march' }, name: entry.name, foe, baseStr: entry.str, depth });
  const tunnel = [];
  let p = { x, y };
  let met = null;
  const dig = (q) => {
    state.cells[key(q.x, q.y)] = { type: 'cavern', feature: 'tunnel', found: { card: card.id } };
    tunnel.push(q);
  };
  // Up the column.
  for (;;) {
    const up = { x: p.x, y: p.y - 1 };
    if (up.y < 0) break;
    const c = getCell(state, up.x, up.y);
    setLink(state, p.x, up.y, 'shaft');
    if (c) { met = up; break; }
    dig(up);
    p = up;
  }
  let turned = '';
  if (!met) {
    // p. 9: at the top it turns and digs back down an adjacent column (1D2: 1 left, 2 right).
    const d = rollD2(state);
    const nx = p.x + (d.roll === 1 ? -1 : 1);
    turned = ` It reached the top of the hold and turned ${d.roll === 1 ? 'left' : 'right'} (1D2 rolled ${d.roll}).`;
    let q = { x: nx, y: p.y };
    if (getCell(state, q.x, q.y)) met = q;
    else {
      dig(q);
      const bottom = (Math.floor(q.y / PAGE_H) + 1) * PAGE_H - 1;
      while (!met && q.y < bottom) {
        const down = { x: q.x, y: q.y + 1 };
        setLink(state, q.x, q.y, 'shaft');
        if (getCell(state, down.x, down.y)) { met = down; break; }
        dig(down);
        q = down;
      }
      p = q;
    }
  }
  const beastAt = tunnel.length ? tunnel[tunnel.length - 1] : { x, y };
  write(state, `The ground shook ${where} at depth ${depth}: a ${foe}, a burrowing beast (${entry.str} STR + ${5 * depth} for depth = ${lair.str} STR), ` +
    `clawed a tunnel ${plural(tunnel.length, 'square')} long straight up.${turned}` +
    (met ? ' It broke into the hold!' : ' It found nothing and lay still at the bottom of its tunnel.'), r);
  if (met) startCombat(state, [enemyFromLair(lair, beastAt)]);
}

// ------------------------------------------------------------------ ♠

export function remnant(state, x, y, card, depth, dir) {
  const entry = SPADES[card.rank];
  const r = ref(card.id, entry);
  const where = hashPick(DIR_WORDS[dir], state.turn, x, y);
  switch (entry.kind) {
    case 'lair': return lairFind(state, x, y, card, entry, depth, where, r);
    case 'foundRoom': {
      const cell = { type: 'room', room: entry.room, found: { card: card.id } };
      if (entry.room === 'sealed') {
        cell.closed = true;
        cell.trapped = pickPrompt(state, PROMPTS.trappedEvil);
      }
      state.cells[key(x, y)] = cell;
      connectNewSquare(state, x, y);
      const lines = {
        well: `A wishing well ${where} at depth ${depth}, its water black and bottomless. Once a turn, 10♦ buys a wish, for good or ill.`,
        sealed: `A sealed door ${where} at depth ${depth}, bound in chains and warning-runes. Something waits within. It stays shut until you choose to open it.`,
        buriedTemple: `A buried temple ${where} at depth ${depth}, its altar still intact. A Cleric recruited here (8♦) may call on its power, once.`,
        portal: `A demon portal ${where} at depth ${depth}, a wound in the air that hums at night. At the end of every turn it may open (1 on 1D4). To close it: 20♦ and the life of a Cleric.`,
      };
      write(state, lines[entry.room], r);
      return;
    }
    case 'mine': {
      const { size, note } = rollSize(state, entry.size);
      const shape = growShape(state, x, y, size);
      placeShape(state, shape, () => ({ type: 'cavern', feature: 'mine', found: { card: card.id } }));
      const amount = entry.haul + entry.haulPerDepth * depth;
      const g = gain(state, 'diamonds', amount);
      write(state, `Old rails ${where} at depth ${depth}: an abandoned mine, ${plural(shape.length, 'grid space')} (${note}), ` +
        `its carts still loaded. ${entry.haul} + ${entry.haulPerDepth}×${depth} = ${amount}♦; gained ${gainText('diamonds', g)}.`, r);
      return;
    }
    case 'abandonedRoom': {
      openCavern(state, x, y, { found: { card: card.id } });
      state.pending = { kind: 'abandonedRoom', x, y, card: card.id };
      write(state, `Dressed stone ${where} at depth ${depth}: an abandoned room. Someone was here first. Choose what it once was.`, r);
      return;
    }
    case 'ancientLibrary': {
      const { size, note } = rollSize(state, entry.size);
      const shape = growShape(state, x, y, size);
      placeShape(state, shape, () => ({ type: 'room', room: 'ancientLibrary', found: { card: card.id } }));
      write(state, `Shelves of crumbling scrolls ${where} at depth ${depth}: an ancient library, ${plural(shape.length, 'grid space')} (${note}).`, r);
      magicByD2(state, 'The scholars read aloud from it');
      return;
    }
    case 'artefact': {
      openCavern(state, x, y, { found: { card: card.id } });
      state.pending = { kind: 'artefact', card: card.id, bonus: entry.bonus };
      write(state, `Wrapped in rotten cloth ${where} at depth ${depth}: a long lost artefact, ancient weapon or armour. ` +
        `Choose a unit room to house it: every Troop from there fights with +${entry.bonus} STR.`, r);
      return;
    }
    case 'wyrm': {
      createLair(state, [{ x, y }], {
        card: card.id, entry: { behaviour: 'sleep', waits: true }, name: entry.name, foe: entry.foe, baseStr: entry.str, depth,
        extra: { wyrm: true, ranged: true, damagesRooms: true, steal: entry.steal },
      });
      write(state, `Gold ${where} at depth ${depth}, heaped high, and on it an ancient dragon, asleep. ` +
        `Once a turn you may steal 20♦ from its hoard, but on a 1 (1D4) it wakes: ${entry.str} STR + ${5 * depth} for depth, Ranged.`, r);
      return;
    }
    default: throw new Error(`No handler for ♠ ${entry.kind}`);
  }
}

export { magicByD2 };
