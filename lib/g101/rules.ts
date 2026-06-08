import type { Component, ValidationItem } from "../types";
import { detectCollisions, collisionsToValidations } from "./collision";
import {
  minCover,
  beamStirrupMaxSpacingDense,
  beamStirrupMaxSpacingNormal,
  columnStirrupMaxSpacingDense,
  columnStirrupMaxSpacingNormal,
  beamDensifyZoneLength,
  columnDensifyZoneLength,
  pileDensifyZoneLength,
  minRhoBeam,
  minRhoColumn,
  slabNegExtension,
  SLAB_DIST_MAX_SPACING,
  needSideRebar,
  minSideRebarArea,
  beamLongBarMaxSpacing,
  columnLongBarMinSpacing,
  La,
} from "./tables";
import { recommendedDetailReference } from "./detailReferences";

type Ctx = { c: Component; push: (r: Omit<ValidationItem, "componentId">) => void };

function coverMemberType(c: Component): "slab" | "wall" | "beam" | "column" | "foundation" {
  if (c.type === "COLUMN") return "column";
  if (c.type === "SHEAR_WALL") return "wall";
  if (c.type === "SLAB" || c.type === "STAIR") return "slab";
  if (c.type === "FOUND" || c.type === "STRIP_FOUND" || c.type === "PILE_CAP" || c.type === "PILE" || c.type === "RAFT") return "foundation";
  return "beam";
}

function barArea(diameter: number, count = 1) {
  return count * Math.PI * (diameter / 2) ** 2;
}

function rebarArea(r: { diameter: number; count?: number }) {
  return barArea(r.diameter, r.count ?? 0);
}

function maxMainBarDiameter(c: Component) {
  const roles = new Set(["TOP", "BOTTOM", "MAIN", "LONGITUDINAL", "VERTICAL", "BOT_X", "BOT_Y", "TOP_X", "TOP_Y"]);
  const bars = c.rebars.filter((r) => roles.has(r.role));
  return bars.length > 0 ? Math.max(...bars.map((r) => r.diameter || 0)) : 12;
}

function checkCover({ c, push }: Ctx) {
  const min = minCover(c.concrete.env, coverMemberType(c), c.concrete.grade);
  if (c.concrete.cover < min) {
    push({ rule: "保护层厚度", severity: "error", message: `保护层 ${c.concrete.cover}mm 小于最小值 ${min}mm` });
  } else {
    push({ rule: "保护层厚度", severity: "pass", message: `保护层 ${c.concrete.cover}mm >= ${min}mm` });
  }
}

