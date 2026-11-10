// Off the main thread: builds the cloud-puff atlas (2x2 variants). Alpha = density: soft metaball lumps torn up by
// domain-warped noise. RGB = light: a short march from each pixel toward the light (up and a little left)
// accumulates density, so tops glow and bellies sink into shadow, like the real thing.
const S = 224;
function hash(x, y, s) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y); let xf = x - xi, yf = y - yi;
  xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
function fbm(x, y, s, o) { let v = 0, a = 0.5, n = 0; for (let k = 0; k < o; k++) { v += a * noise(x, y, s + k * 17); n += a; x *= 2.03; y *= 2.03; a *= 0.5; } return v / n; }
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const out = new Uint8ClampedArray(S * 2 * S * 2 * 4), dens = new Float32Array(S * S);
for (let v = 0; v < 4; v++) {
  let seed = 1000 + v * 77; const r = () => hash(seed++, v, 9);
  const lumps = Array.from({ length: 6 + (v % 2) * 2 }, () => ({ x: 0.3 + r() * 0.4, y: 0.4 + r() * 0.22, s: 0.1 + r() * 0.1 }));
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const u = i / S, w = j / S;
    let f = 0; for (const l of lumps) { const dx = u - l.x, dy = (w - l.y) * 1.25; f += Math.exp(-(dx * dx + dy * dy) / (l.s * l.s)); }
    const fN = 1 - Math.exp(-1.3 * f);
    const wx = fbm(u * 3 + v, w * 3, v * 13 + 5, 3), wy = fbm(u * 3 + 7.3, w * 3 + v, v * 13 + 9, 3);
    const n = fbm(u * 4.5 + wx * 1.8 + v * 3.1, w * 4.5 + wy * 1.8, v * 31, 5);
    let d = sstep(0.2, 0.95, fN * 0.95 + (n - 0.5) * 1.15 - 0.1);
    d *= sstep(0.5, 0.38, Math.max(Math.abs(u - 0.5), Math.abs(w - 0.5)));   // never touch the tile edge
    dens[j * S + i] = d;
  }
  const ox = (v % 2) * S, oy = (v >> 1) * S;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    let acc = 0;
    for (let s = 1; s <= 7; s++) { const x = i - s * 3, y = j - s * 5; if (x >= 0 && y >= 0) acc += dens[y * S + x]; }
    const d = dens[j * S + i], lit = Math.exp(-acc * 0.42);
    const c = Math.min(1, 0.16 + 0.84 * lit) * (1 - 0.15 * d);
    const k = 4 * ((oy + j) * S * 2 + ox + i);
    out[k] = out[k + 1] = out[k + 2] = Math.round(c * 255); out[k + 3] = Math.round(d * 255);
  }
}
postMessage({ data: out, size: S * 2 }, [out.buffer]);
