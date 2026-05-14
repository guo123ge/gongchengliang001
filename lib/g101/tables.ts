// 22G101 核心参数表（依据 22G101-1 / 22G101-3 提取）
// 单位：系数无量纲；长度以"倍数 × 直径 d"为基础

import type { ConcreteGrade, RebarGrade, SeismicLevel, EnvClass } from "../types";

/** 钢筋单位理论重量 kg/m（GB/T 1499.1） */
export const REBAR_UNIT_WEIGHT: Record<number, number> = {
  6: 0.222, 8: 0.395, 10: 0.617, 12: 0.888, 14: 1.21, 16: 1.58,
  18: 2.0, 20: 2.47, 22: 2.98, 25: 3.85, 28: 4.83, 32: 6.31, 36: 7.99, 40: 9.87,
};

/** 受拉钢筋基本锚固长度 lab 系数（倍数 × d）— 22G101-1 第2-2页（非抗震） */
// key: `${concrete}|${grade}`
export const LAB_TABLE: Record<string, number> = {
  // HPB300
  "C20|HPB300": 42, "C25|HPB300": 34, "C30|HPB300": 30,
  "C35|HPB300": 28, "C40|HPB300": 25, "C45|HPB300": 24, "C50|HPB300": 23,
  "C55|HPB300": 22, "C60|HPB300": 21, "C65|HPB300": 21, "C70|HPB300": 21, "C75|HPB300": 21, "C80|HPB300": 21,
  // HRB400 / HRBF400 / RRB400
  "C20|HRB400": 45, "C25|HRB400": 40, "C30|HRB400": 35,
  "C35|HRB400": 32, "C40|HRB400": 29, "C45|HRB400": 28, "C50|HRB400": 27,
  "C55|HRB400": 26, "C60|HRB400": 25, "C65|HRB400": 25, "C70|HRB400": 25, "C75|HRB400": 25, "C80|HRB400": 25,
  // HRB500 / HRBF500
  "C20|HRB500": 54, "C25|HRB500": 48, "C30|HRB500": 43,
  "C35|HRB500": 39, "C40|HRB500": 36, "C45|HRB500": 34, "C50|HRB500": 32,
  "C55|HRB500": 31, "C60|HRB500": 30, "C65|HRB500": 30, "C70|HRB500": 30, "C75|HRB500": 30, "C80|HRB500": 30,
};

/** 抗震锚固长度系数 ζaE — 22G101-1 第2-2页
 *  一/二级 1.15，三级 1.05，四级 & 非抗震 1.0
 *  注：四级抗震时 labE = lab */
export function seismicFactor(s: SeismicLevel): number {
  if (s === "ONE" || s === "TWO") return 1.15;
  if (s === "THREE") return 1.05;
  return 1.0;
}

/** 搭接长度修正系数 ζl — 22G101-1 第2-5页 */
export function lapFactor(percent: 25 | 50 | 100 = 25): number {
  switch (percent) {
    case 25: return 1.2;
    case 50: return 1.4;
    case 100: return 1.6;
    default: return 1.2;
  }
}

/** 计算 lab（受拉钢筋基本锚固长度，mm）— 22G101-1 第2-2页 */
export function Lab(concrete: ConcreteGrade, grade: RebarGrade, d: number): number {
  const k = LAB_TABLE[`${concrete}|${grade}`];
  if (!k) return 40 * d;
  return k * d;
}

/** 计算 labE（抗震设计时受拉钢筋基本锚固长度，mm）— 22G101-1 第2-2页 */
export function LabE(concrete: ConcreteGrade, grade: RebarGrade, d: number, s: SeismicLevel): number {
  return Lab(concrete, grade, d) * seismicFactor(s);
}

/** 计算 la（受拉钢筋锚固长度，mm）— 22G101-1 第2-3页
 *  la = ζa × lab，其中 ζa 为锚固长度修正系数
 *  简化：取 ζa = 1.0（常规情况） */