function checkBeam(ctx: Ctx) {
  const { c, push } = ctx;
  const { b = 0, h = 0, L = 0 } = c.geometry;
  const seismic = c.concrete.seismic;
  const cover = c.concrete.cover;
  if (b <= 0 || h <= 0 || L <= 0) {
    push({ rule: "梁尺寸", severity: "error", message: "梁截面 b、h、L 必须大于 0mm" });
    return;
  }

  const stirrup = c.rebars.find((r) => r.role === "STIRRUP");
  if (!stirrup) {
    push({ rule: "梁箍筋", severity: "error", message: "梁缺少箍筋配置" });
  } else {
    if ((stirrup.diameter ?? 0) < 6) {
      push({ rule: "箍筋直径", severity: "error", message: `箍筋直径 ${stirrup.diameter}mm < 6mm` });
    }
    const longBars = c.rebars.filter((r) => r.role === "TOP" || r.role === "BOTTOM");
    const longDia = longBars[0]?.diameter ?? stirrup.diameter;

    if (seismic !== "NONE") {
      const reqZone = beamDensifyZoneLength(seismic, h);
      if (!stirrup.densifyLength || stirrup.densifyLength < reqZone) {
        push({ rule: "梁端箍筋加密区长度", severity: "error", message: `加密区长度 ${stirrup.densifyLength ?? 0}mm < 要求 ${Math.round(reqZone)}mm` });
      } else {
        push({ rule: "梁端箍筋加密区长度", severity: "pass", message: `加密区 ${stirrup.densifyLength}mm >= ${Math.round(reqZone)}mm` });
      }
      const denseMax = beamStirrupMaxSpacingDense(seismic, h, longDia);
      const sd = stirrup.densifySpacing ?? stirrup.spacing ?? 9999;
      if (sd > denseMax) {
        push({ rule: "梁箍筋加密区间距", severity: "error", message: `加密间距 ${sd}mm > ${Math.round(denseMax)}mm` });
      } else {
        push({ rule: "梁箍筋加密区间距", severity: "pass", message: `加密间距 ${sd}mm <= ${Math.round(denseMax)}mm` });
      }
    }

    const normMax = beamStirrupMaxSpacingNormal(seismic, h, longDia);
    if ((stirrup.spacing ?? 0) > normMax) {
      push({ rule: "梁箍筋非加密区间距", severity: "warn", message: `非加密间距 ${stirrup.spacing}mm > ${Math.round(normMax)}mm` });
    } else if (stirrup.spacing) {
      push({ rule: "梁箍筋非加密区间距", severity: "pass", message: `非加密间距 ${stirrup.spacing}mm <= ${Math.round(normMax)}mm` });
    }
  }

  const bottoms = c.rebars.filter((r) => r.role === "BOTTOM");
  const As = bottoms.reduce((s, r) => s + rebarArea(r), 0);
  const rho = b * h > 0 ? (As / (b * h)) * 100 : 0;
  const rhoMin = minRhoBeam(c.concrete.grade, bottoms[0]?.grade ?? "HRB400");
  if (rho < rhoMin) push({ rule: "梁纵筋配筋率", severity: "error", message: `rho=${rho.toFixed(3)}% < rhoMin=${rhoMin.toFixed(3)}%` });
  else push({ rule: "梁纵筋配筋率", severity: "pass", message: `rho=${rho.toFixed(3)}% >= ${rhoMin.toFixed(3)}%` });

  const topDia = c.rebars.find((r) => r.role === "TOP")?.diameter ?? 20;
  if (needSideRebar(h, cover, topDia)) {
    const sides = c.rebars.filter((r) => r.role === "SIDE" || r.role === "LONGITUDINAL");
    const hw = h - cover - topDia;
    const minArea = minSideRebarArea(b, h, cover, topDia);
    const actualArea = sides.reduce((s, r) => s + rebarArea(r), 0);
    if (sides.length === 0) push({ rule: "梁侧面构造钢筋", severity: "warn", message: `梁腹板高度 hw=${hw}mm >= 450mm，应配置侧面构造钢筋` });
    else if (actualArea < minArea) push({ rule: "梁侧面构造钢筋", severity: "warn", message: `侧面构造钢筋面积 ${actualArea.toFixed(0)}mm² < 要求 ${minArea.toFixed(0)}mm²` });
    else push({ rule: "梁侧面构造钢筋", severity: "pass", message: `侧面构造钢筋面积 ${actualArea.toFixed(0)}mm² >= ${minArea.toFixed(0)}mm²` });
  }

  for (const r of c.rebars.filter((r) => r.role === "TOP" || r.role === "BOTTOM")) {
    if (r.count && r.count > 1) {
      const spacing = (b - 2 * cover) / (r.count - 1);
      const minSpacing = beamLongBarMaxSpacing(r.grade, r.diameter, r.role === "TOP");
      if (spacing < minSpacing) push({ rule: "梁纵筋间距", severity: "warn", message: `${r.role} 间距 ${spacing.toFixed(0)}mm < ${minSpacing}mm` });
    }
  }
}

