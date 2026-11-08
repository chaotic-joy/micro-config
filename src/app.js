import { Via, MICRO } from './via.js';
import { MockMicro } from './mock.js';
import { KEYS, byDomCode, describe, withMods, modLabel, MOD, LAYER_FN, MACRO_BASE, figmaPresets, isMac, hex } from './keycodes.js';
import { encode, parseBuffer, buildBuffer } from './macros.js';

const $ = (s) => document.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat().filter((k) => k != null));
  return el;
};

// ---- physical layout (from the official VIA definition) -------------------
// [row, col, x, y, kind]
const LAYOUT = [
  [0, 0, 0, 0, 'knob'], [0, 1, 1.25, 0.25], [0, 2, 2.25, 0.25], [0, 3, 3.5, 0, 'knob'],
  [1, 0, 0.25, 1.25], [1, 1, 1.25, 1.25], [1, 2, 2.25, 1.25], [1, 3, 3.25, 1.25],
  [2, 0, 0.25, 2.25], [2, 1, 1.25, 2.25], [2, 2, 2.25, 2.25], [2, 3, 3.25, 2.25],
  [3, 0, 0, 3.5, 'round'], [3, 1, 1.25, 3.25], [3, 2, 2.25, 3.25], [3, 3, 3.5, 3.5, 'round'],
];
const KNOB_KEY = [[0, 0], [0, 3]]; // encoder id -> matrix position of its push switch
const keyName = (r, c) => {
  const i = LAYOUT.findIndex(([rr, cc]) => rr === r && cc === c);
  const kind = LAYOUT[i][4];
  if (kind === 'round') return c === 0 ? 'Bottom-left button' : 'Bottom-right button';
  return `Key ${LAYOUT.filter((l) => !l[4]).findIndex(([rr, cc]) => rr === r && cc === c) + 1}`;
};

// ---- state ------------------------------------------------------------------
const S = {
  via: null, layers: 0, layer: 0, keymap: [], enc: null, macros: [], macroSize: 0, demo: false,
  sel: { kind: 'key', r: 1, c: 0 }, mods: 0, cat: 'figma', query: '', recording: false,
};

// ---- toast / status ---------------------------------------------------------
let toastTimer;
function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), bad ? 4000 : 1800);
}
function status(state, text) {
  $('#status').dataset.state = state;
  $('#status span').textContent = text;
}

// ---- connect ----------------------------------------------------------------
async function load(via, demo = false) {
  status('busy', 'Reading…');
  try {
    S.via = via; S.demo = demo;
    S.layers = await via.layerCount();
    S.keymap = await via.keymap(S.layers);
    try {
      S.enc = [];
      for (let l = 0; l < S.layers; l++) {
        S.enc.push([]);
        for (let e = 0; e < MICRO.encoders; e++) S.enc[l].push([await via.encoder(l, e, 0), await via.encoder(l, e, 1)]);
      }
    } catch { S.enc = null; } // firmware without encoder map support: knobs are press-only
    try {
      const count = await via.macroCount();
      S.macroSize = await via.macroBufferSize();
      S.macros = parseBuffer(await via.macroBuffer(S.macroSize), count);
    } catch { S.macros = []; }
    await loadLighting();
  } catch (err) {
    console.error(err);
    status('off', 'Not connected');
    toast('Couldn’t read the Micro: ' + err.message, true);
    S.via = null;
    return;
  }
  S.layer = 0;
  $('#app').dataset.mode = 'edit';
  S.label = demo ? 'Demo device' : `${via.device.productName || 'Creator Micro'} · VIA v${via.proto}`;
  status('on', S.label);
  for (const id of ['#exportBtn', '#importBtn', '#disconnectBtn']) $(id).hidden = false;
  renderAll();
  renderDevice(true);
}