export function La(concrete: ConcreteGrade, grade: RebarGrade, d: number): number {
  return Lab(concrete, grade, d);
}

/** 计算 laE（受拉钢筋抗震锚固长度，mm）— 22G101-1 第2-3页 */
export function LaE(concrete: ConcreteGrade, grade: RebarGrade, d: number, s: SeismicLevel): number {
  return LabE(concrete, grade, d, s);
}

/** 搭接长度 ll / llE — 22G101-1 第2-5、2-6页
 *  ll = ζl × la；llE = ζl × laE */
export function Ll(concrete: ConcreteGrade, grade: RebarGrade, d: number, percent?: 25 | 50 | 100): number {
  return La(concrete, grade, d) * lapFactor(percent);
}
export function LlE(concrete: ConcreteGrade, grade: RebarGrade, d: number, s: SeismicLevel, percent?: 25 | 50 | 100): number {
  return LaE(concrete, grade, d, s) * lapFactor(percent);
}

// ------------------------------------------------------------------
// 保护层最小厚度 — 22G101-1 / 22G101-3 第2-1页
// ------------------------------------------------------------------

/** 板、墙最小保护层（mm） */
export const MIN_COVER_SLAB_WALL: Record<EnvClass, number> = {
  Ia: 15, Ib: 20, IIa: 20, IIb: 25, IIIa: 30, IIIb: 40,
};

/** 梁、柱最小保护层（mm） */
export const MIN_COVER_BEAM_COLUMN: Record<EnvClass, number> = {
  Ia: 20, Ib: 25, IIa: 25, IIb: 35, IIIa: 40, IIIb: 50,
};

/** 基础底面有垫层时最小保护层（mm） */
export const MIN_COVER_FOUNDATION = 40;

/** 获取最小保护层厚度（mm）
 * @param env 环境类别
 * @param memberType 构件类型：'slab' | 'wall' | 'beam' | 'column' | 'foundation'
 * @param concreteGrade 混凝土强度等级（C25时需增加5mm） */
export function minCover(env: EnvClass, memberType: "slab" | "wall" | "beam" | "column" | "foundation", concreteGrade?: ConcreteGrade): number {
  if (memberType === "foundation") return MIN_COVER_FOUNDATION;
  const isSlabOrWall = memberType === "slab" || memberType === "wall";
  const base = isSlabOrWall ? MIN_COVER_SLAB_WALL[env] : MIN_COVER_BEAM_COLUMN[env];
  // 混凝土强度等级为C25时，表中保护层厚度数值应增加5mm — 22G101-1 第2-1页注4
  const add5 = concreteGrade === "C25" ? 5 : 0;
  return base + add5;
}

// ------------------------------------------------------------------
// 配筋率
// ------------------------------------------------------------------

/** 梁纵筋最小配筋率 ρmin（%）— GB 50010-2010
 *  取 0.2% 和 45ft/fy 中的较大值 */
export function minRhoBeam(concrete: ConcreteGrade, grade: RebarGrade): number {
  const ft = concreteFt(concrete);
  const fy = rebarFy(grade);
  return Math.max(0.2, (45 * ft) / fy);
}

/** 柱全部纵筋最小配筋率（%）— 22G101-1 */
export function minRhoColumn(seismic: SeismicLevel): number {
  switch (seismic) {
    case "ONE": return 1.0;
    case "TWO": return 0.8;
    case "THREE": return 0.7;
    case "FOUR": return 0.6;
    default: return 0.5;
  }
}

/** 混凝土轴心抗拉强度设计值 ft（N/mm²）— GB 50010-2010 */
function concreteFt(grade: ConcreteGrade): number {
  const map: Record<ConcreteGrade, number> = {
    C20: 1.1, C25: 1.27, C30: 1.43, C35: 1.57, C40: 1.71,
    C45: 1.8, C50: 1.89, C55: 1.96, C60: 2.04, C65: 2.09,
    C70: 2.14, C75: 2.18, C80: 2.22,
  };
  return map[grade] ?? 1.43;
}

