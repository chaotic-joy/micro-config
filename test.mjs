// node test.mjs — protocol, keycode and macro round-trips against the mock device.
import assert from 'node:assert/strict';
import { Via, toV12, fromV12 } from './src/via.js';
import { MockMicro } from './src/mock.js';
import { encode, decode, buildBuffer, parseBuffer } from './src/macros.js';
import { describe, withMods, MOD, figmaPresets } from './src/keycodes.js';

// keycode translation for old firmware
assert.equal(toV12(0x5101, 9), 0x5221);           // MO(1)
assert.equal(fromV12(0x5221, 9), 0x5101);
assert.equal(fromV12(0x5200, 9), 0x5010);         // TO(0)
assert.equal(toV12(0x5200, 9), 0x5240);           // v10 DF(0)
assert.equal(toV12(0x5f13, 9), 0x7701);           // macro 1
assert.equal(toV12(0x0104, 9), 0x0104);           // Ctrl+A untouched
assert.equal(toV12(0x5101, 12), 0x5101);          // modern firmware: identity

// describe
assert.equal(describe(0x04).label, 'A');
assert.equal(describe(0x5221).label, 'Hold L2');
assert.equal(describe(0x7702, ['', '', 'Sig']).label, 'Sig');
assert.equal(describe(withMods(MOD.GUI | MOD.SHIFT, 0x1d)).kind, 'combo');
assert.ok(figmaPresets(true).every((p) => p.code > 0), 'every Figma preset resolves');

// macros
for (const t of ['hello', 'a{Cmd+Shift+K}b', '{Enter}{300ms}{F5}', 'x{Shift}y', '']) {
  assert.equal(decode(encode(t)), t, t);
}
assert.throws(() => encode('{Hyper+Q}'), /Unknown key/);
assert.throws(() => encode('émoji'), /ASCII/);
const buf = buildBuffer(['one', '{Ctrl+C}', ''], 64);
assert.deepEqual(parseBuffer(buf, 4), ['one', '{Ctrl+C}', '', '']);
assert.throws(() => buildBuffer(['x'.repeat(70)], 64), /bytes/);

// end-to-end against the mock
const via = await Via.open(new MockMicro());
assert.equal(via.proto, 12);
const layers = await via.layerCount();
let km = await via.keymap(layers);
assert.equal(km[0][0][0], 0xae);
assert.equal(km[0][3][0], 0x5201);
await via.setKey(2, 1, 3, 0x0a04);
km = await via.keymap(layers);
assert.equal(km[2][1][3], 0x0a04);
assert.equal(await via.encoder(0, 0, 1), 0xa9);
await via.setEncoder(1, 1, 0, 0xab);
assert.equal(await via.encoder(1, 1, 0), 0xab);
const size = await via.macroBufferSize();
const mb = buildBuffer(['hi{Enter}'], size);
await via.writeMacroBuffer(mb);
assert.deepEqual(parseBuffer(await via.macroBuffer(size), 2), ['hi{Enter}', '']);
assert.deepEqual([...(await via.getValue(3, 4, 2))], [20, 255]);
await assert.rejects(via.send([0x42]), /unsupported/);

console.log('all checks passed');