$('#connectBtn').onclick = async () => {
  if (!Via.supported()) return toast('This browser can’t access USB devices. Try Chrome or Edge.', true);
  try {
    const via = await Via.request();
    if (via) await load(via);
  } catch (err) {
    toast(err.message.includes('open') ? 'The Micro is busy. Close other VIA tabs/apps and try again.' : err.message, true);
  }
};
$('#demoBtn').onclick = async () => load(await Via.open(new MockMicro()), true);
$('#disconnectBtn').onclick = disconnect;
function disconnect() {
  if (S.via && !S.demo) S.via.device.close().catch(() => {});
  S.via = null;
  $('#app').dataset.mode = 'landing';
  status('off', 'Not connected');
  for (const id of ['#exportBtn', '#importBtn', '#disconnectBtn']) $(id).hidden = true;
  renderDevice();
}
if (!Via.supported()) { $('#hidNote').hidden = false; $('#connectBtn').disabled = true; }
else {
  navigator.hid.addEventListener('disconnect', (e) => {
    if (S.via && e.device === S.via.device) { disconnect(); toast('Micro unplugged', true); }
  });
  Via.reconnect().then((v) => v && load(v)).catch(() => {});
}

// ---- assignments ------------------------------------------------------------
function current() {
  const s = S.sel;
  if (s.kind === 'enc') {
    if (s.slot === 'press') return S.keymap[S.layer][KNOB_KEY[s.e][0]][KNOB_KEY[s.e][1]];
    return S.enc[S.layer][s.e][s.slot === 'cw' ? 1 : 0];
  }
  return S.keymap[S.layer][s.r][s.c];
}

async function assign(code) {
  if (!S.via) return;
  const s = S.sel, l = S.layer, prev = current();
  try {
    if (s.kind === 'enc' && s.slot !== 'press') {
      const dir = s.slot === 'cw' ? 1 : 0;
      S.enc[l][s.e][dir] = code; renderAll();
      await S.via.setEncoder(l, s.e, dir, code);
    } else {
      const [r, c] = s.kind === 'enc' ? KNOB_KEY[s.e] : [s.r, s.c];
      S.keymap[l][r][c] = code; renderAll();
      await S.via.setKey(l, r, c, code);
    }
    toast(`${describe(code, macroNames()).label} saved`);
  } catch (err) {
    // put the old value back so the screen matches the device
    if (s.kind === 'enc' && s.slot !== 'press') S.enc[l][s.e][s.slot === 'cw' ? 1 : 0] = prev;
    else { const [r, c] = s.kind === 'enc' ? KNOB_KEY[s.e] : [s.r, s.c]; S.keymap[l][r][c] = prev; }
    renderAll();
    toast('Couldn’t save: ' + err.message, true);
  }
}

const macroNames = () => S.macros.map((m, i) => (m ? `M${i + 1} · ${m.replace(/\{[^}]*\}/g, '…').slice(0, 14)}` : ''));

// ---- rendering -----------------------------------------------------------------
function layer(n) { S.layer = n; renderAll(); }

function renderLayers() {
  $('#layers').replaceChildren(...Array.from({ length: S.layers }, (_, i) =>
    h('button', { role: 'tab', 'aria-selected': String(i === S.layer), onclick: () => layer(i) }, `Layer ${i + 1}`)));
}

function renderDevice(intro = false) {
  const dev = $('#device');
  if (intro) { dev.classList.add('intro'); setTimeout(() => dev.classList.remove('intro'), 900); }
  const names = macroNames();
  const live = S.via && S.keymap.length;
  dev.replaceChildren(...LAYOUT.map(([r, c, x, y, kind], i) => {
    const style = `left: calc(var(--u) * ${x + 0.4}); top: calc(var(--u) * ${y + 0.4}); animation-delay: ${i * 22}ms`;
    const code = live ? S.keymap[S.layer][r][c] : null;
    const d = code == null ? { label: '' } : describe(code, names);
    const label = code === 1 ? '▽' : code === 0 ? '' : d.label;
    if (kind === 'knob') {
      const e = c === 0 ? 0 : 1;
      const sel = !!live && S.sel.kind === 'enc' && S.sel.e === e;
      return h('button', { class: 'knob', style, 'aria-pressed': String(sel), 'aria-label': `Knob ${e + 1}`, title: `Knob ${e + 1}`,
        onclick: () => select({ kind: 'enc', e, slot: S.enc ? 'cw' : 'press' }) }, h('span', {}, label));
    }
    const sel = !!live && S.sel.kind === 'key' && S.sel.r === r && S.sel.c === c;
    return h('button', {
      class: 'key' + (kind === 'round' ? ' btn-round' : '') + (code <= 1 ? ' dim' : ''), style, 'data-kind': d.kind,
      'aria-pressed': String(sel), 'aria-label': `${keyName(r, c)}: ${d.label || 'empty'}`, title: keyName(r, c),
      onclick: () => select({ kind: 'key', r, c }),
    }, h('span', { class: 'k-label' }, label));
  }));
}

