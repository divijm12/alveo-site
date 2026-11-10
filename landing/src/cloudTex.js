// Procedural cloud puffs, shared by the 3D clouds and the DOM wisps over the headline: a 2x2 atlas (4 variants)
// built once in a Web Worker (cloudWorker.js, ~150 ms that never block the page). RGBA, row 0 = the top of each puff.
let pixels = null, url = null;

/** Promise of { data: Uint8ClampedArray (RGBA), size } */
export const cloudPixels = () => (pixels ||= new Promise((resolve, reject) => {
  const w = new Worker(new URL("./cloudWorker.js", import.meta.url), { type: "module" });
  w.onmessage = e => { resolve(e.data); w.terminate(); };
  w.onerror = e => { reject(e); w.terminate(); };
}));

/** Promise of the atlas as a PNG data URL, for CSS backgrounds. */
export const cloudURL = () => (url ||= cloudPixels().then(({ data, size }) => {
  const c = document.createElement("canvas"); c.width = c.height = size;
  c.getContext("2d").putImageData(new ImageData(data, size, size), 0, 0);
  return c.toDataURL("image/png");
}));
