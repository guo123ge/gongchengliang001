// 22G101 构件碰撞检测与钢筋冲突检查引擎
// 依据 22G101-1/2/3 的构造详图规则

import type { Component, ValidationItem } from "../types";
import { beamLongBarMaxSpacing, columnLongBarMinSpacing } from "./tables";

// ========== 几何工具 ==========

/** 构件在世界坐标系中的轴对齐包围盒（单位：mm） */
interface AABB {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

/** 计算构件的 AABB（考虑放置位置和旋转） */
function getAABB(c: Component): AABB {
  const g = c.geometry;
  const p = c.placement;
  const rot = ((p.rot ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rot), sin = Math.sin(rot);

  let localPoints: { x: number; y: number; z: number }[] = [];

  if (c.type === "BEAM") {
    const L = g.L ?? 0, h = g.h ?? 0, b = g.b ?? 0;
    localPoints = [
      { x: -L / 2, y: -h / 2, z: -b / 2 }, { x: L / 2, y: -h / 2, z: -b / 2 },
      { x: -L / 2, y: h / 2, z: -b / 2 }, { x: L / 2, y: h / 2, z: -b / 2 },
      { x: -L / 2, y: -h / 2, z: b / 2 }, { x: L / 2, y: -h / 2, z: b / 2 },
      { x: -L / 2, y: h / 2, z: b / 2 }, { x: L / 2, y: h / 2, z: b / 2 },
    ];
  } else if (c.type === "COLUMN") {
    const L = g.L ?? 0, b = g.b ?? 0, h = g.h ?? 0;
    localPoints = [
      { x: -b / 2, y: -L / 2, z: -h / 2 }, { x: b / 2, y: -L / 2, z: -h / 2 },
      { x: -b / 2, y: L / 2, z: -h / 2 }, { x: b / 2, y: L / 2, z: -h / 2 },
      { x: -b / 2, y: -L / 2, z: h / 2 }, { x: b / 2, y: -L / 2, z: h / 2 },
      { x: -b / 2, y: L / 2, z: h / 2 }, { x: b / 2, y: L / 2, z: h / 2 },
    ];
  } else if (c.type === "SLAB") {
    const Lx = g.Lx ?? 0, Ly = g.Ly ?? 0, t = g.t ?? 0;
    localPoints = [
      { x: -Lx / 2, y: -t / 2, z: -Ly / 2 }, { x: Lx / 2, y: -t / 2, z: -Ly / 2 },
      { x: -Lx / 2, y: t / 2, z: -Ly / 2 }, { x: Lx / 2, y: t / 2, z: -Ly / 2 },
      { x: -Lx / 2, y: -t / 2, z: Ly / 2 }, { x: Lx / 2, y: -t / 2, z: Ly / 2 },
      { x: -Lx / 2, y: t / 2, z: Ly / 2 }, { x: Lx / 2, y: t / 2, z: Ly / 2 },
    ];
  } else if (c.type === "PILE") {
    const D = g.D ?? 0, L = g.L ?? 0;
    localPoints = [
      { x: -D / 2, y: -L / 2, z: -D / 2 }, { x: D / 2, y: -L / 2, z: -D / 2 },
      { x: -D / 2, y: L / 2, z: -D / 2 }, { x: D / 2, y: L / 2, z: -D / 2 },
      { x: -D / 2, y: -L / 2, z: D / 2 }, { x: D / 2, y: -L / 2, z: D / 2 },
      { x: -D / 2, y: L / 2, z: D / 2 }, { x: D / 2, y: L / 2, z: D / 2 },
    ];
  }

  // 旋转 + 平移到世界坐标
  const worldPoints = localPoints.map((pt) => ({
    x: p.x + pt.x * cos - pt.z * sin,
    y: p.y + pt.y,
    z: p.z + pt.x * sin + pt.z * cos,
  }));

  return {
    minX: Math.min(...worldPoints.map((p) => p.x)),
    maxX: Math.max(...worldPoints.map((p) => p.x)),
    minY: Math.min(...worldPoints.map((p) => p.y)),
    maxY: Math.max(...worldPoints.map((p) => p.y)),
    minZ: Math.min(...worldPoints.map((p) => p.z)),
    maxZ: Math.max(...worldPoints.map((p) => p.z)),
  };
}

/** 判断两个 AABB 是否相交 */
function aabbIntersect(a: AABB, b: AABB): boolean {
  return (
    a.minX < b.maxX && a.maxX > b.minX &&
    a.minY < b.maxY && a.maxY > b.minY &&
    a.minZ < b.maxZ && a.maxZ > b.minZ
  );
}

/** 计算两个 AABB 的相交体积（近似） */
function aabbOverlapVolume(a: AABB, b: AABB): number {
  const dx = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const dy = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
  const dz = Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ));
  return dx * dy * dz;
}