function select(sel) {
  S.sel = sel;
  stopRecording();
  renderAll();
}

function renderInspector() {
  const code = current();
  const d = describe(code, macroNames());
  const s = S.sel;
  const title = s.kind === 'enc' ? `Knob ${s.e + 1}` : keyName(s.r, s.c);
  const what = { 'press': 'Press', 'cw': 'Turn right', 'ccw': 'Turn left' }[s.slot];
  const nice = code === 0 ? 'Does nothing' : code === 1 ? 'Uses the layer below' : explain(code, d);
  const kids = [
    h('div', { class: 'cap' }, code === 1 ? '▽' : d.label),
    h('div', { class: 'what' },
      h('div', { class: 'eyebrow' }, `${title}${what ? ' · ' + what : ''} · Layer ${S.layer + 1}`),
      h('h3', {}, nice),
      h('div', { class: 'sub' }, hex(code)))];
  if (s.kind === 'enc') {
    const slot = (id, label, c) => h('button', { class: 'slot', 'aria-pressed': String(s.slot === id), onclick: () => select({ ...s, slot: id }) },
      h('small', {}, label), h('b', {}, describe(c, macroNames()).label));
    const [kr, kc] = KNOB_KEY[s.e];
    kids.push(h('div', { class: 'slots' },
      S.enc ? slot('ccw', '↺ Turn left', S.enc[S.layer][s.e][0]) : null,
      S.enc ? slot('cw', '↻ Turn right', S.enc[S.layer][s.e][1]) : null,
      slot('press', '● Press', S.keymap[S.layer][kr][kc])));
  }
  $('#inspector').replaceChildren(...kids);
  $('#inspector').hidden = false;
}

function explain(code, d) {
  if (d.kind === 'layer' && d.fn) {
    const n = d.layer + 1;
    return { MO: `Hold to use layer ${n}`, TG: `Toggle layer ${n} on/off`, TO: `Switch to layer ${n}`, OSL: `Next key uses layer ${n}`, TT: `Hold or double-tap for layer ${n}`, DF: `Make layer ${n} the default` }[d.fn];
  }
  if (d.kind === 'modtap') return `Tap: ${describe(code & 0xff).label} · Hold: ${modLabel((code >> 8) & 0x1f)}`;
  if (d.kind === 'macro') return `Runs macro ${code - MACRO_BASE + 1}`;
  if (d.kind === 'unknown') return 'Custom firmware code';
  return d.label;
}

// ---- picker -------------------------------------------------------------------
const CATS = [
  ['figma', 'Figma'], ['basic', 'Keys'], ['media', 'Media'], ['layers', 'Layers'],
  ['macros', 'Macros'], ['mouse', 'Mouse'], ['lighting', 'Lights'], ['special', 'Special'],
];
const MODS = isMac
  ? [[MOD.GUI, '⌘ Cmd'], [MOD.SHIFT, '⇧ Shift'], [MOD.ALT, '⌥ Opt'], [MOD.CTRL, '⌃ Ctrl']]
  : [[MOD.CTRL, 'Ctrl'], [MOD.SHIFT, 'Shift'], [MOD.ALT, 'Alt'], [MOD.GUI, 'Win']];

function renderMods() {
  $('#mods').replaceChildren(...MODS.map(([bit, label]) => h('button', {
    'aria-pressed': String(!!(S.mods & bit)),
    onclick: () => {
      S.mods ^= bit;
      const c = current();
      if (c >= 4 && c <= 0x1fff && (c & 0xff) < 0xe0) assign(withMods(S.mods, c & 0xff)); // re-apply to a plain key
      else renderMods();
    },
  }, label)));
}

