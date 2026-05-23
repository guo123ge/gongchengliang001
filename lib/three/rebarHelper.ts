/**
 * rebarHelper.ts
 * 3D tube-based rebar rendering helpers.
 * Replaces THREE.Line with CylinderGeometry / TubeGeometry for realistic rebar visuals.
 */
import * as THREE from "three";
import type { Rebar } from "../types";

// ─── Color palette (rich/dark for good metallic shading) ───────────────────────
export const REBAR_GRADE_COLOR: Record<string, number> = {
  HPB300: 0x1a7a3a,  // dark green
  HRB400: 0x154fa0,  // dark blue
  HRB500: 0x8b1010,  // dark red
};
export const STIRRUP_NORM_COLOR  = 0x1a5a4a;  // dark teal
export const STIRRUP_DENSE_COLOR = 0x8b1010;  // dark red (dense zone)

// ─── Material ──────────────────────────────────────────────────────────────────

/** Create a MeshStandardMaterial for rebar tubes */
export function rebarMeshMat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.55,
    roughness: 0.4,
  });
}

/** Compute visual tube radius from rebar object (min 6mm so small bars remain visible) */
export function tubeRadius(r: Rebar): number {
  return Math.max(0.006, (r.diameter / 2) / 1000);
}

/**
 * Returns the stirrup/spiral bar diameter (mm) for a component.
 * Used to correctly offset main bars inside the stirrup cage (22G101).
 */
export function stirrupDiam(rebars: Rebar[]): number {
  const s = rebars.find(r => r.role === "STIRRUP" || r.role === "SPIRAL");
  return s?.diameter ?? 8;
}

// ─── Straight bar cylinder ─────────────────────────────────────────────────────

/**
 * Create a CylinderGeometry mesh aligned between two world-space points.
 * Silently returns an empty Mesh if segment is degenerate.
 */
export function cylMesh(
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  mat: THREE.Material,
  radSegs = 8,
): THREE.Mesh {
  const dir = b.clone().sub(a);
  const len = dir.length();
  if (len < 0.0005) return new THREE.Mesh();
  const geo = new THREE.CylinderGeometry(radius, radius, len, radSegs, 1);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(a.clone().add(b).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

// ─── Stirrup: rounded-rectangle tube with 135° hook ───────────────────────────

function line3(a: THREE.Vector3, b: THREE.Vector3) {
  return new THREE.LineCurve3(a, b);
}
function quad3(a: THREE.Vector3, ctrl: THREE.Vector3, b: THREE.Vector3) {
  return new THREE.QuadraticBezierCurve3(a, ctrl, b);
}

/**
 * CurvePath for a rounded rectangle: LineCurve3 straight edges +
 * QuadraticBezierCurve3 corners. No CatmullRom distortion.
 * Ends with a 135° hook tail at the BL corner (per 22G101 standard).
 */
function stirrupCurvePath(
  o: THREE.Vector3,
  hA: number,
  hB: number,
  axA: 0 | 1 | 2,
  axB: 0 | 1 | 2,
  bendR: number,
  hookLen: number,
): THREE.CurvePath<THREE.Vector3> {
  const cr = Math.min(bendR, hA * 0.4, hB * 0.4);

  const pt = (u: number, w: number): THREE.Vector3 => {
    const p = o.clone();
    p.setComponent(axA, o.getComponent(axA) + u);
    p.setComponent(axB, o.getComponent(axB) + w);
    return p;
  };

  //  Corner tangent points (offsets from each physical corner by cr):
  //  BL=(-hA,-hB)  BR=(+hA,-hB)  TR=(+hA,+hB)  TL=(-hA,+hB)
  const blExit  = pt(-hA + cr, -hB);        // exit BL going right (+A)
  const brEntry = pt( hA - cr, -hB);        // enter BR from left
  const brCorner= pt( hA,      -hB);
  const brExit  = pt( hA,      -hB + cr);   // exit BR going up (+B)
  const trEntry = pt( hA,       hB - cr);   // enter TR from below
  const trCorner= pt( hA,       hB);
  const trExit  = pt( hA - cr,  hB);        // exit TR going left (-A)
  const tlEntry = pt(-hA + cr,  hB);        // enter TL from right
  const tlCorner= pt(-hA,       hB);
  const tlExit  = pt(-hA,       hB - cr);   // exit TL going down (-B)
  const blEntry = pt(-hA,      -hB + cr);   // enter BL from above
  const blCorner= pt(-hA,      -hB);

  const path = new THREE.CurvePath<THREE.Vector3>();

  // bottom edge → BR corner → right edge → TR corner →
  // top edge → TL corner → left edge → BL corner (open — hook follows)
  path.add(line3(blExit,  brEntry));
  path.add(quad3(brEntry, brCorner, brExit));
  path.add(line3(brExit,  trEntry));
  path.add(quad3(trEntry, trCorner, trExit));
  path.add(line3(trExit,  tlEntry));
  path.add(quad3(tlEntry, tlCorner, tlExit));
  path.add(line3(tlExit,  blEntry));
  path.add(quad3(blEntry, blCorner, blExit));

  // 135° hook: tail direction = +axA +axB at 45° (into the stirrup interior)
  const s = hookLen / Math.SQRT2;
  path.add(line3(blExit, pt(-hA + cr + s, -hB + s)));

  return path;
}

/**
 * Build a rounded-rectangle tube mesh for a BEAM stirrup.
 * Plane: Z–Y (axA=Z=2, axB=Y=1, fixed position = x along beam).
 */
export function beamStirrupMesh(
  x: number,
  halfZ: number,
  halfY: number,
  tubeR: number,
  mat: THREE.Material,
): THREE.Mesh {
  const r = Math.min(halfZ, halfY) * 0.25;
  const hook = Math.max(0.075, tubeR * 2 * 10);   // 75 mm or 10d
  const center = new THREE.Vector3(x, 0, 0);
  const path = stirrupCurvePath(center, halfZ, halfY, 2, 1, r, hook);
  const segs = Math.ceil(path.getLength() / (tubeR * 0.8));
  const geo = new THREE.TubeGeometry(path, Math.max(segs, 48), tubeR, 8, false);
  return new THREE.Mesh(geo, mat);
}

/**
 * Build a rounded-rectangle tube mesh for a COLUMN stirrup.
 * Plane: X–Z (axA=X=0, axB=Z=2, fixed position = y along column).
 */
export function colStirrupMesh(
  y: number,
  halfX: number,
  halfZ: number,
  tubeR: number,
  mat: THREE.Material,
): THREE.Mesh {
  const r = Math.min(halfX, halfZ) * 0.25;
  const hook = Math.max(0.075, tubeR * 2 * 10);
  const center = new THREE.Vector3(0, y, 0);
  const path = stirrupCurvePath(center, halfX, halfZ, 0, 2, r, hook);
  const segs = Math.ceil(path.getLength() / (tubeR * 0.8));
  const geo = new THREE.TubeGeometry(path, Math.max(segs, 48), tubeR, 8, false);
  return new THREE.Mesh(geo, mat);
}

// ─── Spiral tube (for pile spiral rebar) ──────────────────────────────────────

export function spiralTubeMesh(
  pts: THREE.Vector3[],
  tubeR: number,
  mat: THREE.Material,
): THREE.Mesh {
  if (pts.length < 2) return new THREE.Mesh();
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
  const geo = new THREE.TubeGeometry(curve, Math.max(pts.length * 2, 64), tubeR, 6, false);
  return new THREE.Mesh(geo, mat);
}
