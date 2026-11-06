/* sprite check: validate SPR_ART grid and render a PNG contact sheet (no deps) */
'use strict';
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/var SPR_ART=\{([\s\S]*?)\};/);
const art = {};
const re = /(\w+):\[(.*?)\]/g;
let mm;
while ((mm = re.exec(m[1]))) {
  art[mm[1]] = mm[2].match(/"([^"]*)"/g).map((s) => s.slice(1, -1));
}
let bad = 0;
for (const k of Object.keys(art)) {
  art[k].forEach((row, i) => {
    if (row.length !== 12) { console.log('BAD ' + k + ' row ' + i + ' len ' + row.length + ': ' + row); bad++; }
  });
  if (art[k].length !== 12) { console.log('BAD ' + k + ' rows ' + art[k].length); bad++; }
}
console.log(bad ? 'grid problems: ' + bad : 'grid OK: all sprites 12x12');

const PAL = { o: '#161018', s: '#e8c39a', m: '#b8bfc7', w: '#7b5230', k: '#3c2c22', h: '#8a5c33', g: '#e0b95a', d: '#000' };
function mix(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return [Math.round(r), Math.round(g), Math.round(b)];
}
function hex2rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const teams = [{ c: '#4f86c4' }, { c: '#c4574a' }];
const S = 9, GAP = 10;
const cols = Object.keys(art).length * teams.length;
const W = cols * (12 * S + GAP) + GAP, H = 12 * S + GAP * 2;
const px = Buffer.alloc(W * H * 3, 24);
function put(x, y, rgb) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3; px[o] = rgb[0]; px[o + 1] = rgb[1]; px[o + 2] = rgb[2];
}
let gi = 0;
for (const k of Object.keys(art)) {
  teams.forEach((t) => {
    const col = hex2rgb(t.c), dk = mix(t.c, -0.45), lt = mix(t.c, 0.32);
    const ox = GAP + gi * (12 * S + GAP), oy = GAP;
    art[k].forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        let rgb = ch === 'c' ? col : ch === 'd' ? dk : ch === 'l' ? lt : (PAL[ch] ? hex2rgb(PAL[ch]) : [0, 0, 0]);
        for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) put(ox + x * S + dx, oy + y * S + dy, rgb);
      }
    });
    gi++;
  });
}
/* minimal PNG writer */
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crcBuf = Buffer.concat([t, data]);
  let c = ~0;
  for (let i = 0; i < crcBuf.length; i++) {
    c ^= crcBuf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  const crc = Buffer.alloc(4); crc.writeUInt32BE((~c) >>> 0);
  return Buffer.concat([len, t, data, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2;
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]);
const out = path.join(__dirname, '_sprites.png');
fs.writeFileSync(out, png);
console.log('wrote ' + out + ' ' + W + 'x' + H + '  (inf inf arc arc cav cav spc spc; blue then red)');
