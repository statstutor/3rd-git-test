// Hand-inked SVG art for the map, after the cover vignettes of the rulebook: black ink
// outlines, hatching, wobbly lines, and a small flat palette (no gradients).
// Every drawing is in a 64×64 cell-local box and returns an SVG string.

export const S = 64;

export const C = {
  ink: '#1c1814',
  floor: '#f7eed8',
  parchment: '#efe3c6',
  stone: '#bcae8f',
  stoneDark: '#93846a',
  ochre: '#c8862a',
  ochreLight: '#e8b765',
  slate: '#56636e',
  oxblood: '#7b2219',
  moss: '#5f7a3b',
  lava: '#d0531c',
  wood: '#a26b33',
  crystal: '#7f93a0',
};

function rand(seed) {
  let t = seed | 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedOf(x, y, salt = 0) {
  return (Math.imul(x + 1013, 73856093) ^ Math.imul(y + 7919, 19349663) ^ Math.imul(salt + 3, 83492791)) | 0;
}

const f = (n) => Math.round(n * 10) / 10;

// A shaky ink line through points, every segment jittered.
function shaky(points, r, amp) {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x + (r() - 0.5) * amp)},${f(y + (r() - 0.5) * amp)}`).join('');
}

function subdivide(x1, y1, x2, y2, step) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(1, Math.round(len / step));
  const out = [];
  for (let i = 0; i < n; i++) out.push([x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n]);
  return out;
}

export function roughRect(x, y, w, h, seed, amp = 1.6, step = 7) {
  const r = rand(seed);
  const pts = [
    ...subdivide(x, y, x + w, y, step),
    ...subdivide(x + w, y, x + w, y + h, step),
    ...subdivide(x + w, y + h, x, y + h, step),
    ...subdivide(x, y + h, x, y, step),
  ];
  return `${shaky(pts, r, amp)}Z`;
}

export function roughLine(x1, y1, x2, y2, seed, amp = 1.2, step = 6) {
  const r = rand(seed);
  return shaky([...subdivide(x1, y1, x2, y2, step), [x2, y2]], r, amp);
}

// A blobby cave outline (for caverns and lairs).
export function cavePath(x, y, w, h, seed, amp = 4) {
  const r = rand(seed);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const pts = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 - r() * (amp / Math.min(w, h)) * 1.6;
    // squarish superellipse so caves still fill their square
    const c = Math.cos(a);
    const s = Math.sin(a);
    const px = Math.sign(c) * Math.abs(c) ** 0.45 * (w / 2) * k;
    const py = Math.sign(s) * Math.abs(s) ** 0.45 * (h / 2) * k;
    pts.push([cx + px, cy + py]);
  }
  return `${shaky(pts, r, 1.2)}Z`;
}

const line = (d, w = 1.7, color = C.ink, extra = '') =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const shape = (d, fill, w = 1.7, extra = '') =>
  `<path d="${d}" fill="${fill}" stroke="${C.ink}" stroke-width="${w}" stroke-linejoin="round" ${extra}/>`;

// ------------------------------------------------------------------- shared defs

export function defs() {
  return `
  <defs>
    <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="5" stroke="${C.ink}" stroke-width="0.9"/>
    </pattern>
    <pattern id="hatch-red" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
      <line x1="0" y1="0" x2="0" y2="5" stroke="${C.oxblood}" stroke-width="1.1"/>
    </pattern>
    <pattern id="rock" width="64" height="64" patternUnits="userSpaceOnUse">
      <rect width="64" height="64" fill="${C.stone}"/>
      ${rockStrokes()}
    </pattern>
  </defs>`;
}

// Short hatch flecks for unexplored rock, like pencil shading on the page.
function rockStrokes() {
  const r = rand(99);
  let out = '';
  for (let i = 0; i < 9; i++) {
    const x = r() * 56 + 4;
    const y = r() * 56 + 4;
    const n = 2 + Math.floor(r() * 3);
    let d = '';
    for (let j = 0; j < n; j++) d += `M${f(x + j * 2.2)},${f(y)}l${f(-3 + r())},${f(4 + r() * 2)}`;
    out += `<path d="${d}" stroke="${C.stoneDark}" stroke-width="0.9" fill="none" stroke-linecap="round"/>`;
  }
  for (let i = 0; i < 6; i++) {
    out += `<circle cx="${f(r() * 64)}" cy="${f(r() * 64)}" r="${f(0.6 + r() * 0.8)}" fill="${C.stoneDark}"/>`;
  }
  return out;
}

// ------------------------------------------------------------------- the carved square

// The open cavity every explored square sits in.
export function cavity(seed, kind = 'room') {
  if (kind === 'cave') return shape(cavePath(4, 4, 56, 56, seed), C.floor, 2.4);
  return shape(roughRect(5, 5, 54, 54, seed, 1.4), C.floor, 2.4);
}

// Openings between connected squares, drawn over both cavities (cell-local to the left/upper cell).
export function sideOpening(seed) {
  // a doorway through the wall shared with the cell to the east
  return `<rect x="52" y="22" width="24" height="35" fill="${C.floor}"/>` +
    line(roughLine(52, 22, 76, 22, seed, 0.9)) + line(roughLine(52, 57, 76, 57, seed + 1, 0.9));
}

export function verticalOpening(type, seed) {
  // the gap through the floor shared with the cell below, centred at x=32
  let out = `<rect x="22" y="52" width="20" height="24" fill="${C.floor}"/>` +
    line(roughLine(22, 52, 22, 76, seed, 0.9)) + line(roughLine(42, 52, 42, 76, seed + 1, 0.9));
  if (type === 'shaft') {
    out += line(roughLine(26, 48, 26, 80, seed + 2, 0.6), 1.3, C.wood) + line(roughLine(38, 48, 38, 80, seed + 3, 0.6), 1.3, C.wood);
    for (let y = 52; y <= 76; y += 6) out += line(roughLine(26, y, 38, y, seed + y, 0.5), 1.2, C.wood);
  } else {
    for (let y = 54; y <= 74; y += 5) out += line(roughLine(23, y, 41, y, seed + y, 0.6), 1.1);
  }
  return out;
}

// ------------------------------------------------------------------- props

function torch(x, y, seed) {
  return line(roughLine(x, y, x, y + 10, seed, 0.6), 2, C.wood) +
    shape(`M${x},${y - 9} q4,5 2.6,8.5 q-2.6,2 -5.2,0 q-1.4,-3.5 2.6,-8.5Z`, C.ochre, 1.1) +
    `<path d="M${x},${y - 5} q1.6,2.6 0.8,4.5 q-0.8,0.8 -1.6,0 q-0.6,-2 0.8,-4.5Z" fill="${C.ochreLight}"/>`;
}

function skull(x, y, s = 1, fill = C.floor) {
  return `<g transform="translate(${x},${y}) scale(${s})">` +
    shape('M-5,0 q0,-7 5,-7 q5,0 5,7 q0,3 -2,4 v2 h-6 v-2 q-2,-1 -2,-4Z', fill, 1.3) +
    `<circle cx="-2" cy="-1" r="1.4" fill="${C.ink}"/><circle cx="2" cy="-1" r="1.4" fill="${C.ink}"/>` +
    line('M-1.5,5 v1.6 M0,5 v1.6 M1.5,5 v1.6', 0.8) + '</g>';
}

function rubble(seed, n = 5, y0 = 50) {
  const r = rand(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = 10 + r() * 44;
    const y = y0 + r() * 6;
    const w = 3 + r() * 4;
    out += shape(roughRect(x, y, w, w * 0.7, seed + i, 0.8, 3), C.stone, 1);
  }
  return out;
}

function stalactites(seed, n = 4) {
  const r = rand(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = 10 + i * (44 / n) + r() * 6;
    const h = 6 + r() * 9;
    out += shape(`M${f(x - 3)},7 L${f(x)},${f(7 + h)} L${f(x + 3)},7Z`, C.stone, 1.1);
  }
  return out;
}

// ------------------------------------------------------------------- rooms

const ROOM_ART = {
  entrance(seed) {
    // a stairwell climbing up and out through the roof, light spilling in
    let out = `<rect x="38" y="0" width="16" height="12" fill="${C.floor}"/>` +
      line(roughLine(38, 0, 38, 10, seed, 0.6)) + line(roughLine(54, 0, 54, 10, seed + 1, 0.6));
    for (let i = 0; i < 4; i++) out += line(`M${42 + i * 3},2 l${-2 + i},9`, 0.9, C.ochre);
    let d = 'M8,57';
    for (let i = 0; i < 7; i++) d += ` h6 v-6.4`;
    out += shape(`${d} h4 V57Z`, C.stone, 1.6);
    out += `<path d="M8,57 L54,12 L54,57Z" fill="url(#hatch)" opacity="0.35"/>`;
    out += torch(15, 22, seed);
    return out;
  },
  corridor(seed) {
    let out = line(roughLine(7, 50, 57, 50, seed, 0.8));
    // timber mine supports
    out += shape(roughRect(13, 14, 4, 36, seed + 1, 0.8, 5), C.wood, 1.3);
    out += shape(roughRect(47, 14, 4, 36, seed + 2, 0.8, 5), C.wood, 1.3);
    out += shape(roughRect(10, 11, 44, 4.5, seed + 3, 0.8, 5), C.wood, 1.3);
    out += torch(32, 26, seed);
    out += rubble(seed, 2, 51);
    return out;
  },
  stairs(seed) {
    let d = 'M8,12';
    for (let i = 0; i < 6; i++) d += ` h7 v7.4`;
    let out = shape(`${d} V57 H8Z`, C.stone, 1.6);
    out += `<path d="M8,12 L50,56 L8,56Z" fill="url(#hatch)" opacity="0.3"/>`;
    out += line(roughLine(6, 6, 52, 50, seed, 0.8), 1.4, C.wood);
    return out;
  },
  barracks(seed) {
    // bunk beds
    let out = shape(roughRect(9, 19, 26, 36, seed, 0.9, 6), 'none', 1.8);
    out += shape(roughRect(11, 27, 22, 5, seed + 1, 0.6, 5), C.oxblood, 1.1);
    out += shape(roughRect(11, 45, 22, 5, seed + 2, 0.6, 5), C.oxblood, 1.1);
    out += shape(roughRect(11, 24, 6, 3.5, seed + 3, 0.4, 4), C.floor, 0.9) + shape(roughRect(11, 42, 6, 3.5, seed + 4, 0.4, 4), C.floor, 0.9);
    out += line(roughLine(9, 37, 35, 37, seed + 5, 0.6));
    // weapon rack: spears
    for (let i = 0; i < 3; i++) {
      const x = 41 + i * 4.5;
      out += line(roughLine(x, 18, x, 55, seed + 10 + i, 0.5), 1.4, C.wood) + shape(`M${x - 2},18 L${x},11 L${x + 2},18Z`, C.slate, 1);
    }
    out += line(roughLine(38, 46, 56, 46, seed + 6, 0.5), 1.6, C.wood);
    // shield on the wall
    out += shape('M44,22 q5,-1 9,0 q0,9 -4.5,12 q-4.5,-3 -4.5,-12Z', C.slate, 1.3) + line('M48.5,23 v10 M45,27 h7', 1, C.ochre);
    return out;
  },
  cavern(seed) {
    return stalactites(seed) + rubble(seed + 7, 4, 49) +
      `<path d="M8,50 q12,-4 24,0 q12,4 24,0 L56,58 L8,58Z" fill="url(#hatch)" opacity="0.25"/>`;
  },
  crypt(seed) {
    let out = '';
    for (const x of [13, 37]) {
      out += shape(`M${x},22 l7,-4 l7,4 v26 l-3,6 h-8 l-3,-6Z`, C.slate, 1.5);
      out += line(`M${x + 3},30 h8 M${x + 7},25 v12`, 1, C.parchment);
    }
    out += skull(32, 52, 0.9);
    out += torch(32, 22, seed);
    return out;
  },
};

// Found rooms and cavern features (♣ / ♠ finds).
const FOUND_ART = {
  well(seed) {
    let out = line(roughLine(14, 22, 14, 44, seed, 0.5), 2, C.wood) + line(roughLine(50, 22, 50, 44, seed + 1, 0.5), 2, C.wood);
    out += shape('M10,24 L32,12 L54,24Z', C.oxblood, 1.4);
    out += line('M32,24 v12', 1, C.ink) + shape(roughRect(29, 34, 6, 6, seed + 2, 0.4, 3), C.wood, 1);
    out += `<ellipse cx="32" cy="46" rx="20" ry="5" fill="${C.ink}"/>`;
    out += shape(`M12,46 v8 q20,6 40,0 v-8 q-20,6 -40,0Z`, C.stone, 1.5);
    for (let x = 16; x < 50; x += 7) out += line(`M${x},49 v6`, 0.8);
    return out;
  },
  sealed(seed) {
    let out = shape(roughRect(18, 12, 28, 44, seed, 0.8, 6), C.wood, 1.8);
    out += shape('M18,12 q14,-8 28,0', 'none', 1.8);
    out += line(roughLine(14, 16, 50, 52, seed + 1, 1), 2.2, C.slate) + line(roughLine(50, 16, 14, 52, seed + 2, 1), 2.2, C.slate);
    out += `<circle cx="32" cy="34" r="5" fill="${C.ochre}" stroke="${C.ink}" stroke-width="1.4"/>`;
    out += line('M30,24 l2,-4 l2,4 M24,44 l3,3 M40,44 l-3,3', 1, C.oxblood);
    return out;
  },
  openedRoom(seed) {
    let out = shape(roughRect(18, 12, 28, 44, seed, 0.8, 6), C.ink, 1.8);
    out += shape('M18,12 l-8,6 v42 l8,-4Z', C.wood, 1.4);
    out += line(roughLine(8, 56, 30, 58, seed + 1, 1), 1.6, C.slate);
    return out;
  },
  buriedTemple(seed) {
    let out = shape('M10,22 L32,9 L54,22Z', C.stone, 1.6);
    out += shape(roughRect(10, 22, 44, 4, seed, 0.5, 6), C.stone, 1.3);
    for (const x of [14, 26, 38]) out += shape(roughRect(x, 26, 6, 26, seed + x, 0.6, 5), C.parchment, 1.3) + line(`M${x + 3},28 v22`, 0.6);
    out += shape(roughRect(48, 26, 6, 14, seed + 9, 0.6, 5), C.parchment, 1.3) + line(roughLine(48, 44, 56, 52, seed + 11, 1), 1.2);
    out += shape(roughRect(8, 52, 48, 5, seed + 3, 0.6, 6), C.stone, 1.3);
    return out;
  },
  ancientLibrary(seed) {
    const r = rand(seed);
    let out = '';
    for (const y of [14, 30, 46]) {
      out += line(roughLine(9, y + 12, 55, y + 12, seed + y, 0.5), 2, C.wood);
      let x = 10;
      while (x < 52) {
        const w = 3 + r() * 3;
        const h = 8 + r() * 4;
        const fill = [C.oxblood, C.slate, C.moss, C.ochre, C.wood][Math.floor(r() * 5)];
        out += shape(`M${f(x)},${y + 12} v${f(-h)} h${f(w)} v${f(h)}Z`, fill, 0.9);
        x += w + 0.6;
        if (r() < 0.12) x += 4;
      }
    }
    out += line(roughLine(9, 10, 9, 58, seed, 0.5), 2, C.wood) + line(roughLine(55, 10, 55, 58, seed + 1, 0.5), 2, C.wood);
    return out;
  },
  portal(seed) {
    let out = `<ellipse cx="32" cy="32" rx="19" ry="23" fill="${C.ink}"/>`;
    out += `<ellipse cx="32" cy="32" rx="19" ry="23" fill="none" stroke="${C.oxblood}" stroke-width="4"/>`;
    out += `<path d="M32,14 q12,8 2,18 q-10,8 0,18 M24,20 q10,4 4,12" fill="none" stroke="${C.lava}" stroke-width="2" stroke-linecap="round"/>`;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      out += line(`M${f(32 + Math.cos(a) * 22)},${f(32 + Math.sin(a) * 26)} l${f(Math.cos(a) * 5)},${f(Math.sin(a) * 5)}`, 1.4, C.oxblood);
    }
    return out;
  },
  golemForge(seed) {
    let out = shape('M12,40 h26 l-4,6 h-18Z', C.slate, 1.5) + shape(roughRect(18, 46, 12, 10, seed, 0.5, 4), C.slate, 1.3);
    out += shape(roughRect(40, 18, 16, 20, seed + 1, 0.7, 5), C.stone, 1.5);
    out += `<rect x="43" y="25" width="3" height="3" fill="${C.ochre}"/><rect x="50" y="25" width="3" height="3" fill="${C.ochre}"/>`;
    out += shape(roughRect(38, 38, 20, 18, seed + 2, 0.7, 5), C.stone, 1.5);
    out += torch(14, 22, seed);
    return out;
  },
  hoard(seed) { return coins(seed, 14) + sleepingWyrm(seed); },
  emptyHoard(seed) { return coins(seed, 4) + rubble(seed + 3, 3, 49); },
  forest(seed) { return FEATURE_ART.forest(seed); },
};

function coins(seed, n) {
  const r = rand(seed);
  let out = `<path d="M8,57 q24,-${n} 48,0Z" fill="${C.ochre}" stroke="${C.ink}" stroke-width="1.4"/>`;
  for (let i = 0; i < n; i++) {
    out += `<ellipse cx="${f(12 + r() * 40)}" cy="${f(50 + r() * 6)}" rx="2.6" ry="1.4" fill="${C.ochreLight}" stroke="${C.ink}" stroke-width="0.7"/>`;
  }
  return out;
}

function sleepingWyrm() {
  return shape('M12,44 q-4,-18 14,-22 q16,-3 24,8 q6,8 -2,12 q-8,4 -14,-2 q-6,-5 -12,2Z', C.oxblood, 1.6) +
    line('M22,28 q3,2 6,0', 1.4) + // a closed eye
    shape('M14,26 l-4,-8 l8,5Z M26,22 l2,-9 l4,8Z', C.oxblood, 1.2) +
    line('M48,40 q8,2 8,10 q-6,-2 -10,2', 1.6, C.ink) +
    `<text x="36" y="18" font-family="Metamorphous, serif" font-size="8" fill="${C.ink}">z</text>` +
    `<text x="42" y="12" font-family="Metamorphous, serif" font-size="6" fill="${C.ink}">z</text>`;
}

const FEATURE_ART = {
  cave: (seed) => ROOM_ART.cavern(seed),
  ruins(seed) {
    return shape(roughRect(16, 30, 8, 24, seed, 0.7, 5), C.stone, 1.4) + shape('M16,30 l3,-6 l5,4Z', C.stone, 1.2) +
      shape(roughRect(36, 46, 16, 7, seed + 1, 0.7, 5), C.stone, 1.4) + rubble(seed + 2, 4, 50) + stalactites(seed + 3, 2);
  },
  forest(seed) {
    const r = rand(seed);
    let out = '';
    for (const [x, h] of [[16, 30], [33, 36], [48, 28]]) {
      out += line(roughLine(x, 57, x, 57 - h, seed + x, 0.6), 2.4, C.wood);
      const cy = 57 - h;
      out += shape(`M${x - 10},${cy + 6} q-2,-12 ${8 + r() * 3},-12 q4,-6 9,0 q8,2 5,12 q-10,5 -22,0Z`, C.moss, 1.4);
    }
    out += line('M8,57 q6,-4 10,0 M40,57 q5,-5 9,0', 1, C.moss);
    return out;
  },
  crystal(seed) {
    const r = rand(seed);
    let out = '';
    for (let i = 0; i < 5; i++) {
      const x = 12 + i * 10 + r() * 3;
      const h = 14 + r() * 22;
      const w = 4 + r() * 3;
      const tilt = (r() - 0.5) * 8;
      out += shape(`M${f(x - w)},57 L${f(x - w + tilt * 0.3)},${f(57 - h * 0.7)} L${f(x + tilt)},${f(57 - h)} L${f(x + w + tilt * 0.3)},${f(57 - h * 0.7)} L${f(x + w)},57Z`, i % 2 ? C.slate : C.crystal, 1.3);
      out += line(`M${f(x + tilt * 0.5)},${f(57 - h + 4)} v${f(h * 0.5)}`, 0.8, C.parchment);
    }
    out += stalactites(seed + 5, 3);
    return out;
  },
  mine(seed) {
    let out = line(roughLine(6, 55, 58, 55, seed, 0.6), 1.6, C.wood) + line('M10,57 v-3 M22,57 v-3 M34,57 v-3 M46,57 v-3', 1.2, C.wood);
    out += shape('M16,36 h28 l-4,14 h-20Z', C.wood, 1.6);
    out += `<circle cx="24" cy="52" r="3.4" fill="${C.slate}" stroke="${C.ink}" stroke-width="1.2"/><circle cx="37" cy="52" r="3.4" fill="${C.slate}" stroke="${C.ink}" stroke-width="1.2"/>`;
    out += shape('M18,36 q4,-7 8,-2 q4,-6 9,0 q4,-5 8,2Z', C.ochre, 1.2);
    out += line(roughLine(48, 14, 54, 34, seed + 2, 0.5), 2, C.wood) + shape('M42,16 q7,-6 16,0 q-8,-2 -16,0Z', C.slate, 1.2);
    return out;
  },
  tunnel(seed) {
    let out = '';
    for (let i = 0; i < 3; i++) out += line(roughLine(18 + i * 7, 14, 24 + i * 7, 44, seed + i, 0.8), 1.8, C.ink);
    return out + rubble(seed + 4, 5, 49);
  },
  volcanic(seed) {
    let out = `<path d="M26,4 L22,18 L30,30 L24,44 L32,60 L40,60 L34,44 L40,30 L32,18 L36,4Z" fill="${C.ink}"/>`;
    out += line('M30,10 L27,20 L33,30 L28,44 L35,58', 1.2, C.lava);
    return out;
  },
  grotto(seed) {
    let out = ROOM_ART.cavern(seed);
    const r = rand(seed + 3);
    for (let i = 0; i < 5; i++) {
      const x = 12 + r() * 40;
      const y = 18 + r() * 26;
      const s = 2.5 + r() * 2.5;
      out += `<path d="M${f(x)},${f(y - s)} L${f(x + s * 0.3)},${f(y - s * 0.3)} L${f(x + s)},${f(y)} L${f(x + s * 0.3)},${f(y + s * 0.3)} L${f(x)},${f(y + s)} L${f(x - s * 0.3)},${f(y + s * 0.3)} L${f(x - s)},${f(y)} L${f(x - s * 0.3)},${f(y - s * 0.3)}Z" fill="${C.ochreLight}" stroke="${C.ink}" stroke-width="0.7"/>`;
    }
    out += shape('M44,56 v-7 M38,49 q6,-8 12,0Z', C.moss, 1.2);
    return out;
  },
  gasChamber(seed) {
    return ROOM_ART.cavern(seed) + shape(roughRect(26, 50, 12, 6, seed, 0.6, 4), C.stoneDark, 1.2) + line('M30,48 q-3,-6 2,-10 M35,48 q4,-6 -1,-12', 1.2, C.ink);
  },
  wyrd(seed) {
    let d = 'M32,32';
    for (let i = 1; i < 28; i++) {
      const a = i * 0.55;
      d += ` L${f(32 + Math.cos(a) * i * 0.75)},${f(32 + Math.sin(a) * i * 0.75)}`;
    }
    return stalactites(seed, 3) + line(d, 1.6, C.oxblood) + `<circle cx="32" cy="32" r="2" fill="${C.moss}"/>`;
  },
  river: () => '', magma: () => '', lake: () => '',
};

// Lairs: foes at home, hatched red. Drawn by which card made them.
const LAIR_ART = {
  S2(seed) {
    return shape('M12,24 l7,-4 l7,4 v26 l-3,6 h-8 l-3,-6Z', C.slate, 1.5) +
      shape('M36,30 l12,-6 l8,14 l-12,6Z', C.slate, 1.5) +
      shape('M38,30 l7,-3 l7,3 v20 l-2,5 h-8 l-2,-5Z', C.ink, 1.2) +
      `<circle cx="42.5" cy="38" r="1.4" fill="${C.lava}"/><circle cx="47.5" cy="38" r="1.4" fill="${C.lava}"/>` +
      skull(20, 52, 0.8);
  },
  SA(seed) {
    let out = '';
    for (const [x, s] of [[18, 1], [42, 0.85]]) {
      out += `<g transform="translate(${x},40) scale(${s})">` + shape('M-11,0 L0,-14 L11,0Z', C.wood, 1.4) +
        shape(roughRect(-9, 0, 18, 14, seed + x, 0.5, 5), C.stone, 1.4) + shape('M-3,14 v-7 h6 v7Z', C.ink, 1) + '</g>';
    }
    return out + line('M30,56 q2,-6 0,-10 q-2,-4 1,-8', 1, C.stoneDark);
  },
  SK(seed) {
    let out = shape('M24,56 v-26 q8,-10 16,0 v26Z', C.oxblood, 1.6) + shape(roughRect(22, 44, 20, 6, seed, 0.5, 5), C.stone, 1.3);
    out += line(roughLine(10, 10, 10, 56, seed + 1, 0.5), 1.6, C.wood) + shape('M10,12 h10 l-3,6 l3,6 h-10Z', C.slate, 1.1);
    out += line(roughLine(54, 10, 54, 56, seed + 2, 0.5), 1.6, C.wood) + shape('M54,12 h-10 l3,6 l-3,6 h10Z', C.slate, 1.1);
    return out + skull(32, 26, 0.7);
  },
  S10(seed) { return FOUND_ART.golemForge(seed); },
  SQ(seed) { return FOUND_ART.hoard(seed); },
  C9(seed) {
    let out = '';
    const hex = (cx, cy) => {
      let d = '';
      for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * 6)},${f(cy + Math.sin(a) * 6)}`; }
      return shape(`${d}Z`, C.ochre, 1.1);
    };
    for (const [cx, cy] of [[22, 22], [32, 28], [42, 22], [22, 34], [42, 34], [32, 40], [32, 16]]) out += hex(cx, cy);
    return out + `<circle cx="32" cy="28" r="2" fill="${C.ink}"/>`;
  },
  CJ(seed) {
    return shape('M12,52 q20,-14 40,0 q-20,8 -40,0Z', C.wood, 1.5) + line('M16,50 l6,-4 M28,47 l2,-5 M40,48 l4,-4', 1, C.ink) +
      `<ellipse cx="26" cy="30" rx="3" ry="2" fill="${C.ochre}" stroke="${C.ink}"/><ellipse cx="38" cy="30" rx="3" ry="2" fill="${C.ochre}" stroke="${C.ink}"/>` +
      `<circle cx="26" cy="30" r="1" fill="${C.ink}"/><circle cx="38" cy="30" r="1" fill="${C.ink}"/>`;
  },
  CQ(seed, isHome) {
    if (!isHome) return line('M8,40 q14,-10 24,4 q10,14 24,0', 3, C.oxblood) + line('M10,20 q12,10 22,-2 q8,-8 22,4', 2.4, C.oxblood);
    return `<ellipse cx="32" cy="32" rx="18" ry="11" fill="${C.ochreLight}" stroke="${C.ink}" stroke-width="2"/>` +
      `<ellipse cx="32" cy="32" rx="4" ry="10" fill="${C.ink}"/>` + line('M14,32 q18,-20 36,0 M14,32 q18,20 36,0', 1.2);
  },
  CK(seed) {
    return `<ellipse cx="32" cy="40" rx="16" ry="10" fill="${C.ink}"/>` + rubble(seed, 6, 50) +
      line('M22,24 l4,8 M30,20 l2,9 M38,22 l-1,9', 1.6);
  },
};

