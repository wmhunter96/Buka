// SPDX-License-Identifier: MIT
// Render every expression of every face set as an animated PNG (APNG) for the
// docs gallery (docs/faces.md). Frames come from the generator's own
// buildAssets(), so previews match the firmware pixel for pixel.
// Dependency-free; run from any directory: node scripts/expressions/render-previews.js
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { SETS, buildAssets } from './generate.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'docs/images/faces');

const SCALE = 4;
const WIDTH = 128 * SCALE;
const HEIGHT = 32 * SCALE;
const FRAME_MS = 100;
// Palette: OLED black and white.
const BACKGROUND = [0x0b, 0x0f, 0x14];
const PIXEL = [0xe8, 0xf4, 0xff];

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([length, body, crc]);
}

// One 512-byte frame (128x32, row-major, MSB first) -> deflated 1-bit
// palette scanlines at SCALE.
function encodeFrame(frame) {
  const rowBytes = WIDTH / 8;
  const raw = Buffer.alloc((rowBytes + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    const srcRow = Math.floor(y / SCALE);
    const line = y * (rowBytes + 1);
    raw[line] = 0; // filter: none
    for (let x = 0; x < WIDTH; x++) {
      const srcX = Math.floor(x / SCALE);
      const on = (frame[srcRow * 16 + (srcX >> 3)] >> (7 - (srcX & 7))) & 1;
      if (on) raw[line + 1 + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return zlib.deflateSync(raw, { level: 9 });
}

// Merge runs of identical frames into one longer frame.
function runs(frames) {
  const result = [];
  for (const frame of frames) {
    const last = result[result.length - 1];
    if (last && last.frame.equals(frame)) last.count++;
    else result.push({ frame, count: 1 });
  }
  return result;
}

function apng(frames) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 1; // bit depth
  ihdr[9] = 3; // palette
  const parts = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('PLTE', Buffer.from([...BACKGROUND, ...PIXEL])),
  ];

  const sequence = runs(frames);
  const actl = Buffer.alloc(8);
  actl.writeUInt32BE(sequence.length, 0);
  actl.writeUInt32BE(0, 4); // loop forever
  parts.push(chunk('acTL', actl));

  let seq = 0;
  sequence.forEach(({ frame, count }, i) => {
    const fctl = Buffer.alloc(26);
    fctl.writeUInt32BE(seq++, 0);
    fctl.writeUInt32BE(WIDTH, 4);
    fctl.writeUInt32BE(HEIGHT, 8);
    fctl.writeUInt32BE(0, 12);
    fctl.writeUInt32BE(0, 16);
    fctl.writeUInt16BE(count * FRAME_MS, 20); // delay numerator
    fctl.writeUInt16BE(1000, 22); // delay denominator (ms)
    fctl[24] = 0; // dispose: none
    fctl[25] = 0; // blend: source
    parts.push(chunk('fcTL', fctl));
    const data = encodeFrame(frame);
    if (i === 0) {
      parts.push(chunk('IDAT', data));
    } else {
      const seqBytes = Buffer.alloc(4);
      seqBytes.writeUInt32BE(seq++);
      parts.push(chunk('fdAT', Buffer.concat([seqBytes, data])));
    }
  });
  parts.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

let total = 0;
for (const set of SETS) {
  const assets = buildAssets(set);
  const dir = path.join(outDir, set.id);
  fs.mkdirSync(dir, { recursive: true });
  set.designs.faces.forEach((face, i) => {
    const png = apng(assets.animations[i]);
    fs.writeFileSync(path.join(dir, `${face.id}.png`), png);
    total += png.length;
  });
  console.log(`${set.id}: ${set.designs.faces.length} previews -> ${path.relative(root, dir)}`);
}
console.log(`${(total / 1024).toFixed(1)} KiB total`);
