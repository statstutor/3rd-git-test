// The virtual deck (RULINGS R1). Every draw is from the full deck because cards are
// shuffled back after resolving (p. 4). The PRNG state lives in the game state so saves,
// undo and tests are deterministic.

import { SUITS, RANKS, RANK_VALUES, RANK_NAMES, JOKERS } from '../data/cards.js';

// mulberry32: small, fast, good enough for cards.
export function nextRandom(state) {
  let t = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function parseCard(id) {
  if (JOKERS[id]) return { id, joker: true, color: JOKERS[id].color, name: JOKERS[id].name };
  const suit = id.slice(-1);
  const rank = id.slice(0, -1);
  if (!SUITS[suit] || !(rank in RANK_VALUES)) throw new Error(`Bad card id: ${id}`);
  return {
    id, rank, suit,
    value: RANK_VALUES[rank],
    color: SUITS[suit].color,
    face: rank === 'J' || rank === 'Q' || rank === 'K',
  };
}

export function cardLabel(id) {
  const c = parseCard(id);
  return c.joker ? c.name : `${c.rank}${SUITS[c.suit].symbol}`;
}

export function cardLongName(id) {
  const c = parseCard(id);
  if (c.joker) return c.name;
  return `${RANK_NAMES[c.rank] || c.rank} of ${SUITS[c.suit].name}`;
}

export function deckCards(state) {
  const cards = [];
  for (const s of Object.keys(SUITS)) for (const r of RANKS) cards.push(r + s);
  for (const j of Object.keys(JOKERS)) {
    if (state.deck.jokersIn && !state.deck.heldOut[j]) cards.push(j);
  }
  return cards;
}

// Draw one card. Tests (and only tests) can stack the deck with state.deck.stack.
export function drawCard(state, purpose = 'explore') {
  let id;
  if (state.deck.stack && state.deck.stack.length) {
    id = state.deck.stack.shift();
  } else {
    const cards = deckCards(state);
    id = cards[Math.floor(nextRandom(state) * cards.length)];
  }
  state.deck.drawn.push({ id, purpose, turn: state.turn });
  if (state.deck.drawn.length > 40) state.deck.drawn.shift();
  return id;
}

// p. 2: "Roll 1D4 … ♠–1 ♣–2 ♦–3 ♥–4". A Joker drawn for a roll is ignored and redrawn
// (a roll is not exploring, so the Joker isn't "played").
export function rollD4(state) {
  for (;;) {
    const c = parseCard(drawCard(state, '1D4'));
    if (!c.joker) return { roll: SUITS[c.suit].d4, card: c.id };
  }
}

// p. 2: "Roll 1D2 … Black – 1 Red – 2"
export function rollD2(state) {
  for (;;) {
    const c = parseCard(drawCard(state, '1D2'));
    if (!c.joker) return { roll: c.color === 'black' ? 1 : 2, card: c.id };
  }
}
