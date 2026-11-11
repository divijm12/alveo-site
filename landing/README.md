# Alveo 3D landing (draft, desktop)

One scroll story beside a live 3D stage (fixed, framed on the right; the story is a column on the left). The
Download button is in the nav the whole time.

0. **Landing** (`src/Landing.jsx`, RJ 2026-11-10): the big ALVEO. wordmark, "See what one vape puff does." and a large
   breathing "Scroll to breathe in" pill. Scrolling it away fades the wordmark up into a vape cloud that rolls in
   with the scroll (`live.open` in store.js, eased in the scene).
   **Candy screen**: "One vape puff, up close" over "Tastes like candy. Breathes like lead." (candy in the brand red),
   in dense 3D vape smoke
   (the same kind as the getalveo.app beta: soft noise sprites rising and curling, all one grey (no red patches,
   RJ 2026-11-10), pushed aside by the cursor; thick, in depth, a bit thinner over the words), with chemical labels hanging in it
   (lead, formaldehyde, nicotine, nickel, acrolein, diacetyl, chromium, benzene, propylene glycol: all measured in
   e-cigarette aerosol in published studies, sources in `src/chems.js`; a note under the headline says amounts vary).
   **The next scroll is the breath**, like drawing air through pursed lips: the words come apart, the smoke speeds
   up toward the windpipe's mouth, stretches along the flow and closes into a narrow funnel, thinning right out
   before it gets there; only faint grey strands go into the mouth (the green starts inside). The chemicals ride the
   same vortex, the camera follows, and the poison starts. Labels on the 3D say what it is: "Vape aerosol" on the
   windpipe while the puff goes down, then "Your lungs" (`src/Labels.jsx` + `scene/Callouts.jsx`); the counter reads
   "marks from one vape puff". When it has done its work, **five markers appear on
   the dead tissue** (nicotine, formaldehyde, acrolein, lead, nickel): hover / tap / focus one for its IUPAC name
   and one line (`FINDINGS` in `src/chems.js`). Back at the very top,
   the cloud breathes back out and the lungs are clean again (that's also what "Replay" does).
1. **01 The problem**: toxic vapor pours down the airway, splits at the bronchi and poisons the lungs: it creeps
   through the tissue in fingers, glowing acid green at its edge, and the air sacs it reaches bruise, flare and
   shrivel into oily husks, leaving tar. Two short beats tell the problem meanwhile (whole page ~4.4 screens: only problem, solution, CTA, RJ 2026-11-10). Ends on "Every puff leaves a mark."
2. **02 How it helps**: what Alveo is ("Notice every puff. Then have fewer."), the menu bar + puff card mock, three points
   (counts every puff, steps your limit down, nothing leaves your computer).
   The poison washes out patch by patch as you read (if you got here early, the puff fast-forwards first).
3. **03 Download**: both platforms, beside healthy, breathing lungs.

**Fast scrolling skips nothing** (`src/story.js`, RJ 2026-11-11): the opening is stepped (one gesture = landing ->
candy screen -> the breath, input held while each plays; the page glides to the problem as the camera reaches the
lungs). The reader can't leave the problem until the poison is done + 1.8 s (pushing speeds the poison up, x2.4,
instead of skipping it). One gesture can't cross a section: stops at the solution's top, its three points and the
download, both ways. A fast flick's trailing wheel events are swallowed until they pause (220 ms). The lungs heal
at a limited speed (store.heal eases toward the scroll, >= ~2.4 s). Nav links / Home / End jump freely (the story
catches up). `node tools/fastscroll.mjs` flicks hard through the page and logs each stop.

Download URLs live in `src/config.js` (empty for now: buttons then jump to the Download section).

Separate from the live coming-soon page (`../index.html`), which is unchanged.

```sh
npm install
npm run dev        # http://127.0.0.1:5174
npm run build      # -> dist/ (relative paths; works from any folder)
npm run dots       # re-read ../logo.svg -> src/data/lung.json (212 dots + physics wall)
npm run sim-test   # headless check of the poison spread: 8 seeded puffs, damage + length
node tools/shoot.mjs name 1440 900 --fire --at=2,5,12   # screenshots in shots/ (real Chrome); --fire = scroll a little (the breath)
node tools/sections.mjs                                 # height of each section, in screens
node tools/fastscroll.mjs                               # hard flicks down and up: where the page stops
node tools/breath.mjs name 0.3 12                       # the breath frame by frame (page clock faked: exact times)
python tools/sheet.py out.png a.png b.png ...           # contact sheet of screenshots
```

