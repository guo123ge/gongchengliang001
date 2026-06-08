import type { Component, QuantityResult, Rebar } from "../types";
import { La, LaE, REBAR_UNIT_WEIGHT, pileEmbedDepth, stirrupHookLength } from "../g101/tables";

function beamEndAnchor(hc: number, cover: number, laEValue: number, d: number): number {
  const horizontal = hc - cover;
  if (horizontal >= laEValue) return laEValue;
  return Math.max(0.4 * laEValue, horizontal) + 15 * d;
}

function stairDerived(g: Component["geometry"]) {
  const width = Math.max(0, g.b ?? 0);
  const horizontal = Math.max(0, g.L ?? 0);
  const riser = Math.max(0, g.h ?? 0);
  const thickness = Math.max(0, g.t ?? 0);
  const steps = Math.max(1, Math.round(g.stairSteps ?? 10));
  const landingLength = Math.max(0, g.stairLandingLength ?? 0);
  const landingThickness = Math.max(0, g.stairLandingThickness ?? thickness);
  const totalRise = riser * steps;
  const slopeLength = Math.hypot(horizontal, totalRise);
  return { width, horizontal, riser, thickness, steps, landingLength, landingThickness, totalRise, slopeLength };
}

function geomMetrics(c: Component): { volume: number; formwork: number } {
  const g = c.geometry;
  if (c.type === "BEAM" || c.type === "COLUMN") {
    const b = (g.b ?? 0) / 1000;
    const h = (g.h ?? 0) / 1000;
    const L = (g.L ?? 0) / 1000;
    const volume = b * h * L;
    const formwork = c.type === "BEAM" ? 2 * h * L + b * L : 2 * (b + h) * L;
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
  if (c.type === "SHEAR_WALL") {
    const b = (g.b ?? 0) / 1000;
    const h = (g.h ?? 0) / 1000;
    const L = (g.L ?? 0) / 1000;
    return { volume: b * h * L, formwork: 2 * h * L };
  }
  if (c.type === "STAIR") {
    const stair = stairDerived(g);
    const b = stair.width / 1000;
    const L = stair.horizontal / 1000;
    const h = stair.riser / 1000;
    const t = stair.thickness / 1000;
    const slope = stair.slopeLength / 1000;
    const landingL = stair.landingLength / 1000;
    const landingT = stair.landingThickness / 1000;
    const tread = L / stair.steps;
    const slabVolume = b * slope * t;
    const stepVolume = 0.5 * b * L * h;
    const landingVolume = b * landingL * landingT;
    const bottomFormwork = b * slope;
    const landingFormwork = landingL > 0 ? b * landingL + 2 * (b + landingL) * landingT : 0;
    const sideFormwork = 2 * (slope * t + stair.steps * (tread * h + 0.5 * tread * h));
    const riserFormwork = b * h * stair.steps;
    return { volume: slabVolume + stepVolume + landingVolume, formwork: bottomFormwork + landingFormwork + sideFormwork + riserFormwork };
  }
  if (c.type === "FOUND" || c.type === "PILE_CAP") {
    const Lx = (g.Lx ?? 0) / 1000;
    const Ly = (g.Ly ?? 0) / 1000;
    const t = (g.t ?? 0) / 1000;
    return { volume: Lx * Ly * t, formwork: 2 * (Lx + Ly) * t };
  }
  if (c.type === "STRIP_FOUND") {
    const b = (g.b ?? 0) / 1000;
    const h = (g.h ?? 0) / 1000;
    const L = (g.L ?? 0) / 1000;
    return { volume: b * h * L, formwork: (2 * h + b) * L };
  }
  if (c.type === "RAFT") {
    const Lx = (g.Lx ?? 0) / 1000;
    const Ly = (g.Ly ?? 0) / 1000;
    const t = (g.t ?? 0) / 1000;
    return { volume: Lx * Ly * t, formwork: Lx * Ly + 2 * (Lx + Ly) * t };
  }
  return { volume: 0, formwork: 0 };
}

function quantityNotes(c: Component): string[] {
  const g = c.geometry;
  if (c.type === "STAIR") {
    const stair = stairDerived(g);
    return [
      `楼梯斜板长度约 ${Math.round(stair.slopeLength)}mm，踏步数 ${stair.steps}。`,
      stair.landingLength > 0
        ? `休息平台长度 ${stair.landingLength}mm、平台板厚 ${stair.landingThickness}mm 已纳入混凝土、模板和钢筋长度估算。`
        : "未录入休息平台长度，当前仅计算梯段斜板和踏步附加量。",
      "楼梯混凝土按斜板体积、踏步三角附加体积和平台板体积分项估算。",
    ];
  }
  if (c.type === "SLAB" && g.slabSupport) {
    const supportName = g.slabSupport.type === "continuous" ? "连续支座" : g.slabSupport.type === "cantilever" ? "悬挑支座" : "端支座";
    return [`板支座按${supportName}取值，负筋外伸比例 ${g.slabSupport.spanRatio ?? "默认"} 已参与校验和钢筋长度估算。`];
  }
  if (c.type === "PILE") return ["灌注桩钢筋按主筋、螺旋箍、加劲箍分项估算，并计入桩顶嵌入承台长度。"];
  return [];
}

function gridCount(length: number, spacing?: number): number {
  return spacing && spacing > 0 ? Math.floor(length / spacing) + 1 : 0;
}

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
      const hook = stirrupHookLength(r.diameter, seismic);
      const per = 2 * ((b - 2 * cover) + (h - 2 * cover)) + 2 * hook;
      const denseLength = r.densifyLength ?? 0;
      const denseSpacing = r.densifySpacing;
      const spacing = r.spacing ?? 0;
      let n = 0;
      if (denseLength > 0 && denseSpacing && denseSpacing > 0) {
        n += 2 * (Math.floor(denseLength / denseSpacing) + 1);
        const middle = Math.max(0, L - 2 * denseLength);
        if (spacing > 0 && middle > 0) n += Math.max(0, Math.floor(middle / spacing) - 1);
      } else if (spacing > 0) {
        n = Math.floor(L / spacing) + 1;
      }
      return { totalLenM: (per * n) / 1000, countTotal: n };
    }

    if (r.role === "SIDE" || (c.type === "BEAM" && r.role === "LONGITUDINAL")) {
      const n = r.count ?? 0;
      const perBar = L + 2 * 15 * r.diameter;
      return { totalLenM: (perBar * n) / 1000, countTotal: n };
    }

    if (c.type === "BEAM") {
      const hc = g.hc ?? 500;
      const laEValue = seismic ? LaE(c.concrete.grade, r.grade, r.diameter, c.concrete.seismic) : la;
      if (r.role === "TOP" || r.role === "BENT" || r.role === "ADDITIONAL" || r.role === "BOTTOM") {
        const anchor = beamEndAnchor(hc, cover, laEValue, r.diameter);
        const n = r.count ?? 0;
        return { totalLenM: ((L + 2 * anchor) * n) / 1000, countTotal: n };
      }
      if (r.role === "ERECTION") {
        const n = r.count ?? 0;
        return { totalLenM: ((L + 2 * 150) * n) / 1000, countTotal: n };
      }
    }

    const n = r.count ?? 0;
    const perBar = L + 2 * la;
    return { totalLenM: (perBar * n) / 1000, countTotal: n };
  }

  if (c.type === "SLAB") {
    const Lx = g.Lx ?? 0;
    const Ly = g.Ly ?? 0;
    if (r.role === "NEG") {
      const support = g.slabSupport;
      const ratio = support?.spanRatio ?? (support?.type === "continuous" ? 1 / 3 : support?.type === "cantilever" ? 1 : 1 / 4);
      const ext = r.extension ?? Math.round(Lx * ratio);
      const perBar = 2 * ext + 200;
      const n = gridCount(Ly, r.spacing);
      return { totalLenM: (perBar * n) / 1000, countTotal: n };
    }
    if (r.spacing) {
      const n = gridCount(Ly, r.spacing);
      const anchor = Math.max(100, 5 * r.diameter);
      const perBar = Lx + 2 * anchor;
      return { totalLenM: (perBar * n) / 1000, countTotal: n };
    }
    return { totalLenM: 0, countTotal: 0 };
  }

  if (c.type === "SHEAR_WALL") {
    const L = g.L ?? 0;
    const h = g.h ?? 0;
    if (r.role === "HORIZONTAL") {
      const n = gridCount(h, r.spacing);
      const perBar = L + 2 * la;
      return { totalLenM: (perBar * n) / 1000, countTotal: n };
    }
    if (r.role === "VERTICAL") {
      const n = gridCount(L, r.spacing);
      const perBar = h + 1.2 * la;
      return { totalLenM: (perBar * n) / 1000, countTotal: n };
    }
    if (r.role === "TIE") {
      const nH = gridCount(h, r.spacing);
      const nL = gridCount(L, r.spacing);
      const n = nH * nL;
      const perBar = (g.b ?? 200) + 2 * 6 * r.diameter;
      return { totalLenM: (perBar * n) / 1000, countTotal: n };
    }
    return { totalLenM: 0, countTotal: 0 };
  }

  if (c.type === "STAIR") {
    const stair = stairDerived(g);
    if (r.role === "LONGITUDINAL") {
      const n = gridCount(stair.width, r.spacing);
      const perBar = stair.slopeLength + stair.landingLength + 2 * la;
      return { totalLenM: (perBar * n) / 1000, countTotal: n };
    }
    if (r.role === "DIST") {
      const n = gridCount(stair.slopeLength + stair.landingLength, r.spacing);
      const perBar = stair.width;
      return { totalLenM: (perBar * n) / 1000, countTotal: n };
    }
    if (r.role === "CONSTRUCT") {
      const n = r.count ?? 2;
      const perBar = stair.slopeLength + stair.landingLength + 2 * la;
      return { totalLenM: (perBar * n) / 1000, countTotal: n };
    }
    return { totalLenM: 0, countTotal: 0 };
  }

  if (c.type === "FOUND" || c.type === "PILE_CAP") {
    const Lx = g.Lx ?? 0;
    const Ly = g.Ly ?? 0;
    if (r.role === "BOT_X" || r.role === "TOP_X") {
      const n = gridCount(Ly, r.spacing);
      const perBar = Lx + 2 * la;
      return { totalLenM: (perBar * n) / 1000, countTotal: n };
    }
    if (r.role === "BOT_Y" || r.role === "TOP_Y") {
      const n = gridCount(Lx, r.spacing);
      const perBar = Ly + 2 * la;
      return { totalLenM: (perBar * n) / 1000, countTotal: n };
    }
    if (r.role === "TIE") {
      const nX = gridCount(Lx, r.spacing);
      const nY = gridCount(Ly, r.spacing);
      const t = g.t ?? 0;
      const n = nX * nY;
      return { totalLenM: ((t - 2 * cover + 2 * 6 * r.diameter) * n) / 1000, countTotal: n };
    }
    return { totalLenM: 0, countTotal: 0 };
  }

  if (c.type === "STRIP_FOUND") {
    const b = g.b ?? 0;
    const L = g.L ?? 0;
    if (r.role === "TRANSVERSE") {
      const n = gridCount(L, r.spacing);
      const perBar = b + 2 * la;
      return { totalLenM: (perBar * n) / 1000, countTotal: n };
    }
    if (r.role === "LONGITUDINAL") {
      const n = r.count ?? 0;
      const perBar = L + 2 * la;
      return { totalLenM: (perBar * n) / 1000, countTotal: n };
    }
    return { totalLenM: 0, countTotal: 0 };
  }

  if (c.type === "RAFT") {
    const Lx = g.Lx ?? 0;
    const Ly = g.Ly ?? 0;
    if (r.role === "BOT_X" || r.role === "TOP_X") {
      const n = gridCount(Ly, r.spacing);
      const perBar = Lx + 2 * la;
      return { totalLenM: (perBar * n) / 1000, countTotal: n };
    }
    if (r.role === "BOT_Y" || r.role === "TOP_Y") {
      const n = gridCount(Lx, r.spacing);
      const perBar = Ly + 2 * la;
      return { totalLenM: (perBar * n) / 1000, countTotal: n };
    }
    if (r.role === "TIE") {
      const nX = gridCount(Lx, r.spacing);
      const nY = gridCount(Ly, r.spacing);
      const t = g.t ?? 0;
      const n = nX * nY;
      return { totalLenM: ((t - 2 * cover + 2 * 6 * r.diameter) * n) / 1000, countTotal: n };
    }
    return { totalLenM: 0, countTotal: 0 };
  }

  if (c.type === "PILE") {
    const L = g.L ?? 0;
    const D = g.D ?? 0;
    if (r.role === "SPIRAL") {
      const denseLength = r.densifyLength ?? 0;
      const denseSpacing = r.densifySpacing;
      const spacing = r.spacing ?? 0;
      const per = Math.PI * (D - 2 * cover);
      let n = 0;
      if (denseLength > 0 && denseSpacing && denseSpacing > 0) {
        n += Math.floor(denseLength / denseSpacing) + 1;
        const middle = Math.max(0, L - denseLength);
        if (spacing > 0 && middle > 0) n += Math.max(0, Math.floor(middle / spacing) - 1);
      } else if (spacing > 0) {
        n = Math.floor(L / spacing) + 1;
      }
      return { totalLenM: (per * n) / 1000, countTotal: n };
    }
    if (r.role === "STIFFEN") {
      const per = Math.PI * (D - 2 * cover) + 80;
      const n = r.count ?? 0;
      return { totalLenM: (per * n) / 1000, countTotal: n };
    }
    if (r.role === "STIRRUP") {
      const per = Math.PI * (D - 2 * cover);
      const n = gridCount(L, r.spacing);
      return { totalLenM: (per * n) / 1000, countTotal: n };
    }
    const n = r.count ?? 0;
    const perBar = L + la + pileEmbedDepth(D);
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
    notes: quantityNotes(c),
  };
}

export function calcAll(cs: Component[]): QuantityResult[] {
  return cs.map(calcComponent);
}

export function aggregate(results: QuantityResult[]) {
  const rebar: Record<string, { weight: number; length: number; grade: string }> = {};
  let volume = 0;
  let formwork = 0;
  let rebarTotal = 0;
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
