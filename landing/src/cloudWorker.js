// Off the main thread: builds the cloud-puff atlas (2x2 variants), cumulus-style. Each puff is a dome of round
// billows: alpha = density (edges frayed by noise), RGB = light from up-left, from the billows' height-field normals
// (lit tops, shaded folds) times a short shadow march (bellies sink into shade).
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

// separable box blur, in place
const tmp = new Float32Array(S * S);
function blur(a, r) {
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { let t = 0, c = 0; for (let k = -r; k <= r; k++) { const x = i + k; if (x >= 0 && x < S) { t += a[j * S + x]; c++; } } tmp[j * S + i] = t / c; }
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { let t = 0, c = 0; for (let k = -r; k <= r; k++) { const y = j + k; if (y >= 0 && y < S) { t += tmp[y * S + i]; c++; } } a[j * S + i] = t / c; }
}
const out = new Uint8ClampedArray(S * 2 * S * 2 * 4), dens = new Float32Array(S * S), hgt = new Float32Array(S * S);
const L = (() => { const x = -0.45, y = -0.75, z = 0.55, l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; })();   // up-left, image coords
for (let v = 0; v < 4; v++) {
  let seed = 1000 + v * 77; const r = () => hash(seed++, v, 9);
  // cumulus: a dome of round billows (bigger and taller in the middle) over a flatter base
  const lumps = Array.from({ length: 13 + (v % 2) * 4 }, () => { const x = 0.24 + r() * 0.52, c = 1 - Math.abs(x - 0.5) * 2;
    const s = 0.055 + r() * 0.05 + c * 0.04; return { x, y: 0.62 - s * 0.6 - c * (0.05 + r() * 0.14), s }; });
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const u = i / S, w = j / S;
    // height field: each billow a dome; the cloud is the highest dome at this pixel
    // smooth union of the domes (soft folds, not hard creases)
    let sh = 0, sm = 0;
    for (const l of lumps) { const dx = u - l.x, dy = w - l.y, q = 1 - (dx * dx + dy * dy) / (l.s * l.s); if (q > 0) { const e = Math.sqrt(q); sh += Math.exp(40 * e * l.s); sm += Math.exp(6 * e); } }
    const h = sh ? Math.log(sh) / 40 : 0, m = sm ? Math.max(0, Math.log(sm) / 6) : 0;
    const n = fbm(u * 7 + v * 3.1, w * 7, v * 31, 5), n2 = fbm(u * 16, w * 16, v * 7 + 3, 3);
    hgt[j * S + i] = h + (n - 0.5) * 0.03 + (n2 - 0.5) * 0.012;
    let d = m > 0 ? sstep(0.0, 0.85, m * 1.15 + (n - 0.5) * 0.8 - 0.08) : 0;
    d *= sstep(0.72, 0.62, w);                                                 // flat-ish underside
    d *= sstep(0.5, 0.4, Math.max(Math.abs(u - 0.5), Math.abs(w - 0.5)));    // never touch the tile edge
    dens[j * S + i] = d;
  }
  blur(hgt, 3); blur(hgt, 3);
  const ox = (v % 2) * S, oy = (v >> 1) * S;
  for (let j = 1; j < S - 1; j++) for (let i = 1; i < S - 1; i++) {
    // normal from the height field (lit billow tops, shaded folds between them) + a short shadow march
    const gx = (hgt[j * S + i + 1] - hgt[j * S + i - 1]) * S * 0.5, gy = (hgt[(j + 1) * S + i] - hgt[(j - 1) * S + i]) * S * 0.5;
    const nl = Math.hypot(gx, gy, 1), dif = Math.max(0, (-gx * L[0] - gy * L[1] + L[2]) / nl);
    let acc = 0; for (let s = 1; s <= 6; s++) { const x = i - s * 3, y = j - s * 5; if (x >= 0 && y >= 0) acc += dens[y * S + x]; }
    const d = dens[j * S + i], sh = Math.exp(-acc * 0.22);
    const c = Math.min(1, (0.3 + 0.75 * dif) * (0.6 + 0.4 * sh));
    const k = 4 * ((oy + j) * S * 2 + ox + i);
    out[k] = out[k + 1] = out[k + 2] = Math.round(c * 255); out[k + 3] = Math.round(d * 255);
  }
}
postMessage({ data: out, size: S * 2 }, [out.buffer]);