function checkColumn(ctx: Ctx) {
  const { c, push } = ctx;
  const { b = 0, h = 0, L = 0 } = c.geometry;
  const seismic = c.concrete.seismic;
  if (b <= 0 || h <= 0 || L <= 0) {
    push({ rule: "柱尺寸", severity: "error", message: "柱截面 b、h、L 必须大于 0mm" });
    return;
  }

  const mains = c.rebars.filter((r) => r.role === "MAIN");
  const As = mains.reduce((s, r) => s + rebarArea(r), 0);
  const rho = (As / (b * h)) * 100;
  const rhoMin = minRhoColumn(seismic);
  if (rho < rhoMin) push({ rule: "柱全部纵筋配筋率", severity: "error", message: `rho=${rho.toFixed(3)}% < rhoMin=${rhoMin}%` });
  else push({ rule: "柱全部纵筋配筋率", severity: "pass", message: `rho=${rho.toFixed(3)}% >= ${rhoMin}%` });

  for (const r of mains) {
    if (r.count && r.count > 1) {
      const spacing = Math.min(b, h) / (r.count - 1);
      const minSpacing = columnLongBarMinSpacing(r.diameter, true);
      if (spacing < minSpacing) push({ rule: "柱纵筋间距", severity: "warn", message: `纵筋间距 ${spacing.toFixed(0)}mm < ${minSpacing}mm` });
    }
  }

  const stirrup = c.rebars.find((r) => r.role === "STIRRUP");
  if (!stirrup) {
    push({ rule: "柱箍筋", severity: "error", message: "柱缺少箍筋配置" });
    return;
  }
  if (stirrup.diameter < 8) push({ rule: "柱箍筋直径", severity: "warn", message: `箍筋直径 ${stirrup.diameter}mm 建议不小于 8mm` });

  const longDia = mains[0]?.diameter ?? stirrup.diameter;
  const hc = Math.max(b, h);
  if (seismic !== "NONE") {
    const reqZone = columnDensifyZoneLength(seismic, b, h, L);
    if (!stirrup.densifyLength || stirrup.densifyLength < reqZone) push({ rule: "柱端箍筋加密区长度", severity: "error", message: `加密区长度 ${stirrup.densifyLength ?? 0}mm < 要求 ${Math.round(reqZone)}mm` });
    else push({ rule: "柱端箍筋加密区长度", severity: "pass", message: `加密区 ${stirrup.densifyLength}mm >= ${Math.round(reqZone)}mm` });

    const denseMax = columnStirrupMaxSpacingDense(seismic, hc, longDia);
    const sd = stirrup.densifySpacing ?? stirrup.spacing ?? 9999;
    if (sd > denseMax) push({ rule: "柱箍筋加密间距", severity: "error", message: `加密间距 ${sd}mm > ${Math.round(denseMax)}mm` });
    else push({ rule: "柱箍筋加密间距", severity: "pass", message: `加密间距 ${sd}mm <= ${Math.round(denseMax)}mm` });
  }
  const normMax = columnStirrupMaxSpacingNormal(seismic, hc, longDia);
  if ((stirrup.spacing ?? 0) > normMax) push({ rule: "柱箍筋非加密间距", severity: "warn", message: `非加密 ${stirrup.spacing}mm > ${Math.round(normMax)}mm` });
  else if (stirrup.spacing) push({ rule: "柱箍筋非加密间距", severity: "pass", message: `非加密 ${stirrup.spacing}mm <= ${Math.round(normMax)}mm` });
}

function checkSlab(ctx: Ctx) {
  const { c, push } = ctx;
  const { Lx = 0, Ly = 0, t = 0 } = c.geometry;
  if (Lx <= 0 || Ly <= 0 || t <= 0) {
    push({ rule: "板尺寸", severity: "error", message: "板 Lx、Ly、t 必须大于 0mm" });
    return;
  }
  if (t < 80) push({ rule: "板厚", severity: "warn", message: `板厚 ${t}mm < 80mm` });
  else push({ rule: "板厚", severity: "pass", message: `板厚 ${t}mm >= 80mm` });

  const dists = c.rebars.filter((r) => r.role === "DIST" || r.role === "BOTTOM" || r.role === "TOP");
  for (const d of dists) {
    if ((d.spacing ?? 0) > SLAB_DIST_MAX_SPACING) push({ rule: "板筋间距", severity: "warn", message: `${d.role} 间距 ${d.spacing}mm > ${SLAB_DIST_MAX_SPACING}mm` });
  }

  const neg = c.rebars.find((r) => r.role === "NEG");
  if (!neg) push({ rule: "板支座负筋", severity: "warn", message: "未配置支座负筋" });
  else {
    const support = c.geometry.slabSupport;
    const supportType = support?.type ?? "end";
    const ratio = support?.spanRatio ?? (supportType === "continuous" ? 1 / 3 : supportType === "cantilever" ? 1 : 1 / 4);
    const req = Math.round(Lx * ratio);
    const supportName = supportType === "continuous" ? "连续支座" : supportType === "cantilever" ? "悬挑支座" : "端支座";
    if ((neg.extension ?? 0) < req) push({ rule: "板支座负筋外伸", severity: "error", message: `${supportName}负筋外伸 ${neg.extension ?? 0}mm < 建议值 ${req}mm` });
    else push({ rule: "板支座负筋外伸", severity: "pass", message: `${supportName}外伸 ${neg.extension}mm >= ${req}mm` });
  }

  const bottom = c.rebars.find((r) => r.role === "BOTTOM");
  if (bottom) {
    const la = La(c.concrete.grade, bottom.grade, bottom.diameter);
    push({ rule: "板下部纵筋锚固", severity: "pass", message: `la = ${Math.round(la)}mm` });
  }
}

