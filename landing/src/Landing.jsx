// The first screen: the wordmark, one line, and a big "Scroll to breathe in". Scrolling it away rolls the vape
// cloud in (App drives live.open and fades this out with the scroll), and the candy / lead screen (Intro) follows.
import { useStore } from "./store.js";
import { step } from "./story.js";

export default function Landing() {
  const here = useStore(s => s.chapter === "landing");
  return (
    <div className={"landing" + (here ? "" : " is-away")} aria-hidden="true">
      <div className="landing-in">
        <p className="landing-mark">ALVEO<span>.</span></p>
        <p className="landing-sub">See what one vape puff does.</p>
      </div>
      <a className="breathe-cue landing-cue cursor-target" tabIndex={-1} href="#intro" onClick={e => { e.preventDefault(); step(1); }}>
        <span>Scroll to breathe in</span><i />
      </a>
    </div>
  );
}
