"use client";
import { useMemo, useRef } from "react";
import { Download, Scissors } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Component, Rebar } from "@/lib/types";
import saveAs from "file-saver";

/** 剖面图：对当前选中构件在指定轴向生成 SVG 投影，含全部钢筋、尺寸标注、钢筋规格、保护层标注 */
export default function SectionView() {
  const components = useStore((s) => s.components);
  const selectedId = useStore((s) => s.selectedId);
  const clip = useStore((s) => s.clip);
  const setClip = useStore((s) => s.setClip);
  const svgRef = useRef<SVGSVGElement>(null);

  const c = useMemo(() => components.find((x) => x.id === selectedId), [components, selectedId]);

  const { viewBox, elements, caption } = useMemo(() => buildSection(c, clip.axis), [c, clip.axis]);

  const exportPng = async () => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const xml = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([xml], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = (1200 * img.height) / img.width;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => {
        if (b) saveAs(b, `${c?.name ?? "section"}-剖面.png`);
      }, "image/png");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="p-3 space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-eng-muted">
          <input type="checkbox" checked={clip.enabled} onChange={(e) => setClip({ enabled: e.target.checked })} />
          启用 3D 剖切
        </label>
        <select className="input-eng w-20" value={clip.axis} onChange={(e) => setClip({ axis: e.target.value as any })}>
          <option value="x">X 轴</option><option value="y">Y 轴</option><option value="z">Z 轴</option>
        </select>
        <input type="number" className="input-eng w-24" value={clip.position}
          onChange={(e) => setClip({ position: +e.target.value })} placeholder="位置(mm)" />
        <button className="btn-eng ml-auto" onClick={exportPng} disabled={!c}>
          <Download className="w-3.5 h-3.5" />导出 PNG
        </button>
      </div>
      <div className="panel flex items-center justify-center bg-white text-slate-800" style={{ minHeight: 280 }}>
        {!c ? (
          <div className="text-slate-400 text-xs p-6">请选择一个构件以生成剖面图</div>
        ) : (
          <svg ref={svgRef} viewBox={viewBox} width="100%" style={{ maxHeight: 380 }}>
            <Scissors className="hidden" />
            <rect x={0} y={0} width={1000} height={600} fill="#fff" />
            {elements}
          </svg>
        )}
      </div>
      {c && <div className="text-xs text-eng-muted">{caption}</div>}
    </div>
  );
}

