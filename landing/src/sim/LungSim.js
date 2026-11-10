// The game under the art: Rapier 2D on the lung plane. Every logo dot is its own fixed circle collider;
// glowing balls drop down the trachea and bounce around inside the lung wall. A ball that touches a dot
// destroys it (Brick Breaker); neighbours get scorched. Each ball absorbs a fixed number of dots, heats up
// and bursts on its last one. When every ball has burst the run is over.
// No React or three.js in here: the scene reads `dots` / `balls` each frame and listens to events.
import RAPIER from "@dimforge/rapier2d-compat";
import lung from "../data/lung.json";

export const S = 0.01, CX = 512, CY = 560;                    // icon px -> world units, centred on the lungs
export const toWorld = (x, y) => [(x - CX) * S, (CY - y) * S];
export const BALL_R = 0.11;
export const TRACHEA = { x: 0, halfWidth: lung.trachea.halfWidth * S, top: toWorld(0, lung.trachea.top)[1], carina: toWorld(512, 414)[1] };

const DEFAULTS = {
  balls: 3, spawnGap: 0.24, gravity: -8.5,
  vMin: 3.6, vMax: 7.2,             // world units / s (the lungs are ~5.4 wide)
  budget: 30,                       // dots each ball destroys before it bursts
  scorchR: 0.85, scorch: 0.5,       // neighbours within scorchR lose up to `scorch` health per kill
  timeout: 12,                      // s after release: remaining balls burst (keeps the shot tight)
  step: 1 / 120,
};

