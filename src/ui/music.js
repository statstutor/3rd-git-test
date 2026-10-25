// Dwarven chant, made live in the browser with the Web Audio API: no recordings, works offline.
// Gregorian-style plainchant (one melody, Dorian mode, free rhythm, melismas, parallel-fifth
// organum) sung by a deep choir in invented dwarvish, with a Viking edge: a growling drone,
// frame drums, war horns and shouts.
//
// Each choir is a group of singers sharing one set of vowel filters, so they sing the same
// syllables together. Consonants are added as breath, bursts, hums and rolls.
//
//   const music = createMusic();
//   music.start('hall');      // from a tap or click (browsers require it)
//   music.setMood('battle');  // 'hall', 'battle', 'lament'
//   music.sting('horn');      // 'horn', 'treasure'
//   music.setVolume(0.6);
//   music.stop();

import { CHANTS } from '../data/chants.js';

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

// Male vowel formants [frequency, gain], lowered a touch for broad dwarven chests.
const BODY = 0.93;
const VOWELS = {
  a: [[700, 1], [1150, 0.5], [2450, 0.2], [3300, 0.1]],
  e: [[450, 1], [1800, 0.35], [2500, 0.2], [3350, 0.1]],
  i: [[300, 1], [2200, 0.2], [3000, 0.12], [3400, 0.08]],
  o: [[500, 1], [850, 0.45], [2450, 0.1], [3300, 0.06]],
  u: [[330, 1], [800, 0.25], [2250, 0.06], [3200, 0.04]],
  m: [[250, 1], [1100, 0.04], [2500, 0.02], [3300, 0.01]], // a closed-mouth hum
};
const BANDWIDTH = [90, 100, 130, 160];

// Split a syllable like "rak" into onset "r", vowel "a", coda "k".
function parseSyllable(s) {
  const m = /^([^aeiou]*)([aeiou])[aeiou]*([^aeiou]*)$/.exec(s.toLowerCase());
  return m ? { onset: m[1], vowel: m[2], coda: m[3] } : { onset: '', vowel: 'a', coda: '' };
}

