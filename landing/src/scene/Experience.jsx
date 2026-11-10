// The 3D stage and its director. Owns the poison simulation, the opening sky (cloud puffs + chemicals), the inhale
// (the sky spirals down into the windpipe's mouth, then the poison runs) and the camera shots, all on GSAP
// timelines. Shots are framed from the viewport's aspect.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette, Noise, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode, BlendFunction } from "postprocessing";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import Studio from "./Studio.jsx";
import Lungs from "./Lungs.jsx";
import Airway from "./Airway.jsx";
import Toxin from "./Toxin.jsx";
import Clouds, { SKY_Y } from "./Clouds.jsx";
import { LungSim } from "../sim/LungSim.js";
import { store, actions } from "../store.js";

const FOV = 35;
const shake = { amp: 0 };            // camera shake (kept for small accents)

// ---------- camera shots (centre + box to fit + sideways shift), from the aspect ratio ----------
function fitDist(w, h, aspect) { const t = Math.tan((FOV * Math.PI) / 360); return Math.max(h / 2 / t, w / 2 / (t * aspect)); }
// The opening sky is centred (the headline sits in the middle of the screen). Every later shot is framed for the
// right side: the story column sits on the left, and useFrame shifts camera + target sideways by `sd` x the
// visible width (a parallel shift, so no extra perspective skew).
const SIDE = 0.235;
const SHOTS = {
  sky: a => { const d = fitDist(15.5, 9.4, a); return { x: 0, y: SKY_Y, z: d, tx: 0, ty: SKY_Y, tz: 0, sd: 0 }; },
  wide: a => { const d = fitDist(5.6, 13.4, a); return { x: d * 0.12, y: 2.3, z: d, tx: 0, ty: 2.75, tz: 0, sd: SIDE }; },
  play: a => { const d = fitDist(5.2, 11.9, a); return { x: d * 0.07, y: -0.05, z: d, tx: 0, ty: 0.2, tz: 0, sd: SIDE }; },
};

export default function Experience() {
  const low = useMemo(() => {
    const coarse = matchMedia("(pointer: coarse)").matches, cores = navigator.hardwareConcurrency || 4;
    const q = coarse || cores <= 4 ? "low" : "high"; store.set({ quality: q }); return q === "low";
  }, []);
  // 1.5x is the ceiling: on a 2x screen that's 44% fewer pixels, invisible under bloom + grain. PerformanceMonitor
  // lowers it further (down to 1x) if frames run slow on this machine.
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.5));
  return (
    <Canvas className="stage" flat dpr={dpr} gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      camera={{ fov: FOV, near: 0.1, far: 90, position: [0, SKY_Y, 16] }}
      onCreated={({ gl }) => { gl.setClearColor("#030304"); gl.debug.checkShaderErrors = import.meta.env.DEV; /* the check blocks on parallel compiles */ }}>
      <PerformanceMonitor flipflops={3} onDecline={() => { store.set({ quality: "low" }); setDpr(d => Math.max(1, +(d - 0.25).toFixed(2))); }} />
      <Suspense fallback={null}>
        <Studio />
        <Director />
      </Suspense>
      <EffectComposer multisampling={low || dpr > 1.2 ? 0 : 2} frameBufferType={THREE.HalfFloatType}>
        <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={low ? 0.9 : 1.15} radius={0.72} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <Vignette offset={0.28} darkness={0.78} />
        <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.35} />
      </EffectComposer>
    </Canvas>
  );
}

