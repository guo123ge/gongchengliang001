"use client";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { calcAll, aggregate } from "@/lib/quantity/calc";
import { fmt } from "@/lib/utils";

export default function QuantityPanel() {
  const components = useStore((s) => s.components);
  const results = useMemo(() => calcAll(components), [components]);
  const agg = useMemo(() => aggregate(results), [results]);

  if (components.length === 0) return <div className="p-4 text-eng-muted text-sm">尚无构件，请先添加。</div>;

  return (
    <div className="p-3 space-y-3 text-sm tabular">
      <div className="panel p-3">
        <div className="text-xs uppercase tracking-wider text-eng-muted mb-2">总量汇总</div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="混凝土" value={fmt(agg.volume, 3)} unit="m³" />
          <Stat label="模板" value={fmt(agg.formwork, 2)} unit="m²" />
          <Stat label="钢筋" value={fmt(agg.rebarTotal, 1)} unit="kg" />
        </div>
      </div>

      <div className="panel">
        <div className="px-3 py-2 border-b border-eng-border text-xs uppercase tracking-wider text-eng-muted">
          构件明细
        </div>
        <table className="w-full text-xs">
          <thead className="text-eng-muted">
            <tr>
              <th className="text-left px-2 py-1.5">名称</th>
              <th className="text-left px-2 py-1.5">类型</th>
              <th className="text-right px-2 py-1.5">混凝土(m³)</th>
              <th className="text-right px-2 py-1.5">模板(m²)</th>
              <th className="text-right px-2 py-1.5">钢筋(kg)</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.componentId} className="border-t border-eng-border">
                <td className="px-2 py-1">{r.name}</td>
                <td className="px-2 py-1">{r.type}</td>
                <td className="px-2 py-1 text-right">{fmt(r.concreteVolume, 3)}</td>
                <td className="px-2 py-1 text-right">{fmt(r.formworkArea, 2)}</td>
                <td className="px-2 py-1 text-right">{fmt(r.totalRebarWeight, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="px-3 py-2 border-b border-eng-border text-xs uppercase tracking-wider text-eng-muted">
          钢筋规格汇总
        </div>
        <table className="w-full text-xs">
          <thead className="text-eng-muted">
            <tr>
              <th className="text-left px-2 py-1.5">等级-直径</th>
              <th className="text-right px-2 py-1.5">总长(m)</th>
              <th className="text-right px-2 py-1.5">重量(kg)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(agg.rebar).map(([k, v]) => (
              <tr key={k} className="border-t border-eng-border">
                <td className="px-2 py-1">{k}</td>
                <td className="px-2 py-1 text-right">{fmt(v.length, 2)}</td>
                <td className="px-2 py-1 text-right">{fmt(v.weight, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="text-center">
      <div className="text-xs text-eng-muted">{label}</div>
      <div className="text-xl font-semibold text-eng-text">{value}</div>
      <div className="text-xs text-eng-muted">{unit}</div>
    </div>
  );
}
