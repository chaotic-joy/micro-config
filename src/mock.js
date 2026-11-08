// A fake Creator Micro that speaks VIA, for demo mode and tests.
// Mirrors the HIDDevice surface Via uses: opened, open(), sendReport(), input reports.
const KC = (s) => s.split(' ').map((x) => parseInt(x, 16));

export class MockMicro extends EventTarget {
  constructor() {
    super();
    this.opened = true;
    this.productName = 'Creator Micro (demo)';
    this.layers = 4;
    // layer 0 = default keymap from QMK's work_louder/micro
    const l0 = KC('ae 26 27 0 22 23 24 25 1e 1f 20 21 5201 37 36 7e09');
    const blank = KC('1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1');
    this.keys = [l0, blank.slice(), blank.slice(), blank.slice()];
    this.keys[1][12] = 0x5202; this.keys[2][12] = 0x5203; this.keys[3][12] = 0x5200;
    this.enc = [[[0xaa, 0xa9], [0x11d, 0x11c]], ...[1, 2, 3].map(() => [[1, 1], [1, 1]])];
    this.macro = new Uint8Array(512);
    this.macro.set([...'Hello from the Micro'].map((c) => c.charCodeAt(0)));
    this.values = { '2:1': [120], '2:2': [1], '2:3': [1], '2:4': [213, 255], '3:1': [150], '3:2': [12], '3:3': [128], '3:4': [20, 255], '0:1': [3] };
  }
  async open() {}

  async sendReport(_id, data) {
    const q = new Uint8Array(data), r = new Uint8Array(32);
    r.set(q);
    const off = (q[1] << 8) | q[2];
    switch (q[0]) {
      case 0x01: r[1] = 0; r[2] = 12; break;
      case 0x11: r[1] = this.layers; break;
      case 0x12: {
        const flat = this.keys.flat();
        for (let i = 0; i < q[3]; i++) {
          const w = flat[(off + i) >> 1] ?? 0;
          r[4 + i] = (off + i) & 1 ? w & 0xff : w >> 8;
        }
        break;
      }
      case 0x05: this.keys[q[1]][q[2] * 4 + q[3]] = (q[4] << 8) | q[5]; break;
      case 0x14: { const c = this.enc[q[1]][q[2]][q[3]]; r[4] = c >> 8; r[5] = c & 0xff; break; }
      case 0x15: this.enc[q[1]][q[2]][q[3]] = (q[4] << 8) | q[5]; break;
      case 0x08: (this.values[`${q[1]}:${q[2]}`] ?? [0]).forEach((v, i) => (r[3 + i] = v)); break;
      case 0x07: this.values[`${q[1]}:${q[2]}`] = [...q.slice(3, 5)]; break;
      case 0x09: break;
      case 0x0c: r[1] = 16; break;
      case 0x0d: r[1] = 0x02; r[2] = 0x00; break;
      case 0x0e: r.set(this.macro.slice(off, off + q[3]), 4); break;
      case 0x0f: this.macro.set(q.slice(4, 4 + q[3]), off); break;
      default: r[0] = 0xff;
    }
    queueMicrotask(() => {
      const e = new Event('inputreport');
      e.data = new DataView(r.buffer);
      this.dispatchEvent(e);
    });
  }
}
