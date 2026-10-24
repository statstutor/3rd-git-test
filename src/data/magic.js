// Good Magic (pp. 25–26), Bad Magic (pp. 27–28), Wyrd (pp. 29–30) and the Monster & Item
// Prompts (p. 42), in the book's words. The ♣/♠ discoveries draw on these.
// Magic and Wyrd *effects* are not automated yet: the game draws the card, shows the entry,
// and records it in the chronicle.

export const GOOD_MAGIC = {
  A: { name: 'Passage to the Deep', page: 25, text: 'A magical portal that allows you quick access to the depths. Draw a card, and create the other end of the portal a number of grid spaces directly below this room equal to its value.' },
  2: { name: 'Protective Wards', page: 25, text: 'Magical sigils, floating lights, or another form of magic entirely protects a room of your choice. Counts as a Level 3 Damage Trap but does not block your units.' },
  3: { name: 'Living Metal', page: 25, text: 'This spell counts as a unit, but cannot attack or be attacked on its own. During combat, spawn this from any Forge. When it moves into the same grid space as a friendly unit / Troop, it grants that unit / Troop +40 STR.' },
  4: { name: 'Clone', page: 25, text: 'Choose a Troop and gain an identical clone copy of it. Just don’t look directly into their unblinking eyes...' },
  5: { name: 'Pawrtal', page: 25, text: 'An elvish wizard’s pocket realm, filled with lovable cats. Once per turn you may pay 5♦ to roll 1D4. On a 4, gain a friendly Sabretooth (20 STR, 2 grid space movement). Spawns from a Kennel during combat.' },
  6: { name: 'Fleet Forest', page: 25, text: 'Green liquid pours from this grid space, growing thick bamboo shoots and massive trees in every grid space it touches. You may cut down the growth in each grid space for 20♥. Does not need to be drained, and does no damage.' },
  7: { name: 'Blessing', page: 25, text: 'The gods have smiled upon you, sealing any revealed demon portals (9♠), or Circuses of Chaos (page 29).' },
  8: { name: 'Siren Song', page: 26, text: 'A magical instrument that draws enemies to it. Choose a room to place the Siren Song in: enemies will try to reach this room instead of your Entrance. If an enemy reaches this room, the siren song is destroyed.' },
  9: { name: 'Nurse’s Sigil', page: 26, text: 'Red heart engravings surrounded by floating lights. Choose a grid space. Units and Troops that move through this space are returned to full STR.' },
  10: { name: 'Gills', page: 26, text: 'A blessing, though from what source, you do not know. Dwarves are now unaffected by liquids (excluding lava).' },
  J: { name: 'Valkyria', page: 26, text: 'Ethereal dwarves wander the halls of your hold, attending to the sick and dying. Hospital rooms no longer need adjacency, but are still limited to 1 Troop per combat.' },
  Q: { name: 'Hudrak’s Chains', page: 26, text: 'Choose a room. If an Ancient Monstrosity enters the chosen room, it is permanently trapped by Hudrak’s Chains. Once one is trapped, dwarves can no longer pass through this room.' },
  K: { name: 'Charming Colours', page: 26, text: 'A living spell that will make friends of your enemies. Charming Colours moves as though it were a unit, and when it reaches a grid space with an enemy, you gain control of it, and may treat it like one of your own units. Cannot affect Ancient Monstrosities. Charming Colours disappears once an enemy has been charmed.' },
};

export const BAD_MAGIC = {
  A: { name: 'The Greedy King’s Touch', page: 27, text: 'A cursed dwarf touches everything in a room of your choice, turning it, and themselves, to gold. Gain 30♦ for each grid space of the room, then it is destroyed.' },
  2: { name: 'Grozin’s Garish Gaze', page: 27, text: 'Double the cost of the next room you build. The room must be decorated awfully: bright pastel colours, outrageous decor...just plain terrible.' },
  3: { name: 'Diamond Dust', page: 27, text: 'The next ♦ you draw while exploring turns to dust in your hands: you gain no benefit from it. If the card is drawn for a Crystal Cavern (6♣), the cavern is destroyed.' },
  4: { name: 'Contagious Cowardice', page: 27, text: 'The nearest Troop is affected by a magical terror. The Troop moves to the Entrance to escape, taking the shortest possible route. If the Troop passes through any Unit Rooms, all units in those rooms leave with them.' },
  5: { name: 'Mortek’s Magma Drill', page: 27, text: 'A pillar of lava melts through 2D4 grid spaces below the room where this spell is discovered, destroying any rooms in those spaces. Liquid.' },
  6: { name: 'Circus of Chaos', page: 27, text: 'A Circus appears in the nearest empty grid space. This acts like a Demon Portal (9♠), except it spawns Creepy Clowns with 30 STR instead.' },
  7: { name: 'Worm', page: 27, text: 'Using the grid space this spell is discovered in as its source, the Worm burrows through 1D4 grid spaces, destroying any rooms it moves through, leaving a tunnel in its wake. Roll 1D4 to determine direction: 1 – Up, 2 – Left, 3 – Down, 4 – Right.' },
  8: { name: 'Swampify!', page: 28, text: 'A swamp spawns in this grid space. Treat as liquid. At the end of your next turn, spawn Murder Toads (10 STR) in each grid touched by the swamp’s liquid.' },
  9: { name: 'Mimic', page: 28, text: 'The nearest room becomes a Mimic. Its door hides a mouth; its furnishings cover wicked teeth. This room has 100 STR, and cannot move. Your units cannot pass this room until it is defeated.' },
  10: { name: 'Doomed', page: 28, text: 'Remove the Red Joker for 5 turns. Shuffle the Black Joker into the deck if it is not already in.' },
  J: { name: 'Possession', page: 28, text: 'The nearest unit / Troop is possessed by evil spirits and becomes an enemy.' },
  Q: { name: 'Outbreak', page: 28, text: 'Roll 1D2. If there are any Units / Troops within that many grid spaces, they become hostile Undead (10 STR), and you repeat this process from the grid space with the newly created Undead. This does not affect Golems, Cannons, or Skull Dwarves.' },
  K: { name: 'Monstrous Form', page: 28, text: 'Spawn an Ancient Monstrosity with only 25 STR. Draw only once for a single trait.' },
};