| File | Role |
|---|---|
| `src/sim/LungSim.js` | the poison, no physics engine: toxin per logo dot, spread over the dot neighbour graph (uneven per-run weights, downhill pull, weakening), deaths, `runInstant` |
| `src/scene/Experience.jsx` | Canvas, post (bloom, neutral tone map, vignette, grain), director: GSAP breath (cloud pull) + camera shots (centred sky -> lungs on the right) |
| `src/scene/Lungs.jsx` | tissue membrane (capillary shader + toxin field canvas: veins carry the poison, stain, tar), 212 soft air sacs (one per logo dot: mottled flesh -> bruised bile -> acid flare -> shrivelled oily husk), airway inlay, rail |
| `src/scene/Toxin.jsx` | pooled vapor particles (pour down the windpipe, split, seep toward the poison's edge, fumes off dead tissue) + one green light |
| `src/scene/Airway.jsx` | C-ring windpipe and docking port |
| `src/scene/Smoke.jsx` | the opening smoke: ~130 camera-facing smoke sprites sorted back to front, rising + curling, cursor push with spring-back (as on the beta), the inhale vortex (`I.pull`); projects the chemical labels' 3D anchors onto the page every frame |
| `src/scene/Streams.jsx` | the breath: ~64 gas strands (fixed sink-flow curves, a travelling window driven by one uniform), screen-space ribbons a few px wide, thinning to a hairline at the mouth |
| `src/scene/Markers.jsx`, `src/Findings.jsx` | after the puff: picks 5 dead patches far apart, projects them every frame for the DOM markers; the markers + cards (hover, tap, keyboard; cards open toward free space) |
| `src/Intro.jsx`, `src/chems.js` | the opening overlay: headline (per-letter dissolve on the breath), mist wisps, chemical labels, honesty note, scroll cue; the chemical list + sources |
| `src/cloudTex.js`, `src/cloudWorker.js` | the smoke-sprite atlas (3 plumes + 1 long wisp: domain-warped fbm under a soft round falloff, ridged filaments, no lighting), built in a Web Worker (never blocks the page) |
| `src/App.jsx`, `src/story.css` | the page: nav, story column, scroll triggers (fire on #problem, heal across #solution). Colour tokens in `styles.css`: brand red + `--tox` (the poison's green, used sparingly) |
| `src/sections/ProductIntro.jsx` | the mocks reused by the page (menu bar + puff card, pace chart, privacy diagram) |
| `src/config.js` | download links (TODO) |
| `src/smooth.js` | Lenis smooth scroll on the GSAP ticker (ScrollTrigger synced, anchors glide; off for reduced motion) |

Numbers (Intel Arc iGPU, Chrome, 1440x900): 60 fps on the cloud opening (also 1920x1080) and during the spread; one puff kills 73-92 of 212 patches (another ~45
partly poisoned) in ~9-11 s; `runInstant` ~6 ms.
Rendering stops while the scene is hidden under the product sections. Reduced motion: still end state, no effects.
Download: ~0.5 MB gzipped (3D chunk lazy-loaded; most of it is three.js). Was ~1.7 MB with the Rapier WASM.

## React Bits (src/bits/)

Six components copied from [React Bits](https://reactbits.dev) (the library is copy-in by design), each with its
licence header: MIT + Commons Clause, so free to use in this site; the components may not be sold or redistributed on
their own. Where they're used:

| Component | Where / why |
|---|---|
| ScrollReveal | the three problem beats sharpen word by word with scroll, each word passing through the poison's green |
| Magnet | every Download button leans gently toward the cursor (ClickSpark + SplitFlapText removed 2026-11-10: too game-like) |
| SpotlightCard | the final download card: a red light follows the cursor |
| GlareHover | a glass glare sweeps over the menu-bar / puff-card mock on hover |
| GradualBlur | progressive blur under the nav as the story scrolls beneath it |
| TargetCursor | the cursor: a detection reticle (Alveo is a detector) that locks onto anything pressable. Mouse only; touch keeps the normal cursor |

60 fps unchanged. (BlurText + ShinyText and the `motion` package went with the hero, 2026-11-10.)

Gotchas met building the breath: a NaN anywhere (e.g. `pow` of a tiny negative number at a ribbon edge) turns the
whole frame black through the bloom pass, so clamp before `pow`; a three.js texture can't change size after its
first upload (swap in a new one); screen-space ribbons need `side: DoubleSide`.