function checkPile(ctx: Ctx) {
  const { c, push } = ctx;
  const { D = 0, L = 0 } = c.geometry;
  if (D <= 0 || L <= 0) {
    push({ rule: "桩基尺寸", severity: "error", message: "桩径、桩长必须大于 0mm" });
    return;
  }
  const main = c.rebars.find((r) => r.role === "MAIN");
  if (!main || (main.count ?? 0) < 6) push({ rule: "桩主筋根数", severity: "warn", message: `灌注桩主筋宜不少于 6 根，当前 ${main?.count ?? 0} 根` });
  else push({ rule: "桩主筋根数", severity: "pass", message: `主筋 ${main.count} 根 >= 6 根` });

  const spiral = c.rebars.find((r) => r.role === "SPIRAL" || r.role === "STIRRUP");
  if (!spiral) {
    push({ rule: "桩螺旋箍筋", severity: "error", message: "桩基缺少螺旋箍筋" });
    return;
  }
  const reqZone = pileDensifyZoneLength(D);
  if (!spiral.densifyLength || spiral.densifyLength < reqZone) push({ rule: "桩顶箍筋加密区", severity: "warn", message: `加密区长度 ${spiral.densifyLength ?? 0}mm < 要求 ${reqZone}mm` });
  else push({ rule: "桩顶箍筋加密区", severity: "pass", message: `加密区 ${spiral.densifyLength}mm >= ${reqZone}mm` });

  const embed = D < 800 ? 50 : 100;
  push({ rule: "桩顶嵌入承台", severity: "pass", message: `桩顶嵌入承台高度 ${embed}mm` });
}

function checkShearWall(ctx: Ctx) {
  const { c, push } = ctx;
  const { b = 0, h = 0, L = 0 } = c.geometry;
  if (b <= 0 || h <= 0 || L <= 0) {
    push({ rule: "剪力墙尺寸", severity: "error", message: "剪力墙厚度、层高、墙长必须大于 0mm" });
    return;
  }
  if (b < 160) push({ rule: "剪力墙厚度", severity: "warn", message: `墙厚 ${b}mm 偏小，建议复核墙身稳定与边缘构件要求` });
  else push({ rule: "剪力墙厚度", severity: "pass", message: `墙厚 ${b}mm 已录入` });

  const horizontal = c.rebars.find((r) => r.role === "HORIZONTAL");
  const vertical = c.rebars.find((r) => r.role === "VERTICAL");
  const tie = c.rebars.find((r) => r.role === "TIE");
  for (const [rule, bar] of [["剪力墙水平分布筋", horizontal], ["剪力墙竖向分布筋", vertical]] as const) {
    if (!bar) {
      push({ rule, severity: "error", message: "缺少分布筋配置" });
      continue;
    }
    if ((bar.diameter ?? 0) < 8) push({ rule, severity: "warn", message: `直径 ${bar.diameter}mm 偏小，建议不小于 8mm` });
    if ((bar.spacing ?? 0) <= 0) push({ rule, severity: "error", message: "分布筋间距必须大于 0mm" });
    else if ((bar.spacing ?? 0) > 300) push({ rule, severity: "warn", message: `分布筋间距 ${bar.spacing}mm > 300mm，建议复核墙身分布筋构造` });
    else push({ rule, severity: "pass", message: `分布筋 ${bar.diameter}mm@${bar.spacing}mm 已配置` });
  }
  if (!tie) push({ rule: "剪力墙拉筋", severity: "warn", message: "缺少拉筋配置，建议补充墙身拉结筋" });
  else if ((tie.spacing ?? 0) > 600) push({ rule: "剪力墙拉筋", severity: "warn", message: `拉筋间距 ${tie.spacing}mm > 600mm，建议复核拉结筋布置` });
  else push({ rule: "剪力墙拉筋", severity: "pass", message: `拉筋 ${tie.diameter}mm@${tie.spacing ?? 0}mm 已配置` });
}

