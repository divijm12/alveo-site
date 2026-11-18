// Headless check of the poison spread: npm run sim-test. Runs several seeded puffs and prints damage + duration.
import { createServer } from "vite";
const vite = await createServer({ logLevel: "error", server: { middlewareMode: true } });
const { LungSim } = await vite.ssrLoadModule("/src/sim/LungSim.js");
const sim = new LungSim();
const rows = [];
for (let seed = 1; seed <= 8; seed++) {
  sim.reset(seed); sim.release();
  let first = -1, half = -1;
  const off = sim.on("kill", e => { if (first < 0) first = sim.time; if (half < 0 && e.destroyed >= 45) half = sim.time; });
  while (!sim.finished && sim.time < 30) sim.tick();
  off();
  const L = sim.dots.filter(d => !d.alive && d.x < 0).length, R = sim.destroyed - L;
  const tainted = sim.dots.filter(d => d.alive && d.tox > 0.25).length;
  const lowest = Math.min(...sim.dots.filter(d => !d.alive).map(d => d.y));
  rows.push({ seed, destroyed: sim.destroyed, left: L, right: R, tainted, firstKill: first.toFixed(2), kill45: half.toFixed(2), duration: sim.time.toFixed(1), lowestDead: lowest.toFixed(2) });
}
console.table(rows);
const t0 = performance.now(); for (let i = 0; i < 20; i++) { sim.reset(i); sim.runInstant(); }
console.log(`runInstant: ${((performance.now() - t0) / 20).toFixed(1)} ms per puff`);
await vite.close();
