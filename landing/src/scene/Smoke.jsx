// The opening: dense vape smoke filling the screen, the same kind as on the getalveo.app beta (soft noise sprites,
// many of them overlapping, rising and slowly curling, an occasional faint red one), but much thicker, in depth,
// and densest around the words, which sit in a thinner pocket of it. It rolls in thick in the first seconds
// (`I.open`), and the cursor pushes it aside, swirling, like on the beta; it drifts back when the cursor leaves.
// The chemical labels (DOM, see Intro) hang in the smoke: this component projects their 3D anchors every frame.
// `I.pull` (0..1) is the breath: the smoke leans into the vortex, thins and dissolves while the gas itself is drawn
// into the windpipe as thin strands (Streams.jsx); the labels ride the vortex into the mouth. Pull back to 0 and
// the smoke gathers again (replay).
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cloudPixels } from "../cloudTex.js";
import { CHEMS } from "../chems.js";
import { PORT_Y } from "./Airway.jsx";
import { store } from "../store.js";

export const SKY_Y = 10.4;           // the opening shot looks here
const MOUTH = new THREE.Vector3(0, PORT_Y + 0.12, 0);
const DELAY = 0.5;                   // spread of the start delays, in units of `pull`
const Y0 = 3.2, Y1 = 18;             // smoke rises through this band and wraps (faded at both ends)

function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

const vert = /* glsl */ `
attribute vec3 aC; attribute float aS; attribute float aR; attribute float aA; attribute float aG; attribute float aT; attribute vec2 aV;
varying vec2 vUv; varying float vA; varying float vG; varying float vT;
void main() {
  float c = cos(aR), s = sin(aR);
  vec2 p = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * aS;
  vec4 mv = modelViewMatrix * vec4(aC, 1.0); mv.xy += p;
  gl_Position = projectionMatrix * mv;
  vUv = aV + vec2(uv.x, 1.0 - uv.y) * 0.5;
  vA = aA; vG = aG; vT = aT;
}`;
const frag = /* glsl */ `
uniform sampler2D uMap; varying vec2 vUv; varying float vA; varying float vG; varying float vT;
void main() {
  vec4 t = texture2D(uMap, vUv);
  float a = t.a * vA; if (a < 0.003) discard;
  vec3 smoke = vec3(0.27, 0.272, 0.285) * t.r;                // linear greys: a pale haze on black
  smoke = mix(smoke, vec3(0.34, 0.07, 0.06) * t.r, vT * 0.7); // the odd faintly red sprite, like the beta
  vec3 sick = vec3(0.11, 0.15, 0.025) * (0.5 + t.r);
  gl_FragColor = vec4(mix(smoke, sick, vG), min(a, 1.0));
}`;

