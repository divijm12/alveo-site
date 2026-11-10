// Smooth scrolling (Lenis), driven by GSAP's ticker so ScrollTrigger, the 3D stage and the page move on one clock.
// Anchor links (#problem, #download, ...) glide too. Lenis turns itself off for prefers-reduced-motion.
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
export const lenis = new Lenis({
  lerp: 0.085,                          // a little heavier than default: matches the slow, cinematic feel
  wheelMultiplier: 0.95,
  anchors: { duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4) },
  stopInertiaOnNavigate: true,
});
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add(time => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
export const scrollToId = id => lenis.scrollTo(`#${id}`, { duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4) });
