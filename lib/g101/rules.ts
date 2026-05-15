// 22G101 平法校验规则引擎（依据 22G101-1 / 22G101-3）

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

type Ctx = { c: Component; push: (r: Omit<ValidationItem, "componentId">) => void };

/** 保护层厚度校验 — 22G101-1 / 22G101-3 第2-1页 */
function checkCover({ c, push }: Ctx) {
  const memberType = c.type === "BEAM" ? "beam" : c.type === "COLUMN" ? "column" : c.type === "SLAB" ? "slab" : "beam";
  const min = minCover(c.concrete.env, memberType as any, c.concrete.grade);
  if (c.concrete.cover < min) {
    push({
      rule: "保护层厚度",
      severity: "error",
      message: `保护层 ${c.concrete.cover}mm 小于环境 ${c.concrete.env} 最小值 ${min}mm`,
    });
  } else {
    push({ rule: "保护层厚度", severity: "pass", message: `保护层 ${c.concrete.cover}mm ≥ ${min}mm` });
  }
}

/** 梁校验 — 22G101-1 第2-39、2-41页 */
function checkBeam(ctx: Ctx) {
  const { c, push } = ctx;
  const { b = 0, h = 0, L = 0 } = c.geometry;
  const seismic = c.concrete.seismic;
  const cover = c.concrete.cover;
  if (b <= 0 || h <= 0 || L <= 0) {
    push({ rule: "梁尺寸", severity: "error", message: "梁截面 b×h×L 必须大于 0" });
    return;
  }

  // 箍筋校验
  const stirrup = c.rebars.find((r) => r.role === "STIRRUP");
  if (!stirrup) {
    push({ rule: "梁箍筋", severity: "error", message: "梁缺少箍筋配置" });
  } else {
    if ((stirrup.diameter ?? 0) < 6) {
      push({ rule: "箍筋直径", severity: "error", message: `箍筋直径 ${stirrup.diameter}mm < 6mm` });
    }
    // 取纵筋直径用于间距校验（22G101-1 第2-39页）
    const longBars = c.rebars.filter((r) => r.role === "TOP" || r.role === "BOTTOM");
    const longDia = longBars[0]?.diameter ?? stirrup.diameter;

    if (seismic !== "NONE") {
      const reqZone = beamDensifyZoneLength(seismic, h);
      if (!stirrup.densifyLength || stirrup.densifyLength < reqZone) {
        push({
          rule: "梁端箍筋加密区长度",
          severity: "error",
          message: `加密区长度 ${stirrup.densifyLength ?? 0}mm < 要求 ${Math.round(reqZone)}mm`,
        });
      } else {
        push({ rule: "梁端箍筋加密区长度", severity: "pass", message: `加密区 ${stirrup.densifyLength}mm ≥ ${Math.round(reqZone)}mm` });
      }
      const denseMax = beamStirrupMaxSpacingDense(seismic, h, longDia);
      const sd = stirrup.densifySpacing ?? stirrup.spacing ?? 9999;
      if (sd > denseMax) {
        push({ rule: "梁箍筋加密区间距", severity: "error", message: `加密间距 ${sd}mm > ${Math.round(denseMax)}mm（min(hb/4, ${seismic === "ONE" ? 6 : 8}d, ${seismic === "ONE" ? 100 : 100})）` });
      } else {
        push({ rule: "梁箍筋加密区间距", severity: "pass", message: `加密间距 ${sd}mm ≤ ${Math.round(denseMax)}mm` });
      }
    }
    const normMax = beamStirrupMaxSpacingNormal(seismic, h, longDia);
    if ((stirrup.spacing ?? 0) > normMax) {
      push({ rule: "梁箍筋非加密区间距", severity: "warn", message: `非加密间距 ${stirrup.spacing}mm > ${Math.round(normMax)}mm` });
    } else if (stirrup.spacing) {
      push({ rule: "梁箍筋非加密区间距", severity: "pass", message: `非加密间距 ${stirrup.spacing}mm ≤ ${Math.round(normMax)}mm` });
    }
  }

  // 纵筋最小配筋率 — GB 50010-2010
  const bottoms = c.rebars.filter((r) => r.role === "BOTTOM");
  const As = bottoms.reduce((s, r) => s + (r.count ?? 0) * Math.PI * (r.diameter / 2) ** 2, 0);
  const rho = (As / (b * h)) * 100;
  const rhoMin = minRhoBeam(c.concrete.grade, bottoms[0]?.grade ?? "HRB400");
  if (rho < rhoMin) {
    push({ rule: "梁纵筋配筋率", severity: "error", message: `ρ=${rho.toFixed(3)}% < ρmin=${rhoMin.toFixed(3)}%` });
  } else {
    push({ rule: "梁纵筋配筋率", severity: "pass", message: `ρ=${rho.toFixed(3)}% ≥ ${rhoMin.toFixed(3)}%` });
  }

  // 梁侧面构造钢筋 — 22G101-1 第2-41页
  const topDia = c.rebars.find((r) => r.role === "TOP")?.diameter ?? 20;
  if (needSideRebar(h, cover, topDia)) {
    const sides = c.rebars.filter((r) => r.role === "SIDE" || r.role === "LONGITUDINAL");
    const hw = h - cover - topDia;
    const minArea = minSideRebarArea(b, h, cover, topDia);
    const actualArea = sides.reduce((s, r) => s + (r.count ?? 0) * Math.PI * (r.diameter / 2) ** 2, 0);
    if (sides.length === 0) {
      push({ rule: "梁侧面构造钢筋", severity: "warn", message: `梁腹板高度 hw=${hw}mm ≥ 450mm，应配置侧面构造钢筋` });
    } else if (actualArea < minArea) {
      push({ rule: "梁侧面构造钢筋", severity: "warn", message: `侧面构造钢筋面积 ${actualArea.toFixed(0)}mm² < 要求 ${minArea.toFixed(0)}mm²（0.1%×b×hw）` });
    } else {
      push({ rule: "梁侧面构造钢筋", severity: "pass", message: `侧面构造钢筋面积 ${actualArea.toFixed(0)}mm² ≥ ${minArea.toFixed(0)}mm²` });
    }
  }

  // 梁纵筋间距 — 22G101-1 第2-8页
  for (const r of c.rebars.filter((r) => r.role === "TOP" || r.role === "BOTTOM")) {
    if (r.count && r.count > 1) {
      const spacing = (b - 2 * cover) / (r.count - 1);
      const minSpacing = beamLongBarMaxSpacing(r.grade, r.diameter, r.role === "TOP");
      if (spacing < minSpacing) {
        push({ rule: "梁纵筋间距", severity: "warn", message: `${r.role} 间距 ${spacing.toFixed(0)}mm < ${minSpacing}mm` });
      }
    }
  }
}

