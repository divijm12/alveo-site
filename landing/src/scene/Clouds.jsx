// The opening sky: dark grey cloud puffs (camera-facing quads on the procedural atlas, sorted back to front each
// frame). A dark bank far behind, and a dense, brighter ring of billows that closes in around the headline in the
// first seconds (`I.open` 0 -> 1) and then keeps swaying, so the words sit in a hollow inside the cloud. The chemical labels (DOM, see App) float among them: this
// component projects their 3D anchors to the screen every frame.
// `I.pull` (0..1, the director animates it) is the inhale: the puffs lean into the vortex, thin out and dissolve
// while the gas itself is drawn into the windpipe as thin streams (Streams.jsx). The labels ride the vortex all
// the way into the mouth. Pull back to 0 and the cloud gathers again (replay).
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

function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

const vert = /* glsl */ `
attribute vec3 aC; attribute float aS; attribute float aR; attribute float aA; attribute float aG; attribute float aK; attribute vec2 aV;
varying vec2 vUv; varying float vA; varying float vG; varying float vK;
void main() {
  float c = cos(aR), s = sin(aR);
  vec2 p = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * aS;
  vec4 mv = modelViewMatrix * vec4(aC, 1.0); mv.xy += p;
  gl_Position = projectionMatrix * mv;
  vUv = aV + vec2(uv.x, 1.0 - uv.y) * 0.5;      // atlas rows run top-down
  vA = aA; vG = aG; vK = aK;
}`;
const frag = /* glsl */ `
uniform sampler2D uMap; varying vec2 vUv; varying float vA; varying float vG; varying float vK;
void main() {
  vec4 t = texture2D(uMap, vUv);
  float a = t.a * vA; if (a < 0.004) discard;
  vec3 smoke = vec3(0.2, 0.202, 0.215) * t.r * vK;           // linear: reads as the reference's dark greys
  vec3 sick = vec3(0.09, 0.12, 0.02) * (0.5 + t.r);
  gl_FragColor = vec4(mix(smoke, sick, vG), a);
}`;

