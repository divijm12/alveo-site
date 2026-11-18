// The Download section's healthy lungs: shots across one breath (page clock faked) + the solution section.
// node tools/download.mjs [w] [h]   -> shots/dl-sol.png, shots/dl-b0..5.png
import { chromium } from "playwright";
const [w = "1440", h = "900"] = process.argv.slice(2);
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = []; p.on("pageerror", e => errs.push("pageerror: " + e.message));
await p.goto("http://127.0.0.1:5174/", { waitUntil: "networkidle" });
await p.waitForFunction(() => window.__story?.store.get().stageReady, null, { timeout: 30000 });
const go = async y => { await p.evaluate(y => window.__story.lenis.scrollTo(y, { immediate: true }), y); await p.waitForTimeout(2500); };
const top = id => p.evaluate(id => document.getElementById(id).getBoundingClientRect().top + scrollY, id);
await go(await top("solution") + +h * 0.2); await p.screenshot({ path: "shots/dl-sol.png" });
await go(await top("solution") + 900);              await p.screenshot({ path: "shots/dl-sol2.png" });
await go(await top("download"));                     await p.waitForTimeout(2000);
await p.clock.install();
for (let i = 0; i < 6; i++) { if (i) await p.clock.runFor(770); await p.screenshot({ path: `shots/dl-b${i}.png` }); }
console.log(errs.length ? errs.join("\n") : "no page errors");
await b.close();
