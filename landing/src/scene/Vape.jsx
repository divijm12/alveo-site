// Procedural box-mod vape (no models, no image files). Matte black anodised aluminium body between
// two plates, 510 tank (base ring, smoked glass with a coil inside, wide top ring, delrin drip tip),
// brushed-steel fire button, two flush front buttons, black glass OLED, two side buttons.
//
// Pose: lies HORIZONTAL. Long axis +X (tank + drip tip at the +X end), front face (OLED) faces +Z.
// Local origin = centre of the device's bounding box: x -1.80..1.80, y -0.625..0.625, z -0.31..0.31.
// Drip-tip opening (mouthpiece) at local (1.80, 0.29, 0).
//
// API (ref): { group, setFire(0..1), setScreen(text), setHover(0..1), mouthpiece }
//   mouthpiece: Object3D at the drip-tip opening. Its local +Z axis points OUT of the mouthpiece
//   (along the device's +X), so mouthpiece.getWorldDirection(v) gives the outward direction in world space.
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ---------- dimensions ----------
const BODY_H = 1.19, BODY_D = 0.57, BODY_R = 0.095;          // main shell cross-section (Y x Z)
const PLATE_H = 1.25, PLATE_D = 0.62, PLATE_R = 0.1, PLATE_T = 0.105;
const X_MIN = -1.8, X_TOP = 0.45;                              // bottom plate start, top plate face (tank sits here)
const GAP = 0.01;                                              // seam under each plate
const BODY_X0 = X_MIN + PLATE_T + GAP, BODY_X1 = X_TOP - PLATE_T - GAP;
const FRONT_Z = BODY_D / 2;
const TANK_Y = 0.29;                                           // tank axis (offset to the upper side, like the reference)
const FIRE_Y = -0.25;
const ROW_Y = -0.25;                                           // OLED + front buttons row
const OLED_X0 = -1.2, OLED_X1 = -0.09, OLED_H = 0.48;
const TIP_LEN = 1.35;                                          // tank + drip tip length (x 0.45 -> 1.80)

// ---------- geometry helpers ----------
function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

// Extrude along local Z, centred, smooth-shaded (merge + area-weighted normals so bevels read as real fillets).
function smoothExtrude(shape, depth, bevel, bevelSegments = 6, curveSegments = 10, keepUV = false) {
  let g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments, curveSegments,
  });
  g.translate(0, 0, -depth / 2);
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  g = mergeVertices(g, 1e-5);
  g.computeVertexNormals();
  if (keepUV) {
    // planar UVs from the shape bounds (used by the OLED canvas)
    g.computeBoundingBox();
    const { min, max } = g.boundingBox, p = g.attributes.position, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      uv[i * 2] = (p.getX(i) - min.x) / (max.x - min.x);
      uv[i * 2 + 1] = (p.getY(i) - min.y) / (max.y - min.y);
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  }
  return g;
}

// Lathe profile helper: points [r, h, keepSharp?]. Every corner gets two extra points eps away so the
// lathe normals form a micro-fillet (edges catch a thin highlight instead of smearing across faces).
function soften(pts, eps = 0.004) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const [r, h, sharp] = pts[i];
    if (i === 0 || i === pts.length - 1 || sharp) { out.push(new THREE.Vector2(r, h)); continue; }
    const a = pts[i - 1], b = pts[i + 1];
    const ix = r - a[0], iy = h - a[1], il = Math.hypot(ix, iy);
    const ox = b[0] - r, oy = b[1] - h, ol = Math.hypot(ox, oy);
    if ((ix * ox + iy * oy) / (il * ol) > 0.999) { out.push(new THREE.Vector2(r, h)); continue; }
    const ea = Math.min(eps, il * 0.3), eb = Math.min(eps, ol * 0.3);
    out.push(new THREE.Vector2(r - (ix / il) * ea, h - (iy / il) * ea));
    out.push(new THREE.Vector2(r, h));
    out.push(new THREE.Vector2(r + (ox / ol) * eb, h + (oy / ol) * eb));
  }
  return out;
}

