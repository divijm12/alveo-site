// The scroll-driven product introduction that follows the 3D hero.
// Sections: notice (menu bar + puff card) · pace (plan chart + tones) · heal (drives store.heal 0..1,
// centre kept open for the 3D lungs) · private (on-device) · final call-to-action.
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { store } from "../store.js";
import lung from "../data/lung.json";
import "./sections.css";

gsap.registerPlugin(ScrollTrigger);

/* ---------- plan data (mirrors quit_plan.PACES in the app) ---------- */
const TOTAL_DAYS = 90;
const PACES = [
  { id: "fast", name: "Fast", span: "2 weeks", steps: [[5, 0.75], [10, 0.5], [14, 0.25]],
    detail: "75% of your usual on days 1–5, 50% on days 6–10, 25% on days 11–14." },
  { id: "steady", name: "Steady", span: "4 weeks", steps: [[7, 0.8], [14, 0.6], [21, 0.4], [28, 0.2]],
    detail: "80%, 60%, 40%, then 20% of your usual: one step down each week." },
  { id: "slow", name: "Slow", span: "8 weeks", steps: [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2].map((s, i) => [7 * (i + 1), s]),
    detail: "10% less each week, from 90% down to 20%. Small steps." },
];
const shareOn = (pace, day) => (pace.steps.find(([last]) => day <= last) || pace.steps[pace.steps.length - 1])[1];
const cutEnd = pace => pace.steps[pace.steps.length - 1][0];
const holdAt = pace => pace.steps[pace.steps.length - 1][1];
const pct = s => `${Math.round(s * 100)}%`;

const TONES = [
  { id: "gentle", name: "Gentle", note: "Supportive. The default.",
    line: "Only 9 left today. Want to try the urge timer before the next one?" },
  { id: "firm", name: "Firm", note: "Direct. No sugar-coating.",
    line: "Close to the limit: 9 left. Decide now, not mid-craving." },
  { id: "brutal", name: "Brutal", note: "Hard words. Opt-in, behind a warning.",
    line: "Again. Look at your lungs." },
];

/* ---------- small pieces ---------- */
function Title({ lines, as: Tag = "h2", className = "" }) {
  return (
    <Tag className={`pi-title ${className}`}>
      {lines.map((l, i) => (
        <span className="pi-mask" key={i}><span className="pi-rise">{l}</span>{" "}</span>
      ))}
    </Tag>
  );
}

function Eyebrow({ n, children }) {
  return <p className="pi-eyebrow pi-rv"><span className="pi-eyebrow__n">{n}</span>{children}</p>;
}

// The logo: dot-halftone lungs from lung.json (same data the 3D scene uses).
function LungMark({ className = "", id = "lm" }) {
  const f = lung.fade;
  return (
    <svg className={className} viewBox="222 188 580 660" aria-hidden="true">
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1={f.y1} x2="0" y2={f.y2}>
          <stop offset="0" stopColor={f.from} /><stop offset="1" stopColor={f.to} />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${id})`} strokeLinecap="round" strokeLinejoin="round">
        {lung.airway.map((a, i) => <path key={i} d={a.d} strokeWidth={a.w} />)}
      </g>
      <g fill={`url(#${id})`}>
        {lung.dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} />)}
      </g>
    </svg>
  );
}

function MiniLung() {   // menu-bar sized glyph
  return (
    <svg className="pi-mb__glyph" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1.5v5.2M8 6.4 5.6 8.6M8 6.4l2.4 2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      {[[4.2, 6], [2.6, 8.7], [4.6, 9.4], [3, 12], [5.2, 12.4], [11.8, 6], [13.4, 8.7], [11.4, 9.4], [13, 12], [10.8, 12.4]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.05" fill="currentColor" />
      ))}
    </svg>
  );
}

/* ---------- a. menu bar + puff card mock ---------- */
const STATUS = {
  ok: { label: left => `✓ ${left} puffs left today`, line: left => `${left} left today. A short break now makes the rest easier.` },
  close: { label: left => `! Close to today's limit · ${left} left`, line: left => `Only ${left} left today. Want to try the urge timer before the next one?` },
  over: { label: (left) => `✕ Over today's limit by ${-left}`, line: () => "You're over today's limit. That's okay. Want to try the urge timer?" },
};