// ========== 碰撞类型判定 ==========

export interface CollisionResult {
  id: string;                     // 碰撞对唯一标识 a#b
  typeA: string; nameA: string; idA: string;
  typeB: string; nameB: string; idB: string;
  overlapVolume: number;          // mm³
  overlapAABB: AABB;               // 相交区域的AABB
  category: "beam-column" | "beam-beam" | "column-column" | "slab-beam" | "slab-column" | "pile-cap" | "other";
  severity: "error" | "warn" | "info";
  message: string;
  g101Rule: string;                // 对应22G101条文
  suggestions: string[];           // 调整建议
}

type RuleSeverity = "error" | "warn" | "info";

/** 判断碰撞类别 */
function classifyCollision(a: Component, b: Component): CollisionResult["category"] {
  const types = [a.type, b.type].sort();
  if (types[0] === "BEAM" && types[1] === "COLUMN") return "beam-column";
  if (types[0] === "BEAM" && types[1] === "BEAM") return "beam-beam";
  if (types[0] === "COLUMN" && types[1] === "COLUMN") return "column-column";
  if (types[0] === "BEAM" && types[1] === "SLAB") return "slab-beam";
  if (types[0] === "COLUMN" && types[1] === "SLAB") return "slab-column";
  if (types[0] === "PILE" && (types[1] === "COLUMN" || types[1] === "SLAB")) return "pile-cap";
  return "other";
}

// ========== 22G101 构造规则检查 ==========

/** 检查梁-柱节点核心区钢筋冲突 — 22G101-1 第2-9~2-18页 */
function checkBeamColumnNode(beam: Component, col: Component, overlap: AABB): { severity: RuleSeverity; message: string; suggestions: string[] } {
  const bGeo = beam.geometry;
  const cGeo = col.geometry;
  const coverB = beam.concrete.cover;
  const coverC = col.concrete.cover;

  const bWidth = bGeo.b ?? 0;
  const cWidth = Math.min(cGeo.b ?? 0, cGeo.h ?? 0);

  const suggestions: string[] = [];

  // 1. 检查梁宽是否小于柱宽（22G101-1 第2-44页：框架扁梁节点要求）
  if (bWidth < cWidth) {
    suggestions.push(`梁宽(${bWidth}mm) < 柱宽(${cWidth}mm)，梁纵筋应直锚入柱内，锚固长度 ≥ laE`);
  }

  // 2. 检查核心区箍筋设置（22G101-1 第2-11页）
  const colStirrup = col.rebars.find((r) => r.role === "STIRRUP");
  if (!colStirrup?.densifyLength || colStirrup.densifyLength < 300) {
    suggestions.push("节点核心区应按柱端加密区配置箍筋，加密区长度不小于 max(Hn/6, hc, 500)");
  }

  // 3. 检查保护层差异
  if (Math.abs(coverB - coverC) > 10) {
    suggestions.push(`梁保护层(${coverB}mm)与柱保护层(${coverC}mm)差异较大，节点核心区应按较大值统一`);
  }

  return {
    severity: suggestions.length > 0 ? "warn" : "info",
    message: `梁柱节点核心区：${beam.name} 与 ${col.name} 相交，需按 22G101-1 第2-9~2-18页构造处理`,
    suggestions,
  };
}

