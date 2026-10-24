// The map: an SVG grid of 1" squares on pages of 8×10, drawn in ink. Pan by dragging,
// zoom with the wheel or the buttons. Knows nothing about rules; main.js tells it what to
// highlight and what a click means.

import { PAGE_W, PAGE_H, parseKey, key } from '../engine/grid.js';
import {
  S, C, defs, cellBase, cellDetail, sideOpening, verticalOpening, seedOf, roughRect, roughLine,
  troopToken, enemyToken,
} from './art.js';

const HIGHLIGHT = {
  explore: { stroke: C.ochre, fill: C.ochre },
  build: { stroke: C.moss, fill: C.moss },
  move: { stroke: C.slate, fill: C.slate },
  target: { stroke: C.oxblood, fill: C.oxblood },
};

export class MapView {
  constructor(svg, { onCellClick, onCellHover }) {
    this.svg = svg;
    this.onCellClick = onCellClick;
    this.onCellHover = onCellHover;
    this.view = { cx: 3.5 * S, cy: 3 * S, zoom: 1 };
    this.drag = null;
    this.hover = null;
    svg.addEventListener('pointerdown', (e) => this.pointerDown(e));
    svg.addEventListener('pointermove', (e) => this.pointerMove(e));
    svg.addEventListener('pointerup', (e) => this.pointerUp(e));
    svg.addEventListener('pointerleave', () => this.setHover(null));
    svg.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    new ResizeObserver(() => this.applyView()).observe(svg);
  }

  // ------------------------------------------------------------ view

  applyView() {
    const { width, height } = this.svg.getBoundingClientRect();
    if (!width || !height) return;
    const w = width / this.view.zoom;
    const h = height / this.view.zoom;
    this.svg.setAttribute('viewBox', `${this.view.cx - w / 2} ${this.view.cy - h / 2} ${w} ${h}`);
  }

  zoomBy(factor, around) {
    const z = Math.min(3, Math.max(0.25, this.view.zoom * factor));
    if (around) {
      const k = 1 - this.view.zoom / z;
      this.view.cx += (around.x - this.view.cx) * k;
      this.view.cy += (around.y - this.view.cy) * k;
    }
    this.view.zoom = z;
    this.applyView();
  }

  // Zoom and centre so the given squares (plus the depth numbers and the surface) all show.
  fit(squares) {
    const { width, height } = this.svg.getBoundingClientRect();
    if (!width || !height) return;
    const xs = squares.map((p) => p.x);
    const ys = squares.map((p) => p.y);
    const x0 = Math.min(...xs) * S - 70; // room for the depth numbers
    const x1 = (Math.max(...xs) + 1) * S + 20;
    const y0 = Math.min(-0.6, Math.min(...ys)) * S - 10;
    const y1 = (Math.max(...ys) + 1) * S + 20;
    this.view.zoom = Math.max(0.35, Math.min(1.8, width / (x1 - x0), height / (y1 - y0)));
    this.view.cx = (x0 + x1) / 2;
    this.view.cy = (y0 + y1) / 2;
    this.applyView();
  }

  centreOn(x, y) {
    this.view.cx = (x + 0.5) * S;
    this.view.cy = (y + 0.5) * S;
    this.applyView();
  }

  toWorld(e) {
    const pt = this.svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(this.svg.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  }

  cellAt(e) {
    const p = this.toWorld(e);
    return { x: Math.floor(p.x / S), y: Math.floor(p.y / S) };
  }

  pointerDown(e) {
    this.drag = { x: e.clientX, y: e.clientY, cx: this.view.cx, cy: this.view.cy, moved: false };
    this.svg.setPointerCapture(e.pointerId);
  }

  pointerMove(e) {
    if (this.drag) {
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) this.drag.moved = true;
      if (this.drag.moved) {
        this.view.cx = this.drag.cx - dx / this.view.zoom;
        this.view.cy = this.drag.cy - dy / this.view.zoom;
        this.applyView();
        this.svg.classList.add('panning');
      }
      return;
    }
    this.setHover(this.cellAt(e));
  }

