# Alveo 3D landing (draft, desktop)

Interactive opening for getalveo.app: a matte-black vape floats on black; click it and it swings tip-down, docks in a
mechanical windpipe and fires 3 glowing balls into the dot lungs of the Alveo logo. Each dot is its own physics body:
a hit knocks it out (Brick Breaker), neighbours scorch. Ends on "Every puff leaves a mark."; scrolling continues into
the product intro, and in the "Every puff you skip shows" section the lungs relight dot by dot.

Separate from the live coming-soon page (`../index.html`), which is unchanged.

```sh
npm install
npm run dev        # http://127.0.0.1:5174
npm run build      # -> dist/ (relative paths; works from any folder)
npm run dots       # re-read ../logo.svg -> src/data/lung.json (212 dots + physics wall)
npm run sim-test   # headless physics check: 8 seeded games, damage + length
node tools/shoot.mjs name 1440 900 --fire --at=2,5,12   # screenshots in shots/ (real Chrome)
```

| File | Role |
|---|---|
| `src/sim/LungSim.js` | Rapier 2D on the lung plane: dot colliders, wall, balls, kills, scorch, burst, `runInstant` |
| `src/scene/Experience.jsx` | Canvas, post (bloom, neutral tone map, vignette, grain), director: GSAP vape + camera shots |
| `src/scene/Lungs.jsx` | chassis (extruded wall), sockets, glowing glass beads (one per logo dot), airway inlay, rail |
| `src/scene/Airway.jsx` | C-ring windpipe and docking port |
| `src/scene/Vape.jsx` | procedural box mod (no external assets) |
| `src/scene/Balls.jsx`, `Effects.jsx` | balls + trails + lights; pooled sparks, shards, shockwaves, impact light, shake |
| `src/sections/ProductIntro.jsx` | product sections (ScrollTrigger); `#heal` drives `store.heal` |

Numbers (Intel Arc iGPU, Chrome, 1440x900): 60 fps during the run; one game destroys ~85-92 of 212 dots in ~10-12 s.
Rendering stops while the scene is hidden under the product sections. Reduced motion: still end state, no effects.
Download: ~1.7 MB gzipped (3D chunk lazy-loaded; most of it is three.js + the Rapier WASM).
