// The pinballs: white-hot cores with a red halo, a tapered light-trail ribbon and a real point light each (so
// sockets, rings and the chassis catch red as a ball passes). Up to 3 balls; slots are reused per run.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BALL_R } from "../sim/LungSim.js";

const MAX = 3, L = 26;

function glowTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.18, "rgba(255,255,255,.55)"); r.addColorStop(0.45, "rgba(255,255,255,.12)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const coreFrag = /* glsl */ `
varying vec3 vN; varying vec3 vV; uniform float uHeat, uK;
void main() { float nv = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
  vec3 hot = vec3(4.0, 2.2, 1.4) * (1.0 + uHeat), red = vec3(3.2, 0.25, 0.1);
  gl_FragColor = vec4(mix(red, hot, pow(nv, 2.2)) * uK, 1.0); }`;
const coreVert = `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`;
const trailVert = `attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;
const trailFrag = `varying float vT; uniform float uK; void main(){ float a = pow(clamp(1.0 - vT, 0.0, 1.0), 2.2) * uK;
  vec3 c = mix(vec3(2.6, 0.28, 0.12), vec3(1.2, 0.03, 0.02), smoothstep(0.0, 0.3, vT)); gl_FragColor = vec4(c * a, 1.0); }`;

export default function Balls({ simRef }) {
  const tex = useMemo(glowTexture, []);
  const slots = useMemo(() => Array.from({ length: MAX }, () => {
    const g = new THREE.BufferGeometry(), pos = new Float32Array(L * 2 * 3), t = new Float32Array(L * 2), idx = [];
    for (let i = 0; i < L; i++) { t[2 * i] = t[2 * i + 1] = i / (L - 1); if (i < L - 1) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute("aT", new THREE.BufferAttribute(t, 1)); g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
    return { g, hist: new Float32Array(L * 2), n: 0, k: 0, ball: null,
      core: new THREE.ShaderMaterial({ vertexShader: coreVert, fragmentShader: coreFrag, uniforms: { uHeat: { value: 0 }, uK: { value: 0 } } }),
      trail: new THREE.ShaderMaterial({ vertexShader: trailVert, fragmentShader: trailFrag, uniforms: { uK: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }) };
  }), []);
  const refs = useRef([]);

  useFrame((state, rawDt) => {
    const sim = simRef.current; if (!sim) return;
    const dt = Math.min(rawDt, 0.05), time = state.clock.elapsedTime;
    for (let s = 0; s < MAX; s++) {
      const slot = slots[s], r = refs.current[s], b = sim.balls[s];
      if (slot.ball !== b) { slot.ball = b; slot.n = 0; if (b) for (let i = 0; i < L; i++) { slot.hist[2 * i] = b.x; slot.hist[2 * i + 1] = b.y; } }
      const alive = !!b && b.alive;
      slot.k = !b ? 0 : alive ? Math.min(1, slot.k + dt * 8) : Math.max(0, slot.k - dt * 2.2);
      if (b) {                                                   // shift history; dead balls let the tail catch up
        slot.hist.copyWithin(2, 0, (L - 1) * 2); slot.hist[0] = b.x; slot.hist[1] = b.y;
      }
      const k = slot.k, heat = b ? b.heat : 0;
      r.group.visible = k > 0.001;
      if (!r.group.visible) { r.light.intensity = 0; continue; }
      r.core.position.set(b.x, b.y, 0); r.halo.position.set(b.x, b.y, 0.02); r.light.position.set(b.x, b.y, 0.45);
      const flick = 1 + 0.08 * Math.sin(time * 40 + s * 2);
      r.core.scale.setScalar(BALL_R * (alive ? 1 + heat * 0.25 : 0.5 + k * 0.5));
      r.halo.scale.setScalar((0.75 + heat * 0.5) * flick * (alive ? 1 : k));
      r.halo.material.opacity = 0.9 * k;
      slot.core.uniforms.uHeat.value = heat; slot.core.uniforms.uK.value = alive ? 1 : k;
      r.light.intensity = (3.2 + heat * 4) * k * flick;
      // ribbon: offset each history point sideways in the plane, tapering to the tail
      const p = slot.g.attributes.position.array, hst = slot.hist;
      for (let i = 0; i < L; i++) {
        const j = Math.min(i, L - 2), dx = hst[2 * j] - hst[2 * j + 2], dy = hst[2 * j + 1] - hst[2 * j + 3], len = Math.hypot(dx, dy) || 1;
        const w = BALL_R * (0.55 + heat * 0.3) * (1 - i / L);
        const nx = (-dy / len) * w, ny = (dx / len) * w;
        p[6 * i] = hst[2 * i] + nx; p[6 * i + 1] = hst[2 * i + 1] + ny; p[6 * i + 2] = -0.01;
        p[6 * i + 3] = hst[2 * i] - nx; p[6 * i + 4] = hst[2 * i + 1] - ny; p[6 * i + 5] = -0.01;
      }
      slot.g.attributes.position.needsUpdate = true;
      slot.trail.uniforms.uK.value = k;
    }
  });

  // lights live outside the hidden groups: a hidden light would change the light count and recompile every shader
  return slots.map((slot, s) => (<group key={s}>
    <group ref={el => ((refs.current[s] ||= {}).group = el)} visible={false}>
      <mesh ref={el => ((refs.current[s] ||= {}).core = el)} material={slot.core}><sphereGeometry args={[1, 24, 16]} /></mesh>
      <sprite ref={el => ((refs.current[s] ||= {}).halo = el)}>
        <spriteMaterial map={tex} color={[3.0, 0.22, 0.12]} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <mesh geometry={slot.g} material={slot.trail} frustumCulled={false} />
    </group>
    <pointLight ref={el => ((refs.current[s] ||= {}).light = el)} color="#ff2a18" distance={2.6} decay={2} intensity={0} />
  </group>));
}
