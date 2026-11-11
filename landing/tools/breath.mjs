// Frames of the breath at exact times (the page clock is faked, so screenshot time doesn't skew them):
// node tools/breath.mjs <name> [step s] [count] [w] [h] [from: screens scrolled first, default 1 = the candy screen]   -> shots/<name>-b00.png ... (t = 0, step, 2*step, ...)
import { chromium } from "playwright";
const [name = "breath", step = "0.4", count = "14", w = "1440", h = "900", from = "1"] = process.argv.slice(2);
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
p.on("pageerror", e => errs.push("pageerror: " + e.message));
await p.goto("http://127.0.0.1:5174/", { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
await p.evaluate(y => window.scrollTo(0, y * innerHeight), +from); await p.waitForTimeout(2500);
// start the breath on the real clock (the candy screen's 1.5 s soft wall, story.js, uses performance.now, which
// the fake clock would reset), then freeze time the moment it starts
await p.mouse.wheel(0, 200); await p.waitForTimeout(1800);
await p.mouse.wheel(0, 300);
await p.waitForFunction(() => window.__story?.store.get().phase !== "idle", null, { timeout: 8000, polling: 16 });
await p.clock.install();
for (let i = 0; i < +count; i++) {
  if (i) await p.clock.runFor(Math.round(+step * 1000));
  await p.screenshot({ path: `shots/${name}-b${String(i).padStart(2, "0")}.png` });
}
console.log(errs.length ? errs.join("\n") : "no page errors");
await b.close();
