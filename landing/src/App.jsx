// The page: one scroll story beside a live 3D stage (fixed, framed on the right).
//   Hero: what Alveo is + Download, straight away.
//   01 Problem: scrolling in fires the vape; the pinballs wreck the lungs while the problem is told.
//   02 Solution: how Alveo counts, plans and stays private; the lungs relight as you read.
//   03 Download: the ask again, beside healthy, breathing lungs.
// The Download button is in the nav the whole time.
import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useStore, store, actions } from "./store.js";
import { DOWNLOADS, STATUS_LINE } from "./config.js";
import { scrollToId } from "./smooth.js";
import { DeskMock, PaceChart, Flow, PACES, TONES } from "./sections/ProductIntro.jsx";
import BlurText from "./bits/BlurText.jsx";
import ScrollReveal from "./bits/ScrollReveal.jsx";
import SplitFlapText from "./bits/SplitFlapText.jsx";
import Magnet from "./bits/Magnet.jsx";
import ClickSpark from "./bits/ClickSpark.jsx";
import SpotlightCard from "./bits/SpotlightCard.jsx";
import GlareHover from "./bits/GlareHover.jsx";
import GradualBlur from "./bits/GradualBlur.jsx";
import ShinyText from "./bits/ShinyText.jsx";
import TargetCursor from "./bits/TargetCursor.jsx";
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

// Download button: leans toward the cursor (Magnet) and throws red sparks on click, like a pinball impact.
function Download({ os, size = "lg", label, className = "" }) {
  const url = DOWNLOADS[os], ghost = size === "ghost";
  return (
    <Magnet padding={size === "sm" ? 40 : 70} magnetStrength={ghost ? 9 : 6} maxOffset={size === "sm" ? 6 : 12} wrapperClassName={`dl-wrap ${className}`}>
      <ClickSpark sparkColor={ghost ? ["#f4f4f5", "#a1a1aa"] : ["#ff3a33", "#ff8a5c", "#ffd2c4"]} sparkCount={12} sparkRadius={size === "sm" ? 28 : 42}
        sparkSize={10} duration={520} glow={ghost ? 0 : 0.6} style={{ display: "inline-block", width: "auto", height: "auto" }}>
        <a className={`dl dl--${size} cursor-target`} href={url || "#download"} {...(url ? { download: "" } : {})} data-os={os}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.5 7.5 8 11l3.5-3.5M3 13.5h10" /></svg>
          <span>{label ?? `Download for ${OS_NAME[os]}`}</span>
        </a>
      </ClickSpark>
    </Magnet>
  );
}

// the marks counter flips like a departure board; dots fall fast, so it settles at most ~5 times a second
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
  const marks = String(useThrottled(useStore(s => s.destroyed), 200)).padStart(3, "0");
  return <SplitFlapText text={marks} charset="0123456789" padTo={3} intro={false} loop={false} flipsPerChar={2} flipDuration={0.06} stagger={0.03}
    fontSize={30} tileColor="#140708" textColor="#ff3a33" tileRadius={6} gap={4} glare={0.35} depth={0.7} className="cap-flap" />;
}
function LiveDesk() { return <DeskMock count={useStore(s => s.deskCount)} />; }

