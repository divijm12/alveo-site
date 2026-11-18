// Plain labels on the 3D, so nobody has to guess what the smoke and the organ are: "Vape aerosol" on the windpipe
// while the puff goes down, then "Your lungs" once it has reached them. Positioned by scene/Callouts.jsx.
import { useStore } from "./store.js";

export default function Labels() {
  const early = useStore(s => s.chapter === "intro" || s.chapter === "problem");
  const pipe = useStore(s => s.phase === "inhaling" || s.phase === "running");
  const lungs = useStore(s => s.phase === "running" || s.phase === "done");
  return (
    <div className="callouts" aria-hidden="true">
      <div className={"callout callout--pipe" + (early && pipe ? " is-on" : "")} data-callout="pipe">
        <i className="callout-dot" /><i className="callout-line" />
        <span className="callout-tag"><b>Vape aerosol</b><em>one puff, going down the windpipe</em></span>
      </div>
      <div className={"callout callout--lungs" + (early && lungs ? " is-on" : "")} data-callout="lungs">
        <i className="callout-dot" /><i className="callout-line" />
        <span className="callout-tag"><b>Your lungs</b><em>where the vape's chemicals settle</em></span>
      </div>
    </div>
  );
}
