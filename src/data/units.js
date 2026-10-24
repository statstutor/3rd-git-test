// Units table, p. 6. Edit a line here to correct a stat; the engine reads it.
// `implemented: false` units are shown in the rules but can't be recruited yet.

export const UNITS = {
  soldier: {
    name: 'Soldier', plural: 'Soldiers', str: 5, cost: { diamonds: 5 },
    power: '', implemented: true,
  },
  gunner: {
    name: 'Gunner', plural: 'Gunners', str: 3, cost: { diamonds: 5 },
    power: 'Ranged', ranged: true, implemented: false,
  },
  hound: {
    name: 'Hound', plural: 'Hounds', str: 3, cost: { diamonds: 5 },
    power: 'Moves 2 spaces per round', moves: 2, implemented: false,
  },
  cleric: {
    name: 'Cleric', plural: 'Clerics', str: 1, cost: { diamonds: 8 },
    power: 'Shields adjacent units (5 STR per Cleric)', implemented: false,
  },
  mage: {
    name: 'Mage', plural: 'Mages', str: 4, cost: { diamonds: 7 },
    power: 'Ranged', ranged: true, implemented: false,
  },
  prisoner: {
    name: 'Prisoner', plural: 'Prisoners', str: 1, cost: {},
    power: 'Hostile to both sides. See Prison (page 13)', implemented: false,
  },
  alchemist: {
    name: 'Alchemist', plural: 'Alchemists', str: 2, cost: { diamonds: 8 },
    power: '', implemented: false,
  },
  golem: {
    name: 'Golem', plural: 'Golems', str: 7, cost: { diamonds: 15 },
    power: 'Immune to liquid and gas', implemented: false,
  },
  cannon: {
    name: 'Cannon', plural: 'Cannons', str: 30, cost: { diamonds: 30 },
    power: 'Ranged. Can fire once per combat', ranged: true, oncePerCombat: true, implemented: false,
  },
  skullDwarf: {
    name: 'Skull Dwarf', plural: 'Skull Dwarves', str: 1, cost: { diamonds: 5 },
    power: 'On defeat, roll 1D4: 3+ revive after combat', implemented: false,
  },
};
