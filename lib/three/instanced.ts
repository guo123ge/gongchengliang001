// InstancedMesh 构建 — 同类型构件合并为 InstancedMesh，大幅减少 WebGL draw calls
import * as THREE from "three";
import type { Component, Rebar } from "../types";
import {
  rebarMeshMat, tubeRadius, cylMesh,
  beamStirrupMesh, colStirrupMesh, spiralTubeMesh,
  REBAR_GRADE_COLOR, STIRRUP_NORM_COLOR, STIRRUP_DENSE_COLOR,
  stirrupDiam,
} from "./rebarHelper";
import { beamColumnStirrupXs } from "./geometry";

// ─── 类型签名 ───

export interface InstancedBuildResult {
  concreteInstances: THREE.InstancedMesh[];
  rebarObjects: THREE.Object3D[];
}

/**
 * 将同类型同类几何的构件合并为 InstancedMesh
 *
 * 核心思路：
 * - 按 (type, 几何特征) 分组（同组共享同一个 base geometry）
 * - 每个组生成一个 InstancedMesh，每个构件实例写一个变换矩阵
 * - 钢筋线条独立创建（线条数相对少，draw call 影响不大）
 *
 * @param components 全部构件
 * @param selectedId 当前选中构件 ID（用于高亮）
 * @param opts       显隐选项
 * @returns          包含所有实例 Mesh + 钢筋 Object3D 的组
 */
export function buildInstancedScene(
  components: Component[],
  selectedId: string | null,
  opts: { showConcrete: boolean; showRebar: boolean; concreteOpacity?: number },
): InstancedBuildResult {
  const concreteInstances: THREE.InstancedMesh[] = [];
  const rebarObjects: THREE.Object3D[] = [];

  if (components.length === 0) return { concreteInstances, rebarObjects };

  // ─── 按类型+几何键分组 ───
  const groups = new Map<string, { comps: Component[]; geoKey: string }>();

  for (const c of components) {
    const key = groupKey(c);
    if (!groups.has(key)) groups.set(key, { comps: [], geoKey: key });
    groups.get(key)!.comps.push(c);
  }

  // ─── 混凝土 InstancedMesh ───
  if (opts.showConcrete) {
    for (const [, group] of groups) {
      const list = group.comps;
      if (list.length === 0) continue;

      const baseGeo = createBaseGeometry(list[0]);
      if (!baseGeo) continue;

      // 共享材质
      const mat = new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        transparent: true,
        opacity: opts.concreteOpacity ?? 0.35,
        metalness: 0.05,
        roughness: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const im = new THREE.InstancedMesh(baseGeo, mat, list.length);
      im.castShadow = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      const dummy = new THREE.Object3D();
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        const p = c.placement;
        dummy.position.set((p.x || 0) / 1000, (p.y || 0) / 1000, (p.z || 0) / 1000);
        dummy.rotation.y = ((p.rot || 0) * Math.PI) / 180;
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);

        // 选中构件高亮
        const isSelected = c.id === selectedId;
        const color = isSelected ? new THREE.Color(0x2563eb) : new THREE.Color(0xcbd5e1);
        im.setColorAt(i, color);
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;

      // 存储构件 ID → instanceIndex 映射，用于鼠标拾取
      im.userData.componentIds = list.map((c) => c.id);
      im.userData.kind = "instanced-concrete";

      concreteInstances.push(im);
    }
  }

    // ─── 钢筋管（3D tube 渲染） ───
  if (opts.showRebar) {
    for (const c of components) {
      for (const r of c.rebars) {
        const tubes = buildRebarTubes(c, r);
        for (const t of tubes) rebarObjects.push(t);
      }
    }
  }

  return { concreteInstances, rebarObjects };
}

// ─── 分组键：type + 几何签名 ───

function groupKey(c: Component): string {
  const g = c.geometry;
  // 仅根据类型和几何尺寸的"类别"分组，不要求完全一致
  // PILE 和其他构件几何不同，各自独立
  if (c.type === "BEAM" || c.type === "COLUMN") {
    return `${c.type}_BOX_${Math.round((g.b ?? 0) / 50) * 50}x${Math.round((g.h ?? 0) / 50) * 50}x${Math.round((g.L ?? 0) / 100) * 100}`;
  }
  if (c.type === "SLAB") {
    return `${c.type}_BOX_${Math.round((g.Lx ?? 0) / 100) * 100}x${Math.round((g.Ly ?? 0) / 100) * 100}x${Math.round((g.t ?? 0) / 10) * 10}`;
  }
  if (c.type === "PILE") {
    return `${c.type}_CYL_${Math.round((g.D ?? 0) / 50) * 50}x${Math.round((g.L ?? 0) / 100) * 100}`;
  }
  return c.type;
}

// ─── 基础几何体创建 ───

