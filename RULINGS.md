# DELVE — Table Rulings

The rulebook (DELVE, Anna Blackwell, November 8th checked version) leaves some things
open. These are our table's readings. **The code follows this file.** Where the
book is clear, the book wins; page numbers are the printed page numbers.

Each ruling is tagged:

- **[Family]**: decided by you, in the interview or in your brief.
- **[Claude]**: a smaller call I made while building. Flag any you disagree with and I'll change it.

Ruling IDs (`R1`, `R2`, …) are referenced from code comments so a line of logic can
be traced back here.

---

## Setup & deck

**R1. Cards come from a virtual deck.** [Family] The game draws every card,
including the cards used for 1D4 / 1D2 rolls (p. 2: "Wherever this zine says Roll
1D4, draw a card and refer to its suit. ♠–1 ♣–2 ♦–3 ♥–4"; "Black – 1 Red – 2").
Every drawn card is shuffled back after it resolves (p. 4: "After you've resolved a
card … shuffle it back into the deck"), so each draw is from the full deck, except
Jokers being held out (p. 33). The shuffle is seeded and saved, so **Undo can't
re-roll a card**. [Claude] A Joker drawn for a 1D4/1D2 roll is ignored and redrawn;
a roll isn't exploring, so the Joker isn't "played".

**R2. Card values.** p. 43: "Jacks are worth 11, Queens are 12, Kings are 13, and
Aces are 1."

**R3. Supply caps: 50♥ and 50♦ to start.** [Family] The book never states a base
cap, but Stockpile/Treasury say "Increase your maximum … supply by 50" (p. 14–15).
Base cap 50 each; each Stockpile adds +50♥, each Treasury +50♦. Income above the
cap is lost (the chronicle notes it). So the pest (J♣ with >100♥) and thief (J♠ with
>100♦) events can't happen until you own at least two Stockpiles / Treasuries.
The Void Crystal's special Treasury adds +1,000 to the ♦ cap (p. 33).

**R4. The surface.** [Claude] Row 1 (the Entrance row, depth 1) is the top of the
world; you cannot explore above it. Pages extend left, right and down without
limit (p. 9: "go ahead and start another page").

## Map & pages

**R5. Pages are 8 wide × 10 tall** (US-letter 1" grid). [Family] The Entrance sits in
column 4 of the first page (p. 2: "the centre of the top row"). "Page edge" in rules
(rivers p. 19, volcanic shafts p. 20) means the edge of the page the source is on.

**R6. Multi-space finds are shaped automatically.** [Family] 1D4 caverns, lakes,
lairs, villages, etc. grow from the explored square into adjacent *unexplored*
squares, sideways first, then downward. If there's no room, they're as large as
fits (p. 9: "If no such grid space is available, place an empty cavern instead").

**R7. Where you can explore.** [Family] Any unexplored square orthogonally adjacent
to a square of your hold: a room, the Entrance, or an empty cavern you hold. Not
from flooded squares, uncleared lairs, Crystal Caverns or creature lairs. [Claude] The
square you dig from must itself be connected to the Entrance. p. 3:
"You can mine to the left or right of any room in your hold, as well as upward or
downward!"

**R8. How squares connect.** [Claude]
- Two horizontally adjacent open squares are connected.
- Vertically adjacent squares are connected only by a **link**:
  - a **stair link**, when the lower square is Stairs (p. 11: Stairs "serve to
    connect two levels of depth"), or
  - a **shaft link**, made when you explore or build straight up or down from a
    hold square into a new one, or dug by a burrower.
- When you explore a square that has hold squares beside it *and* above/below it,
  the sideways connection is used and no shaft is dug.
- Your dwarves use shafts as ladders at normal speed. Enemies climb them slowly
  (R14).

**R9. Disconnected rooms.** p. 5: "A room is considered disconnected if your units
would not logically be able to reach it from the Entrance." A room is disconnected
if no path of connected, passable squares links it to the Entrance. Flooded squares,
level-3 trap squares (p. 17) and undefeated Mimics block the path. Disconnected and
damaged rooms lose their function and don't spawn units.

**R10. Mined squares become empty caverns.** p. 3 lets you leave them blank
instead. We always draw the cavern (a setting may come later).

## Economy

**R11. Card bonuses come before depth.** [Family] ♥/♦ income = (card value + flat
card bonuses such as Shrine of Fortune +3) × every doubler (Overseer's Office,
Riches layer, Rune of Greed, multiplied together), **then** + depth.
Diamond Dust cancels the whole gain. p. 3: "add the value of the card, plus your
current depth". p. 14: ♦ cards "are worth double". p. 14: Shrine of Fortune
"increases the value of all ♦ cards by 3".

**R12. Trading.** p. 4: "Once per turn after exploring, you may trade … One unit of
Trade Goods (♦) is worth two units of Resources (♥)." One trade per turn, in one
direction, any amount. [Claude] ♥→♦ trades go in pairs (2♥ → 1♦); an odd ♥ can't
be traded. Rounding in your favour here would make 1♥ → 1♦, which is free money.

**R13. Rounding is in the player's favour everywhere.** [Family] (Kitchen +50% on an
odd Troop total rounds up; Twinned halving an odd STR rounds the enemy down; half a
room's repair cost rounds down, as the book says; and so on.) The book's explicit
"rounded down" cases (repairs p. 5, stone mites, thieves) are already in your
favour. Exception: R12.

**R15. Storehouse halves only the ♥ part** of a room's cost on its floor (row).
[Family] p. 14: "Rooms built on this floor cost ½ ♥." Halves round in your favour
(down). Several Storehouses on one row don't stack.

## Movement & combat

**R14. Enemies climbing.** [Family] Enemies take Stairs at the normal 1 space per
round. Any other upward link (shaft, Elevator, Volcanic shaft) costs them 2 rounds
per space, following the Elevator precedent (p. 16: "Enemies take 2 rounds per grid
to ascend an Elevator shaft"). Going down costs nothing extra. Burrowers dig at
their own rate. Enemies take the cheapest route by these costs (p. 7: "taking the
shortest possible route"). A Takeover (R22) happens only if no route exists at all.

**R16. Depth bonus.** [Family] +5 STR per depth level, Entrance row = depth 1. p. 7:
"add 5 to its STR for each level of depth … a forgotten crypt at depth 3 … 35,
based on their base STR of 20, plus the depth bonus of 15".

**R17. Round order.** p. 7: "All enemies move first. You choose the order in which
all units and Troops will move." Each round:
1. Every enemy moves one step along its route, or stays and fights if it shares a
   square with your units (R18).
2. You move each Troop one step (or hold), or Ranged Troops fire instead of moving.
3. All damage lands at once at the end of the round (p. 7: "Both sides deal their
   STR damage at the same time … at the end of the round").

**R18. Engagement.** [Claude] A square that holds both enemies and your Troops at the
end of the movement steps is a fight. Every Troop there deals its STR and every enemy
there deals its STR, all at once. Units already sharing a square with an enemy
when their move comes up stay and fight (they can't walk away). This follows p. 8:
a Troop that "starts a combat round in the same grid space as an enemy … triggers
an attack".

**R19. How a Troop takes damage.** [Claude] A Troop's STR is the sum of its units
(p. 6). Damage comes off that total. A unit is lost each time the damage taken adds up to
a full unit's STR, counting from the top. Survivors = total remaining ÷ unit STR,
**rounded up** (in your favour, R13). So a 10-STR Troop of two Soldiers taking 6
damage keeps 4 STR, which is 1 Soldier (p. 8: "6 damage in a Troop of soldiers, then a
unit is defeated"). After combat, survivors heal to full STR.

**R20. Splitting damage.** [Family] Automatic, no dialog:
- **Your damage** on a square holding several enemies goes to the **weakest enemy
  first**, and anything left over carries to the next.
- **Enemy damage** on several Troops in one square goes to Shields first, then to the
  **strongest Troop first** (so it can soak it), carrying over. (p. 8: "deal the
  enemy's damage out among them as you see fit.")

**R21. Ranged.** [Family] p. 8: "Ranged units can fire up to 2 grid spaces away, but
cannot move and fire in the same combat round." Range is measured as 2 steps through
connected open squares, never through rock, and diagonals aren't a step. A shot is blocked by Defensive
Barricades (p. 18), Blinding gas (p. 19), and the Dark trait if that enemy moved
this round (p. 36). Ranged damage is one-way (the target doesn't hit back), but a
Ranged Troop that shares a square with an enemy fights normally instead. Cannons fire once per
combat (p. 6).

**R22. When the hold falls.** [Family] p. 7: "If an enemy manages to reach your
Entrance and escape, your hold has fallen." An enemy that steps onto the Entrance is
fought there that round. If it is still alive at the start of the next enemy
movement step, it escapes and the game ends.

**R23. Takeover.** [Family] p. 10. If an enemy has no route to the Entrance at all:
1. It sweeps every square it can reach, setting off traps in its path (damage
   traps hit it; Stopping traps cost it nothing during a sweep).
2. If it survives, every room it reached is **claimed**: the room stops working, and
   units housed in claimed unit rooms become enemy versions with the same base STR,
   plus the depth bonus (p. 10: "Their base STR and abilities will be the same as
   their dwarven counterparts with the usual depth bonus").
3. Combat continues as a fight to retake the area. Nothing threatens the Entrance
   from claimed rooms that can't reach it. A claimed room comes back to you once no
   enemy stands in it.
Monstrosities follow p. 10's own lair rule instead.

**R24. Traps fire on spawn.** [Family] An enemy that appears on a trapped square
(Demon portal wave, hive, Circus, swamp toads, Takeover spawn) sets the trap off
immediately, and the trap is then spent (p. 17: "Once a trap has been activated by
an enemy, it is considered spent"). Otherwise traps fire when an enemy enters the
square.

## Rooms

**R25. "Connected" for Kitchen and Dorms means orthogonally adjacent.** [Family]
p. 13: Kitchen "Units in a room connected to a Kitchen get 50% STR during combat";
Dorms "Increases the maximum number of units each connected room can house by 50%
per grid of Dorms". Only rooms sharing an edge with the Kitchen or Dorms benefit. Kitchen
+50% is taken on the Troop's total, rounded up (R13). Dorms add +50% capacity per
adjacent Dorms square, rounded up.

**R26. The Entrance houses the starting Soldiers.** [Claude] p. 2: "note that you have
five Soldiers … at the Entrance." The Entrance houses up to 5 Soldiers and you can
recruit there to refill it, so it acts as a 5-bed barracks. It counts as a hold
square for exploring and as the base of a stairwell.

**R27. Corridors & Stairs placement.** p. 11: Corridors "may be built in an
unexplored space to the left or right of an existing room or empty cavern"; Stairs
"in an unexplored space below an existing room or empty cavern". [Claude] Both may
also be built on an empty cavern next to such a square. Every other room goes on an
unexplored square or empty cavern orthogonally adjacent to your hold (p. 5).

**R27a. Rooms may be built straight into unexplored rock, as the book says.** [Family]
p. 5: "Choose an unexplored space (one you haven't drawn in) or an empty cavern." We
considered a house rule limiting rooms to squares already explored, and chose the book's
rule. Building into rock skips that square's card draw, but you still explore every turn
(p. 3: "Each turn, you will choose a new adjacent grid on your map to explore"), so the
risk is never avoided, only the square the room stands on.

## Discoveries

**R28. Lairs fight when found.** [Family] Monster village (A♠), crypt (2♠), court
(K♠) and hive (9♣) attack the moment they are found, as a single enemy group placed
on the explored square, with STR as the book gives it (size × 10, etc.) plus depth
bonus. The Golem forge (10♠), large creature (Q♣) and Slumbering Wyrm (Q♠) wait
until you claim the room, attack them, or (Wyrm) wake them. A cleared lair becomes
part of your hold.

**R29. Liquid.** [Family] p. 43: "Liquid spreads to the nearest 2 open grid spaces
before stopping. If liquid can go downwards, through stairs/ladders/holes, it will go
down as far as possible."
1. The source squares (the river line, the lake squares) are liquid.
2. From the source, liquid fills the **2 nearest open squares**. Open means explored
   and not rock, counted in steps through connected squares, with ties broken left
   before right, then top before bottom.
3. From every wet square it then pours straight down through links as far as
   possible.
4. It never cuts through unexplored rock. Pumps (p. 16) and Defensive Barricades
   (p. 18) stop it.
5. It spills only if found by exploring sideways or upward (p. 9: "Digging down into
   a liquid source has no effect").

**R30. Gas** is the mirror of R29: 2 nearest open squares, then up as far as it can
go, and it "always spreads, regardless of how you discover it" (p. 9).

## Scoring & game end

**R31. Score.** [Family] Not in the book; our table's formula:
- **+10** per depth level reached (deepest row ever explored)
- **+5** per room built (not Corridors/Stairs, not found rooms like 7♠; a 2-square
  room counts once)
- **+ base STR** of every enemy killed (printed STR, no depth bonus)
- **+1** per turn survived
- **+** leftover ♥ and ♦
- **−2** per unit lost (each death counts, including Skull Dwarves that later revive;
  Prisoners you release on purpose don't count)

**R32. The game ends** when the hold falls, or when you find the Void Crystal: a
**+200** victory bonus is added and you may record the score or keep delving
(the score is recorded once, at the first ending).

## Optional modules

**R33. World Layers (p. 37)** are an option chosen when the game starts. **The
Challenges tracker (p. 41)** is kept across all games. Bloodrunes and the Hudrak
quest are not included yet.

## Errata followed

The book cross-references these wrongly; the code uses the entry names:
- Omen (p. 36) "unattended buried temples (5♠)" → Buried temple is **6♠**.
- Buried temple 6♠ (p. 21): the page numbers for Good/Bad Magic are swapped; the
  results follow the words ("On 1–3, consult Bad Magic … On 4, consult Good Magic").
- Elevator (p. 16) "See Takeover (Page 29)" → p. 10.
- Burglar Alarms (p. 31) "thief event (page 15)" → Treasury, p. 14–15.
- The p. 44 turn summary leaves out combat and the Prison's start-of-turn effects. We
  use: start of turn → explore → combat → trade → build → recruit → end of turn, and
  the Prison effects run at the start of the turn.
- Only Creepy Clowns (Circus of Chaos) and Twinned monstrosities carry the 👁 icon
  for using Secret Passages (p. 27, p. 36; p. 7 explains the icon). Thieves can also
  use them (p. 14).
