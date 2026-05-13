import * as THREE from "three";
import type { Component, Rebar } from "../types";

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

const GRADE_COLOR: Record<string, number> = {
  HPB300: 0x16a34a,
  HRB400: 0x2563eb,
  HRB500: 0xdc2626,
};
const STIRRUP_COLOR = 0xea580c;

/** 为一个构件生成 three.js 对象组（mm → 场景单位：除以 1000） */
export function buildComponentObject(c: Component, opts: { showConcrete: boolean; showRebar: boolean }): THREE.Group {
  const group = new THREE.Group();
  group.name = c.id;
  group.userData.componentId = c.id;

  // 混凝土体
  if (opts.showConcrete) {
    const mesh = concreteMesh(c);
    if (mesh) group.add(mesh);
  }
  // 钢筋线
  if (opts.showRebar) {
    for (const r of c.rebars) {
      const line = rebarLines(c, r);
      if (line) group.add(line);
    }
  }
  // 放置
  const p = c.placement;
  group.position.set((p.x || 0) / 1000, (p.y || 0) / 1000, (p.z || 0) / 1000);
  group.rotation.y = ((p.rot || 0) * Math.PI) / 180;
  return group;
}

function concreteMesh(c: Component): THREE.Mesh | null {
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
  }
  if (!geo) return null;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    transparent: true,
    opacity: 0.45,
    metalness: 0.05,
    roughness: 0.9,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.kind = "concrete";
  mesh.userData.componentId = c.id;
  return mesh;
}

function rebarMaterial(r: Rebar): THREE.LineBasicMaterial {
  const color = r.role === "STIRRUP" || r.role === "SPIRAL" ? STIRRUP_COLOR : GRADE_COLOR[r.grade] ?? 0x2563eb;
  return new THREE.LineBasicMaterial({ color, linewidth: 2 });
}

