// Fast-scroll check: flicks the wheel hard at fixed times and logs where the page and story are.
// node tools/fastscroll.mjs   (dev server on 5174). Screenshots: shots/fast-*.png
import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on("pageerror", e => console.log("pageerror:", e.message));
await p.goto("http://127.0.0.1:5174/", { waitUntil: "networkidle" });
await p.waitForFunction(() => window.__story?.store.get().phase === "idle", null, { timeout: 30000 });
await p.mouse.move(720, 450);
const t0 = Date.now();
const state = async tag => {
  const s = await p.evaluate(() => { const { store, lenis, stations } = window.__story, st = stations(), g = store.get();
    return `y ${Math.round(lenis.scroll)} (C ${Math.round(st.C)} P ${Math.round(st.P)} G ${Math.round(st.G)}) phase ${g.phase} ch ${g.chapter} destroyed ${g.destroyed} heal ${g.heal.toFixed(2)}`; });
  console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s ${tag.padEnd(14)} ${s}`);
};
const flick = async (n = 40, dy = 120) => { for (let i = 0; i < n; i++) { await p.mouse.wheel(0, dy); await p.waitForTimeout(12); } };
const watch = async (secs, tag, shotEvery = 0) => { const end = Date.now() + secs * 1000; let k = 0;
  while (Date.now() < end) { await state(tag); if (shotEvery && k++ % shotEvery === 0) await p.screenshot({ path: `shots/fast-${tag}-${k}.png` }); await p.waitForTimeout(500); } };
await state("start");
await flick(); await watch(3, "flick1", 3);              // landing -> candy only
await flick(); await watch(2, "flick2-breath");          // the breath starts, page held
await flick(); await watch(5, "during", 4);              // flicking during the breath: ignored
await flick(80); await watch(6, "push-gate", 4);         // hard push towards the solution: held at the gate, poison hurries
await flick(80); await watch(4, "after-gate", 3);        // into the solution: stops at its top, heal eases
await flick(80); await watch(3, "to-points", 3);         // next gesture: stops at the solution's points
await flick(80); await watch(3, "to-download", 3);       // next: the download
await flick(40, -150); await watch(3, "up0");            // fast up from the bottom: stops at the solution
await flick(40, -150); await watch(3, "up1");            // next: stops at the problem
await flick(40, -150); await watch(4, "up2", 3);         // next gesture: back to the candy screen, cloud breathes out
await flick(40, -150); await watch(3, "up3");            // next: the landing
await b.close();
