// Pins the five findings (chems.js FINDINGS) onto the poisoned lungs. Once the puff is done, five dead patches are
// picked, spread as far apart as possible (farthest-point sampling, both lungs), and every frame their 3D spots are
// projected onto the page for the DOM markers (Findings.jsx). Each marker is also told which way its card should
// open (towards the free side of the screen, away from the story column).
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FINDINGS } from "../chems.js";
import { store } from "../store.js";

export default function Markers({ simRef }) {
  const els = useRef([]), spots = useRef(null), v = useRef(new THREE.Vector3());
  useEffect(() => { els.current = [...document.querySelectorAll("[data-find]")]; }, []);

  useFrame((state) => {
    const sim = simRef.current; if (!sim) return;
    const done = store.get().phase === "done";
    if (!done) { if (spots.current) { spots.current = null; store.set({ findings: false }); } return; }
    if (!spots.current) {
      const dead = sim.dots.filter(d => !d.alive);
      const pool = dead.length >= FINDINGS.length ? dead : [...sim.dots].sort((a, b) => b.tox - a.tox).slice(0, 20);
      const pick = [pool.reduce((a, b) => (Math.hypot(b.x, b.y - 0.6) > Math.hypot(a.x, a.y - 0.6) ? b : a))];
      while (pick.length < FINDINGS.length) {
        let best = null, bd = -1;
        for (const d of pool) { if (pick.includes(d)) continue; const m = Math.min(...pick.map(p => Math.hypot(p.x - d.x, p.y - d.y))); if (m > bd) { bd = m; best = d; } }
        pick.push(best);
      }
      pick.sort((a, b) => b.y - a.y);                            // top to bottom, so the list order reads naturally
      spots.current = pick.map(d => [d.x, d.y]);
      store.set({ findings: true });
    }
    const W = state.size.width, H = state.size.height, cam = state.camera;
    spots.current.forEach(([x, y], i) => {
      const el = els.current[i]; if (!el) return;
      v.current.set(x, y, 0.12).project(cam);
      const sx = (v.current.x + 1) / 2 * W, sy = (1 - v.current.y) / 2 * H;
      el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
      const h = sx < W * 0.66 ? "r" : sx > W * 0.82 ? "l" : "c", vv = sy > H * 0.42 ? "u" : "d";
      if (el.dataset.h !== h) el.dataset.h = h;
      if (el.dataset.v !== vv) el.dataset.v = vv;
    });
  });
  return null;
}
