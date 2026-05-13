"use client";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { calcAll, aggregate } from "@/lib/quantity/calc";
import { fmt } from "@/lib/utils";

export default function QuantityPanel() {
  const components = useStore((s) => s.components);
  const results = useMemo(() => calcAll(components), [components]);
  const agg = useMemo(() => aggregate(results), [results]);

  if (components.length === 0) return <div className="p-4 text-on-surface-variant text-sm">尚无构件，请先添加。</div>;

  return (
    <div className="p-4 space-y-4 text-sm tabular">
      {/* 总量汇总 */}
      <div className="property-card">
        <div className="property-card-header">总量汇总</div>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="混凝土" value={fmt(agg.volume, 3)} unit="m³" color="primary" />
          <Stat label="模板" value={fmt(agg.formwork, 2)} unit="m²" color="secondary" />
          <Stat label="钢筋" value={fmt(agg.rebarTotal, 1)} unit="kg" color="tertiary" />
        </div>
      </div>

      {/* 构件明细 */}
      <div className="property-card !p-0">
        <div className="px-4 py-3 border-b border-outline-variant/20 text-label-code text-on-surface-variant uppercase tracking-wider">
          构件明细
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-on-surface-variant bg-surface-container-high/30">
              <tr>
                <th className="text-left px-3 py-2 font-medium">名称</th>
                <th className="text-left px-3 py-2 font-medium">类型</th>
                <th className="text-right px-3 py-2 font-medium">混凝土(m³)</th>
                <th className="text-right px-3 py-2 font-medium">模板(m²)</th>
                <th className="text-right px-3 py-2 font-medium">钢筋(kg)</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.componentId} className="border-t border-outline-variant/10 hover:bg-surface-container-high/30 transition-colors">
                  <td className="px-3 py-2 text-on-surface">{r.name}</td>
                  <td className="px-3 py-2">
                    <span className="quantity-chip">{r.type}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-primary">{fmt(r.concreteVolume, 3)}</td>
                  <td className="px-3 py-2 text-right font-mono text-secondary">{fmt(r.formworkArea, 2)}</td>
                  <td className="px-3 py-2 text-right font-mono text-tertiary">{fmt(r.totalRebarWeight, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 钢筋规格汇总 */}
      <div className="property-card !p-0">
        <div className="px-4 py-3 border-b border-outline-variant/20 text-label-code text-on-surface-variant uppercase tracking-wider">
          钢筋规格汇总
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-on-surface-variant bg-surface-container-high/30">
              <tr>
                <th className="text-left px-3 py-2 font-medium">等级-直径</th>
                <th className="text-right px-3 py-2 font-medium">总长(m)</th>
                <th className="text-right px-3 py-2 font-medium">重量(kg)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(agg.rebar).map(([k, v]) => (
                <tr key={k} className="border-t border-outline-variant/10 hover:bg-surface-container-high/30 transition-colors">
                  <td className="px-3 py-2 font-mono text-on-surface">{k}</td>
                  <td className="px-3 py-2 text-right font-mono text-on-surface-variant">{fmt(v.length, 2)}</td>
                  <td className="px-3 py-2 text-right font-mono text-tertiary">{fmt(v.weight, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, unit, color }: { label: string; value: string; unit: string; color: "primary" | "secondary" | "tertiary" }) {
  const colorClass = {
    primary: "text-primary",
    secondary: "text-secondary",
    tertiary: "text-tertiary",
  }[color];
  return (
    <div className="text-center p-2 rounded-lg bg-surface-container-high/30">
      <div className="text-xs text-on-surface-variant">{label}</div>
      <div className={`text-2xl font-bold ${colorClass} font-mono tabular`}>{value}</div>
      <div className="text-xs text-on-surface-variant">{unit}</div>
    </div>
  );
}
