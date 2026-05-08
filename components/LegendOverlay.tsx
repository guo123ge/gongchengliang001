"use client";
export default function LegendOverlay() {
  const items = [
    { c: "#2563eb", t: "HRB400 纵筋" },
    { c: "#dc2626", t: "HRB500 / 加密区箍筋" },
    { c: "#16a34a", t: "HPB300 纵筋" },
    { c: "#ea580c", t: "非加密箍筋 / 螺旋箍" },
    { c: "#9333ea", t: "板支座负筋" },
    { c: "#cbd5e1", t: "混凝土（半透明）" },
  ];
  return (
    <div className="absolute bottom-3 left-3 panel p-2 text-xs space-y-1">
      <div className="text-eng-muted uppercase tracking-wider text-[10px] mb-1">图例</div>
      {items.map((x) => (
        <div key={x.t} className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: x.c }} />
          <span>{x.t}</span>
        </div>
      ))}
    </div>
  );
}
