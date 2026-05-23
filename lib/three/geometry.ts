import * as THREE from "three";
import type { Component, Rebar } from "../types";
import {
  rebarMeshMat, tubeRadius, cylMesh,
  beamStirrupMesh, colStirrupMesh, spiralTubeMesh,
  REBAR_GRADE_COLOR, STIRRUP_NORM_COLOR, STIRRUP_DENSE_COLOR,
  stirrupDiam,
} from "./rebarHelper";

/** 计算梁/柱沿轴线箍筋位置（mm，从 0 到 L），并标识是否处于加密区 */
export function beamColumnStirrupXs(
  Lm: number,
  r: Rebar,
  _ignored?: boolean,
): { x: number; dense: boolean }[] {
  const L = Lm * 1000;
  const out: { x: number; dense: boolean }[] = [];
  const dz = r.densifyLength ?? 0;
  const ds = r.densifySpacing;
  const ns = r.spacing ?? 0;
  if (dz > 0 && ds && ds > 0) {
    // 左加密
    for (let x = 0; x <= dz + 0.5; x += ds) out.push({ x, dense: true });
    // 中部
    if (ns > 0) {
      const start = dz + ns;
      const end = L - dz;
      for (let x = start; x < end - 0.5; x += ns) out.push({ x, dense: false });
    }
    // 右加密
    for (let x = L - dz; x <= L + 0.5; x += ds) out.push({ x: Math.min(x, L), dense: true });
  } else if (ns > 0) {
    for (let x = 0; x <= L + 0.5; x += ns) out.push({ x: Math.min(x, L), dense: false });
  }
  return out;
}

/** 为一个构件生成 three.js 对象组（mm → 场景单位：除以 1000） */
export function buildComponentObject(c: Component, opts: { showConcrete: boolean; showRebar: boolean; concreteOpacity?: number }): THREE.Group {
  const group = new THREE.Group();
  group.name = c.id;
  group.userData.componentId = c.id;

  // 混凝土体
  if (opts.showConcrete) {
    const mesh = concreteMesh(c, opts.concreteOpacity ?? 0.35);
    if (mesh) group.add(mesh);
  }
  // 钢筋管（3D tube 渲染）
  if (opts.showRebar) {
    for (const r of c.rebars) {
      const tube = rebarTubes(c, r);
      if (tube) group.add(tube);
    }
  }
  // 放置
  const p = c.placement;
  group.position.set((p.x || 0) / 1000, (p.y || 0) / 1000, (p.z || 0) / 1000);
  group.rotation.y = ((p.rot || 0) * Math.PI) / 180;
  return group;
}

