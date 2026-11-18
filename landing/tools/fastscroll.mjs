// Fast-scroll check: hard flicks at fixed times; logs where the page is and what the story is doing.
// Expect: every flick moves the page (never stuck); the candy screen gets ~1.5 s; the breath, the poison and the
// punchline all play out even when the page is far ahead; the lungs heal only after that.
// node tools/fastscroll.mjs   (dev server on 5174). Screenshots: shots/fast-*.png
import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on("pageerror", e => console.log("pageerror:", e.message));
await p.goto("http://127.0.0.1:5174/", { waitUntil: "networkidle" });
await p.waitForFunction(() => window.__story?.store.get().phase === "idle", null, { timeout: 30000 });
await p.mouse.move(720, 450);
const t0 = Date.now();
const get = () => p.evaluate(() => { const { store, lenis } = window.__story, g = store.get();
  return { y: Math.round(lenis.scroll), s: `phase ${g.phase} ch ${g.chapter} destroyed ${g.destroyed} heal ${g.heal.toFixed(2)} words ${document.querySelector(".stage-words p.on")?.textContent || "-"}` }; });
const log = async tag => { const g = await get(); console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s ${tag.padEnd(10)} y ${String(g.y).padStart(4)}  ${g.s}`); return g.y; };
const flick = async (dy, n = 30) => { const y0 = (await get()).y; for (let i = 0; i < n; i++) { await p.mouse.wheel(0, dy); await p.waitForTimeout(12); }
  await p.waitForTimeout(250); const y1 = (await get()).y; const edge = await p.evaluate(dy => { const l = window.__story.lenis; return dy > 0 ? l.scroll >= l.limit - 2 : l.scroll <= 2; }, dy);
  console.log(`       flick ${dy > 0 ? "down" : "up"}: page moved ${y1 - y0} px${y1 === y0 && !edge ? "  <-- STUCK" : y1 === y0 ? " (already at the end)" : ""}`); };
const watch = async (secs, tag, shots = 0) => { const end = Date.now() + secs * 1000; let k = 0;
  while (Date.now() < end) { await log(tag); if (shots && k % shots === 0) await p.screenshot({ path: `shots/fast-${tag}-${k}.png` }); k++; await p.waitForTimeout(600); } };
await log("start");
await flick(150); await watch(1.2, "candy", 2);
await flick(150); await watch(1.5, "wall");
await flick(150); await watch(1.5, "breath");
await flick(150, 60); await watch(12, "ahead", 4);
await flick(-150, 60); await watch(2, "back-up");
await flick(-150, 60); await watch(3, "top");
await b.close();
