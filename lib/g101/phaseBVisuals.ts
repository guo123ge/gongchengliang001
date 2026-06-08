import type { Component } from "../types";
import type { CollisionVisual } from "./collision";

function visual(
  id: string,
  componentId: string,
  center: [number, number, number],
  size: [number, number, number],
  color: number,
  label: string,
): CollisionVisual {
  return { id, componentId, center, size, color, opacity: 0.34, label };
}

export function phaseBToVisuals(components: Component[]): CollisionVisual[] {
  const visuals: CollisionVisual[] = [];
  const beams = components.filter((c) => c.type === "BEAM");
  const columns = components.filter((c) => c.type === "COLUMN");
  const tolerance = 600;

  for (const beam of beams) {
    const L = beam.geometry.L ?? 0;
    const h = beam.geometry.h ?? 0;
    if (L <= 0) continue;
    const rot = ((beam.placement.rot ?? 0) * Math.PI) / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const ends = [
      { x: beam.placement.x - (L / 2) * cos, z: beam.placement.z + (L / 2) * sin, tag: "左端" },
      { x: beam.placement.x + (L / 2) * cos, z: beam.placement.z - (L / 2) * sin, tag: "右端" },
    ];

    for (const end of ends) {
      const column = columns.find((c) => Math.hypot(c.placement.x - end.x, c.placement.z - end.z) < tolerance);
      if (!column) continue;
      const columnHeight = column.geometry.L ?? 0;
      const center: [number, number, number] = [
        (end.x + column.placement.x) / 2 / 1000,
        (Math.max(h, columnHeight) / 2 + Math.max(beam.placement.y, column.placement.y)) / 1000,
        (end.z + column.placement.z) / 2 / 1000,
      ];
      visuals.push(visual(
        `phaseB-beam-column-${beam.id}-${column.id}-${end.tag}`,
        column.id,
        center,
        [0.36, 0.36, 0.36],
        0xfbbf24,
        `阶段B：${beam.name}${end.tag} 与 ${column.name} 梁柱节点核心区，复核贯通箍筋加密`,
      ));
    }
  }

  return visuals;
}