function lairArt(state, cell, x, y, seed) {
  const lair = state && state.lairs && state.lairs[cell.lair];
  const k = `${x},${y}`;
  const art = lair && LAIR_ART[lair.entryKey];
  const body = art ? art(seed, lair.home === k) : LAIR_ART.S2(seed);
  return body + `<path d="${cavePath(4, 4, 56, 56, seed)}" fill="url(#hatch-red)" opacity="0.5"/>`;
}

// Water, lava and gas laid over whatever the square holds.
function flowOverlay(cell, seed) {
  let out = '';
  if (cell.liquid === 'water' || cell.flooded) {
    out += `<path d="${cavePath(6, 6, 52, 52, seed)}" fill="${C.moss}" opacity="0.62"/>`;
    for (const y of [22, 34, 46]) out += line(`M14,${y} q4,-3 8,0 q4,3 8,0 q4,-3 8,0 q4,3 8,0`, 1.1, C.floor);
  } else if (cell.liquid === 'lava') {
    out += `<path d="${cavePath(6, 6, 52, 52, seed)}" fill="${C.lava}" opacity="0.85"/>`;
    out += line(roughLine(12, 24, 52, 30, seed, 2, 6), 1.2) + line(roughLine(14, 44, 50, 40, seed + 1, 2, 6), 1.2);
    out += line('M20,34 q4,-4 8,0 M36,22 q3,-3 6,0', 1.4, C.ochreLight);
  }
  if (cell.gas) {
    const color = { poison: C.moss, flammable: C.ochre, blinding: C.parchment }[cell.gas];
    const r = rand(seed + 77);
    for (let i = 0; i < 9; i++) {
      const cx = 12 + r() * 40;
      const cy = 12 + r() * 40;
      out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(5 + r() * 5)}" fill="${color}" opacity="0.45" stroke="${C.ink}" stroke-width="0.6" stroke-dasharray="2 2"/>`;
    }
  }
  return out;
}

