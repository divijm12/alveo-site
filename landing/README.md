# Alveo 3D landing (draft, desktop)

One scroll story beside a live 3D stage (fixed, framed on the right; the story is a column on the left). The
Download button is in the nav the whole time.

1. **Hero**: what Alveo is + Download (OS-aware: Mac or Windows) above the fold. The vape floats on the right.
2. **01 The problem**: scrolling in fires the vape: it docks in a mechanical windpipe and exhales. Toxic vapor
   pours down the airway, splits at the bronchi and poisons the lungs: it creeps through the tissue in fingers,
   glowing acid green at its edge, and the air sacs it reaches bruise, flare and shrivel into oily husks, leaving
   tar. Three short beats tell the problem meanwhile. Ends on "Every puff leaves a mark."
3. **02 How it helps**: counting (menu bar + puff card), cut-down paces + tones, privacy, a mid-page Download.
   The poison washes out patch by patch as you read (if you got here early, the puff fast-forwards first).
4. **03 Download**: both platforms, beside healthy, breathing lungs.

Download URLs live in `src/config.js` (empty for now: buttons then jump to the Download section).

Separate from the live coming-soon page (`../index.html`), which is unchanged.

```sh
npm install
npm run dev        # http://127.0.0.1:5174
npm run build      # -> dist/ (relative paths; works from any folder)
npm run dots       # re-read ../logo.svg -> src/data/lung.json (212 dots + physics wall)
npm run sim-test   # headless check of the poison spread: 8 seeded puffs, damage + length
node tools/shoot.mjs name 1440 900 --fire --at=2,5,12   # screenshots in shots/ (real Chrome)
```

| File | Role |
|---|---|
| `src/sim/LungSim.js` | the poison, no physics engine: toxin per logo dot, spread over the dot neighbour graph (uneven per-run weights, downhill pull, weakening), deaths, `runInstant` |
| `src/scene/Experience.jsx` | Canvas, post (bloom, neutral tone map, vignette, grain), director: GSAP vape + camera shots |
| `src/scene/Lungs.jsx` | tissue membrane (capillary shader + toxin field canvas: veins carry the poison, stain, tar), 212 soft air sacs (one per logo dot: mottled flesh -> bruised bile -> acid flare -> shrivelled oily husk), airway inlay, rail |
| `src/scene/Toxin.jsx` | pooled vapor particles (pour down the windpipe, split, seep toward the poison's edge, fumes off dead tissue) + one green light |
| `src/scene/Airway.jsx` | C-ring windpipe and docking port |
| `src/scene/Vape.jsx` | procedural box mod (no external assets) |
| `src/App.jsx`, `src/story.css` | the page: nav, story column, scroll triggers (fire on #problem, heal across #solution). Colour tokens in `styles.css`: brand red + `--tox` (the poison's green, used sparingly) |
| `src/sections/ProductIntro.jsx` | the mocks reused by the page (menu bar + puff card, pace chart, privacy diagram) |
| `src/config.js` | download links (TODO) |
| `src/smooth.js` | Lenis smooth scroll on the GSAP ticker (ScrollTrigger synced, anchors glide; off for reduced motion) |

Numbers (Intel Arc iGPU, Chrome, 1440x900): 60 fps during the spread; one puff kills 73-92 of 212 patches (another ~45
partly poisoned) in ~9-11 s; `runInstant` ~6 ms.
Rendering stops while the scene is hidden under the product sections. Reduced motion: still end state, no effects.
Download: ~0.5 MB gzipped (3D chunk lazy-loaded; most of it is three.js). Was ~1.7 MB with the Rapier WASM.

## React Bits (src/bits/)

Eight components copied from [React Bits](https://reactbits.dev) (the library is copy-in by design), each with its
licence header: MIT + Commons Clause, so free to use in this site; the components may not be sold or redistributed on
their own. Where they're used:

| Component | Where / why |
|---|---|
| BlurText (edited: `as` prop) | hero headline comes into focus (the theme: noticing) |
| ScrollReveal | the three problem beats sharpen word by word with scroll, each word passing through the poison's green |
| Magnet | every Download button leans gently toward the cursor (ClickSpark + SplitFlapText removed 2026-11-10: too game-like) |
| SpotlightCard | the mid-page and final download cards: a red light follows the cursor |
| GlareHover | a glass glare sweeps over the menu-bar / puff-card mock on hover |
| GradualBlur | progressive blur under the nav as the story scrolls beneath it |
| ShinyText | a slow sheen across the "Beta · Mac and Windows" pill |
| TargetCursor | the cursor: a detection reticle that locks onto anything pressable; on the vape (an invisible box the 3D director keeps on its screen outline) it shows a live "vape 0.94" tag like Alveo's detector. Mouse only; touch keeps the normal cursor |

Cost: +65 KB gzipped on the first chunk (mostly `motion`, used only by BlurText). 60 fps unchanged.