function buildSection(c: Component | undefined, axis: "x" | "y" | "z") {
  if (!c) return { viewBox: "0 0 1200 700", elements: null as any, caption: "" };
  const g = c.geometry;
  const cover = c.concrete.cover;
  const rebars = c.rebars;

  const W = 1200, H = 700;
  const margin = 130;

  let sw = 0, sh = 0, label = "";
  if (c.type === "BEAM") { sw = g.b ?? 300; sh = g.h ?? 600; label = `${c.name} 梁截面 ${sw}×${sh}`; }
  else if (c.type === "COLUMN") { sw = g.b ?? 500; sh = g.h ?? 500; label = `${c.name} 柱截面 ${sw}×${sh}`; }
  else if (c.type === "SLAB") { sw = g.Lx ?? 6000; sh = g.t ?? 120; label = `${c.name} 板剖面 ${sw}×${sh}`; }
  else if (c.type === "PILE") { sw = g.D ?? 800; sh = g.D ?? 800; label = `${c.name} 桩截面 D${sw}`; }

  // 板太扁时，竖直方向单独放大
  let scale = Math.min((W - 2 * margin) / sw, (H - 2 * margin) / sh);
  if (c.type === "SLAB" && sw / sh > 15) {
    const sy = (H * 0.35) / sh;
    scale = Math.max(scale, sy);
  }

  const cx = W / 2, cy = H / 2;
  const w = sw * scale, h = sh * scale;
  const x0 = cx - w / 2, y0 = cy - h / 2;

  const elems: React.ReactNode[] = [];
  const toSvg = (xm: number, ym: number) => ({ x: x0 + xm * scale, y: y0 + ym * scale });

  const bColor = (r: Rebar) => {
    if (r.role === "STIRRUP" || r.role === "SPIRAL" || r.role === "STIFFEN") return "#ea580c";
    if (r.grade === "HRB500") return "#dc2626";
    if (r.grade === "HPB300") return "#16a34a";
    return "#2563eb";
  };

  const plotBar = (xm: number, ym: number, d: number, color: string, key: string) => {
    const p = toSvg(xm, ym);
    elems.push(<circle key={key} cx={p.x} cy={p.y} r={Math.max(2.5, d * scale * 0.4)} fill={color} stroke="#111827" strokeWidth={0.6} />);
  };

  const plotText = (xm: number, ym: number, text: string, opts?: { color?: string; size?: number; anchor?: "start" | "middle" | "end"; dx?: number; dy?: number }) => {
    const p = toSvg(xm, ym);
    const o = opts ?? {};
    elems.push(
      <text key={`txt-${text}-${xm}-${ym}`} x={p.x + (o.dx ?? 0)} y={p.y + (o.dy ?? 0)}
        textAnchor={o.anchor ?? "middle"} fontSize={o.size ?? 11} fill={o.color ?? "#475569"} fontFamily="sans-serif">{text}</text>
    );
  };

  // ───────── 混凝土轮廓 + 保护层虚线 ─────────
  if (c.type === "PILE") {
    elems.push(<circle key="concrete" cx={cx} cy={cy} r={w / 2} fill="#e2e8f0" stroke="#334155" strokeWidth={1.5} />);
    elems.push(<circle key="cover" cx={cx} cy={cy} r={Math.max(0, w / 2 - cover * scale)} fill="none" stroke="#94a3b8" strokeDasharray="5 3" strokeWidth={1} />);
  } else {
    elems.push(<rect key="concrete" x={x0} y={y0} width={w} height={h} fill="#e2e8f0" stroke="#334155" strokeWidth={1.5} />);
    if (cover * scale * 2 < w && cover * scale * 2 < h) {
      elems.push(<rect key="cover" x={x0 + cover * scale} y={y0 + cover * scale} width={w - 2 * cover * scale} height={h - 2 * cover * scale} fill="none" stroke="#94a3b8" strokeDasharray="5 3" strokeWidth={1} />);
    }
  }

  // ───────── 钢筋绘制 ─────────
  if (c.type === "BEAM") {
    drawBeam(elems, rebars, sw, sh, cover, scale, x0, y0, cx, cy, toSvg, plotBar, bColor, plotText);
  } else if (c.type === "COLUMN") {
    drawColumn(elems, rebars, sw, sh, cover, scale, x0, y0, cx, cy, toSvg, plotBar, bColor, plotText);
  } else if (c.type === "SLAB") {
    drawSlab(elems, rebars, sw, sh, cover, scale, x0, y0, cx, cy, toSvg, plotBar, bColor, plotText);
  } else if (c.type === "PILE") {
    drawPile(elems, rebars, sw, sh, cover, scale, x0, y0, cx, cy, toSvg, plotBar, bColor, plotText);
  }

  // ───────── 尺寸标注 ─────────
  drawDims(elems, c, sw, sh, cover, scale, x0, y0, w, h, cx, cy);

  // ───────── 钢筋规格文字标注 ─────────
  drawRebarSpecs(elems, rebars, c, sw, sh, cover, scale, x0, y0, cx, cy, toSvg, plotText);

  // 标题
  elems.push(<text key="title" x={W / 2} y={H - 18} textAnchor="middle" fontSize={15} fill="#334155" fontWeight="bold">{label}</text>);
  return { viewBox: `0 0 ${W} ${H}`, elements: elems, caption: label };
}

