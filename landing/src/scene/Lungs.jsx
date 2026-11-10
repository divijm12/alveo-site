// The mechanical lungs: a machined lung-shaped chassis (the physics wall, extruded), 212 sockets, and in each one
// a glowing glass bead = one dot of the Alveo logo (same position, size and red fade). Beads read the simulation
// every frame: a hit flashes white-hot, pops and goes out (a dark remnant stays in the socket), scorched
// neighbours dim and brown; `heal` (scroll) relights them in a scattered order.
import { useMemo, useRef, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import lung from "../data/lung.json";
import { toWorld, S } from "../sim/LungSim.js";
import { store } from "../store.js";

const PLATE_Z = -0.3;
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
const HOT = new THREE.Color(1, 0.55, 0.32);
const ASH = new THREE.Color("#1a0606");
const SCORCH = new THREE.Color("#3a0a08");

const beadVert = /* glsl */ `
attribute vec3 aColor; attribute float aGlow; attribute float aHeat;
varying vec3 vN; varying vec3 vV; varying vec3 vColor; varying float vGlow; varying float vHeat;
void main() {
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  vV = -mv.xyz; vColor = aColor; vGlow = aGlow; vHeat = aHeat;
  gl_Position = projectionMatrix * mv;
}`;
const beadFrag = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec3 vColor; varying float vGlow; varying float vHeat;
uniform float uTime;
void main() {
  vec3 N = normalize(vN), V = normalize(vV);
  float nv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - nv, 3.0);
  vec3 L = normalize(vec3(-0.45, 0.75, 0.5));
  float spec = pow(clamp(dot(reflect(-L, N), V), 0.0, 1.0), 60.0);
  // lit-from-inside glass: brighter core, darker rim (reads as a lens, not a flat disc)
  float core = 0.38 + 0.62 * pow(nv, 1.4);
  vec3 col = vColor * core * vGlow;
  col += vColor * fres * 0.7 * min(vGlow, 1.2);
  col += HOTC * vHeat * vHeat * 3.0;                         // white-hot flash on impact
  col += vec3(0.9, 0.92, 1.0) * spec * (0.25 + 0.35 * min(vGlow, 1.0));   // glassy highlight (also on dead beads)
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
  #include <colorspace_fragment>
}`.replace("HOTC", "vec3(1.0, 0.62, 0.38)");

function roundedStroke(x1, y1, x2, y2, w) {                    // a stroke of the logo's airway as a flat capsule
  const [ax, ay] = toWorld(x1, y1), [bx, by] = toWorld(x2, y2), r = (w / 2) * S;
  const len = Math.hypot(bx - ax, by - ay), shape = new THREE.Shape();
  shape.absarc(0, 0, r, Math.PI / 2, -Math.PI / 2, false); shape.lineTo(len, -r);
  shape.absarc(len, 0, r, -Math.PI / 2, Math.PI / 2, false); shape.lineTo(0, r);
  const g = new THREE.ShapeGeometry(shape, 12);
  g.rotateZ(Math.atan2(by - ay, bx - ax)); g.translate(ax, ay, 0);
  return g;
}

export default function Lungs({ simRef }) {
  const beads = useRef(), sockets = useRef(), inlayMat = useRef(), beadMat = useRef(), railMat = useRef();
  const n = lung.dots.length;

  const { beadGeo, socketGeo, plateGeo, inlayGeo, railGeo, attrs, base, order } = useMemo(() => {
    const beadGeo = new THREE.SphereGeometry(1, 28, 18); beadGeo.scale(1, 1, 0.62);
    // machined socket: a lathe profile (outer chamfer, lip, recessed floor), axis along +Z
    const prof = [[0, -0.2], [0.98, -0.2], [1.06, -0.1], [1.2, 0.0], [1.24, 0.08], [1.16, 0.16], [1.04, 0.12], [1.0, 0.02], [0, 0.02]]
      .map(([r, h]) => new THREE.Vector2(r, h));
    const socketGeo = new THREE.LatheGeometry(prof, 40); socketGeo.rotateX(Math.PI / 2);
    // chassis = the physics wall, extruded with a bevel so its edge catches the light
    const shape = new THREE.Shape(lung.wall.map(([x, y]) => new THREE.Vector2(...toWorld(x, y))).reverse());
    const plateGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4, curveSegments: 1 });
    const inlayGeo = mergeGeos([
      roundedStroke(512, 205, 512, 420, lung.airway[0].w),
      roundedStroke(512, 414, 452, 478, lung.airway[1].w),
      roundedStroke(512, 414, 572, 478, lung.airway[1].w),
    ]);
    const fadeA = new THREE.Color(lung.fade.from), fadeB = new THREE.Color(lung.fade.to);
    const base = lung.dots.map(d => fadeA.clone().lerp(fadeB, (d.y - lung.fade.y1) / (lung.fade.y2 - lung.fade.y1)));
    // heal order: scattered but drifting top -> bottom, so recovery looks organic
    const order = lung.dots.map((d, i) => 0.62 * frac(Math.sin(i * 127.1 + 3.7) * 43758.5453) + 0.38 * ((d.y - 300) / 530));
    const attrs = { aColor: new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3), aGlow: new THREE.InstancedBufferAttribute(new Float32Array(n), 1), aHeat: new THREE.InstancedBufferAttribute(new Float32Array(n), 1) };
    Object.values(attrs).forEach(a => a.setUsage(THREE.DynamicDrawUsage));
    Object.entries(attrs).forEach(([k, a]) => beadGeo.setAttribute(k, a));
    // rail along the chassis edge: keeps the lung silhouette readable however much is lost
    const curve = new THREE.CatmullRomCurve3(lung.wall.map(([x, y]) => new THREE.Vector3(...toWorld(x, y), 0)), true, "centripetal");
    const railGeo = new THREE.TubeGeometry(curve, 700, 0.016, 6, true);
    return { beadGeo, socketGeo, plateGeo, inlayGeo, railGeo, attrs, base, order };
  }, [n]);

  useLayoutEffect(() => {
    lung.dots.forEach((d, i) => {
      const [x, y] = toWorld(d.x, d.y), r = d.r * S;
      sockets.current.setMatrixAt(i, tmpM.compose(tmpP.set(x, y, -0.06), tmpQ.identity(), tmpS.setScalar(r)));
      beads.current.setMatrixAt(i, tmpM.compose(tmpP.set(x, y, 0), tmpQ.identity(), tmpS.setScalar(r * 0.9)));
    });
    sockets.current.instanceMatrix.needsUpdate = true; beads.current.instanceMatrix.needsUpdate = true;
    sockets.current.computeBoundingSphere(); beads.current.computeBoundingSphere();
  }, []);

  const c = new THREE.Color();
  useFrame((state, dt) => {
    const sim = simRef.current; if (!sim) return;
    const { heal, phase } = store.get();
    const t = sim.time, idle = phase === "idle" || phase === "loading" || phase === "docking";
    const breathe = 1 + Math.sin(state.clock.elapsedTime * 1.3) * 0.06;  // slow idle "breathing" of the glow
    for (let i = 0; i < n; i++) {
      const d = sim.dots[i];
      const healed = smooth(order[i] - 0.06, order[i] + 0.06, heal * 1.12);   // 0..1 for this dot
      let health = d.alive ? d.health : 0;
      health = health + (1 - health) * healed;
      const sinceKill = d.alive ? 99 : t - d.killedAt;
      // size: pop on kill, then shrink to a dark remnant; healed beads grow back
      let s = 1;
      if (!d.alive) { const pop = sinceKill < 0.07 ? 1 + sinceKill * 5 : Math.max(0.58, 1.35 - (sinceKill - 0.07) * 4.5); s = pop + (1 - pop) * healed; }
      const r = d.r * 0.9 * s;
      beads.current.setMatrixAt(i, tmpM.compose(tmpP.set(d.x, d.y, 0), tmpQ.identity(), tmpS.setScalar(r)));
      // colour: logo red -> scorched brown -> ash for dead ones
      c.copy(base[i]);
      if (health < 1) c.lerp(SCORCH, (1 - health) * 0.85);
      if (!d.alive && healed < 1) c.lerp(ASH, 1 - healed);
      const ember = d.alive ? 0 : Math.exp(-sinceKill / 0.9) * (1 - healed);
      attrs.aColor.setXYZ(i, c.r + ember * 0.9, c.g + ember * 0.08, c.b + ember * 0.05);
      const glow = d.alive || healed > 0 ? (0.25 + 0.95 * health) * (idle ? breathe : 1) * (store.get().quality === "low" ? 1.05 : 1) : 0.16 + ember * 2.4;
      attrs.aGlow.setX(i, glow * 1.08);
      attrs.aHeat.setX(i, Math.max(d.heat * (1 - healed), !d.alive && sinceKill < 0.12 ? 1 : 0));
    }
    beads.current.instanceMatrix.needsUpdate = true;
    attrs.aColor.needsUpdate = attrs.aGlow.needsUpdate = attrs.aHeat.needsUpdate = true;
    // airway inlay pulses while balls are in it, and dims with the damage
    const lost = sim.destroyed / n * (1 - heal);
    const busy = sim.balls.some(b => b.alive && b.y > 1.2) ? 1 : 0;
    inlayMat.current.uniforms.uBusy.value += (busy - inlayMat.current.uniforms.uBusy.value) * Math.min(1, dt * 6);
    inlayMat.current.uniforms.uTime.value = state.clock.elapsedTime;
    inlayMat.current.uniforms.uLevel.value = 1 - lost * 0.8;
    railMat.current.emissiveIntensity = 0.3 + 0.35 * (1 - lost) + busy * 0.25;
  });

  return (
    <group>
      <mesh geometry={plateGeo} position={[0, 0, PLATE_Z - 0.14]} receiveShadow>
        <meshPhysicalMaterial color="#0c0c0f" metalness={0.75} roughness={0.42} clearcoat={0.35} clearcoatRoughness={0.4} />
      </mesh>
      <mesh geometry={railGeo} position={[0, 0, PLATE_Z + 0.06]}>
        <meshStandardMaterial ref={railMat} color="#3a3a42" metalness={1} roughness={0.22} emissive="#ff2d2d" emissiveIntensity={0.55} />
      </mesh>
      <mesh geometry={inlayGeo} position={[0, 0, -0.035]}>  {/* under the beads, over the sockets: as in the logo */}
        <shaderMaterial ref={inlayMat}
          uniforms={{ uTime: { value: 0 }, uBusy: { value: 0 }, uLevel: { value: 1 } }}
          vertexShader={`varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`}
          fragmentShader={`varying vec3 vP; uniform float uTime, uBusy, uLevel;
            void main(){ float flow = 0.5 + 0.5 * sin(vP.y * 9.0 + uTime * 5.0);
              float a = 0.55 + 0.25 * flow * (0.3 + uBusy);
              vec3 col = mix(vec3(0.55, 0.02, 0.03), vec3(1.0, 0.12, 0.07), 0.4 + 0.6 * uBusy) * (0.9 + 1.6 * uBusy) * uLevel;
              gl_FragColor = vec4(col * a, 1.0);
              #include <colorspace_fragment>
            }`} />
      </mesh>
      <instancedMesh ref={sockets} args={[socketGeo, undefined, n]} frustumCulled={false}>
        <meshStandardMaterial color="#17171b" metalness={0.92} roughness={0.32} />
      </instancedMesh>
      <instancedMesh ref={beads} args={[beadGeo, undefined, n]} frustumCulled={false}>
        <shaderMaterial ref={beadMat} vertexShader={beadVert} fragmentShader={beadFrag} uniforms={{ uTime: { value: 0 } }} />
      </instancedMesh>
    </group>
  );
}

const frac = x => x - Math.floor(x);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function mergeGeos(geos) {                                     // tiny merge for non-indexed-compatible ShapeGeometries
  const pos = [], idx = []; let off = 0;
  for (const g of geos) { const p = g.attributes.position.array; for (let i = 0; i < p.length; i++) pos.push(p[i]); for (const k of g.index.array) idx.push(k + off); off += p.length / 3; g.dispose(); }
  const out = new THREE.BufferGeometry(); out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); out.setIndex(idx); return out;
}
export { PLATE_Z };
