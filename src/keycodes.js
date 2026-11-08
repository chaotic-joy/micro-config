// QMK keycodes (VIA "v12" numbering, used by VIA protocol >= 11).
// Everything inside the app is v12; via.js translates for older firmware.

export const isMac = /Mac|iPhone|iPad/.test(navigator?.platform ?? '') || /Mac OS/.test(navigator?.userAgent ?? '');

// ---- Basic HID keys ------------------------------------------------------
// [hid, qmk name, label, KeyboardEvent.code]
const BASIC = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c, i) => [0x04 + i, c, c, 'Key' + c]),
  ...'1234567890'.split('').map((c, i) => [0x1e + i, c, c, 'Digit' + c]),
  [0x28, 'ENTER', 'Enter', 'Enter'], [0x29, 'ESC', 'Esc', 'Escape'], [0x2a, 'BSPC', 'Backspace', 'Backspace'],
  [0x2b, 'TAB', 'Tab', 'Tab'], [0x2c, 'SPACE', 'Space', 'Space'], [0x2d, 'MINUS', '-', 'Minus'],
  [0x2e, 'EQUAL', '=', 'Equal'], [0x2f, 'LBRC', '[', 'BracketLeft'], [0x30, 'RBRC', ']', 'BracketRight'],
  [0x31, 'BSLS', '\\', 'Backslash'], [0x33, 'SCLN', ';', 'Semicolon'], [0x34, 'QUOT', "'", 'Quote'],
  [0x35, 'GRV', '`', 'Backquote'], [0x36, 'COMMA', ',', 'Comma'], [0x37, 'DOT', '.', 'Period'],
  [0x38, 'SLASH', '/', 'Slash'], [0x39, 'CAPS', 'Caps Lock', 'CapsLock'],
  ...Array.from({ length: 12 }, (_, i) => [0x3a + i, 'F' + (i + 1), 'F' + (i + 1), 'F' + (i + 1)]),
  [0x46, 'PSCR', 'Print Scr', 'PrintScreen'], [0x47, 'SCRL', 'Scroll Lock', 'ScrollLock'], [0x48, 'PAUS', 'Pause', 'Pause'],
  [0x49, 'INS', 'Insert', 'Insert'], [0x4a, 'HOME', 'Home', 'Home'], [0x4b, 'PGUP', 'Page Up', 'PageUp'],
  [0x4c, 'DEL', 'Delete', 'Delete'], [0x4d, 'END', 'End', 'End'], [0x4e, 'PGDN', 'Page Down', 'PageDown'],
  [0x4f, 'RIGHT', '→', 'ArrowRight'], [0x50, 'LEFT', '←', 'ArrowLeft'], [0x51, 'DOWN', '↓', 'ArrowDown'], [0x52, 'UP', '↑', 'ArrowUp'],
  [0x53, 'NUM', 'Num Lock', 'NumLock'], [0x54, 'PSLS', 'Num /', 'NumpadDivide'], [0x55, 'PAST', 'Num *', 'NumpadMultiply'],
  [0x56, 'PMNS', 'Num -', 'NumpadSubtract'], [0x57, 'PPLS', 'Num +', 'NumpadAdd'], [0x58, 'PENT', 'Num Enter', 'NumpadEnter'],
  ...'123456789'.split('').map((c, i) => [0x59 + i, 'P' + c, 'Num ' + c, 'Numpad' + c]),
  [0x62, 'P0', 'Num 0', 'Numpad0'], [0x63, 'PDOT', 'Num .', 'NumpadDecimal'],
  [0x64, 'NUBS', 'ISO \\', 'IntlBackslash'], [0x65, 'APP', 'Menu', 'ContextMenu'],
  ...Array.from({ length: 12 }, (_, i) => [0x68 + i, 'F' + (i + 13), 'F' + (i + 13), 'F' + (i + 13)]),
  // modifiers as standalone keys
  [0xe0, 'LCTL', isMac ? '⌃ Ctrl' : 'Ctrl', 'ControlLeft'], [0xe1, 'LSFT', isMac ? '⇧ Shift' : 'Shift', 'ShiftLeft'],
  [0xe2, 'LALT', isMac ? '⌥ Opt' : 'Alt', 'AltLeft'], [0xe3, 'LGUI', isMac ? '⌘ Cmd' : 'Win', 'MetaLeft'],
  [0xe4, 'RCTL', isMac ? 'R ⌃' : 'R Ctrl', 'ControlRight'], [0xe5, 'RSFT', isMac ? 'R ⇧' : 'R Shift', 'ShiftRight'],
  [0xe6, 'RALT', isMac ? 'R ⌥' : 'R Alt', 'AltRight'], [0xe7, 'RGUI', isMac ? 'R ⌘' : 'R Win', 'MetaRight'],
];

