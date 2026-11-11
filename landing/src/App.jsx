// The page: one scroll story beside a live 3D stage (fixed, framed on the right).
//   Landing: the ALVEO. wordmark, "Every puff leaves a mark.", a big "Scroll to breathe in".
//   Intro: scrolling off the landing rolls a vape cloud in: "Tastes like candy. Breathes like lead.", full of what
//          vapes really put out; the next scroll breathes it all in, down the windpipe, and the poison starts.
//          Labels on the 3D say what it is ("Vape aerosol" on the windpipe, "Your lungs").
//   01 Problem: the poison finishes its work while the problem is told (two short beats).
//   02 Solution: what Alveo is and does (count, step the limit down, private); the poison washes out as you read.
//   03 Download: the ask, beside healthy, breathing lungs.
// Kept short on purpose (RJ, 2026-11-10: only problem, solution, CTA).
// The Download button is in the nav the whole time.
import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useStore, store, live } from "./store.js";
import { DOWNLOADS } from "./config.js";
import { scrollToId, lenis } from "./smooth.js";
import { DeskMock } from "./sections/ProductIntro.jsx";
import ScrollReveal from "./bits/ScrollReveal.jsx";
import Magnet from "./bits/Magnet.jsx";
import SpotlightCard from "./bits/SpotlightCard.jsx";
import GlareHover from "./bits/GlareHover.jsx";
import GradualBlur from "./bits/GradualBlur.jsx";
import TargetCursor from "./bits/TargetCursor.jsx";
import Landing from "./Landing.jsx";
import Intro from "./Intro.jsx";
import Labels from "./Labels.jsx";
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
  // (by the story's state, not the chapter: a reader who scrolled ahead still gets the punchline)
  const words = useStore(s => s.phase === "done" && s.heal < 0.1 ? "mark"
    : s.chapter === "solution" && s.heal >= 0.1 && s.heal < 0.6 ? "count" : "");
  const root = useRef(), deskRef = useRef();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // which chapter is on screen (nav highlight + stage caption)
      ["landing", "intro", "problem", "solution", "download"].forEach(id => ScrollTrigger.create({
        trigger: `#${id}`, start: "top 55%", end: "bottom 55%",
        onToggle: s => s.isActive && store.set({ chapter: id }),
      }));
      // scrolling off the landing: the wordmark fades up and away while the vape cloud rolls in
      const roll = s => { live.open = Math.min(1, s.progress / 0.7); };
      ScrollTrigger.create({ trigger: "#landing", start: "top top", end: "bottom top", onUpdate: roll, onRefresh: roll });
      gsap.fromTo(".landing-in, .landing-cue", { autoAlpha: 1, y: 0, filter: "blur(0px)" }, { autoAlpha: 0, y: -50, filter: "blur(10px)", ease: "none", immediateRender: false,
        scrollTrigger: { trigger: "#landing", start: "top top", end: "45% top", scrub: true } });
      // the next scroll breathes the cloud in; back above it, it breathes out again (and the lungs are clean)
      // the breath and the poison follow the scroll (RJ 2026-11-11: with the scroll, not on their own): from just past
      // the candy screen to the end of the problem. The scene maps this 0..1 onto its story time (Experience.jsx).
      const story = s => { live.story = s.progress; };
      ScrollTrigger.create({ trigger: "#intro", start: "top top-=10%", endTrigger: "#problem", end: "bottom 75%", onUpdate: story, onRefresh: story });
      // 02: the lungs relight across the solution chapter (jumped straight here? resolve the game first)
      const heal = s => { live.heal = s.progress; };
      ScrollTrigger.create({
        trigger: "#solution", start: "top 35%", end: "bottom 70%",
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
    // the lungs heal with the scroll (eased the same way as the story), and only once the poison is done
    const healTick = (time, dms) => {
      const h = store.get().heal, tgt = store.get().phase === "done" ? live.heal : 0; if (h === tgt) return;
      let nh = store.get().reducedMotion ? tgt : h + (tgt - h) * Math.min(1, Math.min(dms, 50) / 1000 * 4.5);
      if (Math.abs(tgt - nh) < 0.002) nh = tgt;
      store.set({ heal: nh });
    };
    gsap.ticker.add(healTick);
    if (import.meta.env.DEV) window.__story = { store, lenis, live };
    return () => { ctx.revert(); gsap.ticker.remove(healTick); };
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
  // problem beats: words brighten one by one as you scroll (plain fade: no blur, no green; RJ 2026-11-11)
  const reveal = { containerClassName: "pi-title st-h2 st-sr", baseOpacity: 0.08, enableBlur: false, baseRotation: 0,
    smoothing: 0.5, stagger: 0.06, wordAnimationEnd: "center 48%" };

  return (
    <div className="pi st" ref={root}>
      <div className={"stage-wrap" + (stageReady ? " is-ready" : "") + ` is-${chapter}`} aria-hidden="true">
        {stageOn && <Suspense fallback={null}><Experience /></Suspense>}
        <div className="stage-shade" />
      </div>

      <GradualBlur target="page" position="top" height="6.5rem" strength={2} layers={3} curve="bezier" zIndex={25} />
      <header className={"nav" + (chapter === "landing" ? " is-landing" : "")}>
        <a className="wordmark cursor-target" href="#landing" aria-label="Alveo, back to top">ALVEO<span>.</span></a>
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
        <Landing />
        <Intro />
        <Labels />
        <Findings />
        <div className="stage-words" aria-hidden="true">
          <p className={words === "mark" ? "on" : ""}>Every puff <em>leaves a mark.</em></p>
          <p className={words === "count" ? "on" : ""}>Alveo counts every puff <em>for you.</em></p>
        </div>
        <div className={`stage-cap is-${chapter}`} data-phase={phase} aria-hidden="true">
          <div className="cap-marks">
            <Marks />
            <span>marks from<br />one vape puff</span>
          </div>
          <p className="cap-hint">Hover the markers: what the vape left in these lungs.</p>
          <p className="cap-heal">The poison washes out as you read. In the app, the lung picture tracks your week: an illustration, not a measurement.</p>
          <button className="replay cursor-target" type="button" tabIndex={-1} onClick={() => scrollToId("intro")}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" /><path d="M2.5 2.5v3h3" /></svg>Replay</button>
        </div>
      </div>

      <main className="st-col">
        {/* ---------------- landing + intro (both drawn on the stage; these are their scroll room) ---------------- */}
        <section className="st-intro" id="landing"><h1 className="sr">Alveo. Every puff leaves a mark.</h1></section>
        <section className="st-intro" id="intro"><h2 className="sr">One vape puff, up close: tastes like candy, breathes like lead.</h2></section>

        {/* ---------------- 01 the problem (the opening breath is its hook; the poison spreads alongside) ---------------- */}
        <section className="st-chapter" id="problem" aria-label="The problem">
          <div className="st-beat">
            <p className="pi-eyebrow"><span className="pi-eyebrow__n">01</span>The problem</p>
            <ScrollReveal {...reveal}>One puff takes two seconds.</ScrollReveal>
            <p className="pi-lead st-rv">Hit the vape, exhale, back to the screen. At your desk it's always in reach, so the puffs add up quietly, all day, and nobody counts them.</p>
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
