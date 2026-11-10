// Headless check of the physics: npm run sim-test. Runs several seeded games and prints damage + duration.
import { createServer } from "vite";
const vite = await createServer({ logLevel: "error", server: { middlewareMode: true } });
const { LungSim, initRapier } = await vite.ssrLoadModule("/src/sim/LungSim.js");
await initRapier();
const sim = new LungSim();
const rows = [];
for (let seed = 1; seed <= 8; seed++) {
  sim.reset(seed); sim.release();
  let first = -1, walls = 0, escaped = 0; const offT = sim.on("kill", () => { if (first < 0) first = sim.time; });
  const offW = sim.on("wall", () => walls++);
  while (!sim.finished && sim.time < 30) {
    sim.tick();
    for (const b of sim.balls) if (b.alive && (Math.abs(b.x) > 3.6 || b.y < -3.4 || b.y > 4.6)) escaped++;
  }
  offT(); offW();
  const scorched = sim.dots.filter(d => d.alive && d.health < 0.6).length;
  rows.push({ seed, destroyed: sim.destroyed, scorched, firstHit: first.toFixed(2), duration: sim.time.toFixed(1), walls, escaped, timedOut: sim.time - sim.released > sim.o.timeout });
}
console.table(rows);
await vite.close();
