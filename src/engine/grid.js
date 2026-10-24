// The map: cells, links, connectivity and paths. See RULINGS R4–R9, R14.

export const PAGE_W = 8; // R5
export const PAGE_H = 10;
export const ENTRANCE = { x: 3, y: 0 }; // column 4 of the first page's top row

export const key = (x, y) => `${x},${y}`;
export const parseKey = (k) => {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
};
export const depthOf = (y) => y + 1; // R16: Entrance row = depth 1

export const DIRS = [
  { dx: -1, dy: 0, name: 'west' },
  { dx: 1, dy: 0, name: 'east' },
  { dx: 0, dy: -1, name: 'up' },
  { dx: 0, dy: 1, name: 'down' },
];

export function getCell(state, x, y) {
  return state.cells[key(x, y)];
}

// Vertical links are stored once, keyed upper→lower. R8.
export function linkKey(x, yUpper) {
  return `${x},${yUpper}|${x},${yUpper + 1}`;
}

export function getLink(state, x, y1, y2) {
  return state.links[linkKey(x, Math.min(y1, y2))];
}

export function setLink(state, x, yUpper, type) {
  state.links[linkKey(x, yUpper)] = type;
}

// A square of "your hold": somewhere you can explore and build from (R7).
export function isHoldCell(cell) {
  if (!cell) return false;
  if (cell.flooded) return false;
  return cell.type === 'entrance' || cell.type === 'room' || cell.type === 'cavern';
}

// Squares dwarves can walk through (R9).
export function isPassableForDwarves(cell) {
  if (!cell) return false;
  if (cell.flooded) return false;
  return true;
}

// Squares enemies can walk through.
export function isPassableForEnemies(cell) {
  return !!cell;
}

// Orthogonal neighbours connected to (x, y). `mode` is 'dwarf' or 'enemy'.
// Each result carries the cost of the step for that mover (R14).
export function connectedNeighbours(state, x, y, mode = 'dwarf') {
  const passable = mode === 'enemy' ? isPassableForEnemies : isPassableForDwarves;
  const out = [];
  for (const d of DIRS) {
    const nx = x + d.dx;
    const ny = y + d.dy;
    const cell = getCell(state, nx, ny);
    if (!passable(cell)) continue;
    let cost = 1;
    if (d.dy !== 0) {
      const link = getLink(state, x, y, ny);
      if (!link) continue;
      // R14: enemies climb stairs at 1, anything else upward at 2 rounds per space.
      if (mode === 'enemy' && d.dy < 0 && link !== 'stairs') cost = 2;
    }
    out.push({ x: nx, y: ny, cost, dir: d.name });
  }
  return out;
}

// Every square reachable by dwarves from the Entrance (R9).
export function reachableFromEntrance(state) {
  const seen = new Set();
  const start = getCell(state, ENTRANCE.x, ENTRANCE.y);
  if (!isPassableForDwarves(start)) return seen;
  const queue = [ENTRANCE];
  seen.add(key(ENTRANCE.x, ENTRANCE.y));
  while (queue.length) {
    const p = queue.shift();
    for (const n of connectedNeighbours(state, p.x, p.y, 'dwarf')) {
      const k = key(n.x, n.y);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push(n);
      }
    }
  }
  return seen;
}

export function isConnected(state, x, y) {
  return reachableFromEntrance(state).has(key(x, y));
}

// Cheapest route for an enemy to a goal (default: the Entrance). Dijkstra with the
// R14 climbing costs. Returns { path: [{x,y,cost}...] (excluding start), cost } or null.
export function enemyRoute(state, from, goal = ENTRANCE) {
  const startK = key(from.x, from.y);
  const goalK = key(goal.x, goal.y);
  const dist = new Map([[startK, 0]]);
  const prev = new Map();
  const open = [{ x: from.x, y: from.y, d: 0 }];
  while (open.length) {
    // Small maps: a linear scan for the minimum is fine. Ties: lower y (shallower), then lower x,
    // so routes are deterministic.
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      const a = open[i];
      const b = open[bi];
      if (a.d < b.d || (a.d === b.d && (a.y < b.y || (a.y === b.y && a.x < b.x)))) bi = i;
    }
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.x, cur.y);
    if (cur.d > dist.get(ck)) continue;
    if (ck === goalK) break;
    for (const n of connectedNeighbours(state, cur.x, cur.y, 'enemy')) {
      const nk = key(n.x, n.y);
      const nd = cur.d + n.cost;
      if (!dist.has(nk) || nd < dist.get(nk)) {
        dist.set(nk, nd);
        prev.set(nk, { k: ck, cost: n.cost });
        open.push({ x: n.x, y: n.y, d: nd });
      }
    }
  }
  if (!dist.has(goalK)) return null;
  const path = [];
  let k = goalK;
  while (k !== startK) {
    const p = prev.get(k);
    path.unshift({ ...parseKey(k), cost: p.cost });
    k = p.k;
  }
  return { path, cost: dist.get(goalK) };
}

// Step distance through connected open squares, for Ranged (R21). Returns Map key→steps.
export function stepsWithin(state, from, maxSteps) {
  const out = new Map([[key(from.x, from.y), 0]]);
  let frontier = [from];
  for (let s = 1; s <= maxSteps; s++) {
    const next = [];
    for (const p of frontier) {
      for (const n of connectedNeighbours(state, p.x, p.y, 'enemy')) {
        const k = key(n.x, n.y);
        if (!out.has(k)) {
          out.set(k, s);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return out;
}

// R7: unexplored squares you may explore this turn.
export function explorableSquares(state) {
  const reach = reachableFromEntrance(state);
  const out = new Map();
  for (const k of reach) {
    const { x, y } = parseKey(k);
    if (!isHoldCell(state.cells[k])) continue;
    for (const d of DIRS) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (ny < 0) continue; // R4: nothing above the surface row
      const nk = key(nx, ny);
      if (state.cells[nk]) continue;
      out.set(nk, { x: nx, y: ny });
    }
  }
  return [...out.values()];
}

// After a new square is opened at (x, y), connect it (R8): sideways neighbours connect by
// themselves; if there are none, dig a shaft to the hold square above, else below.
export function connectNewSquare(state, x, y) {
  const sideways = [-1, 1].some((dx) => isHoldCell(getCell(state, x + dx, y)));
  if (sideways) return;
  const above = getCell(state, x, y - 1);
  const below = getCell(state, x, y + 1);
  if (isHoldCell(above)) {
    setLink(state, x, y - 1, above.type === 'entrance' ? 'stairs' : 'shaft');
  } else if (isHoldCell(below)) {
    setLink(state, x, y, below.room === 'stairs' ? 'stairs' : 'shaft');
  }
}

export function cellsInUse(state) {
  return Object.keys(state.cells).map(parseKey);
}

export function pageOf(x, y) {
  return { px: Math.floor(x / PAGE_W), py: Math.floor(y / PAGE_H) };
}