// ======== 梁截面钢筋 ========
function drawBeam(
  elems: React.ReactNode[], rebars: Rebar[], b: number, h: number, cover: number,
  scale: number, x0: number, y0: number, cx: number, cy: number,
  toSvg: (xm: number, ym: number) => { x: number; y: number },
  plotBar: (xm: number, ym: number, d: number, color: string, key: string) => void,
  bColor: (r: Rebar) => string,
  plotText: (xm: number, ym: number, text: string, opts?: any) => void,
) {
  const cov = cover;

  // 箍筋 — 画为保护层内侧的闭合矩形框
  const stirrups = rebars.filter(r => r.role === "STIRRUP");
  stirrups.forEach((r, i) => {
    const inset = (cov + r.diameter / 2) * scale;
    const sx = x0 + inset, sy = y0 + inset;
    const sw = b * scale - 2 * inset, sh2 = h * scale - 2 * inset;
    elems.push(<rect key={`stirrup-${i}`} x={sx} y={sy} width={sw} height={sh2} fill="none" stroke="#ea580c" strokeWidth={1.2} />);
  });

  // 拉筋
  rebars.filter(r => r.role === "TIE").forEach((r, idx) => {
    const n = Math.max(2, r.count ?? 2);
    const yBase = cov + (h - 2 * cov) * 0.5;
    for (let i = 0; i < n; i++) {
      const xMm = cov + (b - 2 * cov) * (n > 1 ? i / (n - 1) : 0.5);
      plotBar(xMm, yBase, r.diameter, bColor(r), `tie-${idx}-${i}`);
    }
  });

  // 上部筋：TOP / LONGITUDINAL / ERECTION / BENT / ADDITIONAL
  const topRoles = ["TOP", "LONGITUDINAL", "ERECTION", "BENT", "ADDITIONAL"];
  const topBars = rebars.filter(r => topRoles.includes(r.role));
  topBars.forEach((r, idx) => {
    const n = Math.max(2, r.count ?? 2);
    const yMm = cov + r.diameter / 2;
    for (let i = 0; i < n; i++) {
      const xMm = cov + r.diameter / 2 + ((b - 2 * cov - r.diameter) * (n > 1 ? i / (n - 1) : 0.5));
      plotBar(xMm, yMm, r.diameter, bColor(r), `top-${idx}-${i}`);
    }
  });

  // 下部筋
  rebars.filter(r => r.role === "BOTTOM").forEach((r, idx) => {
    const n = Math.max(2, r.count ?? 2);
    const yMm = h - cov - r.diameter / 2;
    for (let i = 0; i < n; i++) {
      const xMm = cov + r.diameter / 2 + ((b - 2 * cov - r.diameter) * (n > 1 ? i / (n - 1) : 0.5));
      plotBar(xMm, yMm, r.diameter, bColor(r), `bot-${idx}-${i}`);
    }
  });

  // 腰筋 SIDE
  rebars.filter(r => r.role === "SIDE").forEach((r, idx) => {
    const n = Math.max(2, r.count ?? 2);
    for (let i = 0; i < n; i++) {
      const yMm = cov + (h - 2 * cov) * (n > 1 ? i / (n - 1) : 0.5);
      plotBar(cov + r.diameter / 2, yMm, r.diameter, bColor(r), `sideL-${idx}-${i}`);
      plotBar(b - cov - r.diameter / 2, yMm, r.diameter, bColor(r), `sideR-${idx}-${i}`);
    }
  });
}

