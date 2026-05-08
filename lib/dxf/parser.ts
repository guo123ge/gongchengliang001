// DXF 解析（轻量子集） + SVG 渲染 + 图层过滤 + 端点提取
import DxfParser from "dxf-parser";

export interface DxfBBox { minX: number; minY: number; maxX: number; maxY: number }
export interface DxfEntity {
  type: string;
  layer: string;
  raw: any;
}
export interface DxfLayer {
  name: string;
  color?: number;
}
export interface DxfEndpoint { x: number; y: number }
export interface DxfParseResult {
  entities: DxfEntity[];
  layers: DxfLayer[];
  bbox: DxfBBox;
  endpoints: DxfEndpoint[];
  counts: Record<string, number>;
  total: number;
}

const DEFAULT_STROKE = "#1f2937";

function bboxUpdate(b: DxfBBox, x: number, y: number) {
  if (!isFinite(x) || !isFinite(y)) return;
  if (x < b.minX) b.minX = x;
  if (y < b.minY) b.minY = y;
  if (x > b.maxX) b.maxX = x;
  if (y > b.maxY) b.maxY = y;
}

export function parseDxf(text: string): DxfParseResult {
  const parser = new (DxfParser as any)();
  const dxf: any = parser.parseSync(text);
  const rawEnts: any[] = dxf?.entities ?? [];
  const layersMap: any = dxf?.tables?.layer?.layers ?? {};
  const layers: DxfLayer[] = Object.values(layersMap).map((l: any) => ({ name: l.name, color: l.color }));
  const entities: DxfEntity[] = rawEnts.map((e: any) => ({ type: e.type, layer: e.layer || "0", raw: e }));
  const counts: Record<string, number> = {};
  const bbox: DxfBBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const endpoints: DxfEndpoint[] = [];
  const seen = new Set<string>();
  const addEndpoint = (x: number, y: number) => {
    if (!isFinite(x) || !isFinite(y)) return;
    const key = `${Math.round(x * 10)}|${Math.round(y * 10)}`;
    if (seen.has(key)) return;
    seen.add(key);
    endpoints.push({ x, y });
  };
  for (const e of entities) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
    const r = e.raw;
    switch (e.type) {
      case "LINE": {
        const a = r.vertices[0], b = r.vertices[1];
        bboxUpdate(bbox, a.x, a.y); bboxUpdate(bbox, b.x, b.y);
        addEndpoint(a.x, a.y); addEndpoint(b.x, b.y);
        break;
      }
      case "LWPOLYLINE":
      case "POLYLINE": {
        const vs: any[] = r.vertices ?? [];
        for (const v of vs) bboxUpdate(bbox, v.x, v.y);
        if (vs.length > 0) {
          addEndpoint(vs[0].x, vs[0].y);
          addEndpoint(vs[vs.length - 1].x, vs[vs.length - 1].y);
        }
        break;
      }
      case "CIRCLE":
        bboxUpdate(bbox, r.center.x - r.radius, r.center.y - r.radius);
        bboxUpdate(bbox, r.center.x + r.radius, r.center.y + r.radius);
        addEndpoint(r.center.x, r.center.y); // 圆心作为吸附点
        break;
      case "ARC": {
        bboxUpdate(bbox, r.center.x - r.radius, r.center.y - r.radius);
        bboxUpdate(bbox, r.center.x + r.radius, r.center.y + r.radius);
        const a1 = (r.startAngle * Math.PI) / 180;
        const a2 = (r.endAngle * Math.PI) / 180;
        addEndpoint(r.center.x + r.radius * Math.cos(a1), r.center.y + r.radius * Math.sin(a1));
        addEndpoint(r.center.x + r.radius * Math.cos(a2), r.center.y + r.radius * Math.sin(a2));
        break;
      }
      case "TEXT":
      case "MTEXT": {
        const p = r.startPoint ?? r.position;
        if (p) bboxUpdate(bbox, p.x, p.y);
        break;
      }
    }
  }
  if (!isFinite(bbox.minX)) {
    bbox.minX = 0; bbox.minY = 0; bbox.maxX = 100; bbox.maxY = 100;
  }
  // 补全图层（实体可能引用未在 LAYER 表中显式声明的图层）
  const layerNames = new Set(layers.map((l) => l.name));
  for (const e of entities) {
    if (!layerNames.has(e.layer)) {
      layers.push({ name: e.layer });
      layerNames.add(e.layer);
    }
  }
  return { entities, layers, bbox, endpoints, counts, total: entities.length };
}