/** 检查梁-梁交叉 — 22G101-1 第2-49页（井字梁） */
function checkBeamBeamCross(a: Component, b: Component, overlap: AABB): { severity: RuleSeverity; message: string; suggestions: string[] } {
  const aGeo = a.geometry;
  const bGeo = b.geometry;
  const aH = aGeo.h ?? 0;
  const bH = bGeo.h ?? 0;

  const suggestions: string[] = [];

  // 1. 检查高度是否相同（若相同则钢筋必定冲突）
  if (Math.abs(aH - bH) < 20) {
    suggestions.push("两梁高度相近，交叉处应上下错开布置：短跨梁钢筋在上，长跨梁钢筋在下");
  }

  // 2. 检查梁底是否齐平（若齐平则混凝土冲突）
  const aBottom = a.placement.y - aH / 2;
  const bBottom = b.placement.y - bH / 2;
  if (Math.abs(aBottom - bBottom) < 10) {
    suggestions.push("两梁底面齐平，交叉处应设置腋部加高或调整梁高差 ≥ 50mm");
  }

  return {
    severity: suggestions.length > 0 ? "warn" : "info",
    message: `梁-梁交叉：${a.name} 与 ${b.name} 在平面交叉，需按 22G101-1 第2-49页井字梁构造处理`,
    suggestions,
  };
}

/** 检查柱-柱邻接 — 22G101-1 第2-16页（柱变截面） */
function checkColumnColumn(a: Component, b: Component, overlap: AABB): { severity: RuleSeverity; message: string; suggestions: string[] } {
  const suggestions: string[] = [];

  // 检查柱纵筋间距是否满足要求
  const aMains = a.rebars.filter((r) => r.role === "MAIN");
  const bMains = b.rebars.filter((r) => r.role === "MAIN");

  for (const r of aMains) {
    if (r.count && r.count > 1) {
      const spacing = Math.min(a.geometry.b ?? 0, a.geometry.h ?? 0) / (r.count - 1);
      const minSp = columnLongBarMinSpacing(r.diameter, true);
      if (spacing < minSp) {
        suggestions.push(`${a.name} 纵筋间距 ${spacing.toFixed(0)}mm < ${minSp}mm，需调整根数或截面尺寸`);
      }
    }
  }

  return {
    severity: suggestions.length > 0 ? "error" : "warn",
    message: `柱-柱重叠：${a.name} 与 ${b.name} 空间位置重叠，需按 22G101-1 第2-16页柱变截面构造处理`,
    suggestions: suggestions.length > 0 ? suggestions : ["检查柱纵筋连接位置是否错开，避免同一截面全部连接"],
  };
}

/** 检查板-梁/柱支座 — 22G101-1 第2-50页 */
function checkSlabSupport(slab: Component, support: Component, overlap: AABB): { severity: RuleSeverity; message: string; suggestions: string[] } {
  const suggestions: string[] = [];
  const slabTop = slab.placement.y + (slab.geometry.t ?? 0) / 2;
  const supportTop = support.placement.y + (support.geometry.h ?? 0) / 2;

  // 检查板是否搁置在支座上方
  if (slabTop < supportTop - 10) {
    suggestions.push("板顶低于支座顶面，板负筋锚固长度可能不足，需校核 la");
  }

  // 检查板厚是否满足支座宽度要求
  const supportWidth = support.type === "BEAM" ? (support.geometry.b ?? 0) : Math.min(support.geometry.b ?? 0, support.geometry.h ?? 0);
  if (supportWidth < 150) {
    suggestions.push(`支座宽度 ${supportWidth}mm 较小，板下部纵筋直锚长度可能不足，建议弯锚`);
  }

  return {
    severity: suggestions.length > 0 ? "warn" : "info",
    message: `板支座：${slab.name} 搁置在 ${support.name} 上，需按 22G101-1 第2-50页构造处理`,
    suggestions,
  };
}

// ========== 主检测入口 ==========

