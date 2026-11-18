// The healthy lungs' breathing at Download (RJ 2026-11-11: "give healthy lung effects"): a calm resting breath,
// ~13 a minute, inhale a little quicker than the exhale. `vital` eases toward live.calm (the scroll into Download),
// so the breathing fades in as you arrive and out as you scroll back up.
import { live } from "../store.js";

export const PERIOD = 4.6;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** 0 = empty, 1 = full, at time t (s) */
export const breathAt = t => { const f = ((t / PERIOD) % 1 + 1) % 1; return f < 0.4 ? sstep(0, 0.4, f) : 1 - sstep(0.4, 1, f); };
/** +1 while breathing in, -1 while breathing out */
export const breathDir = t => (((t / PERIOD) % 1 + 1) % 1 < 0.4 ? 1 : -1);
export const vital = { v: 0 };
/** call once per frame (Lungs does) */
export function tickVital(dt) { vital.v += (live.calm - vital.v) * Math.min(1, dt * 2.2); if (vital.v < 1e-3) vital.v = 0; }
