// Dev stage for the vape alone: ?view=vape [&fire=1] [&rot=0] [&angle=0.6] [&tilt=0.3] [&screen=PUFF] [&hover=1]
// [&cx=..&cy=..&cz=..] moves the camera (still looking down -Z) for close-ups.
import { useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import Studio from "../scene/Studio.jsx";
import Vape from "../scene/Vape.jsx";

const q = new URLSearchParams(location.search);
const FIRE = parseFloat(q.get("fire") ?? "0") || 0;
const HOVER = parseFloat(q.get("hover") ?? "0") || 0;
const ROTATE = q.get("rot") !== "0" && !q.has("angle");
const ANGLE = parseFloat(q.get("angle") ?? "0") || 0;
const SCREEN = q.get("screen");
const TILT = parseFloat(q.get("tilt") ?? "0") || 0;
const CAM = [parseFloat(q.get("cx") ?? "0") || 0, parseFloat(q.get("cy") ?? "0") || 0, parseFloat(q.get("cz") ?? "7") || 7];

function Spinner() {
  const vape = useRef();
  useEffect(() => {
    const v = vape.current;
    v.setFire(FIRE); v.setHover(HOVER);
    if (SCREEN) v.setScreen(SCREEN);
    v.group.rotation.set(TILT, ANGLE, 0);
    window.__vape = v; // for poking at it from the console
  }, []);
  useFrame((_, dt) => { if (ROTATE) vape.current.group.rotation.y += dt * 0.35; });
  return <Vape ref={vape} />;
}

export default function VapeStage() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#030304" }}>
      <Canvas dpr={[1, 2]} gl={{ antialias: true }} camera={{ fov: 35, position: CAM }}>
        <Studio />
        <Spinner />
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur luminanceThreshold={1} intensity={0.8} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