const MEDIA = [
  [0xae, 'MPLY', 'Play / Pause', 'MediaPlayPause'], [0xab, 'MNXT', 'Next Track', 'MediaTrackNext'],
  [0xac, 'MPRV', 'Prev Track', 'MediaTrackPrevious'], [0xad, 'MSTP', 'Stop', 'MediaStop'],
  [0xa9, 'VOLU', 'Volume Up', 'AudioVolumeUp'], [0xaa, 'VOLD', 'Volume Down', 'AudioVolumeDown'],
  [0xa8, 'MUTE', 'Mute', 'AudioVolumeMute'], [0xbd, 'BRIU', 'Brightness +'], [0xbe, 'BRID', 'Brightness −'],
  [0xbb, 'MFFD', 'Fast Fwd'], [0xbc, 'MRWD', 'Rewind'], [0xc1, 'MCTL', 'Mission Ctrl'], [0xc2, 'LPAD', 'Launchpad'],
  [0xb2, 'CALC', 'Calculator'], [0xb6, 'WBAK', 'Browser Back'], [0xb7, 'WFWD', 'Browser Fwd'],
  [0xa6, 'SLEP', 'Sleep'],
];

const MOUSE = [
  [0xcd, 'MS_U', 'Mouse ↑'], [0xce, 'MS_D', 'Mouse ↓'], [0xcf, 'MS_L', 'Mouse ←'], [0xd0, 'MS_R', 'Mouse →'],
  [0xd1, 'BTN1', 'Left Click'], [0xd2, 'BTN2', 'Right Click'], [0xd3, 'BTN3', 'Middle Click'],
  [0xd4, 'BTN4', 'Mouse Back'], [0xd5, 'BTN5', 'Mouse Fwd'],
  [0xd9, 'WH_U', 'Scroll ↑'], [0xda, 'WH_D', 'Scroll ↓'], [0xdb, 'WH_L', 'Scroll ←'], [0xdc, 'WH_R', 'Scroll →'],
];

const LIGHTING = [
  [0x7820, 'UG_TOGG', 'Underglow On/Off'], [0x7821, 'UG_NEXT', 'Underglow Effect +'], [0x7822, 'UG_PREV', 'Underglow Effect −'],
  [0x7823, 'UG_HUEU', 'Underglow Hue +'], [0x7824, 'UG_HUED', 'Underglow Hue −'], [0x7827, 'UG_VALU', 'Underglow Bright +'],
  [0x7828, 'UG_VALD', 'Underglow Bright −'], [0x7829, 'UG_SPDU', 'Underglow Speed +'], [0x782a, 'UG_SPDD', 'Underglow Speed −'],
  // Creator Micro custom keycodes (QK_KB_n), from the official VIA definition
  [0x7e00, 'RM_TOGG', 'Keys Light On/Off'], [0x7e01, 'RM_NEXT', 'Keys Effect +'], [0x7e02, 'RM_PREV', 'Keys Effect −'],
  [0x7e03, 'RM_HUEU', 'Keys Hue +'], [0x7e04, 'RM_HUED', 'Keys Hue −'], [0x7e05, 'RM_SATU', 'Keys Sat +'],
  [0x7e06, 'RM_SATD', 'Keys Sat −'], [0x7e07, 'RM_VALU', 'Keys Bright +'], [0x7e08, 'RM_VALD', 'Keys Bright −'],
  [0x7e09, 'LED_LVL', 'Indicator Level'],
];