function DeskMock({ count }) {
  const limit = 60, left = limit - count;
  const status = count > limit ? "over" : count >= 0.8 * limit ? "close" : "ok";
  const fill = Math.min(1, count / limit);
  return (
    <div className="pi-desk" role="img" aria-label={`Mock-up: the Mac menu bar shows ${count}/${limit}; a small card shows ${count} of ${limit} puffs today, the plan line, a tone line, and the buttons Not a vape and Start 30-sec urge timer.`}>
      <div className="pi-desk__wall" />
      <div className="pi-mb" aria-hidden="true">
        <span className="pi-mb__notch"><i className="pi-mb__lens" /><i className="pi-mb__cam" /></span>
        <div className="pi-mb__left"><span className="pi-mb__app">Code</span><span>File</span><span>Edit</span><span>Selection</span><span>View</span><span>Window</span></div>
        <div className="pi-mb__right">
          <span className="pi-mb__alveo"><MiniLung /><b>{count}/{limit}</b></span>
          <svg className="pi-mb__ico" viewBox="0 0 18 14"><path d="M9 12.6 6.9 10.3a3 3 0 0 1 4.2 0L9 12.6Zm-4.2-4.4a6 6 0 0 1 8.4 0l-1.1 1.2a4.4 4.4 0 0 0-6.2 0L4.8 8.2Zm-2.6-2.8a9.6 9.6 0 0 1 13.6 0l-1.1 1.2a8 8 0 0 0-11.4 0L2.2 5.4Z" fill="currentColor" /></svg>
          <svg className="pi-mb__ico pi-mb__bat" viewBox="0 0 26 13"><rect x=".6" y=".6" width="21.8" height="11.8" rx="3.4" fill="none" stroke="currentColor" strokeOpacity=".5" /><rect x="2.4" y="2.4" width="14" height="8.2" rx="1.8" fill="currentColor" /><path d="M24 4.4v4.2c.9-.3 1.4-1.1 1.4-2.1s-.5-1.8-1.4-2.1Z" fill="currentColor" fillOpacity=".5" /></svg>
          <span className="pi-mb__time">Mon 9 Nov&nbsp;&nbsp;14:32</span>
        </div>
      </div>
      <div className="pi-card" data-status={status} aria-hidden="true">
        <div className="pi-card__head">
          <span className="pi-card__app"><MiniLung />Alveo</span><span className="pi-card__now">now</span>
          <span className="pi-card__x">✕</span>
        </div>
        <div className="pi-card__count"><b>{count}</b><span>/ {limit} puffs today</span></div>
        <div className="pi-bar"><i style={{ width: `${fill * 100}%` }} /></div>
        <div className="pi-card__status">{STATUS[status].label(left)}</div>
        <p className="pi-card__line">{STATUS[status].line(left)}</p>
        <div className="pi-card__plan">Steady plan · Week 2 of 4 · limit is 60% of your usual</div>
        <div className="pi-card__btns"><span className="pi-btn">Not a vape</span><span className="pi-btn pi-btn--pri">Start 30-sec urge timer</span></div>
      </div>
    </div>
  );
}

