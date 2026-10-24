// Playing-card basics. p. 43: "Jacks are worth 11, Queens are 12, Kings are 13, and Aces are 1"
// p. 2: "Roll 1D4 … ♠–1 ♣–2 ♦–3 ♥–4"  /  "Roll 1D2 … Black – 1 Red – 2"

export const SUITS = {
  S: { name: 'Spades', symbol: '♠', color: 'black', d4: 1 },
  C: { name: 'Clubs', symbol: '♣', color: 'black', d4: 2 },
  D: { name: 'Diamonds', symbol: '♦', color: 'red', d4: 3 },
  H: { name: 'Hearts', symbol: '♥', color: 'red', d4: 4 },
};

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const RANK_VALUES = {
  A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13,
};

export const RANK_NAMES = {
  A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King',
};

// Jokers: added to the deck on reaching depth 5 (p. 33).
export const JOKERS = {
  RJ: { name: 'Red Joker', color: 'red' },
  BJ: { name: 'Black Joker', color: 'black' },
};