export const WYRD = {
  A: { name: 'Bone-ribbed cavern', page: 29, text: 'A cavern supported by the bones of an ancient beast. 1D4 grid spaces in size. Rooms built here automatically get a special Level 5 Defensive Barricade.' },
  2: { name: 'Slime cave', page: 29, text: 'Uh oh...slime cave. Spawn Slimes (32 STR). Whenever these pesky creatures are killed, coat the current grid space with slime which costs the same as lava to drain.' },
  3: { name: 'Meat cave', page: 29, text: 'Meat cave. No stone, just meat and organs, in a twisted parody of life.' },
  4: { name: 'A portal', page: 29, text: 'A portal. Choose a space within 5 grid spaces and spawn a second portal there. Units can travel between these two portals as if they were adjacent.' },
  5: { name: 'Nuts?!', page: 29, text: 'Nuts?! A preposterous amount of acorns, and squirrels. Treat as a liquid (a river of nuts), followed by a Hive (9♣) of Squirrels.' },
  6: { name: 'God Mushroom', page: 29, text: 'This cavern is filled with the hyphae of a God Mushroom. It spreads 1 grid space per turn unless touched by fire or lava. Any Units / Troops in a space affected by the spread become infected: they gain +5 STR and become hostile.' },
  7: { name: 'Time Crystals', page: 29, text: 'Time Crystals. Roll 1D2 whenever a unit / Troop enters this room. On 1, they are safe. On 2, they are aged to dust. Optionally, you can now build rooms from the game UMBRA at 10x their written cost.' },
  8: { name: 'Living fossils', page: 30, text: 'Glacially slow, living fossils that crave the sun’s embrace. If you have (or find) Time Crystals, they come to life with 100 STR and are hostile. Tamable once they come to life.' },
  9: { name: 'Mole people', page: 30, text: 'Behold, a village of mole people! These peculiar creatures walk and talk like us, and can be hired for 10♦ each. Moles have 7 STR and can travel through walls and floors.' },
  10: { name: 'Dwarf in crystal', page: 30, text: 'A dwarf encased in crystal clutching an artefact. Mine them out to draw on the Legendary Finds table (pages 33 - 34) and receive a free Soldier.' },
  J: { name: 'Knowledgeable creature', page: 30, text: 'A knowledgeable creature resides here, offering wisdom of the depths. Once per turn, you may pay the creature 5♦ to look at the top card of the deck and choose whether to keep or discard it. If you choose to discard, you must play the next card. Jokers cannot be discarded.' },
  Q: { name: 'Whistling Caves', page: 30, text: 'Whistling Caves. Any unit / Troop that moves within 2 grid spaces of this room must roll a 4 on 1D4 to resist getting lost in its depths. If they fail they enter the cave and are defeated. Does not affect Ancient Monstrosities.' },
  K: { name: 'The Realm of Lost Things', page: 30, text: 'The Realm of Lost Things. 2 grid spaces in size. Filled with junk. Each turn, draw a card. If it is a numbered card, gain ♦ equal to its value. Face cards give you one free unit: J – Soldier, Q – Golem, K – Cannon.' },
};

// p. 42: "pick the option you want, or roll 1D4". The game rolls.
export const PROMPTS = {
  village: ['Goblins', 'Kobolds', 'Frog People', 'Pixies'],
  court: ['Wizard’s Study', 'Cthonic Cult', 'Elvish Oubliette', 'Demonic Fortress'],
  large: ['Cave Kraken', 'Basilisk', 'Living Shadow', 'Elemental'],
  burrower: ['Sabre-tooth Mole', 'Stone Worm', 'Undead Owl', 'Nesting Lizard'],
  small: ['Feral Dwarf', 'Troll', 'Huge Bat', 'Angry Cave Goat'],
  trappedEvil: ['Burning Orb', 'Chain Bound Soul', 'Skull Topped Staff', 'Arcane Machinery'],
  hive: ['Black Wasps', 'Giant Ants', 'Clockwork Spiders', 'Snakes'],
};

// Court denizens, to name the enemy that rises from each kind of court.
export const COURT_FOES = {
  'Wizard’s Study': 'Spellbound Apprentices',
  'Cthonic Cult': 'Cultists',
  'Elvish Oubliette': 'Elvish Wardens',
  'Demonic Fortress': 'Demon Courtiers',
};