// V-grooves cut into a cylinder of radius r, from h0 upward. Marked sharp (machined look).
function grooves(r, h0, count, pitch, depth, width) {
  const p = [];
  for (let k = 0; k < count; k++) {
    const h = h0 + k * pitch;
    p.push([r, h, true], [r - depth, h + width / 2, true], [r, h + width, true]);
  }
  return p;
}

const lathe = (pts, segs = 96) => new THREE.LatheGeometry(soften(pts), segs);

// Helix coil (axis along local X of the tank frame) with two legs down into the deck posts.
function coilGeometry() {
  const pts = [], turns = 7, L = 0.2, R = 0.042, h0 = 0.2, deck = 0.07;
  pts.push(new THREE.Vector3(-L / 2 - 0.035, deck, 0), new THREE.Vector3(-L / 2 - 0.02, h0 - R * 0.6, 0));
  const n = 220;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * turns * Math.PI * 2 - Math.PI / 2;
    pts.push(new THREE.Vector3(-L / 2 + t * L, h0 + Math.sin(a) * R, Math.cos(a) * R));
  }
  pts.push(new THREE.Vector3(L / 2 + 0.02, h0 - R * 0.6, 0), new THREE.Vector3(L / 2 + 0.035, deck, 0));
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  return new THREE.TubeGeometry(curve, 360, 0.0085, 6, false);
}

// ---------- OLED canvas ----------
const OLED_W_PX = 1024, OLED_H_PX = Math.round(1024 * OLED_H / (OLED_X1 - OLED_X0) / 8) * 8;
function drawScreen(ctx, text) {
  const w = OLED_W_PX, h = OLED_H_PX;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
  const str = String(text ?? "");
  let size = Math.round(h * 0.56);
  ctx.font = `400 ${size}px "Segoe UI", "SF Pro Display", "Helvetica Neue", Roboto, Arial, sans-serif`;
  const maxW = w * 0.7, mw = ctx.measureText(str).width;
  if (mw > maxW) {
    size = Math.floor(size * maxW / mw);
    ctx.font = `400 ${size}px "Segoe UI", "SF Pro Display", "Helvetica Neue", Roboto, Arial, sans-serif`;
  }
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  // soft phosphor halo, then the crisp glyphs
  ctx.shadowColor = "rgba(255,255,255,0.55)"; ctx.shadowBlur = size * 0.18;
  ctx.fillStyle = "#e9eef2"; ctx.fillText(str, w / 2, h / 2 + size * 0.04);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff"; ctx.fillText(str, w / 2, h / 2 + size * 0.04);
}

