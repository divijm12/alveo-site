// The windpipe as a machine: a stack of C-shaped machined rings (open at the back, like tracheal cartilage) on two
// spine rails, ending in a flared mouth at the top that the cloud is breathed into. Its LED ring lights while
// the breath goes in (`dock` 0..1, set by the director). As the poison goes down, each ring glows green only once the
// vapor front has reached it (brightest at the front, a dull glow behind), so the pipe lights up top to bottom.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TRACHEA } from "../sim/LungSim.js";
import { store } from "../store.js";
import { PLATE_Z } from "./Lungs.jsx";

export const PORT_Y = TRACHEA.top + 0.02;                     // top of the mouth: where the cloud goes in
const RING_R = 0.19, BOTTOM = 1.74;

const GREEN = new THREE.Color("#a6ff2e");

export default function Airway({ dockRef, simRef }) {
  const led = useRef(), ledMat = useRef();
  const { ringGeo, rings, ringMats, portGeo, collarGeo } = useMemo(() => {
    // C-shaped cartilage band: a rounded rectangular section swept round Y, gap (0.8 rad) at the back
    const sec = [[0.172, -0.036], [0.2, -0.04], [0.214, -0.03], [0.218, 0], [0.214, 0.03], [0.2, 0.04], [0.172, 0.036], [0.168, 0], [0.172, -0.036]];
    const GAP = 0.8;
    const ringGeo = new THREE.LatheGeometry(sec.map(([r, y]) => new THREE.Vector2(r, y)), 56, Math.PI + GAP / 2, Math.PI * 2 - GAP);
    const rings = []; for (let y = BOTTOM; y < PORT_Y - 0.3; y += 0.165) rings.push(y);
    // flared port: lathe profile (r, y) from the throat up to the lip
    const portGeo = new THREE.LatheGeometry([[0.2, -0.3], [0.235, -0.3], [0.25, -0.12], [0.3, 0.02], [0.36, 0.08], [0.37, 0.12], [0.33, 0.13], [0.27, 0.06], [0.215, -0.08], [0.2, -0.3]]
      .map(([r, y]) => new THREE.Vector2(r, y)), 56);
    const collarGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.07, 48, 1, true);
    const ringMats = rings.map(() => new THREE.MeshStandardMaterial({ color: "#2c2c33", metalness: 0.95, roughness: 0.24, side: THREE.DoubleSide, emissive: GREEN, emissiveIntensity: 0 }));
    return { ringGeo, rings, ringMats, portGeo, collarGeo };
  }, []);
  const lit = useMemo(() => new Float32Array(rings.length), [rings]);

  useFrame((state, delta) => {
    const d = dockRef.current?.dock ?? 0;
    const pulse = 0.85 + 0.15 * Math.sin(state.clock.elapsedTime * 6);
    ledMat.current.color.setRGB(0.25 + 3.2 * d * pulse, 0.02 + 0.12 * d, 0.02 + 0.08 * d);
    // green glow, ring by ring, following the vapor front down (sim.vapor.front 0..1 = port .. carina)
    const sim = simRef?.current, { phase, heal } = store.get();
    const on = sim && sim.released >= 0 && (phase === "running" || phase === "done");
    const fy = on ? PORT_Y - 0.2 - sim.vapor.front * (PORT_Y - 0.2 - TRACHEA.carina) : Infinity;
    const keep = phase === "done" ? Math.max(0, 1 - heal * 3) * 0.25 : sim?.finished ? 0.25 : 0.4;   // dull glow behind the front
    const dt = Math.min(delta, 0.05);
    for (let i = 0; i < rings.length; i++) {
      const below = rings[i] - fy;                                 // > 0: the front has passed this ring
      const tgt = !on || below < -0.02 ? 0 : keep + (sim.vapor.front < 1 ? 1.1 * Math.max(0, 1 - below / 0.35) : 0);
      lit[i] += (tgt - lit[i]) * Math.min(1, (tgt > lit[i] ? 5 : 1.5) * dt);
      ringMats[i].emissiveIntensity = lit[i];
    }
  });

  return (
    <group>
      {rings.map((y, i) => (
        <mesh key={i} geometry={ringGeo} position={[0, y, 0]} material={ringMats[i]} />
      ))}
      {/* spine rails behind the rings, down to the chassis */}
      {[-0.11, 0.11].map(x => (
        <mesh key={x} position={[x, (BOTTOM + PORT_Y) / 2 - 0.15, -RING_R + 0.02]}>
          <cylinderGeometry args={[0.018, 0.018, PORT_Y - BOTTOM + 0.1, 12]} />
          <meshStandardMaterial color="#1b1b20" metalness={0.9} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, (BOTTOM + PORT_Y) / 2 - 0.1, (PLATE_Z - 0.2 - RING_R) / 2 + 0.02]}>
        <boxGeometry args={[0.07, PORT_Y - BOTTOM, Math.abs(PLATE_Z) - RING_R + 0.05]} />
        <meshStandardMaterial color="#121216" metalness={0.85} roughness={0.4} />
      </mesh>
      {/* the mouth */}
      <group position={[0, PORT_Y - 0.1, 0]}>
        <mesh geometry={portGeo}><meshStandardMaterial color="#2a2a31" metalness={0.95} roughness={0.22} side={THREE.DoubleSide} /></mesh>
        <mesh geometry={collarGeo} position={[0, -0.2, 0]}><meshStandardMaterial color="#141418" metalness={0.9} roughness={0.4} side={THREE.DoubleSide} /></mesh>
        <mesh ref={led} position={[0, 0.125, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.35, 0.008, 8, 64]} />
          <meshBasicMaterial ref={ledMat} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
