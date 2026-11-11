// The poison you can see: one pooled particle system (no allocation while running).
//   pour  - vapor falls down the windpipe while the vape exhales, kept inside the airway;
//   split - at the carina each wisp takes a bronchus (weighted like the simulation's dose);
//   seep  - from the bronchus it crawls patch to patch toward the spreading edge, slowing as it goes;
//   fume  - afterwards, thin fumes keep rising off the dead tissue until the lungs heal.
// Soft olive haze plus a few acid-green motes, additive (the bloom does the glow). One green light follows the
// vapor front down the airway and then hangs over the poisoned area, so the metal catches the colour. The vapor
// never runs ahead of the front (sim.vapor.front), so the windpipe fills from the top down.
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { TRACHEA, BRONCHI } from "../sim/LungSim.js";
import { PORT_Y } from "./Airway.jsx";
import { store } from "../store.js";

const vert = /* glsl */ `
attribute float aA; attribute float aS; attribute float aK;
uniform float uScale; varying float vA; varying float vK;
void main() { vA = aA; vK = aK; vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aA > 0.001 ? min(140.0, aS * uScale / -mv.z) : 0.0; gl_Position = projectionMatrix * mv; }`;
const frag = /* glsl */ `
varying float vA; varying float vK;
void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.0, d);
  vec3 haze = vec3(0.055, 0.075, 0.014) * soft * soft, mote = vec3(0.9, 1.35, 0.22) * pow(soft, 3.0);
  gl_FragColor = vec4(mix(haze, mote, vK) * vA, 1.0); }`;

