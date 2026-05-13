"use client";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useStore } from "@/lib/store";

export default function ValidationPanel() {
  const validations = useStore((s) => s.validations);
  const components = useStore((s) => s.components);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);

  const list = selectedId ? validations.filter((v) => v.componentId === selectedId) : validations;
  const nameOf = (id: string) => components.find((c) => c.id === id)?.name ?? id;

  if (list.length === 0) return <div className="p-4 text-on-surface-variant text-sm">暂无校验项，请先创建构件。</div>;

  return (
    <div className="p-4 space-y-2 text-sm">
      <div className="text-label-code text-on-surface-variant mb-2">
        {selectedId ? `当前构件：${nameOf(selectedId)}` : "全部构件"}
      </div>
      {list.map((v, i) => {
        const Icon = v.severity === "pass" ? CheckCircle2 : v.severity === "warn" ? AlertTriangle : XCircle;
        const color = v.severity === "pass" ? "text-tertiary" : v.severity === "warn" ? "text-secondary" : "text-error";
        const bgColor = v.severity === "pass" ? "bg-tertiary/5" : v.severity === "warn" ? "bg-secondary/5" : "bg-error/5";
        return (
          <div
            key={i}
            className={`bg-surface-container-high/50 rounded-lg p-3 flex items-start gap-2 cursor-pointer hover:bg-surface-container-high transition-colors border border-outline-variant/10 ${bgColor}`}
            onClick={() => select(v.componentId)}
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <span className="font-medium text-on-surface">{v.rule}</span>
                <span className="text-xs text-on-surface-variant font-mono">{nameOf(v.componentId)}</span>
              </div>
              <div className="text-xs text-on-surface-variant mt-0.5">{v.message}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