  pointerUp(e) {
    const d = this.drag;
    this.drag = null;
    this.svg.classList.remove('panning');
    if (d && !d.moved) this.onCellClick(this.cellAt(e));
  }

  wheel(e) {
    e.preventDefault();
    this.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, this.toWorld(e));
  }

  setHover(c) {
    const same = (a, b) => (a && b ? a.x === b.x && a.y === b.y : a === b);
    if (same(c, this.hover)) return;
    this.hover = c;
    const el = this.svg.querySelector('#hover');
    if (el) {
      el.setAttribute('visibility', c && c.y >= 0 ? 'visible' : 'hidden');
      if (c) el.setAttribute('transform', `translate(${c.x * S},${c.y * S})`);
    }
    this.onCellHover(c);
  }

  // ------------------------------------------------------------ drawing

  pagesFor(state) {
    let minX = 0; let maxX = PAGE_W - 1; let maxY = PAGE_H - 1;
    for (const k of Object.keys(state.cells)) {
      const { x, y } = parseKey(k);
      minX = Math.min(minX, x - 1);
      maxX = Math.max(maxX, x + 1);
      maxY = Math.max(maxY, y + 1);
    }
    const p0 = Math.floor(minX / PAGE_W);
    const p1 = Math.floor(maxX / PAGE_W);
    const q1 = Math.floor(maxY / PAGE_H);
    const pages = [];
    for (let py = 0; py <= q1; py++) for (let px = p0; px <= p1; px++) pages.push({ px, py });
    return { pages, p0, p1, q1 };
  }

  render(state, ui) {
    const { pages, p0, q1 } = this.pagesFor(state);
    const out = [defs()];

    // pages of grid paper, with rock shading
    for (const { px, py } of pages) {
      const x0 = px * PAGE_W * S;
      const y0 = py * PAGE_H * S;
      const w = PAGE_W * S;
      const h = PAGE_H * S;
      out.push(`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="url(#rock)"/>`);
      let grid = '';
      for (let i = 1; i < PAGE_W; i++) grid += `M${x0 + i * S},${y0}v${h}`;
      for (let j = 1; j < PAGE_H; j++) grid += `M${x0},${y0 + j * S}h${w}`;
      out.push(`<path d="${grid}" stroke="${C.stoneDark}" stroke-width="0.8" opacity="0.6" fill="none"/>`);
      out.push(`<path d="${roughRect(x0, y0, w, h, seedOf(px, py, 7), 2.5, 24)}" fill="none" stroke="${C.ink}" stroke-width="3"/>`);
    }

    // the surface above row 1
    const left = p0 * PAGE_W * S;
    const right = (this.pagesFor(state).p1 + 1) * PAGE_W * S;
    out.push(`<rect x="${left}" y="${-S * 1.4}" width="${right - left}" height="${S * 1.4}" fill="${C.parchment}"/>`);
    out.push(`<path d="${roughLine(left, -2, right, -2, 5, 1.5, 16)}" stroke="${C.moss}" stroke-width="5" fill="none"/>`);
    for (let gx = left + 20; gx < right; gx += 37) {
      out.push(`<path d="M${gx},-4 l-3,-9 M${gx + 3},-4 l1,-11 M${gx + 6},-4 l4,-8" stroke="${C.moss}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`);
    }

    // depth numbers down the side
    let depthLabels = '';
    for (let y = 0; y < (q1 + 1) * PAGE_H; y++) {
      depthLabels += `<text x="${left - 14}" y="${y * S + S / 2 + 6}" text-anchor="end" class="depth-n">${y + 1}</text>`;
    }
    out.push(`<text x="${left - 14}" y="${-12}" text-anchor="end" class="depth-h">Depth</text>`);
    out.push(depthLabels);

    // explored squares: cavities, then openings, then contents
    const entries = Object.entries(state.cells).map(([k, cell]) => ({ ...parseKey(k), cell }));
    for (const { x, y, cell } of entries) {
      out.push(`<g transform="translate(${x * S},${y * S})" class="${cell.flooded ? 'flooded' : ''}">${cellBase(cell, x, y)}</g>`);
    }
    for (const { x, y } of entries) {
      if (state.cells[key(x + 1, y)]) out.push(`<g transform="translate(${x * S},${y * S})">${sideOpening(seedOf(x, y, 1))}</g>`);
      const link = state.links[`${x},${y}|${x},${y + 1}`];
      if (link && state.cells[key(x, y + 1)]) {
        out.push(`<g transform="translate(${x * S},${y * S})">${verticalOpening(link, seedOf(x, y, 2))}</g>`);
      }
    }
    for (const { x, y, cell } of entries) {
      let extra = '';
      if (cell.damaged) extra += `<path d="M12,12 L52,52 M52,12 L12,52" stroke="${C.oxblood}" stroke-width="3"/>`;
      out.push(`<g transform="translate(${x * S},${y * S})">${cellDetail(cell, x, y)}${extra}</g>`);
    }

    // housed units (outside combat): a small tally in the corner
    if (!state.combat) {
      for (const [k, h] of Object.entries(state.housing)) {
        if (!h.count) continue;
        const { x, y } = parseKey(k);
        out.push(`<g transform="translate(${x * S + 52},${y * S + 13})"><circle r="8.5" fill="${C.slate}" stroke="${C.ink}" stroke-width="1.5"/>` +
          `<text y="3.6" text-anchor="middle" class="tally">${h.count}</text></g>`);
      }
    }

    // highlights
    for (const [k, kind] of ui.highlights) {
      const { x, y } = parseKey(k);
      const h = HIGHLIGHT[kind];
      out.push(`<g transform="translate(${x * S},${y * S})" class="hl hl-${kind}">` +
        `<rect x="3" y="3" width="58" height="58" fill="${h.fill}" opacity="0.16"/>` +
        `<path d="${roughRect(4, 4, 56, 56, seedOf(x, y, 5), 1.2, 9)}" fill="none" stroke="${h.stroke}" stroke-width="2.6" stroke-dasharray="7 4"/></g>`);
    }

    // combat tokens
    if (state.combat) {
      const byCell = new Map();
      const add = (k, item) => { if (!byCell.has(k)) byCell.set(k, []); byCell.get(k).push(item); };
      for (const e of state.combat.enemies) add(key(e.x, e.y), { e });
      for (const t of state.combat.troops) add(key(t.x, t.y), { t });
      for (const [k, items] of byCell) {
        const { x, y } = parseKey(k);
        items.forEach((it, i) => {
          const ox = x * S + 20 + (i % 2) * 24;
          const oy = y * S + 22 + Math.floor(i / 2) * 22;
          if (it.e) {
            out.push(`<g transform="translate(${ox},${oy})" class="tok">${enemyToken(it.e.str, seedOf(x, y, i))}</g>`);
          } else {
            const t = it.t;
            out.push(`<g transform="translate(${ox},${oy})" class="tok">${troopToken(t.count, t.hp, ui.selectedTroop === t.id, t.acted)}</g>`);
          }
        });
      }
    }

    // hover outline (moved, not redrawn, on mouse move)
    out.push(`<g id="hover" visibility="hidden"><path d="${roughRect(2, 2, 60, 60, 11, 1, 10)}" fill="none" stroke="${C.ink}" stroke-width="1.6" opacity="0.6"/></g>`);

    this.svg.innerHTML = out.join('');
    this.applyView();
    if (this.hover) {
      const el = this.svg.querySelector('#hover');
      el.setAttribute('visibility', this.hover.y >= 0 ? 'visible' : 'hidden');
      el.setAttribute('transform', `translate(${this.hover.x * S},${this.hover.y * S})`);
    }
  }
}
