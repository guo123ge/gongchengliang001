// 工程量计算（阶段 A + B）
import type { Component, QuantityResult, Rebar } from "../types";
import { REBAR_UNIT_WEIGHT, La, stirrupHookLength, pileEmbedDepth } from "../g101/tables";

/** 构件几何体积 m³ 与模板面积 m² */
function geomMetrics(c: Component): { volume: number; formwork: number } {
  const g = c.geometry;
  if (c.type === "BEAM" || c.type === "COLUMN") {
    const b = (g.b ?? 0) / 1000;
    const h = (g.h ?? 0) / 1000;
    const L = (g.L ?? 0) / 1000;
    const volume = b * h * L;
    const formwork = c.type === "BEAM" ? (2 * h * L + b * L) : 2 * (b + h) * L;
    return { volume, formwork };
  }
  if (c.type === "SLAB") {
    const Lx = (g.Lx ?? 0) / 1000;
    const Ly = (g.Ly ?? 0) / 1000;
    const t = (g.t ?? 0) / 1000;
    return { volume: Lx * Ly * t, formwork: Lx * Ly + 2 * (Lx + Ly) * t };
  }
  if (c.type === "PILE") {
    const D = (g.D ?? 0) / 1000;
    const L = (g.L ?? 0) / 1000;
    return { volume: Math.PI * (D / 2) ** 2 * L, formwork: Math.PI * D * L };
  }
  return { volume: 0, formwork: 0 };
}

/** 单类钢筋总长 m + 根数（含分段加密） */
function rebarTotalLength(c: Component, r: Rebar): { totalLenM: number; countTotal: number } {
  const g = c.geometry;
  const cover = c.concrete.cover;
  const la = La(c.concrete.grade, r.grade, r.diameter);
  const seismic = c.concrete.seismic !== "NONE";

  if (c.type === "BEAM" || c.type === "COLUMN") {
    const L = g.L ?? 0;
    const b = g.b ?? 0;
    const h = g.h ?? 0;
    if (r.role === "STIRRUP") {
      // 箍筋周长 + 弯钩 — 22G101-1 第2-7页
      // 抗震：135°弯钩，弯后直段 ≥ 10d 且 ≥ 75mm
      // 非抗震：90°弯钩，弯后直段 ≥ 5d
      const hook = stirrupHookLength(r.diameter, seismic);
      const per = 2 * ((b - 2 * cover) + (h - 2 * cover)) + 2 * hook;
      // 分段：两端加密 + 中部非加密
      const dz = r.densifyLength ?? 0;
      const ds = r.densifySpacing;
      const ns = r.spacing ?? 0;
      let n = 0;
      if (dz > 0 && ds && ds > 0) {
        n += 2 * (Math.floor(dz / ds) + 1);
        const middle = Math.max(0, L - 2 * dz);
        if (ns > 0 && middle > 0) n += Math.max(0, Math.floor(middle / ns) - 1);
      } else if (ns > 0) {
        n = Math.floor(L / ns) + 1;
      }
      return { totalLenM: (per * n) / 1000, countTotal: n };
    }
    if (r.role === "SIDE" || r.role === "LONGITUDINAL") {
      // 侧面构造筋 — 22G101-1 第2-41页：锚固/搭接长度可取为 15d
      const n = r.count ?? 0;
      const perBar = L + 2 * 15 * r.diameter;
      return { totalLenM: (perBar * n) / 1000, countTotal: n };
    }
    const n = r.count ?? 0;
    const perBar = L + 2 * la;
    return { totalLenM: (perBar * n) / 1000, countTotal: n };
  }

  if (c.type === "SLAB") {
    const Lx = g.Lx ?? 0;
    const Ly = g.Ly ?? 0;
    if (r.role === "NEG") {
      // 支座负筋：沿 Ly 边等距布置，单根长度 = 2 × extension + 支座宽 200（简化）
      const ext = r.extension ?? Lx / 4;
      const perBar = 2 * ext + 200;
      const n = r.spacing ? Math.floor(Ly / r.spacing) + 1 : 0;
      return { totalLenM: (perBar * n) / 1000, countTotal: n };
    }
    if (r.spacing) {
      const n = Math.floor(Ly / r.spacing) + 1;
      // 板下部纵筋锚固：伸至支座中心线且 ≥ 5d — 22G101-1 第2-50页
      const anchor = Math.max(200 / 2, 5 * r.diameter);
      const perBar = Lx + 2 * anchor;
      return { totalLenM: (perBar * n) / 1000, countTotal: n };
    }
    return { totalLenM: 0, countTotal: 0 };
  }

  if (c.type === "PILE") {
    const L = g.L ?? 0;
    const D = g.D ?? 0;
    if (r.role === "SPIRAL") {
      // 螺旋箍：桩顶加密区5D + 非加密区
      const dz = r.densifyLength ?? 0;
      const ds = r.densifySpacing;
      const ns = r.spacing ?? 0;
      const per = Math.PI * (D - 2 * cover);
      let n = 0;
      if (dz > 0 && ds && ds > 0) {
        n += Math.floor(dz / ds) + 1; // 桩顶加密区
        const middle = Math.max(0, L - dz);
        if (ns > 0 && middle > 0) n += Math.max(0, Math.floor(middle / ns) - 1);
      } else if (ns > 0) {
        n = Math.floor(L / ns) + 1;
      }
      return { totalLenM: (per * n) / 1000, countTotal: n };
    }
    if (r.role === "STIFFEN") {
      // 加劲箍：焊接闭合箍，周长 + 搭接
      const per = Math.PI * (D - 2 * cover) + 80; // 搭接80mm
      const n = r.count ?? 0;
      return { totalLenM: (per * n) / 1000, countTotal: n };
    }
    if (r.role === "STIRRUP") {
      const per = Math.PI * (D - 2 * cover);
      const n = r.spacing ? Math.floor(L / r.spacing) + 1 : 0;
      return { totalLenM: (per * n) / 1000, countTotal: n };
    }
    // 主筋：通长 + 桩顶入承台锚固 — 22G101-3 第2-48页
    const n = r.count ?? 0;
    const embed = pileEmbedDepth(D);
    const perBar = L + la + embed; // la为锚入承台长度（简化取la）
    return { totalLenM: (perBar * n) / 1000, countTotal: n };
  }
  return { totalLenM: 0, countTotal: 0 };
}