/** 钢筋抗拉强度设计值 fy（N/mm²）— GB 50010-2010 */
function rebarFy(grade: RebarGrade): number {
  return { HPB300: 270, HRB400: 360, HRB500: 435 }[grade];
}

// ------------------------------------------------------------------
// 箍筋最大间距
// ------------------------------------------------------------------

/** 梁箍筋加密区最大间距（mm）— 22G101-1 第2-39页
 *  一级: min(hb/4, 6d, 100)；二~四级: min(hb/4, 8d, 100)
 *  @param s 抗震等级
 *  @param h 梁高 mm
 *  @param d 纵筋直径 mm（注意：不是箍筋直径） */
export function beamStirrupMaxSpacingDense(s: SeismicLevel, h: number, d: number): number {
  if (s === "NONE") return 250; // 非抗震不强制加密
  const byH = h / 4;
  if (s === "ONE") return Math.min(byH, 6 * d, 100);
  return Math.min(byH, 8 * d, 100);
}

/** 柱箍筋加密区最大间距（mm）— 22G101-1 第2-11页
 *  一级: min(hc/4, 6d, 100)；二级: min(hc/4, 8d, 100)；三/四级: min(hc/4, 8d, 150)
 *  @param s 抗震等级
 *  @param hc 柱截面长边尺寸 mm
 *  @param d 纵筋直径 mm */
export function columnStirrupMaxSpacingDense(s: SeismicLevel, hc: number, d: number): number {
  if (s === "NONE") return 250;
  const byHc = hc / 4;
  if (s === "ONE") return Math.min(byHc, 6 * d, 100);
  if (s === "TWO") return Math.min(byHc, 8 * d, 100);
  return Math.min(byHc, 8 * d, 150);
}

/** 梁箍筋非加密区最大间距（mm）— 22G101-1 */
export function beamStirrupMaxSpacingNormal(s: SeismicLevel, h: number, d: number): number {
  if (s === "ONE") return Math.min(h / 2, 8 * d, 200);
  if (s === "TWO" || s === "THREE" || s === "FOUR") return Math.min(h / 2, 8 * d, 200);
  return Math.min(h / 2, 8 * d, 250);
}

/** 柱箍筋非加密区最大间距（mm）— 22G101-1 */
export function columnStirrupMaxSpacingNormal(s: SeismicLevel, h: number, d: number): number {
  if (s === "ONE" || s === "TWO") return Math.min(h, 15 * d, 200);
  if (s === "THREE" || s === "FOUR") return Math.min(h, 15 * d, 250);
  return Math.min(h, 15 * d, 300);
}

// ------------------------------------------------------------------
// 加密区长度
// ------------------------------------------------------------------

/** 梁箍筋加密区长度（mm，每端）— 22G101-1 第2-39页
 *  一级: max(2hb, 500)；二~四级: max(1.5hb, 500) */
export function beamDensifyZoneLength(s: SeismicLevel, h: number): number {
  if (s === "NONE") return 0;
  if (s === "ONE") return Math.max(2 * h, 500);
  return Math.max(1.5 * h, 500);
}

/** 柱端箍筋加密区长度（mm，每端）— 22G101-1 第2-11页
 *  max(Hn/6, hc, 500) */
export function columnDensifyZoneLength(s: SeismicLevel, b: number, h: number, Hn: number): number {
  if (s === "NONE") return 0;
  const hc = Math.max(b, h);
  return Math.max(Hn / 6, hc, 500);
}

/** 灌注桩螺旋箍筋加密区长度（mm）— 22G101-3 第6.2.2条
 *  桩顶以下5D（D为桩身直径） */
export function pileDensifyZoneLength(D: number): number {
  return 5 * D;
}

// ------------------------------------------------------------------
// 板配筋
// ------------------------------------------------------------------

/** 板分布筋最大间距（mm） */
export const SLAB_DIST_MAX_SPACING = 250;