function checkStair(ctx: Ctx) {
  const { c, push } = ctx;
  const { b = 0, h = 0, L = 0, t = 0 } = c.geometry;
  if (b <= 0 || h <= 0 || L <= 0 || t <= 0) {
    push({ rule: "AT楼梯尺寸", severity: "error", message: "楼梯宽度、水平长度、踏步高度、梯板厚度必须大于 0mm" });
    return;
  }
  const steps = Math.max(1, Math.round(c.geometry.stairSteps ?? 10));
  const landingLength = c.geometry.stairLandingLength ?? 0;
  const landingThickness = c.geometry.stairLandingThickness ?? t;
  const tread = L / steps;
  const slopeLength = Math.hypot(L, h * steps);
  if (steps <= 1) push({ rule: "AT楼梯踏步数", severity: "warn", message: "踏步数过少，建议补充真实踏步数量以细化工程量" });
  else push({ rule: "AT楼梯踏步数", severity: "pass", message: `踏步数 ${steps}，斜板长度约 ${Math.round(slopeLength)}mm` });
  if (h < 120 || h > 180) push({ rule: "AT楼梯踏步高度", severity: "warn", message: `踏步高度 ${h}mm，建议按建筑楼梯常用范围 120-180mm 复核` });
  else push({ rule: "AT楼梯踏步高度", severity: "pass", message: `踏步高度 ${h}mm 已录入` });
  if (tread < 220 || tread > 320) push({ rule: "AT楼梯踏步宽度", severity: "warn", message: `踏步宽度约 ${Math.round(tread)}mm，建议结合建筑做法复核` });
  else push({ rule: "AT楼梯踏步宽度", severity: "pass", message: `踏步宽度约 ${Math.round(tread)}mm` });
  if (t < 100) push({ rule: "AT楼梯梯板厚度", severity: "warn", message: `梯板厚度 ${t}mm < 100mm，建议复核梯板厚度` });
  else push({ rule: "AT楼梯梯板厚度", severity: "pass", message: `梯板厚度 ${t}mm 已录入` });
  if (landingLength > 0) {
    if (landingThickness < t) push({ rule: "AT楼梯休息平台", severity: "warn", message: `平台板厚 ${landingThickness}mm < 梯板厚 ${t}mm，建议复核平台板构造` });
    else push({ rule: "AT楼梯休息平台", severity: "pass", message: `平台长度 ${landingLength}mm，平台板厚 ${landingThickness}mm 已纳入工程量` });
  }

  const main = c.rebars.find((r) => r.role === "LONGITUDINAL");
  const dist = c.rebars.find((r) => r.role === "DIST");
  if (!main) push({ rule: "AT楼梯受力筋", severity: "error", message: "缺少纵向受力筋配置" });
  else if ((main.spacing ?? 0) <= 0) push({ rule: "AT楼梯受力筋", severity: "error", message: "纵向受力筋间距必须大于 0mm" });
  else if ((main.spacing ?? 0) > 200) push({ rule: "AT楼梯受力筋", severity: "warn", message: `纵向受力筋间距 ${main.spacing}mm > 200mm，建议复核梯板受力筋` });
  else push({ rule: "AT楼梯受力筋", severity: "pass", message: `纵向受力筋 ${main.diameter}mm@${main.spacing}mm 已配置` });

  if (!dist) push({ rule: "AT楼梯分布筋", severity: "warn", message: "缺少分布筋配置" });
  else if ((dist.spacing ?? 0) > SLAB_DIST_MAX_SPACING) push({ rule: "AT楼梯分布筋", severity: "warn", message: `分布筋间距 ${dist.spacing}mm > ${SLAB_DIST_MAX_SPACING}mm` });
  else push({ rule: "AT楼梯分布筋", severity: "pass", message: `分布筋 ${dist.diameter}mm@${dist.spacing ?? 0}mm 已配置` });
}