// ======== 柱截面钢筋 ========
function drawColumn(
  elems: React.ReactNode[], rebars: Rebar[], b: number, h: number, cover: number,
  scale: number, x0: number, y0: number, cx: number, cy: number,
  toSvg: (xm: number, ym: number) => { x: number; y: number },
  plotBar: (xm: number, ym: number, d: number, color: string, key: string) => void,
  bColor: (r: Rebar) => string,
  plotText: (xm: number, ym: number, text: string, opts?: any) => void,
) {
  const cov = cover;

  // 箍筋
  rebars.filter(r => r.role === "STIRRUP").forEach((r, i) => {
    const inset = (cov + r.diameter / 2) * scale;
    const sx = x0 + inset, sy = y0 + inset;
    const sw = b * scale - 2 * inset, sh2 = h * scale - 2 * inset;
    elems.push(<rect key={`c-stirrup-${i}`} x={sx} y={sy} width={sw} height={sh2} fill="none" stroke="#ea580c" strokeWidth={1.2} />);
  });

  // 纵筋：MAIN / CONSTRUCT_COL / TIE — 沿截面四周均匀分布
  const longRoles = ["MAIN", "CONSTRUCT_COL", "TIE"];
  longBars(rebars.filter(r => longRoles.includes(r.role)), b, h, cov, plotBar, bColor, "col");
}

// ======== 板剖面钢筋 ========
function drawSlab(
  elems: React.ReactNode[], rebars: Rebar[], Lx: number, t: number, cover: number,
  scale: number, x0: number, y0: number, cx: number, cy: number,
  toSvg: (xm: number, ym: number) => { x: number; y: number },
  plotBar: (xm: number, ym: number, d: number, color: string, key: string) => void,
  bColor: (r: Rebar) => string,
  plotText: (xm: number, ym: number, text: string, opts?: any) => void,
) {
  const cov = cover;

  // 面筋 TOP
  rebars.filter(r => r.role === "TOP").forEach((r, idx) => {
    const n = Math.max(2, r.count ?? 2);
    const yMm = cov + r.diameter / 2;
    for (let i = 0; i < n; i++) {
      const xMm = cov + (Lx - 2 * cov) * (n > 1 ? i / (n - 1) : 0.5);
      plotBar(xMm, yMm, r.diameter, bColor(r), `stop-${idx}-${i}`);
    }
  });

  // 底筋 BOTTOM
  rebars.filter(r => r.role === "BOTTOM").forEach((r, idx) => {
    const n = Math.max(2, r.count ?? 2);
    const yMm = t - cov - r.diameter / 2;
    for (let i = 0; i < n; i++) {
      const xMm = cov + (Lx - 2 * cov) * (n > 1 ? i / (n - 1) : 0.5);
      plotBar(xMm, yMm, r.diameter, bColor(r), `sbot-${idx}-${i}`);
    }
  });

  // 分布筋 DIST / 构造筋 CONSTRUCT / 马凳筋 STOOL — 放在中间层示意
  const midRoles = ["DIST", "CONSTRUCT", "STOOL"];
  rebars.filter(r => midRoles.includes(r.role)).forEach((r, idx) => {
    const n = Math.max(2, r.count ?? 2);
    const yMm = t / 2;
    for (let i = 0; i < n; i++) {
      const xMm = cov + (Lx - 2 * cov) * (n > 1 ? i / (n - 1) : 0.5);
      plotBar(xMm, yMm, r.diameter, bColor(r), `smid-${idx}-${i}`);
    }
  });

  // 支座负筋 NEG — 两端外伸
  rebars.filter(r => r.role === "NEG").forEach((r, idx) => {
    const n = Math.max(2, r.count ?? 2);
    const ext = (r.extension ?? Lx / 4);
    const yMm = cov + r.diameter / 2;
    for (let i = 0; i < n; i++) {
      const z = -Lx / 2 + (n > 1 ? (Lx * i) / (n - 1) : 0);
      // 左端
      if (ext > 0) plotBar(cov + ext / 2, yMm, r.diameter, "#9333ea", `snegL-${idx}-${i}`);
      // 右端
      if (ext > 0) plotBar(Lx - cov - ext / 2, yMm, r.diameter, "#9333ea", `snegR-${idx}-${i}`);
    }
  });
}