export function calcComponent(c: Component): QuantityResult {
  const { volume, formwork } = geomMetrics(c);
  const rebarByDia: QuantityResult["rebarByDia"] = {};
  let total = 0;
  for (const r of c.rebars) {
    const { totalLenM } = rebarTotalLength(c, r);
    const unit = REBAR_UNIT_WEIGHT[r.diameter] ?? 0.00617 * r.diameter ** 2;
    const weight = totalLenM * unit;
    const key = `${r.grade}-${r.diameter}`;
    if (!rebarByDia[key]) rebarByDia[key] = { weight: 0, length: 0, grade: r.grade };
    rebarByDia[key].weight += weight;
    rebarByDia[key].length += totalLenM;
    total += weight;
  }
  return {
    componentId: c.id,
    name: c.name,
    type: c.type,
    concreteVolume: volume,
    formworkArea: formwork,
    rebarByDia,
    totalRebarWeight: total,
  };
}

export function calcAll(cs: Component[]): QuantityResult[] {
  return cs.map(calcComponent);
}

export function aggregate(results: QuantityResult[]) {
  const rebar: Record<string, { weight: number; length: number; grade: string }> = {};
  let volume = 0, formwork = 0, rebarTotal = 0;
  for (const r of results) {
    volume += r.concreteVolume;
    formwork += r.formworkArea;
    rebarTotal += r.totalRebarWeight;
    for (const [k, v] of Object.entries(r.rebarByDia)) {
      if (!rebar[k]) rebar[k] = { weight: 0, length: 0, grade: v.grade };
      rebar[k].weight += v.weight;
      rebar[k].length += v.length;
    }
  }
  return { volume, formwork, rebarTotal, rebar };
}
