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

  if (list.length === 0) return <div className="p-4 text-eng-muted text-sm">暂无校验项，请先创建构件。</div>;

  return (
    <div className="p-3 space-y-1.5 text-sm">
      <div className="text-xs text-eng-muted mb-2">
        {selectedId ? `当前构件：${nameOf(selectedId)}` : "全部构件"}
      </div>
      {list.map((v, i) => {
        const Icon = v.severity === "pass" ? CheckCircle2 : v.severity === "warn" ? AlertTriangle : XCircle;
        const color = v.severity === "pass" ? "text-eng-ok" : v.severity === "warn" ? "text-eng-warn" : "text-eng-err";
        return (
          <div key={i} className="panel p-2 flex items-start gap-2 cursor-pointer hover:bg-eng-panel2" onClick={() => select(v.componentId)}>
            <Icon className={`w-4 h-4 mt-0.5 ${color}`} />
            <div className="flex-1">
              <div className="flex justify-between">
                <span className="font-medium">{v.rule}</span>
                <span className="text-xs text-eng-muted">{nameOf(v.componentId)}</span>
              </div>
              <div className="text-xs text-eng-muted mt-0.5">{v.message}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
