// The opening screen, over the 3D sky: the headline floats in the cloud (mist wisps drift in front of and behind
// it, cut from the same procedural puffs as the 3D clouds), with the chemicals that are really in the aerosol
// hanging in the smoke (the 3D scene positions those labels every frame, see scene/Smoke.jsx).
// When the breath starts (phase leaves "idle") the words come apart into the haze and the mist is drawn down
// after the cloud; on replay they gather again.
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { store, useStore } from "./store.js";
import { CHEMS, formula } from "./chems.js";
import { cloudURL } from "./cloudTex.js";
import { scrollToId } from "./smooth.js";

const chars = (text, cls = "") => [...text].map((c, i) => <span key={i} className={"ch " + cls}>{c === " " ? " " : c}</span>);

export default function Intro() {
  const root = useRef();
  const chapter = useStore(s => s.chapter);
  const gone = useStore(s => s.phase === "inhaling" || s.phase === "running" || s.phase === "done");

  // mist texture: made by a worker, then the wisps fade in
  useEffect(() => {
    let alive = true;
    cloudURL().then(u => { if (!alive || !root.current) return; root.current.style.setProperty("--cloud", `url(${u})`); root.current.classList.add("has-mist"); });
    return () => { alive = false; };
  }, []);

  // the words come into focus out of the haze
  useEffect(() => {
    if (store.get().reducedMotion) return;
    const ctx = gsap.context(() => {
      gsap.from(".intro-head .ch", { opacity: 0, filter: "blur(18px)", y: 18, duration: 1.8, ease: "expo.out", stagger: { each: 0.035, from: "random" }, delay: 0.15 });
      gsap.from(".intro-foot > *", { opacity: 0, y: 10, duration: 1.4, ease: "expo.out", stagger: 0.12, delay: 1.4 });
    }, root);
    return () => ctx.revert();
  }, []);

  // breathe in: the words come apart and sink after the cloud; replay gathers them again
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; if (!gone) return; }
    const still = store.get().reducedMotion;
    const q = s => root.current.querySelectorAll(s);
    const cx = innerWidth / 2;
    if (gone) {
      gsap.to(q(".intro-head .ch"), { opacity: 0, filter: "blur(16px)", scale: 0.86, overwrite: true,
        x: (i, el) => { const r = el.getBoundingClientRect(); return (cx - (r.left + r.width / 2)) * 0.22; },
        y: () => 40 + Math.random() * 70, duration: still ? 0 : 1.5, ease: "power2.in", stagger: still ? 0 : { each: 0.022, from: "random" } });
      gsap.to(q(".wisp"), { y: "22vh", scale: 0.35, opacity: 0, duration: still ? 0 : 2.2, ease: "power2.in", overwrite: true, stagger: 0.1 });
      gsap.to(q(".intro-foot > *"), { opacity: 0, duration: still ? 0 : 0.5, overwrite: true });
    } else {
      gsap.to(q(".intro-head .ch"), { opacity: 1, filter: "blur(0px)", scale: 1, x: 0, y: 0, overwrite: true,
        duration: still ? 0 : 1.8, ease: "expo.out", delay: still ? 0 : 0.9, stagger: still ? 0 : { each: 0.03, from: "random" } });
      gsap.to(q(".wisp"), { y: 0, scale: 1, opacity: 1, duration: still ? 0 : 2.6, ease: "power3.out", delay: still ? 0 : 0.4, overwrite: true });
      gsap.to(q(".intro-foot > *"), { opacity: 1, duration: still ? 0 : 1, delay: still ? 0 : 1.6, overwrite: true });
    }
  }, [gone]);

  return (
    <div className={"intro" + (chapter === "intro" ? "" : " is-away")} ref={root} aria-hidden="true">
      <div className="wisp wisp--4"><i /></div>
      <div className="wisp wisp--3"><i /></div>
      <div className="intro-head">
        <p className="intro-l1">{chars("Tastes like ")}<span className="w-candy">{chars("candy.", "ch--candy")}</span></p>
        <p className="intro-l2">{chars("Breathes like ")}<span className="w-lead">{chars("lead.", "ch--lead")}</span></p>
      </div>
      <div className="wisp wisp--1"><i /></div>
      <div className="wisp wisp--2"><i /></div>
      <div className="chems">
        {CHEMS.map((c, i) => (
          <span className="chem" data-chem={i} key={c.n}>
            <i /><b>{formula(c.f).map(p => (p.sub ? <sub key={p.k}>{p.sub}</sub> : <span key={p.k}>{p.t}</span>))}</b><em>{c.n}</em>
          </span>
        ))}
      </div>
      <div className="intro-foot">
        <p className="intro-note">Each chemical named here has been measured in e-cigarette aerosol in published studies. Amounts vary by device and liquid.</p>
        <a className="intro-cue cursor-target" tabIndex={-1} href="#hero" onClick={e => { e.preventDefault(); scrollToId("hero"); }}><span>Scroll to breathe in</span><i /></a>
      </div>
    </div>
  );
}