const SPECIAL = [
  [0x0000, 'NO', 'Nothing'], [0x0001, 'TRNS', 'Pass-through'], [0x7c00, 'QK_BOOT', 'Bootloader'],
];

const tbl = (rows, cat) => rows.map(([code, id, label, dom]) => ({ code, id, label, dom, cat }));
export const KEYS = [
  ...tbl(BASIC, 'basic'), ...tbl(MEDIA, 'media'), ...tbl(MOUSE, 'mouse'),
  ...tbl(LIGHTING, 'lighting'), ...tbl(SPECIAL, 'special'),
];
const byCode = new Map(KEYS.map((k) => [k.code, k]));
export const byDomCode = new Map(KEYS.filter((k) => k.dom).map((k) => [k.dom, k.code]));

// ---- Modifiers -----------------------------------------------------------
// 5-bit mod mask: 1 Ctrl, 2 Shift, 4 Alt, 8 GUI, 0x10 = right-hand variant
export const MOD = { CTRL: 1, SHIFT: 2, ALT: 4, GUI: 8 };
export function modLabel(m, sep = '') {
  const parts = isMac
    ? [[MOD.CTRL, '⌃'], [MOD.ALT, '⌥'], [MOD.SHIFT, '⇧'], [MOD.GUI, '⌘']]
    : [[MOD.CTRL, 'Ctrl'], [MOD.SHIFT, 'Shift'], [MOD.ALT, 'Alt'], [MOD.GUI, 'Win']];
  return parts.filter(([b]) => m & b).map(([, s]) => s).join(isMac ? sep : '+');
}

// ---- Builders -------------------------------------------------------------
export const withMods = (mods, kc) => (mods ? ((mods & 0x1f) << 8) | (kc & 0xff) : kc);
export const LAYER_FN = {
  MO: { base: 0x5220, name: 'Hold for', short: 'Hold' },
  TG: { base: 0x5260, name: 'Toggle', short: 'Toggle' },
  TO: { base: 0x5200, name: 'Switch to', short: 'Go' },
  OSL: { base: 0x5280, name: 'Next key on', short: 'Once' },
  TT: { base: 0x52c0, name: 'Hold or tap-toggle', short: 'Tap/Hold' },
  DF: { base: 0x5240, name: 'Set default', short: 'Default' },
};
export const MACRO_BASE = 0x7700;

// ---- Decoding ---------------------------------------------------------------
// Returns { label, kind } for any 16-bit keycode.
export function describe(code, macroNames = []) {
  const k = byCode.get(code);
  if (k) return { label: k.label, kind: k.cat, id: k.id };
  if (code >= 0x0100 && code <= 0x1fff) {
    const base = byCode.get(code & 0xff);
    const mods = (code >> 8) & 0x1f;
    return { label: modLabel(mods) + (isMac ? '' : '+') + (base ? base.label : hex(code & 0xff)), kind: 'combo' };
  }
  if (code >= 0x2000 && code <= 0x3fff) {
    const base = byCode.get(code & 0xff);
    return { label: `${base ? base.label : hex(code & 0xff)} / ${modLabel((code >> 8) & 0x1f)}`, kind: 'modtap' };
  }
  if (code >= 0x4000 && code <= 0x4fff) {
    const base = byCode.get(code & 0xff);
    return { label: `${base ? base.label : hex(code & 0xff)} / L${((code >> 8) & 0xf) + 1}`, kind: 'layer' };
  }
  for (const [fn, { base, short }] of Object.entries(LAYER_FN)) {
    if (code >= base && code < base + 32) return { label: `${short} L${(code - base) + 1}`, kind: 'layer', fn, layer: code - base };
  }
  if (code >= MACRO_BASE && code < MACRO_BASE + 32) {
    const n = code - MACRO_BASE;
    return { label: macroNames[n] || `Macro ${n + 1}`, kind: 'macro' };
  }
  return { label: hex(code), kind: 'unknown' };
}
export const hex = (n) => '0x' + n.toString(16).toUpperCase().padStart(4, '0');

