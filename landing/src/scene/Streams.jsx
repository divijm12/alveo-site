// The breath itself: thin filaments of gas drawn out of the cloud and sucked into the windpipe's mouth, the way smoke
// is pulled into a straw: each strand starts wide and faint in the cloud, then tightens into a converging spiral and
// thins to a hairline as it speeds into the mouth.
// Each filament is a fixed 3D curve (the same vortex the labels ride: radius and height shrink, angle winds up). A
// moving window along it ("head" and a tail behind) is what you see, so the gas visibly travels inward. Everything
// runs on the GPU from one uniform (`uPull`); the ribbons are expanded in screen space, so they stay a few pixels
// wide whatever the camera does.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PORT_Y } from "./Airway.jsx";
import { SKY_Y } from "./Clouds.jsx";
import { store } from "../store.js";

const SEG = 90;                       // points along each strand
const MOUTH_Y = PORT_Y + 0.08;

const vert = /* glsl */ `
attribute vec3 aNext; attribute float aSide; attribute float aS; attribute float aDelay; attribute float aLen; attribute float aSeed; attribute float aW;
uniform float uPull; uniform vec2 uView;
varying float vS; varying float vSide; varying float vA; varying float vSeed;
void main() {
  vec4 a = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec4 b = projectionMatrix * modelViewMatrix * vec4(aNext, 1.0);
  vec2 sa = a.xy / a.w * uView * 0.5, sb = b.xy / b.w * uView * 0.5;
  vec2 dir = sb - sa; dir = length(dir) > 1e-4 ? normalize(dir) : vec2(0.0, 1.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float w = aW * mix(3.2, 0.45, pow(aS, 0.7));                // px: a soft band in the cloud, a hairline at the mouth
  a.xy += nrm * aSide * w / (uView * 0.5) * a.w;
  gl_Position = a;
  // the visible window travels from the cloud (s = 0) into the mouth (s = 1) and on, so the tail follows it in
  float head = clamp((uPull * 1.6 - aDelay) * 1.8, 0.0, 1.0 + aLen), tail = head - aLen;
  vA = smoothstep(tail, tail + aLen * 0.55, aS) * (1.0 - smoothstep(head - 0.05, head, aS)) * (1.0 - smoothstep(0.93, 1.0, aS));
  vS = aS; vSide = aSide; vSeed = aSeed;
}`;
const frag = /* glsl */ `
uniform float uTime;
varying float vS; varying float vSide; varying float vA; varying float vSeed;
void main() {
  float prof = pow(max(0.0, 1.0 - abs(vSide)), 1.6);          // soft across the strand (max: no NaN at the very edge)
  float flow = 0.72 + 0.28 * sin(vS * 26.0 - uTime * 9.0 + vSeed * 6.283);
  float a = vA * prof * flow * mix(0.18, 1.0, smoothstep(0.15, 0.8, vS));   // thin and faint in the cloud, denser as it gathers
  if (a < 0.003) discard;
  vec3 smoke = vec3(0.34, 0.345, 0.36), sick = vec3(0.36, 0.52, 0.08);
  gl_FragColor = vec4(mix(smoke, sick, smoothstep(0.45, 0.98, vS)), min(a, 1.0));
}`;

function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

export default function Streams({ I }) {
  const low = store.get().quality === "low";
  const mesh = useRef();
  const { geo, mat } = useMemo(() => {
    const N = low ? 34 : 64, r = rng(11);
    const V = N * SEG * 2;
    const pos = new Float32Array(V * 3), nxt = new Float32Array(V * 3), side = new Float32Array(V), s = new Float32Array(V),
      delay = new Float32Array(V), len = new Float32Array(V), seed = new Float32Array(V), wid = new Float32Array(V), idx = [];
    const p = new THREE.Vector3(), q = new THREE.Vector3();
    for (let f = 0; f < N; f++) {
      // start somewhere in the cloud ring around the words; all strands turn the same way (one vortex)
      const ang = r() * Math.PI * 2, rx = 2.5 + r() * 7, y0 = SKY_Y - 0.2 + Math.sin(ang) * (1.5 + r() * 3.5);
      const x0 = Math.cos(ang) * rx, z0 = (r() - 0.5) * 5;
      const r0 = Math.hypot(x0, z0), th0 = Math.atan2(z0, x0), h0 = y0 - MOUTH_Y, turn = 2.4 + r() * 1.8, ph = r() * 6.283;
      const at = (t, out) => {
        // sink flow: radius and height shrink together (converging, gently curved paths); the swirl winds up near the mouth
        const u = Math.min(1, Math.max(0, t)), w1 = 1 - u, rr = r0 * Math.pow(w1, 1.25) + 0.03 * w1, th = th0 + turn * u * u * u, hh = h0 * Math.pow(w1, 0.9);
        // a lazy meander that dies out as the strand is pulled taut near the mouth
        const wob = Math.sin(u * 7 + ph) * 0.45 * w1 * w1, wob2 = Math.sin(u * 4.3 + ph * 1.7) * 0.35 * w1 * w1;
        return out.set(Math.cos(th) * rr + wob * Math.sin(th), MOUTH_Y + hh + wob2, Math.sin(th) * rr - wob * Math.cos(th));
      };
      const d = r() * 0.55, L = 0.4 + r() * 0.35, sd = r(), w = 0.9 + r() * 1.3;
      for (let k = 0; k < SEG; k++) {
        const t = k / (SEG - 1); at(t, p);
        if (k < SEG - 1) at((k + 1) / (SEG - 1), q); else { at((k - 1) / (SEG - 1), q); q.set(2 * p.x - q.x, 2 * p.y - q.y, 2 * p.z - q.z); }   // past the end: extrapolate (no NaN)
        for (let e = 0; e < 2; e++) {
          const v = (f * SEG + k) * 2 + e;
          pos.set([p.x, p.y, p.z], v * 3); nxt.set([q.x, q.y, q.z], v * 3);
          side[v] = e ? 1 : -1; s[v] = t; delay[v] = d; len[v] = L; seed[v] = sd; wid[v] = w;
        }
        if (k < SEG - 1) { const a = (f * SEG + k) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("aNext", new THREE.BufferAttribute(nxt, 3));
    geo.setAttribute("aSide", new THREE.BufferAttribute(side, 1)); geo.setAttribute("aS", new THREE.BufferAttribute(s, 1));
    geo.setAttribute("aDelay", new THREE.BufferAttribute(delay, 1)); geo.setAttribute("aLen", new THREE.BufferAttribute(len, 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1)); geo.setAttribute("aW", new THREE.BufferAttribute(wid, 1));
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uPull: { value: 0 }, uTime: { value: 0 }, uView: { value: new THREE.Vector2(1, 1) } } });
    return { geo, mat };
  }, [low]);

  useFrame((state) => {
    const u = mat.uniforms;
    u.uPull.value = I.pull; u.uTime.value = state.clock.elapsedTime;
    u.uView.value.set(state.size.width, state.size.height);
    mesh.current.visible = I.pull > 0.001 && I.pull < 0.999;
  });

  return <mesh ref={mesh} geometry={geo} material={mat} frustumCulled={false} renderOrder={4} visible={false} />;
}
