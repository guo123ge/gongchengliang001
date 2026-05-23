// 依据 22G101 自动补充默认配筋（阶段 B）
import type { Component, Rebar, SeismicLevel } from "../types";
import { uid } from "../utils";
import {
  beamDensifyZoneLength,
  columnDensifyZoneLength,
  pileDensifyZoneLength,
  slabNegExtension,
  needSideRebar,
  minSideRebarArea,
  stirrupHookLength,
  pileEmbedDepth,
} from "./tables";

function isSeismic(s: SeismicLevel): boolean {
  return s !== "NONE";
}

/** 选择侧面构造钢筋直径（mm）— 常用12mm */
function sideRebarDiameter(): number {
  return 12;
}

/** 计算侧面构造钢筋根数 — 每侧间距≤200mm */
function sideRebarCount(hw: number): number {
  return Math.max(2, Math.ceil(hw / 200));
}

/** 根据柱截面大小确定主筋根数 */
function columnMainCount(b: number, h: number): number {
  const area = b * h;
  if (area <= 300 * 300) return 4;
  if (area <= 400 * 400) return 6;
  if (area <= 500 * 500) return 8;
  if (area <= 600 * 600) return 10;
  return 12;
}

export function autoFillRebar(c: Component): Component {
  const rebars: Rebar[] = [...c.rebars];
  const has = (role: Rebar["role"]) => rebars.some((r) => r.role === role);
  const s = c.concrete.seismic;
  const g = c.geometry;
  const cover = c.concrete.cover;

  if (c.type === "BEAM") {
    const b = g.b ?? 300;
    const h = g.h ?? 600;
    if (!has("TOP")) rebars.push({ id: uid("r"), role: "TOP", grade: "HRB400", diameter: 20, count: 2, label: "2C20" });
    if (!has("BOTTOM")) rebars.push({ id: uid("r"), role: "BOTTOM", grade: "HRB400", diameter: 22, count: 3, label: "3C22" });

    // 梁侧面构造钢筋 — 22G101-1 第2-41页
    const topDia = rebars.find((r) => r.role === "TOP")?.diameter ?? 20;
    if (needSideRebar(h, cover, topDia)) {
      if (!has("SIDE") && !has("LONGITUDINAL")) {
        const hw = h - cover - topDia;
        const minArea = minSideRebarArea(b, h, cover, topDia);
        const dia = sideRebarDiameter();
        const perArea = Math.PI * (dia / 2) ** 2;
        const countPerSide = Math.max(2, Math.ceil(minArea / 2 / perArea));
        const totalCount = countPerSide * 2;
        rebars.push({
          id: uid("r"),
          role: "SIDE",
          grade: "HRB400",
          diameter: dia,
          count: totalCount,
          label: `${totalCount}C${dia}（侧面构造筋，每侧${countPerSide}根）`,
        });
      }
    }

    if (!has("STIRRUP")) {
      const dense = isSeismic(s);
      const zoneLen = dense ? beamDensifyZoneLength(s, h) : 0;
      // 箍筋弯钩长度估算（抗震135°弯钩）
      const hookLen = stirrupHookLength(8, isSeismic(s));
      rebars.push({
        id: uid("r"),
        role: "STIRRUP",
        grade: "HRB400",
        diameter: 8,
        spacing: 200,
        densifySpacing: dense ? 100 : undefined,
        densifyLength: dense ? Math.round(zoneLen) : undefined,
        label: dense ? `C8@100/200(2)` : `C8@200(2)`,
      });
    }
  } else if (c.type === "COLUMN") {
    const b = g.b ?? 500;
    const h = g.h ?? 500;
    if (!has("MAIN")) {
      const count = columnMainCount(b, h);
      rebars.push({ id: uid("r"), role: "MAIN", grade: "HRB400", diameter: 22, count, label: `${count}C22` });
    }
    if (!has("STIRRUP")) {
      const dense = isSeismic(s);
      const zoneLen = dense ? columnDensifyZoneLength(s, b, h, g.L ?? 3600) : 0;
      rebars.push({
        id: uid("r"),
        role: "STIRRUP",
        grade: "HRB400",
        diameter: 8,
        spacing: 200,
        densifySpacing: dense ? 100 : undefined,
        densifyLength: dense ? Math.round(zoneLen) : undefined,
        label: dense ? `C8@100/200` : `C8@200`,
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
  } else if (c.type === "SHEAR_WALL") {
    // 剪力墙 — 22G101-1 第4章：水平、竖向分布筋 + 拉筋
    if (!has("HORIZONTAL"))
      rebars.push({ id: uid("r"), role: "HORIZONTAL", grade: "HRB400", diameter: 10, spacing: 200, label: "C10@200（水平分布筋）" });
    if (!has("VERTICAL"))
      rebars.push({ id: uid("r"), role: "VERTICAL", grade: "HRB400", diameter: 10, spacing: 200, label: "C10@200（竖向分布筋）" });
    if (!has("TIE"))
      rebars.push({ id: uid("r"), role: "TIE", grade: "HPB300", diameter: 6, spacing: 600, label: "A6@600（拉筋）" });

  } else if (c.type === "STAIR") {
    // 楼梯 AT型 — 22G101-2：纵向受力筋 + 分布筋
    if (!has("LONGITUDINAL"))
      rebars.push({ id: uid("r"), role: "LONGITUDINAL", grade: "HRB400", diameter: 12, spacing: 150, label: "C12@150（纵向受力筋）" });
    if (!has("DIST"))
      rebars.push({ id: uid("r"), role: "DIST", grade: "HPB300", diameter: 8, spacing: 250, label: "A8@250（分布筋）" });

  } else if (c.type === "FOUND") {
    // 独立基础 DJ — 22G101-3：双向底筋
    if (!has("BOT_X"))
      rebars.push({ id: uid("r"), role: "BOT_X", grade: "HRB400", diameter: 14, spacing: 150, label: "C14@150（底板X向筋）" });
    if (!has("BOT_Y"))
      rebars.push({ id: uid("r"), role: "BOT_Y", grade: "HRB400", diameter: 14, spacing: 150, label: "C14@150（底板Y向筋）" });

  } else if (c.type === "STRIP_FOUND") {
    // 条形基础 TJ — 22G101-3：横向受力筋 + 纵向构造筋
    if (!has("TRANSVERSE"))
      rebars.push({ id: uid("r"), role: "TRANSVERSE", grade: "HRB400", diameter: 12, spacing: 150, label: "C12@150（横向受力筋）" });
    if (!has("LONGITUDINAL"))
      rebars.push({ id: uid("r"), role: "LONGITUDINAL", grade: "HRB400", diameter: 12, count: 3, label: "3C12（纵向构造筋）" });

  } else if (c.type === "PILE_CAP") {
    // 桩基承台 CT — 22G101-3：双向底筋
    if (!has("BOT_X"))
      rebars.push({ id: uid("r"), role: "BOT_X", grade: "HRB400", diameter: 16, spacing: 150, label: "C16@150（X向底筋）" });
    if (!has("BOT_Y"))
      rebars.push({ id: uid("r"), role: "BOT_Y", grade: "HRB400", diameter: 16, spacing: 150, label: "C16@150（Y向底筋）" });
    if (!has("TIE"))
      rebars.push({ id: uid("r"), role: "TIE", grade: "HRB400", diameter: 10, spacing: 200, label: "C10@200（拉筋）" });

  } else if (c.type === "RAFT") {
    // 筏板基础 FB — 22G101-3：双向上下钢筋网
    if (!has("BOT_X"))
      rebars.push({ id: uid("r"), role: "BOT_X", grade: "HRB400", diameter: 16, spacing: 150, label: "C16@150（底板X向筋）" });
    if (!has("BOT_Y"))
      rebars.push({ id: uid("r"), role: "BOT_Y", grade: "HRB400", diameter: 16, spacing: 150, label: "C16@150（底板Y向筋）" });
    if (!has("TOP_X"))
      rebars.push({ id: uid("r"), role: "TOP_X", grade: "HRB400", diameter: 14, spacing: 200, label: "C14@200（顶板X向筋）" });
    if (!has("TOP_Y"))
      rebars.push({ id: uid("r"), role: "TOP_Y", grade: "HRB400", diameter: 14, spacing: 200, label: "C14@200（顶板Y向筋）" });
    if (!has("TIE"))
      rebars.push({ id: uid("r"), role: "TIE", grade: "HPB300", diameter: 10, spacing: 600, label: "A10@600（拉筋）" });

  } else if (c.type === "PILE") {
    const D = g.D ?? 800;
    const L = g.L ?? 12000;
    if (!has("MAIN")) {
      // 桩主筋：直径<800mm宜6根，≥800mm宜8根 — JGJ 94
      const count = D < 800 ? 6 : 8;
      rebars.push({ id: uid("r"), role: "MAIN", grade: "HRB400", diameter: 20, count, label: `${count}C20` });
    }
    if (!has("SPIRAL")) {
      // 桩顶加密区5D — 22G101-3 第6.2.2条
      const zoneLen = pileDensifyZoneLength(D);
      rebars.push({
        id: uid("r"),
        role: "SPIRAL",
        grade: "HPB300",
        diameter: 8,
        spacing: 200,
        densifySpacing: 100,
        densifyLength: Math.round(zoneLen),
        label: `A8@100/200（桩顶加密${Math.round(zoneLen)}mm）`,
      });
    }
    // 加劲箍 — 22G101-3 第6.2.2条：钢筋笼长度超过4m时，每隔2m设一道直径12mm焊接加劲箍
    if (!has("STIFFEN") && L > 4000) {
      const count = Math.floor((L - 1) / 2000);
      rebars.push({
        id: uid("r"),
        role: "STIFFEN",
        grade: "HPB300",
        diameter: 12,
        count,
        label: `${count}A12（焊接加劲箍，间距2m）`,
      });
    }
  }
  return { ...c, rebars };
}
