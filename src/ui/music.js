// Dwarven music, made in the browser with the Web Audio API: no audio files, works offline.
// A low male-voice drone in open fifths, hammer-and-anvil work rhythms, frame drums, horn calls,
// all inside a long cave reverb. Moods: 'hall' (building), 'battle', 'lament'.
// Stings: 'horn' (foes found), 'treasure'.
//
//   const music = createMusic();
//   music.start('hall');      // must be called from a tap/click (browsers require it)
//   music.sting('horn');
//   music.setMood('battle');
//   music.setVolume(0.6);
//   music.stop();

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

// Vowel formants for a low male voice: [frequency, gain, Q].
const VOWELS = {
  ah: [[600, 1, 8], [1040, 0.45, 10], [2250, 0.18, 12]],
  oo: [[320, 1, 9], [800, 0.3, 10], [2240, 0.08, 12]],
};

// D minor / Dorian, chords voiced in fifths and octaves with an occasional third.
// Each mood: tempo, beats per chord, the chord cycle, an optional melody, and drum patterns
// over one bar of eight quavers (1 = hit, 0.5 = soft).
const MOODS = {
  hall: {
    bpm: 54, beatsPerChord: 8, glide: 1.4, choir: 0.16, vowel: 'ah',
    chords: [[38, 45, 50, 53], [36, 43, 48, 52], [34, 41, 46, 50], [33, 40, 45, 48]],
    melody: {
      every: 2, vowel: 'oo', level: 0.13,
      // [midi, beats] — eight beats per chord, an original tune
      notes: [[57, 2], [62, 2], [60, 1], [57, 1], [55, 2],
        [55, 2], [52, 2], [55, 2], [60, 2],
        [62, 3], [60, 1], [57, 2], [53, 2],
        [52, 2], [55, 1], [57, 1], [57, 4]],
    },
    drum: [1, 0, 0, 0, 0, 0, 0, 0],
    anvil: [0.6, 0, 0, 0, 0.45, 0, 0, 0],
    ostinato: null,
  },
  battle: {
    bpm: 108, beatsPerChord: 4, glide: 0.25, choir: 0.2, vowel: 'ah',
    chords: [[38, 45, 50, 53], [34, 41, 46, 50], [38, 45, 50, 53], [36, 43, 48, 55]],
    melody: null,
    drum: [1, 0, 0, 0.7, 1, 0, 0.7, 0.5],
    anvil: [1, 0, 0.5, 0, 1, 0, 0.5, 0],
    ostinato: { level: 0.16, steps: [0, 0, 0, 3, 0, 0, -2, 0] }, // semitones over the chord root
  },
  lament: {
    bpm: 40, beatsPerChord: 8, glide: 2.2, choir: 0.15, vowel: 'oo',
    chords: [[38, 45, 50, 53], [43, 50, 55, 58], [34, 41, 46, 50], [33, 40, 45, 49]],
    melody: {
      every: 1, vowel: 'ah', level: 0.11,
      notes: [[62, 4], [60, 2], [58, 2],
        [57, 4], [55, 4],
        [53, 3], [55, 1], [53, 2], [50, 2],
        [52, 4], [49, 2], [50, 2]],
    },
    drum: [0.5, 0, 0, 0, 0, 0, 0, 0],
    anvil: [0, 0, 0, 0, 0, 0, 0, 0],
    ostinato: null,
  },
};

