// Generates PNG icons (progress ring on dark) with node:zlib only.
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BG = [10, 10, 12], TRACK = [42, 42, 46], ACC = [90, 162, 255];

function crc32(buf) {
  let c, crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function sample(x, y, s) {
  const dx = x - s / 2, dy = y - s / 2, r = Math.hypot(dx, dy) / s;
  if (r < 0.085) return ACC;
  if (r > 0.27 && r < 0.37) {
    // angle from top, clockwise; arc covers 0..270 deg
    let a = Math.atan2(dx, -dy) * 180 / Math.PI; if (a < 0) a += 360;
    const cap = (aa) => Math.hypot(Math.sin(aa * Math.PI / 180) * 0.32 * s - dx, -Math.cos(aa * Math.PI / 180) * 0.32 * s - dy) < 0.05 * s;
    if (a <= 270 || cap(0) || cap(270)) return ACC;
    return TRACK;
  }
  return BG;
}
function png(s) {
  const raw = Buffer.alloc((s * 3 + 1) * s);
  const n = 3;
  for (let y = 0; y < s; y++) {
    raw[y * (s * 3 + 1)] = 0;
    for (let x = 0; x < s; x++) {
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const c = sample(x + (i + 0.5) / n, y + (j + 0.5) / n, s); r += c[0]; g += c[1]; b += c[2];
      }
      const o = y * (s * 3 + 1) + 1 + x * 3;
      raw[o] = r / (n * n); raw[o + 1] = g / (n * n); raw[o + 2] = b / (n * n);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(s, 0); ihdr.writeUInt32BE(s, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
fs.mkdirSync(path.join(out, 'icons'), { recursive: true });
for (const [name, s] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  fs.writeFileSync(path.join(out, 'icons', name), png(s));
}
console.log('icons written');