// ======== 桩截面钢筋 ========
function drawPile(
  elems: React.ReactNode[], rebars: Rebar[], D: number, _h: number, cover: number,
  scale: number, x0: number, y0: number, cx: number, cy: number,
  toSvg: (xm: number, ym: number) => { x: number; y: number },
  plotBar: (xm: number, ym: number, d: number, color: string, key: string) => void,
  bColor: (r: Rebar) => string,
  plotText: (xm: number, ym: number, text: string, opts?: any) => void,
) {
  const cov = cover;
  const R = D / 2;

  // 螺旋箍 / 加劲箍 — 画为同心圆
  const spiralRoles = ["SPIRAL", "STIFFEN", "STIRRUP"];
  rebars.filter(r => spiralRoles.includes(r.role)).forEach((r, i) => {
    const rPx = Math.max(0, (R - cov - r.diameter) * scale);
    elems.push(<circle key={`spiral-${i}`} cx={cx} cy={cy} r={rPx} fill="none" stroke="#ea580c" strokeWidth={1} />);
  });

  // 主筋 MAIN
  rebars.filter(r => r.role === "MAIN").forEach((r, idx) => {
    const n = Math.max(4, r.count ?? 6);
    const r2 = R - cov - r.diameter / 2;
    for (let i = 0; i < n; i++) {
      const ang = (2 * Math.PI * i) / n;
      const xm = R + r2 * Math.cos(ang);
      const ym = R + r2 * Math.sin(ang);
      plotBar(xm, ym, r.diameter, bColor(r), `pm-${idx}-${i}`);
    }
  });

  // 声测管 SONIC — 更靠近圆心
  rebars.filter(r => r.role === "SONIC").forEach((r, idx) => {
    const n = Math.max(2, r.count ?? 3);
    const r3 = (R - cov) * 0.5;
    for (let i = 0; i < n; i++) {
      const ang = (2 * Math.PI * i) / n;
      const xm = R + r3 * Math.cos(ang);
      const ym = R + r3 * Math.sin(ang);
      plotBar(xm, ym, r.diameter, "#facc15", `sonic-${idx}-${i}`);
    }
  });
}

// ======== 通用纵筋沿周分布 ========
function longBars(
  bars: Rebar[], b: number, h: number, cov: number,
  plotBar: (xm: number, ym: number, d: number, color: string, key: string) => void,
  bColor: (r: Rebar) => string,
  prefix: string,
) {
  bars.forEach((r, idx) => {
    const n = Math.max(4, r.count ?? 4);
    const perSide = Math.ceil(n / 4);
    const positions: [number, number][] = [];
    for (let s = 0; s < 4; s++) {
      for (let i = 0; i < perSide; i++) {
        const t = perSide > 1 ? i / (perSide - 1) : 0.5;
        if (s === 0) positions.push([cov + r.diameter / 2 + (b - 2 * cov - r.diameter) * t, cov + r.diameter / 2]);
        else if (s === 1) positions.push([cov + r.diameter / 2 + (b - 2 * cov - r.diameter) * t, h - cov - r.diameter / 2]);
        else if (s === 2) positions.push([cov + r.diameter / 2, cov + r.diameter / 2 + (h - 2 * cov - r.diameter) * t]);
        else positions.push([b - cov - r.diameter / 2, cov + r.diameter / 2 + (h - 2 * cov - r.diameter) * t]);
      }
    }
    const uniq = Array.from(new Set(positions.map(p => p.join(",")))).slice(0, n).map(s => s.split(",").map(Number));
    uniq.forEach(([xm, ym], i2) => plotBar(xm, ym, r.diameter, bColor(r), `${prefix}-${idx}-${i2}`));
  });
}

