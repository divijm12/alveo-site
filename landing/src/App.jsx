// The page: one scroll story beside a live 3D stage (fixed, framed on the right).
//   Intro: "Tastes like candy. Breathes like lead." in a dark cloud full of what vapes really put out; the first
//          scroll breathes it all in, down the windpipe, and the poison starts.
//   01 Problem: the poison finishes its work while the problem is told (two short beats).
//   02 Solution: what Alveo is and does (count, step the limit down, private); the poison washes out as you read.
//   03 Download: the ask, beside healthy, breathing lungs.
// Kept short on purpose (RJ, 2026-11-10: only problem, solution, CTA).
// The Download button is in the nav the whole time.
import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useStore, store, actions } from "./store.js";
import { DOWNLOADS } from "./config.js";
import { scrollToId } from "./smooth.js";
import { DeskMock } from "./sections/ProductIntro.jsx";
import ScrollReveal from "./bits/ScrollReveal.jsx";
import Magnet from "./bits/Magnet.jsx";
import SpotlightCard from "./bits/SpotlightCard.jsx";
import GlareHover from "./bits/GlareHover.jsx";
import GradualBlur from "./bits/GradualBlur.jsx";
import TargetCursor from "./bits/TargetCursor.jsx";
import Intro from "./Intro.jsx";
import Findings from "./Findings.jsx";
import "./sections/sections.css";
import "./story.css";

gsap.registerPlugin(ScrollTrigger);
const Experience = lazy(() => import("./scene/Experience.jsx"));   // 3D + physics in their own chunk: the page paints first

const OS_NAME = { mac: "Mac", windows: "Windows" };
function detectOS() {
  const p = (navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "").toLowerCase();
  return p.includes("win") ? "windows" : "mac";
}
const other = os => (os === "mac" ? "windows" : "mac");

// Download button: leans gently toward the cursor (Magnet).
function Download({ os, size = "lg", label, className = "" }) {
  const url = DOWNLOADS[os], ghost = size === "ghost";
  return (
    <Magnet padding={size === "sm" ? 40 : 70} magnetStrength={ghost ? 9 : 6} maxOffset={size === "sm" ? 6 : 12} wrapperClassName={`dl-wrap ${className}`}>
      <a className={`dl dl--${size} cursor-target`} href={url || "#download"} {...(url ? { download: "" } : {})} data-os={os}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.5 7.5 8 11l3.5-3.5M3 13.5h10" /></svg>
        <span>{label ?? `Download for ${OS_NAME[os]}`}</span>
      </a>
    </Magnet>
  );
}

// the marks counter: a quiet number; patches die fast, so it updates at most ~6 times a second
function useThrottled(value, ms) {
  const [v, setV] = useState(value); const last = useRef(0), timer = useRef(0);
  useEffect(() => {
    const now = performance.now(), wait = ms - (now - last.current);
    clearTimeout(timer.current);
    if (wait <= 0) { last.current = now; setV(value); } else timer.current = setTimeout(() => { last.current = performance.now(); setV(value); }, wait);
    return () => clearTimeout(timer.current);
  }, [value, ms]);
  return v;
}

// Small live pieces subscribe to the store themselves, so the whole page doesn't re-render ~10 times a second.
function Marks() {
  return <b>{useThrottled(useStore(s => s.destroyed), 160)}</b>;
}
function LiveDesk() { return <DeskMock count={useStore(s => s.deskCount)} />; }

