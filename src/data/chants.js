// The dwarven chants: invented words, original melodies in the Dorian mode on D.
// Each line is a list of [syllable, [[midi note, beats], …]]; several notes on one syllable
// make a melisma, as in plainchant. Edit freely: the music engine reads this as data.
//
// Line options: who (which choirs sing it: 'choir', 'cantor'), organum (a second choir a
// fifth below), rest (beats of silence after), shout ("HU!" at the end), drums ([[beat,
// strength]]), horn ([note, beat, length]).
//
// MIDI: 50 = D3, 53 = F3, 55 = G3, 57 = A3, 59 = B3, 60 = C4, 62 = D4, 38 = D2.

export const CHANTS = {
  // The Hall: a hymn for building and digging. Plainchant in unison, organum on the even lines,
  // a growling drone, a slow drum and a distant hammer.
  hall: {
    title: 'Hymn of the Deep Hall',
    unit: 0.42, attack: 0.1, choirLevel: 0.21, gap: 3,
    drone: 38, droneVowel: 'o', droneLevel: 0.075, growl: 0.5,
    pulse: { every: 4, pattern: [0.35, 0, 0.2, 0], anvil: [0, 0.22, 0, 0] },
    lines: [
      { syllables: [['dum', [[50, 2]]], ['gor', [[53, 1]]], ['ba', [[55, 1]]], ['rak', [[57, 2]]],
        ['ka', [[57, 1]]], ['ru', [[57, 1]]], ['zan', [[59, 1], [57, 1]]], ['dor', [[57, 1], [55, 1], [57, 3]]]] },
      { organum: true,
        syllables: [['ha', [[57, 1]]], ['ra', [[60, 1]]], ['gu', [[62, 2]]], ['mun', [[60, 1], [57, 1]]],
          ['gol', [[57, 1]]], ['da', [[55, 1]]], ['ra', [[53, 1]]], ['mor', [[55, 2], [53, 3]]]] },
      { syllables: [['o', [[53, 1]]], ['run', [[55, 1]]], ['ka', [[57, 2]]], ['tor', [[57, 1]]],
        ['ba', [[57, 1]]], ['lu', [[59, 1], [57, 1]]], ['zan', [[55, 1]]], ['kor', [[57, 3]]]] },
      { organum: true, rest: 2,
        syllables: [['dum', [[50, 2]]], ['gor', [[53, 1]]], ['ba', [[55, 1]]], ['rak', [[57, 2]]],
          ['ka', [[55, 1]]], ['ru', [[53, 1]]], ['zan', [[55, 1], [53, 1]]], ['dor', [[52, 1], [50, 5]]]] },
    ],
    words: [
      ['Dum gor ba-rak, ka-ru-zan dor', 'Stone and hammer of our fathers deep'],
      ['Ha-ra-gu mun, gol-da ra-mor', 'Fire in the forge, gold in the dark'],
      ['O-run ka-tor, ba-lu-zan kor', 'We dig, we hold, we do not yield'],
      ['Dum gor ba-rak, ka-ru-zan dor', 'Stone and hammer of our fathers deep'],
    ],
  },

  // Battle: a war chant. Short shouted phrases sung in octaves, drums and anvils driving,
  // war horns, and the whole band roaring "HU!".
  battle: {
    title: 'War Chant',
    unit: 0.25, attack: 0.16, choirLevel: 0.15, gap: 1, octaveBelow: true,
    drone: 38, droneVowel: 'a', droneLevel: 0.08, growl: 0.8,
    pulse: { every: 2, pattern: [0.75, 0.4, 0.6, 0.4], anvil: [0, 0.32, 0, 0] },
    lines: [
      { horn: [38, 0, 6], syllables: [['ba', [[50, 1]]], ['rak', [[50, 2]]], ['dum', [[53, 3]]]] },
      { syllables: [['ba', [[50, 1]]], ['rak', [[50, 2]]], ['dum', [[48, 3]]]] },
      { shout: true, rest: 2, syllables: [['ka', [[53, 1]]], ['ru', [[55, 1]]], ['zan', [[57, 2]]], ['gor', [[55, 1], [53, 1], [50, 2]]]] },
      { shout: true, rest: 2, syllables: [['dum', [[57, 2]]], ['gor', [[55, 2]]], ['ba', [[53, 2]]], ['rak', [[50, 4]]]] },
    ],
    words: [
      ['Ba-rak dum!', 'Hammer and stone!'],
      ['Ba-rak dum!', 'Hammer and stone!'],
      ['Ka-ru-zan gor! HU!', 'Our fathers watch! HU!'],
      ['Dum gor ba-rak! HU!', 'Stone and hammer! HU!'],
    ],
  },

  // Lament: when the hold falls. One voice sings; the choir answers, a fifth apart.
  lament: {
    title: 'Lament for the Fallen Hold',
    unit: 0.6, attack: 0.08, choirLevel: 0.15, gap: 4, cantor: true, cantorLevel: 0.26,
    drone: 38, droneVowel: 'u', droneLevel: 0.06, growl: 0.3,
    lines: [
      { who: ['cantor'], syllables: [['e', [[57, 2]]], ['li', [[55, 1]]], ['ka', [[53, 1]]], ['dor', [[55, 2], [53, 1], [52, 1], [53, 2]]]] },
      { organum: true, rest: 2, drums: [[0, 0.4]],
        syllables: [['mo', [[53, 1]]], ['ra', [[52, 1]]], ['gu', [[50, 2]]], ['dum', [[52, 1], [50, 4]]]] },
      { who: ['cantor'], syllables: [['ha', [[57, 1]]], ['ra', [[58, 2]]], ['ba', [[57, 1]]], ['lu', [[55, 2], [57, 1], [55, 1], [53, 2]]]] },
      { organum: true, rest: 3, drums: [[0, 0.4]],
        syllables: [['zan', [[53, 1]]], ['dor', [[55, 1], [53, 1]]], ['u', [[52, 2]]], ['mun', [[50, 6]]]] },
    ],
    words: [
      ['E-li ka-dor (one voice)', 'Rest now, kinsman'],
      ['mo-ra-gu dum (all)', 'beneath the stone'],
      ['Ha-ra ba-lu (one voice)', 'the forge-light'],
      ['zan-dor u-mun (all)', 'waits for you below'],
    ],
  },
};
