// The app: wires the engine to the map and the side panels. Undo history, saves,
// the chronicle and the high-score table live here.

import {
  newGame, apply, GameError, capOf, costText, buildableSquares, housingFor, roomDef,
  scoreBreakdown,
} from '../engine/game.js';
import { explorableSquares, key, parseKey, depthOf, isConnected } from '../engine/grid.js';
import { legalTroopMoves, legalTargets, troopName } from '../engine/combat.js';
import { cardLabel, cardLongName, parseCard } from '../engine/deck.js';
import { chronicleAsText } from '../engine/chronicle.js';
import { ROOMS, FOUND_ROOMS } from '../data/rooms.js';
import { UNITS } from '../data/units.js';
import { SUITS } from '../data/cards.js';
import { CLUBS, SPADES } from '../data/discoveries.js';
import { MapView } from './map.js';
import { roomIcon } from './art.js';

const SAVE_KEY = 'delve.save.v1';
const SCORES_KEY = 'delve.scores.v1';
const UNDO_LIMIT = 60;

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let state;
let history = [];
const ui = { buildRoom: null, selectedTroop: null, hover: null, recorded: false };

// ------------------------------------------------------------------ storage (always guarded)

function store(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode etc. */ }
}
function load(k, fallback) {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

function save() {
  store(SAVE_KEY, { state, recorded: ui.recorded });
}

function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ------------------------------------------------------------------ actions

function act(action) {
  try {
    const next = apply(state, action);
    history.push(state);
    if (history.length > UNDO_LIMIT) history.shift();
    state = next;
  } catch (e) {
    if (e instanceof GameError) {
      toast(e.message);
      return false;
    }
    throw e;
  }
  if (action.type === 'build') ui.buildRoom = null;
  if (state.phase !== 'combat') ui.selectedTroop = null;
  else if (ui.selectedTroop && !state.combat.troops.some((t) => t.id === ui.selectedTroop && !t.acted)) {
    ui.selectedTroop = nextTroop();
  }
  save();
  render();
  if (state.over && !ui.recorded) showGameOver();
  return true;
}

function undo() {
  if (!history.length) return;
  state = history.pop();
  ui.buildRoom = null;
  ui.selectedTroop = null;
  save();
  render();
  toast('Undone.');
}

function nextTroop() {
  const t = state.combat && state.combat.troops.find((x) => !x.acted && legalTroopMoves(state, x).length + legalTargets(state, x).length);
  return t ? t.id : null;
}

// ------------------------------------------------------------------ map wiring

function highlights() {
  const h = new Map();
  if (state.over) return h;
  if (state.phase === 'explore') for (const p of explorableSquares(state)) h.set(key(p.x, p.y), 'explore');
  if (ui.buildRoom) for (const p of buildableSquares(state, ui.buildRoom)) h.set(key(p.x, p.y), 'build');
  if (state.phase === 'combat' && ui.selectedTroop) {
    const t = state.combat.troops.find((x) => x.id === ui.selectedTroop);
    if (t) {
      for (const p of legalTroopMoves(state, t)) h.set(key(p.x, p.y), 'move');
      for (const e of legalTargets(state, t)) h.set(key(e.x, e.y), 'target');
    }
  }
  return h;
}

function onCellClick({ x, y }) {
  if (state.over) return;
  const k = key(x, y);
  const hl = highlights().get(k);
  if (hl === 'explore') return act({ type: 'explore', x, y });
  if (hl === 'build') return act({ type: 'build', x, y, room: ui.buildRoom });
  if (state.phase === 'combat') {
    const t = state.combat.troops.find((x2) => x2.id === ui.selectedTroop);
    if (hl === 'target' && t) {
      const enemy = state.combat.enemies.find((e) => e.x === x && e.y === y);
      return act({ type: 'fire', troopId: t.id, enemyId: enemy.id });
    }
    if (hl === 'move' && t) return act({ type: 'moveTroop', troopId: t.id, x, y });
    const here = state.combat.troops.filter((t2) => t2.x === x && t2.y === y && !t2.acted);
    if (here.length) {
      const i = here.findIndex((t2) => t2.id === ui.selectedTroop);
      ui.selectedTroop = here[(i + 1) % here.length].id;
      return render();
    }
  }
  if (ui.buildRoom) {
    ui.buildRoom = null;
    render();
  }
}

function onCellHover(c) {
  ui.hover = c;
  renderInfo();
}

// ------------------------------------------------------------------ rendering

function render() {
  map.render(state, { highlights: highlights(), selectedTroop: ui.selectedTroop });
  renderStatus();
  renderPhase();
  renderCard();
  renderUnits();
  renderChronicle();
  renderInfo();
  $('#undo').disabled = !history.length;
}

function renderStatus() {
  const sc = scoreBreakdown(state).total;
  $('#status').innerHTML = `
    <div class="stat"><span class="suit red">♥</span><b>${state.res.hearts}</b><small>/ ${capOf(state, 'hearts')}</small><em>Resources</em></div>
    <div class="stat"><span class="suit red">♦</span><b>${state.res.diamonds}</b><small>/ ${capOf(state, 'diamonds')}</small><em>Trade Goods</em></div>
    <div class="stat"><span class="glyph">⚒</span><b>${state.turn}</b><em>Turn</em></div>
    <div class="stat"><span class="glyph">▼</span><b>${state.stats.maxDepth}</b><em>Deepest</em></div>
    <div class="stat"><span class="glyph">✶</span><b>${sc}</b><em>Score</em></div>`;
  const steps = [['start', 'Start'], ['explore', 'Explore'], ['combat', 'Combat'], ['trade', 'Trade'], ['build', 'Build'], ['recruit', 'Recruit'], ['end', 'End']];
  const cur = state.phase;
  const idx = steps.findIndex(([p]) => p === cur);
  $('#tracker').innerHTML = steps.map(([p, label], i) =>
    `<li class="${p === cur ? 'now' : i < idx ? 'done' : ''}">${label}</li>`).join('');
}

function renderPhase() {
  const el = $('#phase');
  if (state.over) {
    el.innerHTML = `<h2>The hold has fallen</h2><p>${esc(state.over.by || '')} escaped into the daylight on turn ${state.over.turn}.</p>
      <button data-do="gameover" class="big">See the reckoning</button>`;
    return;
  }
  if (state.phase === 'explore') {
    el.innerHTML = `<h2>Explore</h2>
      <p>Choose an unexplored square next to your hold (marked in <span class="ochre">ochre</span>) and the miners will dig.
      A card is drawn to see what they find.</p>`;
    return;
  }
  if (state.phase === 'combat') return renderCombat(el);
  renderManage(el);
}

function renderCombat(el) {
  const c = state.combat;
  const troops = c.troops.map((t) => {
    const cls = [t.id === ui.selectedTroop ? 'sel' : '', t.acted ? 'spent' : ''].join(' ');
    const where = roomName(state.cells[key(t.x, t.y)]);
    return `<button class="troop ${cls}" data-troop="${t.id}" ${t.acted ? 'disabled' : ''}>
      <b>${esc(troopName(t))}</b> · ${t.hp} STR <small>at ${esc(where)} (depth ${depthOf(t.y)})${t.acted ? ' — done' : ''}</small></button>`;
  }).join('') || '<p><em>No Troops could muster.</em></p>';
  const foes = c.enemies.map((e) => `<li><span class="foe">${esc(e.name)}</span> ${e.str} STR <small>depth ${depthOf(e.y)}</small></li>`).join('');
  const recent = c.log.slice(-8).map((l) => `<li><small>R${l.round}</small> ${esc(l.text)}</li>`).join('');
  el.innerHTML = `<h2>Combat — round ${c.round}</h2>
    <p class="hint">Enemies have moved. Pick a Troop, then click a <span class="slate">slate</span> square to move it one space,
    or an <span class="oxblood">oxblood</span> square to fire (Ranged). Troops you leave alone hold their ground.
    Damage lands all at once when you end the round.</p>
    <div class="troops">${troops}</div>
    <h3>Foes</h3><ul class="foes">${foes}</ul>
    <button class="big" data-do="endRound">End round ⟶</button>
    <h3>This fight</h3><ul class="log">${recent}</ul>`;
}

function renderManage(el) {
  const ph = state.phase;
  const tradeOpen = ph === 'trade' && !state.flags.traded;
  const buildOpen = ph === 'trade' || ph === 'build';
  const tradeHtml = tradeOpen ? `
      <div class="trade">
        <label>Sell <input type="number" id="give-d" min="1" max="${state.res.diamonds}" value="1"> ♦ for <b id="get-h">2</b>♥</label>
        <button data-do="trade-d">Trade</button>
        <label>Sell <input type="number" id="give-h" min="2" step="2" max="${state.res.hearts}" value="2"> ♥ for <b id="get-d">1</b>♦</label>
        <button data-do="trade-h">Trade</button>
      </div>
      <p class="hint">One trade per turn, either way. 1♦ = 2♥.</p>`
    : `<p class="done-note">${state.flags.traded ? 'You have traded this turn.' : 'Trading is past for this turn.'}</p>`;

  const cats = {};
  for (const [id, r] of Object.entries(ROOMS)) (cats[r.category] = cats[r.category] || []).push([id, r]);
  const palette = Object.entries(cats).map(([cat, rooms]) => `
      <h4>${esc(cat)}</h4><div class="palette">${rooms.map(([id, r]) => {
    const afford = (r.cost.hearts || 0) <= state.res.hearts && (r.cost.diamonds || 0) <= state.res.diamonds;
    const can = r.implemented && buildOpen && !state.flags.roomBuilt && afford;
    return `<button class="room ${ui.buildRoom === id ? 'sel' : ''} ${r.implemented ? '' : 'soon'}" data-room="${id}" ${can ? '' : 'disabled'}
        title="${esc(r.name)} — ${esc(costText(r.cost))}${r.implemented ? '' : ' (coming soon)'}">
        ${roomIcon(id)}<span>${esc(r.name)}</span><small>${r.implemented ? esc(costText(r.cost)) : 'soon'}</small></button>`;
  }).join('')}</div>`).join('');
  const sel = ui.buildRoom && ROOMS[ui.buildRoom];
  const buildHtml = `
      ${state.flags.roomBuilt ? '<p class="done-note">You have built your room for this turn.</p>' : ''}
      ${sel ? `<div class="chosen"><b>${esc(sel.name)}</b> (${esc(costText(sel.cost))}) — click a <span class="moss">green</span> square.
        <p class="quote">“${esc(sel.text)}” <small>p. ${sel.page}</small></p></div>` : ''}
      ${palette}`;

  const homes = Object.keys(state.cells).map((k) => ({ k, ...parseKey(k) }))
    .map((p) => ({ ...p, h: housingFor(state, p.x, p.y) })).filter((p) => p.h);
  const recruitHtml = homes.map(({ x, y, h }) => {
    const units = h.houses.units.filter((u) => UNITS[u].implemented);
    const connected = isConnected(state, x, y);
    return `<div class="home"><b>${esc(h.def.name)}</b> <small>depth ${depthOf(y)}</small>
      <span>${h.count}/${h.capacity} ${h.unit ? esc(UNITS[h.unit].plural) : ''}</span>
      ${units.map((u) => `<span class="unit-buy">${esc(UNITS[u].plural)} (${UNITS[u].cost.diamonds}♦, ${UNITS[u].str} STR)
        ${[1, 5].map((n) => `<button data-recruit="${x},${y},${u},${n}" ${!connected || h.count + n > h.capacity || UNITS[u].cost.diamonds * n > state.res.diamonds || (h.count && h.unit !== u) ? 'disabled' : ''}>+${n}</button>`).join('')}</span>`).join('') || '<small>nothing to recruit here yet</small>'}
    </div>`;
  }).join('');

  el.innerHTML = `
    <section class="${ph === 'trade' ? 'active' : 'past'}"><h2>Trade</h2>${tradeHtml}</section>
    <section class="${buildOpen ? 'active' : 'past'}"><h2>Build</h2>${buildOpen ? buildHtml : '<p class="done-note">Building is past for this turn.</p>'}</section>
    <section class="active"><h2>Recruit</h2>${recruitHtml}</section>
    <button class="big" data-do="endTurn">End turn ⟶</button>`;

  const gd = $('#give-d');
  const gh = $('#give-h');
  if (gd) gd.oninput = () => { $('#get-h').textContent = Math.max(0, Math.floor(gd.value)) * 2; };
  if (gh) gh.oninput = () => { $('#get-d').textContent = Math.floor(Math.max(0, gh.value) / 2); };
}

function roomName(cell) {
  if (!cell) return 'the rock';
  if (cell.type === 'cavern') return 'an empty cavern';
  if (cell.type === 'lair') return 'a lair';
  const d = roomDef(cell);
  return d ? d.name : cell.room;
}

function cardMeaning(id) {
  const c = parseCard(id);
  if (c.joker) return { title: c.name, text: 'Jokers enter the deck at depth 5 (p. 33).', page: 33 };
  if (c.suit === 'H') return { title: 'Resources', text: 'If you draw a ♥ or ♦, add the value of the card, plus your current depth to your Resources (♥) or Trade Goods (♦).', page: 3 };
  if (c.suit === 'D') return { title: 'Trade Goods', text: 'If you draw a ♥ or ♦, add the value of the card, plus your current depth to your Resources (♥) or Trade Goods (♦).', page: 3 };
  const e = (c.suit === 'C' ? CLUBS : SPADES)[c.rank];
  return { title: e.name, text: e.text, page: e.page };
}

function renderCard() {
  const el = $('#card');
  if (!state.lastCard) {
    el.innerHTML = '<p class="hint">No card drawn yet. The deck waits.</p>';
    return;
  }
  const id = state.lastCard.id;
  const c = parseCard(id);
  const m = cardMeaning(id);
  const red = c.color === 'red';
  el.innerHTML = `<div class="playing-card ${red ? 'red' : ''}">
      <span>${c.joker ? '★' : esc(c.rank)}</span><span class="pip">${c.joker ? '' : SUITS[c.suit].symbol}</span></div>
    <div><b>${esc(cardLongName(id))}</b> — ${esc(m.title)}
      <p class="quote">“${esc(m.text)}” <small>p. ${m.page}</small></p></div>`;
}

function renderUnits() {
  const rows = Object.entries(state.housing).filter(([, h]) => h.count).map(([k, h]) => {
    const { x, y } = parseKey(k);
    return `<li><b>${h.count}</b> ${esc(h.count === 1 ? UNITS[h.unit].name : UNITS[h.unit].plural)} <small>in the ${esc(roomName(state.cells[k]))}, depth ${depthOf(y)}${isConnected(state, x, y) ? '' : ' — cut off!'}</small></li>`;
  });
  $('#units').innerHTML = rows.join('') || '<li><em>No dwarves stand ready.</em></li>';
}

function renderChronicle() {
  const el = $('#chronicle');
  let lastTurn = null;
  el.innerHTML = state.chronicle.map((e, i) => {
    const head = e.turn !== lastTurn ? `<li class="turn">Turn ${e.turn}</li>` : '';
    lastTurn = e.turn;
    return `${head}<li ${e.ref ? `data-ref="${i}" class="has-ref"` : ''}>${esc(e.text)}</li>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

function renderInfo() {
  const el = $('#info');
  const c = ui.hover;
  if (!c || c.y < 0) { el.hidden = true; return; }
  const cell = state.cells[key(c.x, c.y)];
  let html = `<b>Depth ${depthOf(c.y)}</b>`;
  if (!cell) {
    html += ' · solid rock';
  } else if (cell.type === 'lair') {
    const e = SPADES[cell.lair.entry];
    html += ` · <b>${esc(e.name)}</b> (lair, ${cardLabel(cell.lair.card)})<p class="quote">“${esc(e.text)}” <small>p. ${e.page}</small></p>`;
  } else {
    const d = roomDef(cell);
    html += ` · <b>${esc(roomName(cell))}</b>${cell.found ? ` <small>(${cardLabel(cell.found.card)})</small>` : ''}`;
    if (d) html += `<p class="quote">“${esc(d.text)}” <small>p. ${d.page}</small></p>`;
    if (!isConnected(state, c.x, c.y)) html += '<p class="warn">Disconnected from the Entrance.</p>';
  }
  if (state.combat) {
    for (const e of state.combat.enemies.filter((q) => q.x === c.x && q.y === c.y)) html += `<p><span class="foe">${esc(e.name)}</span> ${e.str} STR</p>`;
    for (const t of state.combat.troops.filter((q) => q.x === c.x && q.y === c.y)) html += `<p>${esc(troopName(t))} · ${t.hp} STR</p>`;
  }
  el.innerHTML = html;
  el.hidden = false;
}

// ------------------------------------------------------------------ tooltip for chronicle quotes

function showTip(target) {
  const tip = $('#tip');
  const i = target.dataset.ref;
  const ref = state.chronicle[i] && state.chronicle[i].ref;
  if (!ref) return;
  tip.innerHTML = `<b>${esc(ref.title || '')}</b>${ref.card ? ` <span class="${parseCard(ref.card).color === 'red' ? 'red' : ''}">${esc(cardLabel(ref.card))}</span>` : ''}
    <p class="quote">“${esc(ref.quote || '')}”</p><small>DELVE, p. ${ref.page}</small>`;
  const r = target.getBoundingClientRect();
  tip.hidden = false;
  const tr = tip.getBoundingClientRect();
  tip.style.left = `${Math.max(8, r.left - tr.width - 12)}px`;
  tip.style.top = `${Math.min(window.innerHeight - tr.height - 8, Math.max(8, r.top))}px`;
}

// ------------------------------------------------------------------ modals

function modal(html) {
  const m = $('#modal');
  m.innerHTML = `<div class="sheet">${html}</div>`;
  m.hidden = false;
}
function closeModal() { $('#modal').hidden = true; }

function scoresTable() {
  const scores = load(SCORES_KEY, []);
  if (!scores.length) return '<p class="hint">No holds recorded yet.</p>';
  return `<table class="scores"><tr><th>#</th><th>Overseer</th><th>Hold</th><th>Score</th><th>Depth</th><th>Turns</th><th>Fate</th></tr>
    ${scores.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.name)}</td><td>${esc(s.hold)}</td><td><b>${s.score}</b></td><td>${s.depth}</td><td>${s.turns}</td><td>${esc(s.fate)}</td></tr>`).join('')}</table>`;
}

function showGameOver() {
  const b = scoreBreakdown(state);
  modal(`<h2>${state.over.reason === 'fallen' ? 'The Fall of ' : 'The Glory of '}${esc(state.holdName)}</h2>
    <table class="breakdown">${b.parts.map((p) => `<tr><td>${esc(p.label)}</td><td><small>${esc(p.detail)}</small></td><td>${p.points}</td></tr>`).join('')}
      <tr class="total"><td>Total</td><td></td><td>${b.total}</td></tr></table>
    ${ui.recorded ? '' : `<label>Overseer’s name <input id="who" value="${esc(load('delve.lastName', ''))}" maxlength="30"></label>
      <button class="big" data-do="record">Carve it in the hall of records</button>`}
    <h3>Hall of records</h3>${scoresTable()}
    <div class="row"><button data-do="exportChronicle">Export chronicle</button><button data-do="newGame">New hold</button><button data-do="close">Look at the map</button></div>`);
}

function recordScore() {
  const name = ($('#who').value || 'Overseer').trim();
  store('delve.lastName', name);
  const b = scoreBreakdown(state);
  const scores = load(SCORES_KEY, []);
  scores.push({
    name, hold: state.holdName, score: b.total, depth: state.stats.maxDepth, turns: state.stats.turnsSurvived,
    fate: state.over.reason === 'fallen' ? `Fell, turn ${state.over.turn}` : 'Found the Void Crystal',
    date: new Date().toISOString().slice(0, 10),
  });
  scores.sort((a, b2) => b2.score - a.score);
  store(SCORES_KEY, scores.slice(0, 25));
  ui.recorded = true;
  save();
  showGameOver();
}

function showNewGame() {
  modal(`<h2>Found a new hold</h2>
    <label>Name of the hold <input id="hold-name" value="${esc(randomHoldName())}" maxlength="40"></label>
    <p class="hint">You begin with a stairwell, 20♥, 20♦ and five Soldiers at the Entrance.</p>
    <fieldset><legend>Optional rules</legend>
      <label class="off"><input type="checkbox" disabled> World Layers (p. 37) — coming soon</label>
    </fieldset>
    <div class="row"><button class="big" data-do="startGame">Strike the first stone</button>
    ${state ? '<button data-do="close">Cancel</button>' : ''}</div>`);
}

function randomHoldName() {
  const a = ['Karak', 'Khaz', 'Barak', 'Dun', 'Grim', 'Bel', 'Thor', 'Zirak', 'Kel', 'Durn'];
  const b = ['dum', 'grund', 'heim', 'azul', 'gar', 'mund', 'dor', 'thrum', 'zan', 'holm'];
  const n = Math.floor(Math.random() * 100);
  return `${a[n % 10]}-${b[Math.floor(n / 10)]}`;
}

function startGame() {
  const name = ($('#hold-name').value || 'the Hold').trim();
  state = newGame({ holdName: name });
  history = [];
  ui.recorded = false;
  ui.buildRoom = null;
  ui.selectedTroop = null;
  closeModal();
  homeView();
  save();
  render();
}

// Frame the hold with the depth numbers in view.
function homeView() {
  map.view.zoom = 1.5;
  const halfW = map.svg.getBoundingClientRect().width / map.view.zoom / 2;
  map.centreOn(Math.min(3.5, (halfW - 60) / 64 - 0.5), Math.max(2.2, state.stats.maxDepth - 1));
}

function showScores() {
  modal(`<h2>Hall of records</h2>${scoresTable()}
    <div class="row"><button data-do="close">Close</button></div>`);
}

function showHelp() {
  modal(`<h2>How to play</h2>
    <ol>
      <li><b>Explore:</b> click an ochre square beside your hold. A card is drawn: ♥ and ♦ bring resources (card + depth),
      ♣ natural formations, ♠ remnants and foes (never at depth 1).</li>
      <li><b>Combat:</b> enemies march on the Entrance. Select a Troop, click a slate square to move it, then <i>End round</i>.
      If a foe stands on the Entrance at the start of a round, it escapes and the hold falls.</li>
      <li><b>Trade</b> once (1♦ = 2♥), <b>build</b> one room (green squares), <b>recruit</b>, then <i>End turn</i>.</li>
    </ol>
    <p>Drag to pan, scroll to zoom. Hover any square or chronicle line to read what the book says.
    <b>Undo</b> steps back one action, but the deck remembers, so you can’t redraw a card.</p>
    <p class="hint">Rules readings our table chose are in RULINGS.md. DELVE is designed by Anna Blackwell; this is a family companion, not for distribution.</p>
    <div class="row"><button data-do="close">Close</button></div>`);
}

// ------------------------------------------------------------------ toasts

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

// ------------------------------------------------------------------ events

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.room) {
    ui.buildRoom = ui.buildRoom === b.dataset.room ? null : b.dataset.room;
    return render();
  }
  if (b.dataset.troop) {
    ui.selectedTroop = b.dataset.troop;
    return render();
  }
  if (b.dataset.recruit) {
    const [x, y, unit, n] = b.dataset.recruit.split(',');
    return act({ type: 'recruit', x: +x, y: +y, unit, count: +n });
  }
  switch (b.dataset.do) {
    case 'endRound': return act({ type: 'endRound' });
    case 'endTurn': return act({ type: 'endTurn' });
    case 'trade-d': return act({ type: 'trade', give: 'diamonds', amount: +$('#give-d').value });
    case 'trade-h': return act({ type: 'trade', give: 'hearts', amount: +$('#give-h').value });
    case 'undo': return undo();
    case 'zoomIn': return map.zoomBy(1.25);
    case 'zoomOut': return map.zoomBy(0.8);
    case 'home': return homeView();
    case 'newGame': return showNewGame();
    case 'startGame': return startGame();
    case 'close': return closeModal();
    case 'scores': return showScores();
    case 'help': return showHelp();
    case 'gameover': return showGameOver();
    case 'record': return recordScore();
    case 'exportSave': return download(`${state.holdName.replace(/\W+/g, '-')}-turn-${state.turn}.delve.json`, JSON.stringify({ app: 'delve', state }, null, 1));
    case 'importSave': return $('#import-file').click();
    case 'exportChronicle': return download(`${state.holdName.replace(/\W+/g, '-')}-chronicle.txt`, chronicleAsText(state, `The Chronicle of ${state.holdName}`), 'text/plain');
    default:
  }
});

$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const s = data.state || data;
    if (!s || s.version !== 1 || !s.cells) throw new Error('not a DELVE save');
    state = s;
    history = [];
    ui.recorded = !!s.over;
    closeModal();
    save();
    render();
    toast(`Loaded ${s.holdName}, turn ${s.turn}.`);
  } catch (err) {
    toast(`Couldn’t load that file (${err.message}).`);
  }
});

document.addEventListener('mouseover', (e) => {
  const li = e.target.closest('[data-ref]');
  if (li) showTip(li);
});
document.addEventListener('mouseout', (e) => {
  if (e.target.closest('[data-ref]')) $('#tip').hidden = true;
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if (e.key === 'Escape') { ui.buildRoom = null; closeModal(); render(); }
});

// ------------------------------------------------------------------ boot

const map = new MapView($('#map'), { onCellClick, onCellHover });
const saved = load(SAVE_KEY, null);
if (saved && saved.state && saved.state.version === 1) {
  state = saved.state;
  ui.recorded = !!saved.recorded;
  homeView();
  render();
} else {
  state = newGame({ holdName: randomHoldName() });
  homeView();
  render();
  showNewGame();
}
