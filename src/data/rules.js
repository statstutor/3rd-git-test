// Core rule quotes, used by "what did that mean?" tooltips. Page = printed page number.

export const RULES = {
  hearts: { page: 3, title: '♥ Resources',
    text: 'If you draw a ♥ or ♦, add the value of the card, plus your current depth to your Resources (♥) or Trade Goods (♦). Once you do, feel free to draw an empty cavern in the space you chose, to represent what you’ve just mined.' },
  diamonds: { page: 3, title: '♦ Trade Goods',
    text: 'If you draw a ♥ or ♦, add the value of the card, plus your current depth to your Resources (♥) or Trade Goods (♦). Finding the 3♦ on depth 3 would let you add 6 to your Trade Goods.' },
  spadeAtDepth1: { page: 4, title: '♠ at depth 1',
    text: 'If you are exploring in depth 1 and draw a ♠, ignore that card and draw again; this will allow you some time to build up your hold, recruit Units, and prepare your defences.' },
  trading: { page: 4, title: 'Trading',
    text: 'Once per turn after exploring, you may trade: choose any amount of either your Resources or Trade Goods, and exchange them as follows: One unit of Trade Goods (♦) is worth two units of Resources (♥). One unit of Resources (♥) is worth half a unit of Trade Goods(♦).' },
  building: { page: 5, title: 'Building',
    text: 'You are limited to building one room per turn. … Draw the room in your chosen space, making sure it connects it to at least one adjacent explored space.' },
  recruiting: { page: 6, title: 'Recruiting',
    text: 'After you finish any building you do on your turn, you may recruit as many units as you are able to house and afford.' },
  depthBonus: { page: 7, title: 'Depth bonus',
    text: 'When spawning an enemy, add 5 to its STR for each level of depth. Example: you draw a 2♠, discovering a forgotten crypt at depth 3. The undead that spawn there will have a starting STR of 35, based on their base STR of 20, plus the depth bonus of 15.' },
  combat: { page: 7, title: 'Resolving combat',
    text: 'Each round, every unit and Troop will move one grid space, and then attack. All enemies move first. … If a unit or enemy’s move would cause it to enter the same grid space as an opponent, it triggers an attack. Both sides deal their STR damage at the same time, weakening or defeating each other at the end of the round.' },
  holdFalls: { page: 8, title: 'The hold falls',
    text: 'If an enemy manages to reach your Entrance and escape, your hold has fallen. The game is over. Chronicle the hold’s fall and remember their valiant efforts.' },
};
