// Frames of the breath at exact times (the page clock is faked, so screenshot time doesn't skew them):
// node tools/breath.mjs <name> [step s] [count] [w] [h]   -> shots/<name>-b00.png ... (t = 0, step, 2*step, ...)
import { chromium } from "playwright";
const [name = "breath", step = "0.4", count = "14", w = "1440", h = "900"] = process.argv.slice(2);
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
p.on("pageerror", e => errs.push("pageerror: " + e.message));
await p.goto("http://127.0.0.1:5174/", { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
await p.clock.install();
await p.mouse.wheel(0, 140);                                   // the first scroll breathes the cloud in
for (let i = 0; i < +count; i++) {
  if (i) await p.clock.runFor(Math.round(+step * 1000));
  await p.screenshot({ path: `shots/${name}-b${String(i).padStart(2, "0")}.png` });
}
console.log(errs.length ? errs.join("\n") : "no page errors");
await b.close();