/* ---------- b. pace chart ---------- */
function useWidth(initial) {
  const ref = useRef(null);
  const [w, setW] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function PaceChart({ sel }) {
  const [wrapRef, W] = useWidth(760);
  const [hover, setHover] = useState(null);
  const narrow = W < 560;
  const H = Math.round(Math.min(400, Math.max(270, W * 0.5)));
  const m = { l: narrow ? 38 : 50, r: narrow ? 10 : 18, t: 58, b: 34 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const x = d => m.l + (d / TOTAL_DAYS) * iw;
  const y = s => m.t + (1 - s) * ih;
  const pace = PACES.find(p => p.id === sel);

  const paths = useMemo(() => Object.fromEntries(PACES.map(p => {
    let d = `M${x(0)} ${y(p.steps[0][1])}`;
    p.steps.forEach(([last], i) => {
      d += ` H${x(last)}`;
      if (p.steps[i + 1]) d += ` V${y(p.steps[i + 1][1])}`;
    });
    d += ` H${x(TOTAL_DAYS)}`;
    return [p.id, d];
  })), [W, H]); // eslint-disable-line react-hooks/exhaustive-deps

  const order = [...PACES.filter(p => p.id !== sel), pace];   // selected line drawn on top
  const onMove = e => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) * (W / r.width);
    const day = Math.min(TOTAL_DAYS, Math.max(1, Math.ceil(((px - m.l) / iw) * TOTAL_DAYS)));
    setHover({ day, px: x(day - 0.5) });
  };
  const sx = x(cutEnd(pace)), hy = y(holdAt(pace));

  return (
    <div className="pi-chart" ref={wrapRef}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Step chart of the daily limit as a share of your usual, days 0 to 90. ${PACES.map(p => `${p.name}: ${p.detail}`).join(" ")} Every plan then holds at its last limit to day 90; an optional zero-puff goal is offered at the end.`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <filter id="pi-glow" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="4" /></filter>
        </defs>
        {/* phases of the selected pace: brackets in the top band + shaded support */}
        <g className="pi-chart__support">
          <rect x={sx} y={m.t} width={x(TOTAL_DAYS) - sx} height={ih} />
          <path className="pi-chart__brk" d={`M${x(0)} 30 V24 H${sx - 3} V30`} />
          <path className="pi-chart__brk" d={`M${sx + 3} 30 V24 H${x(TOTAL_DAYS)} V30`} />
          {!(narrow && cutEnd(pace) < 20) && <text x={x(0)} y={14}>Cutting</text>}
          <text x={sx + 3} y={14}>{narrow ? "Support" : `Support · holds at ${pct(holdAt(pace))} to day 90`}</text>
        </g>
        {[0, 0.25, 0.5, 0.75, 1].map(s => (
          <g key={s} className="pi-chart__grid">
            <line x1={m.l} x2={x(TOTAL_DAYS)} y1={y(s)} y2={y(s)} className={s === 1 ? "is-usual" : s === 0 ? "is-base" : ""} />
            <text x={m.l - 10} y={y(s) + 4} textAnchor="end">{pct(s)}</text>
          </g>
        ))}
        <text className="pi-chart__usual" x={x(TOTAL_DAYS)} y={y(1) - 8} textAnchor="end">your usual</text>
        {[0, 14, 28, 56, 90].map(d => (
          <text key={d} className="pi-chart__xt" x={x(d)} y={H - m.b + 20} textAnchor={d === 0 ? "start" : d === 90 ? "end" : "middle"}>
            {narrow ? d : d === 0 ? "Day 0" : d === 90 ? "Day 90" : d}
          </text>
        ))}
        {order.map(p => (
          <g key={p.id} className={`pi-chart__series ${p.id === sel ? "is-sel" : ""}`}>
            {p.id === sel && <path d={paths[p.id]} className="pi-chart__glow pi-draw" pathLength="1" filter="url(#pi-glow)" />}
            <path d={paths[p.id]} className="pi-chart__line pi-draw" pathLength="1" />
          </g>
        ))}
        <g className="pi-chart__labels">{!narrow && PACES.map(p => (   // direct labels where each pace finishes cutting
          <text key={p.id} className={`pi-chart__label ${p.id === sel ? "is-sel" : ""}`}
            x={x(cutEnd(p)) + 7} y={p.id === "fast" ? y(holdAt(p)) - 8 : y(holdAt(p)) + 17}>{p.name}</text>
        ))}</g>
        {/* optional zero goal at the end */}
        <g className="pi-chart__zero">
          <line x1={x(TOTAL_DAYS)} x2={x(TOTAL_DAYS)} y1={hy + 6} y2={y(0) - 5} />
          <circle cx={x(TOTAL_DAYS)} cy={y(0)} r="4.5" />
          <text x={x(TOTAL_DAYS) - 12} y={y(0) - 10} textAnchor="end">{narrow ? "Zero goal · optional" : "Zero-puff goal · optional, offered"}</text>
        </g>
        {hover && (
          <g className="pi-chart__cross" pointerEvents="none">
            <line x1={hover.px} x2={hover.px} y1={m.t} y2={y(0)} />
            {PACES.map(p => <circle key={p.id} className={p.id === sel ? "is-sel" : ""} cx={hover.px} cy={y(shareOn(p, hover.day))} r="4" />)}
          </g>
        )}
      </svg>
      {hover && (
        <div className="pi-tip" style={{ left: `${(hover.px / W) * 100}%`, transform: `translateX(${hover.px > W * 0.6 ? "calc(-100% - 14px)" : "14px"})` }}>
          <b>Day {hover.day}</b>
          {PACES.map(p => (
            <span key={p.id} className={p.id === sel ? "is-sel" : ""}><i />{p.name}<em>{pct(shareOn(p, hover.day))}</em></span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- d. privacy flow ---------- */
function Flow() {
  return (
    <div className="pi-flow pi-rv" role="img" aria-label="Diagram: on your computer, the camera feeds an on-device model, which updates your count. Nothing goes to the cloud.">
      <div className="pi-flow__box">
        <span className="pi-flow__tag">Your computer</span>
        <div className="pi-flow__row">
          <div className="pi-flow__node">
            <svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="9" width="30" height="22" rx="6" /><circle cx="20" cy="20" r="6.5" /><circle cx="20" cy="20" r="2.4" className="f" /></svg>
            <span>Webcam</span>
          </div>
          <div className="pi-flow__wire"><i /></div>
          <div className="pi-flow__node">
            <svg viewBox="0 0 40 40" aria-hidden="true"><rect x="10" y="10" width="20" height="20" rx="4" /><rect x="15" y="15" width="10" height="10" rx="2" className="f" /><path d="M15 5v5M20 5v5M25 5v5M15 30v5M20 30v5M25 30v5M5 15h5M5 20h5M5 25h5M30 15h5M30 20h5M30 25h5" /></svg>
            <span>On-device model</span>
          </div>
          <div className="pi-flow__wire"><i /></div>
          <div className="pi-flow__node pi-flow__node--count">
            <b>51/60</b>
            <span>Your count</span>
          </div>
        </div>
      </div>
      <div className="pi-flow__out">
        <div className="pi-flow__gap" />
        <div className="pi-flow__cloud">
          <svg viewBox="0 0 48 36" aria-hidden="true"><path d="M13 30h22a8 8 0 0 0 .8-16 11 11 0 0 0-21-2.5A9.3 9.3 0 0 0 13 30Z" /><path d="M8 33 40 3" className="x" /></svg>
          <span>Cloud<br /><em>nothing sent</em></span>
        </div>
      </div>
    </div>
  );
}

/* ---------- main ---------- */
export default function ProductIntro() {
  const root = useRef(null);
  const healRef = useRef(null);
  const deskRef = useRef(null);
  const [count, setCount] = useState(51);
  const [pace, setPace] = useState("steady");
  const sel = PACES.find(p => p.id === pace);

  useLayoutEffect(() => {
    let mm;
    const ctx = gsap.context(() => {
      // Recovery: drive store.heal 0 -> 1 while the tall section is pinned (sticky) in view.
      const heal = healRef.current;
      let last = -1;
      const push = p => {
        heal.style.setProperty("--p", p.toFixed(4));
        if (Math.abs(p - last) > 0.0005 || p === 0 || p === 1) { last = p; store.set({ heal: p }); }
      };
      const healST = ScrollTrigger.create({
        trigger: heal, start: "top top", end: "bottom bottom",
        onUpdate: s => push(s.progress), onRefresh: s => push(s.progress),
      });
      push(healST.progress);

      const el = root.current;
      const q = sel => Array.from(el.querySelectorAll(sel));
      mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // masked line-rise for every heading
        q(".pi-title, .pi-word").forEach(t => {
          gsap.from(t.querySelectorAll(".pi-rise"), {
            yPercent: 118, rotate: 2, duration: 1.15, ease: "expo.out", stagger: 0.09,
            scrollTrigger: { trigger: t, start: "top 88%" },
          });
        });
        // soft fade-up for copy and panels
        gsap.set(q(".pi-rv"), { autoAlpha: 0 });
        ScrollTrigger.batch(q(".pi-rv"), {
          start: "top 90%", once: true,
          onEnter: els => gsap.fromTo(els, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, ease: "power3.out", stagger: 0.08, overwrite: true }),
        });
        // subtle parallax on mocks
        q("[data-parallax]").forEach(el => {
          const a = parseFloat(el.dataset.parallax) || 40;
          gsap.fromTo(el, { y: a }, { y: -a, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
        });
        // puff card drops in, and the count ticks up to 51 as you scroll
        gsap.from(".pi-card", { y: -18, x: 14, autoAlpha: 0, scale: 0.97, duration: 0.9, ease: "power3.out",
          scrollTrigger: { trigger: deskRef.current, start: "top 75%" } });
        const tick = ScrollTrigger.create({
          trigger: deskRef.current, start: "top 85%", end: "center 45%",
          onUpdate: s => setCount(44 + Math.round(s.progress * 7)),
        });
        setCount(44 + Math.round(tick.progress * 7));
        // pace lines draw in
        gsap.fromTo(".pi-draw", { strokeDashoffset: 1 }, {
          strokeDashoffset: 0, ease: "none",
          scrollTrigger: { trigger: ".pi-chart", start: "top 82%", end: "top 30%", scrub: 0.6 },
        });
        gsap.from(".pi-chart__support, .pi-chart__zero, .pi-chart__labels", {
          autoAlpha: 0, duration: 0.8, stagger: 0.12,
          scrollTrigger: { trigger: ".pi-chart", start: "top 40%" },
        });
        // final mark breathes in
        gsap.from(".pi-end__mark", { scale: 0.86, autoAlpha: 0, duration: 1.6, ease: "expo.out",
          scrollTrigger: { trigger: ".pi-end", start: "top 70%" } });
        return () => setCount(51);
      }, el);
    }, root);
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => { mm?.revert(); ctx.revert(); store.set({ heal: 0 }); };
  }, []);

  return (
    <div className="pi" ref={root}>
      {/* a. bridge from the hero */}
      <section className="pi-sec pi-notice" id="notice" aria-label="Alveo notices every puff">
        <div className="pi-wrap pi-notice__grid">
          <div className="pi-copy">
            <Eyebrow n="01">Notice</Eyebrow>
            <Title lines={["Alveo notices", "every puff."]} className="pi-h" />
            <p className="pi-lead pi-rv">Your webcam sees the vape reach your lips while you're at your desk, and Alveo adds one to today's count. The model runs on your own computer.</p>
            <ul className="pi-points">
              <li className="pi-rv"><b>Today's count, always in view</b><span>51/60 in the menu bar: puffs so far against your limit. In the system tray on Windows.</span></li>
              <li className="pi-rv"><b>A small card after a puff</b><span>Your count, your plan, and a 30-second urge timer one click away.</span></li>
              <li className="pi-rv"><b>It learns from you</b><span>Wrong call? Tap “Not a vape”. Corrections are learned.</span></li>
            </ul>
            <p className="pi-fine pi-rv">It counts what it can see: puffs at your desk, in front of the camera.</p>
          </div>
          <div className="pi-mockcol" ref={deskRef}>
            <div data-parallax="28"><div className="pi-rv"><DeskMock count={count} /></div></div>
            <div className="pi-legend pi-rv" aria-label="Bar colours">
              <span data-s="ok"><i />Under 80% of today's limit</span>
              <span data-s="close"><i />Close: 80% or more</span>
              <span data-s="over"><i />Over the limit</span>
            </div>
          </div>
        </div>
      </section>

      {/* b. plans and tone */}
      <section className="pi-sec pi-pace" aria-label="Cut down at your pace">
        <div className="pi-wrap">
          <div className="pi-pace__intro">
            <Eyebrow n="02">Plan</Eyebrow>
            <Title lines={["Cut down", "at your pace."]} className="pi-h" />
            <p className="pi-lead pi-rv">Your daily limit is a share of how much you usually vape at your desk. Pick a pace and it steps down from there.</p>
          </div>

          <div className="pi-panel pi-rv">
            <div className="pi-seg" role="radiogroup" aria-label="Pace">
              {PACES.map(p => (
                <button key={p.id} role="radio" aria-checked={pace === p.id} className={pace === p.id ? "is-on" : ""} onClick={() => setPace(p.id)}>
                  <b>{p.name}</b><span>{p.span}</span>{p.id === "steady" && <em>Default</em>}
                </button>
              ))}
            </div>
            <PaceChart sel={pace} />
            <div className="pi-panel__foot">
              <p className="pi-panel__detail"><b>{sel.name} · {sel.span}.</b> {sel.detail}</p>
              <p className="pi-panel__note">Every plan runs about 90 days: the cutting phase, then support that holds your last limit to day 90. At the end a zero-puff goal is offered. Optional, never forced.</p>
            </div>
          </div>

          <div className="pi-tones">
            <div className="pi-tones__head pi-rv">
              <h3>Pick how it talks to you.</h3>
              <p>The card's one line changes with the tone you choose.</p>
            </div>
            <div className="pi-tones__grid">
              {TONES.map(t => (
                <article key={t.id} className={`pi-tone pi-rv pi-tone--${t.id}`}>
                  <header><span className="pi-chip">{t.name}</span>{t.id === "gentle" && <em>Default</em>}{t.id === "brutal" && <em className="warn">Opt-in</em>}</header>
                  <p className="pi-tone__note">{t.note}</p>
                  <blockquote>“{t.line}”</blockquote>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* c. recovery: drives store.heal; the centre stays open for the 3D lungs */}
      <section className="pi-heal" ref={healRef} id="heal" data-scene="open" aria-label="Every puff you skip shows">
        <div className="pi-heal__sticky">
          <div className="pi-wrap pi-heal__wrap">
            <div className="pi-heal__copy">
              <Eyebrow n="03">Progress</Eyebrow>
              <Title lines={["Every puff", "you skip shows."]} className="pi-h" />
              <ol className="pi-beats">
                <li style={{ "--at": 0.08 }}>Skip one.</li>
                <li style={{ "--at": 0.4 }}>Stay under today's limit.</li>
                <li style={{ "--at": 0.72 }}>Put a good week together.</li>
              </ol>
              <div className="pi-week" aria-hidden="true">
                <span className="pi-week__label">Example week · days under your limit</span>
                <div className="pi-week__days">
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} style={{ "--i": i }}><i />{d}</span>)}
                </div>
              </div>
              <p className="pi-fine">The lung picture in Alveo clears as your week improves. It's an illustration that tracks your week, not a measurement of your lungs.</p>
            </div>
          </div>
        </div>
      </section>

      {/* d. privacy */}
      <section className="pi-sec pi-private" aria-label="Nothing leaves your desk">
        <div className="pi-wrap pi-private__grid">
          <div className="pi-copy">
            <Eyebrow n="04">Private</Eyebrow>
            <Title lines={["Nothing leaves", "your desk."]} className="pi-h" />
            <p className="pi-lead pi-rv">Alveo looks for the vape on your own computer. Camera frames are never uploaded, and it keeps counting with the Wi-Fi off.</p>
          </div>
          <div data-parallax="18"><Flow /></div>
          <ul className="pi-facts">
            <li className="pi-rv"><b>On-device model</b><span>The detector runs on your computer's own chip. No server in the loop.</span></li>
            <li className="pi-rv"><b>Works offline</b><span>Counting, your plan and your dashboard all work without internet.</span></li>
            <li className="pi-rv"><b>Quiet in meetings</b><span>On a call or sharing your screen? Meeting mode keeps counting but shows nothing.</span></li>
          </ul>
        </div>
      </section>

      {/* e. call to action */}
      <section className="pi-sec pi-end" aria-label="Alveo">
        <div className="pi-wrap pi-end__inner">
          <LungMark className="pi-end__mark" id="pi-end-fade" />
          <h2 className="pi-word"><span className="pi-mask"><span className="pi-rise">ALVEO<span className="pi-dot">.</span></span></span></h2>
          <p className="pi-end__line pi-rv">Notices when you vape at your desk.<br />Helps you cut down, and possibly quit.</p>
          <p className="pi-soon pi-rv"><i aria-hidden="true" />Coming soon to Mac and Windows</p>
        </div>
        <footer className="pi-foot"><div className="pi-wrap"><div className="pi-foot__in"><span>© 2026 Alveo</span><span>Camera frames never leave your computer.</span></div></div></footer>
      </section>
    </div>
  );
}