/** 柱校验 — 22G101-1 第2-11页 */
function checkColumn(ctx: Ctx) {
  const { c, push } = ctx;
  const { b = 0, h = 0, L = 0 } = c.geometry;
  const seismic = c.concrete.seismic;
  if (b <= 0 || h <= 0 || L <= 0) {
    push({ rule: "柱尺寸", severity: "error", message: "柱截面 b×h×L 必须大于 0" });
    return;
  }

  // 全部纵筋配筋率
  const mains = c.rebars.filter((r) => r.role === "MAIN");
  const As = mains.reduce((s, r) => s + (r.count ?? 0) * Math.PI * (r.diameter / 2) ** 2, 0);
  const rho = (As / (b * h)) * 100;
  const rhoMin = minRhoColumn(seismic);
  if (rho < rhoMin) {
    push({ rule: "柱全部纵筋配筋率", severity: "error", message: `ρ=${rho.toFixed(3)}% < ρmin=${rhoMin}%` });
  } else {
    push({ rule: "柱全部纵筋配筋率", severity: "pass", message: `ρ=${rho.toFixed(3)}% ≥ ${rhoMin}%` });
  }

  // 柱纵筋间距 — 22G101-1 第2-8页（简化按中柱校验）
  for (const r of mains) {
    if (r.count && r.count > 1) {
      const spacing = Math.min(b, h) / (r.count - 1);
      const minSpacing = columnLongBarMinSpacing(r.diameter, true);
      if (spacing < minSpacing) {
        push({ rule: "柱纵筋间距", severity: "warn", message: `纵筋间距 ${spacing.toFixed(0)}mm < ${minSpacing}mm` });
      }
    }
  }

  // 箍筋校验
  const stirrup = c.rebars.find((r) => r.role === "STIRRUP");
  if (!stirrup) {
    push({ rule: "柱箍筋", severity: "error", message: "柱缺少箍筋配置" });
    return;
  }
  if (stirrup.diameter < 8) {
    push({ rule: "柱箍筋直径", severity: "warn", message: `箍筋直径 ${stirrup.diameter}mm 建议 ≥ 8mm` });
  }

  // 取纵筋直径和柱长边尺寸用于间距校验
  const longDia = mains[0]?.diameter ?? stirrup.diameter;
  const hc = Math.max(b, h);

  if (seismic !== "NONE") {
    const reqZone = columnDensifyZoneLength(seismic, b, h, L);
    if (!stirrup.densifyLength || stirrup.densifyLength < reqZone) {
      push({
        rule: "柱端箍筋加密区长度",
        severity: "error",
        message: `加密区长度 ${stirrup.densifyLength ?? 0}mm < 要求 ${Math.round(reqZone)}mm（max(Hn/6, hc, 500)）`,
      });
    } else {
      push({ rule: "柱端箍筋加密区长度", severity: "pass", message: `加密区 ${stirrup.densifyLength}mm ≥ ${Math.round(reqZone)}mm` });
    }
    const denseMax = columnStirrupMaxSpacingDense(seismic, hc, longDia);
    const sd = stirrup.densifySpacing ?? stirrup.spacing ?? 9999;
    if (sd > denseMax) {
      push({ rule: "柱箍筋加密间距", severity: "error", message: `加密间距 ${sd}mm > ${Math.round(denseMax)}mm` });
    } else {
      push({ rule: "柱箍筋加密间距", severity: "pass", message: `加密间距 ${sd}mm ≤ ${Math.round(denseMax)}mm` });
    }
  }
  const normMax = columnStirrupMaxSpacingNormal(seismic, hc, longDia);
  if ((stirrup.spacing ?? 0) > normMax) {
    push({ rule: "柱箍筋非加密间距", severity: "warn", message: `非加密 ${stirrup.spacing}mm > ${Math.round(normMax)}mm` });
  } else if (stirrup.spacing) {
    push({ rule: "柱箍筋非加密间距", severity: "pass", message: `非加密 ${stirrup.spacing}mm ≤ ${Math.round(normMax)}mm` });
  }
}