export default function Smoke({ I }) {
  const low = store.get().quality === "low";
  const mesh = useRef(), tags = useRef([]), mouse = useRef({ x: 0, y: 0, on: false });
  const P = useMemo(() => {
    const r = rng(7), puffs = [];
    const add = (n, z0, z1, s0, s1, a0, a1) => {
      for (let i = 0; i < n; i++) {
        const z = z0 + r() * (z1 - z0), spread = 12 + (-z) * 0.6;      // further back = wider, to fill the frame
        puffs.push({ x: (r() * 2 - 1) * spread, y: Y0 + r() * (Y1 - Y0), z, s: s0 + r() * (s1 - s0), a: a0 + r() * (a1 - a0),
          rot: r() * 6.28, spin: (r() < 0.5 ? -1 : 1) * (0.04 + r() * 0.1), rise: 0.22 + r() * 0.35, bob: r() * 6.28,
          v: r() < 0.16 ? [0.5, 0.5] : [r() < 0.5 ? 0 : 0.5, 0], red: z > -4 && r() < 0.08 ? 1 : 0,
          ox: 0, oy: 0, vx: 0, vy: 0, d: 0 });
      }
    };
    const m = low ? 0.55 : 1;
    add(Math.round(40 * m), -10, -4, 7, 11, 0.2, 0.42);    // deep haze
    add(Math.round(70 * m), -4, 1.5, 4.5, 8, 0.3, 0.55);   // the body of the smoke
    add(Math.round(22 * m), 1.5, 4.5, 3, 5, 0.12, 0.24);   // thin smoke drifting in front
    for (const p of puffs) p.d = Math.min(1, Math.hypot(p.x, p.y - SKY_Y, p.z) / 16) * DELAY * 0.8 + r() * DELAY * 0.2;
    const n = puffs.length;
    const geo = new THREE.InstancedBufferGeometry(); geo.copy(new THREE.PlaneGeometry(1, 1)); geo.instanceCount = n;
    const at = (k, size) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(n * size), size); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, a); return a; };
    const A = { aC: at("aC", 3), aS: at("aS", 1), aR: at("aR", 1), aA: at("aA", 1), aG: at("aG", 1), aT: at("aT", 1), aV: at("aV", 2) };
    const tex = new THREE.DataTexture(new Uint8Array(4), 1, 1);   // filled in when the worker is done
    const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: { uMap: { value: tex } }, transparent: true, depthWrite: false });
    return { puffs, geo, mat, A, n, pos: puffs.map(() => new THREE.Vector3()), size: new Float32Array(n), alpha: new Float32Array(n), green: new Float32Array(n),
      order: puffs.map((_, i) => i), depth: new Float32Array(n), tagDelay: CHEMS.map((c, i) => 0.12 + (i % 4) * 0.07) };
  }, [low]);

  useEffect(() => { tags.current = [...document.querySelectorAll("[data-chem]")]; }, []);
  useEffect(() => {
    let alive = true;
    cloudPixels().then(({ data, size }) => {
      if (!alive) return;
      // a texture can't change size after its first upload: swap in a new one
      const old = P.mat.uniforms.uMap.value, tex = new THREE.DataTexture(new Uint8Array(data.buffer), size, size);
      tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.anisotropy = 4;
      tex.needsUpdate = true; P.mat.uniforms.uMap.value = tex; old.dispose();
    });
    return () => { alive = false; };
  }, [P]);
  useEffect(() => {
    const move = e => { if (e.pointerType !== "mouse") return; mouse.current.x = (e.clientX / innerWidth) * 2 - 1; mouse.current.y = -(e.clientY / innerHeight) * 2 + 1; mouse.current.on = true; };
    const leave = () => { mouse.current.on = false; };
    addEventListener("pointermove", move, { passive: true }); document.documentElement.addEventListener("pointerleave", leave);
    return () => { removeEventListener("pointermove", move); document.documentElement.removeEventListener("pointerleave", leave); };
  }, []);

  const v = useMemo(() => new THREE.Vector3(), []), ray = useMemo(() => new THREE.Vector3(), []);
  // home position -> position on the vortex for this puff's share of the pull
  const swirl = (out, x, y, z, q, turn) => {
    const e = q * q * (3 - 2 * q);
    const r0 = Math.hypot(x, z), th = Math.atan2(z, x) + e * turn, h = (y - MOUTH.y) * Math.pow(1 - e, 1.15);
    const r = r0 * Math.pow(1 - e, 1.4) + 0.05;
    out.set(Math.cos(th) * r, MOUTH.y + h, Math.sin(th) * r);
    return e;
  };

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05), t = state.clock.elapsedTime, still = store.get().reducedMotion;
    const pull = I.pull, open = I.open ?? 1, cam = state.camera;
    const { puffs, A, n } = P;
    // the cursor as a ray into the scene (pushes the smoke on whatever depth it sits)
    const mo = mouse.current, push = mo.on && pull < 0.05 && !still;
    if (push) ray.set(mo.x, mo.y, 0.5).unproject(cam).sub(cam.position).normalize();
    const thick = sstep(0, 0.45, open) * (1 + 0.7 * (1 - open));   // rolls in thick, then settles
    let any = false;
    for (let i = 0; i < n; i++) {
      const p = puffs[i];
      const span = Y1 - Y0, yy = still ? p.y : Y0 + ((((p.y - Y0) + t * p.rise) % span) + span) % span;
      const x = p.x + (still ? 0 : Math.sin(t * 0.3 + p.bob) * 0.6);
      // cursor: push out with a little swirl, spring back home (as on the beta)
      let ax = -p.ox * 1.1, ay = -p.oy * 1.1;
      if (push) {
        const k = (p.z - cam.position.z) / ray.z, mx = cam.position.x + ray.x * k, my = cam.position.y + ray.y * k;
        const R = 2.6 * Math.max(0.6, (cam.position.z - p.z) / 16);
        const dx = x + p.ox - mx, dy = yy + p.oy - my, d = Math.hypot(dx, dy);
        if (d < R && d > 1e-3) { const f = (1 - d / R) ** 2 * 26; ax += dx / d * f - dy / d * f * 0.35; ay += dy / d * f + dx / d * f * 0.35; }
      }
      p.vx = (p.vx + ax * dt) * Math.exp(-2.4 * dt); p.vy = (p.vy + ay * dt) * Math.exp(-2.4 * dt);
      p.ox += p.vx * dt; p.oy += p.vy * dt;
      const q = Math.min(1, Math.max(0, (pull * (1 + DELAY) - p.d) * 1.05));
      swirl(P.pos[i], x + p.ox, yy + p.oy, p.z, q * 0.7, 1.6 + (i % 5) * 0.2);   // leans into the vortex, thinning into the strands
      const life = (yy - Y0) / (Y1 - Y0);
      P.size[i] = p.s * (0.8 + 0.45 * life) * (1 - 0.55 * q);                     // smoke spreads as it rises
      const band = sstep(0, 0.12, life) * (1 - sstep(0.82, 1, life));
      const ell = Math.hypot(x / 7.5, (yy - SKY_Y) / 2.7);
      const pocket = 0.5 + 0.5 * sstep(0.45, 1.05, ell);                          // thinner over the words
      P.alpha[i] = p.a * band * pocket * thick * (1 - sstep(0.3, 0.95, q));
      P.green[i] = sstep(0.3, 0.9, q) * 0.4;
      if (P.alpha[i] > 0.003) any = true;
      v.copy(P.pos[i]).applyMatrix4(cam.matrixWorldInverse); P.depth[i] = v.z;
    }
    mesh.current.visible = any;
    if (any) {
      P.order.sort((a, b) => P.depth[a] - P.depth[b]);          // far first
      for (let s = 0; s < n; s++) {
        const i = P.order[s], p = puffs[i], c = P.pos[i];
        A.aC.setXYZ(s, c.x, c.y, c.z); A.aS.setX(s, P.size[i]); A.aR.setX(s, p.rot + (still ? 0 : t * p.spin) + pull * 2.0);
        A.aA.setX(s, P.alpha[i]); A.aG.setX(s, P.green[i]); A.aT.setX(s, p.red); A.aV.setXY(s, p.v[0], p.v[1]);
      }
      for (const k in A) A[k].needsUpdate = true;
    }
    // chemical labels: same vortex, drawn into the mouth slightly ahead of the smoke around them
    const W = state.size.width, H = state.size.height;
    for (let i = 0; i < tags.current.length; i++) {
      const el = tags.current[i], c = CHEMS[i]; if (!el || !c) continue;
      const bob = still ? 0 : Math.sin(t * 0.5 + i * 1.7) * 0.18;
      const q = Math.min(1, Math.max(0, pull * (1 + DELAY) - P.tagDelay[i]));
      const e = swirl(v, c.at[0] + (still ? 0 : Math.sin(t * 0.13 + i) * 0.3), c.at[1] + bob, c.at[2], q, 2.8);
      const dist = v.distanceTo(cam.position);
      v.project(cam);
      const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H;
      const k = Math.min(1.3, 16 / dist) * (1 - 0.8 * e);
      const op = v.z < 1 ? (1 - sstep(0.55, 0.9, e)) * Math.min(1, 16 / dist) : 0;
      el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) scale(${k.toFixed(3)})`;
      el.style.opacity = (op * (store.get().stageReady ? 1 : 0)).toFixed(3);
    }
  });

  return <mesh ref={mesh} geometry={P.geo} material={P.mat} frustumCulled={false} renderOrder={3} />;
}

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
