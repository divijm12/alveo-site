// The 3D stage and its director. Owns the physics, the vape choreography (float -> swing tip-down -> dock in the
// windpipe port -> fire -> lift away) and the camera shots, all on GSAP timelines. Shots are framed from the
// viewport's aspect so phones get the same composition as desktops.
import { Suspense, forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette, Noise, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode, BlendFunction } from "postprocessing";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import Studio from "./Studio.jsx";
import Lungs from "./Lungs.jsx";
import Airway, { PORT_Y } from "./Airway.jsx";
import Balls from "./Balls.jsx";
import Effects, { fx, shake } from "./Effects.jsx";
import { LungSim, initRapier } from "../sim/LungSim.js";
import { store, actions } from "../store.js";

const vapeMods = import.meta.glob("./Vape.jsx", { eager: true });
const FOV = 35;
export const VAPE_Y = 7.3;          // hero: the vape floats here, well above the windpipe port (y ≈ 4.4)
const TIP = 1.8;                     // distance from the vape's centre to its mouthpiece tip (placeholder; updated from the model)

// ---------- camera shots (centre + box to fit), from the aspect ratio ----------
function fitDist(w, h, aspect) { const t = Math.tan((FOV * Math.PI) / 360); return Math.max(h / 2 / t, w / 2 / (t * aspect)); }
// Every shot is framed for the right side of the screen: the story column sits on the left, and useFrame shifts
// camera + target sideways by SIDE x the visible width (a parallel shift, so no extra perspective skew).
const SIDE = 0.235;
const SHOTS = {
  hero: a => { const d = fitDist(9.4, 5.4, a); return { x: 0, y: VAPE_Y - 0.3, z: d, tx: 0, ty: VAPE_Y - 0.15, tz: 0 }; },
  wide: a => { const d = fitDist(5.6, 13.4, a); return { x: d * 0.12, y: 2.3, z: d, tx: 0, ty: 2.75, tz: 0 }; },
  play: a => { const d = fitDist(5.2, 11.9, a); return { x: d * 0.07, y: 0.45, z: d, tx: 0, ty: 0.7, tz: 0 }; },
};

export default function Experience() {
  const low = useMemo(() => {
    const coarse = matchMedia("(pointer: coarse)").matches, cores = navigator.hardwareConcurrency || 4;
    const q = coarse || cores <= 4 ? "low" : "high"; store.set({ quality: q }); return q === "low";
  }, []);
  const dprRef = useRef(low ? [1, 1.5] : [1, 2]);
  return (
    <Canvas className="stage" flat dpr={dprRef.current} gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      camera={{ fov: FOV, near: 0.1, far: 90, position: [0, VAPE_Y, 14] }}
      onCreated={({ gl }) => { gl.setClearColor("#030304"); }}>
      <PerformanceMonitor onDecline={({ factor }) => store.set({ quality: "low" }) || void factor} />
      <Suspense fallback={null}>
        <Studio />
        <Director />
      </Suspense>
      <EffectComposer multisampling={low ? 0 : 4} frameBufferType={THREE.HalfFloatType}>
        <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={low ? 0.9 : 1.15} radius={0.72} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <Vignette offset={0.28} darkness={0.78} />
        <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.35} />
      </EffectComposer>
    </Canvas>
  );
}

// Stand-in until src/scene/Vape.jsx exists (same API).
const PlaceholderVape = forwardRef(function PlaceholderVape(props, ref) {
  const g = useRef(), m = useRef();
  useImperativeHandle(ref, () => ({ get group() { return g.current; }, setFire: v => m.current && m.current.emissive.setRGB(v * 2, 0, 0), setScreen() {}, setHover() {}, mouthpiece: null }));
  return <group ref={g} {...props}><mesh ref={m}><boxGeometry args={[3.6, 1.25, 0.62]} /><meshStandardMaterial color="#111" metalness={0.8} roughness={0.4} /></mesh></group>;
});
const VapeModel = vapeMods["./Vape.jsx"]?.default ?? PlaceholderVape;