/** 板校验 — 22G101-1 第2-50页 */
function checkSlab(ctx: Ctx) {
  const { c, push } = ctx;
  const { Lx = 0, Ly = 0, t = 0 } = c.geometry;
  if (Lx <= 0 || Ly <= 0 || t <= 0) {
    push({ rule: "板尺寸", severity: "error", message: "板 Lx×Ly×t 必须大于 0" });
    return;
  }
  if (t < 80) {
    push({ rule: "板厚", severity: "warn", message: `板厚 ${t}mm < 80mm` });
  } else {
    push({ rule: "板厚", severity: "pass", message: `板厚 ${t}mm ≥ 80mm` });
  }

  // 板筋间距
  const dists = c.rebars.filter((r) => r.role === "DIST" || r.role === "BOTTOM" || r.role === "TOP");
  for (const d of dists) {
    if ((d.spacing ?? 0) > SLAB_DIST_MAX_SPACING) {
      push({
        rule: "板筋间距",
        severity: "warn",
        message: `${d.role} 间距 ${d.spacing}mm > ${SLAB_DIST_MAX_SPACING}mm`,
      });
    }
  }

  // 支座负筋外伸长度
  const neg = c.rebars.find((r) => r.role === "NEG");
  if (!neg) {
    push({ rule: "板支座负筋", severity: "warn", message: "未配置支座负筋" });
  } else {
    const req = slabNegExtension(Lx);
    if ((neg.extension ?? 0) < req) {
      push({
        rule: "板支座负筋外伸",
        severity: "error",
        message: `负筋外伸 ${neg.extension ?? 0}mm < Lx/4 = ${req}mm`,
      });
    } else {
      push({ rule: "板支座负筋外伸", severity: "pass", message: `外伸 ${neg.extension}mm ≥ ${req}mm` });
    }
  }

  // 板锚固长度校验 — 22G101-1 第2-50页
  const bottom = c.rebars.find((r) => r.role === "BOTTOM");
  if (bottom) {
    const la = La(c.concrete.grade, bottom.grade, bottom.diameter);
    push({ rule: "板下部纵筋锚固", severity: "pass", message: `la = ${Math.round(la)}mm` });
  }
}