function items() {
  const names = macroNames();
  const out = [];
  const group = (title) => out.push({ group: title });
  if (S.query) {
    const q = S.query.toLowerCase();
    const all = [
      ...figmaPresets().map((p) => ({ ...p, sub: 'Figma · ' + describe(p.code).label })),
      ...KEYS.map((k) => ({ code: k.code, label: k.label, sub: k.id })),
      ...layerItems(), ...macroItems(names),
    ];
    return all.filter((i) => (i.label + ' ' + (i.sub || '')).toLowerCase().includes(q)).slice(0, 80);
  }
  switch (S.cat) {
    case 'figma': return figmaPresets().map((p) => ({ ...p, sub: describe(p.code).label }));
    case 'basic':
      for (const [t, f] of [['Letters & numbers', (k) => k.code <= 0x27], ['Editing & navigation', (k) => (k.code >= 0x28 && k.code <= 0x39) || (k.code >= 0x46 && k.code <= 0x52) || k.code === 0x65 || k.code === 0x64],
        ['Modifiers', (k) => k.code >= 0xe0], ['Function keys', (k) => (k.code >= 0x3a && k.code <= 0x45) || (k.code >= 0x68 && k.code <= 0x73)], ['Numpad', (k) => k.code >= 0x53 && k.code <= 0x63]]) {
        group(t);
        out.push(...KEYS.filter((k) => k.cat === 'basic' && f(k)).map((k) => ({ code: withMods(S.mods, k.code), label: k.label, sub: S.mods ? modLabel(S.mods) : k.id })));
      }
      return out;
    case 'layers': return layerItems(true);
    case 'macros': return macroItems(names);
    default: return KEYS.filter((k) => k.cat === S.cat).map((k) => ({ code: k.code, label: k.label, sub: k.id }));
  }
}
function layerItems(grouped) {
  const out = [];
  for (const [fn, { base, name }] of Object.entries(LAYER_FN)) {
    if (grouped) out.push({ group: name });
    for (let l = 0; l < S.layers; l++) out.push({ code: base + l, label: `${name} layer ${l + 1}`, sub: `${fn}(${l})` });
  }
  return out;
}
function macroItems(names) {
  if (!S.macros.length) return [{ empty: 'This firmware doesn’t expose macros.' }];
  return S.macros.map((m, i) => ({ code: MACRO_BASE + i, label: `Macro ${i + 1}`, sub: m ? m.slice(0, 22) : 'empty — edit in Macros tab' }));
}

function renderPicker() {
  $('#cats').replaceChildren(...CATS.map(([id, label]) => h('button', {
    'aria-pressed': String(!S.query && S.cat === id), onclick: () => { S.cat = id; S.query = ''; $('#search').value = ''; renderPicker(); },
  }, label)));
  const cur = current();
  const list = items();
  const grid = $('#grid');
  grid.classList.toggle('wide', ['figma', 'layers', 'macros', 'lighting', 'media'].includes(S.cat) || !!S.query);
  grid.replaceChildren(...(list.length ? list : [{ empty: 'Nothing matches. Try “Record a shortcut” instead.' }]).map((it) =>
    it.group ? h('h4', {}, it.group)
      : it.empty ? h('div', { class: 'empty' }, it.empty)
        : h('button', { class: 'tile', 'aria-current': String(it.code === cur), title: hex(it.code), onclick: () => assign(it.code) },
          it.label, it.sub ? h('small', {}, it.sub) : null)));
  renderMods();
}

function renderAll() {
  if (!S.via) return renderDevice();
  renderLayers(); renderDevice(); renderInspector(); renderPicker();
}

$('#search').addEventListener('input', (e) => { S.query = e.target.value.trim(); renderPicker(); });

// ---- shortcut recorder -----------------------------------------------------------
const recBtn = $('#recordBtn');
let recTarget = null; // null = assign to key; function = callback (macro editor)
function startRecording(target = null) {
  S.recording = true; recTarget = target;
  recBtn.classList.add('listening');
  recBtn.querySelector('.rec-text').textContent = 'Listening… press a shortcut';
  recBtn.querySelector('.rec-sub').textContent = 'Click anywhere to cancel';
}
function stopRecording() {
  S.recording = false; recTarget = null;
  recBtn.classList.remove('listening');
  recBtn.querySelector('.rec-text').textContent = 'Record a shortcut';
  recBtn.querySelector('.rec-sub').textContent = 'Click, then press keys on your keyboard';
}
recBtn.onclick = (e) => { e.stopPropagation(); S.recording ? stopRecording() : startRecording(); };
document.addEventListener('click', () => S.recording && stopRecording());