export default function Toxin({ simRef }) {
  const low = store.get().quality === "low";
  const N = low ? 700 : 1600;
  const { gl } = useThree();
  const pts = useRef(), light = useRef();
  const P = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), a = new Float32Array(N), s = new Float32Array(N), k = new Float32Array(N);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aA", new THREE.BufferAttribute(a, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aS", new THREE.BufferAttribute(s, 1));
    geo.setAttribute("aK", new THREE.BufferAttribute(k, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 50);
    const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: { uScale: { value: 400 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    return { geo, mat, pos, a, s, k, vx: new Float32Array(N), vy: new Float32Array(N), life: new Float32Array(N), max: new Float32Array(N),
      mode: new Uint8Array(N), side: new Uint8Array(N), tgt: new Int16Array(N), seed: new Float32Array(N), next: 0, acc: 0, facc: 0,
      front: [], lx: 0, ly: PORT_Y, lk: 0 };
  }, [N]);

  const spawn = (x, y, z, vx, vy, max, mode, haze) => {
    const i = P.next; P.next = (P.next + 1) % N;
    P.pos[3 * i] = x; P.pos[3 * i + 1] = y; P.pos[3 * i + 2] = z; P.vx[i] = vx; P.vy[i] = vy;
    P.life[i] = 0; P.max[i] = max; P.mode[i] = mode; P.tgt[i] = -1; P.seed[i] = Math.random() * 100;
    P.k[i] = haze ? 0 : 1; P.s[i] = haze ? 0.32 + Math.random() * 0.4 : 0.035 + Math.random() * 0.05;
    return i;
  };

  useFrame((state, rawDt) => {
    const sim = simRef.current; if (!sim) return;
    const dt = Math.min(rawDt, 0.05), t = state.clock.elapsedTime;
    const { phase, heal } = store.get();
    P.mat.uniforms.uScale.value = gl.domElement.height * 0.5 * state.camera.projectionMatrix.elements[5];
    // where the poison is advancing (targets for seeping wisps), refreshed each frame
    P.front.length = 0;
    for (const d of sim.dots) if (d.tox > 0.04 && d.tox < 1.1) P.front.push(d);
    const running = sim.released >= 0 && !sim.finished;
    // pour: vapor while the vape exhales
    if (running && sim.vapor.emit > 0) {
      P.acc += dt * (low ? 220 : 480) * sim.vapor.emit;
      for (; P.acc >= 1; P.acc--) {
        const haze = Math.random() < 0.82;
        spawn((Math.random() - 0.5) * 0.12, PORT_Y - 0.2 - Math.random() * 0.15, (Math.random() - 0.5) * 0.12,
          (Math.random() - 0.5) * 0.2, -2.6 - Math.random() * 1.2, 2.6 + Math.random() * 1.6, 0, haze);
      }
    }
    // fume: after the puff, slow smoke off dead tissue (fades out as the lungs heal)
    if (phase === "done" && heal < 0.35 && sim.destroyed) {
      P.facc += dt * (low ? 10 : 22) * (1 - heal / 0.35);
      for (; P.facc >= 1; P.facc--) {
        const d = sim.dots[(Math.random() * sim.dots.length) | 0]; if (d.alive) continue;
        const i = spawn(d.x + (Math.random() - 0.5) * 0.2, d.y, 0.12, (Math.random() - 0.5) * 0.08, 0.16 + Math.random() * 0.2, 3 + Math.random() * 2.5, 3, Math.random() < 0.9);
        if (P.k[i] === 0) P.s[i] *= 0.8;
      }
    }
    // move
    const carY = TRACHEA.carina, hw = TRACHEA.halfWidth * 0.85, frontY = PORT_Y - 0.2 - sim.vapor.front * (PORT_Y - 0.2 - carY);
    for (let i = 0; i < N; i++) {
      if (P.life[i] >= P.max[i]) { P.a[i] = 0; continue; }
      P.life[i] += dt;
      const j = 3 * i; let x = P.pos[j], y = P.pos[j + 1];
      const sd = P.seed[i], wob = Math.sin(t * 2.3 + sd) * 0.6 + Math.sin(t * 3.7 + sd * 1.7) * 0.4;
      let vx = P.vx[i], vy = P.vy[i];
      const m = P.mode[i];
      if (m === 0) {                                             // pour: never ahead of the vapor front, so the pipe fills top down
        vx += wob * dt * 1.2; vx -= x * dt * 9;
        if (Math.abs(x) > hw) x = Math.sign(x) * hw;
        if (sim.vapor.front < 1 && y + vy * dt < frontY) { y = frontY + Math.random() * 0.04; vy = -0.15 - Math.random() * 0.3; }
        if (y < carY + 0.05) { P.mode[i] = 1; P.side[i] = Math.random() < sim.side[0] / (sim.side[0] + sim.side[1]) ? 0 : 1; }
      } else if (m === 1 || m === 2) {
        let tx, ty, sp;
        if (m === 1) { [tx, ty] = BRONCHI[P.side[i]]; sp = 1.5; }
        else {
          let d = P.tgt[i] >= 0 ? sim.dots[P.tgt[i]] : null;
          if (!d || Math.hypot(d.x - x, d.y - y) < 0.12) {     // reached it: creep on to a nearby patch on the edge
            let best = null, bd = 1e9;
            for (let q = 0; q < 5 && P.front.length; q++) {
              const c = P.front[(Math.random() * P.front.length) | 0], dd = Math.hypot(c.x - x, c.y - y) + Math.random() * 0.6;
              if (dd < bd) { bd = dd; best = c; }
            }
            d = best || (d?.nbr[(Math.random() * d.nbr.length) | 0]?.d ?? null);
            P.tgt[i] = d ? d.i : -1;
          }
          tx = d ? d.x : x; ty = d ? d.y : y; sp = 0.75 * (1 - 0.5 * P.life[i] / P.max[i]);
        }
        const dx = tx - x, dy = ty - y, l = Math.hypot(dx, dy) || 1;
        const steer = Math.min(1, dt * (m === 1 ? 7 : 3));
        vx += ((dx / l) * sp - vx) * steer + wob * dt * 1.6; vy += ((dy / l) * sp - vy) * steer + Math.cos(t * 2.9 + sd) * dt * 1.2;
        if (m === 1 && l < 0.16) P.mode[i] = 2;
      } else {                                                   // fume: rises, curls, spreads
        vx += wob * dt * 0.25; vy += dt * 0.05;
      }
      x += vx * dt; y += vy * dt;
      P.pos[j] = x; P.pos[j + 1] = y; P.pos[j + 2] += (m === 3 ? 0.04 : 0) * dt;
      P.vx[i] = vx; P.vy[i] = vy;
      const f = P.life[i] / P.max[i];
      const env = Math.min(1, P.life[i] / 0.2) * (1 - smooth(0.55, 1, f));
      P.a[i] = env * (m === 3 ? 0.55 : 1) * (P.k[i] ? 0.9 + 0.1 * Math.sin(t * 9 + sd) : 1);
      if (m === 3) P.s[i] += dt * 0.08 * (1 - P.k[i]);
    }
    P.geo.attributes.position.needsUpdate = true; P.geo.attributes.aA.needsUpdate = true; P.geo.attributes.aS.needsUpdate = true;
    // light: follows the vapor down, then hangs over the poisoned area
    let tx = 0, ty = 0.4, tk = 0;
    if (running) {
      const f = sim.vapor.front;
      if (f < 1) { ty = PORT_Y - f * (PORT_Y - carY); tk = 3.5 * sim.vapor.emit; }
      else { let sx = 0, sy = 0, w = 0; for (const d of P.front) { sx += d.x; sy += d.y; w++; }
        if (w) { tx = sx / w; ty = sy / w; } tk = 2 + Math.min(4, w * 0.08); }
    } else if (phase === "done" && sim.destroyed) tk = 0.9 * Math.max(0, 1 - heal * 2.5);
    const e = Math.min(1, dt * 3);
    P.lx += (tx - P.lx) * e; P.ly += (ty - P.ly) * e; P.lk += (tk - P.lk) * e;
    light.current.position.set(P.lx, P.ly, 0.9); light.current.intensity = P.lk;
  });

  return (
    <>
      <points ref={pts} geometry={P.geo} material={P.mat} frustumCulled={false} renderOrder={2} />
      <pointLight ref={light} color="#a6ff2e" distance={4.5} decay={2} intensity={0} />
    </>
  );
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
