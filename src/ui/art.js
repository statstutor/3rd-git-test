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

// An uncleared lair: the crypt, broken open, red-hatched with menace.
function lairArt(cell, seed) {
  let out = '';
  out += shape('M12,24 l7,-4 l7,4 v26 l-3,6 h-8 l-3,-6Z', C.slate, 1.5);
  out += shape('M36,30 l12,-6 l8,14 l-12,6Z', C.slate, 1.5); // lid knocked askew
  out += shape('M38,30 l7,-3 l7,3 v20 l-2,5 h-8 l-2,-5Z', C.ink, 1.2);
  out += `<circle cx="42.5" cy="38" r="1.4" fill="${C.lava}"/><circle cx="47.5" cy="38" r="1.4" fill="${C.lava}"/>`;
  out += skull(20, 52, 0.8);
  out += `<path d="${cavePath(4, 4, 56, 56, seed)}" fill="url(#hatch-red)" opacity="0.55"/>`;
  return out;
}

// Two layers per square so openings can be drawn between them: the carved cavity, then its contents.
export function cellBase(cell, x, y) {
  const seed = seedOf(x, y);
  return cavity(seed, cell.type === 'lair' || cell.type === 'cavern' ? 'cave' : 'room');
}

export function cellDetail(cell, x, y) {
  const seed = seedOf(x, y);
  if (cell.type === 'lair') return lairArt(cell, seed);
  if (cell.type === 'cavern') return ROOM_ART.cavern(seed);
  const art = ROOM_ART[cell.room];
  return art ? art(seed) : placeholderArt(cell.room);
}

function placeholderArt(room) {
  return `<text x="32" y="36" text-anchor="middle" font-family="Metamorphous, serif" font-size="9">${room}</text>`;
}

// Small standalone icon for the build palette.
export function roomIcon(roomId) {
  const seed = seedOf(roomId.length, roomId.charCodeAt(0));
  const art = ROOM_ART[roomId];
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