/** 渲染（可选过滤图层） */
export function renderDxfToSvg(
  entities: DxfEntity[],
  bbox: DxfBBox,
  activeLayers?: Set<string>,
): string {
  const w = bbox.maxX - bbox.minX;
  const h = bbox.maxY - bbox.minY;
  const ox = -bbox.minX;
  const oy = bbox.maxY;
  const tx = (x: number) => x + ox;
  const ty = (y: number) => oy - y;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">`);
  parts.push(`<g stroke="${DEFAULT_STROKE}" stroke-width="${Math.max(w, h) / 1000}" fill="none" font-family="sans-serif">`);

  for (const e of entities) {
    if (activeLayers && !activeLayers.has(e.layer)) continue;
    try {
      const r = e.raw;
      switch (e.type) {
        case "LINE": {
          const a = r.vertices[0], b = r.vertices[1];
          parts.push(`<line x1="${tx(a.x)}" y1="${ty(a.y)}" x2="${tx(b.x)}" y2="${ty(b.y)}"/>`);
          break;
        }
        case "LWPOLYLINE":
        case "POLYLINE": {
          const vs = r.vertices ?? [];
          if (vs.length >= 2) {
            const d = vs.map((v: any, i: number) => `${i === 0 ? "M" : "L"}${tx(v.x)} ${ty(v.y)}`).join(" ");
            const close = r.shape || r.closed ? " Z" : "";
            parts.push(`<path d="${d}${close}"/>`);
          }
          break;
        }
        case "CIRCLE":
          parts.push(`<circle cx="${tx(r.center.x)}" cy="${ty(r.center.y)}" r="${r.radius}"/>`);
          break;
        case "ARC": {
          const rd = r.radius, cx = r.center.x, cy = r.center.y;
          const a1 = (r.startAngle * Math.PI) / 180;
          const a2 = (r.endAngle * Math.PI) / 180;
          const x1 = cx + rd * Math.cos(a1), y1 = cy + rd * Math.sin(a1);
          const x2 = cx + rd * Math.cos(a2), y2 = cy + rd * Math.sin(a2);
          let delta = a2 - a1;
          while (delta < 0) delta += 2 * Math.PI;
          const large = delta > Math.PI ? 1 : 0;
          parts.push(`<path d="M${tx(x1)} ${ty(y1)} A${rd} ${rd} 0 ${large} 0 ${tx(x2)} ${ty(y2)}"/>`);
          break;
        }
        case "TEXT":
        case "MTEXT": {
          const p = r.startPoint ?? r.position;
          if (!p) break;
          const txt = (r.text ?? "").toString().replace(/[<>&]/g, "");
          const sz = r.height || r.textHeight || w / 200;
          parts.push(`<text x="${tx(p.x)}" y="${ty(p.y)}" font-size="${sz}" fill="${DEFAULT_STROKE}" stroke="none">${txt}</text>`);
          break;
        }
      }
    } catch { /* skip */ }
  }
  parts.push(`</g></svg>`);
  return parts.join("");
}

export async function rasterizeSvg(svg: string, maxPx = 2048): Promise<{ dataUrl: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height || 1;
      const w = ratio >= 1 ? maxPx : Math.round(maxPx * ratio);
      const h = ratio >= 1 ? Math.round(maxPx / ratio) : maxPx;
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      const ctx = cv.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve({ dataUrl: cv.toDataURL("image/png"), w, h });
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

/** 端点 DXF 局部坐标 → 3D 场景世界坐标（米，XZ 平面） */
export function endpointsToScene(
  endpoints: DxfEndpoint[],
  bbox: DxfBBox,
  bp: { offsetX: number; offsetZ: number; rotation: number; scale: number },
): { x: number; z: number }[] {
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const ang = (bp.rotation * Math.PI) / 180;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  return endpoints.map((p) => {
    // 蓝图平面在 XZ：DXF X → 场景 X，DXF Y → 场景 -Z（因为 PlaneGeometry 旋转 -90°）
    let lx = (p.x - cx) * bp.scale; // mm
    let ly = (p.y - cy) * bp.scale;
    // PlaneGeometry rotation.x = -PI/2 → 原 +Y 映射到 -Z
    let sx = lx;
    let sz = -ly;
    // 平面再绕世界 Y 旋转 bp.rotation
    const rx = sx * ca + sz * sa;
    const rz = -sx * sa + sz * ca;
    return {
      x: (rx + bp.offsetX) / 1000,
      z: (rz + bp.offsetZ) / 1000,
    };
  });
}
