// Story pacing: however fast you scroll, nothing gets skipped (RJ, 2026-11-11).
//
// The top of the page is a sequence of steps, not free scrolling. One scroll gesture = one step, and input is
// held while a step plays:
//   landing --down--> candy screen (glide, then ~2 s hold while the words come in)
//   candy   --down--> the breath (scroll held while the cloud goes down the windpipe; the page glides to the
//                    problem chapter as the camera reaches the lungs)
//   problem --up----> back to the candy screen (the cloud breathes back out),  candy --up--> landing
// Below that, scrolling is free, with one gate: you can't leave the problem chapter until the poison has done its
// work and "Every puff leaves a mark." has had a moment on screen. Pushing against the gate speeds the poison up
// (you see it finish faster) instead of skipping it. And one gesture can't fly past a whole section: crossing into
// the solution, its key points or the download (either way), the page stops there; the next gesture goes on.
// A step only starts on a fresh gesture: a fast flick's trailing wheel events (trackpad inertia, a spun wheel) are
// swallowed until they pause, so one flick can't run through two steps.
// Explicit jumps (nav links, Home / End, the scrollbar) are not held: the story catches up on its own (App.jsx).
// Reduced motion: no steps or gates (there is no animation to miss).
import { lenis } from "./smooth.js";
import { store, actions, live } from "./store.js";

const EASE = t => 1 - Math.pow(1 - t, 4);
const GAP = 220;              // ms of quiet before a new gesture counts
const TOL = 6;                // px: "at" a station
const HOLD_AFTER_DONE = 1800; // ms the punchline gets before the gate opens

let busyUntil = 0, lastInput = 0, fresh = true, doneAt = 0, busy = false, stopAt = null;   // stopAt: parked at a stop, waiting for a fresh gesture
const now = () => performance.now();
const top = id => { const el = document.getElementById(id); return el ? el.getBoundingClientRect().top + scrollY : 0; };
const stations = () => {
  const C = top("intro"), P = top("problem"), S = top("solution");
  const max = lenis.limit, pts = document.querySelector("#solution .pi-points");
  // stops: the solution's top, its three points (mid-screen), the download (or the bottom, whichever comes first)
  const stops = [S, pts ? pts.getBoundingClientRect().top + scrollY - innerHeight * 0.45 : S, top("download")].map(b => Math.min(b, max));
  return { L: 0, C, P, G: Math.max(P, S - innerHeight * 0.7), stops };
};
const held = () => busy || now() < busyUntil;
const gateOpen = () => {
  const ph = store.get().phase;
  if (ph === "inhaling" || ph === "running") return false;
  if (ph === "done") return now() - doneAt > HOLD_AFTER_DONE;
  return true;                // loading / idle: nothing playing (and never trap anyone if the 3D can't start)
};

store.subscribe(() => {
  const ph = store.get().phase;
  if (ph === "done" && !doneAt) doneAt = now();
  if (ph !== "done") doneAt = 0;
  if (ph !== "running") live.hurry = false;
});

function glide(y, { duration = 1.5, hold = 0, lock = true } = {}) {
  busy = lock;
  lenis.scrollTo(y, { duration, easing: EASE, lock, force: true,
    onComplete: () => { busy = false; busyUntil = Math.max(busyUntil, now() + hold); } });
}

// the breath: hold the page while the cloud goes in, then glide down to the problem as the camera reaches the lungs
function breathe(P) {
  actions.fire();
  busy = true;
  setTimeout(() => glide(P, { duration: 2.8, hold: 400 }), 3300);
}

// one step in a direction; returns true if the input was used (so it shouldn't also scroll the page)
export function step(dir) {
  if (store.get().reducedMotion) return false;
  const { L, C, P } = stations(), y = lenis.scroll, phase = store.get().phase;
  if (y >= P - TOL && !(dir < 0 && y <= P + TOL)) return false;     // below the opening: free scrolling
  if (dir > 0) {
    if (y < C - TOL) glide(C, { duration: 1.6, hold: 2000 });        // landing -> candy screen (hold: the words form)
    else if (phase === "idle") breathe(P);                           // candy screen -> the breath
    else glide(P, { duration: 1.4 });                                // (3D still loading: on to the story; it catches up)
  } else {
    if (y > C + TOL) {                                               // problem / after the breath -> candy screen
      if (phase !== "idle" && phase !== "loading") actions.replay();
      glide(C, { duration: 2.2, hold: 1800 });
    } else if (y > L + TOL) glide(L, { duration: 1.4, hold: 300 }); // candy screen -> landing
  }
  return true;
}

// Every wheel / key input goes through here. Returns true when the input should be swallowed.
function intent(dir, target) {
  const t = now(), gap = t - lastInput; lastInput = t;
  if (store.get().reducedMotion) return false;
  if (gap > GAP) fresh = true;
  const { P, G, stops } = stations(), y = lenis.scroll;
  if (held()) { fresh = false; return true; }
  if (stopAt !== null) { if (!fresh) return true; stopAt = null; }
  // the opening: stepped
  if (y < P - TOL || (dir < 0 && y <= P + TOL)) {
    if (!fresh) return true;
    fresh = false;
    step(dir);
    return true;
  }
  const park = b => { if (Math.abs(y - b) > TOL) lenis.scrollTo(b, { duration: 0.9, easing: EASE }); stopAt = b; fresh = false; return true; };
  // scrolling up fast from the story: stop at the top of the problem chapter (the next gesture steps back up)
  if (dir < 0 && target < P - TOL) return park(P);
  // the gate: the poison finishes (faster if you push) and the punchline shows before the solution
  if (dir > 0 && y <= G + TOL && target > G && !gateOpen()) {
    if (store.get().phase === "running") live.hurry = true;
    return park(G);
  }
  // section stops, both ways
  for (const b of dir > 0 ? stops : [...stops].reverse()) {
    if (dir > 0 ? y < b - TOL && target > b + TOL : y > b + TOL && target < b - TOL) return park(b);
  }
  return false;
}

// the Replay button: back to the candy screen, the cloud breathes back out
export function replayFromTop() {
  const ph = store.get().phase;
  if (ph !== "idle" && ph !== "loading") actions.replay();
  glide(stations().C, { duration: 2.2, hold: 900 });
}

export function startStory() {
  lenis.options.virtualScroll = ({ deltaY, event }) => {
    if (!deltaY || event.ctrlKey) return true;
    const target = lenis.targetScroll + deltaY * (lenis.options.wheelMultiplier || 1);
    if (intent(Math.sign(deltaY), target)) { if (event.cancelable) event.preventDefault(); return false; }
    return true;
  };
  const KEYS = { ArrowDown: 1, PageDown: 1, " ": 1, ArrowUp: -1, PageUp: -1 };
  const key = e => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
    let dir = KEYS[e.key]; if (!dir) return;
    if (e.key === " " && e.shiftKey) dir = -1;
    const amount = e.key.startsWith("Arrow") ? 60 : innerHeight * 0.85;
    if (intent(dir, lenis.scroll + dir * amount)) e.preventDefault();
  };
  addEventListener("keydown", key);
  return () => { lenis.options.virtualScroll = undefined; removeEventListener("keydown", key); };
}

if (import.meta.env.DEV) window.__story = { store, lenis, live, stations };