// Two layers per square so openings can be drawn between them: the carved cavity, then its contents.
export function cellBase(cell, x, y) {
  const seed = seedOf(x, y);
  const cave = cell.type === 'lair' || cell.type === 'cavern' || cell.type === 'crystal';
  return cavity(seed, cave ? 'cave' : 'room');
}

export function cellDetail(cell, x, y, state = null) {
  const seed = seedOf(x, y);
  let out;
  if (cell.type === 'lair') out = lairArt(state, cell, x, y, seed);
  else if (cell.type === 'cavern' || cell.type === 'crystal') out = (FEATURE_ART[cell.feature] || FEATURE_ART.cave)(seed);
  else {
    const art = ROOM_ART[cell.room] || FOUND_ART[cell.room];
    out = art ? art(seed) : placeholderArt(cell.room);
    if (cell.bridge) out = `<rect x="6" y="40" width="52" height="16" fill="${C.moss}" opacity="0.6"/>` + out;
  }
  return out + flowOverlay(cell, seed);
}

// A small sword marks a room that houses a Long lost artefact.
export function artefactMark() {
  return `<g transform="translate(13,13) rotate(-35)">` + shape('M-1.6,-11 h3.2 v15 h-3.2Z', C.slate, 1) +
    shape('M-5,4 h10 v2.4 h-10Z', C.ochre, 1) + shape('M-1.4,6.4 h2.8 v5 h-2.8Z', C.wood, 1) + '</g>';
}

