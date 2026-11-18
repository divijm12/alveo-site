// "What you just breathed in": once the poison has filled the lungs, five markers appear on the dead tissue, one per
// chemical. Hover (or tap / focus) a marker to open its card: formula, name, IUPAC name and one line. The 3D scene
// (scene/Markers.jsx) moves the markers with the lungs and tells each card which way to open.
import { useEffect, useState } from "react";
import { useStore } from "./store.js";
import { FINDINGS, formula } from "./chems.js";

const Formula = ({ f }) => formula(f).map(p => (p.sub ? <sub key={p.k}>{p.sub}</sub> : <span key={p.k}>{p.t}</span>));

export default function Findings() {
  const show = useStore(s => s.findings && s.heal < 0.05);   // until the lungs start to heal (wherever the reader is)
  const [hover, setHover] = useState(-1), [pinned, setPinned] = useState(-1);
  const open = hover >= 0 ? hover : pinned;
  useEffect(() => { if (!show) { setHover(-1); setPinned(-1); } }, [show]);
  useEffect(() => {
    const esc = e => e.key === "Escape" && (setPinned(-1), setHover(-1));
    const away = e => !e.target.closest?.(".find") && setPinned(-1);
    addEventListener("keydown", esc); addEventListener("pointerdown", away);
    return () => { removeEventListener("keydown", esc); removeEventListener("pointerdown", away); };
  }, []);

  return (
    <div className={"finds" + (show ? " is-on" : "")} aria-hidden={!show}>
      {FINDINGS.map((c, i) => (
        <div className={"find" + (open === i ? " is-open" : "")} data-find={i} key={c.n} style={{ "--i": i }}
          onPointerEnter={e => e.pointerType === "mouse" && setHover(i)} onPointerLeave={e => e.pointerType === "mouse" && setHover(-1)}>
          <button className="find-pin cursor-target" type="button" tabIndex={show ? 0 : -1} aria-expanded={open === i} aria-controls={`find-${i}`}
            data-cursor-label={c.n.toLowerCase()} onClick={() => setPinned(p => (p === i ? -1 : i))} onFocus={() => setPinned(i)} onBlur={() => setPinned(p => (p === i ? -1 : p))}>
            <i aria-hidden="true" /><span><Formula f={c.f} /></span>
          </button>
          <div className="find-card" id={`find-${i}`} role="note">
            <p className="find-top"><b><Formula f={c.f} /></b><span>{c.n}</span></p>
            <p className="find-iupac"><em>IUPAC</em>{c.iupac}</p>
            <p className="find-line">{c.line}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