/** 桩校验 — 22G101-3 第6.2.2条、第2-46~2-48页 */
function checkPile(ctx: Ctx) {
  const { c, push } = ctx;
  const { D = 0, L = 0 } = c.geometry;
  if (D <= 0 || L <= 0) {
    push({ rule: "桩基尺寸", severity: "error", message: "桩径/桩长必须大于 0" });
    return;
  }

  // 主筋根数 — JGJ 94-2008
  const main = c.rebars.find((r) => r.role === "MAIN");
  if (!main || (main.count ?? 0) < 6) {
    push({ rule: "桩主筋根数", severity: "warn", message: `灌注桩主筋宜 ≥ 6 根（当前 ${main?.count ?? 0} 根）` });
  } else {
    push({ rule: "桩主筋根数", severity: "pass", message: `主筋 ${main.count} 根 ≥ 6 根` });
  }

  // 螺旋箍筋
  const spiral = c.rebars.find((r) => r.role === "SPIRAL" || r.role === "STIRRUP");
  if (!spiral) {
    push({ rule: "桩螺旋箍筋", severity: "error", message: "桩基缺少螺旋箍筋" });
    return;
  }

  // 桩顶加密区 — 22G101-3 第6.2.2条：桩顶以下5D
  const reqZone = pileDensifyZoneLength(D);
  if (!spiral.densifyLength || spiral.densifyLength < reqZone) {
    push({
      rule: "桩顶箍筋加密区",
      severity: "warn",
      message: `加密区长度 ${spiral.densifyLength ?? 0}mm < 要求 ${reqZone}mm（5D）`,
    });
  } else {
    push({ rule: "桩顶箍筋加密区", severity: "pass", message: `加密区 ${spiral.densifyLength}mm ≥ ${reqZone}mm` });
  }

  // 桩顶进入承台高度 — 22G101-3 第6.2.2条
  const embed = D < 800 ? 50 : 100;
  push({ rule: "桩顶嵌入承台", severity: "pass", message: `桩顶嵌入承台高度 ${embed}mm（桩径${D}mm）` });
}

/** 检测梁柱节点核心区：在水平梁端点附近的柱视为节点 */
function checkBeamColumnNodes(cs: Component[]): ValidationItem[] {
  const out: ValidationItem[] = [];
  const beams = cs.filter((c) => c.type === "BEAM");
  const cols = cs.filter((c) => c.type === "COLUMN");
  if (beams.length === 0 || cols.length === 0) return out;
  const TOL = 600; // mm 容差
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
        out.push({
          componentId: b.id,
          rule: "梁柱节点",
          severity: "pass",
          message: `${b.name} 与 ${col.name} 形成节点（核心区箍筋按柱端加密构造）`,
        });
        out.push({
          componentId: col.id,
          rule: "梁柱节点核心区",
          severity: "warn",
          message: `节点核心区需按柱端加密区配置贯通箍筋`,
        });
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
  else if (c.type === "PILE") checkPile(ctx);
  return out;
}

export function validateAll(cs: Component[]): ValidationItem[] {
  const items = cs.flatMap(validateComponent);
  items.push(...checkBeamColumnNodes(cs));
  // 22G101 构件碰撞检测（混凝土重叠区 + 钢筋冲突）
  const collisions = detectCollisions(cs);
  items.push(...collisionsToValidations(collisions));
  return items;
}