// ======== 尺寸标注 ========
function drawDims(
  elems: React.ReactNode[], c: Component, sw: number, sh: number, cover: number,
  scale: number, x0: number, y0: number, w: number, h: number, cx: number, cy: number,
) {
  const offset = 24;
  const tick = 5;

  if (c.type === "PILE") {
    // 直径标注：水平引出线
    const y = cy + w / 2 + offset;
    elems.push(<line key="d1" x1={cx - w / 2} y1={y - tick} x2={cx - w / 2} y2={y + tick} stroke="#64748b" strokeWidth={1} />);
    elems.push(<line key="d2" x1={cx + w / 2} y1={y - tick} x2={cx + w / 2} y2={y + tick} stroke="#64748b" strokeWidth={1} />);
    elems.push(<line key="d3" x1={cx - w / 2} y1={y} x2={cx + w / 2} y2={y} stroke="#64748b" strokeWidth={0.8} />);
    elems.push(<text key="dt" x={cx} y={y + 14} textAnchor="middle" fontSize={12} fill="#475569">D={sw}</text>);
    // 保护层
    elems.push(<text key="covt" x={cx + w / 2 + 10} y={cy} textAnchor="start" fontSize={11} fill="#64748b">c={cover}</text>);
    return;
  }

  // 水平尺寸线（宽度）
  const yBot = y0 + h + offset;
  elems.push(<line key="dw1" x1={x0} y1={yBot - tick} x2={x0} y2={yBot + tick} stroke="#64748b" strokeWidth={1} />);
  elems.push(<line key="dw2" x1={x0 + w} y1={yBot - tick} x2={x0 + w} y2={yBot + tick} stroke="#64748b" strokeWidth={1} />);
  elems.push(<line key="dw3" x1={x0} y1={yBot} x2={x0 + w} y2={yBot} stroke="#64748b" strokeWidth={0.8} />);
  elems.push(<text key="dwt" x={x0 + w / 2} y={yBot + 14} textAnchor="middle" fontSize={12} fill="#475569">{c.type === "SLAB" ? `Lx=${sw}` : `b=${sw}`}</text>);

  // 垂直尺寸线（高度）
  const xRight = x0 + w + offset;
  elems.push(<line key="dh1" x1={xRight - tick} y1={y0} x2={xRight + tick} y2={y0} stroke="#64748b" strokeWidth={1} />);
  elems.push(<line key="dh2" x1={xRight - tick} y1={y0 + h} x2={xRight + tick} y2={y0 + h} stroke="#64748b" strokeWidth={1} />);
  elems.push(<line key="dh3" x1={xRight} y1={y0} x2={xRight} y2={y0 + h} stroke="#64748b" strokeWidth={0.8} />);
  const labelH = c.type === "SLAB" ? `t=${sh}` : `h=${sh}`;
  elems.push(<text key="dht" x={xRight + 4} y={y0 + h / 2 + 4} textAnchor="start" fontSize={12} fill="#475569" transform={`rotate(-90, ${xRight + 4}, ${y0 + h / 2})`}>{labelH}</text>);

  // 保护层标注
  const covOff = 16;
  const cx2 = x0 - covOff;
  elems.push(<line key="covl" x1={x0} y1={y0 + h / 2} x2={cx2} y2={y0 + h / 2} stroke="#64748b" strokeWidth={0.8} />);
  elems.push(<text key="covt" x={cx2 - 2} y={y0 + h / 2 + 4} textAnchor="end" fontSize={11} fill="#64748b">c={cover}</text>);
}