function createBaseGeometry(c: Component): THREE.BufferGeometry | null {
  const g = c.geometry;
  if (c.type === "BEAM") {
    const b = (g.b ?? 0) / 1000, h = (g.h ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    return new THREE.BoxGeometry(L, h, b);
  }
  if (c.type === "COLUMN") {
    const b = (g.b ?? 0) / 1000, h = (g.h ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    return new THREE.BoxGeometry(b, L, h);
  }
  if (c.type === "SLAB") {
    const Lx = (g.Lx ?? 0) / 1000, Ly = (g.Ly ?? 0) / 1000, t = (g.t ?? 0) / 1000;
    return new THREE.BoxGeometry(Lx, t, Ly);
  }
  if (c.type === "PILE") {
    const D = (g.D ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    return new THREE.CylinderGeometry(D / 2, D / 2, L, 32);
  }
  return null;
}

// ─── 解析 instanceIndex → componentId ───

/**
 * 将 Raycaster 的 intersection 结果映射回构件 ID
 * 适用于 instanced-concrete 类型的 Mesh
 */
export function getComponentIdFromHit(
  hit: THREE.Intersection,
): string | null {
  const obj = hit.object;
  const ids = obj.userData.componentIds as string[] | undefined;
  if (ids && typeof hit.instanceId === "number") {
    return ids[hit.instanceId] ?? null;
  }
  return null;
}

// ─── 3D 钢筋管渲染 ─────────────────────────────────────────────────────────────

function buildRebarTubes(c: Component, r: Rebar): THREE.Mesh[] {
  const g = c.geometry;
  const cover = c.concrete.cover / 1000;
  const tR = tubeRadius(r);
  const isStirrup = r.role === "STIRRUP" || r.role === "SPIRAL";
  const color = isStirrup ? STIRRUP_NORM_COLOR : (REBAR_GRADE_COLOR[r.grade] ?? 0x154fa0);
  const mat = rebarMeshMat(color);
  const out: THREE.Mesh[] = [];

  if (c.type === "BEAM") {
    const b = (g.b ?? 0) / 1000, h = (g.h ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    const ax = L / 2;
    const sd = stirrupDiam(c.rebars) / 1000;
    const md = r.diameter / 1000;
    const sx = b / 2 - cover - sd / 2;
    const sy = h / 2 - cover - sd / 2;
    const ix = b / 2 - cover - sd - md / 2;
    const iy = h / 2 - cover - sd - md / 2;
    const LONG = ["TOP","BOTTOM","LONGITUDINAL","ERECTION","BENT","TIE","ADDITIONAL"];
    if (LONG.includes(r.role)) {
      const y = (r.role === "TOP" || r.role === "ERECTION") ? iy : -iy;
      const n = Math.max(2, r.count ?? 2);
      for (let i = 0; i < n; i++) {
        const z = n > 1 ? -ix + (2 * ix * i) / (n - 1) : 0;
        out.push(cylMesh(new THREE.Vector3(-ax, y, z), new THREE.Vector3(ax, y, z), tR, mat));
      }
    } else if (r.role === "STIRRUP") {
      const xs = beamColumnStirrupXs(L, r, true);
      for (const { x: pos, dense } of xs) {
        const x = -ax + pos / 1000;
        out.push(beamStirrupMesh(x, sx, sy, tR,
          rebarMeshMat(dense ? STIRRUP_DENSE_COLOR : STIRRUP_NORM_COLOR)));
      }
    }
  } else if (c.type === "COLUMN") {
    const b = (g.b ?? 0) / 1000, h = (g.h ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    const ay = L / 2;
    const sd = stirrupDiam(c.rebars) / 1000;
    const md = r.diameter / 1000;
    const sx = b / 2 - cover - sd / 2;
    const sz = h / 2 - cover - sd / 2;
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
        out.push(cylMesh(new THREE.Vector3(x, -ay, z), new THREE.Vector3(x, ay, z), tR, mat));
      }
    } else if (r.role === "STIRRUP") {
      const ys = beamColumnStirrupXs(L, r, true);
      for (const { x: pos, dense } of ys) {
        const y = -ay + pos / 1000;
        out.push(colStirrupMesh(y, sx, sz, tR,
          rebarMeshMat(dense ? STIRRUP_DENSE_COLOR : STIRRUP_NORM_COLOR)));
      }
    }
  } else if (c.type === "SLAB") {
    const Lx = (g.Lx ?? 0) / 1000, Ly = (g.Ly ?? 0) / 1000, t = (g.t ?? 0) / 1000;
    const y = r.role === "NEG" || r.role === "CONSTRUCT" || r.role === "STOOL" ? t / 2 - cover : -t / 2 + cover;
    if (r.spacing) {
      const n = Math.max(2, Math.floor((Ly * 1000) / r.spacing) + 1);
      for (let i = 0; i < n; i++) {
        const z = -Ly / 2 + (n > 1 ? (Ly * i) / (n - 1) : 0);
        out.push(cylMesh(new THREE.Vector3(-Lx / 2, y, z), new THREE.Vector3(Lx / 2, y, z), tR, mat));
      }
    }
  } else if (c.type === "PILE") {
    const D = (g.D ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    const rad = D / 2 - cover;
    if (r.role === "MAIN" || r.role === "SONIC") {
      const n = Math.max(4, r.count ?? 6);
      const sMat = r.role === "SONIC" ? rebarMeshMat(0xca8a04) : mat;
      for (let i = 0; i < n; i++) {
        const theta = (2 * Math.PI * i) / n;
        const x = rad * Math.cos(theta), z = rad * Math.sin(theta);
        out.push(cylMesh(new THREE.Vector3(x, -L / 2, z), new THREE.Vector3(x, L / 2, z), tR, sMat));
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
      out.push(spiralTubeMesh(pts, tR, rebarMeshMat(STIRRUP_NORM_COLOR)));
    }
  }

  return out;
}