function placeholderArt(room) {
  return `<text x="32" y="36" text-anchor="middle" font-family="Metamorphous, serif" font-size="9">${room}</text>`;
}

// Small standalone icon for the build palette.
export function roomIcon(roomId) {
  const seed = seedOf(roomId.length, roomId.charCodeAt(0));
  const art = ROOM_ART[roomId] || FOUND_ART[roomId];
  const body = art ? cavity(seed) + art(seed) : cavity(seed) + placeholderArt(roomId);
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${defs()}<rect width="64" height="64" fill="url(#rock)"/>${body}</svg>`;
}

// ------------------------------------------------------------------- tokens

export function troopToken(count, str, selected, spent) {
  const fill = spent ? C.stoneDark : C.slate;
  return shape('M-11,-12 q11,-3 22,0 q1,14 -11,22 q-12,-8 -11,-22Z', fill, selected ? 3 : 1.8) +
    (selected ? `<path d="M-15,-16 q15,-4 30,0 q1,19 -15,30 q-16,-11 -15,-30Z" fill="none" stroke="${C.ochre}" stroke-width="2.2" stroke-dasharray="4 3"/>` : '') +
    `<text y="-1" text-anchor="middle" class="tok-n">${count}</text>` +
    `<text y="7" text-anchor="middle" class="tok-s">${str}</text>`;
}

export function enemyToken(str, seed) {
  const r = rand(seed);
  let d = '';
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rad = i % 2 ? 9 : 13 + r() * 2;
    d += `${i ? 'L' : 'M'}${f(Math.cos(a) * rad)},${f(Math.sin(a) * rad)}`;
  }
  return shape(`${d}Z`, C.oxblood, 1.8) + `<text y="3.5" text-anchor="middle" class="tok-e">${str}</text>`;
}
