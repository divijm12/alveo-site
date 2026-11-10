import { Suspense, lazy, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
const Experience = lazy(() => import("./scene/Experience.jsx"));   // 3D + physics in their own chunk: the page paints first
import { useStore, store, actions } from "./store.js";
import "./hero.css";

gsap.registerPlugin(ScrollTrigger);
const sectionMods = import.meta.glob("./sections/ProductIntro.jsx", { eager: true });
const ProductIntro = sectionMods["./sections/ProductIntro.jsx"]?.default ?? (() => null);

export default function App() {
  const phase = useStore(s => s.phase), destroyed = useStore(s => s.destroyed), hover = useStore(s => s.hoverVape);
  const dim = useRef(), hero = useRef(), msg = useRef();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // hero scrolls out: the camera drifts back and the stage dims under the product sections
      ScrollTrigger.create({ trigger: hero.current, start: "top top", end: "bottom top", scrub: true,
        onUpdate: s => store.set({ scroll: s.progress }) });
      const setDim = gsap.quickSetter(dim.current, "opacity");
      const update = () => {
        const vh = innerHeight;
        let o = Math.min(0.82, Math.max(0, (scrollY - vh * 0.35) / (vh * 0.9)) * 0.82);
        const rec = document.getElementById("heal");               // the lungs come back for the recovery section
        let focus = 0;
        if (rec) {
          const r = rec.getBoundingClientRect();
          const inK = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.8))), outK = Math.min(1, Math.max(0, r.bottom / (vh * 0.8)));
          focus = Math.min(inK, outK); focus = focus * focus * (3 - 2 * focus);
          o *= 1 - focus;
          // scrolled down without ever taking the puff: resolve the game instantly so there is damage to relight
          if (r.top < vh * 1.6 && store.get().phase === "idle") actions.skipToEnd();
        }
        if (Math.abs(focus - store.get().focus) > 0.002) store.set({ focus });
        document.documentElement.style.setProperty("--nav-bg", scrollY > vh * 0.6 ? "1" : "0");
        setDim(o); store.set({ hidden: o > 0.8 && focus < 0.01 });
      };
      ScrollTrigger.create({ start: 0, end: "max", onUpdate: update, onRefresh: update });
    });
    return () => ctx.revert();
  }, []);

  // the end line rises word by word
  useLayoutEffect(() => {
    if (phase !== "done" || !msg.current) return;
    const words = msg.current.querySelectorAll(".w > span"), after = msg.current.querySelectorAll(".after");
    if (store.get().reducedMotion) { gsap.set(words, { yPercent: 0, y: 0, opacity: 1 }); gsap.set(after, { autoAlpha: 1 }); return; }
    const t = gsap.timeline({ delay: 0.5 });
    t.fromTo(words, { yPercent: 110, y: 0 }, { yPercent: 0, y: 0, duration: 1.1, ease: "expo.out", stagger: 0.07 })
      .fromTo(msg.current.querySelectorAll(".after"), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: "power2.out", stagger: 0.12 }, 0.6);
    return () => t.kill();
  }, [phase]);

  const line = "Every puff leaves a mark.".split(" ");
  return (
    <>
      <div className="stage-wrap" aria-hidden="true">
        <Suspense fallback={null}><Experience /></Suspense>
        <div className="stage-dim" ref={dim} />
      </div>

      <header className="nav">
        <a className="wordmark" href="#top" aria-label="Alveo">ALVEO<span>.</span></a>
        <span className="nav-pill">Coming soon · Mac &amp; Windows</span>
      </header>

      <section className="hero" ref={hero} id="top" data-phase={phase}>
        <p className="sr">Interactive intro: clicking a vape fires three glowing balls down a mechanical windpipe into Alveo's dotted lungs, where they knock out the dots one by one. It ends on the damaged lungs and the words: Every puff leaves a mark.</p>

        <div className="intro">
          <p className="eyebrow">Alveo · for Mac and Windows</p>
          <h1 className="intro-title">One puff.<br />Follow it down.</h1>
        </div>

        <div id="vape-anchor" className={"vape-anchor" + (hover ? " is-hover" : "")}>
          <button className="puff" type="button" onClick={() => actions.fire()} disabled={phase !== "idle"}>
            <span className="puff-ring" aria-hidden="true" />
            <span>Take a puff</span>
          </button>
        </div>

        <div className="hud" aria-hidden="true">
          <span className="hud-n">{String(destroyed).padStart(3, "0")}</span>
          <span className="hud-l">marks<br />so far</span>
        </div>

        <div className="end" ref={msg}>
          <h2 className="end-line" aria-label="Every puff leaves a mark.">
            {line.map((w, i) => <span className="w" key={i} aria-hidden="true"><span>{w}</span></span>)}
          </h2>
          <p className="after end-sub">Alveo notices each one, and helps you have fewer.</p>
          <div className="after end-actions">
            <a className="scroll-cue" href="#notice">See how it works <span aria-hidden="true">↓</span></a>
            <button className="replay" type="button" onClick={() => actions.replay()}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" /><path d="M2.5 2.5v3h3" /></svg>Again
            </button>
          </div>
        </div>
      </section>

      <ProductIntro />
    </>
  );
}