function checkFoundationLike(ctx: Ctx) {
  const { c, push } = ctx;
  const g = c.geometry;
  if (c.type === "STRIP_FOUND") {
    const { b = 0, h = 0, L = 0 } = g;
    if (b <= 0 || h <= 0 || L <= 0) {
      push({ rule: "条形基础尺寸", severity: "error", message: "条形基础宽度、高度、总长必须大于 0mm" });
      return;
    }
    const transverse = c.rebars.find((r) => r.role === "TRANSVERSE");
    const longitudinal = c.rebars.find((r) => r.role === "LONGITUDINAL");
    if (!transverse) push({ rule: "条形基础横向受力筋", severity: "error", message: "缺少横向受力筋配置" });
    else if ((transverse.spacing ?? 0) > 250 || (transverse.spacing ?? 0) <= 0) push({ rule: "条形基础横向受力筋", severity: "warn", message: `横向受力筋间距 ${transverse.spacing ?? 0}mm，建议控制在 250mm 以内` });
    else push({ rule: "条形基础横向受力筋", severity: "pass", message: `横向受力筋 ${transverse.diameter}mm@${transverse.spacing}mm 已配置` });

    if (!longitudinal || (longitudinal.count ?? 0) < 2) push({ rule: "条形基础纵向构造筋", severity: "warn", message: `纵向构造筋数量 ${longitudinal?.count ?? 0}，建议不少于 2 根` });
    else push({ rule: "条形基础纵向构造筋", severity: "pass", message: `纵向构造筋 ${longitudinal.count} 根已配置` });
    return;
  }

  const { Lx = 0, Ly = 0, t = 0 } = g;
  if (Lx <= 0 || Ly <= 0 || t <= 0) {
    push({ rule: "基础平面尺寸", severity: "error", message: "基础 Lx、Ly、厚度必须大于 0mm" });
    return;
  }
  if (t < 300) push({ rule: "基础厚度", severity: "warn", message: `基础厚度 ${t}mm < 300mm，建议复核基础厚度` });
  else push({ rule: "基础厚度", severity: "pass", message: `基础厚度 ${t}mm 已录入` });

  const requiredRoles = c.type === "RAFT" ? ["BOT_X", "BOT_Y", "TOP_X", "TOP_Y"] : ["BOT_X", "BOT_Y"];
  for (const role of requiredRoles) {
    const bar = c.rebars.find((r) => r.role === role);
    const prefix = c.type === "RAFT" ? "筏板" : c.type === "PILE_CAP" ? "承台" : "独立基础";
    const rule = `${prefix}${role.includes("X") ? "X向" : "Y向"}${role.startsWith("TOP") ? "面筋" : "底筋"}`;
    if (!bar) push({ rule, severity: "error", message: "缺少对应方向钢筋配置" });
    else if ((bar.spacing ?? 0) <= 0 || (bar.spacing ?? 0) > 250) push({ rule, severity: "warn", message: `钢筋间距 ${bar.spacing ?? 0}mm，建议控制在 250mm 以内` });
    else {
      const area = bar.count ? `${rebarArea(bar).toFixed(0)}mm²` : `${bar.diameter}mm@${bar.spacing}mm`;
      push({ rule, severity: "pass", message: `${area} 已配置` });
    }
  }
}

function checkOpenings({ c, push }: Ctx) {
  const openings = c.geometry.openings ?? [];
  if (openings.length === 0) return;

  for (const [index, opening] of openings.entries()) {
    const name = opening.id ?? `洞口${index + 1}`;
    if (opening.width <= 0 || opening.height <= 0) {
      push({ rule: "阶段C：洞口尺寸", severity: "error", message: `${name} 的宽度和高度必须大于 0mm` });
      continue;
    }
    const largeOpening = opening.width >= 300 || opening.height >= 300;
    if (largeOpening && !opening.reinforced) {
      push({ rule: "阶段C：洞口加强", severity: "warn", message: `${name} 尺寸 ${opening.width}x${opening.height}mm，建议配置洞口边加强钢筋并复核锚固长度` });
    } else if ((opening.extraRebarArea ?? 0) > 0 || opening.reinforced) {
      push({ rule: "阶段C：洞口加强", severity: "pass", message: `${name} 已配置洞口加强信息，可继续结合详图复核边缘构造` });
    }
  }
}

function checkVariableSection({ c, push }: Ctx) {
  const spec = c.geometry.variableSection;
  if (!spec?.enabled) return;

  const fromB = spec.fromB ?? c.geometry.b ?? 0;
  const fromH = spec.fromH ?? c.geometry.h ?? 0;
  const toB = spec.toB ?? fromB;
  const toH = spec.toH ?? fromH;
  const delta = Math.max(Math.abs(fromB - toB), Math.abs(fromH - toH));
  const transitionLength = spec.transitionLength ?? 0;
  const required = Math.max(12 * maxMainBarDiameter(c), 200);

  if (delta <= 0) {
    push({ rule: "阶段C：变截面构造", severity: "warn", message: "已启用变截面校验，但未录入截面变化尺寸" });
    return;
  }
  if (transitionLength < required) {
    push({ rule: "阶段C：变截面构造", severity: "warn", message: `截面变化 ${delta}mm，过渡段 ${transitionLength}mm < 建议值 ${required}mm，应复核纵筋弯折和箍筋加密` });
  } else {
    push({ rule: "阶段C：变截面构造", severity: "pass", message: `截面变化 ${delta}mm，过渡段 ${transitionLength}mm 已达到建议值 ${required}mm` });
  }
}

