// Dev stage (?view=sections): a stand-in for the hero, then the product sections, plus a readout of store.heal.
// The faint fixed lung here is only a placeholder for the real 3D scene, so the heal section can be judged.
import ProductIntro from "../sections/ProductIntro.jsx";
import { useStore } from "../store.js";
import lung from "../data/lung.json";

// deterministic "damaged" set: about half the dots, relit in order as heal rises
const damaged = lung.dots.map((_, i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1);
const order = damaged.map((h, i) => [h, i]).filter(([h]) => h < 0.55).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
const rank = new Map(order.map((i, k) => [i, k / order.length]));

function PlaceholderLung() {
  const heal = useStore(s => s.heal);
  const f = lung.fade;
  return (
    <svg viewBox="222 188 580 660" aria-hidden="true"
      style={{ position: "fixed", inset: 0, margin: "auto", height: "72vh", width: "auto", maxWidth: "90vw", zIndex: 0, opacity: 0.9, pointerEvents: "none" }}>
      <defs>
        <linearGradient id="stage-fade" gradientUnits="userSpaceOnUse" x1="0" y1={f.y1} x2="0" y2={f.y2}>
          <stop offset="0" stopColor={f.from} /><stop offset="1" stopColor={f.to} />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#stage-fade)" strokeLinecap="round">{lung.airway.map((a, i) => <path key={i} d={a.d} strokeWidth={a.w} />)}</g>
      <g fill="url(#stage-fade)">
        {lung.dots.map((d, i) => {
          const r = rank.get(i);
          const lit = r === undefined || r < heal;
          return <circle key={i} cx={d.x} cy={d.y} r={d.r} opacity={lit ? 1 : 0.1} />;
        })}
      </g>
    </svg>
  );
}

function Readout() {
  const heal = useStore(s => s.heal);
  return (
    <div style={{ position: "fixed", right: 12, bottom: 12, zIndex: 50, padding: "6px 10px", borderRadius: 8, font: "12px ui-monospace, Menlo, Consolas, monospace", color: "#f4f4f5", background: "rgba(20,20,24,.85)", border: "1px solid #2a2a30" }}>
      heal {heal.toFixed(3)}
    </div>
  );
}

export default function SectionsStage() {
  return (
    <>
      <PlaceholderLung />
      <div style={{ position: "relative", zIndex: 1, height: "100svh", display: "grid", placeItems: "center", color: "#52525b", font: "13px/1.4 var(--font)", letterSpacing: ".2em", textTransform: "uppercase" }}>
        <span>3D hero goes here · scroll</span>
      </div>
      <ProductIntro />
      <Readout />
    </>
  );
}