// Name lookup for macro tokens like {Cmd+Shift+K} / {Enter} / {F5}
const nameIdx = new Map();
for (const k of KEYS) {
  if (k.code > 0xff) continue;
  nameIdx.set(k.id.toLowerCase(), k.code);
  nameIdx.set(k.label.toLowerCase().replace(/^[⌃⇧⌥⌘] /, ''), k.code);
}
Object.entries({ return: 0x28, escape: 0x29, backspace: 0x2a, space: 0x2c, left: 0x50, right: 0x4f, up: 0x52, down: 0x51, del: 0x4c, delete: 0x4c, pgup: 0x4b, pgdn: 0x4e, cmd: 0xe3, command: 0xe3, win: 0xe3, gui: 0xe3, meta: 0xe3, ctrl: 0xe0, control: 0xe0, shift: 0xe1, alt: 0xe2, opt: 0xe2, option: 0xe2, play: 0xae, mute: 0xa8 })
  .forEach(([n, c]) => nameIdx.set(n, c));
nameIdx.set('⌘', 0xe3); nameIdx.set('⌃', 0xe0); nameIdx.set('⌥', 0xe2); nameIdx.set('⇧', 0xe1);
export const keyByName = (s) => nameIdx.get(s.trim().toLowerCase());
const PRETTY = { 0xe0: isMac ? 'Ctrl' : 'Ctrl', 0xe1: 'Shift', 0xe2: isMac ? 'Opt' : 'Alt', 0xe3: isMac ? 'Cmd' : 'Win' };
export const keyName = (hid) => {
  const id = PRETTY[hid] ?? byCode.get(hid)?.id ?? String(hid);
  return id.length > 1 && /^[A-Z]+$/.test(id) ? id[0] + id.slice(1).toLowerCase() : id;
};

// ---- Figma presets ------------------------------------------------------------
// [label, mods-with-"cmd", key]. "cmd" is GUI on Mac, Ctrl on Windows.
const C = 'cmd', S = MOD.SHIFT, A = MOD.ALT;
const FIGMA_RAW = [
  ['Undo', [C], 'Z'], ['Redo', [C, S], 'Z'], ['Duplicate', [C], 'D'], ['Group', [C], 'G'], ['Ungroup', [C, S], 'G'],
  ['Frame selection', [C, A], 'G'], ['Create component', [C, A], 'K'], ['Auto layout', [S], 'A'],
  ['Remove auto layout', [S, A], 'A'], ['Quick actions', [C], 'SLASH'], ['Toggle UI', [C], 'BSLS'],
  ['Move', [], 'V'], ['Frame', [], 'F'], ['Rectangle', [], 'R'], ['Ellipse', [], 'O'], ['Line', [], 'L'],
  ['Pen', [], 'P'], ['Text', [], 'T'], ['Comment', [], 'C'], ['Eyedropper', [], 'I'],
  ['Zoom to fit', [S], '1'], ['Zoom to selection', [S], '2'], ['Zoom 100%', [S], '0'], ['Zoom in', [C], 'EQUAL'], ['Zoom out', [C], 'MINUS'],
  ['Bring forward', [C], 'RBRC'], ['Send backward', [C], 'LBRC'], ['Flip horizontal', [S], 'H'], ['Flip vertical', [S], 'V'],
  ['Show / hide', [C, S], 'H'], ['Lock / unlock', [C, S], 'L'], ['Rename', [C], 'R'],
  ['Copy properties', [C, A], 'C'], ['Paste properties', [C, A], 'V'], ['Paste over', [C, S], 'V'],
  ['Align left', [A], 'A'], ['Align right', [A], 'D'], ['Align top', [A], 'W'], ['Align bottom', [A], 'S'],
  ['Center horizontally', [A], 'H'], ['Center vertically', [A], 'V'], ['Outline stroke', [C, A], 'O'],
  ['Export', [C, S], 'E'], ['Layers panel', [A], '1'], ['Assets panel', [A], '2'], ['Copy as PNG', [C, S], 'C'],
];
export function figmaPresets(mac = isMac) {
  return FIGMA_RAW.map(([label, mods, key]) => {
    const m = mods.reduce((a, x) => a | (x === C ? (mac ? MOD.GUI : MOD.CTRL) : x), 0);
    return { label, code: withMods(m, keyByName(key)) };
  });
}
