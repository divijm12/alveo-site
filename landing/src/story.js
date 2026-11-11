// Story pacing: scroll as fast as you like, the story still plays in full, and the page never feels stuck
// (RJ, 2026-11-11: holding the page / swallowing scrolls felt broken, so nothing here blocks input).
//
// The 3D story runs on its own clock, beside the text, wherever the reader has scrolled to:
//  - the breath, once it starts, plays to the end; the poison is never fast-forwarded to its end (if the reader is
//    already in the solution it runs a little faster, x1.8, Experience.jsx);
//  - the lungs only start to heal once the poison is done and "Every puff leaves a mark." has had HOLD ms
//    (healAllowed, used by App's heal easing; healing itself is speed-limited there too).
// One soft spot: arriving at the candy screen fast, the scroll eases to a stop just before the breath until the words
// have had CANDY ms on screen, like a rubber band (each wheel event still moves the page a little; never a dead
// stop). After that it scrolls straight on.
// Reduced motion: none of this (there is no animation to miss).
import { lenis } from "./smooth.js";
import { store, live } from "./store.js";

const CANDY = 1500;           // ms the candy screen gets before the breath can start
const HOLD = 1800;            // ms the punchline gets before the lungs start to heal
const GIVE = 70;              // px the soft wall gives

let candyAt = 0, doneAt = 0;
const now = () => performance.now();
const top = id => { const el = document.getElementById(id); return el ? el.getBoundingClientRect().top + scrollY : 0; };

store.subscribe(() => {
  const { phase, chapter } = store.get();
  if (chapter === "intro" && phase === "idle" && !candyAt) candyAt = now();
  if (chapter === "landing") candyAt = 0;
  if (phase === "done" && !doneAt) doneAt = now();
  if (phase !== "done") doneAt = 0;
});

export const healAllowed = () => {
  const ph = store.get().phase;
  if (ph === "inhaling" || ph === "running") return false;
  return ph !== "done" || now() - doneAt > HOLD;
};

// where the soft wall is (just before the breath starts, see App: #intro "top top-=12%"), or null when there is none
function wall() {
  if (store.get().reducedMotion || store.get().phase !== "idle") return null;
  if (candyAt && now() - candyAt > CANDY) return null;
  return top("intro") + 12;
}

export function startStory() {
  lenis.options.virtualScroll = data => {
    const W = wall();
    if (W === null || data.deltaY <= 0) return true;
    const at = lenis.targetScroll;                          // (deltaY already has Lenis's wheel multiplier in it)
    if (at + data.deltaY <= W) return true;
    // past the wall: each event moves less the further in it is (the page always moves a little)
    const room = Math.max(0, W - at), over = Math.max(0, at - W);
    data.deltaY = room + Math.max(0, GIVE - over) * 0.14;
    return true;
  };
  // keys can't jump through the wall either (Space / Page Down would otherwise start the breath at once)
  const key = e => {
    if (!["ArrowDown", "PageDown", " "].includes(e.key) || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
    const W = wall(); if (W === null) return;
    const step = e.key === "ArrowDown" ? 60 : innerHeight * 0.85;
    if (lenis.scroll + step > W) { e.preventDefault(); lenis.scrollTo(Math.max(lenis.scroll, W), { duration: 0.6 }); }
  };
  addEventListener("keydown", key);
  return () => { lenis.options.virtualScroll = undefined; removeEventListener("keydown", key); };
}

if (import.meta.env.DEV) window.__story = { store, lenis, live };