function checkSpecialSeismicNode({ c, push }: Ctx) {
  const node = c.geometry.specialSeismicNode;
  if (!node?.enabled) return;

  if (c.concrete.seismic === "NONE") {
    push({ rule: "阶段C：特殊抗震节点", severity: "warn", message: "已启用特殊抗震节点，但当前构件为非抗震等级" });
    return;
  }

  const hoopSpacing = node.hoopSpacing ?? 0;
  const hoopDiameter = node.hoopDiameter ?? 0;
  const nodeType = node.nodeType ?? "beam-column";
  const typeName =
    nodeType === "transfer" ? "转换节点" :
    nodeType === "wall-boundary" ? "墙边缘节点" :
    nodeType === "custom" ? "自定义节点" :
    "梁柱节点";
  const spacingLimit = nodeType === "transfer" ? 80 : nodeType === "wall-boundary" ? 100 : 100;
  const diameterLimit = nodeType === "transfer" ? 10 : nodeType === "wall-boundary" ? 8 : 8;
  if (nodeType === "beam-column" && c.type !== "BEAM" && c.type !== "COLUMN") {
    push({ rule: "阶段C：特殊抗震节点适用性", severity: "warn", message: "梁柱节点建议用于梁或柱构件，请确认当前构件类型是否合适" });
  }
  if (nodeType === "wall-boundary" && c.type !== "SHEAR_WALL") {
    push({ rule: "阶段C：特殊抗震节点适用性", severity: "warn", message: "墙边缘节点建议用于剪力墙构件，请确认当前构件类型是否合适" });
  }
  if (nodeType === "transfer" && c.concrete.seismic !== "ONE" && c.concrete.seismic !== "TWO") {
    push({ rule: "阶段C：转换节点抗震等级", severity: "warn", message: "转换节点建议按更高抗震等级进行专项复核，当前不是一级或二级" });
  }
  if (hoopSpacing <= 0 || hoopDiameter <= 0) {
    push({ rule: "阶段C：特殊抗震节点", severity: "warn", message: "请补充节点箍筋间距和直径，用于复核核心区加密" });
    return;
  }
  if (hoopSpacing > spacingLimit || hoopDiameter < diameterLimit) {
    push({ rule: "阶段C：特殊抗震节点", severity: "error", message: `${typeName}箍筋 ${hoopDiameter}mm@${hoopSpacing}mm 不满足建议控制值：直径 >= ${diameterLimit}mm 且间距 <= ${spacingLimit}mm` });
  } else {
    push({ rule: "阶段C：特殊抗震节点", severity: "pass", message: `${typeName}箍筋 ${hoopDiameter}mm@${hoopSpacing}mm 满足特殊抗震节点加密建议` });
  }
  const maxDia = maxMainBarDiameter(c);
  const minAnchor = Math.max(12 * maxDia, 200);
  if ((node.anchorLength ?? 0) <= 0) {
    push({ rule: "阶段C：节点锚固复核", severity: "warn", message: "建议录入节点纵筋锚固长度，用于详图级复核" });
  } else if ((node.anchorLength ?? 0) < minAnchor) {
    push({ rule: "阶段C：节点锚固复核", severity: "warn", message: `节点锚固长度 ${node.anchorLength}mm < 建议值 ${minAnchor}mm，应复核纵筋锚固或弯折构造` });
  } else {
    push({ rule: "阶段C：节点锚固复核", severity: "pass", message: `节点锚固长度 ${node.anchorLength}mm >= 建议值 ${minAnchor}mm` });
  }
  if (nodeType === "wall-boundary") {
    const wallLength = c.geometry.L ?? 0;
    const minBoundary = Math.max(0.15 * wallLength, 300);
    if ((node.boundaryLength ?? 0) <= 0) push({ rule: "阶段C：墙边缘构件", severity: "warn", message: "墙边缘节点建议录入边缘构件长度" });
    else if ((node.boundaryLength ?? 0) < minBoundary) push({ rule: "阶段C：墙边缘构件", severity: "warn", message: `边缘构件长度 ${node.boundaryLength}mm < 建议值 ${Math.round(minBoundary)}mm，应复核边缘构件范围` });
    else push({ rule: "阶段C：墙边缘构件", severity: "pass", message: `边缘构件长度 ${node.boundaryLength}mm 已达到建议范围` });
  }
  if (nodeType === "transfer") {
    const memberDepth = c.geometry.h ?? c.geometry.t ?? 0;
    const transferDepth = node.transferDepth ?? memberDepth;
    if (transferDepth <= 0) push({ rule: "阶段C：转换构件深度", severity: "warn", message: "转换节点建议录入转换梁/板深度" });
    else if (transferDepth < 800) push({ rule: "阶段C：转换构件深度", severity: "warn", message: `转换构件深度 ${transferDepth}mm 偏小，建议结合转换层专项设计复核` });
    else push({ rule: "阶段C：转换构件深度", severity: "pass", message: `转换构件深度 ${transferDepth}mm 已录入` });
  }
  if (!node.detailReference?.trim()) {
    const recommended = recommendedDetailReference(nodeType);
    push({ rule: "阶段C：详图索引", severity: "warn", message: `建议填写详图索引，推荐参考：${recommended.reference}（${recommended.title}）` });
  } else {
    push({ rule: "阶段C：详图索引", severity: "pass", message: `已关联详图索引：${node.detailReference}` });
  }
  if (nodeType === "custom" && !node.note?.trim()) {
    push({ rule: "阶段C：自定义节点说明", severity: "warn", message: "自定义节点建议填写备注，说明节点位置、构造做法和详图来源" });
  } else if (node.note?.trim()) {
    push({ rule: "阶段C：节点说明", severity: "pass", message: "已填写特殊节点备注，可用于后续详图复核" });
  }
}

