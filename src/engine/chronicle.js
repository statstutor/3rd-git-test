// The running chronicle: the hold's story, written as things happen.
// Flavour choices use a hash of the turn and place, never the card RNG, so prose never
// changes what cards come up.

export function hashPick(list, ...seeds) {
  let h = 2166136261;
  for (const s of seeds) {
    for (const ch of String(s)) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
  }
  return list[(h >>> 0) % list.length];
}

export function write(state, text, ref = null) {
  state.chronicle.push({ turn: state.turn, text, ref });
}

export function chronicleAsText(state, title = 'The Chronicle of the Hold') {
  const lines = [title, '='.repeat(title.length), ''];
  let lastTurn = null;
  for (const e of state.chronicle) {
    if (e.turn !== lastTurn) {
      lines.push('', `— Turn ${e.turn} —`);
      lastTurn = e.turn;
    }
    lines.push(e.text);
  }
  return lines.join('\n');
}

export const DIR_WORDS = {
  west: ['west', 'to the west', 'westward'],
  east: ['east', 'to the east', 'eastward'],
  up: ['upward', 'up through the ceiling', 'up toward the surface'],
  down: ['downward', 'down into the dark', 'down through the floor'],
};

export const MINING_LINES = {
  hearts: [
    'The picks rang true and a seam of good stone and timber came loose',
    'The miners hauled out cartloads of ore and sound rock',
    'A rich vein of iron ran through the new chamber',
    'The diggers broke into a pocket of fine building stone',
  ],
  diamonds: [
    'Lamplight caught the glitter of gems in the walls',
    'A cluster of rough crystals winked from the rock face',
    'The miners pried loose a pouch-worth of uncut stones',
    'Gold flecks shone in the spoil heap, and the clerks smiled',
  ],
};