const modBit = (e) => (e.ctrlKey ? MOD.CTRL : 0) | (e.shiftKey ? MOD.SHIFT : 0) | (e.altKey ? MOD.ALT : 0) | (e.metaKey ? MOD.GUI : 0);
const MOD_KEYS = { ControlLeft: 1, ControlRight: 1, ShiftLeft: 2, ShiftRight: 2, AltLeft: 4, AltRight: 4, MetaLeft: 8, MetaRight: 8 };
let lastMods = 0;
window.addEventListener('keydown', (e) => {
  if (!S.recording) return;
  e.preventDefault(); e.stopPropagation();
  if (MOD_KEYS[e.code]) {
    lastMods = modBit(e);
    recBtn.querySelector('.rec-text').textContent = modLabel(lastMods, ' ') + ' + …';
    return;
  }
  const hid = byDomCode.get(e.code);
  if (!hid) return toast(`Can’t map “${e.key}”. Pick it from the list instead.`, true);
  finishRecording(withMods(modBit(e), hid));
}, true);
window.addEventListener('keyup', (e) => {
  if (!S.recording || !MOD_KEYS[e.code]) return;
  e.preventDefault();
  // only modifiers were pressed and released: assign the modifier itself
  if (modBit(e) === 0 && lastMods) {
    const bits = lastMods;
    const first = [1, 2, 4, 8].find((b) => bits & b);
    const base = { 1: 0xe0, 2: 0xe1, 4: 0xe2, 8: 0xe3 }[first];
    finishRecording(withMods(bits & ~first, base));
  }
}, true);
function finishRecording(code) {
  const target = recTarget;
  lastMods = 0;
  stopRecording();
  target ? target(code) : assign(code);
}

// ---- macros tab --------------------------------------------------------------------
let macroDraft = [];
function renderMacros() {
  macroDraft = [...S.macros];
  const list = $('#macroList');
  if (!S.macros.length) { list.replaceChildren(h('p', { class: 'help' }, 'This firmware doesn’t support macros.')); return; }
  list.replaceChildren(...macroDraft.map((m, i) => {
    const ta = h('textarea', { rows: 2, spellcheck: 'false', placeholder: 'e.g. Thanks!{Enter}' });
    ta.value = m;
    ta.oninput = () => { macroDraft[i] = ta.value; validateMacros(); };
    const insert = h('button', { onclick: (e) => {
      e.stopPropagation();
      startRecording((code) => {
        const mods = (code >> 8) & 0x1f, base = code & 0xff;
        const names = [];
        if (mods & MOD.CTRL) names.push('Ctrl');
        if (mods & MOD.SHIFT) names.push('Shift');
        if (mods & MOD.ALT) names.push(isMac ? 'Opt' : 'Alt');
        if (mods & MOD.GUI) names.push(isMac ? 'Cmd' : 'Win');
        const k = KEYS.find((k) => k.code === base);
        names.push(k ? (k.id.length > 1 ? k.id[0] + k.id.slice(1).toLowerCase() : k.id) : '');
        const pos = ta.selectionStart ?? ta.value.length;
        ta.value = ta.value.slice(0, pos) + `{${names.join('+')}}` + ta.value.slice(pos);
        ta.dispatchEvent(new Event('input'));
        ta.focus();
      });
      toast('Press the shortcut to insert');
    } }, '+ Insert shortcut');
    return h('div', { class: 'macro', 'data-i': i }, h('header', {}, h('b', {}, `Macro ${i + 1}`), insert), ta);
  }));
  validateMacros();
}
function validateMacros() {
  let err = '';
  document.querySelectorAll('.macro').forEach((el, i) => {
    try { encode(macroDraft[i]); el.classList.remove('bad'); } catch (e) { el.classList.add('bad'); err ||= `Macro ${i + 1}: ${e.message}`; }
  });
  let used = 0;
  try { used = macroDraft.reduce((n, t) => n + encode(t).length + 1, 0); } catch {}
  if (!err && used > S.macroSize) err = `Too long: ${used} / ${S.macroSize} bytes`;
  $('#macroMeter').textContent = `${used} / ${S.macroSize} bytes`;
  $('#macroErr').textContent = err;
  $('#macroSave').disabled = !!err || macroDraft.every((m, i) => m === S.macros[i]);
}
$('#macroSave').onclick = async () => {
  try {
    status('busy', 'Saving…');
    await S.via.writeMacroBuffer(buildBuffer(macroDraft, S.macroSize));
    S.macros = [...macroDraft];
    toast('Macros saved to the Micro');
  } catch (e) { toast('Couldn’t save macros: ' + e.message, true); }
  status('on', S.label);
  validateMacros(); renderPicker(); renderDevice();
};

