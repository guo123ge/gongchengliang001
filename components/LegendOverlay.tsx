"use client";
export default function LegendOverlay() {
  const items = [
    { c: "#4d8eff", t: "HRB400 纵筋" },
    { c: "#dc2626", t: "HRB500 / 加密区箍筋" },
    { c: "#4edea3", t: "HPB300 纵筋" },
    { c: "#ee9800", t: "非加密箍筋 / 螺旋箍" },
    { c: "#9333ea", t: "板支座负筋" },
    { c: "#8c909f", t: "混凝土（半透明）" },
  ];
  return (
    <div className="absolute bottom-4 left-4 flex gap-2 z-10">
      {/* Legend Panel */}
      <div className="glass-panel rounded-lg p-3 text-xs space-y-1.5">
        <div className="text-label-code text-on-surface-variant uppercase tracking-wider mb-1">图例</div>
        {items.map((x) => (
          <div key={x.t} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: x.c }} />
            <span className="text-on-surface">{x.t}</span>
          </div>
        ))}
      </div>

      {/* Controls Panel */}
      <div className="glass-panel rounded-lg p-3 text-xs space-y-1.5">
        <div className="text-label-code text-on-surface-variant uppercase tracking-wider mb-1">操作</div>
        <div className="flex items-center gap-1.5 text-on-surface-variant">
          <span className="inline-block w-4 h-4 rounded bg-surface-container-high border border-outline-variant/30 flex items-center justify-center text-[8px] font-mono">L</span>
          <span>左键旋转</span>
        </div>
        <div className="flex items-center gap-1.5 text-on-surface-variant">
          <span className="inline-block w-4 h-4 rounded bg-surface-container-high border border-outline-variant/30 flex items-center justify-center text-[8px] font-mono">R</span>
          <span>右键平移</span>
        </div>
        <div className="flex items-center gap-1.5 text-on-surface-variant">
          <span className="inline-block w-4 h-4 rounded bg-surface-container-high border border-outline-variant/30 flex items-center justify-center text-[8px] font-mono">滚</span>
          <span>滚轮缩放</span>
        </div>
        <div className="flex items-center gap-1.5 text-on-surface-variant">
          <span className="inline-block w-4 h-4 rounded bg-surface-container-high border border-outline-variant/30 flex items-center justify-center text-[8px] font-mono">点</span>
          <span>点击选中</span>
        </div>
      </div>

      {/* 3D Gizmos Legend */}
      <div className="glass-panel rounded-lg p-3 text-xs space-y-1.5">
        <div className="text-label-code text-on-surface-variant uppercase tracking-wider mb-1">坐标轴</div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-500" />
          <span className="font-mono text-red-400">X</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-500" />
          <span className="font-mono text-green-400">Y</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" />
          <span className="font-mono text-blue-400">Z</span>
        </div>
      </div>
    </div>
  );
}