function rebarLines(c: Component, r: Rebar): THREE.Object3D | null {
  const g = c.geometry;
  const cover = c.concrete.cover / 1000;
  const mat = rebarMaterial(r);
  const group = new THREE.Group();
  group.userData = { kind: "rebar", componentId: c.id, rebarId: r.id, rebar: r };

  if (c.type === "BEAM") {
    const b = (g.b ?? 0) / 1000, h = (g.h ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    const ix = b / 2 - cover, iy = h / 2 - cover, ax = L / 2;
    if (r.role === "TOP" || r.role === "BOTTOM" || r.role === "LONGITUDINAL" || r.role === "ERECTION" || r.role === "BENT" || r.role === "TIE" || r.role === "ADDITIONAL") {
      const y = r.role === "TOP" || r.role === "ERECTION" ? iy : -iy;
      const n = Math.max(2, r.count ?? 2);
      for (let i = 0; i < n; i++) {
        const z = -ix + (n > 1 ? (2 * ix * i) / (n - 1) : 0);
        const pts = [new THREE.Vector3(-ax, y, z), new THREE.Vector3(ax, y, z)];
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
      }
    } else if (r.role === "STIRRUP") {
      const denseMat = new THREE.LineBasicMaterial({ color: 0xdc2626 });
      const normMat = new THREE.LineBasicMaterial({ color: 0xea580c });
      const xs = beamColumnStirrupXs(L, r, true);
      for (const { x: pos, dense } of xs) {
        const x = -ax + pos / 1000;
        const pts = [
          new THREE.Vector3(x, iy, -ix), new THREE.Vector3(x, iy, ix),
          new THREE.Vector3(x, -iy, ix), new THREE.Vector3(x, -iy, -ix),
          new THREE.Vector3(x, iy, -ix),
        ];
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), dense ? denseMat : normMat));
      }
    }
  } else if (c.type === "COLUMN") {
    const b = (g.b ?? 0) / 1000, h = (g.h ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    const ix = b / 2 - cover, iz = h / 2 - cover, ay = L / 2;
    if (r.role === "MAIN" || r.role === "CONSTRUCT_COL" || r.role === "TIE") {
      const n = Math.max(4, r.count ?? 4);
      const perSide = Math.ceil(n / 4);
      const positions: [number, number][] = [];
      for (let i = 0; i < perSide; i++) {
        const t = perSide > 1 ? i / (perSide - 1) : 0.5;
        positions.push([-ix + 2 * ix * t, iz]);
        positions.push([-ix + 2 * ix * t, -iz]);
        positions.push([ix, -iz + 2 * iz * t]);
        positions.push([-ix, -iz + 2 * iz * t]);
      }
      const uniq = Array.from(new Set(positions.map((p) => p.join(",")))).slice(0, n).map((s) => s.split(",").map(Number));
      for (const [x, z] of uniq) {
        const pts = [new THREE.Vector3(x, -ay, z), new THREE.Vector3(x, ay, z)];
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
      }
    } else if (r.role === "STIRRUP") {
      const denseMat = new THREE.LineBasicMaterial({ color: 0xdc2626 });
      const normMat = new THREE.LineBasicMaterial({ color: 0xea580c });
      const ys = beamColumnStirrupXs(L, r, true);
      for (const { x: pos, dense } of ys) {
        const y = -ay + pos / 1000;
        const pts = [
          new THREE.Vector3(-ix, y, -iz), new THREE.Vector3(ix, y, -iz),
          new THREE.Vector3(ix, y, iz), new THREE.Vector3(-ix, y, iz),
          new THREE.Vector3(-ix, y, -iz),
        ];
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), dense ? denseMat : normMat));
      }
    }
  } else if (c.type === "SLAB") {
    const Lx = (g.Lx ?? 0) / 1000, Ly = (g.Ly ?? 0) / 1000, t = (g.t ?? 0) / 1000;
    if (r.role === "NEG") {
      const ext = (r.extension ?? 1500) / 1000;
      const y = t / 2 - cover; // 顶部
      if (r.spacing) {
        const n = Math.max(2, Math.floor((Ly * 1000) / r.spacing) + 1);
        const negMat = new THREE.LineBasicMaterial({ color: 0x9333ea });
        for (let i = 0; i < n; i++) {
          const z = -Ly / 2 + (n > 1 ? (Ly * i) / (n - 1) : 0);
          // 左支座负筋
          group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-Lx / 2, y, z), new THREE.Vector3(-Lx / 2 + ext, y, z),
          ]), negMat));
          // 右支座负筋
          group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(Lx / 2 - ext, y, z), new THREE.Vector3(Lx / 2, y, z),
          ]), negMat));
        }
      }
    } else if (r.role === "CONSTRUCT" || r.role === "STOOL") {
      const y = r.role === "CONSTRUCT" ? t / 2 - cover : -t / 2 + cover;
      if (r.spacing) {
        const n = Math.max(2, Math.floor((Ly * 1000) / r.spacing) + 1);
        for (let i = 0; i < n; i++) {
          const z = -Ly / 2 + (n > 1 ? (Ly * i) / (n - 1) : 0);
          const pts = [new THREE.Vector3(-Lx / 2, y, z), new THREE.Vector3(Lx / 2, y, z)];
          group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
        }
      }
    } else {
      const y = r.role === "TOP" ? t / 2 - cover : -t / 2 + cover;
      if (r.spacing) {
        const n = Math.max(2, Math.floor((Ly * 1000) / r.spacing) + 1);
        for (let i = 0; i < n; i++) {
          const z = -Ly / 2 + (n > 1 ? (Ly * i) / (n - 1) : 0);
          const pts = [new THREE.Vector3(-Lx / 2, y, z), new THREE.Vector3(Lx / 2, y, z)];
          group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
        }
      }
    }
  } else if (c.type === "PILE") {
    const D = (g.D ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    const rad = D / 2 - cover;
    if (r.role === "MAIN") {
      const n = Math.max(4, r.count ?? 6);
      for (let i = 0; i < n; i++) {
        const theta = (2 * Math.PI * i) / n;
        const x = rad * Math.cos(theta), z = rad * Math.sin(theta);
        const pts = [new THREE.Vector3(x, -L / 2, z), new THREE.Vector3(x, L / 2, z)];
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
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
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    } else if (r.role === "SONIC") {
      const n = Math.max(2, r.count ?? 3);
      const sonicMat = new THREE.LineBasicMaterial({ color: 0xfacc15 });
      for (let i = 0; i < n; i++) {
        const theta = (2 * Math.PI * i) / n;
        const x = rad * Math.cos(theta), z = rad * Math.sin(theta);
        const pts = [new THREE.Vector3(x, -L / 2, z), new THREE.Vector3(x, L / 2, z)];
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), sonicMat));
      }
    }
  }

  return group.children.length > 0 ? group : null;
}
