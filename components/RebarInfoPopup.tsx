"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import { X, GripVertical } from "lucide-react";
import { useStore } from "@/lib/store";

const ROLE_NAMES: Record<string, string> = {
  TOP: "面筋", BOTTOM: "底筋", SIDE: "腰筋", STIRRUP: "箍筋", MAIN: "纵筋",
  DIST: "分布筋", SPIRAL: "螺旋箍", NEG: "支座负筋",
  LONGITUDINAL: "纵向受力筋", ERECTION: "架立筋", BENT: "弯起筋",
  TIE: "拉筋", ADDITIONAL: "附加筋", CONSTRUCT: "构造配筋", STOOL: "马凳筋",
  CONSTRUCT_COL: "纵向构造筋", STIFFEN: "加劲箍", SONIC: "声测管",
  HORIZONTAL: "水平分布筋", VERTICAL: "竖向分布筋", TRANSVERSE: "横向受力筋",
  BOT_X: "底板X向筋", BOT_Y: "底板Y向筋", TOP_X: "顶板X向筋", TOP_Y: "顶板Y向筋",
};

const GRADE_COLOR: Record<string, string> = {
  HPB300: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  HRB400: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  HRB500: "text-red-400 bg-red-400/10 border-red-400/30",
};

export default function RebarInfoPopup() {
  const selectedRebarId = useStore((s) => s.selectedRebarId);
  const selectedRebarComponentId = useStore((s) => s.selectedRebarComponentId);
  const setSelectedRebar = useStore((s) => s.setSelectedRebar);
  const components = useStore((s) => s.components);

  const [pos, setPos] = useState({ x: 16, y: 80 }); // 初始位置：左侧偏上，避免遮挡图例
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const popupRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!popupRef.current) return;
    dragRef.current.dragging = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    dragRef.current.origX = pos.x;
    dragRef.current.origY = pos.y;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current.dragging = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  useEffect(() => {
    // 每次打开时重置到默认左侧位置
    if (selectedRebarId && selectedRebarComponentId) {
      setPos({ x: 16, y: 80 });
    }
  }, [selectedRebarId, selectedRebarComponentId]);

  if (!selectedRebarId || !selectedRebarComponentId) return null;

  const comp = components.find((c) => c.id === selectedRebarComponentId);
  const rebar = comp?.rebars.find((r) => r.id === selectedRebarId);
  if (!comp || !rebar) return null;

  const gradeClass = GRADE_COLOR[rebar.grade] ?? "text-primary bg-primary/10 border-primary/30";

  return (
    <div
      ref={popupRef}
      className="absolute z-20 w-56 rounded-xl bg-surface-container-high/95 backdrop-blur border border-outline-variant/30 shadow-xl text-sm overflow-hidden select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Drag Handle */}
      <div
        className="flex items-center justify-between px-2 py-1.5 border-b border-outline-variant/20 bg-surface-container-highest/50 cursor-move"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="flex items-center gap-1">
          <GripVertical className="w-3 h-3 text-on-surface-variant/50" />
          <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">钢筋信息</span>
        </div>
        <button
          onClick={() => setSelectedRebar(null)}
          className="p-0.5 rounded hover:bg-surface-container-highest text-on-surface-variant"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-outline-variant/20 bg-surface-container-highest/50">
        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${gradeClass}`}>
          {rebar.grade}
        </span>
        <span className="text-on-surface font-medium text-xs">{ROLE_NAMES[rebar.role] ?? rebar.role}</span>
      </div>

      {/* Detail rows */}
      <div className="px-3 py-2 space-y-1.5">
        <Row label="构件" value={comp.name} />
        <Row label="直径" value={`Φ ${rebar.diameter} mm`} />
        {rebar.count != null && rebar.count > 0 && (
          <Row label="根数" value={`${rebar.count} 根`} />
        )}
        {rebar.spacing != null && rebar.spacing > 0 && (
          <Row label={rebar.densifySpacing ? "非加密间距" : "间距"} value={`${rebar.spacing} mm`} />
        )}
        {rebar.densifySpacing != null && rebar.densifySpacing > 0 && (
          <Row label="加密间距" value={`${rebar.densifySpacing} mm`} />
        )}
        {rebar.densifyLength != null && rebar.densifyLength > 0 && (
          <Row label="加密区长度" value={`${rebar.densifyLength} mm`} />
        )}
        {rebar.extension != null && rebar.extension > 0 && (
          <Row label="支座外伸" value={`${rebar.extension} mm`} />
        )}
        {rebar.label && (
          <div className="mt-1 px-2 py-1 rounded bg-surface-container-lowest/60 border border-outline-variant/15">
            <span className="text-label-code text-on-surface-variant font-mono break-all">{rebar.label}</span>
          </div>
        )}
      </div>

      <div className="px-3 pb-2">
        <p className="text-[10px] text-on-surface-variant/50">再次点击该钢筋可关闭</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-on-surface-variant text-xs shrink-0">{label}</span>
      <span className="text-on-surface font-mono text-xs text-right">{value}</span>
    </div>
  );
}
