// Says what you're looking at once the breath goes in: "Vape aerosol" on the windpipe, "Your lungs" on the lungs.
// Projects the two 3D anchors onto the page every frame for the DOM labels (src/Labels.jsx).
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PORT_Y } from "./Airway.jsx";

const ANCHORS = {
  // both on the right (the story column is on the left): the windpipe high up, then the right lung's top edge
  pipe: new THREE.Vector3(0.22, PORT_Y - 0.55, 0.12),
  lungs: new THREE.Vector3(1.0, 2.94, 0.12),
};

export default function Callouts() {
  const els = useRef([]), v = useRef(new THREE.Vector3());
  useEffect(() => { els.current = [...document.querySelectorAll("[data-callout]")]; }, []);
  useFrame((state) => {
    const W = state.size.width, H = state.size.height;
    for (const el of els.current) {
      const a = ANCHORS[el.dataset.callout]; if (!a) continue;
      v.current.copy(a).project(state.camera);
      el.style.transform = `translate3d(${((v.current.x + 1) / 2 * W).toFixed(1)}px, ${((1 - v.current.y) / 2 * H).toFixed(1)}px, 0)`;
    }
  });
  return null;
}