function rng(seed) {                // mulberry32
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

let rapierReady;
export const initRapier = () => (rapierReady ||= RAPIER.init());

export class LungSim {
  constructor(opts = {}) {
    this.o = { ...DEFAULTS, ...opts };
    this.listeners = new Map();
    this.world = new RAPIER.World({ x: 0, y: this.o.gravity });
    this.world.integrationParameters.dt = this.o.step;
    this.events = new RAPIER.EventQueue(true);
    this.fixed = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

    // wall: closed polyline around the lungs + trachea (icon px -> world)
    const verts = new Float32Array(lung.wall.length * 2), idx = new Uint32Array(lung.wall.length * 2);
    lung.wall.forEach(([x, y], i) => { const [wx, wy] = toWorld(x, y); verts[2 * i] = wx; verts[2 * i + 1] = wy; idx[2 * i] = i; idx[2 * i + 1] = (i + 1) % lung.wall.length; });
    this.wallCol = this.world.createCollider(RAPIER.ColliderDesc.polyline(verts, idx).setRestitution(0.85).setFriction(0), this.fixed);
    this.wall = lung.wall.map(([x, y]) => toWorld(x, y));

    // dots, top to bottom as in the icon; t = 0..1 position in the icon's red fade
    const { y1, y2 } = lung.fade;
    this.dots = lung.dots.map((d, i) => {
      const [x, y] = toWorld(d.x, d.y);
      return { i, x, y, r: d.r * S, t: (d.y - y1) / (y2 - y1), alive: true, health: 1, heat: 0, killedAt: -1, col: null };
    });
    this.byHandle = new Map();
    this.dots.forEach(d => this.addDotCollider(d));
    this.balls = [];
    this.reset();
  }

  on(type, fn) { (this.listeners.get(type) || this.listeners.set(type, new Set()).get(type)).add(fn); return () => this.listeners.get(type).delete(fn); }
  emit(type, e) { if (!this.silent) this.listeners.get(type)?.forEach(f => f(e)); }

  addDotCollider(d) {
    d.col = this.world.createCollider(RAPIER.ColliderDesc.ball(d.r).setTranslation(d.x, d.y).setRestitution(1).setFriction(0), this.fixed);
    this.byHandle.set(d.col.handle, d);
  }

  /** Back to intact lungs, no balls. */
  reset(seed = (Math.random() * 1e9) | 0) {
    this.rand = rng(seed);
    for (const b of this.balls) if (b.body) this.world.removeRigidBody(b.body);
    this.balls = [];
    this.queue = [];
    for (const d of this.dots) { if (!d.alive) this.addDotCollider(d); d.alive = true; d.health = 1; d.heat = 0; d.killedAt = -1; }
    this.time = 0; this.acc = 0; this.released = -1; this.finished = false; this.destroyed = 0;
  }

  /** Fire the balls down the trachea (spawned one after another at the top of the windpipe). */
  release() {
    if (this.released >= 0) return;
    this.released = this.time;
    for (let k = 0; k < this.o.balls; k++) this.queue.push(this.time + k * this.o.spawnGap);
  }

  spawn() {
    const x = (this.rand() - 0.5) * 0.06, y = TRACHEA.top - 0.18;
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y)
      .setLinvel((this.rand() - 0.5) * 0.4, -this.o.vMin * 1.4).setCcdEnabled(true).setLinearDamping(0));
    const col = this.world.createCollider(RAPIER.ColliderDesc.ball(BALL_R).setRestitution(1).setFriction(0).setDensity(1)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
    const ball = { id: this.balls.length, body, col, alive: true, hits: 0, heat: 0, budget: this.o.budget + Math.round((this.rand() - 0.5) * 10), born: this.time, x, y, vx: 0, vy: 0, lastWall: -1 };
    this.balls.push(ball);
    this.emit("spawn", ball);
  }

  /** Advance by real seconds (fixed internal steps). */
  update(dt) {
    this.acc += Math.min(dt, 0.1);
    let n = 0;
    while (this.acc >= this.o.step && n++ < 12) { this.acc -= this.o.step; this.tick(); }
  }

  tick() {
    const o = this.o, h = o.step;
    this.time += h;
    while (this.queue.length && this.queue[0] <= this.time) { this.queue.shift(); this.spawn(); }
    this.world.step(this.events);

    const kills = [];
    this.events.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      const b = this.balls.find(b => b.alive && (b.col.handle === h1 || b.col.handle === h2));
      if (!b) return;
      const other = b.col.handle === h1 ? h2 : h1;
      const d = this.byHandle.get(other);
      if (d && d.alive) kills.push([b, d]);
      else if (other === this.wallCol.handle && this.time - b.lastWall > 0.06) {
        b.lastWall = this.time; const p = b.body.translation(), v = b.body.linvel();
        this.emit("wall", { ball: b, x: p.x, y: p.y, speed: Math.hypot(v.x, v.y) });
      } else if (!d) {
        const ob = this.balls.find(x => x.col.handle === other);
        if (ob && b.id < ob.id) { const p = b.body.translation(); this.emit("clash", { x: (p.x + ob.x) / 2, y: (p.y + ob.y) / 2 }); }
      }
    });
    for (const [b, d] of kills) if (d.alive && b.alive) this.kill(b, d);

    for (const b of this.balls) {
      if (!b.alive) continue;
      const v = b.body.linvel(), s = Math.hypot(v.x, v.y);
      if (s < o.vMin || s > o.vMax) { const k = Math.min(o.vMax, Math.max(o.vMin, s)) / (s || 1); b.body.setLinvel({ x: v.x * k || 0.3, y: v.y * k || -o.vMin }, true); }
      const p = b.body.translation(); b.x = p.x; b.y = p.y; b.vx = v.x; b.vy = v.y;
      if (this.time - this.released > o.timeout) this.burst(b);
    }
    for (const d of this.dots) if (d.heat > 0) d.heat = Math.max(0, d.heat - h * 1.6);
    if (this.released >= 0 && !this.finished && !this.queue.length && this.balls.length && this.balls.every(b => !b.alive)) {
      this.finished = true; this.emit("done", { destroyed: this.destroyed });
    }
  }

  kill(b, d) {
    d.alive = false; d.killedAt = this.time; d.health = 0; d.heat = 1;
    this.byHandle.delete(d.col.handle);
    this.world.removeCollider(d.col, false); d.col = null;
    this.destroyed++;
    // nudge the bounce a few degrees so balls never settle into a loop
    const v = b.body.linvel(), a = (this.rand() - 0.5) * 0.2, c = Math.cos(a), s = Math.sin(a);
    b.body.setLinvel({ x: v.x * c - v.y * s, y: v.x * s + v.y * c }, true);
    const p = b.body.translation(), nx = p.x - d.x, ny = p.y - d.y, nl = Math.hypot(nx, ny) || 1;
    for (const e of this.dots) {                                 // scorch the neighbours
      if (!e.alive) continue;
      const dist = Math.hypot(e.x - d.x, e.y - d.y);
      if (dist < this.o.scorchR) { const f = 1 - dist / this.o.scorchR; e.health = Math.max(0.08, e.health - this.o.scorch * f * f); e.heat = Math.min(0.55, e.heat + f * 0.35); }
    }
    b.hits++; b.heat = b.hits / b.budget;
    this.emit("kill", { ball: b, dot: d, x: d.x + nx / nl * d.r, y: d.y + ny / nl * d.r, nx: nx / nl, ny: ny / nl, speed: Math.hypot(v.x, v.y), destroyed: this.destroyed });
    if (b.hits >= b.budget) this.burst(b);
  }

  burst(b) {
    if (!b.alive) return;
    b.alive = false;
    const p = b.body.translation();
    this.world.removeRigidBody(b.body); b.body = null; b.x = p.x; b.y = p.y;
    // the burst scorches a wider ring
    for (const e of this.dots) {
      if (!e.alive) continue;
      const dist = Math.hypot(e.x - p.x, e.y - p.y);
      if (dist < 1.3) { const f = 1 - dist / 1.3; e.health = Math.max(0.08, e.health - 0.35 * f); e.heat = Math.min(0.7, e.heat + f * 0.6); }
    }
    this.emit("burst", { ball: b, x: p.x, y: p.y });
  }

  /** Run a whole game at once without drawing (reduced motion, tests). */
  runInstant(maxSeconds = 30) {
    this.release(); this.silent = true;                         // no events: callers set the end state themselves
    const steps = maxSeconds / this.o.step;
    for (let i = 0; i < steps && !this.finished; i++) this.tick();
    this.silent = false;
    for (const d of this.dots) d.heat = 0;
    this.time += 10;                                             // embers of the last kills are already cold
  }
}