/** 板支座负筋外伸长度（mm）— 一般取 Lx/4 */
export function slabNegExtension(Lx: number): number {
  return Math.round(Lx / 4);
}

/** 板下部纵筋在端支座锚固长度（mm）— 22G101-1 第2-50页
 *  伸至支座中心线且 ≥ 5d */
export function slabBottomAnchor(d: number, supportWidth: number): number {
  return Math.max(supportWidth / 2, 5 * d);
}

/** 板上部贯通纵筋在端支座锚固长度（mm）— 22G101-1 第2-50页
 *  伸至支座外侧纵筋内侧且 ≥ la */
export function slabTopAnchor(la: number): number {
  return la;
}

// ------------------------------------------------------------------
// 梁构造要求
// ------------------------------------------------------------------

/** 梁腹板高度 hw（mm）— 用于判断是否需要配置侧面构造钢筋 */
export function beamWebHeight(h: number, cover: number, d: number): number {
  return h - cover - d; // 简化：hw ≈ h - 保护层 - 纵筋直径
}

/** 梁侧面构造钢筋配置要求 — 22G101-1 第2-41页
 *  当 hw ≥ 450mm 时，在梁的两个侧面应沿高度配置纵向构造钢筋
 *  每侧纵向构造钢筋间距 a ≤ 200mm */
export function needSideRebar(h: number, cover: number, d: number): boolean {
  return beamWebHeight(h, cover, d) >= 450;
}

/** 梁侧面构造钢筋最小总截面积（mm²）— GB 50010
 *  每侧构造钢筋截面积 ≥ 0.1% × b × hw */
export function minSideRebarArea(b: number, h: number, cover: number, d: number): number {
  const hw = beamWebHeight(h, cover, d);
  return 0.001 * b * hw;
}

/** 梁侧面构造钢筋锚固/搭接长度（mm）— 22G101-1 第2-41页
 *  可取为 15d */
export function sideRebarAnchor(d: number): number {
  return 15 * d;
}

/** 梁纵筋最大间距（mm）— 22G101-1 第2-8页
 *  上部：≥30mm 且 ≥1.5d；下部：≥25mm 且 ≥d */
export function beamLongBarMaxSpacing(grade: RebarGrade, d: number, isTop: boolean): number {
  return isTop ? Math.max(30, 1.5 * d) : Math.max(25, d);
}

/** 柱纵筋间距（mm）— 22G101-1 第2-8页
 *  中柱：≥50mm；边柱、角柱：≥30mm 且 ≥1.5d */
export function columnLongBarMinSpacing(d: number, isMiddle: boolean): number {
  return isMiddle ? 50 : Math.max(30, 1.5 * d);
}

/** 梁并筋等效直径 — 22G101-1 第2-8页
 *  2根并筋：1.41d；3根并筋：1.73d */
export function bundledBarEquivDiameter(d: number, n: 2 | 3): number {
  return n === 2 ? 1.41 * d : 1.73 * d;
}

/** 箍筋弯钩长度（mm）— 22G101-1 第2-7页
 *  抗震：135°弯钩，弯后直段长度 ≥ 10d 且 ≥ 75mm
 *  非抗震：90°弯钩，弯后直段长度 ≥ 5d */
export function stirrupHookLength(d: number, seismic: boolean): number {
  return seismic ? Math.max(10 * d, 75) : 5 * d;
}

/** 灌注桩桩顶进入承台高度（mm）— 22G101-3 第6.2.2条
 *  桩径 < 800mm 时取 50mm；桩径 ≥ 800mm 时取 100mm */
export function pileEmbedDepth(D: number): number {
  return D < 800 ? 50 : 100;
}

/** 灌注桩加劲箍设置 — 22G101-3 第6.2.2条
 *  当钢筋笼长度超过 4m 时，应每隔 2m 设一道直径为 12mm 焊接加劲箍 */
export function pileStiffenerCount(L: number): number {
  return L > 4000 ? Math.floor((L - 1) / 2000) : 0;
}
