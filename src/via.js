// VIA raw-HID protocol (32-byte reports on usage page 0xFF60).
export const MICRO = { vendorId: 0x574c, productId: 0xe6e3, rows: 4, cols: 4, encoders: 2 };
const FILTERS = [
  { vendorId: MICRO.vendorId, productId: MICRO.productId, usagePage: 0xff60, usage: 0x61 },
];

// Old firmware (VIA protocol <= 10) numbers some keycodes differently.
// [v10 start, v12 start, length]
const V10 = [
  [0x6000, 0x2000, 0x2000], // mod-tap
  [0x5010, 0x5200, 16], [0x5100, 0x5220, 32], [0x5200, 0x5240, 32], [0x5300, 0x5260, 32],
  [0x5400, 0x5280, 32], [0x5500, 0x52a0, 32], [0x5800, 0x52c0, 32], // layer keys
  [0x5f12, 0x7700, 32], [0x5f80, 0x7e00, 16], [0x5c00, 0x7c00, 1], // macros, custom, boot
  [0xf0, 0xcd, 4], [0xf4, 0xd1, 5], [0xf9, 0xd9, 4], [0xfd, 0xdd, 3], // mouse
];
// ponytail: RGB keycodes aren't remapped for protocol <= 10; they show as hex there.
const remap = (code, from, to) => {
  for (const r of V10) if (code >= r[from] && code < r[from] + r[2]) return code - r[from] + r[to];
  return code;
};
export const toV12 = (code, proto) => (proto >= 11 ? code : remap(code, 0, 1));
export const fromV12 = (code, proto) => (proto >= 11 ? code : remap(code, 1, 0));

export class Via {
  constructor(device) {
    this.device = device;
    this.queue = Promise.resolve();
  }

  static supported() { return 'hid' in navigator; }

  static async request() {
    const [device] = await navigator.hid.requestDevice({ filters: FILTERS });
    return device ? Via.open(device) : null;
  }

  static async reconnect() {
    const devices = await navigator.hid.getDevices();
    const d = devices.find((d) => d.collections.some((c) => c.usagePage === 0xff60));
    return d ? Via.open(d) : null;
  }

  static async open(device) {
    if (!device.opened) await device.open();
    const via = new Via(device);
    via.proto = await via.protocolVersion();
    return via;
  }

  // One request in flight at a time; resolves with the 32-byte reply.
  send(bytes) {
    const run = () => new Promise((resolve, reject) => {
      const data = new Uint8Array(32);
      data.set(bytes);
      const timer = setTimeout(() => { cleanup(); reject(new Error('Device did not respond')); }, 1500);
      const onReport = (e) => {
        const r = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength);
        if (r[0] !== bytes[0] && r[0] !== 0xff) return;
        cleanup();
        r[0] === 0xff && bytes[0] !== 0xff ? reject(new Error('unsupported')) : resolve(r);
      };
      const cleanup = () => { clearTimeout(timer); this.device.removeEventListener('inputreport', onReport); };
      this.device.addEventListener('inputreport', onReport);
      this.device.sendReport(0, data).catch((err) => { cleanup(); reject(err); });
    });
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  async protocolVersion() { const r = await this.send([0x01]); return (r[1] << 8) | r[2]; }
  async layerCount() { return (await this.send([0x11]))[1]; }

  async readBuffer(cmd, size) {
    const out = new Uint8Array(size);
    for (let off = 0; off < size; off += 28) {
      const n = Math.min(28, size - off);
      const r = await this.send([cmd, off >> 8, off & 0xff, n]);
      out.set(r.slice(4, 4 + n), off);
    }
    return out;
  }

  async keymap(layers, rows = MICRO.rows, cols = MICRO.cols) {
    const buf = await this.readBuffer(0x12, layers * rows * cols * 2);
    return Array.from({ length: layers }, (_, l) =>
      Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const i = ((l * rows + r) * cols + c) * 2;
          return toV12((buf[i] << 8) | buf[i + 1], this.proto);
        })));
  }

  setKey(layer, row, col, code) {
    code = fromV12(code, this.proto);
    return this.send([0x05, layer, row, col, code >> 8, code & 0xff]);
  }

  // dir: 0 = counter-clockwise, 1 = clockwise
  async encoder(layer, id, dir) {
    const r = await this.send([0x14, layer, id, dir]);
    return toV12((r[4] << 8) | r[5], this.proto);
  }
  setEncoder(layer, id, dir, code) {
    code = fromV12(code, this.proto);
    return this.send([0x15, layer, id, dir, code >> 8, code & 0xff]);
  }

  // Custom menu values (lighting). channel 0 = keyboard, 2 = rgblight, 3 = rgb matrix
  async getValue(channel, id, len = 1) { return (await this.send([0x08, channel, id])).slice(3, 3 + len); }
  setValue(channel, id, ...data) { return this.send([0x07, channel, id, ...data]); }
  saveValues(channel) { return this.send([0x09, channel]); }

  async macroCount() { return (await this.send([0x0c]))[1]; }
  async macroBufferSize() { const r = await this.send([0x0d]); return (r[1] << 8) | r[2]; }
  macroBuffer(size) { return this.readBuffer(0x0e, size); }
  async writeMacroBuffer(bytes) {
    for (let off = 0; off < bytes.length; off += 28) {
      const chunk = bytes.slice(off, off + 28);
      await this.send([0x0f, off >> 8, off & 0xff, chunk.length, ...chunk]);
    }
  }
}
