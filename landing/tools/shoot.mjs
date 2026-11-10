// Visual check: node tools/shoot.mjs <name> [w] [h] [--fire] [--at=0.5,2,4,8] [--scroll=y1,y2] [--url=...]
// Screenshots into shots/, prints console errors and a frame-time sample.
import { chromium } from "playwright";
const [name = "shot", w = "1440", h = "900", ...rest] = process.argv.slice(2);
const flag = k => rest.find(a => a.startsWith(`--${k}`));
const val = k => flag(k)?.split("=")[1];
const url = val("url") || "http://127.0.0.1:5174/";
const at = (val("at") || "0").split(",").map(Number);
const mobile = +w < 700;
const b = await chromium.launch({ channel: "chrome", headless: !flag("headed"), args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
const errs = [];
p.on("console", m => { if (["error", "warning"].includes(m.type())) errs.push(`${m.type()}: ${m.text()}`.slice(0, 300)); });
p.on("pageerror", e => errs.push("pageerror: " + e.message));
await p.goto(url, { waitUntil: "networkidle" });
await p.waitForTimeout(+(val("wait") || 2500));
if (flag("fire")) await p.click(".puff", { force: true, timeout: 5000 }).catch(e => errs.push("click failed: " + e.message.slice(0, 80)));
let t0 = 0;
for (const t of at) {
  await p.waitForTimeout(Math.max(0, (t - t0) * 1000)); t0 = t;
  await p.screenshot({ path: `shots/${name}-${String(t).replace(".", "_")}.png` });
}
for (const [i, y] of (val("scroll") || "").split(",").filter(Boolean).entries()) {
  await p.evaluate(y => window.scrollTo(0, y * innerHeight), +y); await p.waitForTimeout(1200);
  await p.screenshot({ path: `shots/${name}-scroll${i}.png` });
}
const ft = await p.evaluate(() => new Promise(r => { const a = []; let l = performance.now(); let n = 0;
  const f = t => { a.push(t - l); l = t; if (++n < 90) requestAnimationFrame(f); else r(a); }; requestAnimationFrame(f); }));
ft.sort((a, b) => a - b);
console.log(`frame ms p50 ${ft[45].toFixed(1)} p90 ${ft[81].toFixed(1)}`);
const gpu = await p.evaluate(() => { const c = document.createElement("canvas").getContext("webgl2"); const d = c && c.getExtension("WEBGL_debug_renderer_info"); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : "?"; });
console.log("gpu:", gpu);
console.log(errs.length ? errs.join("\n") : "no console errors");
await b.close();
