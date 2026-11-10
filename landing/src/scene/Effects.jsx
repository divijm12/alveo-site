// Impact effects, all pooled (no allocation while playing): sparks (additive points), glass shards (instanced),
// shockwave rings in the lung plane, one roaming impact light, and camera shake. The director calls fx.* on
// simulation events.
import { useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { store } from "../store.js";

export const shake = { amp: 0 };
export const fx = { kill() {}, wall() {}, burst() {}, muzzle() {}, clash() {} };

const sparkVert = /* glsl */ `
attribute float aLife; attribute float aSize; varying float vLife; uniform float uScale;
void main() { vLife = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aLife > 0.0 ? min(48.0, aSize * uScale * (0.35 + 0.65 * aLife) / -mv.z) : 0.0; gl_Position = projectionMatrix * mv; }`;
const sparkFrag = /* glsl */ `
varying float vLife;
void main() { vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d); a *= a;
  vec3 hot = vec3(3.2, 1.7, 1.0), red = vec3(2.4, 0.18, 0.06), dark = vec3(0.25, 0.0, 0.0);
  vec3 c = vLife > 0.6 ? mix(red, hot, (vLife - 0.6) / 0.4) : mix(dark, red, vLife / 0.6);
  gl_FragColor = vec4(c * a * vLife, 1.0); }`;
const ringFrag = /* glsl */ `
varying vec2 vUv; uniform float uP, uK;
void main() { float r = length(vUv - 0.5) * 2.0; float w = 0.06 + 0.1 * uP;
  float ring = smoothstep(uP - w, uP, r) * (1.0 - smoothstep(uP, uP + w * 0.35, r));
  float fade = clamp(1.0 - uP, 0.0, 1.0); fade *= fade;
  gl_FragColor = vec4(vec3(2.6, 0.22, 0.12) * ring * fade * uK, 1.0); }`;

export default function Effects() {
  const low = store.get().quality === "low";
  const N = low ? 500 : 1400, NS = low ? 90 : 240, NR = 12;
  const points = useRef(), shards = useRef(), rings = useRef([]), light = useRef();
  const P = useMemo(() => ({
    pos: new Float32Array(N * 3), vel: new Float32Array(N * 3), life: new Float32Array(N), decay: new Float32Array(N), size: new Float32Array(N), next: 0,
    sp: new Float32Array(NS * 3), sv: new Float32Array(NS * 3), sl: new Float32Array(NS), srot: new Float32Array(NS * 3), ss: new Float32Array(NS), snext: 0,
    rp: new Float32Array(NR).fill(1), rk: new Float32Array(NR), rmax: new Float32Array(NR), rnext: 0,
    light: { x: 0, y: 0, k: 0 },
  }), [N, NS]);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(P.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aLife", new THREE.BufferAttribute(P.life, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aSize", new THREE.BufferAttribute(P.size, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
    return g;
  }, [P]);
  const shardGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const ringMats = useMemo(() => Array.from({ length: NR }, () => new THREE.ShaderMaterial({
    uniforms: { uP: { value: 1 }, uK: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`, fragmentShader: ringFrag,
  })), []);

  useLayoutEffect(() => {                                       // colour buffer must exist before the first compile
    shards.current.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NS * 3), 3);
    for (let i = 0; i < NS; i++) shards.current.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
  }, [NS]);

  useEffect(() => {
    const R = Math.random;
    const spark = (x, y, n, speed, spread, dirx = 0, diry = 0, hot = 1) => {
      for (let k = 0; k < n; k++) {
        const i = P.next; P.next = (P.next + 1) % N;
        const a = R() * Math.PI * 2, s = speed * (0.25 + R() * 0.9), z = (R() - 0.3) * spread;
        P.pos[3 * i] = x; P.pos[3 * i + 1] = y; P.pos[3 * i + 2] = 0.05;
        P.vel[3 * i] = Math.cos(a) * s * spread + dirx * s; P.vel[3 * i + 1] = Math.sin(a) * s * spread + diry * s; P.vel[3 * i + 2] = z * s + 0.6 * R();
        P.life[i] = 1; P.decay[i] = (0.9 + R() * 1.6) / hot; P.size[i] = 0.035 * (0.5 + R());
      }
    };
    const shard = (x, y, n, speed) => {
      for (let k = 0; k < n; k++) {
        const i = P.snext; P.snext = (P.snext + 1) % NS; const a = R() * Math.PI * 2, s = speed * (0.3 + R());
        P.sp[3 * i] = x; P.sp[3 * i + 1] = y; P.sp[3 * i + 2] = 0.05;
        P.sv[3 * i] = Math.cos(a) * s; P.sv[3 * i + 1] = Math.sin(a) * s + 0.8; P.sv[3 * i + 2] = 0.4 + R() * 1.4;
        P.srot.set([R() * 6, R() * 6, R() * 6], 3 * i); P.sl[i] = 1; P.ss[i] = 0.018 + R() * 0.03;
      }
    };
    const ring = (x, y, max, k) => {
      const i = P.rnext; P.rnext = (P.rnext + 1) % NR; P.rp[i] = 0; P.rk[i] = k; P.rmax[i] = max;
      rings.current[i].position.set(x, y, 0.03);
    };
    const flash = (x, y, k) => { P.light.x = x; P.light.y = y; P.light.k = Math.max(P.light.k, k); };
    fx.kill = e => { spark(e.x, e.y, low ? 10 : 18, 2.2, 0.8, e.nx * 0.9, e.ny * 0.9); shard(e.x, e.y, low ? 3 : 5, 1.2); ring(e.x, e.y, 0.55, 0.8); flash(e.x, e.y, 4); shake.amp = Math.min(0.05, shake.amp + 0.006); };
    fx.wall = e => { if (e.speed < 2) return; spark(e.x, e.y, low ? 3 : 6, 1.4, 0.7); flash(e.x, e.y, 1.5); };
    fx.clash = e => { spark(e.x, e.y, 12, 2.6, 1); ring(e.x, e.y, 0.4, 0.6); flash(e.x, e.y, 3); };
    fx.burst = e => { spark(e.x, e.y, low ? 60 : 140, 4.2, 1, 0, 0, 0.6); shard(e.x, e.y, low ? 10 : 22, 2.4); ring(e.x, e.y, 2.2, 1.6); ring(e.x, e.y, 1.1, 1); flash(e.x, e.y, 16); shake.amp = Math.min(0.12, shake.amp + 0.08); };
    fx.muzzle = (x, y) => { spark(x, y, low ? 14 : 30, 1.8, 0.6, 0, -1); ring(x, y, 0.5, 0.9); flash(x, y, 6); shake.amp += 0.02; };
    return () => { fx.kill = fx.wall = fx.burst = fx.muzzle = fx.clash = () => {}; };
  }, [P, N, NS, low]);

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), eul = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    for (let i = 0; i < N; i++) {
      if (P.life[i] <= 0) continue;
      P.life[i] = Math.max(0, P.life[i] - dt * P.decay[i]);
      const drag = Math.exp(-dt * 2.2);
      P.vel[3 * i] *= drag; P.vel[3 * i + 1] = P.vel[3 * i + 1] * drag - 5 * dt; P.vel[3 * i + 2] *= drag;
      P.pos[3 * i] += P.vel[3 * i] * dt; P.pos[3 * i + 1] += P.vel[3 * i + 1] * dt; P.pos[3 * i + 2] += P.vel[3 * i + 2] * dt;
    }
    geo.attributes.position.needsUpdate = geo.attributes.aLife.needsUpdate = true;
    points.current.material.uniforms.uScale.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan((state.camera.fov * Math.PI) / 360));
    for (let i = 0; i < NS; i++) {
      const l = P.sl[i];
      if (l <= 0) { shards.current.setMatrixAt(i, m.makeScale(0, 0, 0)); continue; }
      P.sl[i] = Math.max(0, l - dt * 0.7);
      P.sv[3 * i + 1] -= 6 * dt;
      for (let k = 0; k < 3; k++) { P.sp[3 * i + k] += P.sv[3 * i + k] * dt; P.srot[3 * i + k] += dt * (4 + k); }
      eul.set(P.srot[3 * i], P.srot[3 * i + 1], P.srot[3 * i + 2]); q.setFromEuler(eul);
      shards.current.setMatrixAt(i, m.compose(v.set(P.sp[3 * i], P.sp[3 * i + 1], P.sp[3 * i + 2]), q, sc.setScalar(P.ss[i] * (0.4 + 0.6 * l))));
      const e = l * l * l;
      shards.current.setColorAt(i, col.setRGB(0.12 + 3 * e, 0.02 + 0.25 * e, 0.02 + 0.12 * e));
    }
    shards.current.instanceMatrix.needsUpdate = true; if (shards.current.instanceColor) shards.current.instanceColor.needsUpdate = true;
    for (let i = 0; i < NR; i++) {
      const mesh = rings.current[i];
      if (P.rp[i] >= 1) { mesh.visible = false; continue; }
      P.rp[i] = Math.min(1, P.rp[i] + dt * (P.rmax[i] > 1.5 ? 1.25 : 2.6));
      mesh.visible = true; mesh.scale.setScalar(P.rmax[i]);
      ringMats[i].uniforms.uP.value = 1 - Math.pow(1 - P.rp[i], 3); ringMats[i].uniforms.uK.value = P.rk[i];
    }
    P.light.k *= Math.exp(-dt * 9);
    light.current.position.set(P.light.x, P.light.y, 0.6);
    light.current.intensity = P.light.k;
  });

  return (
    <group>
      <points ref={points} geometry={geo} frustumCulled={false}>
        <shaderMaterial vertexShader={sparkVert} fragmentShader={sparkFrag} uniforms={{ uScale: { value: 500 } }}
          transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <instancedMesh ref={shards} args={[shardGeo, undefined, NS]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {ringMats.map((mat, i) => (
        <mesh key={i} ref={el => (rings.current[i] = el)} material={mat} visible={false}><planeGeometry args={[2, 2]} /></mesh>
      ))}
      <pointLight ref={light} color="#ff3020" distance={3.2} decay={2} intensity={0} />
    </group>
  );
}
