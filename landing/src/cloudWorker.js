// Off the main thread: builds the smoke-sprite atlas (2x2 variants) in the spirit of the getalveo.app beta's
// smoke: fbm noise under a soft round falloff, no lighting, no billows. Domain warping curls it, and a ridged
// layer adds thin filaments, so overlapping sprites read as smoke, not cloud. Variant 3 is a long, thin wisp.
// RGB is near-white (slightly brighter where denser); the shader tints it.
const S = 224;
function hash(x, y, s) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y); let xf = x - xi, yf = y - yi;
  xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
function fbm(x, y, s, o) { let v = 0, a = 0.5, n = 0; for (let k = 0; k < o; k++) { v += a * noise(x, y, s + k * 17); n += a; x *= 2.03; y *= 2.03; a *= 0.5; } return v / n; }

const out = new Uint8ClampedArray(S * 2 * S * 2 * 4);
for (let v = 0; v < 4; v++) {
  const wisp = v === 3, ox = (v % 2) * S, oy = (v >> 1) * S, sd = v * 101 + 7;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const u = i / S, w = j / S, cx = u - 0.5, cy = w - 0.5;
    const r = (wisp ? Math.hypot(cx * 1.05, cy * 2.6) : Math.hypot(cx, cy)) * 2;
    const f = Math.max(0, 1 - r);
    const qx = fbm(u * 3 + v * 5, w * 3, sd, 4), qy = fbm(u * 3 + 5.2, w * 3 + v * 5, sd + 3, 4);
    const n = fbm(u * 4 + qx * 1.9, w * (wisp ? 2.5 : 4) + qy * 1.9, sd + 6, 5);
    const g = fbm(u * 6 + qx * 2.6, w * 6 + qy * 2.6, sd + 9, 4), ridge = Math.pow(1 - Math.abs(2 * g - 1), 5);
    const dens = Math.max(0, n - 0.34) * 2.1 + ridge * 0.4;
    const a = Math.min(1, dens * Math.pow(f, 1.35) * 1.15);
    const c = Math.min(1, 0.72 + 0.4 * n);
    const k = 4 * ((oy + j) * S * 2 + ox + i);
    out[k] = out[k + 1] = out[k + 2] = Math.round(c * 255); out[k + 3] = Math.round(a * 255);
  }
}
postMessage({ data: out, size: S * 2 }, [out.buffer]);
