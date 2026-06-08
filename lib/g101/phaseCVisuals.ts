import type { Component } from "../types";
import type { CollisionVisual } from "./collision";

function localToWorld(c: Component, x = 0, y = 0, z = 0): [number, number, number] {
  const rot = ((c.placement.rot ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return [
    (c.placement.x + x * cos - z * sin) / 1000,
    (c.placement.y + y) / 1000,
    (c.placement.z + x * sin + z * cos) / 1000,
  ];
}

function componentCenter(c: Component, yOffset = 0): [number, number, number] {
  const g = c.geometry;
  const h =
    c.type === "COLUMN" || c.type === "PILE" ? (g.L ?? 0) :
    c.type === "SLAB" || c.type === "FOUND" || c.type === "PILE_CAP" || c.type === "RAFT" ? (g.t ?? 0) :
    (g.h ?? g.t ?? 0);
  return localToWorld(c, 0, h / 2 + yOffset, 0);
}

function visual(id: string, componentId: string, center: [number, number, number], size: [number, number, number], color: number, label: string): CollisionVisual {
  return { id, componentId, center, size, color, opacity: 0.38, label };
}

export function phaseCToVisuals(components: Component[]): CollisionVisual[] {
  const visuals: CollisionVisual[] = [];

  for (const c of components) {
    for (const [index, opening] of (c.geometry.openings ?? []).entries()) {
      const name = opening.id || `洞口${index + 1}`;
      const invalid = opening.width <= 0 || opening.height <= 0;
      const needsReinforcement = (opening.width >= 300 || opening.height >= 300) && !opening.reinforced;
      const color = invalid ? 0xef4444 : needsReinforcement ? 0xf59e0b : 0x22c55e;
      const label = invalid
        ? `阶段C：${c.name} ${name} 尺寸无效`
        : needsReinforcement
          ? `阶段C：${c.name} ${name} 建议配置洞口加强`
          : `阶段C：${c.name} ${name} 已配置洞口加强`;
      const center = localToWorld(c, opening.x, opening.y ?? 0, opening.z ?? 0);
      const size: [number, number, number] =
        c.type === "SLAB" || c.type === "FOUND" || c.type === "PILE_CAP" || c.type === "RAFT"
          ? [Math.max(opening.width / 1000, 0.08), 0.04, Math.max(opening.height / 1000, 0.08)]
          : [Math.max(opening.width / 1000, 0.08), Math.max(opening.height / 1000, 0.08), 0.04];
      visuals.push(visual(`phaseC-opening-${c.id}-${index}`, c.id, center, size, color, label));
    }

    const variableSection = c.geometry.variableSection;
    if (variableSection?.enabled) {
      const fromB = variableSection.fromB ?? c.geometry.b ?? 0;
      const fromH = variableSection.fromH ?? c.geometry.h ?? 0;
      const toB = variableSection.toB ?? fromB;
      const toH = variableSection.toH ?? fromH;
      const delta = Math.max(Math.abs(fromB - toB), Math.abs(fromH - toH));
      const transitionLength = variableSection.transitionLength ?? 0;
      const color = delta <= 0 || transitionLength <= 0 ? 0xf59e0b : 0x38bdf8;
      visuals.push(visual(
        `phaseC-variable-${c.id}`,
        c.id,
        componentCenter(c, 250),
        [0.32, 0.32, 0.32],
        color,
        delta <= 0
          ? `阶段C：${c.name} 变截面未录入变化尺寸`
          : `阶段C：${c.name} 变截面 ${delta}mm，过渡段 ${transitionLength}mm`,
      ));
    }

    const node = c.geometry.specialSeismicNode;
    if (node?.enabled) {
      const hoopDiameter = node.hoopDiameter ?? 0;
      const hoopSpacing = node.hoopSpacing ?? 0;
      const color = c.concrete.seismic === "NONE" || hoopDiameter < 8 || hoopSpacing > 100 || hoopSpacing <= 0 ? 0xef4444 : 0x22c55e;
      visuals.push(visual(
        `phaseC-node-${c.id}`,
        c.id,
        componentCenter(c, 520),
        [0.24, 0.42, 0.24],
        color,
        `阶段C：${c.name} 特殊抗震节点 ${hoopDiameter || "未填"}mm@${hoopSpacing || "未填"}mm`,
      ));
    }
  }

  return visuals;
}
