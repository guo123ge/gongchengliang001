// 依据 22G101 自动补充默认配筋（阶段 B）
import type { Component, Rebar, SeismicLevel } from "../types";
import { uid } from "../utils";
import {
  beamDensifyZoneLength,
  columnDensifyZoneLength,
  slabNegExtension,
} from "./tables";

function isSeismic(s: SeismicLevel): boolean {
  return s !== "NONE";
}

export function autoFillRebar(c: Component): Component {
  const rebars: Rebar[] = [...c.rebars];
  const has = (role: Rebar["role"]) => rebars.some((r) => r.role === role);
  const s = c.concrete.seismic;
  const g = c.geometry;

  if (c.type === "BEAM") {
    if (!has("TOP")) rebars.push({ id: uid("r"), role: "TOP", grade: "HRB400", diameter: 20, count: 2, label: "2C20" });
    if (!has("BOTTOM")) rebars.push({ id: uid("r"), role: "BOTTOM", grade: "HRB400", diameter: 22, count: 3, label: "3C22" });
    if (!has("STIRRUP")) {
      const dense = isSeismic(s);
      const zoneLen = dense ? beamDensifyZoneLength(s, g.h ?? 600) : 0;
      rebars.push({
        id: uid("r"),
        role: "STIRRUP",
        grade: "HRB400",
        diameter: 8,
        spacing: 200,
        densifySpacing: dense ? 100 : undefined,
        densifyLength: dense ? Math.round(zoneLen) : undefined,
        label: dense ? "C8@100/200(2)" : "C8@200(2)",
      });
    }
  } else if (c.type === "COLUMN") {
    if (!has("MAIN")) rebars.push({ id: uid("r"), role: "MAIN", grade: "HRB400", diameter: 22, count: 8, label: "8C22" });
    if (!has("STIRRUP")) {
      const dense = isSeismic(s);
      const zoneLen = dense ? columnDensifyZoneLength(s, g.b ?? 500, g.h ?? 500, g.L ?? 3600) : 0;
      rebars.push({
        id: uid("r"),
        role: "STIRRUP",
        grade: "HRB400",
        diameter: 8,
        spacing: 200,
        densifySpacing: dense ? 100 : undefined,
        densifyLength: dense ? Math.round(zoneLen) : undefined,
        label: dense ? "C8@100/200" : "C8@200",
      });
    }
  } else if (c.type === "SLAB") {
    if (!has("BOTTOM")) rebars.push({ id: uid("r"), role: "BOTTOM", grade: "HRB400", diameter: 10, spacing: 150, label: "C10@150" });
    if (!has("TOP")) rebars.push({ id: uid("r"), role: "TOP", grade: "HRB400", diameter: 8, spacing: 200, label: "C8@200" });
    if (!has("DIST")) rebars.push({ id: uid("r"), role: "DIST", grade: "HPB300", diameter: 8, spacing: 250, label: "A8@250" });
    if (!has("NEG")) {
      rebars.push({
        id: uid("r"),
        role: "NEG",
        grade: "HRB400",
        diameter: 10,
        spacing: 150,
        extension: slabNegExtension(g.Lx ?? 6000),
        label: "C10@150（支座负筋）",
      });
    }
  } else if (c.type === "PILE") {
    if (!has("MAIN")) rebars.push({ id: uid("r"), role: "MAIN", grade: "HRB400", diameter: 20, count: 8, label: "8C20" });
    if (!has("SPIRAL")) rebars.push({ id: uid("r"), role: "SPIRAL", grade: "HPB300", diameter: 8, spacing: 200, label: "A8@200" });
  }
  return { ...c, rebars };
}