function checkBeamColumnNodes(cs: Component[]): ValidationItem[] {
  const out: ValidationItem[] = [];
  const beams = cs.filter((c) => c.type === "BEAM");
  const cols = cs.filter((c) => c.type === "COLUMN");
  if (beams.length === 0 || cols.length === 0) return out;
  const TOL = 600;
  for (const b of beams) {
    const L = b.geometry.L ?? 0;
    const ang = ((b.placement.rot ?? 0) * Math.PI) / 180;
    const cx = Math.cos(ang), sx = Math.sin(ang);
    const ends = [
      { x: b.placement.x - (L / 2) * cx, z: b.placement.z + (L / 2) * sx },
      { x: b.placement.x + (L / 2) * cx, z: b.placement.z - (L / 2) * sx },
    ];
    for (const e of ends) {
      const col = cols.find((cl) => Math.hypot(cl.placement.x - e.x, cl.placement.z - e.z) < TOL);
      if (col) {
        out.push({ componentId: b.id, rule: "梁柱节点", severity: "pass", message: `${b.name} 与 ${col.name} 形成节点，核心区箍筋按柱端加密构造复核` });
        out.push({ componentId: col.id, rule: "梁柱节点核心区", severity: "warn", message: `节点核心区需按柱端加密区配置贯通箍筋` });
      }
    }
  }
  return out;
}

export function validateComponent(c: Component): ValidationItem[] {
  const out: ValidationItem[] = [];
  const ctx: Ctx = { c, push: (r) => out.push({ componentId: c.id, ...r }) };
  checkCover(ctx);
  if (c.type === "BEAM") checkBeam(ctx);
  else if (c.type === "COLUMN") checkColumn(ctx);
  else if (c.type === "SLAB") checkSlab(ctx);
  else if (c.type === "SHEAR_WALL") checkShearWall(ctx);
  else if (c.type === "STAIR") checkStair(ctx);
  else if (c.type === "FOUND" || c.type === "STRIP_FOUND" || c.type === "PILE_CAP" || c.type === "RAFT") checkFoundationLike(ctx);
  else if (c.type === "PILE") checkPile(ctx);
  checkOpenings(ctx);
  checkVariableSection(ctx);
  checkSpecialSeismicNode(ctx);
  return out;
}

export function validateAll(cs: Component[]): ValidationItem[] {
  const items = cs.flatMap(validateComponent);
  items.push(...checkBeamColumnNodes(cs));
  const collisions = detectCollisions(cs);
  items.push(...collisionsToValidations(collisions));
  return items;
}
