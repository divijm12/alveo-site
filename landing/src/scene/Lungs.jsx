// The lungs as living tissue: a dark, wet lung-shaped membrane (the logo's wall, extruded) laced with capillaries,
// and on it 212 soft air sacs, one per logo dot (same position, size and red fade). Everything reads the poison
// simulation every frame:
//   - sacs soak up the toxin from the rim inward (sickly bile green), flare acid-green at the moment they die,
//     then shrivel into wrinkled, oily black husks with a thin-film sheen;
//   - the membrane draws the toxin field (a small canvas, one soft blob per sac): poison runs ahead along the
//     capillaries as glowing threads, a dull stain follows, tar is left where tissue died.
// `heal` (scroll) washes it out again in a scattered order and the sacs plump back up.
import { useMemo, useRef, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import lung from "../data/lung.json";
import { toWorld, S } from "../sim/LungSim.js";
import { store } from "../store.js";

const PLATE_Z = -0.3;
const FACE_Z = PLATE_Z + 0.06;                                   // the membrane sits on the plate's front face
const BOX = { x: -3.1, y: -3.1, w: 6.2, h: 7.6 };                // world area covered by the toxin field
const FW = 128, FH = Math.round(FW * BOX.h / BOX.w);
const Z = new THREE.Vector3(0, 0, 1);
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();

const NOISE = /* glsl */ `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
float h31(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
const vec3 ACID = vec3(0.62, 1.0, 0.12);
`;

const sacVert = /* glsl */ `
attribute vec3 aColor; attribute float aTox; attribute float aDead; attribute float aSeed; attribute float aBurn;
uniform float uTime;
varying vec3 vN; varying vec3 vV; varying vec3 vColor; varying float vTox; varying float vDead; varying float vSeed; varying float vBurn; varying vec3 vO;
${NOISE}
void main() {
  vec3 p = position; vO = position;
  // a soft, uneven sac that breathes; dead ones collapse and wrinkle
  float lump = n3(p * 2.0 + aSeed * 7.0 + uTime * 0.2);
  float bud = n3(p * 4.6 + aSeed * 11.0);                       // smaller sacs budding off (grape-like)
  float wrinkle = n3(p * 7.0 + aSeed * 3.0);
  float swell = 1.0 + 0.05 * sin(uTime * 1.3 + aSeed * 6.283) * (1.0 - aDead);
  p *= swell * (1.0 + (lump - 0.5) * 0.3 + (bud - 0.5) * 0.14 - aDead * (0.3 + 0.38 * wrinkle));
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  vV = -mv.xyz; vColor = aColor; vTox = aTox; vDead = aDead; vSeed = aSeed; vBurn = aBurn;
  gl_Position = projectionMatrix * mv;
}`;
const sacFrag = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec3 vColor; varying float vTox; varying float vDead; varying float vSeed; varying float vBurn; varying vec3 vO;
uniform float uTime;
${NOISE}
void main() {
  float mott = n3(vO * 5.0 + vSeed * 13.0), blot = n3(vO * 3.2 + vSeed * 29.0 + 4.0);
  vec3 N = normalize(vN), V = normalize(vV);
  float nv = clamp(dot(N, V), 0.0, 1.0), fres = pow(1.0 - nv, 2.5);
  vec3 L = normalize(vec3(-0.45, 0.75, 0.5));
  float wrap = clamp((dot(N, L) + 0.5) / 1.5, 0.0, 1.0);
  float spec = pow(clamp(dot(reflect(-L, N), V), 0.0, 1.0), 42.0);
  // healthy: flesh lit from within (warm core, deep rim), a wet highlight
  vec3 meat = mix(vColor, vec3(0.42, 0.06, 0.07), 0.45);
  vec3 flesh = meat * (0.28 + 0.5 * wrap) * (0.18 + 0.95 * pow(nv, 1.6)) * (0.62 + 0.6 * mott);   // lit from within, mottled; the rim sinks into the tissue
  // poisoned: soaks in from the rim in blotches, the flesh bruising to a sallow, dark bile
  float soak = smoothstep(0.04, 0.85, vTox + (1.0 - nv) * 0.4 * vTox + (blot - 0.5) * 0.5 * vTox);
  vec3 bile = mix(vec3(0.07, 0.085, 0.01), vec3(0.03, 0.02, 0.006), mott) * (0.4 + 0.9 * wrap);
  vec3 col = mix(flesh, bile, soak * 0.95);
  float front = smoothstep(0.2, 0.6, vTox) * (1.0 - smoothstep(0.8, 1.02, vTox));
  float sick = smoothstep(0.55, 0.75, blot) * 0.5 + fres * 0.9;   // glows at the rim and in spots, not all over
  col += ACID * front * sick * (0.75 + 0.25 * sin(uTime * 5.0 + vSeed * 30.0));
  // dead: a near-black husk with an oil-slick sheen
  vec3 film = 0.5 + 0.5 * cos(6.283 * (fres * 1.4 + vSeed + vec3(0.0, 0.33, 0.67)));
  vec3 husk = vec3(0.05, 0.05, 0.018) * (0.4 + 1.2 * wrap) + film * vec3(0.5, 0.7, 0.4) * (fres * 0.3 + spec * 0.9);
  col = mix(col, husk, vDead);
  col += ACID * vBurn * (0.6 + 1.6 * fres);                   // the moment it dies
  col += vec3(1.0, 0.92, 0.88) * spec * 0.09 * (1.0 - vDead) * (1.0 - soak * 0.5);   // wet, not glossy
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
  #include <colorspace_fragment>
}`;

const membraneVert = /* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const membraneFrag = /* glsl */ `
varying vec2 vP; uniform sampler2D uField; uniform vec4 uBox; uniform float uTime; uniform float uHealthy;
${NOISE}
void main() {
  vec4 F = texture2D(uField, (vP - uBox.xy) / uBox.zw);
  float tox = F.r, dead = F.g;
  vec2 q = vP * 1.5;
  vec2 w = vec2(fbm(q + vec2(0.0, uTime * 0.035)), fbm(q + vec2(5.2, 1.3) - uTime * 0.025));
  float n = fbm(q * 1.25 + w * 1.7);
  float vein = pow(1.0 - abs(n * 2.0 - 1.0), 12.0);                     // thick vessels
  float fine = pow(1.0 - abs(fbm(q * 3.2 + w * 2.6) * 2.0 - 1.0), 16.0); // capillaries
  vec3 tissue = vec3(0.03, 0.004, 0.006) + vec3(0.26, 0.016, 0.024) * (vein * 0.6 + fine * 0.3) * (0.6 + 0.4 * uHealthy);
  // the stain spreads unevenly; the poison runs ahead of it along the vessels
  float reach = smoothstep(0.1, 0.75, tox + (n - 0.5) * 0.7);
  float run = smoothstep(0.02, 0.25, tox * (0.55 + 0.9 * vein));
  vec3 col = mix(tissue, vec3(0.035, 0.042, 0.006) + vec3(0.1, 0.13, 0.015) * fine, reach * 0.92);
  float edge = reach * (1.0 - reach) * 4.0;
  float pulse = 0.7 + 0.3 * sin(uTime * 2.4 - tox * 7.0 + n * 6.0);
  col += ACID * (vein * 1.1 + fine * 0.55) * run * (0.18 + 0.85 * edge) * pulse * (1.0 - dead * 0.85);
  // where tissue died: tar
  col = mix(col, vec3(0.006, 0.008, 0.003) + ACID * fine * 0.02, smoothstep(0.1, 0.8, dead) * 0.85);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

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
  const sacs = useRef(), inlayMat = useRef(), sacMat = useRef(), memMat = useRef(), railMat = useRef(), group = useRef();
  const n = lung.dots.length;

  const { sacGeo, plateGeo, memGeo, inlayGeo, railGeo, attrs, base, order, field } = useMemo(() => {
    const sacGeo = new THREE.IcosahedronGeometry(1, 4); sacGeo.scale(1, 1, 0.42);
    const shape = new THREE.Shape(lung.wall.map(([x, y]) => new THREE.Vector2(...toWorld(x, y))).reverse());
    const plateGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4, curveSegments: 1 });
    const memGeo = new THREE.ShapeGeometry(shape);
    const inlayGeo = mergeGeos([
      roundedStroke(512, 205, 512, 420, lung.airway[0].w),
      roundedStroke(512, 414, 452, 478, lung.airway[1].w),
      roundedStroke(512, 414, 572, 478, lung.airway[1].w),
    ]);
    const fadeA = new THREE.Color(lung.fade.from), fadeB = new THREE.Color(lung.fade.to);
    const base = lung.dots.map(d => fadeA.clone().lerp(fadeB, (d.y - lung.fade.y1) / (lung.fade.y2 - lung.fade.y1)));
    // heal order: scattered but drifting top -> bottom, so recovery looks organic
    const order = lung.dots.map((d, i) => 0.62 * frac(Math.sin(i * 127.1 + 3.7) * 43758.5453) + 0.38 * ((d.y - 300) / 530));
    const mk = k => new THREE.InstancedBufferAttribute(new Float32Array(n * k), k).setUsage(THREE.DynamicDrawUsage);
    const attrs = { aColor: mk(3), aTox: mk(1), aDead: mk(1), aBurn: mk(1), aSeed: new THREE.InstancedBufferAttribute(Float32Array.from(lung.dots, (_, i) => frac(Math.sin(i * 91.7) * 4375.85)), 1) };
    Object.entries(attrs).forEach(([k, a]) => sacGeo.setAttribute(k, a));
    // rail along the membrane edge: keeps the lung silhouette readable however much is lost
    const curve = new THREE.CatmullRomCurve3(lung.wall.map(([x, y]) => new THREE.Vector3(...toWorld(x, y), 0)), true, "centripetal");
    const railGeo = new THREE.TubeGeometry(curve, 700, 0.012, 6, true);
    // toxin field: R = poison, G = dead tissue; one soft blob per sac, redrawn only when it changes
    const canvas = document.createElement("canvas"); canvas.width = FW; canvas.height = FH;
    const tex = new THREE.CanvasTexture(canvas); tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    const field = { canvas, ctx: canvas.getContext("2d"), tex, last: -1 };
    return { sacGeo, plateGeo, memGeo, inlayGeo, railGeo, attrs, base, order, field };
  }, [n]);

  useLayoutEffect(() => {
    lung.dots.forEach((d, i) => {
      const [x, y] = toWorld(d.x, d.y);
      const j1 = frac(Math.sin(i * 12.9898) * 43758.5453), j2 = frac(Math.sin(i * 78.233) * 43758.5453), j3 = frac(Math.sin(i * 39.425) * 43758.5453);
      sacs.current.setMatrixAt(i, tmpM.compose(tmpP.set(x + (j1 - 0.5) * 0.05, y + (j2 - 0.5) * 0.05, 0), tmpQ.setFromAxisAngle(Z, j3 * 6.283), tmpS.setScalar(d.r * S * (0.74 + 0.3 * j3))));
    });
    sacs.current.instanceMatrix.needsUpdate = true; sacs.current.computeBoundingSphere();
    drawField(field, [], 0);
  }, [field]);

  const c = new THREE.Color(), eff = useMemo(() => ({ tox: new Float32Array(n), dead: new Float32Array(n) }), [n]);
  useFrame((state, dt) => {
    const sim = simRef.current; if (!sim) return;
    const { phase } = store.get(), heal = phase === "done" ? store.get().heal : 0;   // wash out only after the puff
    const time = state.clock.elapsedTime;
    group.current.scale.setScalar(1 + 0.012 * heal * Math.sin(time * 1.25));     // healed lungs breathe
    const t = sim.time;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const d = sim.dots[i];
      const healed = smooth(order[i] - 0.06, order[i] + 0.06, heal * 1.12);
      const since = d.alive ? 99 : t - d.killedAt;
      const tox = Math.min(1.3, d.tox) * (1 - healed);
      const dead = (d.alive ? 0 : smooth(0, 1.1, since)) * (1 - healed);
      eff.tox[i] = tox; eff.dead[i] = d.alive ? 0 : 1 - healed; sum += tox * 3 + eff.dead[i];
      c.copy(base[i]);
      attrs.aColor.setXYZ(i, c.r, c.g, c.b);
      attrs.aTox.setX(i, tox);
      attrs.aDead.setX(i, dead);
      attrs.aBurn.setX(i, d.alive ? 0 : Math.exp(-since / 0.45) * (1 - healed));
    }
    attrs.aColor.needsUpdate = attrs.aTox.needsUpdate = attrs.aDead.needsUpdate = attrs.aBurn.needsUpdate = true;
    if (Math.abs(sum - field.last) > 1e-3) { drawField(field, sim.dots, eff); field.last = sum; }
    sacMat.current.uniforms.uTime.value = time;
    memMat.current.uniforms.uTime.value = time;
    const lost = sim.destroyed / n * (1 - heal);
    memMat.current.uniforms.uHealthy.value = 1 - lost;
    // the airway carries the vapor: dull red at rest, sick green while the puff runs through it
    const busy = sim.released >= 0 && !sim.finished ? sim.vapor.emit : 0;
    const u = inlayMat.current.uniforms;
    u.uBusy.value += (busy - u.uBusy.value) * Math.min(1, dt * 5);
    u.uTime.value = time; u.uLevel.value = 1 - lost * 0.7;
    railMat.current.emissiveIntensity = 0.12 + 0.3 * (1 - lost);
  });

  return (
    <group ref={group} position={[0, 0.85, 0]}><group position={[0, -0.85, 0]}>
      <mesh geometry={plateGeo} position={[0, 0, PLATE_Z - 0.14]}>
        <meshPhysicalMaterial color="#0b0506" metalness={0.1} roughness={0.5} clearcoat={0.9} clearcoatRoughness={0.25} />
      </mesh>
      <mesh geometry={memGeo} position={[0, 0, FACE_Z]}>
        <shaderMaterial ref={memMat} vertexShader={membraneVert} fragmentShader={membraneFrag}
          uniforms={{ uField: { value: field.tex }, uBox: { value: new THREE.Vector4(BOX.x, BOX.y, BOX.w, BOX.h) }, uTime: { value: 0 }, uHealthy: { value: 1 } }} />
      </mesh>
      <mesh geometry={railGeo} position={[0, 0, FACE_Z + 0.02]}>
        <meshStandardMaterial ref={railMat} color="#2a1a1c" metalness={0.6} roughness={0.35} emissive="#ff2d2d" emissiveIntensity={0.4} />
      </mesh>
      <mesh geometry={inlayGeo} position={[0, 0, FACE_Z + 0.01]}>
        <shaderMaterial ref={inlayMat}
          uniforms={{ uTime: { value: 0 }, uBusy: { value: 0 }, uLevel: { value: 1 } }}
          vertexShader={`varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`}
          fragmentShader={`varying vec3 vP; uniform float uTime, uBusy, uLevel;
            void main(){ float flow = 0.5 + 0.5 * sin(vP.y * 11.0 + uTime * 6.0);
              vec3 rest = vec3(0.26, 0.012, 0.02) * uLevel, sick = vec3(0.5, 0.85, 0.08) * (0.7 + 1.1 * flow);
              gl_FragColor = vec4(mix(rest * (0.75 + 0.15 * flow), sick, uBusy), 1.0);
              #include <colorspace_fragment>
            }`} />
      </mesh>
      <instancedMesh ref={sacs} args={[sacGeo, undefined, n]} frustumCulled={false}>
        <shaderMaterial ref={sacMat} vertexShader={sacVert} fragmentShader={sacFrag} uniforms={{ uTime: { value: 0 } }} />
      </instancedMesh>
    </group></group>
  );
}

// world (x, y) -> field canvas px; one radial blob per sac, added up ("lighter")
function drawField(f, dots, eff) {
  const { ctx } = f, k = FW / BOX.w, R = 0.44 * k;
  ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, FW, FH);
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < dots.length; i++) {
    const tox = eff.tox[i], dead = eff.dead[i]; if (tox < 0.01 && dead < 0.01) continue;
    const x = (dots[i].x - BOX.x) * k, y = (1 - (dots[i].y - BOX.y) / BOX.h) * FH;
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, `rgba(${Math.round(Math.min(1, tox) * 190)},${Math.round(dead * 200)},0,1)`);
    g.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2);
  }
  f.tex.needsUpdate = true;
}

const frac = x => x - Math.floor(x);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function mergeGeos(geos) {                                     // tiny merge for the airway's ShapeGeometries
  const pos = [], idx = []; let off = 0;
  for (const g of geos) { const p = g.attributes.position.array; for (let i = 0; i < p.length; i++) pos.push(p[i]); for (const k of g.index.array) idx.push(k + off); off += p.length / 3; g.dispose(); }
  const out = new THREE.BufferGeometry(); out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); out.setIndex(idx); return out;
}
export { PLATE_Z };