function Director() {
  const { camera, size, gl, scene, setFrameloop } = useThree();
  const content = useRef(), ready = useRef({ sim: false, gpu: false });
  // Shaders compile in parallel, off the main thread, BEFORE the scene is first drawn. Drawing with a shader that isn't
  // compiled yet blocks the page (measured: a 7.7 s freeze at load, 0.1-0.5 s stalls when effects first appear).
  // So: let the studio environment render alone for two frames, then stop drawing, make everything (incl. anything
  // hidden) visible, compileAsync, hide them again and start drawing. The page and cursor stay responsive the
  // whole time; the stage fades in when it's ready.
  useEffect(() => {
    let alive = true, n = 0, raf = 0;
    const go = async () => {
      const shown = [];
      setFrameloop("never");
      content.current.visible = true;
      content.current.traverse(o => { if (!o.visible) { shown.push(o); o.visible = true; } });
      // compile for the same kind of target we draw into (the post-processing buffer), not the screen:
      // the shader variants differ, and compiling for the wrong one just compiles everything twice
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }), prev = gl.getRenderTarget();
      gl.setRenderTarget(rt);
      let job; try { job = gl.compileAsync ? gl.compileAsync(scene, camera) : gl.compile(scene, camera); } finally { gl.setRenderTarget(prev); }
      try { await job; } catch (e) { console.warn(e); }
      rt.dispose();
      shown.forEach(o => (o.visible = false));
      if (!alive) return;
      setFrameloop("always");
      ready.current.gpu = true; becomeReady();
    };
    const wait = () => { if (++n < 3) raf = requestAnimationFrame(wait); else go(); };
    raf = requestAnimationFrame(wait);
    return () => { alive = false; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function becomeReady() {
    if (!ready.current.sim || !ready.current.gpu || store.get().phase !== "loading") return;
    store.set({ phase: "idle", stageReady: true });
    // the reader got ahead of the loading: catch the story up
    const ch = store.get().chapter;
    if (ch === "hero" || ch === "problem") actions.fire(); else if (ch === "solution" || ch === "download") actions.skipToEnd();
  }
  const simRef = useRef(null), dock = useRef({ dock: 0 });
  // animated proxies (GSAP writes, useFrame reads)
  const I = useRef({ pull: 0 }).current;                       // the inhale: 0 = clouds in the sky, 1 = all breathed in
  const C = useRef({ ...SHOTS.sky(size.width / size.height) }).current;
  const shot = useRef("sky"), tl = useRef(null), pointer = useRef({ x: 0, y: 0, sx: 0, sy: 0 });

  const goShot = (name, dur = 2, ease = "power3.inOut", extra = {}) => {
    shot.current = name;
    return gsap.to(C, { ...SHOTS[name](size.width / size.height), duration: dur, ease, overwrite: "auto", ...extra });
  };

  // simulation + event wiring
  useEffect(() => {
    const sim = new LungSim(); simRef.current = sim;
    const offs = [sim.on("kill", e => store.set({ destroyed: e.destroyed })), sim.on("done", () => finish())];
    ready.current.sim = true; becomeReady();
    return () => offs.forEach(f => f());
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

  // the breath: the sky spirals down into the windpipe; as the first of it reaches the mouth, the poison starts
  actions.fire = () => {
    const sim = simRef.current;
    if (!sim || store.get().phase !== "idle") return;
    if (store.get().reducedMotion) { actions.skipToEnd(); return; }
    store.set({ phase: "inhaling" });
    tl.current?.kill();
    const t = gsap.timeline();
    // the cloud starts to turn while we still look at the sky, then the camera follows it down to the mouth
    t.to(I, { pull: 1, duration: 4.2, ease: "power1.in" }, 0)
      .add(goShot("wide", 3.4, "power2.inOut"), 0.5)
      .add(() => { dock.current.dock = 1; }, 1.2)
      .add(() => { store.set({ phase: "running" }); sim.release(); }, 2.9)
      .add(goShot("play", 2.6, "power2.inOut"), 4.3)
      .add(() => { dock.current.dock = 0; }, 5.6);
    tl.current = t;
  };

  actions.skipToEnd = () => {
    const sim = simRef.current;
    if (!sim || store.get().phase !== "idle") return;
    tl.current?.kill(); sim.reset(); sim.runInstant();
    I.pull = 1;
    Object.assign(C, SHOTS.play(size.width / size.height)); shot.current = "play";
    store.set({ phase: "done", destroyed: sim.destroyed });
  };

  // back to the top: the cloud breathes back out of the windpipe and the lungs are clean again
  actions.replay = () => {
    const sim = simRef.current; if (!sim || store.get().phase === "idle" || store.get().phase === "loading") return;
    tl.current?.kill();
    sim.reset(); store.set({ phase: "idle", destroyed: 0 });
    dock.current.dock = 0;
    const still = store.get().reducedMotion;
    gsap.to(I, { pull: 0, duration: still ? 0 : 2.6, ease: "power2.out", overwrite: true });
    if (still) { Object.assign(C, SHOTS.sky(size.width / size.height)); shot.current = "sky"; } else goShot("sky", 2.4, "power3.inOut");
  };

  const look = useMemo(() => new THREE.Vector3(), []);
  if (import.meta.env.DEV) window.__alveo = { camera, C, I, simRef, shake, gl, scene };
  // runs first every frame (see <Rig>): the clouds project the chemical labels with this frame's camera
  const frame = useRef(); frame.current = (state, rawDt) => {
    const dt = Math.min(rawDt, 0.05), t = state.clock.elapsedTime;
    const sim = simRef.current;
    const { heal, phase } = store.get();
    // reader already reached the healing part while the poison still spreads: fast-forward to the end
    if (sim) sim.update(heal > 0.001 && phase === "running" ? dt * 5 : dt);
    // camera: shot + pointer parallax + shake
    const p = pointer.current; p.sx += (p.x - p.sx) * Math.min(1, dt * 3); p.sy += (p.y - p.sy) * Math.min(1, dt * 3);
    shake.amp *= Math.exp(-dt * 5);
    const sx = (Math.sin(t * 61) + Math.sin(t * 37)) * shake.amp * 0.5, sy = (Math.cos(t * 53) + Math.sin(t * 29)) * shake.amp * 0.5;
    const par = shot.current === "sky" ? 0.4 : 0.18;           // the sky has more depth to show off
    const side = -C.sd * 2 * C.z * Math.tan((FOV * Math.PI) / 360) * (size.width / size.height);
    camera.position.set(C.x + side + p.sx * par + sx, C.y - p.sy * par * 0.6 + sy, C.z);
    look.set(C.tx + side + sx * 0.5, C.ty + sy * 0.5, C.tz);
    camera.lookAt(look);
    camera.updateMatrixWorld();
  };

  return (
    <group ref={content} visible={false}>
      <Rig frame={frame} />
      <Airway dockRef={dock} />
      <Lungs simRef={simRef} />
      <Toxin simRef={simRef} />
      <Clouds I={I} />
    </group>
  );
}

// Child effects subscribe before their parent's, so the director's per-frame work lives in this first child:
// it runs before the lungs, vapor and clouds read the camera.
function Rig({ frame }) { useFrame((state, dt) => frame.current(state, dt)); return null; }