export default forwardRef(function Vape(props, ref) {
  const group = useRef(), mouthpiece = useRef(), fireBtn = useRef(), glowLight = useRef();
  const state = useRef({ fire: 0, hover: 0 });

  // ----- geometries (built once) -----
  const geo = useMemo(() => {
    const yz = (g) => { g.rotateY(Math.PI / 2); return g; };            // local z -> X (shape a -> -Z, b -> Y)
    const bodyLen = BODY_X1 - BODY_X0;
    const body = yz(smoothExtrude(roundedRect(BODY_D - 0.012, BODY_H - 0.012, BODY_R - 0.006), bodyLen - 0.012, 0.006, 2, 14));
    const plate = yz(smoothExtrude(roundedRect(PLATE_D - 0.04, PLATE_H - 0.04, PLATE_R - 0.02), PLATE_T - 0.04, 0.02, 5, 14));
    const seam = yz(smoothExtrude(roundedRect(BODY_D - 0.05, BODY_H - 0.05, BODY_R - 0.025), GAP + 0.004, 0, 1, 10));

    // OLED: stadium-ish glass with a rounded rim, and a darker gasket a hair larger around it
    const oledW = OLED_X1 - OLED_X0;
    const oled = smoothExtrude(roundedRect(oledW - 0.03, OLED_H - 0.03, OLED_H / 2 - 0.05), 0.002, 0.015, 5, 16, true);
    const gasketShape = roundedRect(oledW + 0.035, OLED_H + 0.035, OLED_H / 2 - 0.01);
    gasketShape.holes.push(roundedRect(oledW - 0.005, OLED_H - 0.005, OLED_H / 2 - 0.035));
    const gasket = new THREE.ShapeGeometry(gasketShape, 20);

    // flush front buttons (lathe around Y, rotated to face +Z): slightly dished cap with rounded rim
    const btn = lathe([[0.108, -0.02, true], [0.107, 0.0], [0.1, 0.0045], [0.07, 0.003], [0, 0.0015, true]], 64);
    btn.rotateX(Math.PI / 2);
    const btnRing = new THREE.RingGeometry(0.106, 0.124, 64);

    // side buttons (on the -Y face)
    const sideLong = yz(smoothExtrude(roundedRect(0.07, 0.02, 0.009), 0.4, 0.01, 4, 10));
    const sideShort = yz(smoothExtrude(roundedRect(0.07, 0.02, 0.009), 0.19, 0.01, 4, 10));

    // fire button: anodised collar + turned steel cap (lathe around Y, the group is rotated to +X)
    const fireCollar = lathe([[0.15, -0.01, true], [0.212, -0.01], [0.212, 0.018], [0.196, 0.03], [0.15, 0.03, true]], 80);
    const fireCap = lathe([[0, 0.02, true], [0.176, 0.02, true], [0.176, 0.082], [0.17, 0.11, true], [0.155, 0.128, true],
      [0.13, 0.14, true], [0.09, 0.147, true], [0, 0.15, true]], 80);

    // ----- tank (tank frame: +Y = device +X, from the top-plate face) -----
    const connector = new THREE.CylinderGeometry(0.19, 0.19, 0.03, 64, 1, true);
    connector.translate(0, 0.015, 0);
    const ledRing = new THREE.TorusGeometry(0.2, 0.0055, 8, 96); ledRing.rotateX(Math.PI / 2); ledRing.translate(0, 0.016, 0);
    const baseRing = lathe([
      [0.17, 0.03, true], [0.235, 0.03], [0.25, 0.045],
      ...grooves(0.25, 0.07, 1, 0, 0.006, 0.01),
      [0.25, 0.09, true],
      ...grooves(0.25, 0.12, 5, 0.018, 0.0045, 0.008),
      [0.25, 0.235], [0.238, 0.25], [0.2, 0.25, true],
    ]);
    const glass = new THREE.CylinderGeometry(0.207, 0.207, 0.47, 96, 1, true); glass.translate(0, 0.25 + 0.235, 0);
    const deck = lathe([[0, 0.25, true], [0.19, 0.25, true], [0.19, 0.29], [0.175, 0.3], [0, 0.3, true]], 64);
    const post = new THREE.CylinderGeometry(0.018, 0.022, 0.07, 16); post.translate(0, 0.315, 0);
    const coil = coilGeometry(); coil.translate(0, 0.25, 0);
    const wick = new THREE.CylinderGeometry(0.03, 0.03, 0.34, 16, 1); wick.rotateZ(Math.PI / 2); wick.translate(0, 0.45, 0);
    const topRing = lathe([
      [0.2, 0.72, true], [0.245, 0.72], [0.262, 0.737],
      [0.262, 0.77, true],
      ...grooves(0.262, 0.785, 9, 0.016, 0.004, 0.008),
      [0.262, 0.96, true],
      ...grooves(0.262, 0.975, 1, 0, 0.007, 0.012),
      [0.262, 1.02], [0.248, 1.035], [0.238, 1.035], [0.238, 1.075], [0.226, 1.088], [0.19, 1.088, true],
    ]);
    const tip = lathe([
      [0.19, 1.085, true], [0.188, 1.1, true], [0.163, 1.31], [0.158, 1.326, true], [0.146, 1.341, true], [0.128, 1.349, true],
      [0.092, 1.35, true], [0.08, 1.346, true], [0.074, 1.335, true], [0.072, 1.22, true], [0, 1.22, true],
    ], 80);
    return { body, plate, seam, oled, gasket, btn, btnRing, sideLong, sideShort, fireCollar, fireCap,
      connector, ledRing, baseRing, glass, deck, post, coil, wick, topRing, tip };
  }, []);

  // ----- OLED canvas texture -----
  const screen = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = OLED_W_PX; canvas.height = OLED_H_PX;
    const ctx = canvas.getContext("2d");
    drawScreen(ctx, "0.60");
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return { canvas, ctx, tex };
  }, []);

  // ----- materials (created once) -----
  const mat = useMemo(() => {
    // Black anodising reflects like a ~4% dielectric coat over metal: a near-black base colour with high
    // metalness would reflect almost nothing, so the base sits at ~4% linear and a soft clearcoat adds the sheen.
    const anodised = new THREE.MeshPhysicalMaterial({
      color: "#4a4a52", metalness: 0.7, roughness: 0.6, clearcoat: 0.45, clearcoatRoughness: 0.3, envMapIntensity: 3.4,
    });
    const anodisedRing = new THREE.MeshPhysicalMaterial({
      color: "#45454c", metalness: 0.7, roughness: 0.24, clearcoat: 0.35, clearcoatRoughness: 0.18, envMapIntensity: 1.6,
    });
    const anodisedSoft = new THREE.MeshPhysicalMaterial({
      color: "#404047", metalness: 0.62, roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.4, envMapIntensity: 2,
    });
    const recess = new THREE.MeshStandardMaterial({ color: "#020203", metalness: 0.3, roughness: 0.8 });
    const steel = new THREE.MeshPhysicalMaterial({
      color: "#b4b8bf", metalness: 1, roughness: 0.42, anisotropy: 0.35, anisotropyRotation: Math.PI / 2,
      clearcoat: 0.1, envMapIntensity: 1.2,
    });
    const delrin = new THREE.MeshPhysicalMaterial({ color: "#121215", metalness: 0, roughness: 0.58, sheen: 0.3, sheenColor: "#30323a", envMapIntensity: 1 });
    // Smoked glass: custom blend = own shading (reflections at full strength) + what is behind x (1 - opacity).
    // Normal alpha blending would also scale the reflections and hide the glowing coil.
    const glass = new THREE.MeshPhysicalMaterial({
      color: "#1c1c23", metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03,
      transparent: true, opacity: 0.72, envMapIntensity: 3, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      emissive: "#ff4a14", emissiveIntensity: 0, toneMapped: false,
    });
    const darkMetal = new THREE.MeshStandardMaterial({ color: "#2a2b30", metalness: 1, roughness: 0.35 });
    const coil = new THREE.MeshStandardMaterial({
      color: "#3b3c42", metalness: 1, roughness: 0.3, emissive: "#ff5a1e", emissiveIntensity: 0, toneMapped: false,
    });
    const wick = new THREE.MeshStandardMaterial({ color: "#5c4d3c", roughness: 1, emissive: "#ff3a10", emissiveIntensity: 0, toneMapped: false });
    const oled = new THREE.MeshPhysicalMaterial({
      color: "#000000", metalness: 0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.8,
      emissive: "#ffffff", emissiveMap: screen.tex, emissiveIntensity: 1.35, toneMapped: false,
    });
    const led = new THREE.MeshStandardMaterial({ color: "#1a0303", emissive: "#ff1d1d", emissiveIntensity: 0.25, toneMapped: false });
    const seam = new THREE.MeshStandardMaterial({ color: "#030304", roughness: 0.9, emissive: "#ff1a1a", emissiveIntensity: 0, toneMapped: false });
    return { anodised, anodisedRing, anodisedSoft, recess, steel, delrin, glass, darkMetal, coil, wick, oled, led, seam };
  }, [screen]);

  // ----- imperative API -----
  const api = useMemo(() => {
    const apply = () => {
      const { fire, hover } = state.current;
      mat.coil.emissiveIntensity = fire * 9;
      mat.wick.emissiveIntensity = fire * 0.18;
      mat.glass.emissiveIntensity = fire * 0.05;
      mat.led.emissiveIntensity = 0.25 + hover * 1.6 + fire * 5;
      mat.seam.emissiveIntensity = hover * 1.4 + fire * 0.9;
      mat.oled.emissiveIntensity = 1.35 + fire * 1.1;
      if (glowLight.current) glowLight.current.intensity = fire * 2.2;
      if (fireBtn.current) fireBtn.current.position.x = X_TOP - fire * 0.028;
    };
    return {
      get group() { return group.current; },
      get mouthpiece() { return mouthpiece.current; },
      setFire(v) { state.current.fire = Math.min(1, Math.max(0, +v || 0)); apply(); },
      setHover(v) { state.current.hover = Math.min(1, Math.max(0, +v || 0)); apply(); },
      setScreen(text) { drawScreen(screen.ctx, text); screen.tex.needsUpdate = true; },
      _apply: apply,
    };
  }, [mat, screen]);
  useImperativeHandle(ref, () => api, [api]);
  useEffect(() => { api._apply(); }, [api]);

  useEffect(() => () => {
    screen.tex.dispose();
    Object.values(mat).forEach((m) => m.dispose());
    Object.values(geo).forEach((g) => g.dispose());
  }, [geo, mat, screen]);

  const bodyLen = BODY_X1 - BODY_X0, bodyCx = (BODY_X0 + BODY_X1) / 2;
  const oledCx = (OLED_X0 + OLED_X1) / 2;
  const tankRot = [0, 0, -Math.PI / 2]; // tank frame +Y -> device +X

  return (
    <group ref={group} {...props}>
      {/* main shell + plates + seams */}
      <mesh geometry={geo.body} material={mat.anodised} position={[bodyCx, 0, 0]} />
      <mesh geometry={geo.plate} material={mat.anodisedRing} position={[X_MIN + PLATE_T / 2, 0, 0]} />
      <mesh geometry={geo.plate} material={mat.anodisedRing} position={[X_TOP - PLATE_T / 2, 0, 0]} />
      <mesh geometry={geo.seam} material={mat.seam} position={[BODY_X0 - GAP / 2, 0, 0]} />
      <mesh geometry={geo.seam} material={mat.seam} position={[BODY_X1 + GAP / 2, 0, 0]} />

      {/* front: OLED window between two flush buttons */}
      <mesh geometry={geo.gasket} material={mat.recess} position={[oledCx, ROW_Y, FRONT_Z + 0.0006]} />
      <mesh geometry={geo.oled} material={mat.oled} position={[oledCx, ROW_Y, FRONT_Z - 0.008]} />
      {[0.084, -1.5].map((x) => (
        <group key={x} position={[x, ROW_Y, FRONT_Z]}>
          <mesh geometry={geo.btnRing} material={mat.recess} position={[0, 0, 0.0006]} />
          <mesh geometry={geo.btn} material={mat.anodisedSoft} />
        </group>
      ))}

      {/* side buttons on the -Y face */}
      <mesh geometry={geo.sideLong} material={mat.anodisedRing} position={[-0.43, -BODY_H / 2 - 0.005, 0]} />
      <mesh geometry={geo.sideShort} material={mat.anodisedRing} position={[-0.86, -BODY_H / 2 - 0.005, 0]} />

      {/* fire button on the top plate, beside the tank */}
      <group ref={fireBtn} position={[X_TOP, FIRE_Y, 0]} rotation={tankRot}>
        <mesh geometry={geo.fireCollar} material={mat.anodisedRing} />
        <mesh geometry={geo.fireCap} material={mat.steel} />
      </group>

      {/* tank */}
      <group position={[X_TOP, TANK_Y, 0]} rotation={tankRot}>
        <mesh geometry={geo.connector} material={mat.darkMetal} />
        <mesh geometry={geo.ledRing} material={mat.led} />
        <mesh geometry={geo.baseRing} material={mat.anodisedRing} />
        <mesh geometry={geo.deck} material={mat.darkMetal} />
        <mesh geometry={geo.post} material={mat.darkMetal} position={[-0.135, 0, 0]} />
        <mesh geometry={geo.post} material={mat.darkMetal} position={[0.135, 0, 0]} />
        <mesh geometry={geo.coil} material={mat.coil} />
        <mesh geometry={geo.wick} material={mat.wick} />
        <pointLight ref={glowLight} position={[0, 0.45, 0.05]} color="#ff5a1e" intensity={0} distance={2.2} decay={2} />
        <mesh geometry={geo.glass} material={mat.glass} renderOrder={2} />
        <mesh geometry={geo.topRing} material={mat.anodisedRing} />
        <mesh geometry={geo.tip} material={mat.delrin} />
      </group>

      {/* drip-tip opening; local +Z points out of the mouthpiece (device +X) */}
      <object3D ref={mouthpiece} position={[X_TOP + TIP_LEN, TANK_Y, 0]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  );
});