function concreteMesh(c: Component, opacity = 0.35): THREE.Mesh | null {
  const g = c.geometry;
  let geo: THREE.BufferGeometry | null = null;
  if (c.type === "BEAM" || c.type === "COLUMN") {
    const b = (g.b ?? 0) / 1000, h = (g.h ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    if (c.type === "BEAM") geo = new THREE.BoxGeometry(L, h, b);
    else geo = new THREE.BoxGeometry(b, L, h);
  } else if (c.type === "SLAB") {
    const Lx = (g.Lx ?? 0) / 1000, Ly = (g.Ly ?? 0) / 1000, t = (g.t ?? 0) / 1000;
    geo = new THREE.BoxGeometry(Lx, t, Ly);
  } else if (c.type === "PILE") {
    const D = (g.D ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    geo = new THREE.CylinderGeometry(D / 2, D / 2, L, 32);
  } else if (c.type === "SHEAR_WALL") {
    const b = (g.b ?? 0) / 1000, h = (g.h ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    geo = new THREE.BoxGeometry(L, h, b);
  } else if (c.type === "STAIR") {
    const b = (g.b ?? 0) / 1000, L = (g.L ?? 0) / 1000, t = (g.t ?? 0) / 1000;
    geo = new THREE.BoxGeometry(L, t, b);
  } else if (c.type === "FOUND" || c.type === "PILE_CAP") {
    const Lx = (g.Lx ?? 0) / 1000, Ly = (g.Ly ?? 0) / 1000, t = (g.t ?? 0) / 1000;
    geo = new THREE.BoxGeometry(Lx, t, Ly);
  } else if (c.type === "STRIP_FOUND") {
    const b = (g.b ?? 0) / 1000, h = (g.h ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    geo = new THREE.BoxGeometry(L, h, b);
  } else if (c.type === "RAFT") {
    const Lx = (g.Lx ?? 0) / 1000, Ly = (g.Ly ?? 0) / 1000, t = (g.t ?? 0) / 1000;
    geo = new THREE.BoxGeometry(Lx, t, Ly);
  }
  if (!geo) return null;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    transparent: true,
    opacity,
    metalness: 0.05,
    roughness: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  mesh.userData.kind = "concrete";
  mesh.userData.componentId = c.id;
  return mesh;
}

function rebarTubes(c: Component, r: Rebar): THREE.Object3D | null {
  const g = c.geometry;
  const cover = c.concrete.cover / 1000;
  const tR = tubeRadius(r);
  const isStirrup = r.role === "STIRRUP" || r.role === "SPIRAL";
  const color = isStirrup ? STIRRUP_NORM_COLOR : (REBAR_GRADE_COLOR[r.grade] ?? 0x154fa0);
  const mat = rebarMeshMat(color);
  const group = new THREE.Group();
  group.userData = { kind: "rebar", componentId: c.id, rebarId: r.id, rebar: r };

  // ─── BEAM ────────────────────────────────────────────────────────────────────
  if (c.type === "BEAM") {
    const b = (g.b ?? 0) / 1000, h = (g.h ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    const ax = L / 2;
    const sd = stirrupDiam(c.rebars) / 1000;  // stirrup bar diameter
    const md = r.diameter / 1000;             // this bar's diameter
    // Stirrup centerline half-extents (cover + sd/2 from face)
    const sx = b / 2 - cover - sd / 2;
    const sy = h / 2 - cover - sd / 2;
    // Main bar clear inner half-extents (cover + sd + md/2 from face)
    const ix = b / 2 - cover - sd - md / 2;
    const iy = h / 2 - cover - sd - md / 2;
    const LONG = ["TOP","BOTTOM","LONGITUDINAL","ERECTION","BENT","TIE","ADDITIONAL"];
    if (LONG.includes(r.role)) {
      const y = (r.role === "TOP" || r.role === "ERECTION") ? iy : -iy;
      const n = Math.max(2, r.count ?? 2);
      for (let i = 0; i < n; i++) {
        const z = n > 1 ? -ix + (2 * ix * i) / (n - 1) : 0;
        group.add(cylMesh(new THREE.Vector3(-ax, y, z), new THREE.Vector3(ax, y, z), tR, mat));
      }
    } else if (r.role === "STIRRUP") {
      const xs = beamColumnStirrupXs(L, r, true);
      for (const { x: pos, dense } of xs) {
        const x = -ax + pos / 1000;
        group.add(beamStirrupMesh(x, sx, sy, tR,
          rebarMeshMat(dense ? STIRRUP_DENSE_COLOR : STIRRUP_NORM_COLOR)));
      }
    }

  // ─── COLUMN ──────────────────────────────────────────────────────────────────
  } else if (c.type === "COLUMN") {
    const b = (g.b ?? 0) / 1000, h = (g.h ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    const ay = L / 2;
    const sd = stirrupDiam(c.rebars) / 1000;
    const md = r.diameter / 1000;
    // Stirrup centerline half-extents
    const sx = b / 2 - cover - sd / 2;
    const sz = h / 2 - cover - sd / 2;
    // Main bar clear inner half-extents
    const ix = b / 2 - cover - sd - md / 2;
    const iz = h / 2 - cover - sd - md / 2;
    if (r.role === "MAIN" || r.role === "CONSTRUCT_COL" || r.role === "TIE") {
      const n = Math.max(4, r.count ?? 4);
      const perSide = Math.ceil(n / 4);
      const positions: [number, number][] = [];
      for (let i = 0; i < perSide; i++) {
        const t = perSide > 1 ? i / (perSide - 1) : 0.5;
        positions.push([-ix + 2 * ix * t,  iz]);
        positions.push([-ix + 2 * ix * t, -iz]);
        positions.push([ ix, -iz + 2 * iz * t]);
        positions.push([-ix, -iz + 2 * iz * t]);
      }
      const uniq = Array.from(new Set(positions.map((p) => p.join(",")))).slice(0, n).map((s) => s.split(",").map(Number));
      for (const [x, z] of uniq) {
        group.add(cylMesh(new THREE.Vector3(x, -ay, z), new THREE.Vector3(x, ay, z), tR, mat));
      }
    } else if (r.role === "STIRRUP") {
      const ys = beamColumnStirrupXs(L, r, true);
      for (const { x: pos, dense } of ys) {
        const y = -ay + pos / 1000;
        group.add(colStirrupMesh(y, sx, sz, tR,
          rebarMeshMat(dense ? STIRRUP_DENSE_COLOR : STIRRUP_NORM_COLOR)));
      }
    }

  // ─── SLAB ────────────────────────────────────────────────────────────────────
  } else if (c.type === "SLAB") {
    const Lx = (g.Lx ?? 0) / 1000, Ly = (g.Ly ?? 0) / 1000, t = (g.t ?? 0) / 1000;
    const negMat = rebarMeshMat(0x6b21a8);
    if (r.role === "NEG") {
      const ext = (r.extension ?? 1500) / 1000;
      const y = t / 2 - cover;
      if (r.spacing) {
        const n = Math.max(2, Math.floor((Ly * 1000) / r.spacing) + 1);
        for (let i = 0; i < n; i++) {
          const z = -Ly / 2 + (n > 1 ? (Ly * i) / (n - 1) : 0);
          group.add(cylMesh(new THREE.Vector3(-Lx / 2, y, z), new THREE.Vector3(-Lx / 2 + ext, y, z), tR, negMat));
          group.add(cylMesh(new THREE.Vector3(Lx / 2 - ext, y, z), new THREE.Vector3(Lx / 2, y, z), tR, negMat));
        }
      }
    } else if (r.role === "CONSTRUCT" || r.role === "STOOL") {
      const y = r.role === "CONSTRUCT" ? t / 2 - cover : -t / 2 + cover;
      if (r.spacing) {
        const n = Math.max(2, Math.floor((Ly * 1000) / r.spacing) + 1);
        for (let i = 0; i < n; i++) {
          const z = -Ly / 2 + (n > 1 ? (Ly * i) / (n - 1) : 0);
          group.add(cylMesh(new THREE.Vector3(-Lx / 2, y, z), new THREE.Vector3(Lx / 2, y, z), tR, mat));
        }
      }
    } else {
      const y = r.role === "TOP" ? t / 2 - cover : -t / 2 + cover;
      if (r.spacing) {
        const n = Math.max(2, Math.floor((Ly * 1000) / r.spacing) + 1);
        for (let i = 0; i < n; i++) {
          const z = -Ly / 2 + (n > 1 ? (Ly * i) / (n - 1) : 0);
          group.add(cylMesh(new THREE.Vector3(-Lx / 2, y, z), new THREE.Vector3(Lx / 2, y, z), tR, mat));
        }
      }
    }

  // ─── SHEAR_WALL ──────────────────────────────────────────────────────────────
  } else if (c.type === "SHEAR_WALL") {
    const bW = (g.b ?? 0) / 1000, h = (g.h ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    const ax = L / 2, ay = h / 2, az = bW / 2 - cover;
    if (r.role === "HORIZONTAL") {
      const n = r.spacing ? Math.max(2, Math.floor((h * 1000) / r.spacing) + 1) : 4;
      for (let i = 0; i < n; i++) {
        const y = -ay + (n > 1 ? (h * i) / (n - 1) : 0);
        group.add(cylMesh(new THREE.Vector3(-ax, y, -az), new THREE.Vector3(ax, y, -az), tR, mat));
        group.add(cylMesh(new THREE.Vector3(-ax, y,  az), new THREE.Vector3(ax, y,  az), tR, mat));
      }
    } else if (r.role === "VERTICAL") {
      const n = r.spacing ? Math.max(2, Math.floor((L * 1000) / r.spacing) + 1) : 4;
      for (let i = 0; i < n; i++) {
        const x = -ax + (n > 1 ? (L * i) / (n - 1) : 0);
        group.add(cylMesh(new THREE.Vector3(x, -ay, -az), new THREE.Vector3(x, ay, -az), tR, mat));
        group.add(cylMesh(new THREE.Vector3(x, -ay,  az), new THREE.Vector3(x, ay,  az), tR, mat));
      }
    } else if (r.role === "TIE") {
      const nX = r.spacing ? Math.max(2, Math.floor((L * 1000) / r.spacing) + 1) : 3;
      const nY = r.spacing ? Math.max(2, Math.floor((h * 1000) / r.spacing) + 1) : 3;
      for (let i = 0; i < nX; i++) {
        for (let j = 0; j < nY; j++) {
          const x = -ax + (nX > 1 ? (L * i) / (nX - 1) : 0);
          const y = -ay + (nY > 1 ? (h * j) / (nY - 1) : 0);
          group.add(cylMesh(new THREE.Vector3(x, y, -az), new THREE.Vector3(x, y, az), tR, mat));
        }
      }
    }

  // ─── STAIR ───────────────────────────────────────────────────────────────────
  } else if (c.type === "STAIR") {
    const bW = (g.b ?? 0) / 1000, L = (g.L ?? 0) / 1000, t = (g.t ?? 0) / 1000;
    const y = -t / 2 + cover;
    if (r.role === "LONGITUDINAL") {
      const n = r.spacing ? Math.max(2, Math.floor((bW * 1000) / r.spacing) + 1) : 3;
      for (let i = 0; i < n; i++) {
        const z = -bW / 2 + (n > 1 ? (bW * i) / (n - 1) : 0);
        group.add(cylMesh(new THREE.Vector3(-L / 2, y, z), new THREE.Vector3(L / 2, y, z), tR, mat));
      }
    } else if (r.role === "DIST") {
      const n = r.spacing ? Math.max(2, Math.floor((L * 1000) / r.spacing) + 1) : 4;
      for (let i = 0; i < n; i++) {
        const x = -L / 2 + (n > 1 ? (L * i) / (n - 1) : 0);
        group.add(cylMesh(new THREE.Vector3(x, y, -bW / 2), new THREE.Vector3(x, y, bW / 2), tR, mat));
      }
    }

  // ─── FOUND / PILE_CAP ────────────────────────────────────────────────────────
  } else if (c.type === "FOUND" || c.type === "PILE_CAP") {
    const Lx = (g.Lx ?? 0) / 1000, Ly = (g.Ly ?? 0) / 1000, t = (g.t ?? 0) / 1000;
    const y = (r.role === "TOP_X" || r.role === "TOP_Y") ? t / 2 - cover : -t / 2 + cover;
    if (r.role === "BOT_X" || r.role === "TOP_X") {
      const n = r.spacing ? Math.max(2, Math.floor((Ly * 1000) / r.spacing) + 1) : 4;
      for (let i = 0; i < n; i++) {
        const z = -Ly / 2 + (n > 1 ? (Ly * i) / (n - 1) : 0);
        group.add(cylMesh(new THREE.Vector3(-Lx / 2, y, z), new THREE.Vector3(Lx / 2, y, z), tR, mat));
      }
    } else if (r.role === "BOT_Y" || r.role === "TOP_Y") {
      const n = r.spacing ? Math.max(2, Math.floor((Lx * 1000) / r.spacing) + 1) : 4;
      for (let i = 0; i < n; i++) {
        const x = -Lx / 2 + (n > 1 ? (Lx * i) / (n - 1) : 0);
        group.add(cylMesh(new THREE.Vector3(x, y, -Ly / 2), new THREE.Vector3(x, y, Ly / 2), tR, mat));
      }
    }

  // ─── STRIP_FOUND ─────────────────────────────────────────────────────────────
  } else if (c.type === "STRIP_FOUND") {
    const bW = (g.b ?? 0) / 1000, h = (g.h ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    const y = -h / 2 + cover;
    if (r.role === "TRANSVERSE") {
      const n = r.spacing ? Math.max(2, Math.floor((L * 1000) / r.spacing) + 1) : 5;
      for (let i = 0; i < n; i++) {
        const x = -L / 2 + (n > 1 ? (L * i) / (n - 1) : 0);
        group.add(cylMesh(new THREE.Vector3(x, y, -bW / 2), new THREE.Vector3(x, y, bW / 2), tR, mat));
      }
    } else if (r.role === "LONGITUDINAL") {
      const n = Math.max(2, r.count ?? 3);
      for (let i = 0; i < n; i++) {
        const z = -bW / 2 + (n > 1 ? (bW * i) / (n - 1) : 0);
        group.add(cylMesh(new THREE.Vector3(-L / 2, y, z), new THREE.Vector3(L / 2, y, z), tR, mat));
      }
    }

  // ─── RAFT ────────────────────────────────────────────────────────────────────
  } else if (c.type === "RAFT") {
    const Lx = (g.Lx ?? 0) / 1000, Ly = (g.Ly ?? 0) / 1000, t = (g.t ?? 0) / 1000;
    const y = (r.role === "TOP_X" || r.role === "TOP_Y") ? t / 2 - cover : -t / 2 + cover;
    if (r.role === "BOT_X" || r.role === "TOP_X") {
      const n = r.spacing ? Math.max(2, Math.floor((Ly * 1000) / r.spacing) + 1) : 6;
      for (let i = 0; i < n; i++) {
        const z = -Ly / 2 + (n > 1 ? (Ly * i) / (n - 1) : 0);
        group.add(cylMesh(new THREE.Vector3(-Lx / 2, y, z), new THREE.Vector3(Lx / 2, y, z), tR, mat));
      }
    } else if (r.role === "BOT_Y" || r.role === "TOP_Y") {
      const n = r.spacing ? Math.max(2, Math.floor((Lx * 1000) / r.spacing) + 1) : 6;
      for (let i = 0; i < n; i++) {
        const x = -Lx / 2 + (n > 1 ? (Lx * i) / (n - 1) : 0);
        group.add(cylMesh(new THREE.Vector3(x, y, -Ly / 2), new THREE.Vector3(x, y, Ly / 2), tR, mat));
      }
    }

  // ─── PILE ────────────────────────────────────────────────────────────────────
  } else if (c.type === "PILE") {
    const D = (g.D ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    const rad = D / 2 - cover;
    if (r.role === "MAIN") {
      const n = Math.max(4, r.count ?? 6);
      for (let i = 0; i < n; i++) {
        const theta = (2 * Math.PI * i) / n;
        const x = rad * Math.cos(theta), z = rad * Math.sin(theta);
        group.add(cylMesh(new THREE.Vector3(x, -L / 2, z), new THREE.Vector3(x, L / 2, z), tR, mat));
      }
    } else if (r.role === "SPIRAL" || r.role === "STIFFEN" || r.role === "STIRRUP") {
      const sp = (r.spacing ?? 200) / 1000;
      const turns = L / sp;
      const seg = Math.max(32, Math.floor(turns * 24));
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= seg; i++) {
        const t = i / seg;
        const ang = t * turns * Math.PI * 2;
        pts.push(new THREE.Vector3(rad * Math.cos(ang), -L / 2 + t * L, rad * Math.sin(ang)));
      }
      group.add(spiralTubeMesh(pts, tR, rebarMeshMat(STIRRUP_NORM_COLOR)));
    } else if (r.role === "SONIC") {
      const sonicMat = rebarMeshMat(0xca8a04);
      const n = Math.max(2, r.count ?? 3);
      for (let i = 0; i < n; i++) {
        const theta = (2 * Math.PI * i) / n;
        const x = rad * Math.cos(theta), z = rad * Math.sin(theta);
        group.add(cylMesh(new THREE.Vector3(x, -L / 2, z), new THREE.Vector3(x, L / 2, z), tR, sonicMat));
      }
    }
  }

  return group.children.length > 0 ? group : null;
}
