# Alveo 3D landing (draft, desktop)

One scroll story beside a live 3D stage (fixed, framed on the right; the story is a column on the left). The
Download button is in the nav the whole time.

1. **Hero**: what Alveo is + Download (OS-aware: Mac or Windows) above the fold. The vape floats on the right.
2. **01 The problem**: scrolling in fires the vape: it docks in a mechanical windpipe and 3 balls knock out the
   logo's dots (each its own physics body, Brick Breaker) while three short beats tell the problem. Ends on
   "Every puff leaves a mark."
3. **02 How it helps**: counting (menu bar + puff card), cut-down paces + tones, privacy, a mid-page Download.
   The lungs relight dot by dot as you read (if you got here early, the game fast-forwards first).
4. **03 Download**: both platforms, beside healthy, breathing lungs.

Download URLs live in `src/config.js` (empty for now: buttons then jump to the Download section).

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
| `src/App.jsx`, `src/story.css` | the page: nav, story column, scroll triggers (fire on #problem, heal across #solution) |
| `src/sections/ProductIntro.jsx` | the mocks reused by the page (menu bar + puff card, pace chart, privacy diagram) |
| `src/config.js` | download links (TODO) |

Numbers (Intel Arc iGPU, Chrome, 1440x900): 60 fps during the run; one game destroys ~85-92 of 212 dots in ~10-12 s.
Rendering stops while the scene is hidden under the product sections. Reduced motion: still end state, no effects.
Download: ~1.7 MB gzipped (3D chunk lazy-loaded; most of it is three.js + the Rapier WASM).
