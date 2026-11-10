// Shared studio lighting: procedural environment (Lightformers, no HDR download) for real reflections on the
// matte-black vape and the machined lung parts, plus a cold key light and red thermal rim lights.
import { Environment, Lightformer } from "@react-three/drei";

export default function Studio({ envIntensity = 1 }) {
  return (
    <>
      <color attach="background" args={["#030304"]} />
      <fog attach="fog" args={["#030304", 14, 34]} />
      <ambientLight intensity={0.04} />
      {/* soft cold key from top-left-front, red rims from behind both sides */}
      <directionalLight position={[-4, 6, 6]} intensity={1.1} color="#d9dde6" />
      <pointLight position={[5, 2, -3]} intensity={30} distance={14} decay={2} color="#ff2a1f" />
      <pointLight position={[-5, -1, -2]} intensity={18} distance={12} decay={2} color="#c40c1c" />
      <Environment resolution={256} environmentIntensity={envIntensity}>
        <color attach="background" args={["#000"]} />
        {/* long softbox strips: these are what the anodised edges reflect */}
        <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 5, -2]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 1.2, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#e8ecf5" position={[-6, 1, 1]} rotation={[0, Math.PI / 2, 0]} scale={[6, 1.5, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#ffffff" position={[0, 0, 7]} scale={[8, 0.6, 1]} />
        {/* red thermal kickers */}
        <Lightformer form="rect" intensity={3.5} color="#ff2d2d" position={[6, -1, -1]} rotation={[0, -Math.PI / 2, 0]} scale={[5, 2, 1]} />
        <Lightformer form="ring" intensity={2} color="#ff3a33" position={[-3, -4, -3]} scale={2.5} target={[0, 0, 0]} />
      </Environment>
    </>
  );
}