export default function Clouds({ I }) {
  const low = store.get().quality === "low";
  const mesh = useRef(), tags = useRef([]);
  const P = useMemo(() => {
    const r = rng(7), puffs = [];
    const add = (n, x0, x1, y0, y1, z0, z1, s0, s1, a0, a1, k, ring) => {
      for (let i = 0; i < n; i++) {
        let x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
        if (ring) { const f = (i + r() * 0.8) / n * Math.PI * 2, rx = ring[0] + r() * ring[2], ry = ring[1] + r() * ring[2] * 0.6; x = Math.cos(f) * rx; y = SKY_Y - 0.15 + Math.sin(f) * ry; }
        puffs.push({ ring: !!ring, x, y, z: z0 + r() * (z1 - z0), s: s0 + r() * (s1 - s0),
        a: a0 + r() * (a1 - a0), k: k * (0.85 + r() * 0.3), rot: (r() - 0.5) * 0.7, spin: (r() - 0.5) * 0.03,
        v: [(r() < 0.5 ? 0 : 0.5), (r() < 0.5 ? 0 : 0.5)], wind: 0.08 + r() * 0.1, bob: r() * 6.28, d: 0,
      }); }
    };
    const m = low ? 0.6 : 1;
    // (the opening frame spans about x ±8, y 5.5..15.5 at z = 0; more at the back)
    add(Math.round(22 * m), -15, 15, 7.0, 17, -11, -6, 9, 14, 0.4, 0.7, 0.4);                        // far bank, dark
    add(Math.round(40 * m), 0, 0, 0, 0, -2.5, 1.5, 5.5, 8.5, 0.8, 1.0, 1.15, [8.4, 4.6, 1.8]);       // the ring of billows
    add(Math.round(18 * m), 0, 0, 0, 0, -0.5, 2.2, 3.4, 5.2, 0.45, 0.7, 1.2, [6.3, 3.0, 0.9]);       // inner edge, hugging the words
    add(Math.round(8 * m), -10, 10, 4.5, 15.5, 2.5, 5, 2.6, 4.2, 0.1, 0.2, 1.1);                     // thin wisps in front
    for (const p of puffs) p.d = Math.min(1, Math.hypot(p.x, p.y - SKY_Y, p.z) / 16) * DELAY * 0.8 + r() * DELAY * 0.2;
    const n = puffs.length;
    const geo = new THREE.InstancedBufferGeometry(); geo.copy(new THREE.PlaneGeometry(1, 1)); geo.instanceCount = n;
    const at = (k, size) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(n * size), size); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, a); return a; };
    const A = { aC: at("aC", 3), aS: at("aS", 1), aR: at("aR", 1), aA: at("aA", 1), aG: at("aG", 1), aK: at("aK", 1), aV: at("aV", 2) };
    const tex = new THREE.DataTexture(new Uint8Array(4), 1, 1); tex.anisotropy = 4;   // filled in when the worker is done
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
    const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: { uMap: { value: tex } }, transparent: true, depthWrite: false });
    return { puffs, geo, mat, A, n, pos: puffs.map(() => new THREE.Vector3()), size: new Float32Array(n), alpha: new Float32Array(n), green: new Float32Array(n), order: puffs.map((_, i) => i), depth: new Float32Array(n),
      tagDelay: CHEMS.map((c, i) => 0.12 + (i % 4) * 0.07) };
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

  const v = useMemo(() => new THREE.Vector3(), []);
  // home position (+ drift) -> position on the vortex for this puff's share of the pull
  const swirl = (out, x, y, z, q, turn) => {
    const e = q * q * (3 - 2 * q);
    const r0 = Math.hypot(x, z), th = Math.atan2(z, x) + e * turn, h = (y - MOUTH.y) * Math.pow(1 - e, 1.15);
    const r = r0 * Math.pow(1 - e, 1.4) + 0.05;
    out.set(Math.cos(th) * r, MOUTH.y + h, Math.sin(th) * r);
    return e;
  };

  useFrame((state) => {
    const t = state.clock.elapsedTime, still = store.get().reducedMotion;
    const pull = I.pull, open = I.open ?? 1, cam = state.camera;
    const { puffs, A, n } = P;
    let any = false;
    for (let i = 0; i < n; i++) {
      const p = puffs[i];
      let x = p.x, y = p.y;
      if (p.ring) {                                             // closes in from outside, then sways in place
        const k = 1 + 0.9 * (1 - open);
        x = p.x * k + (still ? 0 : Math.sin(t * 0.17 + p.bob) * 0.35); y = SKY_Y + (p.y - SKY_Y) * k + (still ? 0 : Math.sin(t * 0.23 + p.bob * 1.3) * 0.15);
      } else if (!still) { x = ((p.x + t * p.wind + 18) % 36 + 36) % 36 - 18; y += Math.sin(t * 0.21 + p.bob) * 0.12; }
      const q = Math.min(1, Math.max(0, (pull * (1 + DELAY) - p.d) * 1.05));
      const e = swirl(P.pos[i], x, y, p.z, q * 0.7, 1.6 + (i % 5) * 0.2);    // leans into the vortex, thinning into the strands
      P.size[i] = p.s * (1 - 0.55 * q);
      P.alpha[i] = p.a * (1 - sstep(0.3, 0.95, q)) * Math.min(1, open * 1.4);
      P.green[i] = sstep(0.3, 0.9, q) * 0.4 + 0 * e;
      if (P.alpha[i] > 0.004) any = true;
      v.copy(P.pos[i]).applyMatrix4(cam.matrixWorldInverse); P.depth[i] = v.z;
    }
    mesh.current.visible = any;
    if (any) {
      P.order.sort((a, b) => P.depth[a] - P.depth[b]);          // far (more negative z) first
      for (let s = 0; s < n; s++) {
        const i = P.order[s], p = puffs[i], c = P.pos[i];
        A.aC.setXYZ(s, c.x, c.y, c.z); A.aS.setX(s, P.size[i]); A.aR.setX(s, p.rot + (still ? 0 : t * p.spin) + pull * 2.0);
        A.aA.setX(s, P.alpha[i]); A.aG.setX(s, P.green[i]); A.aK.setX(s, p.k); A.aV.setXY(s, p.v[0], p.v[1]);
      }
      for (const k in A) A[k].needsUpdate = true;
    }
    // chemical labels: same vortex, drawn into the mouth slightly ahead of the cloud around them
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