export function createMusic() {
  let ctx = null;
  let master;
  let bus;
  let noiseBuf;
  let glottal;
  let moodName = null;
  let layers = [];
  let timer = null;
  let plan = null; // the chant timeline being played
  let chant = null; // a private copy of the chant for the current mood
  let fx = null; // the current chant's drums, horns and consonants: faded out on a change of mood
  let volume = 0.7;

  // ------------------------------------------------------------ the hall

  function impulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = last * 0.86 + (Math.random() * 2 - 1) * 0.14; // stone swallows the highs
        // a few early echoes off near walls, then the long tail
        const early = i < ctx.sampleRate * 0.12 && i % Math.floor(ctx.sampleRate * 0.031) < 40 ? 0.6 : 0;
        d[i] = (last + early * (Math.random() - 0.5)) * (1 - i / len) ** decay;
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
    comp.threshold.value = -20;
    comp.ratio.value = 3;
    master.connect(comp);
    comp.connect(ctx.destination);
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(5.5, 2.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.85;
    reverb.connect(wet);
    wet.connect(master);
    bus = ctx.createGain();
    bus.gain.value = 0.7;
    bus.connect(master);
    bus.connect(reverb);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // A glottal pulse: every harmonic present, falling away gently, like a chest voice.
    const n = 48;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let h = 1; h < n; h++) imag[h] = 1 / h ** 1.15;
    glottal = ctx.createPeriodicWave(real, imag);
  }

  function noiseBurst(at, dur, type, freq, q, level, dest = fx || bus) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + Math.min(0.01, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0005, at + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(at, Math.random());
    src.stop(at + dur + 0.05);
  }

  // ------------------------------------------------------------ a choir

  // `singers` voices around one pitch, each a little off in tuning and timing, through one
  // shared vowel filter bank. Options: growl (kargyraa-style period doubling), spread (cents).
  function makeChoir({ singers = 8, spread = 14, level = 0.2, growl = 0, dest = bus } = {}) {
    const pre = ctx.createGain();
    pre.gain.value = 1 / Math.sqrt(singers);
    const post = ctx.createGain();
    post.gain.value = 0;
    const formants = BANDWIDTH.map((bw, i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = VOWELS.a[i][0] * BODY;
      bp.Q.value = (VOWELS.a[i][0] * BODY) / bw;
      const g = ctx.createGain();
      g.gain.value = VOWELS.a[i][1] * 3;
      pre.connect(bp);
      bp.connect(g);
      g.connect(post);
      return { bp, g };
    });
    // Choral breath: a little air through the same mouths.
    const air = ctx.createBufferSource();
    air.buffer = noiseBuf;
    air.loop = true;
    const airHp = ctx.createBiquadFilter();
    airHp.type = 'highpass';
    airHp.frequency.value = 600;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.01;
    air.connect(airHp);
    airHp.connect(airGain);
    airGain.connect(pre);
    let out = post;
    let growlOsc = null;
    if (growl) {
      // Throat-singing: the sound pulses at half the sung pitch, adding a rough sub-octave.
      const am = ctx.createGain();
      am.gain.value = 1 - growl / 2;
      growlOsc = ctx.createOscillator();
      const depth = ctx.createGain();
      depth.gain.value = growl / 2;
      growlOsc.connect(depth);
      depth.connect(am.gain);
      post.connect(am);
      out = am;
    }
    out.connect(dest);
    const voices = [];
    for (let i = 0; i < singers; i++) {
      const o = ctx.createOscillator();
      o.setPeriodicWave(glottal);
      o.detune.value = (Math.random() - 0.5) * spread * 2;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4.2 + Math.random() * 1.6;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 10 + Math.random() * 10;
      lfo.connect(lfoG);
      lfoG.connect(o.detune);
      const g = ctx.createGain();
      g.gain.value = 0.7 + Math.random() * 0.5;
      o.connect(g);
      g.connect(pre);
      voices.push({ o, lfo, lag: Math.random() * 0.035 });
    }
    const t = ctx.currentTime;
    for (const v of voices) { v.o.start(t); v.lfo.start(t); }
    air.start(t);
    if (growlOsc) growlOsc.start(t);
    return {
      level,
      pitch(midi, at, glide = 0.06) {
        const f = midiHz(midi);
        for (const v of voices) v.o.frequency.setTargetAtTime(f, at + v.lag, glide / 3);
        if (growlOsc) growlOsc.frequency.setTargetAtTime(f / 2, at, glide / 3);
      },
      vowel(name, at, time = 0.05) {
        VOWELS[name].forEach(([fq, gn], i) => {
          formants[i].bp.frequency.setTargetAtTime(fq * BODY, at, time / 3);
          formants[i].g.gain.setTargetAtTime(gn * 3, at, time / 3);
        });
      },
      gain(value, at, time = 0.05) { post.gain.setTargetAtTime(value, at, time / 3); },
      setNow(value, at) { post.gain.setValueAtTime(value, at); },
      breath(at, dur, level) { noiseBurst(at, dur, 'bandpass', 1800, 0.7, level, pre); },
      stop(at) {
        post.gain.setTargetAtTime(0, at, 0.5);
        const end = at + 3;
        for (const v of voices) { v.o.stop(end); v.lfo.stop(end); }
        air.stop(end);
        if (growlOsc) growlOsc.stop(end);
      },
    };
  }

  // ------------------------------------------------------------ singing words

  function consonant(choir, c, at, level) {
    const L = choir.level;
    switch (c) {
      case 'k': case 'g': case 't': case 'd': case 'b': case 'p': {
        // a stop: the voice cuts, then bursts open
        choir.setNow(L * 0.08, at - 0.045);
        choir.gain(L, at + 0.02, 0.04);
        const burst = { k: [2200, 0.05], g: [1600, 0.03], t: [4200, 0.04], d: [3000, 0.025], b: [700, 0.02], p: [900, 0.035] }[c];
        noiseBurst(at, burst[1], 'bandpass', burst[0], 1.4, level * 0.9);
        break;
      }
      case 'm': case 'n':
        choir.vowel('m', at - 0.07, 0.03);
        break;
      case 'r': {
        // a rolled r: three quick taps of the tongue
        for (let i = 0; i < 3; i++) {
          choir.setNow(L * 0.3, at - 0.09 + i * 0.03);
          choir.setNow(L, at - 0.075 + i * 0.03);
        }
        break;
      }
      case 'z': case 's':
        noiseBurst(at - 0.06, 0.09, 'bandpass', 5200, 2, level * (c === 's' ? 0.7 : 0.45));
        break;
      case 'h':
        choir.breath(at - 0.06, 0.09, level * 3);
        break;
      case 'l':
        choir.vowel('u', at - 0.05, 0.02);
        break;
      default:
    }
  }

  // Sing one syllable on one or more notes (a melisma), starting at `at`. Returns its length.
  function syllable(choir, syl, notes, at, unit, transpose = 0, opts = {}) {
    const { onset, vowel, coda } = parseSyllable(syl);
    for (const c of onset) consonant(choir, c, at, opts.attack || 0.12);
    choir.vowel(vowel, at + 0.02, 0.05);
    let t = at;
    for (const [midi, units] of notes) {
      choir.pitch(midi + transpose, t, opts.glide || 0.07);
      t += units * unit;
    }
    const dur = t - at;
    if (coda) {
      const c = coda[0];
      if ('mn'.includes(c)) choir.vowel('m', t - Math.min(0.18, dur * 0.35), 0.06);
      else consonant(choir, c, t - 0.01, (opts.attack || 0.12) * 0.7);
    }
    return dur;
  }

  // Lay out a whole chant: every syllable of every line, for every choir that sings it.
  function schedulePlan(start) {
    const unit = chant.unit;
    let t = start;
    const ends = [];
    for (const line of chant.lines) {
      const singers = line.who || ['choir'];
      const lineStart = t;
      for (const name of singers) {
        const layer = layers.find((l) => l.name === name);
        if (!layer) continue;
        let tt = lineStart;
        layer.choir.gain(layer.choir.level, lineStart - 0.05, 0.12);
        for (const [syl, notes] of line.syllables) {
          tt += syllable(layer.choir, syl, notes, tt, unit, layer.transpose, { attack: chant.attack });
        }
        if (line.organum && layer.name === 'choir') {
          const org = layers.find((l) => l.name === 'organum');
          if (org) {
            let to = lineStart;
            org.choir.gain(org.choir.level, lineStart - 0.05, 0.2);
            for (const [syl, notes] of line.syllables) to += syllable(org.choir, syl, notes, to, unit, -7, { attack: chant.attack });
            org.choir.gain(0, to + 0.1, 0.4);
          }
        }
        layer.choir.gain(layer.choir.level * 0.12, tt + 0.05, 0.25); // a breath between lines
        t = Math.max(t, tt);
      }
      if (line.shout) shout(t + unit * 0.2);
      if (line.drums) for (const [beat, vel] of line.drums) drum(lineStart + beat * unit, vel);
      if (line.horn) horn(line.horn[0], lineStart + line.horn[1] * unit, line.horn[2] * unit, 0.22);
      t += unit * (line.rest ?? 1);
      ends.push(t);
    }
    // A steady drum and hammer pulse under the chant (battle), or a heartbeat (hall).
    if (chant.pulse) {
      const { every, pattern, anvil: anv } = chant.pulse;
      let i = 0;
      for (let pt = start; pt < t; pt += every * unit, i++) {
        const v = pattern[i % pattern.length];
        if (v) drum(pt, v);
        if (anv && anv[i % anv.length]) anvil(pt + 0.01, anv[i % anv.length]);
      }
    }
    return t + unit * (chant.gap || 2);
  }

  // The held drone (ison) under the chant, with its growl.
  function startDrone() {
    const drone = layers.find((l) => l.name === 'drone');
    if (!drone) return;
    const at = ctx.currentTime + 0.1;
    drone.choir.vowel(chant.droneVowel || 'o', at, 0.1);
    drone.choir.pitch(chant.drone, at, 0.01);
    drone.choir.gain(drone.choir.level, at, 2.5);
  }

  function buildLayers() {
    layers = [
      { name: 'choir', choir: makeChoir({ singers: chant.choirSingers || 9, level: chant.choirLevel, spread: 16 }), transpose: 0 },
      { name: 'organum', choir: makeChoir({ singers: 6, level: chant.choirLevel * 0.7, spread: 14 }), transpose: -7 },
      { name: 'drone', choir: makeChoir({ singers: 5, level: chant.droneLevel, spread: 10, growl: chant.growl }), transpose: 0 },
    ];
    if (chant.cantor) {
      layers.push({ name: 'cantor', choir: makeChoir({ singers: 1, level: chant.cantorLevel || 0.22, spread: 0 }), transpose: 0 });
    }
    if (chant.octaveBelow) {
      layers.push({ name: 'basses', choir: makeChoir({ singers: 6, level: chant.choirLevel * 0.8, spread: 18, growl: 0.4 }), transpose: -12 });
      // the basses double whatever the choir sings
      for (const line of chant.lines) if (!line.who || line.who.includes('choir')) line.who = [...(line.who || ['choir']), 'basses'];
    }
  }

  function tick() {
    if (!plan) return;
    if (ctx.currentTime > plan.next - 0.6) {
      plan.next = schedulePlan(plan.next);
    }
  }

  function clearLayers() {
    const t = ctx.currentTime;
    for (const l of layers) l.choir.stop(t);
    layers = [];
    if (fx) {
      const old = fx;
      old.gain.setTargetAtTime(0, t, 0.25);
      setTimeout(() => old.disconnect(), 30000); // after anything already scheduled has played
      fx = null;
    }
  }

  function setMood(name) {
    if (!CHANTS[name]) return;
    if (!ctx || !timer) return start(name);
    if (name === moodName) return;
    clearLayers();
    moodName = name;
    chant = JSON.parse(JSON.stringify(CHANTS[name])); // buildLayers adds the basses to this copy
    fx = ctx.createGain();
    fx.connect(bus);
    buildLayers();
    startDrone();
    plan = { next: ctx.currentTime + 1.2 };
  }

  function start(name = 'hall') {
    if (!ctx) init();
    if (ctx.state === 'suspended') ctx.resume();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(volume, ctx.currentTime, 0.3);
    if (!timer) timer = setInterval(tick, 100);
    moodName = null;
    setMood(name);
  }

  function stop() {
    if (!ctx) return;
    clearInterval(timer);
    timer = null;
    plan = null;
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
    clearLayers();
    moodName = null;
  }

  // ------------------------------------------------------------ drums, anvils, horns, bells, shouts

  function drum(at, vel, dest = fx || bus) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(110, at);
    o.frequency.exponentialRampToValueAtTime(46, at + 0.3);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(1.1 * vel, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.9);
    o.connect(g);
    g.connect(dest);
    o.start(at);
    o.stop(at + 0.95);
    noiseBurst(at, 0.12, 'lowpass', 700, 0.7, 0.5 * vel, dest); // the skin
  }

  function anvil(at, vel, dest = fx || bus) {
    for (const [f, a, d] of [[1180, 0.2, 1.1], [2720, 0.1, 0.8], [3910, 0.06, 0.5], [5300, 0.03, 0.3]]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(a * vel, at);
      g.gain.exponentialRampToValueAtTime(0.0005, at + d);
      o.connect(g);
      g.connect(dest);
      o.start(at);
      o.stop(at + d + 0.05);
    }
    noiseBurst(at, 0.03, 'highpass', 3000, 0.7, 0.3 * vel, dest);
  }

  // A war horn (a lur): a raw brass tone that swells and brightens.
  function horn(midi, at, dur, level = 0.25, bright = 1600, dest = fx || bus) {
    const f = midiHz(midi);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 3;
    lp.frequency.setValueAtTime(180, at);
    lp.frequency.linearRampToValueAtTime(bright, at + 0.35);
    lp.frequency.setTargetAtTime(bright * 0.55, at + 0.4, dur / 2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + 0.18);
    g.gain.setValueAtTime(level, at + dur * 0.8);
    g.gain.linearRampToValueAtTime(0, at + dur + 0.25);
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = det;
      o.frequency.setValueAtTime(f * 0.93, at);
      o.frequency.exponentialRampToValueAtTime(f, at + 0.16);
      o.connect(lp);
      o.start(at);
      o.stop(at + dur + 0.3);
    }
    lp.connect(g);
    g.connect(dest);
  }

  // "HU!": the whole band shouts together.
  function shout(at, dest = fx || bus) {
    const c = makeChoir({ singers: 10, level: 0.3, spread: 40, dest });
    c.vowel('u', at - 0.05, 0.01);
    c.pitch(50, at - 0.05, 0.01);
    c.breath(at - 0.04, 0.08, 0.6);
    c.setNow(0, at);
    c.gain(c.level, at + 0.01, 0.02);
    c.pitch(45, at + 0.05, 0.15);
    c.gain(0, at + 0.22, 0.1);
    c.stop(at + 0.6);
    drum(at, 1, dest);
  }

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

  function sting(kind) {
    if (!ctx) init();
    if (ctx.state === 'suspended') ctx.resume();
    if (!timer) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(volume, ctx.currentTime); }
    const t = ctx.currentTime + 0.05;
    if (kind === 'horn') {
      // Foes found: war horns from deep in the mountain, a drum, and the band's answer.
      horn(38, t, 1.6, 0.3, 900, bus);
      horn(45, t + 0.4, 1.2, 0.26, 1600, bus);
      horn(50, t + 1.7, 2.4, 0.3, 2000, bus);
      horn(38, t + 1.7, 2.4, 0.2, 700, bus);
      drum(t + 1.7, 1, bus);
      drum(t + 2.3, 0.8, bus);
      shout(t + 2.9, bus);
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

