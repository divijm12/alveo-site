// Tiny shared store (no dependency): the 3D scene, the DOM overlay and the scroll sections read and write it.
import { useSyncExternalStore } from "react";
const state = {
  phase: "loading",   // loading | idle (the cloud in the sky) | inhaling | running (poison spreads) | done
  chapter: "landing", // landing | intro | problem | solution | download (what the story column shows)
  destroyed: 0,       // dots destroyed so far
  total: 212,
  findings: false,   // the five chemical markers are placed on the poisoned lungs
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
// Values scroll writes and the scene reads every frame (no subscribers, no re-renders).
//   open: 0..1, how far the landing has scrolled away = how much of the vape cloud has rolled in
//   heal: 0..1, where the scroll is in the solution chapter (store.heal follows it, eased)
//   story: 0..1, where the scroll is between the candy screen and the end of the problem: the breath + the poison
export const live = { open: 0, heal: 0, story: 0 };