/** 检测所有构件之间的碰撞与钢筋冲突 */
export function detectCollisions(components: Component[]): CollisionResult[] {
  const results: CollisionResult[] = [];
  const aabbs = new Map<string, AABB>();

  // 预计算所有 AABB
  for (const c of components) {
    aabbs.set(c.id, getAABB(c));
  }

  // 两两检测
  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const a = components[i];
      const b = components[j];
      const aabbA = aabbs.get(a.id)!;
      const aabbB = aabbs.get(b.id)!;

      if (!aabbIntersect(aabbA, aabbB)) continue;

      const overlapVol = aabbOverlapVolume(aabbA, aabbB);
      if (overlapVol < 1) continue; // 忽略微小相交

      const category = classifyCollision(a, b);

      // 计算相交区域AABB
      const overlapAABB: AABB = {
        minX: Math.max(aabbA.minX, aabbB.minX),
        maxX: Math.min(aabbA.maxX, aabbB.maxX),
        minY: Math.max(aabbA.minY, aabbB.minY),
        maxY: Math.min(aabbA.maxY, aabbB.maxY),
        minZ: Math.max(aabbA.minZ, aabbB.minZ),
        maxZ: Math.min(aabbA.maxZ, aabbB.maxZ),
      };

      // 根据类型应用22G101规则
      let ruleResult: { severity: RuleSeverity; message: string; suggestions: string[] } = {
        severity: "info", message: "", suggestions: [],
      };

      switch (category) {
        case "beam-column": {
          const beam = a.type === "BEAM" ? a : b;
          const col = a.type === "COLUMN" ? a : b;
          ruleResult = checkBeamColumnNode(beam, col, overlapAABB);
          break;
        }
        case "beam-beam":
          ruleResult = checkBeamBeamCross(a, b, overlapAABB);
          break;
        case "column-column":
          ruleResult = checkColumnColumn(a, b, overlapAABB);
          break;
        case "slab-beam":
        case "slab-column": {
          const slab = a.type === "SLAB" ? a : b;
          const support = a.type === "SLAB" ? b : a;
          ruleResult = checkSlabSupport(slab, support, overlapAABB);
          break;
        }
        default:
          ruleResult = {
            severity: "warn",
            message: `${a.name}(${a.type}) 与 ${b.name}(${b.type}) 空间重叠`,
            suggestions: ["检查构件定位，避免非预期的空间冲突"],
          };
      }

      results.push({
        id: `${a.id}#${b.id}`,
        typeA: a.type, nameA: a.name, idA: a.id,
        typeB: b.type, nameB: b.name, idB: b.id,
        overlapVolume: overlapVol,
        overlapAABB,
        category,
        severity: ruleResult.severity,
        message: ruleResult.message,
        g101Rule: category === "beam-column" ? "22G101-1 第2-9~2-18页" :
                  category === "beam-beam" ? "22G101-1 第2-49页" :
                  category === "column-column" ? "22G101-1 第2-16页" :
                  category === "slab-beam" || category === "slab-column" ? "22G101-1 第2-50页" : "",
        suggestions: ruleResult.suggestions,
      });
    }
  }

  return results;
}

/** 将碰撞结果转换为 ValidationItem（用于校验面板） */
export function collisionsToValidations(collisions: CollisionResult[]): ValidationItem[] {
  return collisions.map((c) => ({
    componentId: c.idA,
    rule: `碰撞检测：${c.category === "beam-column" ? "梁柱节点" : c.category === "beam-beam" ? "梁梁交叉" : c.category === "column-column" ? "柱柱重叠" : c.category === "slab-beam" ? "板梁支座" : c.category === "slab-column" ? "板柱支座" : "构件重叠"}`,
    severity: (c.severity === "info" ? "pass" : c.severity) as "pass" | "warn" | "error",
    message: `${c.message}${c.suggestions.length > 0 ? "；建议：" + c.suggestions.join("；") : ""}`,
  }));
}

/** 将碰撞结果转换为 THREE.js 可视化数据 */
export interface CollisionVisual {
  id: string;
  center: [number, number, number]; // 米
  size: [number, number, number]; // 米
  color: number;
  opacity: number;
  label: string;
}

export function collisionsToVisuals(collisions: CollisionResult[]): CollisionVisual[] {
  return collisions
    .filter((c) => c.severity !== "info")
    .map((c) => {
      const aabb = c.overlapAABB;
      const cx = (aabb.minX + aabb.maxX) / 2 / 1000;
      const cy = (aabb.minY + aabb.maxY) / 2 / 1000;
      const cz = (aabb.minZ + aabb.maxZ) / 2 / 1000;
      const sx = (aabb.maxX - aabb.minX) / 1000;
      const sy = (aabb.maxY - aabb.minY) / 1000;
      const sz = (aabb.maxZ - aabb.minZ) / 1000;
      return {
        id: c.id,
        center: [cx, cy, cz],
        size: [Math.max(sx, 0.01), Math.max(sy, 0.01), Math.max(sz, 0.01)],
        color: c.severity === "error" ? 0xef4444 : 0xf59e0b,
        opacity: 0.35,
        label: c.message,
      };
    });
}