// ---- lighting tab ---------------------------------------------------------------------
const UG_FX = ['All Off', 'Solid Color', 'Breathing 1', 'Breathing 2', 'Breathing 3', 'Breathing 4', 'Rainbow Mood 1', 'Rainbow Mood 2', 'Rainbow Mood 3', 'Rainbow Swirl 1', 'Rainbow Swirl 2', 'Rainbow Swirl 3', 'Rainbow Swirl 4', 'Rainbow Swirl 5', 'Rainbow Swirl 6', 'Snake 1', 'Snake 2', 'Snake 3', 'Snake 4', 'Snake 5', 'Snake 6', 'Knight 1', 'Knight 2', 'Knight 3', 'Christmas', 'Gradient 1', 'Gradient 2', 'Gradient 3', 'Gradient 4', 'Gradient 5', 'Gradient 6', 'Gradient 7', 'Gradient 8', 'Gradient 9', 'Gradient 10', 'RGB Test', 'Alternating', 'Twinkle 1', 'Twinkle 2', 'Twinkle 3', 'Twinkle 4', 'Twinkle 5', 'Twinkle 6'];
const RM_FX = ['All Off', 'Solid Color', 'Alphas Mods', 'Gradient Up/Down', 'Gradient Left/Right', 'Breathing', 'Band Sat.', 'Band Val.', 'Pinwheel Sat.', 'Pinwheel Val.', 'Spiral Sat.', 'Spiral Val.', 'Cycle All', 'Cycle Left/Right', 'Cycle Up/Down', 'Rainbow Moving Chevron', 'Cycle Out/In', 'Cycle Out/In Dual', 'Cycle Pinwheel', 'Cycle Spiral', 'Dual Beacon', 'Rainbow Beacon', 'Rainbow Pinwheels', 'Raindrops', 'Jellybean Raindrops', 'Hue Breathing', 'Hue Pendulum', 'Hue Wave', 'Pixel Rain', 'Pixel Flow', 'Pixel Fractal', 'Typing Heatmap', 'Digital Rain'];
const ZONES = [
  { ch: 3, title: 'Key lights', fx: RM_FX, speedMax: 255 },
  { ch: 2, title: 'Underglow', fx: UG_FX, speedMax: 3 },
];
let light = null; // { [ch]: { 1: bright, 2: effect, 3: speed, 4: [h, s] } }, plus indicator

async function loadLighting() {
  light = {};
  for (const z of ZONES) {
    try {
      const v = {};
      for (const id of [1, 2, 3]) v[id] = (await S.via.getValue(z.ch, id))[0];
      v[4] = [...(await S.via.getValue(z.ch, 4, 2))];
      light[z.ch] = v;
    } catch { /* zone not exposed by this firmware */ }
  }
  try { light.ind = (await S.via.getValue(0, 1))[0]; } catch {}
}

const hsvToHex = (h, s) => {
  h = (h / 255) * 360; s /= 255;
  const f = (n) => { const k = (n + h / 60) % 6; return Math.round(255 * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)))); };
  return '#' + [f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, '0')).join('');
};
const hexToHs = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round((((h * 60) + 360) % 360) / 360 * 255), Math.round(max ? (d / max) * 255 : 0)];
};

const saveTimers = {};
async function setLight(ch, id, ...data) {
  try {
    await S.via.setValue(ch, id, ...data);
    clearTimeout(saveTimers[ch]);
    saveTimers[ch] = setTimeout(() => S.via?.saveValues(ch).catch(() => {}), 600); // persist once dragging stops
  } catch (e) { toast('Lighting change failed: ' + e.message, true); }
}

