// The 3D stage and its director. Owns the poison simulation, the opening sky (cloud puffs + chemicals), the inhale
// (the sky spirals down into the windpipe's mouth, then the poison runs) and the camera shots. All of it is a
// function of the scroll (story time, see applyStory; RJ 2026-11-11: "with scroll, not automatically").
// Shots are framed from the viewport's aspect.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette, Noise, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode, BlendFunction } from "postprocessing";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import Studio from "./Studio.jsx";
import Lungs from "./Lungs.jsx";
import Airway from "./Airway.jsx";
import Toxin from "./Toxin.jsx";
import Smoke, { SKY_Y } from "./Smoke.jsx";
import Streams from "./Streams.jsx";
import Markers from "./Markers.jsx";
import { LungSim } from "../sim/LungSim.js";
import { store, live } from "../store.js";
import Callouts from "./Callouts.jsx";

const FOV = 35;
const RELEASE = 2.9;                 // s into the breath when the puff goes down the windpipe
const BREATH = 0.35;                 // share of the story's scroll the breath gets
const clamp01 = x => Math.min(1, Math.max(0, x)), lerp = (a, b, k) => a + (b - a) * k;
const inOut2 = x => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2), inOutSine = x => -(Math.cos(Math.PI * x) - 1) / 2;
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
  }
  const simRef = useRef(null), dock = useRef({ dock: 0 });
  // what the frame loop drives (Smoke / Streams read I): open = the cloud rolling in as the landing scrolls away,
  // pull = the inhale (1 = all breathed in)
  const I = useRef({ pull: 0, open: 0 }).current;
  const C = useRef({ ...SHOTS.sky(size.width / size.height) }).current;
  const shot = useRef("sky"), pointer = useRef({ x: 0, y: 0, sx: 0, sy: 0 });
  // story time T (s), set by the scroll (live.story 0..1, App), eased a little so a wheel notch glides:
  //   0 .. RELEASE       the breath: the sky spirals down into the windpipe (camera follows it down)
  //   RELEASE .. TOTAL   the recorded puff (sim.seek): vapor fills the windpipe, the poison spreads, patches die
  // Nothing runs on its own clock: stop scrolling and the story stops; scroll back and it plays backwards.
  const story = useRef({ t: 0, first: true }).current;

  // simulation: one puff is recorded up front, then scrubbed
  useEffect(() => {
    const sim = new LungSim(); sim.record(); simRef.current = sim;
    ready.current.sim = true; becomeReady();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const move = e => { pointer.current.x = (e.clientX / innerWidth) * 2 - 1; pointer.current.y = (e.clientY / innerHeight) * 2 - 1; };
    addEventListener("pointermove", move, { passive: true });
    return () => removeEventListener("pointermove", move);
  }, []);

  // story time -> everything on stage (deterministic, so scrubbing back and forth always matches)
  function applyStory(T, aspect) {
    const sim = simRef.current, TOTAL = RELEASE + sim.rec.end;
    I.pull = (clamp01(T / 4.2)) ** 2;                            // power1.in, as the old timeline
    dock.current.dock = T > 1.2 && T < 5.6 ? 1 : 0;
    sim.seek(T - RELEASE);
    // camera: sky -> wide (following the breath down) -> play (the lungs), then a slow push in while the poison spreads
    const w1 = inOut2(clamp01((T - 0.5) / 3.4)), w2 = inOut2(clamp01((T - 4.3) / 2.6)), w3 = inOutSine(clamp01((T - 6.9) / Math.max(1, TOTAL - 6.9)));
    const A = SHOTS.sky(aspect), B = SHOTS.wide(aspect), P = SHOTS.play(aspect);
    for (const k in A) C[k] = lerp(lerp(A[k], B[k], w1), P[k], w2);
    C.z *= 1 - 0.05 * w3;
    shot.current = w1 < 0.5 ? "sky" : "play";
    const phase = T <= 0.002 ? "idle" : T < RELEASE ? "inhaling" : T < TOTAL - 0.01 ? "running" : "done";
    const g = store.get(), patch = {};
    if (g.phase !== phase) patch.phase = phase;
    if (g.destroyed !== sim.destroyed) patch.destroyed = sim.destroyed;
    if (patch.phase || "destroyed" in patch) store.set(patch);
  }

  const look = useMemo(() => new THREE.Vector3(), []);
  if (import.meta.env.DEV) window.__alveo = { camera, C, I, simRef, shake, gl, scene, story };
  // runs first every frame (see <Rig>): the clouds project the chemical labels with this frame's camera
  const frame = useRef(); frame.current = (state, rawDt) => {
    const dt = Math.min(rawDt, 0.05), t = state.clock.elapsedTime;
    const sim = simRef.current;
    // the cloud follows the scroll off the landing, eased so it rolls in rather than snapping
    I.open = store.get().reducedMotion ? live.open : I.open + (live.open - I.open) * Math.min(1, dt * 2.4);
    // the story follows the scroll (eased); reduced motion: no in-between, it's the start or the end
    if (sim && store.get().phase !== "loading") {
      // the breath gets the first 35% of the scroll (it's the hook), the puff the rest
      const TOTAL = RELEASE + sim.rec.end, p = live.story;
      const target = p < BREATH ? p / BREATH * RELEASE : RELEASE + (p - BREATH) / (1 - BREATH) * sim.rec.end;
      if (store.get().reducedMotion) story.t = live.story > 0 ? TOTAL : 0;
      else if (story.first) story.t = target;                  // page opened part-way down: no replay from the top
      else { story.t += (target - story.t) * Math.min(1, dt * 4.5); if (Math.abs(target - story.t) < 0.004) story.t = target; }
      story.first = false;
      applyStory(story.t, size.width / size.height);
    }
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
      <Airway dockRef={dock} simRef={simRef} />
      <Lungs simRef={simRef} />
      <Toxin simRef={simRef} />
      <Smoke I={I} />
      <Streams I={I} />
      <Markers simRef={simRef} />
      <Callouts />
    </group>
  );
}

// Child effects subscribe before their parent's, so the director's per-frame work lives in this first child:
// it runs before the lungs, vapor and clouds read the camera.
function Rig({ frame }) { useFrame((state, dt) => frame.current(state, dt)); return null; }
