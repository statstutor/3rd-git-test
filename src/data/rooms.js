// Rooms, pp. 11–16. Costs, housing and the book's own wording.
// placement: 'sideways' (Corridor), 'below' (Stairs), 'adjacent' (everything else) — RULINGS R27.
// houses: { units: [...], capacity } — capacity is per grid space (p. 11: "a Barracks that
// takes up two grid spaces can hold 20 Soldiers or Gunners").
// countsForScore: RULINGS R31 (Corridors/Stairs don't count).

export const ROOMS = {
  corridor: {
    name: 'Corridor', category: 'Corridors and Stairs', page: 11, cost: {}, size: 1,
    placement: 'sideways', countsForScore: false, implemented: true,
    text: 'Corridors are rooms that have no effect other than to expand the size of your hold, or potentially connect two disconnected rooms. They may be built in an unexplored space to the left or right of an existing room or empty cavern.',
  },
  stairs: {
    name: 'Stairs', category: 'Corridors and Stairs', page: 11, cost: {}, size: 1,
    placement: 'below', countsForScore: false, implemented: true,
    text: 'Stairs allow you to move deeper into your hold, and also serve to connect two levels of depth within your hold. They may be built in an unexplored space below an existing room or empty cavern.',
  },
  barracks: {
    name: 'Barracks', category: 'Unit rooms', page: 11, cost: { hearts: 8 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: true,
    houses: { units: ['soldier', 'gunner'], capacity: 10, exclusive: true },
    text: 'A Barracks allows you to recruit Soldiers and Gunners. Each Barracks can hold 10 Soldiers or 10 Gunners. (They cannot share a grid after an ancient smear against rifles).',
  },
  cannonOutpost: {
    name: 'Cannon Outpost', category: 'Unit rooms', page: 11, cost: { hearts: 10 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    houses: { units: ['cannon'], capacity: 2 },
    text: 'Each Cannon Outpost can house up to 2 Cannons.',
  },
  forge: {
    name: 'Forge', category: 'Unit rooms', page: 11, cost: { hearts: 15, diamonds: 7 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    houses: { units: ['cannon'], capacity: 1 },
    text: 'A Forge allows you to build traps. Each Forge can house 1 Cannon.',
  },
  mason: {
    name: 'Mason', category: 'Unit rooms', page: 12, cost: { hearts: 20 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    text: 'A Mason allows you to build barricades (page 18)',
  },
  inn: {
    name: 'Inn', category: 'Unit rooms', page: 12, cost: { hearts: 30, diamonds: 10 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    text: 'When building an Inn, draw a card and consult the Adventurers table to see which adventurer takes residence in your inn (pages 23 - 24). Each Inn can hold one Adventurer, who hides in a dark corner booth. If that Adventurer is defeated, pay 10♦ to hire a new one at the start of the next turn.',
  },
  kennel: {
    name: 'Kennel', category: 'Unit rooms', page: 12, cost: { hearts: 5 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    houses: { units: ['hound'], capacity: 5 },
    text: 'A Kennel allows you to tame creatures. (See page 8) Each Kennel can hold a single creature or 5 Hounds.',
  },
  laboratory: {
    name: 'Laboratory', category: 'Unit rooms', page: 12, cost: { hearts: 5, diamonds: 10 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    houses: { units: ['alchemist'], capacity: 10 },
    text: 'Each grid worth of Laboratories can house 10 Alchemists. At the start of every turn in which you have 50+ Alchemists, draw a card. If you draw the A♠, a laboratory explodes, killing all Units within, and damaging the nearest two rooms. If you get the K♦, your dwarves have learned the art of transmutation: for the rest of the game, you may trade one Resource (♥) for three Trade Goods (♦).',
  },
  library: {
    name: 'Library', category: 'Unit rooms', page: 12, cost: { hearts: 15 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    houses: { units: ['mage'], capacity: 5 },
    text: 'After building, draw a card and consult the Good Magic table (pages 25 - 26). Each Library can house 5 Mages.',
  },
  prison: {
    name: 'Prison', category: 'Unit rooms', page: 13, cost: { hearts: 30 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    houses: { units: ['prisoner'], capacity: 20 },
    text: 'Each Prison can hold 20 Prisoners. Each turn, add 5 Prisoners to an available Prison grid. Prisoners can be let out in times of dire need, but they will act as enemies to both sides. At the start of each turn, gain 20♦ for each full Prison in your hold. If a Prison ever becomes disconnected, the Prisoners escape and begin combat or a takeover.',
  },
  dorms: {
    name: 'Dorms', category: 'Buffing rooms', page: 13, cost: { hearts: 5 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    text: 'Increases the maximum number of units each connected room can house by 50% per grid of Dorms.',
  },
  hospital: {
    name: 'Hospital', category: 'Buffing rooms', page: 13, cost: { hearts: 10, diamonds: 10 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    text: 'A Troop of your choice defeated while on the same row as a Hospital is revived at full STR after combat.',
  },
  kitchen: {
    name: 'Kitchen', category: 'Buffing rooms', page: 13, cost: { hearts: 8 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    text: 'Units in a room connected to a Kitchen get 50% STR during combat.',
  },
  museum: {
    name: 'Museum', category: 'Buffing rooms', page: 13, cost: { hearts: 50, diamonds: 50 }, size: 2,
    placement: 'adjacent', countsForScore: true, implemented: false,
    text: 'Roll 1D4 after defeating an enemy. On a 4, draw an object in the museum to commemorate your victory and gain +10 STR against that enemy type (i.e. goblins, vampires, golems, etc.) in future combats. Each Museum can house four of these trophies.',
  },
  overseersOffice: {
    name: "Overseer's Office", category: 'Buffing rooms', page: 14, cost: { hearts: 15 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    text: 'Any ♦ cards revealed when exploring in the same column as an Overseer’s Office are worth double.',
  },
  shrine: {
    name: 'Shrine', category: 'Buffing rooms', page: 14, cost: { hearts: 20 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    houses: { units: ['cleric'], capacity: 1 },
    text: 'When building a Shrine, you must also choose its purpose: Defence or Fortune. A Shrine of Defence counts as a passable level 3 trap (page 17). A Shrine of Fortune increases the value of all ♦ cards by 3. Shrines can house a single Cleric and need a Cleric to activate their effects.',
  },
  stockpile: {
    name: 'Stockpile', category: 'Buffing rooms', page: 14, cost: { hearts: 20 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    text: 'Increase your maximum Resource supply by 50. If you have more than 100 Resources in your supply, and you draw the J♣, pests have targeted your hold: roll 1D4. On a 1, stone mites have eaten ½ your Resources, rounded down. On a 2+, spawn a displaced elemental (60 STR) at your Stockpile at the lowest depth, and enter combat.',
  },
  storehouse: {
    name: 'Storehouse', category: 'Buffing rooms', page: 14, cost: { hearts: 15 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    text: 'Rooms built on this floor cost ½ ♥.',
  },
  temple: {
    name: 'Temple', category: 'Buffing rooms', page: 15, cost: { hearts: 20, diamonds: 20 }, size: 2,
    placement: 'adjacent', countsForScore: true, implemented: false,
    houses: { units: ['cleric'], capacity: 3 },
    text: 'When building a Temple, you must also choose its purpose: Protection or Purity. A Temple of Protection allows you to pay 5♦ and place a Shield with 20 STR on a unit or Troop. A Temple of Purity allows you to ignore a Bad Magic result by trapping it within the temple. Temples can house three Clerics and need at least one Cleric to activate their effects.',
  },
  treasury: {
    name: 'Treasury', category: 'Buffing rooms', page: 15, cost: { hearts: 20 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    text: 'Increase your maximum Trade Goods supply by 50. If you have more than 100 Trade Goods in your supply, and you draw the J♠, thieves have targeted your hold: roll 1D4. On a 1, a group of thieves steal ½ of your Trade Goods, rounded down. On a 2+, spawn a group of thieves (40 STR) at your lowest Treasury and enter combat.',
  },
  drawbridge: {
    name: 'Drawbridge', category: 'Infrastructure rooms', page: 15, cost: { hearts: 15 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    text: 'When you build a drawbridge, it is open. During combat, you may close the drawbridge to prevent enemies from crossing. Enemies take 50 STR of damage for every open grid space they fall should the drawbridge close while they’re in its grid space.',
  },
  elevator: {
    name: 'Elevator', category: 'Infrastructure rooms', page: 16, cost: { hearts: 5 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    text: 'Instantly move units up or down the elevator’s length. Enemies take 2 rounds per grid to ascend an Elevator shaft. If it does not make sense for them to be able to ascend, they instead start taking over rooms.',
  },
  pump: {
    name: 'Pump', category: 'Infrastructure rooms', page: 16, cost: { hearts: 8 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    text: 'Liquid cannot move through or damage this room. A Pump can be activated to flood if desired; follow the liquid rules (page 9), with this room as the source.',
  },
  tracks: {
    name: 'Tracks', category: 'Infrastructure rooms', page: 16, cost: { hearts: 5 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    text: 'Instantly move units along the length of the tracks. Tracks can be placed through other rooms.',
  },
  inventorsLab: {
    name: "Inventor's Lab", category: 'Advanced rooms', page: 16, cost: { hearts: 100, diamonds: 50 }, size: 1,
    placement: 'adjacent', countsForScore: true, implemented: false,
    requires: ['forge', 'library', 'stockpile'],
    text: 'While you have an Inventor’s Lab, you may pay 50♦ for an Invention: draw a card and consult the Inventions Table on pages 31 - 32. Inventions are permanent unless otherwise stated.',
  },
  breeder: {
    name: 'Breeder', category: 'Advanced rooms', page: 16, cost: { hearts: 80 }, size: 4,
    placement: 'adjacent', countsForScore: true, implemented: false,
    requiresInvention: 'pheromones',
    text: 'After using a breeding pheromone on a large creature, you may place a younger version of that creature in this Breeder room, or place it in the parent’s lair. The young creature has ½ the STR of the parent.',
  },
};

// Rooms that only appear through discoveries (not in the build palette).
export const FOUND_ROOMS = {
  entrance: {
    name: 'Entrance', page: 2,
    houses: { units: ['soldier'], capacity: 5 }, // RULINGS R26
    text: 'To start your hold draw a stairwell at the centre of the top row of your grid paper. This is the Entrance of your hold.',
  },
  cavern: {
    name: 'Empty cavern', page: 3,
    text: 'If you draw a ♥ or ♦ … feel free to draw an empty cavern in the space you chose, to represent what you’ve just mined.',
  },
  crypt: {
    name: 'Forgotten crypt', page: 21,
    houses: { units: ['skullDwarf'], capacity: 20 },
    text: 'Forgotten crypts, containing 20 STR of undead. Once cleared, you may summon Skull Dwarves (1 STR) here for 5♦. Crypts can house 20 Skull Dwarves.',
  },
  forest: {
    name: 'Underground forest', page: 19,
    text: 'An underground forest. Cut down for a free room, or keep for 2♥ per turn.',
  },
  well: {
    name: 'Wishing well', page: 21,
    text: 'Wishing well. Once per turn, you may pay 10♦ to roll 1D2 and draw a card: On 1, consult Good Magic (pages 25 – 26). On 2, consult Bad Magic (pages 27 – 28).',
  },
  sealed: {
    name: 'Sealed room', page: 21, closed: true,
    text: 'A sealed room with an evil creature or object inside. If this room is opened, draw a card. Consult the Bad Magic table (pages 27 – 28) to determine what you find.',
  },
  openedRoom: {
    name: 'Opened room', page: 21,
    text: 'The sealed room, now broken open.',
  },
  buriedTemple: {
    name: 'Buried temple', page: 21,
    houses: { units: ['cleric'], capacity: 1 },
    text: 'Buried temple. Recruit a cleric here to Roll 1D4 and draw a card. On 1–3, consult Bad Magic. On 4, consult Good Magic. Usable once.',
  },
  ancientLibrary: {
    name: 'Ancient library', page: 22,
    text: 'Ancient library. For the knowledge contained herein, roll 1D2 and draw a card: On 1, consult Good Magic (pages 25 – 26); On 2, consult Bad Magic (pages 27 – 28).',
  },
  portal: {
    name: 'Demon portal', page: 22,
    text: 'Demon portal. Roll 1D4 at the end of each turn. On 1, spawn Demons with 20 STR. To destroy the portal, pay 20♦ and sacrifice one of your Clerics, killing them.',
  },
  golemForge: {
    name: 'Golem forge', page: 22,
    text: 'If the Golems are defeated, this room allows you to recruit Golems at Forges.',
  },
  hoard: {
    name: 'Wyrm’s hoard', page: 22,
    text: 'Slumbering Wyrm. An ancient dragon sleeps upon its hoard. Once per turn, you may steal 20♦, and roll 1D4. On 1, the Wyrm awakens, destroying the hoard. The Wyrm has 100 STR and Ranged, and rooms it attacks through are damaged.',
  },
  emptyHoard: {
    name: 'Empty hoard', page: 22,
    text: 'The Wyrm’s lair, its hoard gone.',
  },
};

// What the empty-cavern variants are, for hover text. Keyed by cell.feature.
export const FEATURES = {
  cave: { name: 'Empty cavern', page: 3, text: 'An empty cavern: a place to build.' },
  mine: { name: 'Abandoned mine', page: 21, text: 'Abandoned mine. Others have left behind their haul. More for us!' },
  tunnel: { name: 'Burrowed tunnel', page: 9, text: 'The path a burrowing creature takes is opened up, update your map with the burrowed tunnel.' },
  volcanic: { name: 'Volcanic shaft', page: 20, text: 'Volcanic shaft, dormant...for now. Draw this all the way down to the bottom of the page.' },
  river: { name: 'Underground river', page: 19, text: 'An underground river. Draw the river all the way to the closest page edge. Liquid.' },
  magma: { name: 'Magma flow', page: 19, text: 'Magma flow. Same as the underground river above (4♣), but most likely doesn’t have fish. Liquid.' },
  lake: { name: 'Underground lake', page: 20, text: 'Underground lake, thankfully monsterless. Liquid.' },
  gasChamber: { name: 'Gas-filled chamber', page: 19, text: 'Gas-filled chamber.' },
  grotto: { name: 'Natural magic', page: 19, text: 'Natural magic in cave plants, crystals, or the air itself.' },
  ruins: { name: 'Cleared lair', page: 21, text: 'Where foes once dwelt; now part of your hold.' },
  wyrd: { name: 'Wyrd cavern', page: 29, text: 'Something strange from the Wyrd table (pages 29 – 30).' },
  crystal: { name: 'Crystal cavern', page: 19, text: 'Crystal cavern. At the start of each turn, draw a card before exploring. Gain ♦ equal to its value + cavern’s depth. If the A♦ is drawn, the cavern is destroyed. The grid space cannot be built in but can be passed.' },
};

export const GASES = {
  poison: { name: 'Poison gas', text: 'Poison gas: instantly defeats units in affected grid spaces.' },
  flammable: { name: 'Flammable gas', text: 'Flammable gas: explodes if lit, damages rooms and defeats units. Flammable gas explodes if it reaches a forge, inn, or barracks.' },
  blinding: { name: 'Blinding gas', text: 'Blinding gas: blocks Ranged.' },
};
