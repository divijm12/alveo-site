// Frames of the story as you scroll through it (the breath + the poison follow the scroll, Experience.jsx):
// node tools/breath.mjs <name> [px per frame] [count] [w] [h] [from: screens scrolled first, default 1 = the candy screen] [settle ms]
//   -> shots/<name>-b00.png ... (each frame: scroll px, let it settle, shoot). The page clock is faked, so it's exact.
import { chromium } from "playwright";
const [name = "breath", px = "120", count = "16", w = "1440", h = "900", from = "1", settle = "600"] = process.argv.slice(2);
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
p.on("pageerror", e => errs.push("pageerror: " + e.message));
await p.goto("http://127.0.0.1:5174/", { waitUntil: "networkidle" });
await p.waitForFunction(() => window.__story?.store.get().stageReady, null, { timeout: 30000 });
await p.evaluate(y => window.__story.lenis.scrollTo(y * innerHeight, { immediate: true }), +from); await p.waitForTimeout(2500);
await p.clock.install();
await p.mouse.move(+w * 0.15, +h * 0.5);
for (let i = 0; i < +count; i++) {
  if (i) { await p.mouse.wheel(0, +px); await p.clock.runFor(+settle); }
  const s = await p.evaluate(() => { const { store, live } = window.__story, g = store.get(); return `y ${Math.round(scrollY)} story ${live.story.toFixed(2)} ${g.phase} destroyed ${g.destroyed} heal ${g.heal.toFixed(2)}`; });
  console.log(String(i).padStart(2, "0"), s);
  await p.screenshot({ path: `shots/${name}-b${String(i).padStart(2, "0")}.png` });
}
console.log(errs.length ? errs.join("\n") : "no page errors");
await b.close();
