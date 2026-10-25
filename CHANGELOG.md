# Changelog

## Music sample 2: dwarven chant (not yet in the game)

- Rebuilt as **chant**: Gregorian-style plainchant (one melody, Dorian mode, free rhythm,
  melismas, organum a fifth below) sung in invented dwarvish with real consonants, by a deep
  choir of jittered voices sharing one set of vowel filters.
- **Viking edge:** a held drone with a throat-singing growl, frame drums, war horns, "HU!"
  shouts. The lament is call and response: one voice, then the choir.
- The chants are data in `src/data/chants.js` (words, melodies, translations).

## Music sample 1 (replaced)

- `src/ui/music.js`: dwarven music made live with the Web Audio API, with no recordings. A low
  choir drone in open fifths, an original melody, anvil and frame-drum work rhythms, horn calls
  and a long cave echo. Three moods (hall, battle, lament) and two calls (horn, treasure).
- `dist/music-sample.html`: a page to try it before it goes into the game.

## 0.2.0 — Every ♣ and ♠ card

**All 26 Natural Formations and Remnants now play by the book** (RULINGS R34–R54):
- **Liquid:** rivers and magma run to the page edge, lakes take 1D4 squares, and liquid
  spills into the 2 nearest open squares and pours down shafts. Units drown, and lava
  damages rooms. Drain for 5♦ (lava 20♦); Corridors can bridge water.
- **Gas:** poison kills, flammable gas explodes at a Barracks, blinding gas blocks Ranged.
  Gas rises up shafts.
- **Foes:** hives, monster villages (which steal from empty rooms), desolate courts, crypts,
  a raiding small creature that goes home, a large creature that guards its lair until
  struck, burrowing beasts that tunnel into the hold, golem forges to claim, and a
  Slumbering Wyrm to steal from. When woken it breathes fire and scorches rooms.
- **Places:** wishing well, sealed room, buried temple (Cleric), demon portal (rolls at
  the end of every turn), ancient library, abandoned room (you choose), long lost
  artefact (+15 STR to a room's Troops), abandoned mine, crystal caverns (♦ each turn),
  underground forest (+2♥ a turn, or a free room), volcanic shaft.
- **Skull Dwarves** can be summoned in cleared crypts and may rise again after a fight.
- **Magic and Wyrd draws** show the entry, but their effects aren't automated yet.
- **Interface:** a "Places in the hold" list (wish, steal, open, attack, drain, repair),
  Withdraw in combat, extra draws shown under "The last card", ink drawings for every
  find, water, lava and gas shading, and depth numbers pinned to the edge of the map.
- **Saves from 0.1** load and carry on.
- **Tests:** 60, including one for every card and liquid, gas and lair rules.

## 0.1.3 — iPhone

- iPhone/iPad file previews (the Files app) show the page without running it, so the game
  looked frozen. The page now says so and points you to the link in Safari.
- A hosted copy is built as `dist/delve-hosted.html` for playing from a link.

## 0.1.2 — Taps on the map, version label

- Map squares now respond to the plain click event, which every browser and in-app viewer
  sends. Before, a viewer that refused pointer capture could ignore every tap on the map.
- The version number shows under the title, so it's clear which copy of the file is open.
- Works without ResizeObserver (older webviews).

## 0.1.1 — Getting started fix

- The map now zooms to fit your hold and the squares you can dig, on any screen size.
  Before, phones and narrow windows opened on empty rock and the game looked frozen.
- The Explore panel lists every square you can dig as a button ("⛏ East of the Entrance,
  depth 1"), so you can play without tapping the map.
- Unexpected errors now show on screen instead of failing silently.
- Works in older browsers without `structuredClone` (e.g. Safari before 15.4).

## 0.1.0 — Vertical slice

First playable slice, built after the rules interview (see RULINGS.md).

**Play**
- Open `dist/delve.html` in any modern browser. It runs offline, needs nothing installed, and
  autosaves to the browser.
- Start a hold: Entrance stairwell, 20♥, 20♦, five Soldiers.
- Explore by clicking an ochre square. ♥/♦ give card value + depth (capped at 50 each).
  A ♠ at depth 1 is redrawn.
- ♣ cards: **5♣ Cavern** is complete (1D4 squares, shaped automatically). Other ♣ cards
  are drawn as plain caverns for now, and the chronicle says so.
- ♠ cards: **2♠ Forgotten Crypt** is complete (20 STR + depth bonus, fights on
  discovery, becomes a crypt once cleared). Other ♠ cards stand in as crypts for now,
  and the chronicle says so.
- Trade once per turn (1♦ = 2♥). Build one room per turn: Corridor, Stairs, Barracks.
  Recruit Soldiers (5♦) into Barracks or the Entrance.
- Combat: enemies move first along the cheapest route (stairs 1, shafts 2 to climb).
  You move each Troop one square, and damage lands all at once at the end of the round.
  Troops lose units per R19. The hold falls if a foe on the Entrance survives the round.
- Score per R31, and a hall-of-records high-score table.

**Interface**
- Hand-inked SVG map on 8×10 grid-paper pages with depth numbers. Drag to pan; scroll or
  use the buttons to zoom.
- Ink drawings for the Entrance, Corridor, Stairs, Barracks, cavern, crypt and lair.
  Shafts are drawn as ladders, and Stairs as steps.
- Running chronicle with the rulebook's wording on hover. It can be exported as `.txt`.
- "The last card" panel quotes what the card means, with the page number.
- Undo (Ctrl+Z, 60 steps; the deck remembers, so no redraws), save/load to a JSON file.

**Engine**
- Rules engine in `src/engine/` is separate from the UI. Tables live in `src/data/`.
- 31 unit tests: income and depth, caps, trading, build limits and placement,
  connectivity, enemy routes and climbing, combat damage, splitting, the hold falling,
  scoring, plus 300 random games played through the engine.

**Not yet:** the remaining ♣/♠ entries, other rooms and units, traps and barricades,
liquid and gas, Takeover, magic tables, Adventurers, Jokers and Legendary Finds,
Monstrosities, World Layers, Challenges.
