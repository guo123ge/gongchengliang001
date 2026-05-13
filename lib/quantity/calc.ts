// 工程量计算（阶段 A + B）
import type { Component, QuantityResult, Rebar } from "../types";
import { REBAR_UNIT_WEIGHT, La } from "../g101/tables";

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

  if (c.type === "BEAM" || c.type === "COLUMN") {
    const L = g.L ?? 0;
    const b = g.b ?? 0;
    const h = g.h ?? 0;
    if (r.role === "STIRRUP") {
      const per = 2 * ((b - 2 * cover) + (h - 2 * cover)) + 2 * 75; // 弯钩 75mm × 2
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
      const perBar = Lx + 2 * la;
      return { totalLenM: (perBar * n) / 1000, countTotal: n };
    }
    return { totalLenM: 0, countTotal: 0 };
  }

  if (c.type === "PILE") {
    const L = g.L ?? 0;
    const D = g.D ?? 0;
    if (r.role === "SPIRAL" || r.role === "STIFFEN" || r.role === "STIRRUP") {
      const per = Math.PI * (D - 2 * cover);
      const n = r.spacing ? Math.floor(L / r.spacing) + 1 : 0;
      return { totalLenM: (per * n) / 1000, countTotal: n };
    }
    const n = r.count ?? 0;
    return { totalLenM: ((L + la) * n) / 1000, countTotal: n };
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