function Director() {
  const { camera, size } = useThree();
  const simRef = useRef(null), vape = useRef(), dock = useRef({ dock: 0 });
  // animated proxies (GSAP writes, useFrame reads)
  const V = useRef({ x: 0, y: VAPE_Y, rz: 0, ry: -0.35, float: 1, fire: 0, hover: 0, scale: 1 }).current;
  const C = useRef({ ...SHOTS.hero(size.width / size.height) }).current;
  const shot = useRef("hero"), tl = useRef(null), pointer = useRef({ x: 0, y: 0, sx: 0, sy: 0 });

  const goShot = (name, dur = 2, ease = "power3.inOut", extra = {}) => {
    shot.current = name;
    return gsap.to(C, { ...SHOTS[name](size.width / size.height), duration: dur, ease, overwrite: "auto", ...extra });
  };

  // physics + event wiring
  useEffect(() => {
    let alive = true;
    initRapier().then(() => {
      if (!alive) return;
      const sim = new LungSim(); simRef.current = sim;
      sim.on("kill", e => { fx.kill(e); store.set({ destroyed: e.destroyed }); });
      sim.on("wall", e => fx.wall(e));
      sim.on("clash", e => fx.clash(e));
      sim.on("burst", e => fx.burst(e));
      sim.on("spawn", b => fx.muzzle(b.x, b.y + 0.05));
      sim.on("done", () => finish());
      if (store.get().reducedMotion) {                        // no motion: show the end state straight away
        sim.runInstant(); V.y = 30; Object.assign(C, SHOTS.play(size.width / size.height)); shot.current = "play";
        store.set({ phase: "done", destroyed: sim.destroyed });
      } else store.set({ phase: "idle" });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the current shot framed on resize
  useEffect(() => {
    if (!gsap.isTweening(C)) Object.assign(C, SHOTS[shot.current](size.width / size.height));
  }, [size.width, size.height]);

  useEffect(() => {
    const move = e => { pointer.current.x = (e.clientX / innerWidth) * 2 - 1; pointer.current.y = (e.clientY / innerHeight) * 2 - 1; };
    addEventListener("pointermove", move, { passive: true });
    return () => removeEventListener("pointermove", move);
  }, []);

  function finish() {
    store.set({ phase: "done" });
    goShot("play", 7, "sine.inOut", { z: SHOTS.play(size.width / size.height).z * 0.95 });
  }

  actions.fire = () => {
    const sim = simRef.current;
    if (!sim || store.get().phase !== "idle") return;
    store.set({ phase: "docking", hoverVape: false });
    document.body.style.cursor = "";
    // after the -90° swing a local tip (mx, my) sits at (x + my, y - mx): seat it a hair inside the port
    const mp = vape.current?.mouthpiece?.position, mx = mp ? mp.x : TIP, my = mp ? mp.y : 0;
    const dockY = PORT_Y + mx - 0.06, dockX = -my;
    tl.current?.kill();
    const t = gsap.timeline();
    t.add(goShot("wide", 1.9), 0)
      .to(V, { float: 0, hover: 0, ry: 0, duration: 0.6, ease: "power2.out" }, 0)
      .to(V, { rz: -Math.PI / 2, duration: 1.2, ease: "power3.inOut" }, 0.1)
      .to(V, { y: dockY + 0.7, x: dockX, duration: 1.2, ease: "power3.inOut" }, 0.1)
      .to(V, { y: dockY, duration: 0.32, ease: "power4.in" }, 1.32)
      .add(() => { shake.amp += 0.06; dock.current.dock = 1; fx.muzzle(0, PORT_Y); vape.current?.setScreen?.("PUFF"); }, 1.64)
      .to(V, { fire: 1, duration: 0.35, ease: "power2.in" }, 1.7)
      .add(() => { store.set({ phase: "running" }); sim.release(); }, 1.95)
      .add(goShot("play", 2.6, "power2.inOut"), 2.5)
      .to(V, { fire: 0, duration: 0.5 }, 2.85)
      .add(() => { dock.current.dock = 0; }, 3.0)
      .to(V, { y: dockY + 9, duration: 2.2, ease: "power2.in" }, 3.0)
      .to(V, { rz: -Math.PI / 2 + 0.5, ry: 0.6, duration: 2.2, ease: "power1.in" }, 3.0);
    tl.current = t;
  };

  actions.skipToEnd = () => {
    const sim = simRef.current;
    if (!sim || store.get().phase !== "idle") return;
    tl.current?.kill(); sim.reset(); sim.runInstant();
    V.y = 40; V.float = 0;
    Object.assign(C, SHOTS.play(size.width / size.height)); shot.current = "play";
    store.set({ phase: "done", destroyed: sim.destroyed, hoverVape: false });
  };

  actions.replay = () => {
    const sim = simRef.current; if (!sim) return;
    tl.current?.kill();
    sim.reset(); store.set({ phase: "idle", destroyed: 0 });
    dock.current.dock = 0; vape.current?.setScreen?.("0.60");
    Object.assign(V, { x: 0, y: VAPE_Y + 4, rz: 0, ry: -0.35, fire: 0, float: 1 });
    gsap.to(V, { y: VAPE_Y, duration: 1.6, ease: "power3.out" });
    goShot("hero", 2, "power3.inOut");
  };

  const look = useMemo(() => new THREE.Vector3(), []);
  if (import.meta.env.DEV) window.__alveo = { camera, C, V, simRef, shake };
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05), t = state.clock.elapsedTime;
    const sim = simRef.current;
    const { hoverVape, heal, phase } = store.get();
    // reader already reached the healing part while balls still fly: fast-forward to the end
    if (sim) sim.update(heal > 0.001 && phase === "running" ? dt * 5 : dt);
    // vape: idle float + pointer tilt, hover glow, fire
    const p = pointer.current; p.sx += (p.x - p.sx) * Math.min(1, dt * 3); p.sy += (p.y - p.sy) * Math.min(1, dt * 3);
    V.hover += ((hoverVape ? 1 : 0) - V.hover) * Math.min(1, dt * 6);
    const v = vape.current?.group;
    if (v) {
      v.position.set(V.x, V.y + Math.sin(t * 1.1) * 0.08 * V.float, 0);
      v.rotation.set(0.12 * V.float + p.sy * 0.16 * V.float, V.ry + Math.sin(t * 0.45) * 0.22 * V.float + p.sx * 0.35 * V.float, V.rz + Math.sin(t * 0.8) * 0.025 * V.float);
      vape.current.setFire?.(V.fire); vape.current.setHover?.(V.hover);
    }
    // camera: shot + scroll-out + pointer parallax + shake
    shake.amp *= Math.exp(-dt * 5);
    const sx = (Math.sin(t * 61) + Math.sin(t * 37)) * shake.amp * 0.5, sy = (Math.cos(t * 53) + Math.sin(t * 29)) * shake.amp * 0.5;
    const par = 0.18;
    const side = -SIDE * 2 * C.z * Math.tan((FOV * Math.PI) / 360) * (size.width / size.height);
    camera.position.set(C.x + side + p.sx * par + sx, C.y - p.sy * par * 0.6 + sy, C.z);
    look.set(C.tx + side + sx * 0.5, C.ty + sy * 0.5, C.tz);
    camera.lookAt(look);
    // the "Take a puff" label follows the vape on screen
    const hint = document.getElementById("vape-anchor");
    if (hint && v) {
      const w = new THREE.Vector3(V.x, V.y - 0.95, 0).project(camera);
      hint.style.transform = `translate(${((w.x + 1) / 2) * size.width}px, ${((1 - w.y) / 2) * size.height}px)`;
    }
  });

  const onOver = e => { e.stopPropagation(); if (store.get().phase === "idle") { store.set({ hoverVape: true }); document.body.style.cursor = "pointer"; } };
  const onOut = () => { store.set({ hoverVape: false }); document.body.style.cursor = ""; };
  const onClick = e => { e.stopPropagation(); actions.fire(); };
  return (
    <>
      <VapeModel ref={vape} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick} />
      <Airway dockRef={dock} />
      <Lungs simRef={simRef} />
      <Balls simRef={simRef} />
      <Effects />
    </>
  );
}
