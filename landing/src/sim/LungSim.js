// What one puff does, as a simulation on the lung plane (no physics engine). Every logo dot is a patch of lung
// tissue with a toxin load (`tox`). The vape exhales into the windpipe; after `travel` s the vapor reaches the two
// bronchi and starts loading the tissue next to them. From there the poison creeps from patch to patch along a
// neighbour graph with uneven, per-run weights (so it spreads in fingers, not circles) and a slight downward pull
// (it settles into the lower lobes). Spreading weakens over time; a patch whose load reaches 1 dies.
// No React or three.js in here: the scene reads `dots` / `vapor` each frame and listens to events.
import lung from "../data/lung.json";

export const S = 0.01, CX = 512, CY = 560;                    // icon px -> world units, centred on the lungs
export const toWorld = (x, y) => [(x - CX) * S, (CY - y) * S];
export const TRACHEA = { x: 0, halfWidth: lung.trachea.halfWidth * S, top: toWorld(0, lung.trachea.top)[1], carina: toWorld(512, 414)[1] };
export const BRONCHI = [toWorld(452, 478), toWorld(572, 478)];  // where the two airway branches end

const DEFAULTS = {
  step: 1 / 60,
  travel: 2.0,        // s for the vapor to fill the windpipe, top to bottom, and reach the bronchi (RJ: slow, progressive)
  exhale: 2.4,        // s the vape keeps pushing vapor
  dose: 1.5,          // toxin per s fed into the tissue at each bronchus
  spread: 1.45,       // how fast poison moves patch to patch at first ...
  weaken: 2.0,        // ... decaying with this time constant (s)
  quiet: 1.2,         // s without a new dead patch (after the exhale) ends the run
  timeout: 12.2,      // s after release: the run ends regardless
};

function rng(seed) {                // mulberry32
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class LungSim {
  constructor(opts = {}) {
    this.o = { ...DEFAULTS, ...opts };
    this.listeners = new Map();
    this.wall = lung.wall.map(([x, y]) => toWorld(x, y));
    const { y1, y2 } = lung.fade;
    this.dots = lung.dots.map((d, i) => {
      const [x, y] = toWorld(d.x, d.y);
      return { i, x, y, r: d.r * S, t: (d.y - y1) / (y2 - y1), alive: true, tox: 0, health: 1, killedAt: -1, hitAt: -1, nbr: [], src: [0, 0] };
    });
    // neighbours: the six around each dot in the logo's hex grid
    for (const a of this.dots) for (const b of this.dots) if (a !== b && Math.hypot(a.x - b.x, a.y - b.y) < 0.46) a.nbr.push({ d: b, w: 1 });
    for (const d of this.dots) BRONCHI.forEach(([bx, by], k) => { const q = Math.hypot(d.x - bx, d.y - by); d.src[k] = q < 0.5 ? Math.exp(-q * q / 0.07) : 0; });
    this.next = new Float32Array(this.dots.length);
    this.vapor = { emit: 0, front: 0 };
    this.reset();
  }

  on(type, fn) { (this.listeners.get(type) || this.listeners.set(type, new Set()).get(type)).add(fn); return () => this.listeners.get(type).delete(fn); }
  emit(type, e) { if (!this.silent) this.listeners.get(type)?.forEach(f => f(e)); }

  /** Back to clean lungs. A new seed reshapes where the poison will go. */
  reset(seed = (Math.random() * 1e9) | 0) {
    const r = this.rand = rng(seed);
    for (const d of this.dots) {
      d.alive = true; d.tox = 0; d.health = 1; d.killedAt = -1; d.hitAt = -1;
      d.resist = 0.55 + 0.9 * r();
      // poison runs more easily downhill (from a patch above to one below)
      for (const n of d.nbr) n.w = (0.15 + 1.7 * r() ** 2) * (n.d.y > d.y + 0.05 ? 1.35 : n.d.y < d.y - 0.05 ? 0.75 : 1);
    }
    this.side = [0.75 + 0.5 * r(), 0.75 + 0.5 * r()];              // one lung usually gets more than the other
    this.time = 0; this.acc = 0; this.released = -1; this.finished = false; this.destroyed = 0; this.activity = 0; this.lastKill = 0;
    this.vapor.emit = 0; this.vapor.front = 0;
  }

  /** The puff: vapor starts down the windpipe. */
  release() { if (this.released < 0) this.released = this.time; }

  /** Advance by real seconds (fixed internal steps). */
  update(dt) {
    this.acc += Math.min(dt, 0.1);
    let n = 0;
    while (this.acc >= this.o.step && n++ < 12) { this.acc -= this.o.step; this.tick(); }
  }

  tick() {
    const o = this.o, h = o.step;
    this.time += h;
    if (this.released < 0 || this.finished) return;
    const tau = this.time - this.released;
    this.vapor.emit = tau < o.exhale ? 1 : Math.max(0, 1 - (tau - o.exhale) / 0.8);
    const x = Math.min(1, tau / o.travel);
    this.vapor.front = x * x * (3 - 2 * x) * 0.35 + x * 0.65;   // eases in and out a little, never stalls
    const inside = tau - o.travel;                               // time since the vapor reached the bronchi
    if (inside < 0) return;
    const feed = inside < o.exhale ? o.dose : 0;
    const D = o.spread * Math.exp(-inside / o.weaken);
    let moved = 0;
    for (const d of this.dots) {
      let g = 0;
      for (const n of d.nbr) if (n.d.tox > 0.12) g += n.w * (n.d.tox - 0.12);
      let add = D * d.resist * g * Math.max(0, 1.3 - d.tox) * h;
      if (feed) add += feed * (d.src[0] * this.side[0] + d.src[1] * this.side[1]) * h;
      this.next[d.i] = add; moved += add;
    }
    for (const d of this.dots) {
      const add = this.next[d.i]; if (!add) continue;
      if (d.hitAt < 0 && d.tox + add > 0.05) d.hitAt = this.time;
      d.tox = Math.min(1.3, d.tox + add);
      d.health = Math.max(0, 1 - d.tox);
      if (d.alive && d.tox >= 1) {
        d.alive = false; d.killedAt = this.lastKill = this.time; this.destroyed++;
        this.emit("kill", { dot: d, x: d.x, y: d.y, destroyed: this.destroyed });
      }
    }
    this.activity = moved / h;                                   // toxin moved per second (drives light + vapor)
    if ((inside > o.exhale + 1 && this.time - this.lastKill > o.quiet) || tau > o.timeout) {
      this.finished = true; this.vapor.emit = 0;
      this.emit("done", { destroyed: this.destroyed });
    }
  }

  /** Run a whole puff at once without drawing (reduced motion, tests). */
  runInstant(maxSeconds = 30) {
    this.release(); this.silent = true;                         // no events: callers set the end state themselves
    const steps = maxSeconds / this.o.step;
    for (let i = 0; i < steps && !this.finished; i++) this.tick();
    this.silent = false;
    this.time += 10;                                             // the glow of the last kills has already faded
  }
}
