// Macro text <-> VIA macro buffer.
// Text syntax: literal text, plus {tokens}:
//   {Cmd+Shift+K}  press a shortcut      {Enter}  tap a key      {300ms}  wait
import { keyByName, keyName } from './keycodes.js';

const P = 0x01, TAP = 0x01, DOWN = 0x02, UP = 0x03, DELAY = 0x04;

// Returns bytes (no terminator) or throws Error with a friendly message.
export function encode(text) {
  const out = [];
  const re = /\{([^}]*)\}/g;
  let last = 0, m;
  const pushText = (s) => {
    for (const ch of s) {
      const c = ch.charCodeAt(0);
      if (c !== 10 && (c < 0x20 || c > 0x7e)) throw new Error(`“${ch}” can't be typed by a macro (plain ASCII only)`);
      out.push(c);
    }
  };
  while ((m = re.exec(text))) {
    pushText(text.slice(last, m.index));
    last = re.lastIndex;
    const tok = m[1].trim();
    const ms = tok.match(/^(\d+)\s*ms$/i);
    if (ms) { out.push(P, DELAY, ...String(+ms[1]).split('').map((d) => d.charCodeAt(0)), 0x7c); continue; }
    const parts = tok.split('+').map((s) => s.trim()).filter(Boolean);
    const codes = parts.map((p) => {
      const c = keyByName(p);
      if (c === undefined) throw new Error(`Unknown key “${p}” in {${tok}}`);
      return c;
    });
    if (!codes.length) throw new Error('Empty {} in macro');
    const key = codes[codes.length - 1];
    const mods = codes.slice(0, -1);
    mods.forEach((c) => out.push(P, DOWN, c));
    out.push(P, TAP, key);
    [...mods].reverse().forEach((c) => out.push(P, UP, c));
  }
  pushText(text.slice(last));
  return out;
}

export function decode(bytes) {
  let s = '', held = [], tapped = false;
  const chord = (keys) => `{${keys.map(keyName).join('+')}}`;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== P) { s += String.fromCharCode(bytes[i]); continue; }
    const act = bytes[++i];
    if (act === DELAY) {
      let n = '';
      while (i + 1 < bytes.length && bytes[++i] !== 0x7c) n += String.fromCharCode(bytes[i]);
      s += `{${n}ms}`;
    } else if (act === DOWN) {
      held.push(bytes[++i]);
      tapped = false;
    } else if (act === UP) {
      const k = bytes[++i];
      if (!tapped && held.includes(k)) { s += chord(held); tapped = true; } // bare modifier press
      held = held.filter((x) => x !== k);
    } else if (act === TAP) {
      s += chord([...held, bytes[++i]]);
      tapped = true;
    } else {
      i += 2; // ponytail: 16-bit actions (0x05-0x07) are skipped, not rendered
    }
  }
  return s;
}

// Split a raw buffer into `count` macro strings.
export function parseBuffer(buf, count) {
  const out = [];
  let start = 0;
  for (let i = 0; i < buf.length && out.length < count; i++) {
    if (buf[i] === 0) { out.push(decode(buf.slice(start, i))); start = i + 1; }
  }
  while (out.length < count) out.push('');
  return out;
}

export function buildBuffer(texts, size) {
  const bytes = texts.flatMap((t) => [...encode(t), 0]);
  if (bytes.length > size) throw new Error(`Macros use ${bytes.length} of ${size} bytes — shorten one`);
  return Uint8Array.from([...bytes, ...new Array(size - bytes.length).fill(0)]);
}
