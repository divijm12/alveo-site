// Section heights in screens: node tools/sections.mjs [w] [h]
import { chromium } from "playwright";
const [w = "1440", h = "900"] = process.argv.slice(2);
const b = await chromium.launch({ channel: "chrome", headless: true });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
await p.goto("http://127.0.0.1:5174/", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
console.log(await p.evaluate(() => {
  const H = innerHeight, out = [...document.querySelectorAll("main > section")].map(s => `${s.id}: ${(s.offsetHeight / H).toFixed(2)}`);
  return out.join("\n") + `\ntotal: ${(document.documentElement.scrollHeight / H).toFixed(2)} screens`;
}));
await b.close();