function renderLighting() {
  const root = $('#lighting');
  if (!light || (!Object.keys(light).length)) { root.replaceChildren(h('p', { class: 'help' }, 'This firmware doesn’t expose lighting controls.')); return; }
  const out = [];
  for (const z of ZONES) {
    const v = light[z.ch];
    if (!v) continue;
    const on = v[2] !== 0;
    const color = hsvToHex(v[4][0], v[4][1]);
    const range = (id, max, label) => h('label', { class: 'field' }, label, h('input', {
      type: 'range', min: 0, max, value: v[id],
      oninput: (e) => { v[id] = +e.target.value; setLight(z.ch, id, v[id]); },
    }));
    out.push(h('section', { class: 'light' },
      h('h2', {}, h('span', { class: 'swatch', style: `background:${on ? color : 'transparent'}` }), z.title),
      h('label', { class: 'field' }, 'Effect', h('select', {
        onchange: (e) => { v[2] = +e.target.value; setLight(z.ch, 2, v[2]); renderLighting(); },
      }, z.fx.map((name, i) => h('option', { value: i, selected: i === v[2] }, name)))),
      range(1, 255, 'Brightness'),
      on ? range(3, z.speedMax, 'Speed') : null,
      on ? h('label', { class: 'field' }, 'Color', h('input', {
        type: 'color', value: color,
        oninput: (e) => { v[4] = hexToHs(e.target.value); setLight(z.ch, 4, ...v[4]); e.target.closest('.light').querySelector('.swatch').style.background = e.target.value; },
      })) : null));
  }
  if (light.ind !== undefined) {
    out.push(h('section', { class: 'light' }, h('h2', {}, 'Layer indicators'),
      h('label', { class: 'field' }, 'Brightness', h('input', {
        type: 'range', min: 0, max: 5, value: light.ind,
        oninput: (e) => { light.ind = +e.target.value; setLight(0, 1, light.ind); },
      }))));
  }
  root.replaceChildren(...out);
}

// ---- tabs ---------------------------------------------------------------------------
document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  document.querySelectorAll('.tab').forEach((t) => (t.hidden = t.dataset.tab !== b.dataset.tab));
  if (b.dataset.tab === 'macros') renderMacros();
  if (b.dataset.tab === 'lighting') renderLighting();
}));

// ---- backup ---------------------------------------------------------------------------
$('#exportBtn').onclick = () => {
  const data = { app: 'micro-config', version: 1, keymap: S.keymap, encoders: S.enc, macros: S.macros, lighting: light };
  const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })), download: 'creator-micro-config.json' });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('#importBtn input').onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (d.app !== 'micro-config' || !Array.isArray(d.keymap)) throw new Error('not a Micro Config backup');
    status('busy', 'Restoring…');
    for (let l = 0; l < Math.min(S.layers, d.keymap.length); l++)
      for (let r = 0; r < MICRO.rows; r++)
        for (let c = 0; c < MICRO.cols; c++) {
          const code = d.keymap[l]?.[r]?.[c];
          if (Number.isInteger(code) && code !== S.keymap[l][r][c]) { await S.via.setKey(l, r, c, code); S.keymap[l][r][c] = code; }
        }
    if (S.enc && Array.isArray(d.encoders))
      for (let l = 0; l < S.layers; l++) for (let en = 0; en < MICRO.encoders; en++) for (const dir of [0, 1]) {
        const code = d.encoders[l]?.[en]?.[dir];
        if (Number.isInteger(code)) { await S.via.setEncoder(l, en, dir, code); S.enc[l][en][dir] = code; }
      }
    if (S.macros.length && Array.isArray(d.macros)) {
      const texts = S.macros.map((_, i) => String(d.macros[i] ?? ''));
      await S.via.writeMacroBuffer(buildBuffer(texts, S.macroSize));
      S.macros = texts;
    }
    if (light && d.lighting) {
      for (const z of ZONES) {
        const v = d.lighting[z.ch];
        if (!v || !light[z.ch]) continue;
        for (const id of [1, 2, 3]) await S.via.setValue(z.ch, id, v[id] & 0xff);
        await S.via.setValue(z.ch, 4, v[4][0] & 0xff, v[4][1] & 0xff);
        await S.via.saveValues(z.ch);
        light[z.ch] = v;
      }
    }
    toast('Backup restored');
  } catch (err) { toast('Import failed: ' + err.message, true); }
  status('on', S.label);
  renderAll();
};

renderDevice(true);
