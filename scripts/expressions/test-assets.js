// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { SETS, packPixels, encodeRle, buildAssets, generate } from './generate.js';

// Frozen digests of the original uncompressed 30-frame designs.
// These are independent of the deduplication/RLE format and generated manifest.
const golden = [
  'c44c2f5d751774a71a08b7bb30a0d8fa3005e0ac942c0fbe2afa0b8eadf7bb1a',
  'ace03d8dff6394548e44c18e663c016d41398ab8f909ac8be97d7154f9539fb6',
  '94930173e299ad7055f23d3676998113d895c4f9963788ba0d70800f2297ca25',
  '246dc572ccefad0e3a27c921dbc348c0ade562efa6f2fef41e44ca00aa985e87',
  'bb3dfdae21c82b6a7fbd1139cdf1b6266dad1680947f38082705c2b7a29f3f2a',
  'c86ac31de883a37d83228635e1bc1f3418708de8c0700d3aaed88db30fff3910',
  '1b01090f343d5ef581cd60cf00fa36db793f9304ace61f2cd727f88c4ef49d7e',
  'a7baa4aae4fb360d7b3cd3f730ceef5929ef2f58721eebee62fa32bd0721f3f7',
  '2a173eebc1dd1f373dd9090072fdb133a3a2f7907bb4c302640e00b85fdc1204',
  'b7c465908e413777815b39ba2bdbf7490b4a275932552e1916f34a8ca09c6db3',
  '3d01ba558d2f2f1bcc2ef78a4ad57d8aa70c21859661dada925e92e8685a88df',
  'da60536d38f074526521a39c99ff16cf1404cffaf1366cb433978263489ab86b',
  '885fd4ed26027755ed7fefd953b515f7a50223936dc0d517c7d3d3bf159eb971',
  'a62a4d723c7698c9d52d1c241ea2eecf5a2e200f37529ea4debeb09211b8d9e0',
  '27fbd45135ad16f1189997c22bbb3ba388894c07902651862478724c5656351e',
  '311a089f5fcffa1152324a75888b3a4f22331e4e8c0e7a0036207638ae708024'
];

const pixels = new Uint8Array(4096);
for (const bit of [0, 7, 8, 127, 128, 4095]) pixels[bit] = 1;
const packed = packPixels(pixels);
assert.equal(packed[0], 0x81);
assert.equal(packed[1], 0x80);
assert.equal(packed[15], 1);
assert.equal(packed[16], 0x80);
assert.equal(packed[511], 1);
assert.throws(() => packPixels(new Uint8Array(32)), RangeError);
pixels[3] = 2;
assert.throws(() => packPixels(pixels), RangeError);
assert.deepEqual(encodeRle(Buffer.alloc(512, 7)), Buffer.from([255, 7, 255, 7, 2, 7]));

// Every frame of every set must decode back to its source pixels.
function assertRoundTrip(assets, setId) {
  assert.equal(assets.animations.length, 16, setId);
  assert.ok(assets.unique.length <= 256 && assets.data.length <= 65535, setId);
  assets.animations.forEach((frames, expression) => {
    frames.forEach((frame, index) => {
      const id = assets.indices[expression][index];
      const data = assets.data.subarray(assets.offsets[id], assets.offsets[id + 1]);
      const restored = [];
      assert.equal(data.length % 2, 0);
      for (let i = 0; i < data.length; i += 2) {
        assert.ok(data[i] > 0);
        for (let run = 0; run < data[i]; run++) restored.push(data[i + 1]);
      }
      assert.deepEqual(Buffer.from(restored), frame, `${setId} expression ${expression}, frame ${index}`);
    });
  });
}

assert.deepEqual(SETS.map(set => set.id), ['kaomoji']);
for (const set of SETS) {
  assert.deepEqual(set.designs.faces.map(face => face.id), SETS[0].designs.faces.map(face => face.id), `${set.id} ids/order`);
  assertRoundTrip(buildAssets(set), set.id);
}

const assets = buildAssets();
assert.equal(assets.animations.length, 16);
assert.equal(assets.unique.length, 92);
assert.equal(assets.data.length + 480 + assets.offsets.length * 2, 18962);
assets.animations.forEach((frames, expression) => {
  assert.equal(crypto.createHash('sha256').update(Buffer.concat(frames)).digest('hex'), golden[expression]);
  frames.forEach((frame, index) => {
    const id = assets.indices[expression][index];
    const data = assets.data.subarray(assets.offsets[id], assets.offsets[id + 1]);
    const restored = [];
    assert.equal(data.length % 2, 0);
    for (let i = 0; i < data.length; i += 2) {
      assert.ok(data[i] > 0);
      for (let run = 0; run < data[i]; run++) restored.push(data[i + 1]);
    }
    assert.equal(restored.length, 512);
    assert.deepEqual(Buffer.from(restored), frame, `expression ${expression}, frame ${index}`);
  });
});
generate(true);
console.log('PASS: all 480 kaomoji frames match the original pixels; every set round-trips; packing, RLE limits, and generated files verified.');
