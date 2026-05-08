"use client";
import { useMemo, useRef } from "react";
import { Download, Scissors } from "lucide-react";
import { useStore } from "@/lib/store";
import saveAs from "file-saver";

/** 简化版剖面：对当前选中构件在指定轴向生成 SVG 投影 */
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

function buildSection(c: any, axis: "x" | "y" | "z") {
  if (!c) return { viewBox: "0 0 1000 600", elements: null as any, caption: "" };
  const g = c.geometry;
  const cover = c.concrete.cover;
  const pad = 50;
  let W = 1000, H = 600;
  let sectionW = 0, sectionH = 0;
  let label = "";

  if (c.type === "BEAM") { sectionW = g.b; sectionH = g.h; label = `${c.name} 梁截面 ${g.b}×${g.h}`; }
  else if (c.type === "COLUMN") { sectionW = g.b; sectionH = g.h; label = `${c.name} 柱截面 ${g.b}×${g.h}`; }
  else if (c.type === "SLAB") { sectionW = g.Lx; sectionH = g.t; label = `${c.name} 板剖面 ${g.Lx}×${g.t}`; }
  else if (c.type === "PILE") { sectionW = g.D; sectionH = g.D; label = `${c.name} 桩截面 D${g.D}`; }

  const scale = Math.min((W - 2 * pad) / sectionW, (H - 2 * pad) / sectionH);
  const cx = W / 2, cy = H / 2;
  const w = sectionW * scale, h = sectionH * scale;
  const x0 = cx - w / 2, y0 = cy - h / 2;
  const covPx = cover * scale;

  const elems: any[] = [];
  // 混凝土
  if (c.type === "PILE") {
    elems.push(<circle key="c" cx={cx} cy={cy} r={w / 2} fill="#e2e8f0" stroke="#334155" strokeWidth={1.5} />);
    elems.push(<circle key="cc" cx={cx} cy={cy} r={w / 2 - covPx} fill="none" stroke="#94a3b8" strokeDasharray="4 4" />);
  } else {
    elems.push(<rect key="c" x={x0} y={y0} width={w} height={h} fill="#e2e8f0" stroke="#334155" strokeWidth={1.5} />);
    elems.push(<rect key="cc" x={x0 + covPx} y={y0 + covPx} width={w - 2 * covPx} height={h - 2 * covPx}
      fill="none" stroke="#94a3b8" strokeDasharray="4 4" />);
  }

  // 钢筋点
  const plotBar = (xMm: number, yMm: number, d: number, color: string, key: string) => {
    const px = cx - w / 2 + (xMm * scale);
    const py = cy - h / 2 + (yMm * scale);
    elems.push(<circle key={key} cx={px} cy={py} r={Math.max(3, d * scale / 2)} fill={color} stroke="#111827" strokeWidth={0.6} />);
  };
  const colorOf = (grade: string, role: string) => {
    if (role === "STIRRUP" || role === "SPIRAL") return "#ea580c";
    if (grade === "HRB500") return "#dc2626";
    if (grade === "HPB300") return "#16a34a";
    return "#2563eb";
  };

  if (c.type === "BEAM" || c.type === "COLUMN") {
    const bW = sectionW, bH = sectionH;
    const mains = c.rebars.filter((r: any) => ["TOP", "BOTTOM", "MAIN"].includes(r.role));
    mains.forEach((r: any, idx: number) => {
      const n = Math.max(2, r.count ?? 2);
      const yMm = r.role === "TOP" ? cover + r.diameter / 2
        : r.role === "BOTTOM" ? bH - cover - r.diameter / 2
          : null;
      if (yMm != null) {
        for (let i = 0; i < n; i++) {
          const xMm = cover + r.diameter / 2 + ((bW - 2 * cover - r.diameter) * (n > 1 ? i / (n - 1) : 0.5));
          plotBar(xMm, yMm, r.diameter, colorOf(r.grade, r.role), `b${idx}-${i}`);
        }
      } else {
        // MAIN 沿周分布
        const per = Math.ceil(n / 4);
        let idx2 = 0;
        for (let s = 0; s < 4 && idx2 < n; s++) {
          for (let i = 0; i < per && idx2 < n; i++, idx2++) {
            const t = per > 1 ? i / (per - 1) : 0.5;
            const xm = s === 0 || s === 1 ? cover + r.diameter / 2 + (bW - 2 * cover - r.diameter) * t
              : s === 2 ? cover + r.diameter / 2 : bW - cover - r.diameter / 2;
            const ym = s === 0 ? cover + r.diameter / 2
              : s === 1 ? bH - cover - r.diameter / 2
                : s === 2 ? cover + r.diameter / 2 + (bH - 2 * cover - r.diameter) * t
                  : cover + r.diameter / 2 + (bH - 2 * cover - r.diameter) * t;
            plotBar(xm, ym, r.diameter, colorOf(r.grade, r.role), `m${idx}-${idx2}`);
          }
        }
      }
    });
  } else if (c.type === "PILE") {
    const main = c.rebars.find((r: any) => r.role === "MAIN");
    if (main) {
      const n = Math.max(4, main.count ?? 6);
      const r2 = sectionW / 2 - cover - main.diameter / 2;
      for (let i = 0; i < n; i++) {
        const ang = (2 * Math.PI * i) / n;
        const xm = sectionW / 2 + r2 * Math.cos(ang);
        const ym = sectionH / 2 + r2 * Math.sin(ang);
        plotBar(xm, ym, main.diameter, colorOf(main.grade, main.role), `pm${i}`);
      }
    }
  }

  // 标题
  elems.push(<text key="t" x={W / 2} y={H - 15} textAnchor="middle" fontSize={14} fill="#334155">{label}</text>);
  return { viewBox: `0 0 ${W} ${H}`, elements: elems, caption: label };
}