export default function App() {
  const os = useMemo(detectOS, []);
  const phase = useStore(s => s.phase), stageReady = useStore(s => s.stageReady);
  const chapter = useStore(s => s.chapter);
  // which line shows under the lungs: the punchline once the game is over, then what Alveo does as they relight
  const words = useStore(s => s.phase === "done" && (s.chapter === "intro" || s.chapter === "problem" || (s.chapter === "solution" && s.heal < 0.1)) ? "mark"
    : s.chapter === "solution" && s.heal >= 0.1 && s.heal < 0.6 ? "count" : "");
  const root = useRef(), deskRef = useRef();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // which chapter is on screen (nav highlight + stage caption)
      ["intro", "problem", "solution", "download"].forEach(id => ScrollTrigger.create({
        trigger: `#${id}`, start: "top 55%", end: "bottom 55%",
        onToggle: s => s.isActive && store.set({ chapter: id }),
      }));
      // the first scroll breathes the cloud in; back at the very top it breathes out again (and the lungs are clean)
      ScrollTrigger.create({ trigger: "#intro", start: "top top-=40", onEnter: () => actions.fire(), onLeaveBack: () => actions.replay() });
      // 02: the lungs relight across the solution chapter (jumped straight here? resolve the game first)
      const heal = s => store.set({ heal: s.progress });
      ScrollTrigger.create({
        trigger: "#solution", start: "top 65%", end: "bottom 70%",
        onEnter: () => { if (store.get().phase === "idle") actions.skipToEnd(); },
        onUpdate: heal, onRefresh: heal,
      });
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(".st-rv", { autoAlpha: 0 });
        ScrollTrigger.batch(".st-rv", { start: "top 86%", once: true,
          onEnter: els => gsap.fromTo(els, { y: 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1, ease: "power3.out", stagger: 0.08, overwrite: true }) });
        document.querySelectorAll(".st-beat h2").forEach(h => h.querySelector(".pi-rise") && gsap.from(h.querySelectorAll(".pi-rise"), {
          yPercent: 115, duration: 1.2, ease: "expo.out", stagger: 0.08, scrollTrigger: { trigger: h, start: "top 80%" } }));
        ScrollTrigger.create({ trigger: deskRef.current, start: "top 85%", end: "center 45%", onUpdate: s => store.set({ deskCount: 44 + Math.round(s.progress * 7) }) });
      });
      mm.add("(prefers-reduced-motion: reduce)", () => store.set({ deskCount: 51 }));
    }, root);
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, []);

  const rise = lines => lines.map((l, i) => <span className="pi-mask" key={i}><span className="pi-rise">{l}</span></span>);
  // start the 3D (the opening sky) as soon as the browser is idle: the words show first, the cloud rolls in
  const [stageOn, setStageOn] = useState(false), [cursorOn, setCursorOn] = useState(false);
  useEffect(() => {
    const start = () => setStageOn(true);
    const id = window.requestIdleCallback ? requestIdleCallback(start, { timeout: 500 }) : setTimeout(start, 300);
    return () => (window.cancelIdleCallback ? cancelIdleCallback(id) : clearTimeout(id));
  }, []);
  useEffect(() => { if (!stageReady) return; const t = setTimeout(() => setCursorOn(true), 400); return () => clearTimeout(t); }, [stageReady]);
  // problem beats: words come into focus as you scroll, each passing through the poison's green on the way
  const reveal = { containerClassName: "pi-title st-h2 st-sr", baseOpacity: 0.08, enableBlur: true, blurStrength: 9, baseRotation: 0,
    highlightColor: "#a6d13a", smoothing: 0.5, stagger: 0.06, wordAnimationEnd: "center 48%" };

  return (
    <div className="pi st" ref={root}>
      <div className={"stage-wrap" + (stageReady ? " is-ready" : "") + ` is-${chapter}`} aria-hidden="true">
        {stageOn && <Suspense fallback={null}><Experience /></Suspense>}
        <div className="stage-shade" />
      </div>

      <GradualBlur target="page" position="top" height="6.5rem" strength={2} layers={3} curve="bezier" zIndex={25} />
      <header className="nav">
        <a className="wordmark cursor-target" href="#intro" aria-label="Alveo, back to top">ALVEO<span>.</span></a>
        <nav className="nav-links" aria-label="Sections">
          <a href="#problem" className={"cursor-target" + (chapter === "problem" ? " on" : "")}>The problem</a>
          <a href="#solution" className={"cursor-target" + (chapter === "solution" ? " on" : "")}>How it helps</a>
          <a href="#download" className={"cursor-target" + (chapter === "download" ? " on" : "")}>Download</a>
        </nav>
        <Download os={os} size="sm" label="Download" className="nav-dl" />
      </header>

      {/* the cursor: a detection reticle (Alveo is a detector) that locks onto anything you can press */}
      {/* the reticle takes over only once the 3D is compiled and running: the system cursor can't freeze, ours can */}
      {cursorOn && <TargetCursor cursorColor="#f4f4f5" cursorColorOnTarget="#ff3a33" blendMode="normal" spinDuration={7} hoverDuration={0.22}
        size={26} cornerSize={10} thickness={2} padding={9} dotSize={4} parallaxOn />}

      {/* stage overlay: the opening words + chemicals; the punchline under the lungs; caption + replay top right */}
      <div className="stage-ui">
        <Intro />
        <Findings />
        <div className="stage-words" aria-hidden="true">
          <p className={words === "mark" ? "on" : ""}>Every puff <em>leaves a mark.</em></p>
          <p className={words === "count" ? "on" : ""}>Alveo counts every puff <em>for you.</em></p>
        </div>
        <div className={`stage-cap is-${chapter}`} data-phase={phase} aria-hidden="true">
          <div className="cap-marks">
            <Marks />
            <span>marks<br />left behind</span>
          </div>
          <p className="cap-hint">Hover the markers: what you just breathed in.</p>
          <p className="cap-heal">The poison washes out as you read. In the app, the lung picture tracks your week: an illustration, not a measurement.</p>
          <button className="replay cursor-target" type="button" tabIndex={-1} onClick={() => scrollToId("intro")}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" /><path d="M2.5 2.5v3h3" /></svg>Replay</button>
        </div>
      </div>

      <main className="st-col">
        {/* ---------------- intro (the words float on the stage; this is the scroll room for the breath) ---------------- */}
        <section className="st-intro" id="intro"><h1 className="sr">Tastes like candy. Breathes like lead.</h1></section>

        {/* ---------------- 01 the problem (the opening breath is its hook; the poison spreads alongside) ---------------- */}
        <section className="st-chapter" id="problem" aria-label="The problem">
          <div className="st-beat">
            <p className="pi-eyebrow"><span className="pi-eyebrow__n">01</span>The problem</p>
            <ScrollReveal {...reveal}>One puff takes two seconds.</ScrollReveal>
            <p className="pi-lead st-rv">Hit, exhale, back to the screen. At your desk it's always in reach, so the puffs add up quietly, all day, and nobody counts them.</p>
          </div>
          <div className="st-beat">
            <ScrollReveal {...reveal}>You can't cut what you can't see.</ScrollReveal>
            <p className="pi-lead st-rv">A guess is easy. A real number is what lets you bring it down.</p>
          </div>
          <p className="sr">Every puff leaves a mark.</p>
        </section>

        {/* ---------------- 02 the solution (the poison washes out) ---------------- */}
        <section className="st-chapter" id="solution" aria-label="How Alveo helps">
          <div className="st-block">
            <p className="pi-eyebrow st-rv"><span className="pi-eyebrow__n">02</span>How Alveo helps</p>
            <h2 className="pi-title st-h2 st-rv">Notice every puff.<br />Then have fewer.</h2>
            <p className="pi-lead st-rv">Alveo uses your webcam to count the puffs you take at your desk, and keeps today's count in your menu bar (the system tray on Windows).</p>
            <div className="st-mock st-rv" ref={deskRef}>
              <GlareHover width="100%" borderRadius="22px" glareColor="#ffffff" glareOpacity={0.22} glareSize={40} glareAngle={-40} transitionDuration={900} rimGlint className="st-glare">
                <LiveDesk />
              </GlareHover>
            </div>
            <ul className="pi-points st-rv">
              <li><b>Counts every puff</b><span>Today's count against today's limit, always in view.</span></li>
              <li><b>Steps your limit down</b><span>Pick a pace; the plan runs about 90 days. A zero-puff goal is offered at the end, never forced.</span></li>
              <li><b>Nothing leaves your computer</b><span>Camera frames are never uploaded, and it keeps counting offline.</span></li>
            </ul>
            <p className="pi-fine st-rv">It counts what it can see: puffs at your desk, in front of the camera.</p>
          </div>
        </section>

        {/* ---------------- 03 download ---------------- */}
        <section className="st-chapter st-final" id="download" aria-label="Download Alveo">
          <p className="pi-eyebrow st-rv"><span className="pi-eyebrow__n">03</span>Download</p>
          <h2 className="pi-title st-h2 st-rv">See your number.<br />Then lower it.</h2>
          <p className="pi-lead st-rv">Alveo is in beta for Mac and Windows. Download it, allow the camera, and it starts counting.</p>
          <SpotlightCard className="st-finalcard st-rv" spotlightColor="rgba(255, 58, 51, 0.28)" intensity={0.45} spotlightSize={380} borderGlow={0.8} grain={0.04}>
            <div className="st-ctas">
              <Download os={os} />
              <Download os={other(os)} size="ghost" />
            </div>
          </SpotlightCard>
          <p className="st-trust st-rv">18+ · Not a medical device · Camera frames never leave your computer</p>
          <footer className="st-foot">
            <span className="wordmark">ALVEO<span>.</span></span>
            <span>© 2026 Alveo</span>
          </footer>
        </section>
      </main>
    </div>
  );
}
