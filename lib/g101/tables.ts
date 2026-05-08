// 22G101 核心参数表（简化提取）
// 单位：系数无量纲；长度以"倍数 × 直径 d"为基础

import type { ConcreteGrade, RebarGrade, SeismicLevel } from "../types";

/** 钢筋单位理论重量 kg/m（GB/T 1499） */
export const REBAR_UNIT_WEIGHT: Record<number, number> = {
  6: 0.222, 8: 0.395, 10: 0.617, 12: 0.888, 14: 1.21, 16: 1.58,
  18: 2.0, 20: 2.47, 22: 2.98, 25: 3.85, 28: 4.83, 32: 6.31, 36: 7.99, 40: 9.87,
};

/** 基本锚固长度 La 系数（倍数 × d）— 表取自 22G101-1 第 59 页（简化，非抗震） */
// key: `${concrete}|${grade}`
export const LA_TABLE: Record<string, number> = {
  // HPB300
  "C20|HPB300": 39, "C25|HPB300": 34, "C30|HPB300": 30,
  "C35|HPB300": 28, "C40|HPB300": 25, "C45|HPB300": 24, "C50|HPB300": 23,
  "C55|HPB300": 22, "C60|HPB300": 21,
  // HRB400
  "C20|HRB400": 46, "C25|HRB400": 40, "C30|HRB400": 35,
  "C35|HRB400": 32, "C40|HRB400": 29, "C45|HRB400": 28, "C50|HRB400": 27,
  "C55|HRB400": 26, "C60|HRB400": 25, "C65|HRB400": 24, "C70|HRB400": 24, "C75|HRB400": 23, "C80|HRB400": 22,
  // HRB500
  "C20|HRB500": 55, "C25|HRB500": 48, "C30|HRB500": 43,
  "C35|HRB500": 39, "C40|HRB500": 36, "C45|HRB500": 34, "C50|HRB500": 32,
  "C55|HRB500": 31, "C60|HRB500": 30, "C65|HRB500": 29, "C70|HRB500": 28, "C75|HRB500": 27, "C80|HRB500": 26,
};

/** 抗震系数 ζaE：一/二级 1.15，三级 1.05，四级 & 非抗震 1.0 */
export function seismicFactor(s: SeismicLevel): number {
  if (s === "ONE" || s === "TWO") return 1.15;
  if (s === "THREE") return 1.05;
  return 1.0;
}

/** 搭接长度修正系数 ζl（按搭接百分率 25% 取 1.2） */
export const LAP_FACTOR = 1.2;

/** 计算 La（基本锚固长度，mm） */
export function La(concrete: ConcreteGrade, grade: RebarGrade, d: number): number {
  const k = LA_TABLE[`${concrete}|${grade}`];
  if (!k) return 40 * d; // 兜底
  return k * d;
}

/** 计算 LaE（抗震锚固长度，mm） */
export function LaE(concrete: ConcreteGrade, grade: RebarGrade, d: number, s: SeismicLevel): number {
  return La(concrete, grade, d) * seismicFactor(s);
}

/** 搭接长度 Ll / LlE */
export function Ll(concrete: ConcreteGrade, grade: RebarGrade, d: number): number {
  return La(concrete, grade, d) * LAP_FACTOR;
}
export function LlE(concrete: ConcreteGrade, grade: RebarGrade, d: number, s: SeismicLevel): number {
  return LaE(concrete, grade, d, s) * LAP_FACTOR;
}

/** 最小保护层（mm，梁柱）— 简化 */
export const MIN_COVER: Record<string, number> = {
  Ia: 20, Ib: 25, IIa: 25, IIb: 35, IIIa: 40, IIIb: 50,
};

/** 梁纵筋最小配筋率 ρmin（简化取 0.2% 或 45ft/fy 较大值，此处以百分数返回） */
export function minRhoBeam(concrete: ConcreteGrade, grade: RebarGrade): number {
  // 经验简化：HRB400 + C30 取 0.25%
  return 0.25;
}

/** 柱全部纵筋最小配筋率（%）— 22G101 表，简化 */
export function minRhoColumn(seismic: SeismicLevel): number {
  switch (seismic) {
    case "ONE": return 1.0;
    case "TWO": return 0.8;
    case "THREE": return 0.7;
    case "FOUR": return 0.6;
    default: return 0.5;
  }
}

/** 梁箍筋加密区最大间距（mm），抗震等级相关，简化 */
export function beamStirrupMaxSpacingDense(s: SeismicLevel, d: number): number {
  // 一级: min(h/4, 6d, 100)；二~四级: min(h/4, 8d, 100)；非抗震: 不强制
  if (s === "ONE") return Math.min(6 * d, 100);
  if (s === "TWO" || s === "THREE" || s === "FOUR") return Math.min(8 * d, 100);
  return 200;
}

/** 柱箍筋加密区最大间距 */
export function columnStirrupMaxSpacingDense(s: SeismicLevel, d: number): number {
  if (s === "ONE") return Math.min(6 * d, 100);
  if (s === "TWO") return Math.min(8 * d, 100);
  if (s === "THREE" || s === "FOUR") return Math.min(8 * d, 150);
  return 200;
}

/** 梁箍筋非加密区最大间距（mm，简化） */
export function beamStirrupMaxSpacingNormal(s: SeismicLevel, d: number): number {
  if (s === "ONE") return Math.min(2 * (Math.min(8 * d, 100)), 200);
  if (s === "TWO" || s === "THREE" || s === "FOUR") return Math.min(2 * (Math.min(8 * d, 100)), 200);
  return 250;
}

/** 柱箍筋非加密区最大间距（mm，简化） */
export function columnStirrupMaxSpacingNormal(s: SeismicLevel, d: number): number {
  if (s === "ONE" || s === "TWO") return Math.min(15 * d, 200);
  if (s === "THREE" || s === "FOUR") return Math.min(15 * d, 250);
  return 300;
}

/** 梁箍筋加密区长度（mm，每端）—22G101：一级取 max(2hb, 500)，二~四级取 max(1.5hb, 500) */
export function beamDensifyZoneLength(s: SeismicLevel, h: number): number {
  if (s === "NONE") return 0;
  if (s === "ONE") return Math.max(2 * h, 500);
  return Math.max(1.5 * h, 500);
}

/** 柱端箍筋加密区长度（mm，每端）= max(柱长边/6, 较大边, 500) */
export function columnDensifyZoneLength(s: SeismicLevel, b: number, h: number, L: number): number {
  if (s === "NONE") return 0;
  return Math.max(L / 6, Math.max(b, h), 500);
}

/** 板分布筋最大间距 */
export const SLAB_DIST_MAX_SPACING = 250;

/** 板支座负筋外伸长度（mm，单跨简化）≥ Lx/4 */
export function slabNegExtension(Lx: number): number {
  return Math.round(Lx / 4);
}

/** 纵筋最大间距（梁） */
export const BEAM_LONG_MAX_SPACING = 200;
