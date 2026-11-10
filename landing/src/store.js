// Tiny shared store (no dependency): the 3D scene, the DOM overlay and the scroll sections read and write it.
import { useSyncExternalStore } from "react";
const state = {
  phase: "loading",   // loading | idle (the cloud in the sky) | inhaling | running (poison spreads) | done
  chapter: "intro",   // intro | hero | problem | solution | download (what the story column shows)
  destroyed: 0,       // dots destroyed so far
  total: 212,
  heal: 0,            // 0..1, driven by scroll in the product sections: damaged dots relight
  scroll: 0,          // 0..1 over the hero's own scroll-out
  stageReady: false,  // 3D compiled and drawing: the canvas fades in
  deskCount: 44,      // the puff-card mock's count, ticks 44 -> 51 as it scrolls in
  hidden: false,      // stage fully dimmed under the sections: stop rendering
  focus: 0,           // 0..1 while the recovery section (#heal) is on screen: lungs reframed and undimmed
  reducedMotion: typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches,
  quality: "high",    // high | low (mobile / slow GPU)
};
const subs = new Set();
export const store = {
  get: () => state,
  set(patch) { Object.assign(state, typeof patch === "function" ? patch(state) : patch); subs.forEach(f => f()); },
  subscribe(f) { subs.add(f); return () => subs.delete(f); },
};
let snap = { ...state };
store.subscribe(() => { snap = { ...state }; });
export function useStore(sel = s => s) { return useSyncExternalStore(store.subscribe, () => sel(snap), () => sel(snap)); }
// Imperative actions the scene registers (so DOM buttons can trigger them)
export const actions = { fire: () => {}, replay: () => {}, skipToEnd: () => {} };