export default function App() {
  const os = useMemo(detectOS, []);
  const phase = useStore(s => s.phase), hover = useStore(s => s.hoverVape), stageReady = useStore(s => s.stageReady);
  const chapter = useStore(s => s.chapter);
  // which line shows under the lungs: the punchline once the game is over, then what Alveo does as they relight
  const words = useStore(s => s.phase === "done" && (s.chapter === "problem" || (s.chapter === "solution" && s.heal < 0.1)) ? "mark"
    : s.chapter === "solution" && s.heal >= 0.1 && s.heal < 0.6 ? "count" : "");
  const [pace, setPace] = useState("steady");
  const sel = PACES.find(p => p.id === pace);
  const root = useRef(), deskRef = useRef();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // which chapter is on screen (nav highlight + stage caption)
      ["hero", "problem", "solution", "download"].forEach(id => ScrollTrigger.create({
        trigger: `#${id}`, start: "top 55%", end: "bottom 55%",
        onToggle: s => s.isActive && store.set({ chapter: id }),
      }));
      // 01: scrolling into the problem takes the puff
      ScrollTrigger.create({ trigger: "#problem", start: "top 70%", onEnter: () => actions.fire() });
      // 02: the lungs relight across the solution chapter (jumped straight here? resolve the game first)
      const heal = s => store.set({ heal: s.progress });
      ScrollTrigger.create({
        trigger: "#solution", start: "top 65%", end: "bottom 70%",
        onEnter: () => { if (store.get().phase === "idle") actions.skipToEnd(); },
        onUpdate: heal, onRefresh: heal,
      });
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".st-hero .st-in", { y: 24, autoAlpha: 0, duration: 1.2, ease: "expo.out", stagger: 0.08, delay: 0.2 });
        gsap.set(".st-rv", { autoAlpha: 0 });
        ScrollTrigger.batch(".st-rv", { start: "top 86%", once: true,
          onEnter: els => gsap.fromTo(els, { y: 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1, ease: "power3.out", stagger: 0.08, overwrite: true }) });
        document.querySelectorAll(".st-beat h2").forEach(h => h.querySelector(".pi-rise") && gsap.from(h.querySelectorAll(".pi-rise"), {
          yPercent: 115, duration: 1.2, ease: "expo.out", stagger: 0.08, scrollTrigger: { trigger: h, start: "top 80%" } }));
        gsap.fromTo(".pi-draw", { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: "none",
          scrollTrigger: { trigger: ".pi-chart", start: "top 85%", end: "top 35%", scrub: 0.6 } });
        ScrollTrigger.create({ trigger: deskRef.current, start: "top 85%", end: "center 45%", onUpdate: s => store.set({ deskCount: 44 + Math.round(s.progress * 7) }) });
      });
      mm.add("(prefers-reduced-motion: reduce)", () => store.set({ deskCount: 51 }));
    }, root);
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, []);

  const rise = lines => lines.map((l, i) => <span className="pi-mask" key={i}><span className="pi-rise">{l}</span></span>);
  const [line2, setLine2] = useState(false);
  // start the 3D once the headline has focused in (or the browser is idle): its first GPU work stutters the page
  const [stageOn, setStageOn] = useState(false), [cursorOn, setCursorOn] = useState(false);
  useEffect(() => {
    const start = () => setStageOn(true);
    const id = window.requestIdleCallback ? requestIdleCallback(start, { timeout: 1200 }) : setTimeout(start, 900);
    return () => (window.cancelIdleCallback ? cancelIdleCallback(id) : clearTimeout(id));
  }, []);
  useEffect(() => { if (!stageReady) return; const t = setTimeout(() => setCursorOn(true), 400); return () => clearTimeout(t); }, [stageReady]);
  useEffect(() => { const t = setTimeout(() => setLine2(true), 450); return () => clearTimeout(t); }, []);
  // problem beats: words come into focus as you scroll, each passing through red (heat) on the way
  const reveal = { containerClassName: "pi-title st-h2 st-sr", baseOpacity: 0.08, enableBlur: true, blurStrength: 9, baseRotation: 0,
    highlightColor: "#ff3a33", smoothing: 0.5, stagger: 0.06, wordAnimationEnd: "center 48%" };

  return (
    <div className="pi st" ref={root}>
      <div className={"stage-wrap" + (stageReady ? " is-ready" : "")} aria-hidden="true">
        {stageOn && <Suspense fallback={null}><Experience /></Suspense>}
        <div className="stage-shade" />
      </div>

      <GradualBlur target="page" position="top" height="6.5rem" strength={2} layers={3} curve="bezier" zIndex={25} />
      <header className="nav">
        <a className="wordmark cursor-target" href="#hero" aria-label="Alveo, back to top">ALVEO<span>.</span></a>
        <nav className="nav-links" aria-label="Sections">
          <a href="#problem" className={"cursor-target" + (chapter === "problem" ? " on" : "")}>The problem</a>
          <a href="#solution" className={"cursor-target" + (chapter === "solution" ? " on" : "")}>How it helps</a>
          <a href="#download" className={"cursor-target" + (chapter === "download" ? " on" : "")}>Download</a>
        </nav>
        <Download os={os} size="sm" label="Download" className="nav-dl" />
      </header>

      {/* the cursor: a detection reticle that locks onto anything you can press; on the vape it reports
          "vape 0.94" like Alveo's detector does */}
      {/* the reticle takes over only once the 3D is compiled and running: the system cursor can't freeze, ours can */}
      {cursorOn && <TargetCursor cursorColor="#f4f4f5" cursorColorOnTarget="#ff3a33" blendMode="normal" spinDuration={7} hoverDuration={0.22}
        size={26} cornerSize={10} thickness={2} padding={9} dotSize={4} parallaxOn />}

      {/* stage overlay: "take a puff" on the vape; caption + replay bottom right */}
      <div className="stage-ui">
        <div id="vape-hit" className="vape-hit cursor-target" data-cursor-label="vape 0.94" data-phase={phase}
          onClick={() => actions.fire()} onPointerEnter={() => store.set({ hoverVape: true })} onPointerLeave={() => store.set({ hoverVape: false })} />
        <div id="vape-anchor" className={"vape-anchor" + (hover ? " is-hover" : "")} data-phase={phase}>
          <button className="puff cursor-target" type="button" onClick={() => actions.fire()} disabled={phase !== "idle"} tabIndex={phase === "idle" ? 0 : -1}>
            <span className="puff-ring" aria-hidden="true" /><span>Take a puff</span>
          </button>
        </div>
        <div className="stage-words" aria-hidden="true">
          <p className={words === "mark" ? "on" : ""}>Every puff <em>leaves a mark.</em></p>
          <p className={words === "count" ? "on" : ""}>Alveo counts every puff <em>for you.</em></p>
        </div>
        <div className={`stage-cap is-${chapter}`} data-phase={phase} aria-hidden="true">
          <div className="cap-marks">
            <Marks />
            <span>marks<br />left behind</span>
          </div>
          <p className="cap-heal">The lungs relight as you read. In the app, the lung picture tracks your week: an illustration, not a measurement.</p>
          <button className="replay cursor-target" type="button" tabIndex={-1} onClick={() => { actions.replay(); scrollToId("hero"); }}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" /><path d="M2.5 2.5v3h3" /></svg>Again</button>
        </div>
      </div>

      <main className="st-col">
        {/* ---------------- hero ---------------- */}
        <section className="st-hero" id="hero">
          <p className="st-eyebrow st-in"><i /><ShinyText text={STATUS_LINE} color="#a1a1aa" shineColor="#ffffff" speed={3.2} delay={1.4} shineWidth={30} /></p>
          {/* the headline comes into focus: noticing is the point */}
          <h1 className="st-h1" aria-label="Notice every puff. Then have fewer.">
            <BlurText as="span" text="Notice every puff." className="st-h1-line" delay={110} stepDuration={0.45} blur={14} distance={26} />
            <span className="st-h1-line st-h1-line--2">{line2 && <BlurText as="span" text="Then have fewer." className="st-h1-line" delay={110} stepDuration={0.45} blur={14} distance={26} />}</span>
          </h1>
          <p className="st-lead st-in">Alveo uses your webcam to count the puffs you take at your desk, then helps you cut down, and possibly quit. It all runs on your computer.</p>
          <div className="st-ctas st-in">
            <Download os={os} />
            <a className="st-alt cursor-target" href={DOWNLOADS[other(os)] || "#download"}>or for {OS_NAME[other(os)]}</a>
          </div>
          <p className="st-trust st-in">Camera frames never leave your computer · works offline</p>
          <a className="st-cue st-in cursor-target" href="#problem"><span>Scroll to see what one puff does</span><i aria-hidden="true" /></a>
        </section>

        {/* ---------------- 01 the problem (the pinballs run alongside) ---------------- */}
        <section className="st-chapter" id="problem" aria-label="The problem">
          <div className="st-beat">
            <p className="pi-eyebrow"><span className="pi-eyebrow__n">01</span>The problem</p>
            <ScrollReveal {...reveal}>One puff takes two seconds.</ScrollReveal>
            <p className="pi-lead st-rv">Hit, exhale, back to the screen. Too quick to register, so nobody counts it.</p>
          </div>
          <div className="st-beat">
            <ScrollReveal {...reveal}>At your desk, it's always in reach.</ScrollReveal>
            <p className="pi-lead st-rv">Between emails. On calls. While you think. The puffs add up quietly, all day.</p>
          </div>
          <div className="st-beat">
            <ScrollReveal {...reveal}>You can't cut what you can't see.</ScrollReveal>
            <p className="pi-lead st-rv">A guess is easy. A real number is what lets you bring it down.</p>
          </div>
          <div className="st-beat st-beat--quiet" aria-hidden="true" />
          <p className="sr">Every puff leaves a mark.</p>
        </section>

        {/* ---------------- 02 the solution (lungs relight) ---------------- */}
        <section className="st-chapter" id="solution" aria-label="How Alveo helps">
          <div className="st-block">
            <p className="pi-eyebrow st-rv"><span className="pi-eyebrow__n">02</span>How Alveo helps</p>
            <h2 className="sr">Alveo counts every puff for you.</h2>
            <p className="pi-lead st-lead-xl st-rv">It watches for the vape at your lips while you work and keeps today's count in your menu bar (the system tray on Windows). After each puff, a small card shows where you stand.</p>
            <div className="st-mock st-rv" ref={deskRef}>
              <GlareHover width="100%" borderRadius="22px" glareColor="#ffffff" glareOpacity={0.22} glareSize={40} glareAngle={-40} transitionDuration={900} rimGlint className="st-glare">
                <LiveDesk />
              </GlareHover>
            </div>
            <ul className="pi-points st-rv">
              <li><b>Today's count, always in view</b><span>51/60: puffs so far against today's limit.</span></li>
              <li><b>A 30-second urge timer, one click away</b><span>Ride out a craving instead of reaching for the vape.</span></li>
              <li><b>It learns from you</b><span>Wrong call? Tap “Not a vape” and it learns.</span></li>
            </ul>
            <p className="pi-fine st-rv">It counts what it can see: puffs at your desk, in front of the camera.</p>
          </div>

          <aside className="st-rv" aria-label="Download">
            <SpotlightCard className="st-midcta" spotlightColor="rgba(255, 58, 51, 0.32)" intensity={0.5} spotlightSize={320} borderGlow={0.9} grain={0.04}>
              <div><b>Try it at your desk.</b><span>{STATUS_LINE}</span></div>
              <Download os={os} size="md" />
            </SpotlightCard>
          </aside>

          <div className="st-block">
            <h2 className="pi-title st-h2 st-rv">Then it helps you cut down.</h2>
            <p className="pi-lead st-rv">Pick a pace and your daily limit steps down from your usual. Every plan runs about 90 days. A zero-puff goal is offered at the end, never forced.</p>
            <div className="pi-panel st-panel st-rv">
              <div className="pi-seg" role="radiogroup" aria-label="Pace">
                {PACES.map(p => (
                  <button key={p.id} role="radio" className={"cursor-target" + (pace === p.id ? " is-on" : "")} aria-checked={pace === p.id} onClick={() => setPace(p.id)}>
                    <b>{p.name}</b><span>{p.span}</span>{p.id === "steady" && <em>Default</em>}
                  </button>
                ))}
              </div>
              <PaceChart sel={pace} />
              <p className="pi-panel__detail"><b>{sel.name} · {sel.span}.</b> {sel.detail}</p>
            </div>
            <div className="st-tones st-rv">
              <p className="st-tones__h">Pick how it talks to you</p>
              {TONES.map(t => (
                <div key={t.id} className={`st-tone st-tone--${t.id}`}>
                  <span className="pi-chip">{t.name}</span>
                  <q>{t.line}</q>
                  {t.id === "brutal" && <em>opt-in</em>}
                </div>
              ))}
            </div>
          </div>

          <div className="st-block">
            <h2 className="pi-title st-h2 st-rv">Nothing leaves your desk.</h2>
            <p className="pi-lead st-rv">Alveo looks for the vape on your own computer. Camera frames are never uploaded, it keeps counting with the Wi-Fi off, and meeting mode hides it on calls.</p>
            <div className="st-rv"><Flow /></div>
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
