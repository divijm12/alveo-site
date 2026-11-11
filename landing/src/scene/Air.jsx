// Clean air at Download: a few faint, warm-white motes ride the healthy breath down the windpipe into the two
// bronchi as the lungs fill, and drift back up as they empty (breath.js). Only there (vital.v), never during the
// poison. Kept quiet on purpose: a hint of air, not a particle show.
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { TRACHEA, BRONCHI } from "../sim/LungSim.js";
import { PORT_Y } from "./Airway.jsx";
import { breathAt, vital } from "./breath.js";

const vert = /* glsl */ `
attribute float aA; uniform float uScale; varying float vA;
void main() { vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aA > 0.001 ? min(40.0, 0.06 * uScale / -mv.z) : 0.0; gl_Position = projectionMatrix * mv; }`;
const frag = /* glsl */ `
varying float vA;
void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
  gl_FragColor = vec4(vec3(1.0, 0.86, 0.84) * pow(smoothstep(0.5, 0.0, d), 2.2) * vA, 1.0); }`;

const N = 70, TOP = PORT_Y - 0.25, SPLIT = 0.62;                  // path: windpipe (0 .. SPLIT), then a bronchus

export default function Air() {
  const { gl } = useThree();
  const P = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), a = new Float32Array(N);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aA", new THREE.BufferAttribute(a, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: { uScale: { value: 400 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = Array.from({ length: N }, (_, i) => ({ s: Math.random() * 0.75, side: i % 2, jx: (Math.random() - 0.5) * 0.2, jz: (Math.random() - 0.5) * 0.2,
      lag: Math.random() * 0.5, ph: Math.random() * 6.283 }));
    return { geo, mat, pos, a, m };
  }, []);
  const pts = useRef();

  useFrame((state) => {
    const v = vital.v;
    pts.current.visible = v > 0.01;
    if (!pts.current.visible) return;
    const t = state.clock.elapsedTime;
    P.mat.uniforms.uScale.value = gl.domElement.height * 0.5 * state.camera.projectionMatrix.elements[5];
    for (let i = 0; i < N; i++) {
      const m = P.m[i];
      const s = Math.min(1, m.s + 0.42 * breathAt(t - m.lag));    // in with the breath, back out with it
      let x, y;
      if (s < SPLIT) { const k = s / SPLIT; x = m.jx * 0.6; y = TOP + (TRACHEA.carina - TOP) * k; }
      else { const k = (s - SPLIT) / (1 - SPLIT), [bx, by] = BRONCHI[m.side]; x = bx * k + m.jx * 0.6 * (1 - k); y = TRACHEA.carina + (by - TRACHEA.carina) * k; }
      x += Math.sin(t * 1.7 + m.ph) * 0.02;
      P.pos[3 * i] = x; P.pos[3 * i + 1] = y; P.pos[3 * i + 2] = m.jz * 0.5;
      const ends = Math.min(1, s / 0.08) * (1 - Math.max(0, (s - 0.9) / 0.1));
      P.a[i] = v * 0.55 * ends * (0.75 + 0.25 * Math.sin(t * 3 + m.ph));
    }
    P.geo.attributes.position.needsUpdate = true; P.geo.attributes.aA.needsUpdate = true;
  });

  return <points ref={pts} geometry={P.geo} material={P.mat} frustumCulled={false} renderOrder={2} />;
}