export function createMusic() {
  let ctx = null;
  let master;
  let bus;
  let choir = [];
  let moodName = null;
  let mood = null;
  let timer = null;
  let step = 0;
  let nextTime = 0;
  let melodyCycle = 0;
  let volume = 0.7;

  function impulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        // darkened noise: a stone hall swallows the highs
        last = last * 0.82 + (Math.random() * 2 - 1) * 0.18;
        d[i] = last * (1 - i / len) ** decay;
      }
    }
    return buf;
  }

  function init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    // iPhone: play even with the ring/silent switch on, where Safari allows it.
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older Safari */ }
    master = ctx.createGain();
    master.gain.value = volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    master.connect(comp);
    comp.connect(ctx.destination);
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(4.2, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.7;
    reverb.connect(wet);
    wet.connect(master);
    bus = ctx.createGain();
    bus.gain.value = 0.8;
    bus.connect(master);
    bus.connect(reverb);
  }

  // One sung voice: detuned saws through vowel formants, with a slow vibrato.
  function voice(freq, vowel, level = 0) {
    const out = ctx.createGain();
    out.gain.value = level;
    const pre = ctx.createGain();
    pre.gain.value = 0.35;
    const oscs = [-8, 0, 7].map((cents) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = cents;
      o.connect(pre);
      return o;
    });
    const sub = ctx.createOscillator();
    sub.frequency.value = freq;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.5;
    sub.connect(subGain);
    subGain.connect(out);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4.6 + Math.random() * 0.8;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 9; // cents
    lfo.connect(lfoGain);
    for (const o of oscs) lfoGain.connect(o.detune);
    const filters = [];
    for (const [f, g, q] of VOWELS[vowel]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const fg = ctx.createGain();
      fg.gain.value = g * 2.2;
      pre.connect(bp);
      bp.connect(fg);
      fg.connect(out);
      filters.push(bp);
    }
    out.connect(bus);
    const all = [...oscs, sub, lfo];
    const t = ctx.currentTime;
    for (const o of all) o.start(t);
    return {
      out,
      vowel,
      glide(f, at, dur) {
        for (const o of [...oscs, sub]) {
          o.frequency.cancelScheduledValues(at);
          o.frequency.setTargetAtTime(f, at, dur / 3);
        }
      },
      fade(levelTo, at, dur) {
        out.gain.cancelScheduledValues(at);
        out.gain.setTargetAtTime(levelTo, at, dur / 3);
      },
      stop(at) { for (const o of all) o.stop(at); },
    };
  }

  // A sung melody note with its own swell and release.
  function sing(midi, at, dur, vowel, level) {
    const v = voice(midiHz(midi), vowel, 0);
    v.out.gain.setValueAtTime(0, at);
    v.out.gain.linearRampToValueAtTime(level, at + Math.min(0.35, dur * 0.3));
    v.out.gain.setValueAtTime(level, at + dur * 0.75);
    v.out.gain.linearRampToValueAtTime(0, at + dur + 0.4);
    v.stop(at + dur + 0.6);
  }

  // Frame drum: a pitch-dropping thump with a little skin noise.
  function drum(at, vel) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(95, at);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.35);
    g.gain.setValueAtTime(0.9 * vel, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.7);
    o.connect(g);
    g.connect(bus);
    o.start(at);
    o.stop(at + 0.75);
    noise(at, 0.08, 900, 0.25 * vel);
  }

  // Hammer on anvil: inharmonic ringing partials and a sharp strike.
  function anvil(at, vel) {
    for (const [f, a, d] of [[1180, 0.22, 1.1], [2720, 0.12, 0.8], [3910, 0.07, 0.5], [5300, 0.04, 0.3]]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(a * vel, at);
      g.gain.exponentialRampToValueAtTime(0.0005, at + d);
      o.connect(g);
      g.connect(bus);
      o.start(at);
      o.stop(at + d + 0.05);
    }
    noise(at, 0.03, 3500, 0.35 * vel);
  }

  function noise(at, dur, cutoff, level) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.value = level;
    src.connect(f);
    f.connect(g);
    g.connect(bus);
    src.start(at);
  }

  // A brass horn: saw through a lowpass that opens as the player blows.
  function horn(midi, at, dur, level = 0.25, bright = 1800) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const f = midiHz(midi);
    o.frequency.setValueAtTime(f * 0.94, at);
    o.frequency.exponentialRampToValueAtTime(f, at + 0.12);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(200, at);
    lp.frequency.linearRampToValueAtTime(bright, at + 0.25);
    lp.frequency.setTargetAtTime(bright * 0.6, at + 0.3, dur / 2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + 0.1);
    g.gain.setValueAtTime(level, at + dur * 0.8);
    g.gain.linearRampToValueAtTime(0, at + dur + 0.15);
    o.connect(lp);
    lp.connect(g);
    g.connect(bus);
    o.start(at);
    o.stop(at + dur + 0.2);
  }

  // A struck bell for treasure: inharmonic partials, long shimmer.
  function bell(midi, at, level) {
    const f = midiHz(midi);
    for (const [ratio, a, d] of [[1, 1, 2.6], [2.76, 0.4, 1.6], [5.4, 0.2, 0.9], [8.9, 0.1, 0.5]]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f * ratio;
      g.gain.setValueAtTime(level * a, at);
      g.gain.exponentialRampToValueAtTime(0.0005, at + d);
      o.connect(g);
      g.connect(bus);
      o.start(at);
      o.stop(at + d + 0.05);
    }
  }

  // ------------------------------------------------------------- the score

  function setChoirTo(chord, at, glide) {
    if (!choir.length) {
      choir = chord.map((m) => voice(midiHz(m), mood.vowel, 0));
    }
    chord.forEach((m, i) => {
      choir[i].glide(midiHz(m), at, glide);
      choir[i].fade(mood.choir * (i === 3 ? 0.6 : 1), at, Math.max(glide, 0.6));
    });
  }

  function scheduleStep(at) {
    const stepsPerChord = mood.beatsPerChord * 2;
    const cycleSteps = stepsPerChord * mood.chords.length;
    const inCycle = step % cycleSteps;
    const chordIdx = Math.floor(inCycle / stepsPerChord);
    const chord = mood.chords[chordIdx];
    const sec = 60 / mood.bpm / 2; // one quaver

    if (inCycle % stepsPerChord === 0) setChoirTo(chord, at, mood.glide);
    if (inCycle === 0 && step > 0) melodyCycle++;

    const bar = inCycle % 8;
    if (mood.drum[bar]) drum(at, mood.drum[bar]);
    if (mood.anvil[bar]) anvil(at + 0.01, mood.anvil[bar]);
    if (mood.ostinato) {
      const st = mood.ostinato.steps[bar];
      horn(chord[0] + 12 + st, at, sec * 0.8, mood.ostinato.level, 900);
    }
    if (mood.melody && melodyCycle % mood.melody.every === 0) {
      let pos = 0;
      for (const [m, beats] of mood.melody.notes) {
        if (pos === inCycle) sing(m, at, beats * 2 * sec, mood.melody.vowel, mood.melody.level);
        pos += beats * 2;
      }
    }
  }

  function tick() {
    while (nextTime < ctx.currentTime + 0.25) {
      scheduleStep(nextTime);
      nextTime += 60 / mood.bpm / 2;
      step++;
    }
  }

  function setMood(name) {
    if (!MOODS[name]) return;
    if (!ctx) return start(name);
    const fresh = name !== moodName;
    moodName = name;
    mood = MOODS[name];
    if (fresh) {
      // Begin the new mood on the next quaver, from the top of its cycle.
      step = 0;
      melodyCycle = 0;
      nextTime = ctx.currentTime + 0.05;
      if (choir.length && choir[0].vowel !== mood.vowel) {
        const t = ctx.currentTime;
        for (const v of choir) { v.fade(0, t, 0.8); v.stop(t + 2); }
        choir = [];
      }
    }
  }

  function start(name = 'hall') {
    if (!ctx) init();
    if (ctx.state === 'suspended') ctx.resume();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(volume, ctx.currentTime, 0.3);
    moodName = null;
    setMood(name);
    if (!timer) timer = setInterval(tick, 40);
  }

  function stop() {
    if (!ctx) return;
    clearInterval(timer);
    timer = null;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(0, t, 0.6);
    for (const v of choir) v.stop(t + 3);
    choir = [];
    moodName = null;
  }

  function sting(kind) {
    if (!ctx) init();
    if (ctx.state === 'suspended') ctx.resume();
    if (!timer) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(volume, ctx.currentTime); }
    const t = ctx.currentTime + 0.05;
    if (kind === 'horn') {
      // Foes found: a long call from deep in the mountain, answered higher.
      horn(50, t, 0.7, 0.3);
      horn(57, t + 0.8, 0.7, 0.3);
      horn(62, t + 1.6, 2.2, 0.32, 2200);
      horn(38, t + 1.6, 2.2, 0.18, 700);
      drum(t + 1.6, 1);
    } else if (kind === 'treasure') {
      [74, 77, 81, 86, 81].forEach((m, i) => bell(m, t + i * 0.16, 0.16));
      bell(62, t, 0.12);
    }
  }

  return {
    start, stop, setMood, sting,
    setVolume(v) {
      volume = v;
      if (ctx && timer) master.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
    },
    get mood() { return moodName; },
    get playing() { return !!timer; },
  };
}