// ======== 钢筋规格文字标注 ========
function drawRebarSpecs(
  elems: React.ReactNode[], rebars: Rebar[], c: Component, sw: number, sh: number, cover: number,
  scale: number, x0: number, y0: number, cx: number, cy: number,
  toSvg: (xm: number, ym: number) => { x: number; y: number },
  plotText: (xm: number, ym: number, text: string, opts?: any) => void,
) {
  // 按角色分组，去重后写标签
  const seen = new Set<string>();
  const specs: { role: string; text: string; xm: number; ym: number }[] = [];

  const addSpec = (role: string, text: string, xm: number, ym: number) => {
    const k = `${role}-${text}`;
    if (seen.has(k)) return;
    seen.add(k);
    specs.push({ role, text, xm, ym });
  };

  rebars.forEach(r => {
    const grade = r.grade;
    const dia = r.diameter;
    const count = r.count ?? 0;
    const spacing = r.spacing ?? 0;
    const densify = r.densifySpacing;
    const label = r.label;

    if (c.type === "BEAM") {
      if (r.role === "STIRRUP") {
        addSpec("STIRRUP", label || `${densify ? `${dia}@${densify}/${spacing}` : `${dia}@${spacing}`}`, sw / 2, cover + (sh - 2 * cover) * 0.5);
      } else if (["TOP", "LONGITUDINAL", "ERECTION", "BENT", "ADDITIONAL"].includes(r.role)) {
        addSpec(r.role, label || `${count}${grade}-${dia}`, sw / 2, cover / 2);
      } else if (r.role === "BOTTOM") {
        addSpec("BOTTOM", label || `${count}${grade}-${dia}`, sw / 2, sh - cover / 2);
      } else if (r.role === "SIDE") {
        addSpec("SIDE", label || `${count}${grade}-${dia}`, cover / 2, sh / 2);
      } else if (r.role === "TIE") {
        addSpec("TIE", label || `${count}${grade}-${dia}`, sw - cover / 2, sh / 2);
      }
    } else if (c.type === "COLUMN") {
      if (r.role === "STIRRUP") {
        addSpec("STIRRUP", label || `${dia}@${spacing}`, sw / 2, sh / 2);
      } else if (["MAIN", "CONSTRUCT_COL", "TIE"].includes(r.role)) {
        addSpec(r.role, label || `${count}${grade}-${dia}`, sw / 2, cover / 2);
      }
    } else if (c.type === "SLAB") {
      if (r.role === "TOP") {
        addSpec("TOP", label || `${grade}-${dia}@${spacing}`, sw / 2, cover / 2);
      } else if (r.role === "BOTTOM") {
        addSpec("BOTTOM", label || `${grade}-${dia}@${spacing}`, sw / 2, sh - cover / 2);
      } else if (r.role === "DIST") {
        addSpec("DIST", label || `${grade}-${dia}@${spacing}`, sw / 2, sh / 2);
      } else if (r.role === "NEG") {
        addSpec("NEG", label || `${grade}-${dia}@${spacing} 外伸${r.extension ?? 0}`, sw / 2, cover / 2 + 12);
      } else if (["CONSTRUCT", "STOOL"].includes(r.role)) {
        addSpec(r.role, label || `${grade}-${dia}@${spacing}`, sw / 2, sh / 2 + 12);
      }
    } else if (c.type === "PILE") {
      if (["SPIRAL", "STIFFEN", "STIRRUP"].includes(r.role)) {
        addSpec(r.role, label || `${dia}@${spacing}`, sw / 2, sh / 2);
      } else if (r.role === "MAIN") {
        addSpec("MAIN", label || `${count}${grade}-${dia}`, sw / 2, cover / 2);
      } else if (r.role === "SONIC") {
        addSpec("SONIC", label || `${count}Φ${dia} 声测管`, sw / 2, sh * 0.35);
      }
    }
  });

  specs.forEach((s, i) => {
    const p = toSvg(s.xm, s.ym);
    // 避免标签重叠：简单用偏移
    const dy = (i % 3 - 1) * 14;
    elems.push(
      <text key={`spec-${i}`} x={p.x} y={p.y + dy} textAnchor="middle" fontSize={11} fill="#475569" fontFamily="sans-serif">
        {roleName(s.role)} {s.text}
      </text>
    );
  });
}

function roleName(r: string) {
  return ({
    TOP: "面筋", BOTTOM: "底筋", SIDE: "腰筋", STIRRUP: "箍筋", MAIN: "纵筋", DIST: "分布筋",
    SPIRAL: "螺旋箍", NEG: "支座负筋", LONGITUDINAL: "纵筋", ERECTION: "架立筋", BENT: "弯起筋",
    TIE: "拉筋", ADDITIONAL: "附加筋", CONSTRUCT: "构造筋", STOOL: "马凳筋",
    CONSTRUCT_COL: "构造纵筋", STIFFEN: "加劲箍", SONIC: "声测管",
  } as any)[r] ?? r;
}
