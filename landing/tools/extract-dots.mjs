// Reads ../logo.svg (the Alveo app icon) and writes src/data/lung.json: every dot of the
// dot-halftone lungs (x, y, r in the icon's 1024 px space), the airway strokes and the fade.
// Run after the logo changes:  npm run dots
import { readFileSync, writeFileSync } from "node:fs";
const svg = readFileSync(new URL("../../logo.svg", import.meta.url), "utf8");
const dots = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"\/>/g)]
  .map(m => ({ x: +m[1], y: +m[2], r: +m[3] }));
const grad = svg.match(/id="fadeB"[^>]*y1="([\d.]+)"[^>]*y2="([\d.]+)"/);
const stops = [...svg.slice(svg.indexOf('id="fadeB"')).matchAll(/stop-color="(#[0-9a-f]{6})"/gi)].slice(0, 2).map(m => m[1]);
const paths = [...svg.matchAll(/<path d="([^"]+)" stroke-width="(\d+)"/g)].map(m => ({ d: m[1], w: +m[2] }));
const out = { source: "logo.svg", size: 1024, fade: { y1: +grad[1], y2: +grad[2], from: stops[0], to: stops[1] }, airway: paths, dots };
writeFileSync(new URL("../src/data/lung.json", import.meta.url), JSON.stringify(out));
console.log(`${dots.length} dots, fade ${out.fade.from} -> ${out.fade.to} (y ${out.fade.y1}-${out.fade.y2}), airway`, paths);
const rows = {}; for (const d of dots) (rows[d.y] ||= []).push(d.x);
for (const y of Object.keys(rows).sort((a, b) => a - b)) console.log(y, rows[y].sort((a, b) => a - b).join(" "), "r", dots.find(d => d.y == y).r);

// ---- Containment wall: outline of (every dot grown by PAD) ∪ (trachea channel), traced on a 2 px grid,
// simplified and smoothed. The balls bounce inside it; the 3D "cage" rail is drawn along it.
const PAD = 22, CH = 17, TOP = 120, STEP = 2;                 // CH = trachea channel half-width (ball r = 11)
const X0 = 180, X1 = 850, Y0 = TOP - 10, Y1 = 880;
const W = Math.ceil((X1 - X0) / STEP), H = Math.ceil((Y1 - Y0) / STEP);
const inside = new Uint8Array(W * H);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const x = X0 + (i + .5) * STEP, y = Y0 + (j + .5) * STEP;
  let v = Math.abs(x - 512) <= CH && y >= TOP && y <= 430;
  for (const d of dots) { if (v) break; const R = d.r + PAD; if ((x - d.x) ** 2 + (y - d.y) ** 2 <= R * R) v = true; }
  inside[j * W + i] = v ? 1 : 0;
}
const at = (i, j) => i >= 0 && j >= 0 && i < W && j < H && inside[j * W + i];
const next = new Map();                                        // directed boundary edges, region on the left
const key = (i, j) => i + "," + j;
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (at(i, j)) {
  if (!at(i, j - 1)) next.set(key(i + 1, j), [i, j]);         // top edge, right -> left
  if (!at(i - 1, j)) next.set(key(i, j), [i, j + 1]);         // left edge, top -> bottom
  if (!at(i, j + 1)) next.set(key(i, j + 1), [i + 1, j + 1]); // bottom edge, left -> right
  if (!at(i + 1, j)) next.set(key(i + 1, j + 1), [i + 1, j]); // right edge, bottom -> top
}
let best = [];
const seen = new Set();
for (const k of next.keys()) {
  if (seen.has(k)) continue;
  const loop = []; let c = k;
  while (!seen.has(c) && next.has(c)) { seen.add(c); const [a, b] = c.split(",").map(Number); loop.push([X0 + a * STEP, Y0 + b * STEP]); c = key(...next.get(c)); }
  if (loop.length > best.length) best = loop;
}
function dp(pts, eps) {                                        // Douglas-Peucker on an open polyline
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  let m = 0, mi = 0; const L = Math.hypot(bx - ax, by - ay) || 1;
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L; if (d > m) { m = d; mi = i; } }
  return m > eps ? [...dp(pts.slice(0, mi + 1), eps).slice(0, -1), ...dp(pts.slice(mi), eps)] : [pts[0], pts[pts.length - 1]];
}
function dpClosed(loop, eps) {                                // split at the farthest point, then DP both halves
  let far = 0, fd = 0; loop.forEach(([x, y], i) => { const d = (x - loop[0][0]) ** 2 + (y - loop[0][1]) ** 2; if (d > fd) { fd = d; far = i; } });
  return [...dp(loop.slice(0, far + 1), eps).slice(0, -1), ...dp([...loop.slice(far), loop[0]], eps).slice(0, -1)];
}
let poly = dpClosed(best, 3.2);
for (let it = 0; it < 3; it++) {                               // Chaikin smoothing (closed)
  const o = []; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length];
    o.push([.75 * p[0] + .25 * q[0], .75 * p[1] + .25 * q[1]], [.25 * p[0] + .75 * q[0], .25 * p[1] + .75 * q[1]]); } poly = o;
}
poly = dpClosed(poly, 0.6).map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]);
let minGap = 1e9;                                             // check: no dot pokes through the wall
for (const d of dots) for (let i = 0; i < poly.length; i++) {
  const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length], vx = bx - ax, vy = by - ay;
  const t = Math.max(0, Math.min(1, ((d.x - ax) * vx + (d.y - ay) * vy) / (vx * vx + vy * vy)));
  minGap = Math.min(minGap, Math.hypot(ax + t * vx - d.x, ay + t * vy - d.y) - d.r);
}
out.wall = poly; out.trachea = { halfWidth: CH, top: TOP };
writeFileSync(new URL("../src/data/lung.json", import.meta.url), JSON.stringify(out));
console.log(`wall: ${best.length} grid edges -> ${poly.length} points; closest dot edge to wall ${minGap.toFixed(1)} px`);
